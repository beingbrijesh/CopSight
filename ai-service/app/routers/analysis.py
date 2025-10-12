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


@router.post("/detect-anomalies")
async def detect_anomalies(request: AnalysisRequest):
    """Detect anomalies in case data using ML algorithms"""
    try:
        from app.services.anomaly_detector import anomaly_detector
        
        # Get case data for analysis
        case_data = await get_case_data_for_analysis(request.case_id)
        
        # Run anomaly detection
        anomalies = anomaly_detector.detect_all_anomalies(case_data)
        
        return {
            "case_id": request.case_id,
            "anomalies_detected": anomalies,
            "timestamp": "2024-01-01T00:00:00Z"  # Would be dynamic in real implementation
        }
            
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_case_data_for_analysis(case_id: int) -> Dict[str, Any]:
    """Get case data formatted for anomaly detection"""
    try:
        case_data = {
            "communications": [],
            "temporal_data": [],
            "network_data": []
        }
        
        # Get communication data from Elasticsearch
        if db_manager.elasticsearch:
            try:
                result = await db_manager.elasticsearch.search(
                    index="ufdr-*",
                    body={
                        "query": {"term": {"caseId": case_id}},
                        "size": 1000,
                        "_source": ["phoneNumber", "timestamp", "duration", "sourceType"]
                    }
                )
                
                for hit in result["hits"]["hits"]:
                    source = hit["_source"]
                    case_data["communications"].append({
                        "phone_number": source.get("phoneNumber", ""),
                        "timestamp": source.get("timestamp", ""),
                        "duration": source.get("duration", 0),
                        "source_type": source.get("sourceType", ""),
                        "frequency": 1  # Would be aggregated in real implementation
                    })
                    
                    case_data["temporal_data"].append({
                        "timestamp": source.get("timestamp", ""),
                        "type": source.get("sourceType", "")
                    })
                    
            except Exception as e:
                logger.warning(f"Could not get communication data: {e}")
        
        # Get network data from Neo4j
        if db_manager.neo4j:
            try:
                async with db_manager.neo4j.session() as session:
                    result = await session.run(
                        """
                        MATCH (c:Case {id: $caseId})-[:HAS_DEVICE]->(:Device)-[r:COMMUNICATED_WITH]->(p:PhoneNumber)
                        RETURN p.number as phone_number, 
                               count(r) as communication_frequency,
                               size(collect(DISTINCT p)) as unique_contacts
                        """,
                        {"caseId": str(case_id)}
                    )
                    
                    for record in result:
                        case_data["network_data"].append({
                            "phone_number": record["phone_number"],
                            "communication_frequency": record["communication_frequency"].toNumber(),
                            "unique_contacts": record["unique_contacts"].toNumber(),
                            "degree_centrality": 0,  # Would be calculated in real implementation
                            "betweenness_centrality": 0
                        })
                        
            except Exception as e:
                logger.warning(f"Could not get network data: {e}")
        
        return case_data
        
    except Exception as e:
        logger.error(f"Error getting case data for analysis: {e}")
        return {
            "communications": [],
            "temporal_data": [],
            "network_data": []
        }


@router.post("/predictive-analysis")
async def predictive_analysis(request: AnalysisRequest):
    """Run predictive analytics on case data"""
    try:
        from app.services.predictive_analytics import predictive_service
        
        # Get case data and historical patterns
        case_data = await get_case_predictive_data(request.case_id)
        historical_patterns = await get_similar_historical_cases(request.case_id)
        
        # Run risk prediction
        risk_prediction = predictive_service.predict_case_risk(case_data)
        
        # Generate investigation leads
        investigation_leads = predictive_service.generate_investigation_leads(case_data, historical_patterns)
        
        return {
            "case_id": request.case_id,
            "risk_prediction": risk_prediction,
            "investigation_leads": investigation_leads,
            "lead_count": len(investigation_leads),
            "timestamp": "2024-01-01T00:00:00Z"
        }
            
    except Exception as e:
        logger.error(f"Predictive analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train-predictive-model")
