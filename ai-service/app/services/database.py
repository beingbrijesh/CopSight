"""
Database connection manager for all databases.
"""

import os

os.environ["ANONYMIZED_TELEMETRY"] = "False"

import asyncpg
from elasticsearch import AsyncElasticsearch
from loguru import logger
from neo4j import AsyncGraphDatabase
import redis.asyncio as aioredis

from app.config import settings

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_IMPORT_ERROR = None
except Exception as import_error:
    chromadb = None
    ChromaSettings = None
    CHROMA_IMPORT_ERROR = import_error


class DatabaseManager:
    """Manages connections to all databases."""

    def __init__(self):
        self.postgres = None
        self.elasticsearch = None
        self.neo4j = None
        self.redis = None
        self.chroma_client = None
        self.chroma_collection = None

    async def connect(self):
        """Connect to all configured backends."""

        try:
            self.postgres = await asyncpg.create_pool(
                settings.postgres_url,
                min_size=10,
                max_size=50,
                max_queries=50000,
                max_inactive_connection_lifetime=600,
                command_timeout=120,
                server_settings={
                    "tcp_keepalives_idle": "60",
                    "tcp_keepalives_interval": "10",
                    "tcp_keepalives_count": "3",
                },
            )
            async with self.postgres.acquire() as conn:
                await conn.fetchval("SELECT 1")
            logger.info("PostgreSQL connected")
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            self.postgres = None

        try:
            self.elasticsearch = AsyncElasticsearch(
                [settings.ELASTICSEARCH_URL],
                basic_auth=(settings.ELASTICSEARCH_USER, settings.ELASTICSEARCH_PASSWORD),
                request_timeout=30,
                max_retries=3,
            )
            await self.elasticsearch.info()
            logger.info("Elasticsearch connected")
        except Exception as e:
            logger.error(f"Elasticsearch connection failed: {e}")
            self.elasticsearch = None

        try:
            self.neo4j = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                connection_timeout=30,
            )
            await self.neo4j.verify_connectivity()
            logger.info("Neo4j connected")
        except Exception as e:
            logger.error(f"Neo4j connection failed: {e}")
            self.neo4j = None

        try:
            self.redis = await aioredis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                socket_connect_timeout=10,
                socket_timeout=10,
                retry_on_timeout=True,
            )
            await self.redis.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis = None

        logger.info("Initializing ChromaDB...")
        if CHROMA_IMPORT_ERROR is not None:
            logger.warning(f"ChromaDB unavailable: {CHROMA_IMPORT_ERROR}")
            self.chroma_client = None
            self.chroma_collection = None
        else:
            try:
                self.chroma_client = chromadb.PersistentClient(
                    path=settings.CHROMA_PERSIST_DIR,
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
                self.chroma_collection = self.chroma_client.get_or_create_collection(
                    name="ufdr_embeddings",
                    metadata={"description": "UFDR forensic data embeddings"},
                )
                count = self.chroma_collection.count()
                logger.info(f"ChromaDB connected, collection count: {count}")
            except Exception as e:
                logger.error(f"ChromaDB initialization failed: {e}")
                self.chroma_client = None
                self.chroma_collection = None

    async def reconnect_postgres(self):
        """Reconnect to PostgreSQL if the pool is lost."""
        if self.postgres:
            try:
                await self.postgres.close()
            except Exception:
                pass

        try:
            self.postgres = await asyncpg.create_pool(
                settings.postgres_url,
                min_size=10,
                max_size=50,
                max_queries=50000,
                max_inactive_connection_lifetime=600,
                command_timeout=120,
                server_settings={
                    "tcp_keepalives_idle": "60",
                    "tcp_keepalives_interval": "10",
                    "tcp_keepalives_count": "3",
                },
            )
            async with self.postgres.acquire() as conn:
                await conn.fetchval("SELECT 1")
            logger.info("PostgreSQL reconnected successfully")
            return True
        except Exception as e:
            logger.error(f"PostgreSQL reconnection failed: {e}")
            self.postgres = None
            return False

    async def disconnect(self):
        """Disconnect from all databases."""
        if self.postgres:
            await self.postgres.close()
        if self.elasticsearch:
            await self.elasticsearch.close()
        if self.neo4j:
            await self.neo4j.close()
        if self.redis:
            await self.redis.close()
        if self.chroma_client:
            logger.info("ChromaDB client closed")

    async def check_health(self):
        """Check health of all connections."""
        health = {
            "postgres": False,
            "elasticsearch": False,
            "neo4j": False,
            "redis": False,
            "chromadb": False,
        }

        if self.postgres:
            try:
                async with self.postgres.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                health["postgres"] = True
            except Exception:
                pass

        if self.elasticsearch:
            try:
                await self.elasticsearch.ping()
                health["elasticsearch"] = True
            except Exception:
                pass

        if self.neo4j:
            try:
                await self.neo4j.verify_connectivity()
                health["neo4j"] = True
            except Exception:
                pass

        if self.redis:
            try:
                await self.redis.ping()
                health["redis"] = True
            except Exception:
                pass

        if self.chroma_client and self.chroma_collection:
            try:
                self.chroma_collection.count()
                health["chromadb"] = True
            except Exception:
                pass

        return health


db_manager = DatabaseManager()
