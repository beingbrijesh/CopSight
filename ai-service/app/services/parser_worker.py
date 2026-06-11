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

async def parse_and_route_data(case_id: int, payload_type: str, data: dict):
    """
    Main orchestration function for asynchronous parsing.
    Called by ARQ worker.
    """
    logger.info(f"Parsing payload type {payload_type} for case {case_id}")
    
    if payload_type == "media":
        from app.services.vision_factory import vision_factory
        from app.services.storage import storage_service
        
        # Save media
        file_path = await storage_service.save_media(case_id, data["filename"], data["file_bytes"])
        
        # Vision Parsing & Embedding
        provider = vision_factory.get_provider()
        faces = await provider.describe_and_embed_faces(file_path)
        
        # Add faces to ChromaDB via existing pipeline
        # Simulated format for RAG indexing
        data_sources = [{"data": [{"content": face["description"]}], "sourceType": "media", "file_name": data["filename"]} for face in faces]
        await rag_pipeline.index_case_data(case_id, data_sources, [])
        
    elif payload_type == "text":
        # Map pre-extracted Node.js entities to GraphMapper schema
        raw_text = data.get("content", "")
        node_entities = data.get("entities", [])
        
        entities = []
        relationships = []
        
        for e in node_entities:
            # Node backend uses entityType and entityValue
            e_type = e.get("entityType", e.get("type", "Unknown"))
            e_val = e.get("entityValue", e.get("value", ""))
            
            if e_type == "phone_number":
                e_type = "PhoneNumber"
            elif e_type in ["person", "contact"]:
                e_type = "Person"
            elif e_type == "bank_account":
                e_type = "BankAccount"
            elif e_type == "aadhaar":
                e_type = "Aadhaar"
                
            entities.append({"type": e_type, "value": e_val})
            
        # Extract metadata phone numbers as entities if they exist
        metadata = data.get("metadata", {})
        if metadata.get("phoneNumber"):
            entities.append({"type": "PhoneNumber", "value": metadata["phoneNumber"]})
            
        # Create relationships between entities that co-occur in this payload
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
            
        parsed_data = {
            "entities": entities,
            "relationships": relationships
        }
        
        # 1. Store Graph Entities
        await graph_mapper.ingest_entities_and_relationships(case_id, parsed_data)
        
        # 2. Semantic Chunking and Vector Store
        chunks = semantic_chunker.chunk_text(raw_text)
        data_sources = [{"data": [{"content": chunk}], "sourceType": data.get("source_type", "text")} for chunk in chunks]
        
        await rag_pipeline.index_case_data(case_id, data_sources, parsed_data["entities"])
        
    logger.info(f"Finished parsing and routing for case {case_id}")
