"""
CopSight AI AI Service - FastAPI application.
Handles RAG pipeline, embeddings, and natural language queries.
"""

import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'

import sys
import warnings
import subprocess
from contextlib import asynccontextmanager

warnings.filterwarnings(
    "ignore",
    message=".*google.generativeai.*",
    category=FutureWarning,
)
warnings.filterwarnings(
    "ignore",
    message=".*Changing updater from.*",
    category=UserWarning,
)
warnings.filterwarnings(
    "ignore",
    message=".*Device is changed from GPU to CPU.*",
    category=UserWarning,
)
warnings.filterwarnings(
    "ignore",
    message=".*Do not pass an `input_shape`.*",
    category=UserWarning,
)
warnings.filterwarnings(
    "ignore",
    message=".*Field.*has conflict with protected namespace.*",
    category=UserWarning,
)

import xgboost
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.routers import analysis, embeddings, indexing, query, ingestion
from app.services.database import db_manager

logger.remove()
logger.add(
    sys.stdout,
    format=(
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> - "
        "<level>{message}</level>"
    ),
    level="INFO",
)
logger.add(
    "logs/ai_service_{time}.log",
    rotation="500 MB",
    retention="10 days",
    level="DEBUG",
)


worker_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_process
    """Startup and shutdown events."""
    logger.info("Starting CopSight AI AI Service...")
    await db_manager.connect()
    
    # Start ARQ worker automatically
    try:
        logger.info("Starting ARQ background worker...")
        # Get the directory containing the 'app' module
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        worker_process = subprocess.Popen(
            [sys.executable, "-m", "arq", "app.worker.WorkerSettings"],
            cwd=base_dir
        )
    except Exception as e:
        logger.error(f"Failed to start ARQ worker: {e}")

    # ── Advanced Stealth Keep-Alive Ping System ──
    import asyncio
    import httpx
    import random
    import time

    USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
    ]

    async def _stealth_keepalive():
        """Advanced Stealth Ping to evade bot detection on Render & Qdrant"""
        last_qdrant_ping = 0
        
        while True:
            try:
                # 1. Jitter interval (9.5 to 14 minutes)
                sleep_seconds = random.uniform(570, 840)
                await asyncio.sleep(sleep_seconds)
                
                # 2. Spoof headers
                headers = {
                    "User-Agent": random.choice(USER_AGENTS),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Upgrade-Insecure-Requests": "1"
                }
                
                # 3. Ping Node.js Backend (Masked as root page visit instead of /health)
                async with httpx.AsyncClient(timeout=15, verify=False) as client:
                    resp = await client.get(f"{settings.BACKEND_URL}/", headers=headers)
                    if resp.status_code == 200:
                        logger.info(f"[STEALTH KEEPALIVE] ✅ Node.js Backend (Render) ping successful. Responded as expected.")
                    else:
                        logger.warning(f"[STEALTH KEEPALIVE] ⚠️ Node.js Backend returned {resp.status_code}")
                
                # 4. Ping Qdrant Cluster every ~24 hours (86400 seconds)
                current_time = time.time()
                if current_time - last_qdrant_ping > 86000:
                    logger.info("[STEALTH KEEPALIVE] Initiating daily Qdrant wake-up ping...")
                    if settings.QDRANT_URL and settings.QDRANT_API_KEY:
                        q_headers = headers.copy()
                        q_headers["api-key"] = settings.QDRANT_API_KEY
                        async with httpx.AsyncClient(timeout=15) as client:
                            # Fetch collections list - lightweight and standard
                            q_resp = await client.get(f"{settings.QDRANT_URL}/collections", headers=q_headers)
                            if q_resp.status_code == 200:
                                logger.info("[STEALTH KEEPALIVE] ✅ Qdrant Cloud ping successful.")
                                last_qdrant_ping = current_time
                            else:
                                logger.warning(f"[STEALTH KEEPALIVE] ⚠️ Qdrant Cloud returned {q_resp.status_code}")
                    else:
                        logger.info("[STEALTH KEEPALIVE] ⏭️ Skipping Qdrant ping (no credentials configured).")

            except Exception as e:
                logger.error(f"[STEALTH KEEPALIVE] ❌ Keep-Alive Ping Failed: {e}")

    health_task = asyncio.create_task(_stealth_keepalive())

    logger.info("AI Service ready")
    yield
    logger.info("Shutting down AI Service...")

    # Cancel health monitor
    health_task.cancel()
    
    if worker_process:
        logger.info("Terminating ARQ background worker...")
        worker_process.terminate()
        try:
            worker_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker_process.kill()
            
    await db_manager.disconnect()
    logger.info("AI Service stopped")


app = FastAPI(
    title="CopSight AI AI Service",
    description="AI-powered query and analysis service for CopSight AI system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router, prefix="/api/query", tags=["Query"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(indexing.router, prefix="/api/index", tags=["Indexing"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["Ingestion"])


@app.get("/")
async def root():
    return {
        "service": "CopSight AI AI Service",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    db_status = await db_manager.check_health()
    return {
        "status": "healthy",
        "databases": db_status,
        "ollama": settings.OLLAMA_HOST,
        "models": {
            "embedding": settings.EMBEDDING_MODEL,
            "llm": settings.LLM_MODEL,
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
    )
