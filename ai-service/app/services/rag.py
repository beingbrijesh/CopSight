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
            
            # Step 2: Parallel search across databases
            search_results = await self._parallel_search(
                case_id,
                query_components
            )
            
            # Step 3: Rank and filter results
            ranked_results = await self._rank_results(
                query,
                search_results
            )
            
            # Step 4: Synthesize answer
            answer = await llm_service.synthesize_answer(
                query,
                ranked_results[:settings.TOP_K]
            )
            
            # Step 5: Save query to database
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
        query_components: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Search across all databases in parallel"""
        
        results = []
        
        # Elasticsearch keyword search
        if db_manager.elasticsearch:
            es_results = await self._search_elasticsearch(
                case_id,
                query_components
            )
            results.extend(es_results)
        
        # Milvus semantic search
        if db_manager.milvus_connected:
            milvus_results = await self._search_milvus(
                case_id,
                query_components["semantic_query"]
            )
            results.extend(milvus_results)
        
        # Neo4j graph search
        if db_manager.neo4j:
            graph_results = await self._search_neo4j(
                case_id,
                query_components
            )
            results.extend(graph_results)
        
        return results
    
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
    
    async def _search_milvus(
        self,
        case_id: int,
        semantic_query: str
    ) -> List[Dict[str, Any]]:
        """Search Milvus for semantic matches"""
        
        try:
            # Generate query embedding
            query_embedding = await embedding_service.generate_embedding(semantic_query)
            
            # Search Milvus
            from pymilvus import Collection
            collection = Collection("ufdr_embeddings")
            
            search_params = {
                "metric_type": "L2",
                "params": {"nprobe": 10}
            }
            
            results = collection.search(
                data=[query_embedding],
                anns_field="embedding",
                param=search_params,
                limit=20,
                expr=f"case_id == {case_id}",
                output_fields=["case_id", "source_type", "content", "timestamp"]
            )
            
            # Format results
            formatted_results = []
            for hits in results:
                for hit in hits:
                    formatted_results.append({
                        "id": hit.id,
                        "score": 1.0 - hit.distance,  # Convert distance to similarity
                        "source": "milvus",
                        "content": hit.entity.get("content", ""),
                        "metadata": {
                            "sourceType": hit.entity.get("source_type"),
                            "timestamp": hit.entity.get("timestamp")
                        }
                    })
            
            logger.info(f"Milvus found {len(formatted_results)} results")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Milvus search failed: {e}")
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
                        filters, results_count, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    RETURNING id
                """,
                    case_id,
                    user_id,
                    query,
                    query_components.get("intent", "search"),
                    str(query_components.get("filters", {})),
                    answer.get("evidence_count", 0)
                )
                
                return query_id
                
        except Exception as e:
            logger.error(f"Failed to save query: {e}")
            return 0


# Global instance
rag_pipeline = RAGPipeline()
