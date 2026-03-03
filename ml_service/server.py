import asyncio
import io
import wave
import json
import logging
import re
import httpx
import numpy as np
import base64
import time
import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from groq import Groq

# Pull in the strict prompt from the parent backend folder context
import sys
# Make sure we can import from backend if running from ml_service
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.app.services.prompt_eng import SYSTEM_INSTRUCTION

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ML_Service")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")

groq_client = Groq(api_key=GROQ_API_KEY)
SAMPLE_RATE = 16000
LLAMA_URL = "http://127.0.0.1:8081/completion"

app = FastAPI(title="RuralMedAI ML Node")

# ── Qwen3.5 Extraction Prompt Setup ───────────────────────────────────────────
QWEN_SYSTEM = """
You are a highly capable medical data extraction assistant.
Your task is to extract ONLY patient information from the provided "New Transcript to Process" and output it as a valid JSON object.

Allowed keys:
"name", "age", "gender", "caste_category", "ration_card_type", "income", "occupation", "housing_type", "location", 
"chief_complaint", "symptoms", "medical_history", "family_history", "allergies", "medications", 
"tentative_doctor_diagnosis", "initial_llm_diagnosis", "vitals.temperature", "vitals.blood_pressure", "vitals.pulse", "vitals.spo2"

Rules:
1. ONLY extract information that is explicitly stated in the "New Transcript to Process".
2. The "Previously Extracted Data" is provided for context only so you don't repeat yourself. Do NOT output data that has already been extracted unless it is updated or restated in the new transcript.
3. If no new extractable patient data is found in the new transcript, you MUST output an empty JSON object: {}
4. Standardize standard fields:
   - gender: 'male', 'female', 'other'
5. OUTPUT NAKED JSON ONLY. No markdown, no backticks, no explanation.

Example Output:
{
  "age": "21",
  "gender": "male"
}
"""

async def run_qwen_extraction(transcript: str, existing_context: dict) -> dict:
    if not transcript.strip():
        return {}
        
    context_str = json.dumps(existing_context) if existing_context else "None"
    
    # We bypass chat completions and use raw complete to inject the `{` start, bypassing <think> latencies entirely
    prompt = f"<|im_start|>system\n{QWEN_SYSTEM}<|im_end|>\n<|im_start|>user\nPreviously Extracted Data:\n{context_str}\n\nNew Transcript to Process:\n{transcript.strip()}<|im_end|>\n<|im_start|>assistant\n{{"
    
    payload = {
        "prompt": prompt,
        "temperature": 0.0,
        "n_predict": 150,
        "stop": ["<|im_end|>"]
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as http:
            resp = await http.post(LLAMA_URL, json=payload)
            resp.raise_for_status()
            raw = resp.json()
            
            content = raw.get("content", "").strip()
            content = "{" + content  # Since we pre-filled the {, we append it back to the chunk string
            
            logger.info(f"Qwen raw output: {content}")
            
            # Scrub any markdown weirdness
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
            
            # Simple bracket balancing if it hit token limit
            if not content.strip().endswith("}"):
                content += "}"
                
            data = json.loads(content)
            for k, v in data.items():
                if isinstance(v, list):
                    data[k] = ", ".join(v)
            return data
            
    except Exception as e:
        logger.error(f"Qwen error: {e}")
        return {}


# ── Groq STT ──────────────────────────────────────────────────────────────────
FILLER_ONLY = {
    "thank you", "thanks", "thank you.", "thanks.", "thank you!", 
    "okay", "ok", "okay.", "ok.", "okay!",
    "yes", "no", "yes.", "no.", "yes!", "no!",
    "hmm", "uh", "um", "uh huh", "mm hmm",
    "right", "alright", "i see", "sure", "of course",
    "oh", "ah", "oh i see", "good", "great",
    "please", "sorry", "excuse me",
    "bye", "bye!", "bye.", "bye bye", "goodbye",
    "hello", "hello!", "hello.",
    "thank you for watching!", "thanks for watching!", "thank you for watching.",
    "subscribe", "please subscribe",
    "gracias", "gracias.", "gracias!", "gracias",
    "hola", "hola.", "hola!", "hola", "hola, hola", "hola, hola.",
}

def transcribe_groq_sync(audio_float32: np.ndarray) -> str:
    audio_int16 = (audio_float32 * 32767).astype(np.int16)
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_int16.tobytes())
    wav_io.seek(0)
    try:
        result = groq_client.audio.transcriptions.create(
            file=("chunk.wav", wav_io.read()),
            model="whisper-large-v3",
            response_format="json",
            temperature=0.0,
            language="en"  # Force English to avoid random Spanish/other language hallucinations
        )
        return result.text.strip()
    except Exception as e:
        logger.error(f"Groq STT error: {e}")
        return ""


