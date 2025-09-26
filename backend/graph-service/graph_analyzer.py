import networkx as nx
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import statistics

from neo4j_client import Neo4jClient

class GraphAnalyzer:
    def __init__(self, neo4j_client: Neo4jClient):
        self.neo4j_client = neo4j_client
    
    async def get_ego_network(self, node_id: str, depth: int = 2, limit: int = 50) -> Dict[str, Any]:
        """Get ego network around a specific node"""
        return await self.neo4j_client.get_ego_network(node_id, depth, limit)
    
    async def find_shortest_path(self, start_node: str, end_node: str, max_depth: int = 6) -> Dict[str, Any]:
        """Find shortest path between two nodes"""
        return await self.neo4j_client.find_shortest_path(start_node, end_node, max_depth)
    
    async def detect_communities(self, algorithm: str = "louvain", min_size: int = 3) -> List[List[str]]:
        """Detect communities in the network"""
        return await self.neo4j_client.detect_communities(algorithm, min_size)
    
    async def calculate_centrality(self, node_id: str) -> Dict[str, Any]:
        """Calculate various centrality measures for a node"""
        
        # Get the ego network first
        network_data = await self.get_ego_network(node_id, depth=3, limit=100)
        
        if not network_data["nodes"]:
            return {"error": "Node not found or no connections"}
        
        # Build NetworkX graph
        G = nx.Graph()
        
        # Add nodes
        for node in network_data["nodes"]:
            G.add_node(node["id"], **node)
        
        # Add edges
        for edge in network_data["edges"]:
            G.add_edge(edge["source"], edge["target"], **edge)
        
        if node_id not in G:
            return {"error": "Node not found in network"}
        
        # Calculate centrality measures
        centrality_measures = {}
        
        try:
            # Degree centrality
            degree_centrality = nx.degree_centrality(G)
            centrality_measures["degree_centrality"] = degree_centrality.get(node_id, 0)
            
            # Betweenness centrality
            betweenness_centrality = nx.betweenness_centrality(G)
            centrality_measures["betweenness_centrality"] = betweenness_centrality.get(node_id, 0)
            
            # Closeness centrality
            if nx.is_connected(G):
                closeness_centrality = nx.closeness_centrality(G)
                centrality_measures["closeness_centrality"] = closeness_centrality.get(node_id, 0)
            else:
                # For disconnected graphs, calculate for the component containing the node
                component = nx.node_connected_component(G, node_id)
                subgraph = G.subgraph(component)
                closeness_centrality = nx.closeness_centrality(subgraph)
                centrality_measures["closeness_centrality"] = closeness_centrality.get(node_id, 0)
            
            # Eigenvector centrality (if possible)
            try:
                eigenvector_centrality = nx.eigenvector_centrality(G, max_iter=1000)
                centrality_measures["eigenvector_centrality"] = eigenvector_centrality.get(node_id, 0)
            except:
                centrality_measures["eigenvector_centrality"] = None
            
            # PageRank
            pagerank = nx.pagerank(G)
            centrality_measures["pagerank"] = pagerank.get(node_id, 0)
            
            # Local clustering coefficient
            clustering = nx.clustering(G)
            centrality_measures["clustering_coefficient"] = clustering.get(node_id, 0)
            
        except Exception as e:
            centrality_measures["error"] = str(e)
        
        return {
            "node_id": node_id,
            "centrality_measures": centrality_measures,
            "network_size": len(G.nodes()),
            "node_degree": G.degree(node_id) if node_id in G else 0
        }
    
    async def get_communication_timeline(self, node_id: str, days: int = 30) -> Dict[str, Any]:
        """Get communication timeline for a node"""
        
        timeline_data = await self.neo4j_client.get_communication_timeline(node_id, days)
        
        # Process timeline data for visualization
        daily_counts = {}
        app_usage = {}
        hourly_patterns = [0] * 24
        
        for comm in timeline_data:
            # Parse timestamp
            timestamp_str = comm["timestamp"]
            try:
                if isinstance(timestamp_str, str):
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    timestamp = timestamp_str
                
                # Daily counts
                date_key = timestamp.date().isoformat()
                daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
                
                # App usage
                app_name = comm["app_name"]
                app_usage[app_name] = app_usage.get(app_name, 0) + 1
                
                # Hourly patterns
                hour = timestamp.hour
                hourly_patterns[hour] += 1
                
            except Exception as e:
                continue
        
        return {
            "node_id": node_id,
            "total_communications": len(timeline_data),
            "daily_counts": daily_counts,
            "app_usage": app_usage,
            "hourly_patterns": hourly_patterns,
            "timeline_data": timeline_data[:100]  # Limit for performance
        }
    
    async def get_frequent_contacts(self, node_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most frequent contacts for a node"""
        return await self.neo4j_client.get_frequent_contacts(node_id, limit)
    
    async def detect_suspicious_patterns(self) -> List[Dict[str, Any]]:
        """Detect suspicious communication patterns"""
        
        suspicious_patterns = []
        
        # Pattern 1: Nodes with unusually high communication volume
        stats = await self.get_graph_statistics()
        avg_communications = stats.get("avg_communications_per_entity", 0)
        
        if avg_communications > 0:
            # Find nodes with > 3x average communications
            high_volume_query = """
            MATCH (n:Entity)
            WHERE n.total_communications > $threshold
            RETURN n.id as node_id, n.total_communications as count
            ORDER BY n.total_communications DESC
            LIMIT 10
            """
            
            # This would need to be implemented in neo4j_client
            # For now, we'll create a placeholder
            
        # Pattern 2: Communication spikes (many messages in short time)
        spike_pattern = {
            "pattern_type": "communication_spike",
            "description": "Nodes with unusual communication spikes",
            "severity": "medium",
            "detected_nodes": []
        }
        suspicious_patterns.append(spike_pattern)
        
        # Pattern 3: Isolated clusters (potential coordination)
        cluster_pattern = {
            "pattern_type": "isolated_cluster",
            "description": "Small, tightly connected groups with minimal external communication",
            "severity": "high",
            "detected_clusters": []
        }
        suspicious_patterns.append(cluster_pattern)
        
        # Pattern 4: Bridge nodes (connecting different groups)
        bridge_pattern = {
            "pattern_type": "bridge_nodes",
            "description": "Nodes that connect otherwise disconnected groups",
            "severity": "medium",
            "detected_nodes": []
        }
        suspicious_patterns.append(bridge_pattern)
        
        return suspicious_patterns
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get comprehensive graph statistics"""
        
        basic_stats = await self.neo4j_client.get_graph_statistics()
        
        # Add more detailed analysis
        enhanced_stats = {
            **basic_stats,
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
        
        return enhanced_stats
    
    async def analyze_communication_patterns(self, node_id: str) -> Dict[str, Any]:
        """Analyze communication patterns for a specific node"""
        
        # Get timeline data
        timeline = await self.get_communication_timeline(node_id, days=90)
        
        # Get frequent contacts
        contacts = await self.get_frequent_contacts(node_id, limit=20)
        
        # Calculate patterns
        patterns = {
            "most_active_hour": None,
            "most_active_day": None,
            "communication_regularity": None,
            "app_diversity": len(timeline["app_usage"]),
            "top_contacts": contacts[:5]
        }
        
        # Find most active hour
        if timeline["hourly_patterns"]:
            max_hour = max(range(24), key=lambda h: timeline["hourly_patterns"][h])
            patterns["most_active_hour"] = max_hour
        
        # Find most active day
        if timeline["daily_counts"]:
            max_day = max(timeline["daily_counts"].keys(), 
                         key=lambda d: timeline["daily_counts"][d])
            patterns["most_active_day"] = max_day
        
        # Calculate communication regularity (coefficient of variation)
        if len(timeline["daily_counts"]) > 1:
            daily_values = list(timeline["daily_counts"].values())
            mean_daily = statistics.mean(daily_values)
            std_daily = statistics.stdev(daily_values)
            patterns["communication_regularity"] = std_daily / mean_daily if mean_daily > 0 else 0
        
        return {
            "node_id": node_id,
            "analysis_period_days": 90,
            "patterns": patterns,
            "timeline_summary": {
                "total_communications": timeline["total_communications"],
                "apps_used": list(timeline["app_usage"].keys()),
                "communication_span_days": len(timeline["daily_counts"])
            }
        }
