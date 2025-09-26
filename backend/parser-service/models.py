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
    message_type: str = "text"  # text, image, video, audio, file
    metadata: Dict[str, Any] = {}

class StandardizedCall(BaseModel):
    source_device: str
    caller_id: str
    receiver_id: str
    timestamp: datetime
    duration: Optional[int] = None  # in seconds
    call_type: str = "outgoing"  # outgoing, incoming, missed
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

class ParsingJob(BaseModel):
    job_id: str
    filename: str
    file_path: str
    case_id: Optional[str] = None
    device_id: Optional[str] = None
    status: str = "queued"  # queued, parsing, completed, failed
    progress: int = 0
    total_records: int = 0
    error_message: Optional[str] = None
    parsed_data: Optional[ParsedData] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
