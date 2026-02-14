"""
Indexing router - handles data indexing for RAG
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any
from loguru import logger

from app.services.rag import rag_pipeline
from app.services.database import db_manager

router = APIRouter()


class IndexRequest(BaseModel):
    """Index request model"""
    case_id: int
    data_sources: List[Dict[str, Any]]
    entities: List[Dict[str, Any]]


@router.post("/case/{case_id}")
async def index_case_data(case_id: int, request: IndexRequest, background_tasks: BackgroundTasks):
    """Index case data for RAG search"""
    try:
        logger.info(f"Indexing data for case {case_id}")

        # Add to background task to avoid blocking
        background_tasks.add_task(
            rag_pipeline.index_case_data,
            case_id,
            request.data_sources,
            request.entities
        )

        return {
            "success": True,
            "message": f"Indexing started for case {case_id}",
            "case_id": case_id,
            "indexed_count": 0  # Will be updated asynchronously
        }

    except Exception as e:
        logger.error(f"Indexing failed for case {case_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-embedding")
async def test_embedding():
    """Test embedding generation"""
    try:
        from app.services.embeddings import embedding_service
        from app.config import settings
        
        test_text = "Hello world test"
        embedding = await embedding_service.generate_embedding(test_text)
        
        return {
            "success": True,
            "embedding_length": len(embedding) if embedding else 0,
            "expected_length": settings.EMBEDDING_DIM,
            "model": settings.EMBEDDING_MODEL,
            "test_text": test_text
        }
    except Exception as e:
        from app.config import settings
        return {
            "success": False,
            "error": str(e),
            "expected_length": settings.EMBEDDING_DIM,
            "model": settings.EMBEDDING_MODEL
        }
