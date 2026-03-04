# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging

# We will import the service later, for now we just structure the endpoint
import os
from app.services.gemini_service import GeminiService 
from app.services.local_ml_service import LocalMLService

from contextlib import asynccontextmanager
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.icd_coding_service import ICDCodingService
    from app.services.procedure_coding_service import ProcedureCodingService

    def _warmup():
        """Blocking warmup — runs in a worker thread, not the event loop."""
        logger.info("Warming up ICDCodingService …")
        ICDCodingService()
        logger.info("ICDCodingService ready.")
        logger.info("Warming up ProcedureCodingService …")
        ProcedureCodingService()
        logger.info("All clinical coding services ready.")

    # Run blocking CPU/IO work off the event loop
    await asyncio.to_thread(_warmup)
    yield

app = FastAPI(title="RuralMedAI Backend", lifespan=lifespan)

# Include API Routes
from app.api.routes import router as api_router
from app.api.ehr import router as ehr_router

app.include_router(api_router, prefix="/api")
app.include_router(ehr_router, prefix="/api/ehr")

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
    2. Instantiates the active AI Service (Gemini or Local ML Node).
    3. Loops to receive audio and sends back JSON tool calls.
    """
    await websocket.accept()
    logger.info("New WebSocket connection accepted")

    use_local_ml = os.getenv("USE_LOCAL_ML", "false").lower() == "true"

    try:
        if use_local_ml:
            logger.info("Routing traffic to LOCAL ML Stack (Groq + Qwen) via bridge")
            service = LocalMLService()
        else:
            logger.info("Routing traffic to Google GEMINI Live API")
            service = GeminiService()
            
        await service.handle_session(websocket)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in websocket session: {e}")
        try:
            await websocket.close()
        except:
            pass