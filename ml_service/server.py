import asyncio
import io
import wave
import json
import logging
import re
from collections import deque
from difflib import SequenceMatcher
import httpx
import numpy as np
import base64
import time
import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from groq import Groq

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ML_Service")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")

groq_client = Groq(api_key=GROQ_API_KEY)
SAMPLE_RATE = 16000
LLAMA_URL = os.getenv("LLAMA_URL", "http://127.0.0.1:8081/completion")
QWEN_TEMPERATURE = float(os.getenv("QWEN_TEMPERATURE", "0.0"))
QWEN_TOP_P = float(os.getenv("QWEN_TOP_P", "0.8"))
QWEN_TOP_K = int(os.getenv("QWEN_TOP_K", "40"))
QWEN_PRESENCE_PENALTY = float(os.getenv("QWEN_PRESENCE_PENALTY", "0.0"))
QWEN_N_KEEP = int(os.getenv("QWEN_N_KEEP", "256"))
QWEN_MAX_TOKENS = int(os.getenv("QWEN_MAX_TOKENS", "356"))
VAD_MIN_RMS = float(os.getenv("VAD_MIN_RMS", "0.0055"))
VAD_START_RATIO = float(os.getenv("VAD_START_RATIO", "2.2"))
VAD_CONTINUE_RATIO = float(os.getenv("VAD_CONTINUE_RATIO", "1.45"))
VAD_NOISE_ALPHA = float(os.getenv("VAD_NOISE_ALPHA", "0.97"))
VAD_HANGOVER_FRAMES = int(os.getenv("VAD_HANGOVER_FRAMES", "14"))
VAD_MAX_SILENCE_FRAMES = int(os.getenv("VAD_MAX_SILENCE_FRAMES", "40"))
VAD_PRE_ROLL_FRAMES = int(os.getenv("VAD_PRE_ROLL_FRAMES", "8"))
VAD_MAX_ZCR = float(os.getenv("VAD_MAX_ZCR", "0.35"))
VAD_NOISE_GATE_RATIO = float(os.getenv("VAD_NOISE_GATE_RATIO", "1.15"))
MIN_SPEECH_SAMPLES = int(os.getenv("MIN_SPEECH_SAMPLES", "10000"))   # ~0.62s at 16kHz
MAX_SPEECH_SAMPLES = int(os.getenv("MAX_SPEECH_SAMPLES", "480000"))  # ~30s at 16kHz
STT_COALESCE_WINDOW_SEC = float(os.getenv("STT_COALESCE_WINDOW_SEC", "0.8"))
STT_MIN_REQUEST_INTERVAL_SEC = float(os.getenv("STT_MIN_REQUEST_INTERVAL_SEC", "1.1"))
STT_DUP_SIMILARITY = float(os.getenv("STT_DUP_SIMILARITY", "0.92"))
STT_DUP_WINDOW_SEC = float(os.getenv("STT_DUP_WINDOW_SEC", "8.0"))

ALLOWED_KEYS = {
    "name", "age", "gender", "caste_category", "ration_card_type", "income", "occupation",
    "housing_type", "location", "chief_complaint", "symptoms", "medical_history", "family_history",
    "allergies", "medications", "tentative_doctor_diagnosis", "initial_llm_diagnosis",
    "vitals.temperature", "vitals.blood_pressure", "vitals.pulse", "vitals.spo2"
}

app = FastAPI(title="RuralMedAI ML Node")


def _frame_rms(frame: np.ndarray) -> float:
    if frame.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(frame * frame)))


def _frame_zcr(frame: np.ndarray) -> float:
    if frame.size < 2:
        return 0.0
    signs = np.signbit(frame)
    return float(np.mean(signs[1:] != signs[:-1]))


def _preprocess_for_vad(frame: np.ndarray, noise_floor_rms: float) -> np.ndarray:
    # Remove DC offset + soft noise gate to reduce low-energy background noise.
    if frame.size == 0:
        return frame
    centered = frame - float(np.mean(frame))
    rms = _frame_rms(centered)
    threshold = max(VAD_MIN_RMS * 0.5, noise_floor_rms * VAD_NOISE_GATE_RATIO)
    if rms <= threshold:
        return centered * 0.2
    return centered


def _extract_first_json_object(text: str) -> dict:
    """Extract and parse the first balanced JSON object from model text."""
    if not text:
        return {}

    # Remove common markdown wrappers if present
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    start = cleaned.find("{")
    if start == -1:
        return {}

    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(cleaned[start:], start=start):
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = cleaned[start:i + 1]
                return json.loads(candidate)

    return {}


