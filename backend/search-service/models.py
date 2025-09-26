from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class SearchRequest(BaseModel):
    query: str
    filters: Optional[Dict[str, Any]] = None
    top_k: int = 10
    include_context: bool = True

class SearchResponse(BaseModel):
    query: str
    answer: str
    sources: List[Dict[str, Any]]
    confidence_score: float
    total_results: int
    processing_time: float

class EmbeddingRequest(BaseModel):
    texts: List[str]

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    total_tokens: int
