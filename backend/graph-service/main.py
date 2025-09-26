from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import networkx as nx
from datetime import datetime

from neo4j_client import Neo4jClient
from graph_analyzer import GraphAnalyzer
from models import AnalysisRequest, GraphData, NetworkAnalysis, PathAnalysis
from config import settings

app = FastAPI(title="UFDR Graph Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
neo4j_client = Neo4jClient(settings.NEO4J_URI, settings.NEO4J_USER, settings.NEO4J_PASSWORD)
graph_analyzer = GraphAnalyzer(neo4j_client)

@app.post("/analyze")
async def analyze_relationships(request: AnalysisRequest):
    """Analyze relationships from parsed data and create graph"""
    
    try:
        job_id = request.job_id
        data = request.data
        
        # Create nodes and relationships from messages
        message_count = 0
        for message in data.messages:
            await neo4j_client.create_communication_relationship(
                sender=message.sender_id,
                receiver=message.receiver_id,
                timestamp=message.timestamp,
                app_name=message.app_name,
                message_type="message",
                content_preview=message.content[:100] if message.content else "",
                metadata=message.metadata
            )
            message_count += 1
        
        # Create nodes and relationships from calls
        call_count = 0
        for call in data.calls:
            await neo4j_client.create_communication_relationship(
                sender=call.caller_id,
                receiver=call.receiver_id,
                timestamp=call.timestamp,
                app_name="phone",
                message_type="call",
                duration=call.duration,
                call_type=call.call_type,
                metadata=call.metadata
            )
            call_count += 1
        
        # Create contact nodes
        contact_count = 0
        for contact in data.contacts:
            await neo4j_client.create_contact_node(
                contact_id=contact.contact_id,
                name=contact.name,
                phone_numbers=contact.phone_numbers,
                email_addresses=contact.email_addresses,
                metadata=contact.metadata
            )
            contact_count += 1
        
        return {
            "job_id": job_id,
            "status": "completed",
            "relationships_created": message_count + call_count,
            "contacts_created": contact_count,
            "analyzed_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/network/{node_id}")
async def get_network(node_id: str, depth: int = 2, limit: int = 50):
    """Get network graph around a specific node"""
    
    try:
        network_data = await graph_analyzer.get_ego_network(node_id, depth, limit)
        return network_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Network retrieval failed: {str(e)}")

@app.get("/path/{start_node}/{end_node}")
async def find_shortest_path(start_node: str, end_node: str, max_depth: int = 6):
    """Find shortest path between two nodes"""
    
    try:
        path_data = await graph_analyzer.find_shortest_path(start_node, end_node, max_depth)
        return path_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Path finding failed: {str(e)}")

@app.get("/communities")
async def detect_communities(algorithm: str = "louvain", min_size: int = 3):
    """Detect communities in the communication network"""
    
    try:
        communities = await graph_analyzer.detect_communities(algorithm, min_size)
        return {
            "algorithm": algorithm,
            "communities": communities,
            "total_communities": len(communities)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Community detection failed: {str(e)}")

@app.get("/centrality/{node_id}")
async def calculate_centrality(node_id: str):
    """Calculate centrality measures for a node"""
    
    try:
        centrality_data = await graph_analyzer.calculate_centrality(node_id)
        return centrality_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Centrality calculation failed: {str(e)}")

@app.get("/timeline/{node_id}")
async def get_communication_timeline(node_id: str, days: int = 30):
    """Get communication timeline for a node"""
    
    try:
        timeline_data = await graph_analyzer.get_communication_timeline(node_id, days)
        return timeline_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline retrieval failed: {str(e)}")

@app.get("/frequent_contacts/{node_id}")
async def get_frequent_contacts(node_id: str, limit: int = 10):
    """Get most frequent contacts for a node"""
    
    try:
        contacts = await graph_analyzer.get_frequent_contacts(node_id, limit)
        return {
            "node_id": node_id,
            "frequent_contacts": contacts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frequent contacts retrieval failed: {str(e)}")

@app.get("/suspicious_patterns")
async def detect_suspicious_patterns():
    """Detect suspicious communication patterns"""
    
    try:
        patterns = await graph_analyzer.detect_suspicious_patterns()
        return {
            "patterns": patterns,
            "detected_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pattern detection failed: {str(e)}")

@app.post("/export_graph")
async def export_graph_data(format: str = "json", filters: Optional[Dict[str, Any]] = None):
    """Export graph data in various formats"""
    
    try:
        if format == "json":
            graph_data = await neo4j_client.export_to_json(filters)
        elif format == "gexf":
            graph_data = await neo4j_client.export_to_gexf(filters)
        elif format == "cypher":
            graph_data = await neo4j_client.export_to_cypher(filters)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        return {
            "format": format,
            "data": graph_data,
            "exported_at": datetime.utcnow()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.get("/stats")
async def get_graph_statistics():
    """Get overall graph statistics"""
    
    try:
        stats = await graph_analyzer.get_graph_statistics()
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Statistics retrieval failed: {str(e)}")

@app.delete("/clear")
async def clear_graph_data(confirm: bool = False):
    """Clear all graph data (use with caution)"""
    
    if not confirm:
        raise HTTPException(status_code=400, detail="Must set confirm=true to clear data")
    
    try:
        result = await neo4j_client.clear_all_data()
        return {
            "status": "cleared",
            "nodes_deleted": result.get("nodes_deleted", 0),
            "relationships_deleted": result.get("relationships_deleted", 0)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clear operation failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Neo4j connection
        neo4j_health = await neo4j_client.health_check()
        
        # Get basic stats
        stats = await graph_analyzer.get_graph_statistics()
        
        return {
            "status": "healthy",
            "neo4j": neo4j_health,
            "graph_stats": stats,
            "service": "graph"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "service": "graph"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
