import os
import asyncio
import logging
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.worker import poll_analysis_jobs
from api.routers import cases, evidence, assessments, reports
from infrastructure.persistence.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Helper to dynamically extract host and port from microservice environment variables
def get_host_port(env_var: str, default_url: str):
    url = os.getenv(env_var, default_url)
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "host.docker.internal"
        port = parsed.port or (8001 if "analyze" in default_url else 8002)
        return host, port
    except Exception:
        return "host.docker.internal", 8001

# Non-blocking raw TCP socket check to see if a port is actively open
async def is_service_reachable(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), 
            timeout=timeout
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Veritas Nexus API starting up...")
    
    # 1. Fire up the background worker task and save a reference to app state
    worker_task = asyncio.create_task(poll_analysis_jobs())
    app.state.worker_task = worker_task
    
    yield
    
    logger.info("Veritas Nexus API shutting down...")
    
    # 2. Safely cancel and clean up the background task during shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
        
    await engine.dispose()

app = FastAPI(
    title="Veritas Nexus",
    description="Unified Digital Media Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Domain routers
app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
app.include_router(evidence.router)
app.include_router(assessments.router, prefix="/api/v1/assessments", tags=["Assessments"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])


@app.get("/api/v1/health", tags=["System"])
async def health_check(request: Request):
    """
    Provides dynamic telemetry to the Veritas Nexus frontend by tracking the 
    internal asyncio event loop worker status and verifying remote engine ports.
    """
    # 1. Audit the internal background loop task status
    worker_task = getattr(request.app.state, "worker_task", None)
    worker_running = worker_task is not None and not worker_task.done()
    
    # 2. Resolve network addresses for external forensic microservices
    vit_host, vit_port = get_host_port("VIT_CORE_URL", "http://host.docker.internal:8001/api/v1/analyze")
    c2pa_host, c2pa_port = get_host_port("C2PA_URL", "http://host.docker.internal:8002/api/v1/verify")
    
    # 3. Perform network reachability checks concurrently if the internal loop is alive
    if worker_running:
        vit_online, c2pa_online = await asyncio.gather(
            is_service_reachable(vit_host, vit_port),
            is_service_reachable(c2pa_host, c2pa_port)
        )
    else:
        # Force offline metrics if our local orchestration loop has crashed
        vit_online, c2pa_online = False, False

    # 4. Synthesize system operational flags
    if not worker_running:
        system_status = "offline"
    elif not vit_online or not c2pa_online:
        system_status = "degraded"
    else:
        system_status = "operational"

    return {
        "status": system_status,
        "platform": "Veritas Nexus",
        "internal_worker": "RUNNING" if worker_running else "CRASHED_OR_STOPPED",
        "vit_status": "ONLINE" if vit_online else "OFFLINE",
        "c2pa_status": "ONLINE" if c2pa_online else "OFFLINE"
    }
