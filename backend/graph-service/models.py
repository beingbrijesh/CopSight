from pydantic import BaseModel
from typing import List, Dict, Any, Optional
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

class AnalysisRequest(BaseModel):
    job_id: str
    data: ParsedData

class GraphData(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

class NetworkAnalysis(BaseModel):
    node_id: str
    centrality_measures: Dict[str, float]
    network_size: int
    node_degree: int

class PathAnalysis(BaseModel):
    start_node: str
    end_node: str
    path_length: int
    nodes: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
