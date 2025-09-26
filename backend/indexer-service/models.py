from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class StandardizedMessage(BaseModel):
    source_device: str
    app_name: str
    sender_id: str
    receiver_id: str
    timestamp: datetime
    content: str
    message_type: str = "text"
    metadata: Dict[str, Any] = {}

class StandardizedCall(BaseModel):
    source_device: str
    caller_id: str
    receiver_id: str
    timestamp: datetime
    duration: Optional[int] = None
    call_type: str = "outgoing"
    metadata: Dict[str, Any] = {}

class StandardizedContact(BaseModel):
    source_device: str
    contact_id: str
    name: Optional[str] = None
    phone_numbers: List[str] = []
    email_addresses: List[str] = []
    metadata: Dict[str, Any] = {}

class ParsedData(BaseModel):
    device_info: Dict[str, Any]
    messages: List[StandardizedMessage] = []
    calls: List[StandardizedCall] = []
    contacts: List[StandardizedContact] = []
    total_records: int = 0
    parsing_metadata: Dict[str, Any] = {}

class IndexingRequest(BaseModel):
    job_id: str
    data: ParsedData

class IndexingResponse(BaseModel):
    job_id: str
    status: str
    message_count: int
    call_count: int
    contact_count: int
    total_indexed: int
    indexed_at: datetime
