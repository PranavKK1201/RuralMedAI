# backend/app/services/gemini_service.py
import os
import json
import asyncio
import base64
from dotenv import load_dotenv
from google import genai
from google.genai import types
from fastapi import WebSocket
from app.services.prompt_eng import SYSTEM_INSTRUCTION
from app.services.scheme_service import SchemeEligibilityEngine

load_dotenv()

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})

# Tool Definitions
update_patient_data = {
    "name": "update_patient_data",
    "description": "Update patient medical data fields in the realtime form.",
    "behavior": "NON_BLOCKING",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "field": {
                "type": "STRING",
                "description": "The field to update (e.g., name, age, gender, caste_category, ration_card_type, income_bracket, occupation, housing_type, chief_complaint, symptoms, medical_history, family_history, allergies, medications, tentative_doctor_diagnosis, initial_llm_diagnosis, vitals.temperature, vitals.blood_pressure, vitals.pulse, vitals.spo2)"
            },
            "value": {
                "type": "STRING", 
                "description": "The new value for the field."
            }
        },
        "required": ["field", "value"]
    }
}

tools = [{"function_declarations": [update_patient_data]}]

class GeminiService:
    def __init__(self):
        self.session = None
        self.current_patient_data = {}

    async def handle_session(self, websocket: WebSocket):
        """
        Manages the bidirectional stream:
        1. Browser Mic -> Backend -> Gemini
        2. Gemini -> Backend -> Browser UI
        """
        
        # Connection configuration
        # Native Audio model REQUIRES response_modalities=["AUDIO"]
        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": SYSTEM_INSTRUCTION,
            "tools": tools,
            "thinking_config": types.ThinkingConfig(
                thinking_budget=0,
            ),
            "output_audio_transcription": {} 
        }
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            self.session = session
            print("--- Connected to Gemini Live API ---")
            
            # Start parallel tasks
            receive_task = asyncio.create_task(self._receive_from_gemini(websocket))
            send_task = asyncio.create_task(self._send_to_gemini(websocket))

            try:
                await asyncio.gather(receive_task, send_task)
            except Exception as e:
                print(f"Session error: {e}")
            finally:
                if not receive_task.done(): receive_task.cancel()
                if not send_task.done(): send_task.cancel()
                print("--- Session Closed ---")

    async def _send_to_gemini(self, websocket: WebSocket):
        """Receives audio from browser and pushes to Gemini"""
        try:
            while True:
                message = await websocket.receive_text()
                data = json.loads(message)

                if "realtimeInput" in data:
                    media_chunk = data["realtimeInput"]["mediaChunks"][0]
                    pcm_b64 = media_chunk["data"]
                    mime_type = media_chunk["mimeType"] # "audio/pcm"
                    
                    # Decode base64 to bytes
                    pcm_bytes = base64.b64decode(pcm_b64)
                    
                    # Use specific mime type with rate if generic
                    if mime_type == "audio/pcm":
                        mime_type = "audio/pcm;rate=16000"
                        
                    # print(f"Sending {len(pcm_bytes)} bytes of audio to Gemini...") # Verbose
                    await self.session.send_realtime_input(
                        audio={"data": pcm_bytes, "mime_type": mime_type}
                    )
                    
        except Exception as e:
            print(f"Error sending to Gemini: {e}")

    async def _receive_from_gemini(self, websocket: WebSocket):
        """Receives text/tools from Gemini and pushes to browser"""
        try:
            while True:
                async for response in self.session.receive():
                    # print("Received response from Gemini") # Verbose
                    server_content = response.server_content
                    
                    # Handle Text/Transcription
                    if server_content:
                        # Direct model text
                        if server_content.model_turn:
                             for part in server_content.model_turn.parts:
                                 if part.text:
                                     print(f"Gemini Text: {part.text}")
                                     await websocket.send_json({
                                        "type": "content",
                                        "text": part.text
                                    })
                        
                        # Output Transcription
                        if hasattr(server_content, 'output_transcription') and server_content.output_transcription:
                             transcription = server_content.output_transcription.text
                             print(f"Gemini Transcript: {transcription}")
                             await websocket.send_json({
                                "type": "content",
                                "text": transcription
                            })

                    # Handle Function Calls
                    if response.tool_call:
                        function_responses = []
                        for fc in response.tool_call.function_calls:
                            if fc.name == "update_patient_data":
                                args = fc.args
                                field = args.get("field")
                                value = args.get("value")
                                
                                # Parse JSON strings if necessary (Gemini sometimes sends lists as strings)
                                if isinstance(value, str):
                                    value = value.strip()
                                    if value.startswith("[") or value.startswith("{"):
                                        try:
                                            value = json.loads(value)
                                        except json.JSONDecodeError:
                                            pass
                                    elif field in ["symptoms", "medications", "allergies", "medical_history", "family_history"]:
                                        # Handle comma-separated list strings
                                        value = [item.strip() for item in value.split(",")]

                                print(f"Tool Call: update_patient_data({field}, {value})")

                                # Update internal state to calculate eligibility
                                self.current_patient_data[field] = value

                                # Send update to frontend immediately
                                await websocket.send_json({
                                    "type": "update",
                                    "field": field,
                                    "value": value
                                })

                                # If an eligibility field changed, recalculate
                                if field in ['ration_card_type', 'income_bracket', 'occupation', 'age', 'caste_category', 'housing_type']:
                                    report = SchemeEligibilityEngine.check_pmjay_rural(self.current_patient_data)
                                    await websocket.send_json({
                                        "type": "update",
                                        "field": "scheme_eligibility",
                                        "value": report
                                    })
                                
                                # Send tool execution results back to Gemini
                                function_responses.append(types.FunctionResponse(
                                    id=fc.id,
                                    name=fc.name,
                                    response={"result": "ok", "scheduling": "SILENT"},
                                ))

                        # Send tool execution results back to model
                        if function_responses:
                            tool_response = types.LiveClientToolResponse(function_responses=function_responses)
                            await self.session.send(input=tool_response)
                                        
        except Exception as e:
            print(f"Error receiving from Gemini: {e}")
