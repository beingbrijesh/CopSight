from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

class Neo4jClient:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    async def create_communication_relationship(
        self,
        sender: str,
        receiver: str,
        timestamp: datetime,
        app_name: str,
        message_type: str,
        content_preview: str = "",
        duration: Optional[int] = None,
        call_type: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """Create communication relationship between two entities"""
        
        query = """
        MERGE (s:Entity {id: $sender})
        ON CREATE SET s.created_at = datetime()
        MERGE (r:Entity {id: $receiver})
        ON CREATE SET r.created_at = datetime()
        
        CREATE (s)-[rel:COMMUNICATED {
            timestamp: datetime($timestamp),
            app_name: $app_name,
            message_type: $message_type,
            content_preview: $content_preview,
            duration: $duration,
            call_type: $call_type,
            metadata: $metadata
        }]->(r)
        
        // Update communication counts
        SET s.total_communications = COALESCE(s.total_communications, 0) + 1,
            r.total_communications = COALESCE(r.total_communications, 0) + 1
        """
        
        with self.driver.session() as session:
            session.run(query, {
                "sender": sender,
                "receiver": receiver,
                "timestamp": timestamp.isoformat(),
                "app_name": app_name,
                "message_type": message_type,
                "content_preview": content_preview,
                "duration": duration,
                "call_type": call_type,
                "metadata": metadata or {}
            })
    
    async def create_contact_node(
        self,
        contact_id: str,
        name: Optional[str] = None,
        phone_numbers: List[str] = None,
        email_addresses: List[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """Create or update a contact node"""
        
        query = """
        MERGE (c:Contact {id: $contact_id})
        SET c.name = $name,
            c.phone_numbers = $phone_numbers,
            c.email_addresses = $email_addresses,
            c.metadata = $metadata,
            c.updated_at = datetime()
        """
        
        with self.driver.session() as session:
            session.run(query, {
                "contact_id": contact_id,
                "name": name,
                "phone_numbers": phone_numbers or [],
                "email_addresses": email_addresses or [],
                "metadata": metadata or {}
            })
    
    async def get_ego_network(self, node_id: str, depth: int = 2, limit: int = 50) -> Dict[str, Any]:
        """Get ego network around a node"""
        
        query = """
        MATCH (center:Entity {id: $node_id})
        CALL apoc.path.subgraphNodes(center, {
            relationshipFilter: "COMMUNICATED",
            minLevel: 0,
            maxLevel: $depth,
            limit: $limit
        }) YIELD node
        
        WITH collect(node) as nodes
        UNWIND nodes as n1
        UNWIND nodes as n2
        MATCH (n1)-[r:COMMUNICATED]-(n2)
        WHERE id(n1) < id(n2)
        
        RETURN {
            nodes: collect(DISTINCT {
                id: n1.id,
                label: COALESCE(n1.name, n1.id),
                total_communications: n1.total_communications
            }) + collect(DISTINCT {
                id: n2.id,
                label: COALESCE(n2.name, n2.id),
                total_communications: n2.total_communications
            }),
            edges: collect({
                source: n1.id,
                target: n2.id,
                app_name: r.app_name,
                message_type: r.message_type,
                timestamp: r.timestamp,
                weight: 1
            })
        } as network
        """
        
        with self.driver.session() as session:
            result = session.run(query, {
                "node_id": node_id,
                "depth": depth,
                "limit": limit
            })
            
            record = result.single()
            if record:
                return record["network"]
            return {"nodes": [], "edges": []}
    
    async def find_shortest_path(self, start_node: str, end_node: str, max_depth: int = 6) -> Dict[str, Any]:
        """Find shortest path between two nodes"""
        
        query = """
        MATCH (start:Entity {id: $start_node}), (end:Entity {id: $end_node})
        MATCH path = shortestPath((start)-[:COMMUNICATED*1..$max_depth]-(end))
        
        RETURN {
            path_length: length(path),
            nodes: [n in nodes(path) | {
                id: n.id,
                label: COALESCE(n.name, n.id)
            }],
            relationships: [r in relationships(path) | {
                app_name: r.app_name,
                message_type: r.message_type,
                timestamp: r.timestamp
            }]
        } as path_data
        """
        
        with self.driver.session() as session:
            result = session.run(query, {
                "start_node": start_node,
                "end_node": end_node,
                "max_depth": max_depth
            })
            
            record = result.single()
            if record:
                return record["path_data"]
            return {"path_length": -1, "nodes": [], "relationships": []}
    
    async def get_communication_timeline(self, node_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get communication timeline for a node"""
        
        query = """
        MATCH (n:Entity {id: $node_id})-[r:COMMUNICATED]-(other)
        WHERE r.timestamp >= datetime() - duration({days: $days})
        
        RETURN {
            timestamp: r.timestamp,
            other_party: other.id,
            app_name: r.app_name,
            message_type: r.message_type,
            direction: CASE 
                WHEN startNode(r) = n THEN 'outgoing'
                ELSE 'incoming'
            END
        } as communication
        ORDER BY r.timestamp DESC
        LIMIT 1000
        """
        
        with self.driver.session() as session:
            result = session.run(query, {
                "node_id": node_id,
                "days": days
            })
            
            return [record["communication"] for record in result]
    
    async def get_frequent_contacts(self, node_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most frequent contacts for a node"""
        
        query = """
        MATCH (n:Entity {id: $node_id})-[r:COMMUNICATED]-(other)
        
        WITH other, count(r) as communication_count,
             collect(DISTINCT r.app_name) as apps_used,
             max(r.timestamp) as last_contact
        
        RETURN {
            contact_id: other.id,
            name: COALESCE(other.name, other.id),
            communication_count: communication_count,
            apps_used: apps_used,
            last_contact: last_contact
        } as contact
        ORDER BY communication_count DESC
        LIMIT $limit
        """
        
        with self.driver.session() as session:
            result = session.run(query, {
                "node_id": node_id,
                "limit": limit
            })
            
            return [record["contact"] for record in result]
    
    async def detect_communities(self, algorithm: str = "louvain", min_size: int = 3) -> List[List[str]]:
        """Detect communities using graph algorithms"""
        
        if algorithm == "louvain":
            query = """
            CALL gds.louvain.stream('myGraph')
            YIELD nodeId, communityId
            
            WITH communityId, collect(gds.util.asNode(nodeId).id) as members
            WHERE size(members) >= $min_size
            
            RETURN collect(members) as communities
            """
        else:
            # Fallback to simple connected components
            query = """
            MATCH (n:Entity)
            WITH n
            MATCH path = (n)-[:COMMUNICATED*1..3]-(connected)
            WITH n, collect(DISTINCT connected.id) + [n.id] as component
            WHERE size(component) >= $min_size
            
            RETURN collect(DISTINCT component) as communities
            """
        
        with self.driver.session() as session:
            result = session.run(query, {"min_size": min_size})
            record = result.single()
            
            if record:
                return record["communities"]
            return []
    
    async def export_to_json(self, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Export graph data to JSON format"""
        
        query = """
        MATCH (n:Entity)-[r:COMMUNICATED]-(m:Entity)
        
        RETURN {
            nodes: collect(DISTINCT {
                id: n.id,
                label: COALESCE(n.name, n.id),
                total_communications: n.total_communications
            }) + collect(DISTINCT {
                id: m.id,
                label: COALESCE(m.name, m.id),
                total_communications: m.total_communications
            }),
            edges: collect({
                source: n.id,
                target: m.id,
                app_name: r.app_name,
                message_type: r.message_type,
                timestamp: r.timestamp
            })
        } as graph_data
        """
        
        with self.driver.session() as session:
            result = session.run(query)
            record = result.single()
            
            if record:
                return record["graph_data"]
            return {"nodes": [], "edges": []}
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get overall graph statistics"""
        
        query = """
        MATCH (n:Entity)
        OPTIONAL MATCH (n)-[r:COMMUNICATED]-()
        
        WITH count(DISTINCT n) as total_entities,
             count(r) as total_communications,
             collect(DISTINCT r.app_name) as apps_used
        
        RETURN {
            total_entities: total_entities,
            total_communications: total_communications,
            apps_used: apps_used,
            avg_communications_per_entity: CASE 
                WHEN total_entities > 0 THEN toFloat(total_communications) / total_entities
                ELSE 0
            END
        } as stats
        """
        
        with self.driver.session() as session:
            result = session.run(query)
            record = result.single()
            
            if record:
                return record["stats"]
            return {}
    
    async def clear_all_data(self) -> Dict[str, Any]:
        """Clear all data from the graph"""
        
        query = """
        MATCH (n)
        DETACH DELETE n
        """
        
        with self.driver.session() as session:
            result = session.run(query)
            summary = result.consume()
            
            return {
                "nodes_deleted": summary.counters.nodes_deleted,
                "relationships_deleted": summary.counters.relationships_deleted
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Neo4j connection health"""
        
        try:
            with self.driver.session() as session:
                result = session.run("RETURN 1 as test")
                record = result.single()
                
                if record and record["test"] == 1:
                    return {"status": "healthy", "connection": "active"}
                else:
                    return {"status": "unhealthy", "connection": "failed"}
                    
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
