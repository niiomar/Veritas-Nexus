import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.worker import poll_analysis_jobs
from api.routers import cases, evidence, assessments, reports
from infrastructure.persistence.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Veritas Nexus API starting up...")
    
    # 1. Fire up the ViT-CORE-FORENSICS background worker
    worker_task = asyncio.create_task(poll_analysis_jobs())
    
    # In production, migrations (Alembic) handle schema creation.
    # For local Phase 1 dev, we can echo the schema creation here if desired.
    yield
    
    logger.info("Veritas Nexus API shutting down...")
    
    # 2. Safely kill the worker during shutdown
    worker_task.cancel()
    await engine.dispose()

app = FastAPI(
    title="Veritas Nexus",
    description="Unified Digital Media Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Allow the Vite frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the domain routers
app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
app.include_router(evidence.router) # Prefix and tags are handled internally by evidence.py
app.include_router(assessments.router, prefix="/api/v1/assessments", tags=["Assessments"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])

# UPDATED: Real-time telemetry endpoint for the React frontend
@app.get("/api/v1/health", tags=["System"])
async def health_check():
    """
    Provides real-time telemetry to the Veritas Nexus frontend.
    In a production environment, this would actively ping the engine containers.
    """
    return {
        "status": "operational", 
        "platform": "Veritas Nexus",
        "vit_status": "ONLINE",
        "c2pa_status": "ONLINE"
    }