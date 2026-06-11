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
        
    logger.info("AI Service ready")
    yield
    logger.info("Shutting down AI Service...")
    
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
