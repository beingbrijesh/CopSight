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
    from qdrant_client import AsyncQdrantClient
    from qdrant_client.http.models import Distance, VectorParams
    QDRANT_IMPORT_ERROR = None
except Exception as import_error:
    AsyncQdrantClient = None
    Distance = None
    VectorParams = None
    QDRANT_IMPORT_ERROR = import_error


class DatabaseManager:
    """Manages connections to all databases."""

    def __init__(self):
        self.postgres = None
        self.elasticsearch = None
        self.neo4j = None
        self.redis = None
        self.qdrant_client = None

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
                statement_cache_size=0,
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
            # If the URL already contains credentials (like Bonsai https://user:pass@host),
            # providing basic_auth with default "elastic/changeme" will override and fail.
            es_kwargs = {
                "request_timeout": 30,
                "max_retries": 3,
            }
            if "@" not in settings.ELASTICSEARCH_URL and settings.ELASTICSEARCH_USER and settings.ELASTICSEARCH_PASSWORD:
                es_kwargs["basic_auth"] = (settings.ELASTICSEARCH_USER, settings.ELASTICSEARCH_PASSWORD)

            self.elasticsearch = AsyncElasticsearch(
                [settings.ELASTICSEARCH_URL],
                **es_kwargs
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
                keep_alive=True,
                max_connection_lifetime=200,  # Aura kills idle connections > 3-5 mins
                max_connection_pool_size=50,
            )
            await self.neo4j.verify_connectivity()
            logger.info("Neo4j connected")
        except Exception as e:
            logger.error(f"Neo4j connection failed: {e}")
            self.neo4j = None

        try:
            if settings.REDIS_URL:
                redis_url = settings.REDIS_URL
                is_rediss = redis_url.startswith("rediss://")
            else:
                import urllib.parse
                encoded_redis_pass = urllib.parse.quote_plus(settings.REDIS_PASSWORD) if settings.REDIS_PASSWORD else None
                redis_protocol = "rediss" if "upstash" in settings.REDIS_HOST.lower() else "redis"
                is_rediss = redis_protocol == "rediss"
                redis_url = f"{redis_protocol}://:{encoded_redis_pass}@{settings.REDIS_HOST}:{settings.REDIS_PORT}" if encoded_redis_pass else f"{redis_protocol}://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
            
            kwargs = {
                "socket_connect_timeout": 10,
                "socket_timeout": 10,
                "retry_on_timeout": True,
            }
            if is_rediss:
                kwargs["ssl_cert_reqs"] = None

            self.redis = await aioredis.from_url(redis_url, **kwargs)
            await self.redis.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis = None

        logger.info("Initializing Qdrant...")
        if QDRANT_IMPORT_ERROR is not None:
            logger.warning(f"Qdrant unavailable: {QDRANT_IMPORT_ERROR}")
            self.qdrant_client = None
        else:
            try:
                self.qdrant_client = AsyncQdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=30.0,
                )
                
                # Check if collection exists, create if not
                collection_name = "copsight_embeddings"
                try:
                    collection_info = await self.qdrant_client.get_collection(collection_name)
                    logger.info(f"Qdrant connected, collection exists with {collection_info.points_count} points")
                except Exception as e:
                    # If it fails, assume it doesn't exist (Qdrant raises UnexpectedResponse)
                    logger.info("Creating Qdrant collection...")
                    await self.qdrant_client.create_collection(
                        collection_name=collection_name,
                        vectors_config=VectorParams(size=settings.EMBEDDING_DIM, distance=Distance.COSINE),
                    )
                    logger.info("Qdrant collection created")
            except Exception as e:
                logger.error(f"Qdrant initialization failed: {e}")
                self.qdrant_client = None

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
                statement_cache_size=0,
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
        if self.qdrant_client:
            await self.qdrant_client.close()
            logger.info("Qdrant client closed")

    async def check_health(self):
        """Check health of all connections."""
        health = {
            "postgres": False,
            "elasticsearch": False,
            "neo4j": False,
            "redis": False,
            "qdrant": False,
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

        if self.qdrant_client:
            try:
                await self.qdrant_client.get_collection("copsight_embeddings")
                health["qdrant"] = True
            except Exception:
                pass

        return health


db_manager = DatabaseManager()
