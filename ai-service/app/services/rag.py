"""
RAG (Retrieval-Augmented Generation) Pipeline
Combines search, retrieval, and generation for answering queries
"""

from typing import Dict, Any, List, Optional
from loguru import logger
import json

from app.services.database import db_manager
from app.services.embeddings import embedding_service
from app.services.llm import llm_service
from app.config import settings


class RAGPipeline:
    """RAG pipeline for query processing"""
    
    async def execute_query(
        self,
        case_id: int,
        query: str,
        user_id: int,
        session_id: Optional[str] = None,
        query_type: str = "natural_language"
    ) -> Dict[str, Any]:
        """Execute complete RAG pipeline"""
        
        logger.info(f"Executing RAG query for case {case_id}: {query}")
        
        try:
            # Step 1: Decompose query
            query_components = await llm_service.decompose_query(query)
            logger.info(f"Query decomposed: {query_components}")
            
            # Step 2: Get conversation history (filtered by session if provided)
            conversation_history = await self._get_conversation_history(case_id, user_id, session_id=session_id)
            logger.info(f"Retrieved {len(conversation_history)} previous queries for session {session_id}")
            
            # Step 2.5: Get cross-case connections
            cross_case_context = await self._get_cross_case_context(case_id)
            logger.info(f"Found {len(cross_case_context.get('connected_cases', []))} connected cases")
            
            # Step 3: Parallel search across databases (current case + connected cases)
            semantic_query = query_components.get("semantic_query", "").strip() or query
            logger.info(f"Using semantic query: '{semantic_query}'")
            search_results = await self._parallel_search(
                case_id,
                query_components,
                cross_case_context.get('connected_cases', []),
                semantic_query
            )
            
            # Step 4: Rank and filter results
            ranked_results = await self._rank_results(
                query,
                search_results
            )
            
            # Step 5: Synthesize answer with conversation context
            answer = await llm_service.synthesize_answer(
                query,
                ranked_results[:settings.TOP_K],
                conversation_history,
                query_type=query_type
            )
            logger.info(f"Answer synthesis result type: {type(answer)}, value: {answer}")
            
            # Step 6: Save query to database
            query_id = await self._save_query(
                case_id,
                user_id,
                query,
                query_components,
                answer,
                session_id=session_id
            )
            
            return {
                "query_id": query_id,
                "query": query,
                "answer": answer["answer"],
                "findings": answer["findings"],
                "evidence": ranked_results[:settings.TOP_K],
                "total_results": len(search_results),
                "confidence": answer["confidence"],
                "query_components": query_components
            }
            
        except Exception as e:
            logger.error(f"RAG pipeline failed: {e}")
            raise
    
    async def _parallel_search(
        self,
        case_id: int,
        query_components: Dict[str, Any],
        connected_cases: Optional[List[int]] = None,
        semantic_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search across all databases in parallel (current case + connected cases)"""
        
        if semantic_query is None:
            semantic_query = query_components.get("semantic_query", "")
        
        if connected_cases is None:
            connected_cases = []
        
        all_case_ids = [case_id] + connected_cases
        all_results = []
        
        for search_case_id in all_case_ids:
            logger.info(f"Searching case {search_case_id} for query components")
            
            results = []
            
            # Elasticsearch keyword search
            if db_manager.elasticsearch:
                es_results = await self._search_elasticsearch(
                    search_case_id,
                    query_components
                )
                # Mark results with source case
                for result in es_results:
                    result['source_case_id'] = search_case_id
                    result['is_cross_case'] = search_case_id != case_id
                results.extend(es_results)
            
            # Qdrant semantic search
            if db_manager.qdrant_client:
                qdrant_results = await self._search_qdrant(
                    search_case_id,
                    semantic_query
                )
                # Mark results with source case
                for result in qdrant_results:
                    result['source_case_id'] = search_case_id
                    result['is_cross_case'] = search_case_id != case_id
                results.extend(qdrant_results)
            
            # Neo4j graph search
            if db_manager.neo4j:
                graph_results = await self._search_neo4j(
                    search_case_id,
                    query_components
                )
                # Mark results with source case
                for result in graph_results:
                    result['source_case_id'] = search_case_id
                    result['is_cross_case'] = search_case_id != case_id
                results.extend(graph_results)
            
            all_results.extend(results)
        
        return all_results
    
    async def _search_elasticsearch(
        self,
        case_id: int,
        query_components: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Search Elasticsearch for keyword matches"""
        
        try:
            # Build Elasticsearch query
            must_clauses: List[Dict[str, Any]] = [
                {"term": {"caseId": case_id}}
            ]
            
            # Add keyword search if keywords are available
            keywords = query_components.get("keywords", [])
            if keywords:
                must_clauses.append({
                    "multi_match": {
                        "query": " ".join(keywords),
                        "fields": ["content^2", "phoneNumber"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                })
            
            # Add filters
            filters = query_components.get("filters", {})
            if filters.get("source_type"):
                must_clauses.append({"term": {"sourceType": filters["source_type"]}})
            
            if filters.get("phone_number"):
                must_clauses.append({"term": {"phoneNumber": filters["phone_number"]}})
            
            if filters.get("date_from") or filters.get("date_to"):
                date_range = {}
                if filters.get("date_from"):
                    date_range["gte"] = filters["date_from"]
                if filters.get("date_to"):
                    date_range["lte"] = filters["date_to"]
                must_clauses.append({"range": {"timestamp": date_range}})
            
            # Build sort - use _score for keyword queries, timestamp for broad queries
            if filters.get("recent_upload"):
                sort_clause = [{"indexedAt": {"order": "desc", "unmapped_type": "date"}}]
                # If they just want the recent upload, wipe out the literal keywords ("recently", "uploaded")
                # so we don't accidentally filter out messages that don't contain those words.
                must_clauses = [c for c in must_clauses if "multi_match" not in c]
            elif keywords:
                sort_clause = [{"_score": {"order": "desc"}}]
            else:
                sort_clause = [{"timestamp": {"order": "desc", "unmapped_type": "date"}}]
            
            # Execute search
            if not db_manager.elasticsearch:
                return []
            response = await db_manager.elasticsearch.search(
                index="ufdr-*",
                body={
                    "query": {"bool": {"must": must_clauses}},
                    "size": 50,
                    "sort": sort_clause,
                    "highlight": {
                        "fields": {"content": {}}
                    }
                }
            )
            
            # Format results
            results = []
            for hit in response["hits"]["hits"]:
                # Extract content - check both top-level and metadata fields
                content = hit["_source"].get("content", "")
                if not content and hit["_source"].get("metadata"):
                    metadata = hit["_source"]["metadata"]
                    content = metadata.get("message", "") or metadata.get("body", "") or metadata.get("text", "")
                
                results.append({
                    "id": hit["_id"],
                    "score": hit["_score"] or 1.0,
                    "source": {"type": "elasticsearch", "name": "Elasticsearch"},
                    "content": content,
                    "metadata": hit["_source"],
                    "highlight": hit.get("highlight", {})
                })
            
            logger.info(f"Elasticsearch found {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Elasticsearch search failed: {e}")
            return []
    
    async def _search_qdrant(
        self,
        case_id: int,
        semantic_query: str
    ) -> List[Dict[str, Any]]:
        """Search Qdrant for semantic matches"""
        
        try:
            if not db_manager.qdrant_client:
                logger.warning("Qdrant not available for search")
                return []
                
            # Generate query embedding
            logger.info(f"Generating embedding for query: '{semantic_query}'")
            query_embedding = await embedding_service.generate_embedding(semantic_query)
            
            if not query_embedding or len(query_embedding) == 0:
                logger.warning("Failed to generate query embedding")
                return []
            
            # Search Qdrant with native case_id filter
            logger.info(f"Executing Qdrant query for case_id={case_id}...")
            
            from qdrant_client.http import models as rest
            
            results = await db_manager.qdrant_client.query_points(
                collection_name="copsight_embeddings",
                query=query_embedding,
                limit=50,
                query_filter=rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="case_id",
                            match=rest.MatchValue(value=case_id)
                        )
                    ]
                )
            )
            
            # Format results
            formatted_results = []
            
            for hit in results.points:
                # Cosine similarity is natively supported by Qdrant, score is directly the similarity
                similarity = max(0.0, hit.score)
                
                # Filter out low similarity results to prevent hallucinations
                if similarity < 0.6:
                    continue
                
                metadata = hit.payload or {}
                document = metadata.get("document", "")
                
                formatted_results.append({
                    "id": hit.id,
                    "score": round(similarity, 4),
                    "source": {"type": "rag", "name": "RAG"},
                    "content": document,
                    "metadata": {
                        "sourceType": metadata.get("source_type"),
                        "appName": metadata.get("app_name"),
                        "phoneNumber": metadata.get("phone_number"),
                        "timestamp": metadata.get("timestamp"),
                        "direction": metadata.get("direction"),
                        "fileName": metadata.get("file_name"),
                    }
                })
            
            logger.info(f"Qdrant found {len(formatted_results)} results for case_id={case_id}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Qdrant search failed: {e}")
            return []
    
    async def _search_neo4j(
        self,
        case_id: int,
        query_components: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Search Neo4j for relationship patterns"""
        
        try:
            # Extract entities for graph search
            entities = query_components.get("entities", [])
            
            if not entities:
                return []
            
            # Build Cypher query
            cypher = """
            MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(d:Device)
            MATCH (d)-[r:COMMUNICATED_WITH]-(p:PhoneNumber)
            WHERE p.number IN $entities
            RETURN d, r, p
            LIMIT 20
            """
            
            if not db_manager.neo4j:
                return []
            async with db_manager.neo4j.session() as session:
                result = await session.run(cypher, caseId=case_id, entities=entities)
                records = await result.data()
            
            # Format results
            formatted_results = []
            for record in records:
                formatted_results.append({
                    "id": f"neo4j_{record['p']['number']}",
                    "score": 0.8,
                    "source": {"type": "graph", "name": "Knowledge Graph"},
                    "content": f"Communication with {record['p']['number']}",
                    "metadata": {
                        "device": record['d'],
                        "relationship": record['r'],
                        "phoneNumber": record['p']
                    }
                })
            
            logger.info(f"Neo4j found {len(formatted_results)} results")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Neo4j search failed: {e}")
            return []
    
    async def _rank_results(
        self,
        query: str,
        results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Rank and deduplicate results"""
        
        # Remove duplicates based on content
        seen_content = set()
        unique_results = []
        
        for result in results:
            content = result.get("content", "")
            if content and content not in seen_content:
                seen_content.add(content)
                unique_results.append(result)
        
        # Sort by score
        unique_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        return unique_results
    
    async def _get_conversation_history(
        self,
        case_id: int,
        user_id: int,
        limit: int = 5,
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get recent conversation history for the case and user"""
        
        try:
            if not db_manager.postgres:
                logger.warning("PostgreSQL not available, attempting reconnection...")
                success = await db_manager.reconnect_postgres()
                if not success:
                    logger.warning("PostgreSQL reconnection failed, proceeding without conversation history")
                    return []
                    
            if not db_manager.postgres:
                return []
            async with db_manager.postgres.acquire() as conn:
                where_clause = "WHERE case_id = $1 AND user_id = $2 AND answer IS NOT NULL"
                params: List[Any] = [case_id, user_id]
                
                if session_id:
                    where_clause += " AND session_id = $3"
                    params.append(session_id)
                
                limit_idx = len(params) + 1
                where_clause += f" ORDER BY created_at DESC LIMIT ${limit_idx}"
                params.append(limit)

                queries = await conn.fetch(f"""
                    SELECT 
                        id, query_text, answer, results_count, confidence_score,
                        created_at
                    FROM case_queries
                    {where_clause}
                """, *params)
                
                # Convert to list and reverse to get chronological order (oldest first)
                history = []
                for query in reversed(list(queries)):
                    history.append({
                        "query": query["query_text"],
                        "answer": query["answer"] or f"Query processed with {query['results_count']} results",
                        "timestamp": query["created_at"].isoformat()
                    })
                
                return history
                
        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []
    
    async def _get_cross_case_context(self, case_id: int) -> Dict[str, Any]:
        """Get cross-case context including connected cases and relationships"""
        
        try:
            if not db_manager.postgres:
                logger.warning("PostgreSQL not available, attempting reconnection...")
                success = await db_manager.reconnect_postgres()
                if not success:
                    logger.warning("PostgreSQL reconnection failed, proceeding without cross-case context")
                    return {
                        'connected_cases': [],
                        'links': [],
                        'total_connections': 0
                    }
                    
            if not db_manager.postgres:
                return {
                    'connected_cases': [],
                    'links': [],
                    'total_connections': 0
                }
            async with db_manager.postgres.acquire() as conn:
                # Get direct cross-case links
                links = await conn.fetch("""
                    SELECT 
                        CASE WHEN source_case_id = $1 THEN target_case_id ELSE source_case_id END as connected_case_id,
                        link_type, entity_type, entity_value, strength, confidence_score,
                        c.case_number, c.title
                    FROM cross_case_links ccl
                    JOIN cases c ON c.id = CASE WHEN ccl.source_case_id = $1 THEN ccl.target_case_id ELSE ccl.source_case_id END
                    WHERE (source_case_id = $1 OR target_case_id = $1)
                    AND c.status IN ('active', 'ready_for_analysis', 'under_review')
                    ORDER BY 
                        CASE strength 
                            WHEN 'critical' THEN 1 
                            WHEN 'strong' THEN 2 
                            WHEN 'medium' THEN 3 
                            WHEN 'weak' THEN 4 
                        END,
                        confidence_score DESC
                    LIMIT 10
                """, case_id)
                
                connected_cases = []
                for link in links:
                    connected_cases.append({
                        'case_id': link['connected_case_id'],
                        'case_number': link['case_number'],
                        'title': link['title'],
                        'link_type': link['link_type'],
                        'entity_type': link['entity_type'],
                        'entity_value': link['entity_value'],
                        'strength': link['strength'],
                        'confidence': link['confidence_score']
                    })
                
                # Get unique connected case IDs
                case_ids = list(set(link['connected_case_id'] for link in links))
                
                return {
                    'connected_cases': case_ids,
                    'links': connected_cases,
                    'total_connections': len(links)
                }
                
        except Exception as e:
            logger.error(f"Failed to get cross-case context for case {case_id}: {e}")
            return {
                'connected_cases': [],
                'links': [],
                'total_connections': 0
            }
    
    async def index_case_data(
        self,
        case_id: int,
        data_sources: List[Dict[str, Any]],
        entities: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Index case data to Qdrant for semantic search"""
        
        try:
            if not db_manager.qdrant_client:
                logger.warning("Qdrant not available for indexing")
                return {
                    'success': False,
                    'error': 'Qdrant not available',
                    'indexed_count': 0,
                    'case_id': case_id
                }
                
            logger.info(f"Indexing case {case_id} data to Qdrant")
            
            documents = []
            metadatas = []
            
            # Process data sources
            for source in data_sources:
                for record in source.get('data', []):
                    content = record.get('content') or record.get('message') or record.get('body') or ''
                    
                    if content and content.strip():
                        # Find entities in this record
                        record_entities = []
                        for entity in entities:
                            if entity.get('value') and entity['value'] in content:
                                record_entities.append({
                                    'type': entity.get('type'),
                                    'value': entity.get('value'),
                                    'confidence': entity.get('confidence', 0.8)
                                })
                        
                        documents.append(content)
                        # Create metadata dict
                        metadata = {
                            'case_id': case_id,
                            'source_type': source.get('sourceType'),
                            'app_name': source.get('appName'),
                            'phone_number': record.get('phoneNumber'),
                            'timestamp': record.get('timestamp'),
                            'direction': record.get('direction'),
                            'file_name': source.get('file_name'),
                            'entity_count': len(record_entities),
                            'entity_types': ','.join([e.get('type', '') for e in record_entities]),
                            'document': content  # Store document text in payload for Qdrant
                        }
                        
                        # Sanitize metadata (remove None values)
                        metadatas.append({k: (v if v is not None else "") for k, v in metadata.items()})
            
            if documents:
                # Generate embeddings for indexing
                logger.info(f"Generating embeddings for {len(documents)} documents")
                embeddings = await embedding_service.generate_embeddings(documents)
                
                # Index to Qdrant
                from qdrant_client.http import models as rest
                import uuid
                
                points = []
                for i in range(len(documents)):
                    # Qdrant requires UUID or int IDs
                    point_id = str(uuid.uuid4())
                    points.append(
                        rest.PointStruct(
                            id=point_id,
                            vector=embeddings[i],
                            payload=metadatas[i]
                        )
                    )
                
                await db_manager.qdrant_client.upsert(
                    collection_name="copsight_embeddings",
                    points=points
                )
                
                logger.info(f"Indexed {len(documents)} documents to Qdrant for case {case_id}")
                return {
                    'success': True,
                    'indexed_count': len(documents),
                    'case_id': case_id
                }
            else:
                logger.warning(f"No documents to index for case {case_id}")
                return {
                    'success': True,
                    'indexed_count': 0,
                    'case_id': case_id
                }
                
        except Exception as e:
            logger.error(f"Failed to index case {case_id} data: {e}")
            raise

    async def _save_query(
        self,
        case_id: int,
        user_id: int,
        query: str,
        query_components: Dict[str, Any],
        answer: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> int:
        """Save query to database"""
        
        logger.info(f"_save_query called with answer type: {type(answer)}, value: {answer}")
        
        try:
            if not db_manager.postgres:
                logger.warning("PostgreSQL not available, attempting reconnection...")
                success = await db_manager.reconnect_postgres()
                if not success:
                    logger.warning("PostgreSQL reconnection failed, skipping query save")
                    return 0
                    
            if not db_manager.postgres:
                return 0
            async with db_manager.postgres.acquire() as conn:
                query_id = await conn.fetchval("""
                    INSERT INTO case_queries (
                        case_id, user_id, query_text, query_type,
                        filters, results_count, confidence_score, answer, session_id,
                        findings, evidence, created_at
                    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, NOW())
                    RETURNING id
                """,
                    case_id,
                    user_id,
                    query,
                    query_components.get("intent", "search"),
                    json.dumps(query_components.get("filters", {})),
                    answer.get("evidence_count", 0),
                    answer.get("confidence", 0.0),
                    answer.get("answer", ""),
                    session_id,
                    json.dumps(answer.get("findings", [])),
                    json.dumps(answer.get("evidence", []))
                )
                
                return query_id
                
        except Exception as e:
            logger.error(f"Failed to save query: {e}")
            return 0


# Global instance
rag_pipeline = RAGPipeline()
