"""
Analysis router - handles pattern detection and suspicious activity analysis
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import logging

try:
    from ..services.anomaly_detector import anomaly_detector
    from ..services.deep_learning_analyzer import deep_learning_analyzer
    from ..services.evidence_classifier import evidence_classifier
    from ..services.pattern_recognition import pattern_recognition_engine
    ANALYSIS_IMPORT_ERROR = None
except Exception as import_error:
    anomaly_detector = None
    deep_learning_analyzer = None
    evidence_classifier = None
    pattern_recognition_engine = None
    ANALYSIS_IMPORT_ERROR = import_error

logger = logging.getLogger(__name__)

router = APIRouter()


def ensure_analysis_dependencies() -> None:
    """Fail analysis endpoints gracefully when optional ML deps are unavailable."""
    if ANALYSIS_IMPORT_ERROR is not None:
        raise HTTPException(
            status_code=503,
            detail=f"Advanced analysis dependencies are unavailable: {ANALYSIS_IMPORT_ERROR}"
        )

# Pydantic models for request/response
class AnomalyDetectionRequest(BaseModel):
    case_id: str
    data_type: str = "all"
    algorithm: str = "hybrid"

class DeepLearningRequest(BaseModel):
    operation: str
    data: List[Dict[str, Any]]
    parameters: Optional[Dict[str, Any]] = None

class EvidenceClassificationRequest(BaseModel):
    evidence_list: List[Dict[str, Any]]
    algorithm: str = "ensemble"
    batch_size: int = 10

class PatternRecognitionRequest(BaseModel):
    data: List[Dict[str, Any]]
    pattern_types: Optional[List[str]] = None
    analysis_depth: str = "comprehensive"

class TrainingRequest(BaseModel):
    training_data: List[Dict[str, Any]]
    model_type: str
    parameters: Optional[Dict[str, Any]] = None
    
    class Config:
        protected_namespaces = ()

class AnalysisRequest(BaseModel):
    case_id: str

class CrossCaseAnalysisRequest(BaseModel):
    case_id: int
    target_case_id: int
    common_entity: str
    entity_type: str

@router.post("/anomalies")
async def detect_anomalies(request: AnomalyDetectionRequest):
    """Enhanced anomaly detection with multiple algorithms"""
    try:
        ensure_analysis_dependencies()
        # This endpoint now uses the enhanced anomaly detector
        # Implementation would query the appropriate data based on case_id and data_type

        # For now, return the detector capabilities
        capabilities = {
            "algorithms": ["isolation_forest", "temporal_analysis", "network_analysis", "deep_learning"],
            "data_types": ["communications", "temporal", "network", "behavioral"],
            "case_id": request.case_id,
            "status": "enhanced_anomaly_detection_available"
        }

        return {
            "success": True,
            "capabilities": capabilities
        }

    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deep-learning")
async def deep_learning_analysis(request: DeepLearningRequest, background_tasks: BackgroundTasks):
    """Advanced deep learning analysis endpoint"""
    try:
        ensure_analysis_dependencies()
        operation = request.operation
        data = request.data
        parameters = request.parameters or {}

        if operation == "classify_evidence":
            # Train and classify evidence
            if len(data) < 10:
                raise HTTPException(status_code=400, detail="Insufficient training data")

            # Run training in background
            background_tasks.add_task(
                deep_learning_analyzer.train_evidence_classifier,
                data
            )

            return {
                "success": True,
                "message": "Evidence classification training started",
                "status": "training_initiated"
            }

        elif operation == "detect_anomalies":
            # Deep learning anomaly detection
            anomalies = await deep_learning_analyzer.detect_anomalies_dl(data)

            return {
                "success": True,
                "anomalies_detected": len(anomalies),
                "anomalies": anomalies[:50]  # Limit response size
            }

        elif operation == "analyze_patterns":
            # Pattern analysis using CNN
            patterns = await deep_learning_analyzer.analyze_patterns(data)

            return {
                "success": True,
                "pattern_analysis": patterns
            }

        elif operation == "analyze_temporal":
            # Temporal sequence analysis
            sequences = parameters.get("sequences", [])
            if not sequences:
                # Group data into sequences
                sequences = [data[i:i+10] for i in range(0, len(data), 10)]

            temporal_analysis = await deep_learning_analyzer.analyze_temporal_sequences(sequences)

            return {
                "success": True,
                "temporal_analysis": temporal_analysis
            }

        elif operation == "model_status":
            # Get model status
            status = await deep_learning_analyzer.get_model_status()

            return {
                "success": True,
                "model_status": status
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {operation}")

    except Exception as e:
        logger.error(f"Deep learning analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evidence-classification")
async def classify_evidence(request: EvidenceClassificationRequest):
    """ML-based evidence classification endpoint"""
    try:
        ensure_analysis_dependencies()
        evidence_list = request.evidence_list
        algorithm = request.algorithm
        batch_size = min(request.batch_size, len(evidence_list))

        if len(evidence_list) == 0:
            raise HTTPException(status_code=400, detail="No evidence provided")

        # Check if classifier is trained
        stats = await evidence_classifier.get_classifier_stats()
        if algorithm not in stats["trained_classifiers"]:
            # Try to train with available data
            if len(evidence_list) >= 20:
                training_result = await evidence_classifier.train_classifier(
                    evidence_list[:int(len(evidence_list)*0.8)], algorithm
                )
                if not training_result["success"]:
                    raise HTTPException(status_code=400, detail="Failed to train classifier")

        # Perform classification
        if len(evidence_list) == 1:
            # Single classification
            result = await evidence_classifier.classify_evidence(evidence_list[0], algorithm)
        else:
            # Batch classification
            result = await evidence_classifier.batch_classify(
                evidence_list, algorithm
            )

        return {
            "success": True,
            "algorithm": algorithm,
            "results": result
        }

    except Exception as e:
        logger.error(f"Evidence classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evidence-clustering")
async def cluster_evidence(
    evidence_list: List[Dict[str, Any]],
    n_clusters: int = 5,
    algorithm: str = "kmeans"
):
    """Cluster evidence using unsupervised learning"""
    try:
        ensure_analysis_dependencies()
        if len(evidence_list) < n_clusters:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for {n_clusters} clusters"
            )

        clusters = await evidence_classifier.cluster_evidence(evidence_list, n_clusters)

        return {
            "success": True,
            "clustering_results": clusters,
            "algorithm": algorithm
        }

    except Exception as e:
        logger.error(f"Evidence clustering error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pattern-recognition")
async def recognize_patterns(request: PatternRecognitionRequest):
    """Advanced pattern recognition analysis"""
    try:
        ensure_analysis_dependencies()
        data = request.data
        pattern_types = request.pattern_types
        analysis_depth = request.analysis_depth

        if len(data) < 5:
            raise HTTPException(status_code=400, detail="Insufficient data for pattern recognition")

        # Discover patterns
        patterns = await pattern_recognition_engine.discover_patterns(data, pattern_types)

        # Additional analysis if requested
        if analysis_depth == "comprehensive":
            correlations = await pattern_recognition_engine.analyze_pattern_correlations(
                patterns.get("patterns_discovered", {})
            )
            patterns["correlations"] = correlations

        return {
            "success": True,
            "pattern_analysis": patterns,
            "analysis_depth": analysis_depth
        }

    except Exception as e:
        logger.error(f"Pattern recognition error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train-model")
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train ML models for various tasks"""
    try:
        ensure_analysis_dependencies()
        training_data = request.training_data
        model_type = request.model_type
        parameters = request.parameters or {}

        if len(training_data) < 10:
            raise HTTPException(status_code=400, detail="Insufficient training data")

        if model_type == "evidence_classifier":
            # Train evidence classifier
            background_tasks.add_task(
                evidence_classifier.train_classifier,
                training_data,
                parameters.get("algorithm", "ensemble")
            )

        elif model_type == "deep_learning":
            # Train deep learning models
            background_tasks.add_task(
                deep_learning_analyzer.train_evidence_classifier,
                training_data
            )

        else:
            raise HTTPException(status_code=400, detail=f"Unknown model type: {model_type}")

        return {
            "success": True,
            "message": f"{model_type} training initiated",
            "training_samples": len(training_data),
            "parameters": parameters
        }

    except Exception as e:
        logger.error(f"Model training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hyperparameter-optimization")
