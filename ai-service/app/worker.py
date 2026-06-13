"""
ARQ Worker configuration for async event-driven processing
"""
import os
from arq.connections import RedisSettings
from loguru import logger
from app.config import settings
from app.services.database import db_manager

async def startup(ctx):
    logger.info("Starting ARQ Worker...")
    await db_manager.connect()
    ctx['db_manager'] = db_manager

async def shutdown(ctx):
    logger.info("Shutting down ARQ Worker...")
    await db_manager.disconnect()

async def process_ingestion_payload(ctx, case_id: int, payload_type: str, data: dict):
    """
    Background task to process ingested data from forensixd
    """
    logger.info(f"Processing {payload_type} payload for case {case_id}")
    # Import here to avoid circular imports during worker startup
    from app.services.parser_worker import parse_and_route_data
    
    try:
        await parse_and_route_data(case_id, payload_type, data)
        logger.info(f"Successfully processed {payload_type} for case {case_id}")
    except Exception as e:
        logger.error(f"Error processing payload for case {case_id}: {e}")
        raise

async def process_ingestion_batch(ctx, case_id: int, records: list):
    """
    Background task to process a batch of ingested data from forensixd
    """
    logger.info(f"Processing batch of {len(records)} records for case {case_id}")
    from app.services.parser_worker import parse_payload
    from app.services.graph_mapper import graph_mapper
    from app.services.rag import rag_pipeline
    
    success_count = 0
    all_entities = []
    all_relationships = []
    all_data_sources = []
    
    for record in records:
        try:
            result = await parse_payload(case_id, "text", record)
            all_entities.extend(result["parsed_data"]["entities"])
            all_relationships.extend(result["parsed_data"]["relationships"])
            all_data_sources.extend(result["data_sources"])
            success_count += 1
        except Exception as e:
            logger.error(f"Error parsing a record in batch for case {case_id}: {e}")
            
    # Bulk Graph mapping
    if all_entities or all_relationships:
        try:
            await graph_mapper.ingest_entities_and_relationships(case_id, {
                "entities": all_entities,
                "relationships": all_relationships
            })
        except Exception as e:
            logger.error(f"Error bulk mapping graph for case {case_id}: {e}")
            
    # Bulk RAG indexing
    if all_data_sources:
        try:
            await rag_pipeline.index_case_data(case_id, all_data_sources, all_entities)
        except Exception as e:
            logger.error(f"Error bulk indexing RAG for case {case_id}: {e}")
            
    logger.info(f"Successfully processed {success_count}/{len(records)} records for case {case_id} in bulk")

class WorkerSettings:
    functions = [process_ingestion_payload, process_ingestion_batch]
    
    if settings.REDIS_URL:
        redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
        redis_settings.conn_timeout = 15
    else:
        redis_settings = RedisSettings(
            host=settings.REDIS_HOST, 
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            ssl="upstash" in settings.REDIS_HOST.lower(),
            conn_timeout=15
        )
    on_startup = startup
    on_shutdown = shutdown
    job_timeout = 3600  # 1 hour max for heavy AI parsing
