"""
Query router - handles natural language queries
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, AsyncGenerator
from loguru import logger
import json
import asyncio

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



class StreamQueryRequest(BaseModel):
    """Streaming query request model"""
    case_id: int
    query: str
    user_id: int


class RelationshipQueryRequest(BaseModel):
    """Relationship query to drive graph visualization"""
    case_id: int
    query: str
    user_id: int
    node_label: Optional[str] = None


async def _stream_rag_tokens(
    case_id: int,
    query: str,
    user_id: int
) -> AsyncGenerator[str, None]:
    """Generator that yields SSE-formatted chunks from the RAG pipeline.
    
    Stability design:
    - Immediately emits a 'thinking' status so the UI never stalls on a blank screen.
    - All exceptions are caught and streamed as an error event instead of crashing.
    - LLM timeouts do NOT kill the connection; they emit a graceful timeout event.
    """
    def _sse(data: dict) -> str:
        return "data: " + json.dumps(data) + "\n\n"

    try:
        # 1. Immediately signal thinking state
        yield _sse({'type': 'status', 'status': 'thinking', 'message': 'Searching & Analyzing Evidence...'})
        await asyncio.sleep(0)  # yield control to the event loop

        # 2. Run the full RAG pipeline (this is the slow Ollama call)
        try:
            result = await asyncio.wait_for(
                rag_pipeline.execute_query(
                    case_id=case_id,
                    query=query,
                    user_id=user_id
                ),
                timeout=120.0  # 2-minute hard cap for local LLM
            )
        except asyncio.TimeoutError:
            yield _sse({'type': 'error', 'message': 'AI analysis timed out after 2 minutes. The local LLM may be under heavy load. Please try again.'})
            yield "data: [DONE]\n\n"
            return

        # 3. Stream the answer token-by-token (word-by-word simulation for smooth UX)
        answer_text = result.get('answer', 'No analysis available.')
        words = answer_text.split(' ')

        yield _sse({'type': 'status', 'status': 'streaming', 'message': 'Generating analysis...'})
        await asyncio.sleep(0)

        for i, word in enumerate(words):
            chunk = word + (' ' if i < len(words) - 1 else '')
            yield _sse({'type': 'token', 'token': chunk})
            await asyncio.sleep(0.01)  # small delay for typewriter effect

        # 4. Finally stream metadata (evidence, findings, confidence, relationships)
        metadata = {
            'type': 'metadata',
            'evidence': result.get('evidence', [])[:10],  # cap for perf
            'findings': result.get('findings', []),
            'confidence': result.get('confidence', 0.0),
            'query_components': result.get('query_components', {}),
            'total_results': result.get('total_results', 0),
            'query_id': result.get('query_id', 0),
            'has_relationships': _detect_relationship_intent(result.get('query_components', {}))
        }
        yield _sse(metadata)
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"SSE stream error for case {case_id}: {e}")
        yield _sse({'type': 'error', 'message': 'An unexpected error occurred during analysis. Please try again.'})
        yield "data: [DONE]\n\n"


def _detect_relationship_intent(query_components: dict) -> bool:
    """Detect if the query has a relationship/connection intent for graph rendering."""
    if not query_components:
        return False
    intent = query_components.get('intent', '').lower()
    semantic = query_components.get('semantic_query', '').lower()
    relationship_keywords = ['connect', 'relationship', 'link', 'associat', 'network', 'communicat', 'between']
    return any(kw in intent or kw in semantic for kw in relationship_keywords)


@router.post("/stream")
async def stream_query(request: StreamQueryRequest):
    """
    Stream a natural language query response using Server-Sent Events (SSE).
    
    The stream emits the following event types:
    - {type: 'status'} - Phase updates (thinking, streaming)
    - {type: 'token'} - Individual LLM output tokens
    - {type: 'metadata'} - Final evidence, findings, confidence data
    - {type: 'error'} - Graceful error messages (never crashes)
    - '[DONE]' - Signals end of stream
    """
    logger.info(f"SSE stream request for case {request.case_id}: {request.query[:60]}...")

    return StreamingResponse(
        _stream_rag_tokens(request.case_id, request.query, request.user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


@router.post("/relationships")
async def get_query_relationships(request: RelationshipQueryRequest):
    """
    Extract graph relationship data for a query to power the inline mini-graph.
    Returns nodes and edges ready for ForceGraph consumption.
    """
    try:
        logger.info(f"Relationship query for case {request.case_id}: {request.query}")

        result = await asyncio.wait_for(
            rag_pipeline.execute_query(
                case_id=request.case_id,
                query=request.query,
                user_id=request.user_id
            ),
            timeout=120.0
        )

        # Extract any graph evidence from Neo4j results
        graph_nodes = []
        graph_edges = []
        node_id_map = {}
        node_counter = [0]

        def get_or_create_node(label: str, node_type: str) -> int:
            if label not in node_id_map:
                node_id_map[label] = node_counter[0]
                graph_nodes.append({'id': node_counter[0], 'label': label, 'type': node_type, 'frequency': 1})
                node_counter[0] += 1
            return node_id_map[label]

        for evidence in result.get('evidence', []):
            meta = evidence.get('metadata', {})
            if meta.get('phoneNumber'):
                phone = str(meta['phoneNumber'].get('number', meta['phoneNumber']))
                src_id = get_or_create_node(phone, 'PhoneNumber')
                if request.node_label:
                    tgt_id = get_or_create_node(request.node_label, 'Contact')
                    graph_edges.append({'source': src_id, 'target': tgt_id, 'weight': 1, 'type': 'COMMUNICATED_WITH'})

        return {
            'success': True,
            'has_graph': len(graph_nodes) > 0,
            'graph': {'nodes': graph_nodes, 'edges': graph_edges, 'anomalies': []},
            'answer': result.get('answer', ''),
            'findings': result.get('findings', []),
            'confidence': result.get('confidence', 0.0)
        }

    except asyncio.TimeoutError:
        return {
            'success': False,
            'has_graph': False,
            'graph': {'nodes': [], 'edges': [], 'anomalies': []},
            'answer': 'Analysis timed out. Please try again.',
            'findings': [],
            'confidence': 0.0
        }
    except Exception as e:
        logger.error(f"Relationship query failed: {e}")
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