def _sanitize_sparse_updates(data: dict) -> dict:
    """Keep only allowed keys with concrete values; flatten nested vitals."""
    if not isinstance(data, dict):
        return {}

    normalized = {}
    for k, v in data.items():
        if k == "vitals" and isinstance(v, dict):
            for vk, vv in v.items():
                dot_key = f"vitals.{vk}"
                if dot_key in ALLOWED_KEYS:
                    normalized[dot_key] = vv
            continue
        if k in ALLOWED_KEYS:
            normalized[k] = v

    sparse = {}
    reject_literals = {
        "null", "none", "n/a", "na", "unknown", "not mentioned", "not provided",
        "not specified", "unspecified", "nil", "undefined", "{}", "[]", "-"
    }

    for k, v in normalized.items():
        if v is None:
            continue

        if isinstance(v, str):
            v = v.strip()
            if not v or v.lower() in reject_literals:
                continue

        elif isinstance(v, list):
            cleaned = []
            for item in v:
                item_s = str(item).strip()
                if item_s and item_s.lower() not in reject_literals:
                    cleaned.append(item_s)
            if not cleaned:
                continue
            v = ", ".join(dict.fromkeys(cleaned))

        elif isinstance(v, dict):
            # Non-vitals dicts are not part of the schema.
            continue

        sparse[k] = v

    return sparse

# ── Qwen3.5 Extraction Prompt Setup ───────────────────────────────────────────
QWEN_SYSTEM = (
    "You are a strict sparse JSON extractor for medical intake. "
    "Return a single minified JSON object using ONLY keys explicitly present in New Transcript. "
    "Allowed keys: name,age,gender,caste_category,ration_card_type,income,occupation,housing_type,location,"
    "chief_complaint,symptoms,medical_history,family_history,allergies,medications,"
    "tentative_doctor_diagnosis,initial_llm_diagnosis,vitals.temperature,vitals.blood_pressure,"
    "vitals.pulse,vitals.spo2. "
    "Omit any key not present or uncertain. Never output null, empty strings, placeholders, explanations, markdown, or extra text. "
    "If no new fields are found, output {}. "
    "Use Previous Extracted Data only to avoid repeating existing values. "
    "Gender must be one of: male,female,other."
)

