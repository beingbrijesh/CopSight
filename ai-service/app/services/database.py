"""
Database connection manager for all databases
"""

from elasticsearch import AsyncElasticsearch
from neo4j import AsyncGraphDatabase
import chromadb
from chromadb.config import Settings as ChromaSettings
import asyncpg
import redis.asyncio as aioredis
from loguru import logger

from app.config import settings


class DatabaseManager:
    """Manages connections to all databases"""
    
    def __init__(self):
        self.postgres = None
        self.elasticsearch = None
        self.neo4j = None
        self.redis = None
        self.chroma_client = None
        self.chroma_collection = None
    
    async def connect(self):
        """Connect to all databases"""
        
        # PostgreSQL
        try:
            self.postgres = await asyncpg.create_pool(
                settings.postgres_url,
                min_size=5,
                max_size=20
            )
            logger.info("✓ PostgreSQL connected")
        except Exception as e:
            logger.warning(f"✗ PostgreSQL connection failed: {e}")
        
        # Elasticsearch
        try:
            self.elasticsearch = AsyncElasticsearch(
                [settings.ELASTICSEARCH_URL],
                basic_auth=(settings.ELASTICSEARCH_USER, settings.ELASTICSEARCH_PASSWORD)
            )
            await self.elasticsearch.info()
            logger.info("✓ Elasticsearch connected")
        except Exception as e:
            logger.warning(f"✗ Elasticsearch connection failed: {e}")
        
        # Neo4j
        try:
            self.neo4j = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            await self.neo4j.verify_connectivity()
            logger.info("✓ Neo4j connected")
        except Exception as e:
            logger.warning(f"✗ Neo4j connection failed: {e}")
        
        # Redis
        try:
            self.redis = await aioredis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )
            await self.redis.ping()
            logger.info("✓ Redis connected")
        except Exception as e:
            logger.warning(f"✗ Redis connection failed: {e}")
        
        # ChromaDB
        try:
            self.chroma_client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIR,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            # Get or create collection for UFDR embeddings
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name="ufdr_embeddings",
                metadata={"description": "UFDR forensic data embeddings"}
            )
            logger.info("✓ ChromaDB connected")
        except Exception as e:
            logger.warning(f"✗ ChromaDB connection failed: {e}")
    
    async def disconnect(self):
        """Disconnect from all databases"""
        
        if self.postgres:
            await self.postgres.close()
        
        if self.elasticsearch:
            await self.elasticsearch.close()
        
        if self.neo4j:
            await self.neo4j.close()
        
        if self.redis:
            await self.redis.close()
        
        # ChromaDB doesn't need explicit disconnect
        if self.chroma_client:
            logger.info("ChromaDB client closed")
    
    async def check_health(self):
        """Check health of all database connections"""
        
        health = {
            "postgres": False,
            "elasticsearch": False,
            "neo4j": False,
            "redis": False,
            "chromadb": False
        }
        
        # Check PostgreSQL
        if self.postgres:
            try:
                async with self.postgres.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                health["postgres"] = True
            except:
                pass
        
        # Check Elasticsearch
        if self.elasticsearch:
            try:
                await self.elasticsearch.ping()
                health["elasticsearch"] = True
            except:
                pass
        
        # Check Neo4j
        if self.neo4j:
            try:
                await self.neo4j.verify_connectivity()
                health["neo4j"] = True
            except:
                pass
        
        # Check Redis
        if self.redis:
            try:
                await self.redis.ping()
                health["redis"] = True
            except:
                pass
        
        # Check ChromaDB
        if self.chroma_client and self.chroma_collection:
            try:
                # Simple check - try to count documents
                self.chroma_collection.count()
                health["chromadb"] = True
            except:
                pass
        
        return health


# Global instance
db_manager = DatabaseManager()
