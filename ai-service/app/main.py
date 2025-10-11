"""
UFDR AI Service - FastAPI Application
Handles RAG pipeline, embeddings, and natural language queries
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import sys

from app.config import settings
from app.routers import query, embeddings, analysis
from app.services.database import DatabaseManager

# Configure logger
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/ai_service_{time}.log",
    rotation="500 MB",
    retention="10 days",
    level="DEBUG"
)

# Initialize database manager
db_manager = DatabaseManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("🚀 Starting UFDR AI Service...")
    await db_manager.connect()
    logger.info("✅ AI Service ready")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down AI Service...")
    await db_manager.disconnect()
    logger.info("✅ AI Service stopped")


# Create FastAPI app
app = FastAPI(
    title="UFDR AI Service",
    description="AI-powered query and analysis service for UFDR system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(query.router, prefix="/api/query", tags=["Query"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "UFDR AI Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = await db_manager.check_health()
    
    return {
        "status": "healthy",
        "databases": db_status,
        "ollama": settings.OLLAMA_HOST,
        "models": {
            "embedding": settings.EMBEDDING_MODEL,
            "llm": settings.LLM_MODEL
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