async def run_qwen_extraction(transcript: str, existing_context: dict) -> dict:
    if not transcript.strip():
        return {}
        
    context_str = json.dumps(existing_context, ensure_ascii=True, separators=(",", ":"), sort_keys=True) if existing_context else "{}"
    
    # We bypass chat completions and use raw complete to inject the `{` start, bypassing <think> latencies entirely
    prompt = f"<|im_start|>system\n{QWEN_SYSTEM}<|im_end|>\n<|im_start|>user\nPreviously Extracted Data:\n{context_str}\n\nNew Transcript to Process:\n{transcript.strip()}<|im_end|>\n<|im_start|>assistant\n{{"
    
    payload = {
        "prompt": prompt,
        "temperature": QWEN_TEMPERATURE,
        "top_p": QWEN_TOP_P,
        "top_k": QWEN_TOP_K,
        "presence_penalty": QWEN_PRESENCE_PENALTY,
        "cache_prompt": True,
        "n_keep": QWEN_N_KEEP,
        "n_predict": QWEN_MAX_TOKENS,
        "stop": ["<|im_end|>", "\n<|im_start|>"]
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as http:
            resp = await http.post(LLAMA_URL, json=payload)
            resp.raise_for_status()
            raw = resp.json()
            
            content = raw.get("content", "").strip()
            content = "{" + content  # Since we pre-filled the {, we append it back to the chunk string
            
            logger.info(f"Qwen raw output: {content}")

            data = _extract_first_json_object(content)
            data = _sanitize_sparse_updates(data)
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


def _normalize_transcript(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"[^a-z0-9\s']", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _is_low_signal_transcript(normalized: str) -> bool:
    if not normalized:
        return True
    tokens = normalized.split()
    if len(tokens) <= 1:
        return True
    if len(tokens) >= 4:
        unique_ratio = len(set(tokens)) / len(tokens)
        if unique_ratio < 0.45:
            return True
    max_run = 1
    run = 1
    for i in range(1, len(tokens)):
        if tokens[i] == tokens[i - 1]:
            run += 1
            if run > max_run:
                max_run = run
        else:
            run = 1
    if max_run >= 3:
        return True
    weak_tokens = {"yeah", "yes", "no", "you", "uh", "um", "hmm", "okay", "ok", "right"}
    if len(tokens) <= 3 and all(tok in weak_tokens for tok in tokens):
        return True
    return False


def _is_duplicate_transcript(normalized: str, last_norm: str, last_ts: float, now_ts: float) -> bool:
    if not last_norm:
        return False
    if (now_ts - last_ts) > STT_DUP_WINDOW_SEC:
        return False
    if normalized == last_norm:
        return True
    sim = SequenceMatcher(a=normalized, b=last_norm).ratio()
    return sim >= STT_DUP_SIMILARITY


# ── WebSocket Endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/process-audio")
async def process_audio_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("[ML Node] Connection accepted")
    loop = asyncio.get_event_loop()
    ws_active = True

    speech_active = False
    silence_frames = 0
    speech_chunks: list[np.ndarray] = []
    speech_samples = 0
    pre_roll: deque[np.ndarray] = deque(maxlen=max(0, VAD_PRE_ROLL_FRAMES))
    noise_floor_rms = VAD_MIN_RMS
    
    # We maintain the semantic state in the ML node to pass as context
    extracted_state = {}
    full_transcript = ""

    audio_queue = asyncio.Queue(maxsize=16)

    async def receiver():
        nonlocal speech_active, silence_frames, speech_chunks, speech_samples, noise_floor_rms
        while True:
            try:
                data = await websocket.receive_json()
                if "audio" in data:
                    pcm_bytes = base64.b64decode(data["audio"])
                    chunk_i16 = np.frombuffer(pcm_bytes, dtype=np.int16)
                    raw_chunk = chunk_i16.astype(np.float32) / 32768.0

                    # Always keep a short pre-roll so the start of speech is not clipped.
                    pre_roll.append(raw_chunk)

                    vad_chunk = _preprocess_for_vad(raw_chunk, noise_floor_rms)
                    frame_rms = _frame_rms(vad_chunk)
                    frame_zcr = _frame_zcr(vad_chunk)

                    start_threshold = max(VAD_MIN_RMS, noise_floor_rms * VAD_START_RATIO)
                    continue_threshold = max(VAD_MIN_RMS * 0.8, noise_floor_rms * VAD_CONTINUE_RATIO)

                    is_speech_start = frame_rms >= start_threshold and frame_zcr <= VAD_MAX_ZCR
                    is_speech_continue = frame_rms >= continue_threshold and frame_zcr <= VAD_MAX_ZCR

                    if not speech_active:
                        # Learn noise floor only while idle.
                        noise_floor_rms = (VAD_NOISE_ALPHA * noise_floor_rms) + ((1.0 - VAD_NOISE_ALPHA) * frame_rms)

                        if not is_speech_start:
                            continue

                        speech_active = True
                        silence_frames = 0
                        speech_chunks = list(pre_roll)
                        speech_samples = sum(len(x) for x in speech_chunks)
                        pre_roll.clear()
                        logger.info(
                            "[VAD] Speech start: rms=%.4f start_thr=%.4f noise_floor=%.4f",
                            frame_rms,
                            start_threshold,
                            noise_floor_rms,
                        )
                        continue

                    speech_chunks.append(raw_chunk)
                    speech_samples += len(raw_chunk)

                    if is_speech_continue:
                        silence_frames = 0
                    else:
                        silence_frames += 1

                    should_flush = (
                        (silence_frames >= VAD_HANGOVER_FRAMES and speech_samples >= MIN_SPEECH_SAMPLES)
                        or speech_samples >= MAX_SPEECH_SAMPLES
                        or silence_frames >= VAD_MAX_SILENCE_FRAMES
                    )

                    if not should_flush:
                        continue

                    if speech_chunks:
                        duration_sec = speech_samples / SAMPLE_RATE
                        min_flush_samples = max(2000, MIN_SPEECH_SAMPLES // 4)
                        if speech_samples >= min_flush_samples:
                            to_process = np.concatenate(speech_chunks)
                            await audio_queue.put(to_process)
                            logger.info(
                                "[VAD] Speech end: duration=%.2fs silence_frames=%d",
                                duration_sec,
                                silence_frames,
                            )
                        else:
                            logger.info(
                                "[VAD] Dropped tiny chunk: duration=%.2fs silence_frames=%d",
                                duration_sec,
                                silence_frames,
                            )

                    speech_active = False
                    silence_frames = 0
                    speech_chunks = []
                    speech_samples = 0
            except WebSocketDisconnect:
                ws_active = False
                disconnect_min_samples = max(2000, MIN_SPEECH_SAMPLES // 2)
                if speech_active and speech_samples >= disconnect_min_samples and speech_chunks:
                    await audio_queue.put(np.concatenate(speech_chunks))
                await audio_queue.put(None)
                break
            except Exception as e:
                logger.error(f"[Receiver] Error: {e}")

    llm_queue: asyncio.Queue = asyncio.Queue()

    async def stt_processor():
        nonlocal full_transcript
        pending_audio = np.array([], dtype=np.float32)
        last_stt_request_ts = 0.0
        last_transcript_norm = ""
        last_transcript_ts = 0.0
        while True:
            try:
                saw_termination = False
                to_process = await audio_queue.get()
                if to_process is None:
                    if pending_audio.size > 0:
                        to_process = pending_audio.copy()
                        pending_audio = np.array([], dtype=np.float32)
                        saw_termination = True
                    else:
                        await llm_queue.put(None)
                        break

                if pending_audio.size > 0:
                    to_process = np.concatenate((pending_audio, to_process))
                    pending_audio = np.array([], dtype=np.float32)

                # Coalesce nearby VAD chunks into a single STT request.
                deadline = loop.time() + STT_COALESCE_WINDOW_SEC
                while loop.time() < deadline and len(to_process) < MAX_SPEECH_SAMPLES:
                    timeout = max(0.0, deadline - loop.time())
                    if timeout == 0:
                        break
                    try:
                        next_audio = await asyncio.wait_for(audio_queue.get(), timeout=timeout)
                    except asyncio.TimeoutError:
                        break

                    if next_audio is None:
                        saw_termination = True
                        break
                    to_process = np.concatenate((to_process, next_audio))

                # Avoid noisy micro-transcriptions; carry forward until enough speech accumulates.
                if len(to_process) < MIN_SPEECH_SAMPLES:
                    pending_audio = to_process
                    if saw_termination:
                        await llm_queue.put(None)
                        break
                    continue

                now = time.monotonic()
                sleep_for = STT_MIN_REQUEST_INTERVAL_SEC - (now - last_stt_request_ts)
                if sleep_for > 0:
                    await asyncio.sleep(sleep_for)

                # 1. Groq STT
                last_stt_request_ts = time.monotonic()
                transcript = await loop.run_in_executor(None, transcribe_groq_sync, to_process)

                if not transcript:
                    logger.info("[STT] Empty transcript, skipped")
                    if saw_termination:
                        await llm_queue.put(None)
                        break
                    continue

                clean = _normalize_transcript(transcript)
                if clean in FILLER_ONLY:
                    logger.info(f"[STT] Filler ignored: {transcript}")
                    if saw_termination:
                        await llm_queue.put(None)
                        break
                    continue
                if _is_low_signal_transcript(clean):
                    logger.info(f"[STT] Low-signal ignored: {transcript}")
                    if saw_termination:
                        await llm_queue.put(None)
                        break
                    continue

                now = time.monotonic()
                if _is_duplicate_transcript(clean, last_transcript_norm, last_transcript_ts, now):
                    logger.info(f"[STT] Duplicate ignored: {transcript}")
                    if saw_termination:
                        await llm_queue.put(None)
                        break
                    continue

                last_transcript_norm = clean
                last_transcript_ts = now
                full_transcript += transcript + " "
                logger.info(f"[STT] {transcript}")

                # Send transcript to LLM processor
                await llm_queue.put(transcript)
                if saw_termination:
                    await llm_queue.put(None)
                    break

            except Exception as e:
                logger.error(f"[stt_processor] Error: {e}")

    async def llm_processor():
        nonlocal extracted_state, ws_active
        MAX_BATCH_TRANSCRIPTS = 3
        while True:
            try:
                transcript = await llm_queue.get()
                if transcript is None:
                    break

                batch_items = [transcript]
                # Batch processing: drain the queue to handle Qwen inference backpressure
                while not llm_queue.empty() and len(batch_items) < MAX_BATCH_TRANSCRIPTS:
                    next_transcript = llm_queue.get_nowait()
                    if next_transcript is None:
                        # Put it back since it's the termination signal
                        llm_queue.put_nowait(next_transcript)
                        break
                    batch_items.append(next_transcript)

                transcript = " ".join(batch_items)
                logger.info(f"[LLM] Processing {len(batch_items)} transcript chunk(s)")

                # 2. Qwen3.5 2B Extraction
                new_data = await run_qwen_extraction(transcript, extracted_state)
                
                if new_data:
                    for field, value in new_data.items():
                        if not value: continue
                        
                        changed = False
                        # Merge lists
                        if field in ["symptoms", "medications", "allergies", "medical_history", "family_history"]:
                            existing = extracted_state.get(field, "")
                            existing_list = [x.strip() for x in existing.split(',') if x.strip()] if existing else []
                            new_list = [x.strip() for x in str(value).split(',') if x.strip()]
                            combined = list(dict.fromkeys(existing_list + new_list))
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
                            logger.info(f"[LLM] Emitting update: {field} -> {extracted_state[field]}")
                            if ws_active:
                                try:
                                    await websocket.send_json({
                                        "type": "update",
                                        "field": field,
                                        "value": extracted_state[field]
                                    })
                                except Exception:
                                    ws_active = False
                                    logger.info("[LLM] WebSocket closed while emitting update; stopping sends")
                else:
                    logger.info("[LLM] No structured updates extracted from current chunk")
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





