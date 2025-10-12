"""
RAG (Retrieval-Augmented Generation) Pipeline
Combines search, retrieval, and generation for answering queries
"""

from typing import Dict, Any, List
from loguru import logger

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
            search_results = await self._parallel_search(
                case_id,
                query_components,
                cross_case_context.get('connected_cases', [])
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
        connected_cases: List[int] = None
    ) -> List[Dict[str, Any]]:
        """Search across all databases in parallel (current case + connected cases)"""
        
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
                    query_components["semantic_query"]
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
            
            # Add keyword search
            if query_components.get("keywords"):
                must_clauses.append({
                    "multi_match": {
                        "query": " ".join(query_components["keywords"]),
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
            
            # Execute search
            response = await db_manager.elasticsearch.search(
                index="ufdr-*",
                body={
                    "query": {"bool": {"must": must_clauses}},
                    "size": 50,
                    "sort": [{"timestamp": "desc"}],
                    "highlight": {
                        "fields": {"content": {}}
                    }
                }
            )
            
            # Format results
            results = []
            for hit in response["hits"]["hits"]:
                results.append({
                    "id": hit["_id"],
                    "score": hit["_score"],
                    "source": "elasticsearch",
                    "content": hit["_source"].get("content", ""),
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
            # Generate query embedding
            query_embedding = await embedding_service.generate_embedding(semantic_query)
            
            # Search ChromaDB
            results = db_manager.chroma_collection.query(
                query_embeddings=[query_embedding],
                n_results=20,
                where={"case_id": case_id},
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results
            formatted_results = []
            if results and results['ids']:
                for i, doc_id in enumerate(results['ids'][0]):
                    # ChromaDB returns distances (lower is better), convert to similarity score
                    distance = results['distances'][0][i] if results['distances'] else 1.0
                    similarity = 1.0 / (1.0 + distance)  # Convert distance to similarity
                    
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    document = results['documents'][0][i] if results['documents'] else ""
                    
                    formatted_results.append({
                        "id": doc_id,
                        "score": similarity,
                        "source": "chromadb",
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
                    "source": "neo4j",
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
    
    async def _save_query(
        self,
        case_id: int,
        user_id: int,
        query: str,
        query_components: Dict[str, Any],
        answer: Dict[str, Any]
    ) -> int:
        """Save query to database"""
        
        try:
            async with db_manager.postgres.acquire() as conn:
                query_id = await conn.fetchval("""
                    INSERT INTO case_queries (
                        case_id, user_id, query_text, query_type,
                        filters, results_count, confidence_score, answer, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    RETURNING id
                """,
                    case_id,
                    user_id,
                    query,
                    query_components.get("intent", "search"),
                    str(query_components.get("filters", {})),
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
