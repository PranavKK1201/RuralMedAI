# backend/app/services/local_ml_service.py
import json
import asyncio
import os
from fastapi import WebSocket
import websockets

class LocalMLService:
    def __init__(self, ml_node_url: str | None = None):
        self.ml_node_url = ml_node_url or os.getenv("ML_NODE_URL", "ws://127.0.0.1:8002/ws/process-audio")
        self.ml_websocket = None
    
    async def handle_session(self, browser_ws: WebSocket):
        """
        Manages the bidirectional stream:
        1. Browser Mic -> Backend -> ML Node
        2. ML Node -> Backend -> Browser UI
        """
        try:
            # Connect to the local ML Node and disable keepalive timeouts
            # because heavy ML inference might block the event loop or take longer than default pings allow
            async with websockets.connect(self.ml_node_url, ping_interval=None, ping_timeout=None) as ml_ws:
                self.ml_websocket = ml_ws
                print(f"--- Connected to Local ML Node ({self.ml_node_url}) ---")
                
                # Start parallel forwarding tasks
                receive_task = asyncio.create_task(self._receive_from_ml(browser_ws))
                send_task = asyncio.create_task(self._send_to_ml(browser_ws))

                await asyncio.gather(receive_task, send_task)
                
        except websockets.exceptions.ConnectionClosed:
            print("--- ML Node Connection Closed ---")
        except Exception as e:
            print(f"ML Session bridge error: {e}")
        finally:
            print("--- ML Bridge Session Ended ---")

    async def _send_to_ml(self, browser_ws: WebSocket):
        """Receives audio from browser and pushes to ML Node."""
        try:
            while True:
                message = await browser_ws.receive_text()
                data = json.loads(message)

                if "realtimeInput" in data:
                    media_chunk = data["realtimeInput"]["mediaChunks"][0]
                    pcm_b64 = media_chunk["data"]
                    
                    # We just forward the base64 audio exactly as it arrived
                    if self.ml_websocket:
                        await self.ml_websocket.send(json.dumps({
                            "audio": pcm_b64
                        }))
        except Exception as e:
            print(f"Error forwarding audio to ML node: {e}")

    async def _receive_from_ml(self, browser_ws: WebSocket):
        """Receives structured fields from ML Node and pushes to browser."""
        try:
            while True:
                if self.ml_websocket:
                    response_text = await self.ml_websocket.recv()
                    data = json.loads(response_text)
                    
                    # The ML Node sends {"type": "update", "field": "...", "value": "..."}
                    # We just blind-forward this to the UI which expects exactly this format.
                    if data.get("type") == "update":
                        print(f"Local ML Node Tool Call: update_patient_data({data.get('field')}, {data.get('value')})")
                        await browser_ws.send_json(data)
                        
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"Error receiving from ML node: {e}")
