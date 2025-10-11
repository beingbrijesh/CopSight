"""
Analysis router - handles pattern detection and suspicious activity analysis
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from loguru import logger

from app.services.database import db_manager

router = APIRouter()


class AnalysisRequest(BaseModel):
    """Analysis request model"""
    case_id: int
    analysis_type: str  # "patterns", "suspicious", "network", "timeline"


@router.post("/detect-patterns")
async def detect_patterns(request: AnalysisRequest):
    """Detect patterns in case data"""
    try:
        if request.analysis_type == "suspicious":
            return await detect_suspicious_activity(request.case_id)
        elif request.analysis_type == "network":
            return await analyze_communication_network(request.case_id)
        elif request.analysis_type == "timeline":
            return await generate_timeline(request.case_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid analysis type")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pattern detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def detect_suspicious_activity(case_id: int) -> Dict[str, Any]:
    """Detect suspicious patterns in communications"""
    
    suspicious_patterns = []
    
    # Check for foreign numbers with high frequency
    if db_manager.neo4j:
        try:
            async with db_manager.neo4j.session() as session:
                result = await session.run("""
                    MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(d:Device)
                    MATCH (d)-[r:COMMUNICATED_WITH]->(p:PhoneNumber)
                    WHERE p.isForeign = true
                    RETURN p.number as number, count(r) as frequency
                    ORDER BY frequency DESC
                    LIMIT 10
                """, caseId=case_id)
                
                foreign_numbers = await result.data()
                
                if foreign_numbers:
                    suspicious_patterns.append({
                        "type": "foreign_communications",
                        "severity": "high",
                        "description": f"Found {len(foreign_numbers)} foreign numbers with frequent communication",
                        "details": foreign_numbers
                    })
        except Exception as e:
            logger.error(f"Neo4j query failed: {e}")
    
    # Check for crypto addresses
    if db_manager.elasticsearch:
        try:
            result = await db_manager.elasticsearch.search(
                index="ufdr-*",
                body={
                    "query": {
                        "bool": {
                            "must": [
                                {"term": {"caseId": case_id}},
                                {"exists": {"field": "entities.type"}},
                                {"term": {"entities.type": "crypto_address"}}
                            ]
                        }
                    },
                    "size": 10
                }
            )
            
            if result["hits"]["total"]["value"] > 0:
                suspicious_patterns.append({
                    "type": "crypto_addresses",
                    "severity": "critical",
                    "description": f"Found {result['hits']['total']['value']} messages mentioning crypto addresses",
                    "details": [hit["_source"] for hit in result["hits"]["hits"]]
                })
        except Exception as e:
            logger.error(f"Elasticsearch query failed: {e}")
    
    # Check for late-night communications
    if db_manager.postgres:
        try:
            async with db_manager.postgres.acquire() as conn:
                late_night = await conn.fetch("""
                    SELECT COUNT(*) as count
                    FROM data_sources ds
                    JOIN devices d ON ds.device_id = d.id
                    WHERE d.case_id = $1
                    AND EXTRACT(HOUR FROM ds.created_at) BETWEEN 0 AND 5
                """, case_id)
                
                if late_night and late_night[0]['count'] > 10:
                    suspicious_patterns.append({
                        "type": "unusual_timing",
                        "severity": "medium",
                        "description": f"Found {late_night[0]['count']} communications during late night hours (12 AM - 5 AM)",
                        "details": {"count": late_night[0]['count']}
                    })
        except Exception as e:
            logger.error(f"Postgres query failed: {e}")
    
    return {
        "case_id": case_id,
        "analysis_type": "suspicious_activity",
        "patterns_found": len(suspicious_patterns),
        "patterns": suspicious_patterns
    }


async def analyze_communication_network(case_id: int) -> Dict[str, Any]:
    """Analyze communication network for the case"""
    
    network_data = {
        "nodes": [],
        "edges": [],
        "statistics": {}
    }
    
    if db_manager.neo4j:
        try:
            async with db_manager.neo4j.session() as session:
                # Get all nodes and relationships
                result = await session.run("""
                    MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(d:Device)
                    MATCH (d)-[r:COMMUNICATED_WITH]->(p:PhoneNumber)
                    RETURN d, r, p
                    LIMIT 100
                """, caseId=case_id)
                
                records = await result.data()
                
                # Build network graph
                seen_nodes = set()
                
                for record in records:
                    device = record['d']
                    phone = record['p']
                    rel = record['r']
                    
                    # Add device node
                    if device['imei'] not in seen_nodes:
                        network_data['nodes'].append({
                            "id": device['imei'],
                            "type": "device",
                            "label": device.get('name', 'Unknown Device')
                        })
                        seen_nodes.add(device['imei'])
                    
                    # Add phone node
                    if phone['number'] not in seen_nodes:
                        network_data['nodes'].append({
                            "id": phone['number'],
                            "type": "phone",
                            "label": phone['number'],
                            "isForeign": phone.get('isForeign', False)
                        })
                        seen_nodes.add(phone['number'])
                    
                    # Add edge
                    network_data['edges'].append({
                        "source": device['imei'],
                        "target": phone['number'],
                        "type": rel.type,
                        "weight": 1
                    })
                
                # Calculate statistics
                network_data['statistics'] = {
                    "total_nodes": len(network_data['nodes']),
                    "total_edges": len(network_data['edges']),
                    "device_count": len([n for n in network_data['nodes'] if n['type'] == 'device']),
                    "phone_count": len([n for n in network_data['nodes'] if n['type'] == 'phone']),
                    "foreign_numbers": len([n for n in network_data['nodes'] if n.get('isForeign')])
                }
                
        except Exception as e:
            logger.error(f"Network analysis failed: {e}")
    
    return {
        "case_id": case_id,
        "analysis_type": "communication_network",
        "network": network_data
    }


async def generate_timeline(case_id: int) -> Dict[str, Any]:
    """Generate timeline of events for the case"""
    
    timeline = []
    
    if db_manager.elasticsearch:
        try:
            result = await db_manager.elasticsearch.search(
                index="ufdr-*",
                body={
                    "query": {"term": {"caseId": case_id}},
                    "size": 100,
                    "sort": [{"timestamp": "asc"}]
                }
            )
            
            for hit in result["hits"]["hits"]:
                source = hit["_source"]
                timeline.append({
                    "timestamp": source.get("timestamp"),
                    "type": source.get("sourceType"),
                    "content": source.get("content", "")[:100],
                    "phoneNumber": source.get("phoneNumber"),
                    "metadata": source
                })
                
        except Exception as e:
            logger.error(f"Timeline generation failed: {e}")
    
    return {
        "case_id": case_id,
        "analysis_type": "timeline",
        "events": timeline,
        "total_events": len(timeline)
    }


@router.get("/summary/{case_id}")
async def get_case_summary(case_id: int):
    """Get comprehensive case summary"""
    try:
        summary = {
            "case_id": case_id,
            "devices": 0,
            "total_communications": 0,
            "unique_contacts": 0,
            "date_range": {},
            "source_breakdown": {}
        }
        
        # Get device count
        if db_manager.postgres:
            async with db_manager.postgres.acquire() as conn:
                devices = await conn.fetchval(
                    "SELECT COUNT(*) FROM devices WHERE case_id = $1",
                    case_id
                )
                summary["devices"] = devices
        
        # Get communication stats from Elasticsearch
        if db_manager.elasticsearch:
            result = await db_manager.elasticsearch.search(
                index="ufdr-*",
                body={
                    "query": {"term": {"caseId": case_id}},
                    "size": 0,
                    "aggs": {
                        "source_types": {
                            "terms": {"field": "sourceType"}
                        },
                        "date_range": {
                            "stats": {"field": "timestamp"}
                        }
                    }
                }
            )
            
            summary["total_communications"] = result["hits"]["total"]["value"]
            
            if "aggregations" in result:
                summary["source_breakdown"] = {
                    bucket["key"]: bucket["doc_count"]
                    for bucket in result["aggregations"]["source_types"]["buckets"]
                }
        
        return summary
        
    except Exception as e:
        logger.error(f"Case summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
