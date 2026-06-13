"""
Parser Worker logic to coordinate ingestion and routing.
"""
from typing import Dict, Any
from loguru import logger
from app.services.llm import llm_service
from app.services.graph_mapper import graph_mapper
from app.services.rag import rag_pipeline
from app.services.embeddings import SemanticChunker

semantic_chunker = SemanticChunker()

import re

# High-risk keywords for heuristic filtering to save LLM costs
SUSPICIOUS_KEYWORDS_PATTERN = re.compile(
    r'\b(bomb|kill|murder|drugs|cocaine|weed|weapon|gun|money|transfer|bank|crypto|bitcoin|usdt|terror|attack|bribe|smuggle|kidnap)\b', 
    re.IGNORECASE
)

async def parse_payload(case_id: int, payload_type: str, data: dict):
    """
    Extracts entities and evaluates threats without directly ingesting into the DB.
    Returns: {"parsed_data": {...}, "data_sources": [...]}
    """
    if payload_type == "media":
        from app.services.vision_factory import vision_factory
        from app.services.storage import storage_service
        
        file_path = await storage_service.save_media(case_id, data["filename"], data["file_bytes"])
        provider = vision_factory.get_provider()
        faces = await provider.describe_and_embed_faces(file_path)
        data_sources = [{"data": [{"content": face["description"]}], "sourceType": "media", "file_name": data["filename"]} for face in faces]
        return {"parsed_data": {"entities": [], "relationships": []}, "data_sources": data_sources}
        
    elif payload_type == "text":
        raw_text = data.get("content") or data.get("message") or data.get("text") or data.get("body") or ""
        node_entities = data.get("entities", [])
        
        entities = []
        relationships = []
        
        for e in node_entities:
            e_type = e.get("entityType", e.get("type", "Unknown"))
            e_val = e.get("entityValue", e.get("value", ""))
            if e_type == "phone_number": e_type = "PhoneNumber"
            elif e_type in ["person", "contact"]: e_type = "Person"
            elif e_type == "bank_account": e_type = "BankAccount"
            elif e_type == "aadhaar": e_type = "Aadhaar"
            entities.append({"type": e_type, "value": e_val})
            
        metadata = data.get("metadata", {})
        if metadata.get("phoneNumber"):
            entities.append({"type": "PhoneNumber", "value": metadata["phoneNumber"]})
            
        # 0. Evaluate Threat Semantics via LLM (with heuristic filter)
        threat_eval = {"is_suspect": False, "threat_score": 0}
        if raw_text and len(raw_text) > 10:
            if SUSPICIOUS_KEYWORDS_PATTERN.search(raw_text):
                threat_eval = await llm_service.evaluate_threat(raw_text)
            else:
                # Fast path: skip LLM API call if no suspicious keywords
                threat_eval = {"is_suspect": False, "threat_score": 0}
            
        if threat_eval.get("is_suspect") or threat_eval.get("threat_score", 0) >= 50:
            for ent in entities:
                ent["isSuspect"] = True
                ent["threatScore"] = threat_eval.get("threat_score", 0)
                ent["threatReason"] = threat_eval.get("reasoning", "")
            
        for i in range(len(entities)):
            for j in range(i + 1, len(entities)):
                if entities[i]["value"] != entities[j]["value"]:
                    relationships.append({
                        "source": entities[i]["value"],
                        "target": entities[j]["value"],
                        "target_type": entities[j]["type"],
                        "type": "ASSOCIATED_WITH",
                        "timestamp": metadata.get("timestamp", "")
                    })
            
        parsed_data = {"entities": entities, "relationships": relationships}
        
        chunks = semantic_chunker.chunk_text(raw_text)
        data_sources = [{"data": [{"content": chunk}], "sourceType": data.get("source_type", "text")} for chunk in chunks]
        
        return {"parsed_data": parsed_data, "data_sources": data_sources}
    
    return {"parsed_data": {"entities": [], "relationships": []}, "data_sources": []}

async def parse_and_route_data(case_id: int, payload_type: str, data: dict):
    """
    Main orchestration function for asynchronous parsing.
    Called by ARQ worker for single payloads.
    """
    logger.info(f"Parsing payload type {payload_type} for case {case_id}")
    result = await parse_payload(case_id, payload_type, data)
    
    if result["parsed_data"]["entities"] or result["parsed_data"]["relationships"]:
        await graph_mapper.ingest_entities_and_relationships(case_id, result["parsed_data"])
        
    if result["data_sources"]:
        await rag_pipeline.index_case_data(case_id, result["data_sources"], result["parsed_data"]["entities"])
        
    logger.info(f"Finished parsing and routing for case {case_id}")
