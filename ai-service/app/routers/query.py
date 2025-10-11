"""
Query router - handles natural language queries
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from loguru import logger

from app.services.rag import rag_pipeline

router = APIRouter()


class QueryRequest(BaseModel):
    """Query request model"""
    case_id: int
    query: str
    user_id: int


class QueryResponse(BaseModel):
    """Query response model"""
    query_id: int
    query: str
    answer: str
    findings: list
    evidence: list
    total_results: int
    confidence: float
    query_components: Dict[str, Any]


@router.post("/execute", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    """
    Execute a natural language query against case data
    
    Example queries:
    - "Show me all chats with foreign numbers"
    - "Find communications mentioning 'payment' or 'transfer'"
    - "List all WhatsApp messages after September 1st"
    - "Who did the suspect communicate with most frequently?"
    """
    try:
        logger.info(f"Received query for case {request.case_id}: {request.query}")
        
        result = await rag_pipeline.execute_query(
            case_id=request.case_id,
            query=request.query,
            user_id=request.user_id
        )
        
        return QueryResponse(**result)
        
    except Exception as e:
        logger.error(f"Query execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{case_id}")
async def get_query_history(case_id: int, limit: int = 20):
    """Get query history for a case"""
    try:
        from app.services.database import db_manager
        
        async with db_manager.postgres.acquire() as conn:
            queries = await conn.fetch("""
                SELECT 
                    id, query_text, query_type, results_count,
                    created_at, user_id
                FROM case_queries
                WHERE case_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            """, case_id, limit)
            
            return {
                "case_id": case_id,
                "queries": [dict(q) for q in queries]
            }
            
    except Exception as e:
        logger.error(f"Failed to get query history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{query_id}")
async def get_query_result(query_id: int):
    """Get a specific query result"""
    try:
        from app.services.database import db_manager
        
        async with db_manager.postgres.acquire() as conn:
            query = await conn.fetchrow("""
                SELECT * FROM case_queries WHERE id = $1
            """, query_id)
            
            if not query:
                raise HTTPException(status_code=404, detail="Query not found")
            
            return dict(query)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get query: {e}")
        raise HTTPException(status_code=500, detail=str(e))
