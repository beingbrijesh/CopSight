"""
Embeddings router - handles embedding generation
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from loguru import logger

from app.services.embeddings import embedding_service

router = APIRouter()


class EmbeddingRequest(BaseModel):
    """Embedding request model"""
    texts: List[str]


class EmbeddingResponse(BaseModel):
    """Embedding response model"""
    embeddings: List[List[float]]
    model: str
    dimension: int


@router.post("/generate", response_model=EmbeddingResponse)
async def generate_embeddings(request: EmbeddingRequest):
    """Generate embeddings for given texts"""
    try:
        embeddings = await embedding_service.generate_embeddings(request.texts)
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model="nomic-embed-text",
            dimension=len(embeddings[0]) if embeddings else 0
        )
        
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test")
async def test_embeddings():
    """Test embedding service"""
    try:
        is_available = await embedding_service.test_connection()
        
        return {
            "available": is_available,
            "model": "nomic-embed-text",
            "status": "ready" if is_available else "unavailable"
        }
        
    except Exception as e:
        logger.error(f"Embedding test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
