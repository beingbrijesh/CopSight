"""
UFDR AI Service - FastAPI application.
Handles RAG pipeline, embeddings, and natural language queries.
"""

import sys
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.routers import analysis, embeddings, indexing, query
from app.services.database import db_manager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting UFDR AI Service...")
    await db_manager.connect()
    logger.info("AI Service ready")
    yield
    logger.info("Shutting down AI Service...")
    await db_manager.disconnect()
    logger.info("AI Service stopped")


app = FastAPI(
    title="UFDR AI Service",
    description="AI-powered query and analysis service for UFDR system",
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


@app.get("/")
async def root():
    return {
        "service": "UFDR AI Service",
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
