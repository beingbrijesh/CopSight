"""
Ingestion API Router - Async event-driven endpoints for Forensixd
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Dict, Any, List
from loguru import logger
import arq
from arq.connections import RedisSettings
from app.config import settings

router = APIRouter()

_redis_pool = None

async def get_redis_pool():
    global _redis_pool
    if _redis_pool is None:
        if settings.REDIS_URL:
            rs = RedisSettings.from_dsn(settings.REDIS_URL)
            rs.conn_timeout = 15
        else:
            import urllib.parse
            encoded_redis_pass = urllib.parse.quote_plus(settings.REDIS_PASSWORD) if settings.REDIS_PASSWORD else None
            is_ssl = "upstash" in settings.REDIS_HOST.lower()
            rs = RedisSettings(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                ssl=is_ssl,
                conn_timeout=15
            )
        _redis_pool = await arq.create_pool(rs)
    return _redis_pool

class TextIngestRequest(BaseModel):
    case_id: int
    source_type: str
    content: str
    metadata: Dict[str, Any] = {}
    entities: List[Dict[str, Any]] = []

class TextIngestBatchRequest(BaseModel):
    case_id: int
    records: List[Dict[str, Any]]


@router.post("/text")
async def ingest_text(request: TextIngestRequest):
    """
    Ingests extracted text (messages, contacts, logs).
    Drops task into background worker via ARQ and returns immediately.
    """
    logger.info(f"Received text ingestion request for case {request.case_id}")
    pool = await get_redis_pool()
    await pool.enqueue_job(
        "process_ingestion_payload", 
        request.case_id, 
        "text", 
        {
            "content": request.content, 
            "source_type": request.source_type, 
            "metadata": request.metadata,
            "entities": request.entities
        }
    )
    return {"status": "accepted", "message": "Text payload queued for processing in ARQ."}

@router.post("/text/batch")
async def ingest_text_batch(request: TextIngestBatchRequest):
    """
    Ingests a batch of extracted text records efficiently.
    Drops a single task into background worker via ARQ.
    """
    logger.info(f"Received text batch ingestion request for case {request.case_id} with {len(request.records)} records")
    pool = await get_redis_pool()
    await pool.enqueue_job(
        "process_ingestion_batch", 
        request.case_id, 
        request.records
    )
    return {"status": "accepted", "message": f"Batch of {len(request.records)} records queued for processing."}

@router.post("/media")
async def ingest_media(
    case_id: int = Form(...),
    file: UploadFile = File(...)
):
    """
    Ingests binary media (images, videos).
    """
    logger.info(f"Received media ingestion request for case {case_id}, file: {file.filename}")
    
    file_bytes = await file.read()
    pool = await get_redis_pool()
    await pool.enqueue_job(
        "process_ingestion_payload",
        case_id,
        "media",
        {"filename": file.filename, "file_bytes": file_bytes}
    )
    return {"status": "accepted", "message": f"Media {file.filename} queued for vision processing in ARQ."}
