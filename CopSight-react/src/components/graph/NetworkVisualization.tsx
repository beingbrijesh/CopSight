import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Network, Share2, Search, Users, TrendingUp } from 'lucide-react';
import { graphAPI } from '@/services/api';

interface NetworkNode {
  id: string;
  label: string;
  total_communications?: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  app_name: string;
  message_type: string;
  weight: number;
}

interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export const NetworkVisualization = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadGraphStats();
  }, []);

  const loadGraphStats = async () => {
    try {
      const response = await graphAPI.getStats();
      setStats(response);
    } catch (err) {
      console.error('Failed to load graph stats:', err);
    }
  };

  const loadNetwork = async (nodeId: string, depth: number = 2) => {
    if (!nodeId.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await graphAPI.getNetwork(nodeId, depth, 50);
      setNetworkData(response);
      renderNetwork(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load network data');
    } finally {
      setIsLoading(false);
    }
  };

  const renderNetwork = (data: NetworkData) => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = svgRef.current;
    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    // Clear previous content
    svg.innerHTML = '';

    // Create simple force-directed layout
    const nodes = data.nodes.map(node => ({
      ...node,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
    }));

    const edges = data.edges.map(edge => ({
      ...edge,
      source: nodes.find(n => n.id === edge.source),
      target: nodes.find(n => n.id === edge.target),
    })).filter(edge => edge.source && edge.target);

    // Simple physics simulation
    const simulate = () => {
      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        if (edge.source && edge.target) {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = distance * 0.01;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          edge.source.vx += fx;
          edge.source.vy += fy;
          edge.target.vx -= fx;
          edge.target.vy -= fy;
        }
      });

      // Apply velocities and damping
      nodes.forEach(node => {
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        
        // Keep nodes within bounds
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      });
    };

    // Run simulation
    for (let i = 0; i < 100; i++) {
      simulate();
    }

    // Render edges
    edges.forEach(edge => {
      if (edge.source && edge.target) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', edge.source.x.toString());
        line.setAttribute('y1', edge.source.y.toString());
        line.setAttribute('x2', edge.target.x.toString());
        line.setAttribute('y2', edge.target.y.toString());
        line.setAttribute('stroke', '#e2e8f0');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
      }
    });

    // Render nodes
    nodes.forEach(node => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x.toString());
      circle.setAttribute('cy', node.y.toString());
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', '#3b82f6');
      circle.setAttribute('stroke', '#1e40af');
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'pointer';
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x.toString());
      text.setAttribute('y', (node.y - 12).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#374151');
      text.textContent = node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label;
      
      svg.appendChild(circle);
      svg.appendChild(text);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Communication Network Analysis
          </CardTitle>
          <CardDescription>
            Visualize relationships and communication patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter phone number, email, or contact ID"
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={() => loadNetwork(selectedNode)}
              disabled={isLoading || !selectedNode.trim()}
            >
              {isLoading ? (
                <>
                  <Search className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Entities</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {stats.total_entities || 0}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Communications</span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {stats.total_communications || 0}
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Avg per Entity</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {Math.round(stats.avg_communications_per_entity || 0)}
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg">
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              className="bg-gray-50"
            />
          </div>

          {networkData && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                {networkData.nodes.length} nodes
              </Badge>
              <Badge variant="outline">
                {networkData.edges.length} connections
              </Badge>
              {stats?.apps_used && (
                <Badge variant="outline">
                  Apps: {stats.apps_used.join(', ')}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
