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
import re

from app.services.rag import rag_pipeline

router = APIRouter()


class QueryRequest(BaseModel):
    """Query request model"""
    case_id: int
    query: str
    user_id: int
    session_id: Optional[str] = None


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
            user_id=request.user_id,
            session_id=request.session_id
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
    session_id: Optional[str] = None


class RelationshipQueryRequest(BaseModel):
    """Relationship query to drive graph visualization"""
    case_id: int
    query: str
    user_id: int
    node_label: Optional[str] = None


def _is_forensic_query(query: str) -> bool:
    """Detect if the query has forensic, case-related, or data-exploration intent.
    
    Strategy: "Block known bad, allow everything else."
    We only reject queries that are CLEARLY non-forensic (chitchat, general
    knowledge, prompt-injection attempts).  Anything ambiguous is allowed
    through — the LLM + RAG pipeline will handle it gracefully with a
    "no evidence found" response, which is far better than a hard block on
    a legitimate investigative question.
    """
    query_lower = query.strip().lower()
    words = query_lower.split()

    # ── 0. Trivial / empty guard ──────────────────────────────────────
    if not query_lower or len(query_lower) < 2:
        return False

    # ── 1. HARD BLOCK – exact greetings & micro-phrases ───────────────
    chitchat_exact = {
        'hello', 'hi', 'hey', 'yo', 'sup', 'hola',
        'good morning', 'good evening', 'good night', 'good afternoon',
        'thanks', 'thank you', 'thx', 'ok', 'okay', 'bye', 'goodbye',
        'ping', 'test', 'testing',
    }
    if query_lower in chitchat_exact:
        return False

    # ── 2. HARD BLOCK – clearly irrelevant topics ─────────────────────
    #       These are checked as substrings so "tell me a joke" is caught.
    irrelevant_phrases = [
        'tell me a joke', 'tell a joke', 'joke about',
        'write a poem', 'write me a poem', 'poem about',
        'write a song', 'sing a song', 'sing me',
        'what is your name', 'who created you', 'who made you', 'who are you',
        'ignore all previous', 'ignore previous instructions', 'disregard',
        'recipe for', 'how to bake', 'how to cook',
        'what is the weather', 'weather in', 'weather today',
        'score of the', 'who won the match', 'sports news',
        'recommend a movie', 'movie review', 'best movies',
        'play a game', 'tic tac toe', 'rock paper',
        'capital of', 'president of', 'prime minister of',
        'how old is', 'when was .* born',  # general knowledge
    ]
    for phrase in irrelevant_phrases:
        if phrase in query_lower:
            return False

    # ── 3. STRONG ALLOW – summary / case-level questions ──────────────
    summary_keywords = [
        'summar', 'overview', 'what is this case', 'about the case',
        'tell me about this case', 'what happened', 'explain the case',
        'brief me', 'case details', 'case info', 'highlights',
    ]
    if any(kw in query_lower for kw in summary_keywords):
        return True

    # ── 4. STRONG ALLOW – any forensic / data keyword present ─────────
    forensic_keywords = [
        # Communication
        'call', 'message', 'chat', 'contact', 'sms', 'mms',
        'whatsapp', 'telegram', 'signal', 'imessage', 'viber',
        'communicate', 'conversation', 'talk', 'send', 'receive', 'sent', 'received',
        # People / Entities
        'suspect', 'victim', 'witness', 'person', 'user', 'owner', 'sender', 'receiver',
        'who is', 'who did', 'who was', 'who has', 'who sent', 'who received', 'who called',
        # Identifiers
        'phone', 'number', 'email', 'account', 'username', 'handle', 'profile',
        'ip address', 'mac address', 'imei', 'imsi', 'msisdn',
        # Financial
        'transact', 'crypto', 'bitcoin', 'btc', 'ethereum', 'wallet',
        'payment', 'transfer', 'money', 'bank', 'upi', 'amount', 'fund',
        # Location & Time
        'location', 'gps', 'coord', 'latitude', 'longitude', 'tower', 'cell',
        'time', 'date', 'when', 'timestamp', 'before', 'after', 'between', 'during',
        # Analysis
        'anomal', 'pattern', 'unusual', 'suspicious', 'frequen', 'trend',
        'network', 'connection', 'relation', 'linked', 'associat',
        # Digital Evidence
        'file', 'metadata', 'document', 'evidence', 'device', 'app', 'application',
        'browser', 'history', 'download', 'image', 'photo', 'video', 'media',
        'pdf', 'log', 'record', 'data',
        # Investigation
        'fraud', 'crime', 'investigat', 'foren', 'case', 'incident',
        'link', 'trace', 'track', 'identify', 'extract',
        # Contextual question starters
        'what did', 'when did', 'where did', 'how many', 'how often',
        'how much', 'which', 'whose',
        # Actions
        'search', 'find', 'show', 'list', 'get', 'fetch', 'display',
        'filter', 'sort', 'group', 'count', 'check', 'look up', 'lookup',
        'analyze', 'analyse', 'compare', 'correlate', 'report',
        'hidden', 'deleted', 'recent', 'top', 'most', 'least', 'all',
        # Mentions
        'mention', 'contain', 'include', 'about', 'related', 'regarding',
    ]
    if any(kw in query_lower for kw in forensic_keywords):
        return True

    # ── 5. STRONG ALLOW – entity patterns (phone, email, crypto) ──────
    if re.search(r'\b\d{6,15}\b', query):
        return True
    if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', query):
        return True
    if re.search(r'\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b', query):
        return True

    # ── 6. HEURISTIC ALLOW – longer queries are likely investigative ──
    #       If a query has 4+ words and wasn't blocked above, it's
    #       probably a real question and not chitchat.
    if len(words) >= 4:
        return True

    # ── 7. ALLOW short non-conversational fragments (names, IDs) ──────
    #       "John Doe", "Project X", "123 Main St" — treat as entity search.
    pure_chitchat_words = {'how', 'why', 'tell', 'can', 'you', 'please', 'do', 'does', 'write', 'draw', 'create', 'make', 'sing', 'play'}
    is_pure_chitchat = all(w in pure_chitchat_words for w in words)
    if len(words) <= 3 and not is_pure_chitchat:
        return True

    # ── 8. Default: BLOCK only if nothing matched ─────────────────────
    #       At this point the query is 1-3 words of pure conversational
    #       filler with zero forensic signal.  Safe to reject.
    return False


