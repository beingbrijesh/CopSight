from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from elasticsearch import Elasticsearch
from sqlalchemy.orm import Session
import httpx
from datetime import datetime
from typing import Dict, Any

from database import get_db, engine, Base
from elasticsearch_client import ElasticsearchClient
from models import IndexingRequest, IndexingResponse
from config import settings

app = FastAPI(title="UFDR Indexer Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Elasticsearch client
es_client = ElasticsearchClient(settings.ELASTICSEARCH_URL)

# Create database tables
Base.metadata.create_all(bind=engine)

@app.post("/index", response_model=IndexingResponse)
async def index_data(request: IndexingRequest, db: Session = get_db()):
    """Index parsed data into Elasticsearch and PostgreSQL"""
    
    try:
        job_id = request.job_id
        data = request.data
        
        # Index messages in Elasticsearch
        message_count = 0
        for message in data.messages:
            doc = {
                "job_id": job_id,
                "source_device": message.source_device,
                "app_name": message.app_name,
                "sender_id": message.sender_id,
                "receiver_id": message.receiver_id,
                "timestamp": message.timestamp.isoformat(),
                "content": message.content,
                "message_type": message.message_type,
                "metadata": message.metadata,
                "indexed_at": datetime.utcnow().isoformat()
            }
            
            await es_client.index_message(doc)
            message_count += 1
        
        # Index calls in Elasticsearch
        call_count = 0
        for call in data.calls:
            doc = {
                "job_id": job_id,
                "source_device": call.source_device,
                "caller_id": call.caller_id,
                "receiver_id": call.receiver_id,
                "timestamp": call.timestamp.isoformat(),
                "duration": call.duration,
                "call_type": call.call_type,
                "metadata": call.metadata,
                "indexed_at": datetime.utcnow().isoformat()
            }
            
            await es_client.index_call(doc)
            call_count += 1
        
        # Index contacts in Elasticsearch
        contact_count = 0
        for contact in data.contacts:
            doc = {
                "job_id": job_id,
                "source_device": contact.source_device,
                "contact_id": contact.contact_id,
                "name": contact.name,
                "phone_numbers": contact.phone_numbers,
                "email_addresses": contact.email_addresses,
                "metadata": contact.metadata,
                "indexed_at": datetime.utcnow().isoformat()
            }
            
            await es_client.index_contact(doc)
            contact_count += 1
        
        # Send relationship data to graph service
        await send_to_graph_service(job_id, data)
        
        return IndexingResponse(
            job_id=job_id,
            status="completed",
            message_count=message_count,
            call_count=call_count,
            contact_count=contact_count,
            total_indexed=message_count + call_count + contact_count,
            indexed_at=datetime.utcnow()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

async def send_to_graph_service(job_id: str, data: Any):
    """Send data to graph service for relationship analysis"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.GRAPH_SERVICE_URL}/analyze",
                json={
                    "job_id": job_id,
                    "data": data.dict()
                }
            )
            response.raise_for_status()
    except Exception as e:
        print(f"Failed to send data to graph service: {e}")

@app.get("/search/messages")
async def search_messages(
    query: str,
    size: int = 10,
    from_: int = 0,
    app_name: str = None,
    date_from: str = None,
    date_to: str = None
):
    """Search messages in Elasticsearch"""
    try:
        results = await es_client.search_messages(
            query=query,
            size=size,
            from_=from_,
            app_name=app_name,
            date_from=date_from,
            date_to=date_to
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/search/calls")
async def search_calls(
    phone_number: str = None,
    call_type: str = None,
    date_from: str = None,
    date_to: str = None,
    size: int = 10,
    from_: int = 0
):
    """Search calls in Elasticsearch"""
    try:
        results = await es_client.search_calls(
            phone_number=phone_number,
            call_type=call_type,
            date_from=date_from,
            date_to=date_to,
            size=size,
            from_=from_
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/search/contacts")
async def search_contacts(
    query: str,
    size: int = 10,
    from_: int = 0
):
    """Search contacts in Elasticsearch"""
    try:
        results = await es_client.search_contacts(
            query=query,
            size=size,
            from_=from_
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Elasticsearch connection
        es_health = await es_client.health_check()
        return {
            "status": "healthy",
            "elasticsearch": es_health,
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
