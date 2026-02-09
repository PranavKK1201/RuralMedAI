# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging

# We will import the service later, for now we just structure the endpoint
from app.services.gemini_service import GeminiService 

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RuralMedAI Backend")

# Include API Routes
from app.api.routes import router as api_router
app.include_router(api_router, prefix="/api")

# CORS Configuration
# Allow requests from your frontend (usually localhost:3000 during dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "RuralMedAI Backend is running"}

@app.websocket("/ws/live-consultation")
async def websocket_endpoint(websocket: WebSocket):
    """
    Handles the real-time consultation stream.
    1. Accepts WebSocket connection.
    2. Instantiates the AI Service (Gemini).
    3. Loops to receive audio and send back JSON.
    """
    await websocket.accept()
    logger.info("New WebSocket connection accepted")

    try:
        service = GeminiService()
        await service.handle_session(websocket)

        
        # For now, just a simple echo loop to test the connection
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received: {data}")
            await websocket.send_json({"status": "received", "content": data})
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket session: {e}")
        try:
            await websocket.close()
        except:
            pass