async def _stream_rag_tokens(
    case_id: int,
    query: str,
    user_id: int,
    session_id: Optional[str] = None
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
        # 0. Intent Filtering
        if not _is_forensic_query(query):
            yield _sse({'type': 'status', 'status': 'done', 'message': 'Query Out of Scope'})
            await asyncio.sleep(0.1)
            
            out_of_scope_msg = "This query falls outside the scope of forensic case analysis. CopSight is designed to analyze digital evidence from seized devices — including communications, call records, financial transactions, contact networks, and device artifacts. Please rephrase your query to target specific case evidence, or use commands like 'summarize the case', 'show recent messages', or 'find suspicious transactions'."
            words = out_of_scope_msg.split(' ')
            yield _sse({'type': 'status', 'status': 'streaming', 'message': 'Generating response...'})
            for i, word in enumerate(words):
                chunk = word + (' ' if i < len(words) - 1 else '')
                yield _sse({'type': 'token', 'token': chunk})
                await asyncio.sleep(0.01)
                
            yield _sse({
                'type': 'metadata',
                'evidence': [],
                'findings': [{"finding": "Query filtered due to non-forensic intent.", "type": "warning"}],
                'confidence': 0.0,
                'query_components': {},
                'total_results': 0,
                'query_id': 0,
                'has_relationships': False
            })
            yield "data: [DONE]\n\n"
            return

        # 1. Immediately signal thinking state
        yield _sse({'type': 'status', 'status': 'thinking', 'message': 'Searching & Analyzing Evidence...'})
        await asyncio.sleep(0)  # yield control to the event loop

        # 2. Run the full RAG pipeline (this is the slow Ollama call)
        try:
            result = await asyncio.wait_for(
                rag_pipeline.execute_query(
                    case_id=case_id,
                    query=query,
                    user_id=user_id,
                    session_id=session_id
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
        _stream_rag_tokens(request.case_id, request.query, request.user_id, request.session_id),
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
            phone_meta = meta.get('phoneNumber')
            if phone_meta:
                if isinstance(phone_meta, dict):
                    phone = str(phone_meta.get('number', phone_meta.get('value', '')))
                else:
                    phone = str(phone_meta)
                
                if phone:
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