# ── WebSocket Endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/process-audio")
async def process_audio_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("[ML Node] Connection accepted")
    loop = asyncio.get_event_loop()

    speech_buffer = np.array([], dtype=np.float32)
    silence_frames = 0
    
    # We maintain the semantic state in the ML node to pass as context
    extracted_state = {}
    full_transcript = ""

    SPEECH_THRESHOLD = 0.012  # Increased to reduce false background noise triggers
    SILENCE_FRAMES_TO_FLUSH = 14  # Increased generously to avoid cutting off sentences mid-thought
    MIN_SPEECH_SAMPLES = 16000  # ~1s min chunk
    MAX_SPEECH_SAMPLES = 480000 # ~30s max chunk

    audio_queue = asyncio.Queue()

    async def receiver():
        nonlocal speech_buffer, silence_frames
        while True:
            try:
                data = await websocket.receive_json()
                if "audio" in data:
                    pcm_bytes = base64.b64decode(data["audio"])
                    chunk_i16 = np.frombuffer(pcm_bytes, dtype=np.int16)
                    chunk_f32 = chunk_i16.astype(np.float32) / 32768.0

                    frame_rms = float(np.sqrt(np.mean(chunk_f32 ** 2)))

                    if frame_rms > SPEECH_THRESHOLD:
                        speech_buffer = np.concatenate((speech_buffer, chunk_f32))
                        silence_frames = 0
                    else:
                        if len(speech_buffer) > 0:
                            speech_buffer = np.concatenate((speech_buffer, chunk_f32))
                            silence_frames += 1

                    should_flush = (
                        silence_frames >= SILENCE_FRAMES_TO_FLUSH
                        and len(speech_buffer) >= MIN_SPEECH_SAMPLES
                    ) or len(speech_buffer) >= MAX_SPEECH_SAMPLES

                    if not should_flush:
                        continue

                    to_process = speech_buffer.copy()
                    speech_buffer = np.array([], dtype=np.float32)
                    silence_frames = 0
                    
                    await audio_queue.put(to_process)
            except WebSocketDisconnect:
                await audio_queue.put(None)
                break
            except Exception as e:
                logger.error(f"[Receiver] Error: {e}")

    llm_queue: asyncio.Queue = asyncio.Queue()

    async def stt_processor():
        nonlocal full_transcript
        while True:
            try:
                to_process = await audio_queue.get()
                if to_process is None:
                    await llm_queue.put(None)
                    break

                # 1. Groq STT
                transcript = await loop.run_in_executor(None, transcribe_groq_sync, to_process)
                
                if not transcript:
                    continue

                clean = transcript.lower().strip().rstrip('.,!?')
                if clean in FILLER_ONLY or len(clean) <= 2:
                    continue

                full_transcript += transcript + " "
                logger.info(f"[STT] {transcript}")

                # Send transcript to LLM processor
                await llm_queue.put(transcript)

            except Exception as e:
                logger.error(f"[stt_processor] Error: {e}")

    async def llm_processor():
        nonlocal extracted_state
        while True:
            try:
                transcript = await llm_queue.get()
                if transcript is None:
                    break
                
                # Batch processing: drain the queue to handle Qwen inference backpressure
                while not llm_queue.empty():
                    next_transcript = llm_queue.get_nowait()
                    if next_transcript is None:
                        # Put it back since it's the termination signal
                        llm_queue.put_nowait(next_transcript)
                        break
                    transcript += " " + next_transcript

                # 2. Qwen3.5 2B Extraction
                new_data = await run_qwen_extraction(transcript, extracted_state)
                
                if new_data:
                    for field, value in new_data.items():
                        if not value: continue
                        
                        changed = False
                        # Merge lists
                        if field in ["symptoms", "medications", "allergies", "medical_history", "family_history"]:
                            existing = extracted_state.get(field, "")
                            existing_list = [x.strip() for x in existing.split(',')] if existing else []
                            new_list = [x.strip() for x in str(value).split(',')]
                            combined = list(set(existing_list + new_list)) # deduplicate
                            new_val = ", ".join(combined)
                            if extracted_state.get(field) != new_val:
                                extracted_state[field] = new_val
                                changed = True
                            
                        else:
                            if extracted_state.get(field) != value:
                                extracted_state[field] = value
                                changed = True
                            
                        if changed:
                            # Send updates back to the bridge in the EXACT format Gemini provided
                            await websocket.send_json({
                                "type": "update",
                                "field": field,
                                "value": extracted_state[field]
                            })
            except Exception as e:
                logger.error(f"[llm_processor] Error: {e}")

    try:
        # Run all concurrently
        receive_task = asyncio.create_task(receiver())
        stt_task = asyncio.create_task(stt_processor())
        llm_task = asyncio.create_task(llm_processor())
        
        done, pending = await asyncio.wait(
            [receive_task, stt_task, llm_task], 
            return_when=asyncio.FIRST_COMPLETED
        )
        
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        logger.info("[ML Node] Disconnected")
    except Exception as e:
        logger.error(f"[ML Node] Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