async def optimize_hyperparameters(
    training_data: List[Dict[str, Any]],
    algorithm: str = "rf",
    model_type: str = "evidence_classifier"
):
    """Optimize hyperparameters for ML models"""
    try:
        if len(training_data) < 20:
            raise HTTPException(status_code=400, detail="Insufficient data for hyperparameter optimization")

        if model_type == "evidence_classifier":
            results = await evidence_classifier.optimize_hyperparameters(training_data, algorithm)
        else:
            raise HTTPException(status_code=400, detail=f"Hyperparameter optimization not supported for {model_type}")

        return {
            "success": True,
            "optimization_results": results,
            "algorithm": algorithm,
            "model_type": model_type
        }

    except Exception as e:
        logger.error(f"Hyperparameter optimization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-stats")
async def get_model_stats():
    """Get statistics about trained models"""
    try:
        stats = {
            "evidence_classifier": await evidence_classifier.get_classifier_stats(),
            "deep_learning": await deep_learning_analyzer.get_model_status(),
            "anomaly_detector": {
                "algorithms": ["isolation_forest", "temporal", "network", "deep_learning"],
                "status": "available"
            },
            "pattern_recognition": {
                "pattern_types": ["temporal", "spatial", "frequency", "behavioral", "network", "content"],
                "status": "available"
            }
        }

        return {
            "success": True,
            "model_statistics": stats
        }

    except Exception as e:
        logger.error(f"Model stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/comprehensive-analysis")
