import asyncio
import websockets
import json
import base64

# Configuration
URI = "ws://localhost:8000/ws/live-consultation"

async def test_connection():
    print(f"Connecting to {URI}...")
    try:
        async with websockets.connect(URI) as websocket:
            print("✅ Connected to WebSocket!")
            
            # 1. Send a dummy audio chunk (silence) to trigger the backend logic
            # Gemini expects specific JSON structure for Realtime API
            # This mimics what the frontend will send
            dummy_pcm = base64.b64encode(b'\x00' * 32000).decode('utf-8') # ~1 sec of silence
            
            payload = {
                "realtimeInput": {
                    "mediaChunks": [{
                        "mimeType": "audio/pcm",
                        "data": dummy_pcm
                    }]
                }
            }
            
            print("Sending dummy audio chunk...")
            await websocket.send(json.dumps(payload))
            
            # 2. Wait for response
            print("Waiting for response (Ctrl+C to stop)...")
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"📩 Received: {msg}")
            except asyncio.TimeoutError:
                print("⚠️ No response within 5s (This is expected if Gemini stays silent for silence)")
            except Exception as e:
                print(f"❌ Error receiving: {e}")
                
            print("Test complete. Connection operational.")
            
    except ConnectionRefusedError:
        print("❌ Connection Refused! Is the backend running?")
        print("Run: uvicorn app.main:app --reload --port 8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
