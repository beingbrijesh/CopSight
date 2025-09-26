from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import xml.etree.ElementTree as ET
import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any
import httpx
import aiofiles
from pathlib import Path

from parsers.cellebrite_parser import CellebriteParser
from parsers.ufdr_parser import UFDRParser
from models import ParsedData, StandardizedMessage, ParsingJob
from config import settings

app = FastAPI(title="UFDR Parser Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Store active parsing jobs
active_jobs: Dict[str, ParsingJob] = {}

@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    case_id: str = None,
    device_id: str = None
):
    """Upload and parse a UFDR file"""
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Save uploaded file
    file_path = UPLOAD_DIR / f"{job_id}_{file.filename}"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Create parsing job
    job = ParsingJob(
        job_id=job_id,
        filename=file.filename,
        file_path=str(file_path),
        case_id=case_id,
        device_id=device_id,
        status="queued",
        created_at=datetime.utcnow()
    )
    
    active_jobs[job_id] = job
    
    # Start parsing in background
    background_tasks.add_task(parse_file_background, job_id)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "File uploaded successfully. Parsing started in background."
    }

async def parse_file_background(job_id: str):
    """Background task to parse uploaded file"""
    job = active_jobs.get(job_id)
    if not job:
        return
    
    try:
        job.status = "parsing"
        job.started_at = datetime.utcnow()
        
        # Determine file type and select appropriate parser
        file_extension = Path(job.filename).suffix.lower()
        
        if file_extension in ['.xml', '.ufdr']:
            if 'cellebrite' in job.filename.lower():
                parser = CellebriteParser()
            else:
                parser = UFDRParser()
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        # Parse the file
        parsed_data = await parser.parse_file(job.file_path)
        
        job.parsed_data = parsed_data
        job.total_records = len(parsed_data.messages)
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        
        # Send parsed data to indexer service
        await send_to_indexer(job_id, parsed_data)
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()

async def send_to_indexer(job_id: str, parsed_data: ParsedData):
    """Send parsed data to indexer service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.INDEXER_SERVICE_URL}/index",
                json={
                    "job_id": job_id,
                    "data": parsed_data.dict()
                }
            )
            response.raise_for_status()
    except Exception as e:
        print(f"Failed to send data to indexer: {e}")

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get parsing job status"""
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job.job_id,
        "filename": job.filename,
        "status": job.status,
        "progress": job.progress,
        "total_records": job.total_records,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at
    }

@app.get("/jobs")
async def list_jobs():
    """List all parsing jobs"""
    return [
        {
            "job_id": job.job_id,
            "filename": job.filename,
            "status": job.status,
            "created_at": job.created_at
        }
        for job in active_jobs.values()
    ]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "parser"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