async def train_predictive_model():
    """Train predictive models using historical case data"""
    try:
        from app.services.predictive_analytics import predictive_service
        
        # Get historical case data for training
        historical_cases = await get_historical_case_data()
        
        # Train risk prediction model
        training_result = predictive_service.train_risk_prediction_model(historical_cases)
        
        return {
            "training_result": training_result,
            "training_timestamp": "2024-01-01T00:00:00Z"
        }
            
    except Exception as e:
        logger.error(f"Model training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_case_predictive_data(case_id: int) -> Dict[str, Any]:
    """Get case data formatted for predictive analysis"""
    try:
        case_data = {
            "case_id": case_id,
            "evidence_count": 0,
            "communication_count": 0,
            "unique_contacts": 0,
            "foreign_numbers_ratio": 0.0,
            "late_night_activity": 0,
            "cross_case_links": 0,
            "anomaly_count": 0,
            "priority": "medium",
            "has_critical_evidence": False
        }
        
        # Get case metadata from database
        if db_manager.postgres:
            try:
                async with db_manager.postgres.acquire() as conn:
                    # Get case basic info
                    case_info = await conn.fetchrow(
                        "SELECT priority, created_at FROM cases WHERE id = $1",
                        case_id
                    )
                    if case_info:
                        case_data["priority"] = case_info["priority"] or "medium"
                        case_data["created_at"] = case_info["created_at"].isoformat()
                    
                    # Get evidence count
                    evidence_count = await conn.fetchval(
                        "SELECT COUNT(*) FROM entity_tags WHERE case_id = $1",
                        case_id
                    )
                    case_data["evidence_count"] = evidence_count or 0
                    
                    # Get communication count from Elasticsearch
                    if db_manager.elasticsearch:
                        try:
                            result = await db_manager.elasticsearch.count(
                                index="ufdr-*",
                                body={"query": {"term": {"caseId": case_id}}}
                            )
                            case_data["communication_count"] = result["count"]
                        except:
                            pass
                    
                    # Get cross-case links count
                    cross_links = await conn.fetchval(
                        "SELECT COUNT(*) FROM cross_case_links WHERE source_case_id = $1 OR target_case_id = $1",
                        case_id
                    )
                    case_data["cross_case_links"] = cross_links or 0
                    
                    # Get alerts count (as anomaly proxy)
                    alerts_count = await conn.fetchval(
                        "SELECT COUNT(*) FROM alerts WHERE case_id = $1",
                        case_id
                    )
                    case_data["anomaly_count"] = alerts_count or 0
                    
            except Exception as e:
                logger.warning(f"Could not get case predictive data: {e}")
        
        return case_data
        
    except Exception as e:
        logger.error(f"Error getting case predictive data: {e}")
        return {}


async def get_similar_historical_cases(case_id: int) -> List[Dict[str, Any]]:
    """Get similar historical cases for comparison"""
    try:
        historical_cases = []
        
        if db_manager.postgres:
            async with db_manager.postgres.acquire() as conn:
                # Get some historical cases (simplified - would need better similarity logic)
                cases = await conn.fetch(
                    """
                    SELECT id, case_number, priority, created_at
                    FROM cases 
                    WHERE id != $1 AND status = 'closed'
                    ORDER BY created_at DESC
                    LIMIT 20
                    """,
                    case_id
                )
                
                for case in cases:
                    historical_cases.append({
                        "id": case["id"],
                        "case_number": case["case_number"],
                        "priority": case["priority"],
                        "outcome": "completed",  # Would need actual outcomes
                        "communication_count": 50,  # Mock data
                        "unique_contacts": 10,
                        "foreign_numbers_ratio": 0.1,
                        "key_insights": ["Mock insight 1", "Mock insight 2"]
                    })
        
        return historical_cases
        
    except Exception as e:
        logger.error(f"Error getting historical cases: {e}")
        return []


async def get_historical_case_data() -> List[Dict[str, Any]]:
    """Get historical case data for model training"""
    try:
        # Return mock historical data for training
        # In production, this would fetch real case outcomes and features
        return [
            {
                "id": 1,
                "outcome": "conviction",
                "evidence_count": 150,
                "communication_count": 200,
                "unique_contacts": 25,
                "foreign_numbers_ratio": 0.3,
                "late_night_activity": 8,
                "priority": "high",
                "has_critical_evidence": True,
                "cross_case_links": 3,
                "anomaly_count": 5
            },
            # Add more mock cases for training...
            {
                "id": 2,
                "outcome": "investigation_ongoing",
                "evidence_count": 75,
                "communication_count": 100,
                "unique_contacts": 15,
                "foreign_numbers_ratio": 0.1,
                "late_night_activity": 3,
                "priority": "medium",
                "has_critical_evidence": False,
                "cross_case_links": 1,
                "anomaly_count": 2
            }
        ]
        
    except Exception as e:
        logger.error(f"Error getting historical case data: {e}")
        return []
