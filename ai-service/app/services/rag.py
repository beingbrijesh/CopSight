"""
RAG (Retrieval-Augmented Generation) Pipeline
Combines search, retrieval, and generation for answering queries
"""

from typing import Dict, Any, List
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
        user_id: int
    ) -> Dict[str, Any]:
        """Execute complete RAG pipeline"""
        
        logger.info(f"Executing RAG query for case {case_id}: {query}")
        
        try:
            # Step 1: Decompose query
            query_components = await llm_service.decompose_query(query)
            logger.info(f"Query decomposed: {query_components}")
            
            # Step 2: Get conversation history
            conversation_history = await self._get_conversation_history(case_id, user_id)
            logger.info(f"Retrieved {len(conversation_history)} previous queries")
            
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
                conversation_history
            )
            logger.info(f"Answer synthesis result type: {type(answer)}, value: {answer}")
            
            # Step 6: Save query to database
            query_id = await self._save_query(
                case_id,
                user_id,
                query,
                query_components,
                answer
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
        connected_cases: List[int] = None,
        semantic_query: str = None
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
            
            # ChromaDB semantic search
            if db_manager.chroma_collection:
                chroma_results = await self._search_chromadb(
                    search_case_id,
                    semantic_query
                )
                # Mark results with source case
                for result in chroma_results:
                    result['source_case_id'] = search_case_id
                    result['is_cross_case'] = search_case_id != case_id
                results.extend(chroma_results)
            
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
            must_clauses = [
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
            
            # Build sort - use timestamp for broad queries, _score for keyword queries
            sort_clause = [{"timestamp": {"order": "desc", "unmapped_type": "date"}}]
            
            # Execute search
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
    
    async def _search_chromadb(
        self,
        case_id: int,
        semantic_query: str
    ) -> List[Dict[str, Any]]:
        """Search ChromaDB for semantic matches"""
        
        try:
            if not db_manager.chroma_collection:
                logger.warning("ChromaDB not available for search")
                return []
                
            # Generate query embedding
            logger.info(f"Generating embedding for query: '{semantic_query}'")
            query_embedding = await embedding_service.generate_embedding(semantic_query)
            logger.info(f"Generated embedding with length: {len(query_embedding) if query_embedding else 'None'}")
            
            if not query_embedding or len(query_embedding) == 0:
                logger.warning("Failed to generate query embedding")
                return []
            
            # Search ChromaDB (remove where clause to avoid filtering issues)
            logger.info("Executing ChromaDB query...")
            results = db_manager.chroma_collection.query(
                query_embeddings=[query_embedding],
                n_results=50,  # Get more results, we'll filter in Python
                include=["documents", "metadatas", "distances"]
            )
            
            # Debug logging
            logger.info(f"ChromaDB raw results - ids: {len(results.get('ids', []))}, docs: {len(results.get('documents', []))}")
            if results.get('ids') and len(results['ids']) > 0:
                logger.info(f"First result ids[0] length: {len(results['ids'][0])}")
            if results.get('metadatas') and len(results['metadatas']) > 0:
                logger.info(f"First result metadatas[0] length: {len(results['metadatas'][0])}")
            
            # Format results and filter by case_id
            formatted_results = []
            if results and results.get('ids') and len(results['ids']) > 0 and len(results['ids'][0]) > 0:
                for i, doc_id in enumerate(results['ids'][0]):
                    # Get metadata and check case_id
                    metadata = results['metadatas'][0][i] if results.get('metadatas') and len(results['metadatas']) > 0 and len(results['metadatas'][0]) > i else {}
                    
                    logger.info(f"Checking document {doc_id}: metadata case_id={metadata.get('case_id')} (type: {type(metadata.get('case_id'))}), target case_id={case_id} (type: {type(case_id)})")
                    
                    # Skip if not matching case_id
                    if metadata.get('case_id') != case_id:
                        logger.info(f"Skipping document {doc_id} - case_id mismatch")
                        continue
                    
                    # ChromaDB returns distances (lower is better), convert to similarity score
                    distance = results['distances'][0][i] if results.get('distances') and len(results['distances']) > 0 and len(results['distances'][0]) > i else 1.0
                    similarity = 1.0 / (1.0 + distance)  # Convert distance to similarity
                    
                    document = results['documents'][0][i] if results.get('documents') and len(results['documents']) > 0 and len(results['documents'][0]) > i else ""
                    
                    formatted_results.append({
                        "id": doc_id,
                        "score": similarity,
                        "source": {"type": "rag", "name": "RAG"},
                        "content": document,
                        "metadata": {
                            "sourceType": metadata.get("source_type"),
                            "timestamp": metadata.get("timestamp")
                        }
                    })
            
            logger.info(f"ChromaDB found {len(formatted_results)} results")
            return formatted_results
            
        except Exception as e:
            logger.error(f"ChromaDB search failed: {e}")
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
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent conversation history for the case and user"""
        
        try:
            if not db_manager.postgres:
                logger.warning("PostgreSQL not available, attempting reconnection...")
                success = await db_manager.reconnect_postgres()
                if not success:
                    logger.warning("PostgreSQL reconnection failed, proceeding without conversation history")
                    return []
                    
            async with db_manager.postgres.acquire() as conn:
                queries = await conn.fetch("""
                    SELECT 
                        id, query_text, answer, results_count, confidence_score,
                        created_at
                    FROM case_queries
                    WHERE case_id = $1 AND user_id = $2 AND answer IS NOT NULL
                    ORDER BY created_at DESC
                    LIMIT $3
                """, case_id, user_id, limit)
                
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
        """Index case data to ChromaDB for semantic search"""
        
        try:
            if not db_manager.chroma_collection:
                logger.warning("ChromaDB not available for indexing")
                return {
                    'success': False,
                    'error': 'ChromaDB not available',
                    'indexed_count': 0,
                    'case_id': case_id
                }
                
            logger.info(f"Indexing case {case_id} data to ChromaDB")
            
            documents = []
            metadatas = []
            ids = []
            
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
                            'entity_count': len(record_entities),
                            'entity_types': ','.join([e.get('type', '') for e in record_entities])
                        }
                        
                        # Sanitize metadata (remove None values which ChromaDB doesn't allow)
                        metadatas.append({k: (v if v is not None else "") for k, v in metadata.items()})
                        ids.append(f"{case_id}_{source.get('sourceType')}_{record.get('id', str(len(ids)))}")
            
            if documents:
                # Generate embeddings for indexing
                logger.info(f"Generating embeddings for {len(documents)} documents")
                embeddings = await embedding_service.generate_embeddings(documents)
                
                # Index to ChromaDB with pre-computed embeddings
                db_manager.chroma_collection.add(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas,
                    embeddings=embeddings
                )
                
                logger.info(f"Indexed {len(documents)} documents to ChromaDB for case {case_id}")
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
        answer: Dict[str, Any]
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
                    
            async with db_manager.postgres.acquire() as conn:
                query_id = await conn.fetchval("""
                    INSERT INTO case_queries (
                        case_id, user_id, query_text, query_type,
                        filters, results_count, confidence_score, answer, created_at
                    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
                    RETURNING id
                """,
                    case_id,
                    user_id,
                    query,
                    query_components.get("intent", "search"),
                    json.dumps(query_components.get("filters", {})),
                    answer.get("evidence_count", 0),
                    answer.get("confidence", 0.0),
                    answer.get("answer", "")
                )
                
                return query_id
                
        except Exception as e:
            logger.error(f"Failed to save query: {e}")
            return 0


# Global instance
rag_pipeline = RAGPipeline()