async def comprehensive_analysis(
    case_data: Dict[str, Any],
    analysis_types: Optional[List[str]] = None,
    background_tasks: BackgroundTasks = None
):
    """Comprehensive AI-powered analysis of case data"""
    try:
        if analysis_types is None:
            analysis_types = ["anomaly_detection", "evidence_classification", "pattern_recognition"]

        results = {
            "case_id": case_data.get("case_id", "unknown"),
            "analysis_types": analysis_types,
            "results": {},
            "summary": {}
        }

        # Run different analysis types
        if "anomaly_detection" in analysis_types:
            # Enhanced anomaly detection
            anomaly_results = await anomaly_detector.detect_all_anomalies(case_data)
            results["results"]["anomaly_detection"] = anomaly_results

            # Add deep learning anomalies if data is sufficient
            if case_data.get("communications", []):
                dl_anomalies = await deep_learning_analyzer.detect_anomalies_dl(
                    case_data["communications"]
                )
                if dl_anomalies:
                    results["results"]["deep_learning_anomalies"] = dl_anomalies

        if "evidence_classification" in analysis_types and case_data.get("evidence", []):
            # Evidence classification
            classification_results = await evidence_classifier.batch_classify(
                case_data["evidence"], "ensemble"
            )
            results["results"]["evidence_classification"] = classification_results

        if "pattern_recognition" in analysis_types:
            # Pattern recognition
            pattern_data = []
            for key in ["communications", "evidence", "temporal_data"]:
                if key in case_data:
                    pattern_data.extend(case_data[key])

            if len(pattern_data) >= 10:
                pattern_results = await pattern_recognition_engine.discover_patterns(pattern_data)
                results["results"]["pattern_recognition"] = pattern_results

        # Generate summary
        total_findings = 0
        high_confidence_findings = 0

        for analysis_type, analysis_result in results["results"].items():
            if "anomalies" in analysis_result:
                anomalies = analysis_result["anomalies"]
                total_findings += len(anomalies)
                high_confidence_findings += len([a for a in anomalies if a.get("confidence", 0) > 0.7])

        results["summary"] = {
            "total_findings": total_findings,
            "high_confidence_findings": high_confidence_findings,
            "analysis_completed": analysis_types,
            "processing_time": "completed"
        }

        return {
            "success": True,
            "comprehensive_analysis": results
        }

    except Exception as e:
        logger.error(f"Comprehensive analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cross-case")
async def cross_case_analysis(request: CrossCaseAnalysisRequest):
    """Detailed AI analysis of a cross-case connection"""
    try:
        # Fetch data for both cases
        case_a_data = await get_case_data_for_analysis(request.case_id)
        case_b_data = await get_case_data_for_analysis(request.target_case_id)
        
        # Generate detailed analysis using LLM
        analysis_result = await llm_service.analyze_cross_case_link(
            case_a_data,
            case_b_data,
            request.common_entity,
            request.entity_type
        )
        
        return {
            "success": True,
            "analysis": analysis_result
        }
        
    except Exception as e:
        logger.error(f"Cross-case analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def detect_suspicious_activity(case_id: int) -> Dict[str, Any]:
    """Detect suspicious patterns in communications"""
    # ... (rest of the code remains the same)
    
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
                # Standardize case_id filter and fetch full metadata for context
                # "metadata" contains the original record fields like contactName, duration, etc.
                result = await db_manager.elasticsearch.search(
                    index="ufdr-*",
                    body={
                        "query": {"term": {"caseId": case_id}},
                        "size": 1000,
                        "_source": ["phoneNumber", "timestamp", "sourceType", "content", "metadata"]
                    }
                )
                
                for hit in result["hits"]["hits"]:
                    source = hit["_source"]
                    meta = source.get("metadata", {})
                    
                    # Extract rich context
                    record = {
                        "phone_number": source.get("phoneNumber") or meta.get("phoneNumber") or meta.get("phone") or "",
                        "contact_name": meta.get("name") or meta.get("contactName") or meta.get("displayName") or "",
                        "timestamp": source.get("timestamp") or meta.get("timestamp") or "",
                        "duration": meta.get("duration") or 0,
                        "source_type": source.get("sourceType") or "",
                        "content": source.get("content") or meta.get("content") or meta.get("message") or "",
                        "raw_record": meta # Keep for evidence
                    }
                    case_data["communications"].append(record)
                    
                    case_data["temporal_data"].append({
                        "timestamp": record["timestamp"],
                        "type": record["source_type"],
                        "phone_number": record["phone_number"],
                        "contact_name": record["contact_name"],
                        "content": record["content"],
                        "record": record # Full record for evidence display
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
                    
                    async for record in result:
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
