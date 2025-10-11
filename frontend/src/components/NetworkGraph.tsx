import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';

interface Node {
  id: string;
  type: 'device' | 'phone' | 'contact' | 'entity';
  label: string;
  isForeign?: boolean;
  metadata?: any;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

interface NetworkGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
}

export const NetworkGraph = ({ nodes, edges, onNodeClick }: NetworkGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Simple force-directed layout
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize positions if not set
    if (nodePositions.size === 0) {
      const positions = new Map();
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) / 3;

      nodes.forEach((node, idx) => {
        const angle = (idx / nodes.length) * 2 * Math.PI;
        positions.set(node.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        });
      });
      setNodePositions(positions);
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply transformations
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      if (sourcePos && targetPos) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      // Node color based on type
      let color = '#3b82f6'; // blue for device
      if (node.type === 'phone') {
        color = node.isForeign ? '#ef4444' : '#10b981'; // red for foreign, green for local
      } else if (node.type === 'contact') {
        color = '#8b5cf6'; // purple
      } else if (node.type === 'entity') {
        color = '#f59e0b'; // orange
      }

      // Draw node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Highlight selected node
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw label
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.substring(0, 15), pos.x, pos.y + 35);
    });

    ctx.restore();
  }, [nodes, edges, nodePositions, zoom, pan, selectedNode]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Check if clicked on a node
    let clickedNode: Node | null = null;
    for (const node of nodes) {
      const pos = nodePositions.get(node.id);
      if (pos) {
        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        if (distance < 20) {
          clickedNode = node;
          break;
        }
      }
    }

    if (clickedNode) {
      setSelectedNode(clickedNode);
      onNodeClick?.(clickedNode);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'network-graph.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Reset View"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={handleExport}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Export Image"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Device</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Local Number</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>Foreign Number</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <span>Contact</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>Entity</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={600}
        className="w-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{selectedNode.label}</h4>
              <p className="text-sm text-gray-600 capitalize">Type: {selectedNode.type}</p>
              {selectedNode.isForeign !== undefined && (
                <p className="text-sm text-gray-600">
                  {selectedNode.isForeign ? 'Foreign Number' : 'Local Number'}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>No network data available</p>
            <p className="text-sm mt-1">Upload UFDR data to visualize connections</p>
          </div>
        </div>
      )}
    </div>
  );
};
