# backend/app/services/gemini_service.py
import os
import json
import asyncio
from dotenv import load_dotenv
from google import genai
from fastapi import WebSocket
from app.services.prompt_eng import SYSTEM_INSTRUCTION  # <--- IMPORT THIS

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "models/gemini-2.0-flash-live-001"

client = genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1beta"})

class GeminiService:
    def __init__(self):
        self.session = None

    async def handle_session(self, websocket: WebSocket):
        """
        Manages the bidirectional stream:
        1. Browser Mic -> Backend -> Gemini
        2. Gemini -> Backend -> Browser UI
        """
        # Connection configuration
        # We inject the SYSTEM_INSTRUCTION here
        config = {
            "response_modalities": ["TEXT"],
            "system_instruction": SYSTEM_INSTRUCTION,
        }
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            self.session = session
            
            # Start parallel tasks: one for sending, one for receiving
            receive_task = asyncio.create_task(self._receive_from_gemini(websocket))
            send_task = asyncio.create_task(self._send_to_gemini(websocket))

            try:
                await asyncio.gather(receive_task, send_task)
            except Exception as e:
                print(f"Session error: {e}")
            finally:
                if not receive_task.done(): receive_task.cancel()
                if not send_task.done(): send_task.cancel()

    async def _send_to_gemini(self, websocket: WebSocket):
        """Receives audio from browser and pushes to Gemini"""
        try:
            while True:
                # Receive message from browser
                message = await websocket.receive_text()
                data = json.loads(message)

                # We expect the frontend to send base64 encoded audio
                if "realtimeInput" in data:
                    media_chunk = data["realtimeInput"]["mediaChunks"][0]
                    pcm_data = media_chunk["data"]
                    mime_type = media_chunk["mimeType"] # "audio/pcm"
                    
                    # Stream audio to Gemini
                    await self.session.send(input={"data": pcm_data, "mime_type": mime_type}, end_of_turn=False)
                    
        except Exception as e:
            print(f"Error sending to Gemini: {e}")

    async def _receive_from_gemini(self, websocket: WebSocket):
        """Receives text from Gemini and pushes to browser"""
        try:
            while True:
                async for response in self.session.receive():
                    text = response.text
                    if text:
                         # Send back to frontend to display
                        await websocket.send_json({
                            "type": "content",
                            "text": text
                        })
        except Exception as e:
            print(f"Error receiving from Gemini: {e}")
