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
    from app.services.parser_worker import parse_and_route_data
    
    success_count = 0
    for record in records:
        try:
            # record contains: source_type, content, metadata, entities
            await parse_and_route_data(case_id, "text", record)
            success_count += 1
        except Exception as e:
            logger.error(f"Error processing a record in batch for case {case_id}: {e}")
            # Continue processing the rest of the batch even if one record fails
            
    logger.info(f"Successfully processed {success_count}/{len(records)} records for case {case_id}")

class WorkerSettings:
    functions = [process_ingestion_payload, process_ingestion_batch]
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST, 
        port=settings.REDIS_PORT,
        conn_timeout=15
    )
    on_startup = startup
    on_shutdown = shutdown
    job_timeout = 3600  # 1 hour max for heavy AI parsing
