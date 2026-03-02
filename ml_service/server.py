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
LLAMA_URL = "http://127.0.0.1:8081/v1/chat/completions"

app = FastAPI(title="RuralMedAI ML Node")

# ── Qwen3.5 Extraction Prompt Setup ───────────────────────────────────────────
# We adapt the Gemini SYSTEM_INSTRUCTION to force JSON output
QWEN_SYSTEM = SYSTEM_INSTRUCTION + """\n\n
CRITICAL: You are running in a specialized JSON-extraction pipeline. 
Instead of outputting function calls like `update_patient_data(...)`, you MUST output a single valid JSON object containing all extracted fields. 
Only include fields where explicit patient data was spoken. If no data was spoken, output an empty JSON object: {}

Allowed keys:
"name", "age", "gender", "caste_category", "ration_card_type", "income", "occupation", "housing_type", "location", 
"chief_complaint", "symptoms", "medical_history", "family_history", "allergies", "medications", 
"tentative_doctor_diagnosis", "initial_llm_diagnosis", "vitals.temperature", "vitals.blood_pressure", "vitals.pulse", "vitals.spo2"

Example Output:
{
  "name": "Raju",
  "age": "45",
  "symptoms": ["fever", "cough"]
}

OUTPUT NAKED JSON ONLY. No markdown, no backticks, no explanation.
"""

async def run_qwen_extraction(transcript: str, existing_context: dict) -> dict:
    if not transcript.strip():
        return {}
        
    # We pass the existing context to prevent the model from extracting the same data repeatedly
    # or conflicting with what it already knows.
    context_str = json.dumps(existing_context) if existing_context else "None"
    
    payload = {
        "messages": [
            {"role": "system", "content": QWEN_SYSTEM},
            {"role": "user", "content": f"Previously Extracted Data:\n{context_str}\n\nNew Transcript to Process:\n{transcript.strip()}"},
        ],
        "temperature": 0.0,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    }
    try:
        # Llama.cpp takes a long time to warm up its KV cache on the first prompt
        async with httpx.AsyncClient(timeout=120.0) as http:
            resp = await http.post(LLAMA_URL, json=payload)
            resp.raise_for_status() # Ensure it returns a 200 OK
            raw = resp.json()
            
            if "choices" not in raw or not raw["choices"]:
                logger.error(f"Unexpected Qwen response: {raw}")
                return {}
                
            content = raw["choices"][0]["message"]["content"].strip()
            logger.info(f"Qwen output: {content}")
            
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
                
            data = json.loads(content)
            # Standardize list formatting just like gemini_service.py did
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
}

def transcribe_groq_sync(audio_float32: np.ndarray, prior_text: str = "") -> str:
    audio_int16 = (audio_float32 * 32767).astype(np.int16)
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_int16.tobytes())
    wav_io.seek(0)
    try:
        valid_history = prior_text.replace("Thank you for watching!", "").replace("Bye!", "").strip()
        context = valid_history[-60:] if valid_history else ""
        
        result = groq_client.audio.transcriptions.create(
            file=("chunk.wav", wav_io.read()),
            model="whisper-large-v3",
            prompt=context,
            response_format="json",
            temperature=0.0,
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

    SPEECH_THRESHOLD = 0.008
    SILENCE_FRAMES_TO_FLUSH = 1 # Very rapid response
    MIN_SPEECH_SAMPLES = 6400  # ~400ms at 16khz
    MAX_SPEECH_SAMPLES = 80000 # ~5s max chunk

    try:
        while True:
            data = await websocket.receive_json()
            if "audio" in data:
                # Expecting base64 encoded PCM from the bridge
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

                # 1. Groq STT
                transcript = await loop.run_in_executor(None, transcribe_groq_sync, to_process, full_transcript)
                
                if not transcript:
                    continue

                clean = transcript.lower().strip().rstrip('.,!?')
                if clean in FILLER_ONLY or len(clean) <= 2:
                    continue

                full_transcript += transcript + " "
                logger.info(f"[STT] {transcript}")

                # 2. Qwen3.5 2B Extraction
                new_data = await run_qwen_extraction(transcript, extracted_state)
                
                if new_data:
                    for field, value in new_data.items():
                        if not value: continue
                        
                        # Merge lists
                        if field in ["symptoms", "medications", "allergies", "medical_history", "family_history"]:
                            existing = extracted_state.get(field, "")
                            existing_list = [x.strip() for x in existing.split(',')] if existing else []
                            new_list = [x.strip() for x in str(value).split(',')]
                            combined = list(set(existing_list + new_list)) # deduplicate
                            extracted_state[field] = ", ".join(combined)
                            
                        else:
                            extracted_state[field] = value
                            
                        # Send updates back to the bridge in the EXACT format Gemini provided
                        await websocket.send_json({
                            "type": "update",
                            "field": field,
                            "value": extracted_state[field]
                        })

    except WebSocketDisconnect:
        logger.info("[ML Node] Disconnected")
    except Exception as e:
        logger.error(f"[ML Node] Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
