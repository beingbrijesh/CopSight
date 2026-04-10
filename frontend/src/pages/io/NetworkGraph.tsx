import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { ArrowLeft, Search, Loader2, RefreshCw, AlertTriangle, ExternalLink, FolderOpen } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api';
// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface GraphNode {
  id: number;
  label: string;
  type: string;
  properties: any;
  frequency: number;
  // ForceGraph3D internal positional fields:
  x?: number;
  y?: number;
  z?: number;
}

interface GraphEdge {
  source: number | GraphNode;
  target: number | GraphNode;
  weight: number;
  communicationType: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  anomalies: number[][];
}

// ──────────────────────────────────────────────
// ErrorBoundary — prevents 3D canvas crash from
// taking down the whole app
// ──────────────────────────────────────────────
import React, { Component } from 'react';
import type { ReactNode } from 'react';
class GraphErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const NODE_PALETTE: Record<string, string> = {
  PhoneNumber: '#10f981',  // emerald neon
  Contact:     '#3b82f6',  // electric blue
  Device:      '#818cf8',  // indigo
  CryptoAddress: '#f59e0b', // amber
  Email:       '#06b6d4',   // cyan
  IPAddress:   '#ec4899',   // pink
  Case:        '#facc15',   // gold/yellow
  Default:     '#9ca3af',   // light gray
};

const SVG_MAP: Record<string, string> = {
  PhoneNumber: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
  Contact: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  Device: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`,
  CryptoAddress: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L8 12"/><path d="m9 5 6 14"/><path d="m15 19-6-14"/></svg>`,
  Email: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  IPAddress: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  Case: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  Default: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" stroke="white"><circle cx="12" cy="12" r="6"/></svg>`
};

const iconCache = new Map<string, THREE.SpriteMaterial>();

function getSpriteMaterial(type: string, color: string) {
  const cacheKey = `${type}-${color}`;
  if (!iconCache.has(cacheKey)) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Outer glow circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner dark circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 18, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#111827';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    iconCache.set(cacheKey, material);

    // Asynchronously load and overlay the SVG Icon
    const svgString = SVG_MAP[type] || SVG_MAP.Default;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    img.onload = () => {
      // Draw SVG perfectly centered within the 128x128 canvas
      ctx.drawImage(img, (size - 64) / 2, (size - 64) / 2, 64, 64);
      texture.needsUpdate = true; // Tell WebGL to re-render the generated material map
    };
  }
  return iconCache.get(cacheKey)!;
}

const IntelligenceRenderer = ({ text }: { text: string }) => {
  if (!text) return null;

  // Semantic Categories — word-boundary (\b) prevents partial-word matches
  // e.g. "call" no longer highlights inside "Locally", "contact" inside "contacted"
  const financeRegex = /\b(transactions?|crypto|cryptocurrency|transfer|payments?|bitcoin|usdt|eth|wallet|funds|laundering)\b/gi;
  const crimeRegex = /\b(suspicious|illegal|fraud|hack(?:ed|ing)?|stolen|scam|arrest(?:ed)?|seiz(?:ed|ure)|laundering|illicit|anomal(?:y|ies|ous))\b/gi;
  const commsRegex = /\b(whatsapp|telegram|signal|ip\s?address|phone\s?number|imei|imsi)\b/gi;

  const renderFormattedText = (str: string, isBold: boolean) => {
    let components: any[] = [<span key="0">{str}</span>];

    const applyRegex = (regex: RegExp, colorClass: string) => {
      components = components.flatMap((comp, idx) => {
        if (typeof comp.props.children === 'string') {
          const content = comp.props.children;
          // split() with a capturing group keeps delimiters in the array
          return content.split(regex).map((part: string, i: number) => {
            // Reset lastIndex before each test — global regexes advance it,
            // which causes alternating matches to be silently missed
            regex.lastIndex = 0;
            return regex.test(part)
              ? <span key={`${idx}-${i}`} className={colorClass}>{part}</span>
              : <span key={`${idx}-${i}-txt`}>{part}</span>;
          });
        }
        return comp;
      });
    };

    applyRegex(crimeRegex, "text-red-300 font-bold bg-red-900/40 px-1 rounded mx-0.5");
    applyRegex(financeRegex, "text-emerald-400 font-bold bg-emerald-900/40 px-1 rounded mx-0.5");
    applyRegex(commsRegex, "text-blue-300 font-bold bg-blue-900/40 px-1 rounded mx-0.5");

    return <span className={isBold ? "font-extrabold text-white" : ""}>{components}</span>;
  };

  const parseLine = (line: string, index: number) => {
    // 1. Headers
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-sm font-bold text-blue-400 mt-4 mb-2 border-b border-gray-800 pb-1 flex items-center gap-2">
        {line.replace('## ', '')}
      </h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-base font-extrabold text-white mt-5 mb-3 border-l-4 border-blue-600 pl-3">
        {line.replace('# ', '')}
      </h1>;
    }
    // 2. Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return <div key={index} className="flex gap-2 ml-2 my-1 text-gray-300">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 mt-1.5 shrink-0" />
        <p className="flex-1">{parseInline(content)}</p>
      </div>;
    }

    return <p key={index} className="my-1 text-gray-300 leading-relaxed">{parseInline(line)}</p>;
  };

  const parseInline = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = text.split(boldRegex);
    return parts.map((part, i) => {
      const isBold = i % 2 !== 0;
      return <React.Fragment key={i}>{renderFormattedText(part, isBold)}</React.Fragment>;
    });
  };

  return <div className="space-y-0.5">{text.split('\n').map((line, i) => parseLine(line, i))}</div>;
};

function getNodeColor(node: GraphNode): string {
  return NODE_PALETTE[node.type] || NODE_PALETTE.Default;
}

function buildAnomalySet(anomalies: number[][]): Set<string> {
  const set = new Set<string>();
  anomalies.forEach(path => {
    for (let i = 0; i < path.length - 1; i++) {
      set.add(`${path[i]}-${path[i + 1]}`);
      set.add(`${path[i + 1]}-${path[i]}`); // highlight both directions
    }
  });
  return set;
}

function getId(val: number | GraphNode): number {
  return typeof val === 'object' ? val.id : val;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export const NetworkGraph = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<GraphData>({ nodes: [], edges: [], anomalies: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // AI sidebar states
  const [aiHistory, setAiHistory] = useState<Array<{ 
    nodeId: number; 
    label: string; 
    type: string; 
    properties?: any;
    text: string; 
    status: 'thinking' | 'streaming' | 'done' | 'error';
    evidence: any[];
  }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track anomalous edges
  const [anomalySet, setAnomalySet] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // ── Responsive canvas size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 650,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ── Auto-scroll to latest analysis
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiHistory]);

  // ── Fetch graph data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(
        `/graph/network/${caseId}?min_interaction_threshold=${threshold}`
      );
      const graphData: GraphData = res.data.data;
      setData(graphData);
      setAnomalySet(buildAnomalySet(graphData.anomalies || []));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load network graph.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, threshold]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── On-click dynamic neighbor expansion
  const expandNode = useCallback(async (node: GraphNode) => {
    if (expandedNodes.has(node.id)) return; // already expanded
    try {
      const res = await api.get(
        `/graph/network/${caseId}/node/${node.id}/neighbors`
      );
      const { nodes: newNodes, edges: newEdges } = res.data.data;
      if (!newNodes.length) return;

      setData(prev => {
        const existingIds = new Set(prev.nodes.map(n => n.id));
        const filteredNew = (newNodes as GraphNode[]).filter(n => !existingIds.has(n.id));
        return {
          nodes: [...prev.nodes, ...filteredNew],
          edges: [...prev.edges, ...(newEdges as GraphEdge[])],
          anomalies: prev.anomalies
        };
      });
      setExpandedNodes(prev => new Set([...prev, node.id]));
    } catch (e) {
      // non-fatal: expansion is a bonus feature, don't alert
      console.warn('Neighbor expansion failed for node', node.id);
    }
  }, [caseId, expandedNodes]);

  // ── SSE stream AI evidence for selected node
  const streamAiEvidence = useCallback(async (node: GraphNode) => {
    setAiHistory(prev => [...prev, {
      nodeId: node.id,
      label: node.label,
      type: node.type,
      properties: node.properties || {},
      text: '',
      status: 'thinking',
      evidence: []
    }]);

    const updateCurrent = (updater: (item: any) => any) => {
      setAiHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(n => n.nodeId === node.id && n.status !== 'done');
        const target = idx !== -1 ? idx : next.length - 1;
        next[target] = updater(next[target]);
        return next;
      });
    };

    try {
      const response = await fetch(`http://localhost:8080/api/query/case/${caseId}/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          queryText: node.type === 'Case'
            ? `Analyze the forensic significance of ${node.label}. Summarize its key entities, communication patterns, and how it connects to the current investigation (Case ${caseId}). List overlapping entities (shared phone numbers, contacts, crypto addresses) and assess the intelligence value of this cross-case connection. Use these headers:\n\n## 🔗 Cross-Case Connection\n(how it relates to current investigation)\n## 📊 Case Summary\n(key findings and entities)\n## 🚨 Shared Risk Indicators\n(overlapping suspicious patterns)`
            : `Generate a unified forensic profile for ${node.label} (${node.type}). You MUST strictly segment your response using these exact markdown headers: \n\n## 📱 Communications\n(summarize chat density and related contacts)\n## 💰 Transactions\n(explicitly list all linked crypto movements)\n## 🚨 Crime History\n(any suspicious patterns or anomalies found). Keep it highly actionable.`,
          queryType: 'natural_language'
        })
      });

      if (!response.body) {
        updateCurrent(prev => ({ ...prev, status: 'error', text: 'Stream not supported.' }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') {
              updateCurrent(prev => ({ ...prev, status: 'done' }));
              return;
            }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'status') {
                if (parsed.status === 'streaming') updateCurrent(prev => ({ ...prev, status: 'streaming' }));
              } else if (parsed.type === 'token') {
                updateCurrent(prev => ({ ...prev, text: prev.text + parsed.token }));
              } else if (parsed.type === 'metadata') {
                updateCurrent(prev => ({ ...prev, status: 'done', evidence: parsed.evidence || [] }));
              } else if (parsed.type === 'error') {
                updateCurrent(prev => ({ ...prev, status: 'error', text: parsed.message || 'An error occurred.' }));
              }
            } catch { }
          }
        }
      };

      await processStream();
    } catch (err: any) {
      updateCurrent(prev => ({ 
        ...prev, 
        status: 'error', 
        text: err.message?.includes('ECONNREFUSED') ? '🔌 AI Service is not running.' : '❌ Failed to connect.' 
      }));
    }
  }, [caseId]);

  // ── Right-click (or Cmd/Ctrl+click) fallback: search Elasticsearch
  const handleRightClick = useCallback((node: any, event?: MouseEvent) => {
    if (event?.preventDefault) event.preventDefault();
    if (confirm(`Search Elasticsearch for: "${(node as GraphNode).label}"?`)) {
      navigate(`/io/case/${caseId}/query`, { state: { initialQuery: (node as GraphNode).label } });
    }
  }, [caseId, navigate]);

  // ── Node click handler
  const handleNodeClick = useCallback(async (node: any, event: MouseEvent) => {
    // Fix for Mac Trackpads where two-finger click registers as primary click + ctrlKey
    if (event && (event.ctrlKey || event.metaKey || event.altKey)) {
      handleRightClick(node, event);
      return;
    }

    const gNode = node as GraphNode;

    // Center camera on node
    if (fgRef.current) {
      fgRef.current.cameraPosition(
        { x: (gNode.x || 0) + 80, y: (gNode.y || 0) + 30, z: (gNode.z || 0) + 80 },
        { x: gNode.x || 0, y: gNode.y || 0, z: gNode.z || 0 },
        1200
      );
    }

    // Expand neighbors + stream AI
    await expandNode(gNode);
    await streamAiEvidence(gNode);
  }, [expandNode, streamAiEvidence, handleRightClick]);

  const getLinkWidth = useCallback((link: any) => {
    const srcId = getId(link.source);
    const tgtId = getId(link.target);
    const isAnomalous = anomalySet.has(`${srcId}-${tgtId}`) || anomalySet.has(`${tgtId}-${srcId}`);
    if (link.type === 'CROSS_CASE_LINK') return 2.5; 
    return isAnomalous ? 3 : Math.max(0.5, Math.sqrt(link.weight || 1));
  }, [anomalySet]);

  const getLinkColor = useCallback((link: any) => {
    const srcId = getId(link.source);
    const tgtId = getId(link.target);
    const isAnomalous = anomalySet.has(`${srcId}-${tgtId}`) || anomalySet.has(`${tgtId}-${srcId}`);
    
    if (link.type === 'CROSS_CASE_LINK') return 'rgba(139, 92, 246, 0.8)'; // Purple for cross-case links
    
    return isAnomalous
      ? 'rgba(239, 68, 68, 0.9)'
      : 'rgba(255, 255, 255, 0.6)'; // bright white/silver for non-anomalies
  }, [anomalySet]);


  const getThreeObject = useCallback((node: any) => {
    const type = node.type || 'Default';
    const isCurrentCase = node.type === 'Case' && node.properties?.id === parseInt(caseId || '');
    
    // Determine color (highlight active case)
    const color = isCurrentCase ? '#8b5cf6' : getNodeColor(node); 
    const material = getSpriteMaterial(type, color);
    const sprite = new THREE.Sprite(material);
    
    // Scale: Cases are larger than entities. Active case is largest.
    let baseScale = 12;
    if (node.type === 'Case') baseScale = isCurrentCase ? 24 : 18;
    
    const scale = baseScale + Math.sqrt(node.frequency || 1) * 2;
    sprite.scale.set(scale, scale, 1);
    return sprite;
  }, [caseId, getNodeColor]);

  // ── Render
  return (
    <div className="h-screen bg-gray-950 flex flex-col text-white overflow-hidden">
      <Navbar />

      <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between mb-4">
          <button
            onClick={() => navigate(`/io/case/${caseId}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case
          </button>
          <div className="flex items-center gap-3">
            {data.anomalies.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/60 border border-red-500/50 rounded-full text-sm font-bold text-red-300 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                {data.anomalies.length} Circular Transaction{data.anomalies.length > 1 ? 's' : ''} Detected
              </div>
            )}
            <button onClick={fetchData} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex-shrink-0 bg-gray-900/80 border border-gray-800 rounded-xl px-5 py-3 mb-4 flex flex-wrap items-center gap-6">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Network Discovery — 3D</h1>
            <p className="text-xs text-gray-500 mt-0.5">Visual mapping of entities, communications & anomalies</p>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <label className="text-xs font-medium text-gray-400">
              Min Interaction Weight: <span className="text-white font-bold">{threshold}</span>
            </label>
            <input
              type="range" min="1" max="50" value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-32 accent-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden mb-4 min-h-0">
          {/* ── 3D Graph Canvas */}
          <div className="flex-1 bg-gray-950 rounded-xl border border-gray-800 relative overflow-hidden" ref={containerRef}>
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-700 p-3 rounded-xl shadow-xl text-xs z-10 backdrop-blur-sm">
              <p className="font-semibold text-gray-300 mb-2">Legend</p>
              {Object.entries(NODE_PALETTE).filter(([k]) => k !== 'Default').map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: color }} />
                  <span className="text-gray-400">{type}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-700 flex items-center gap-2">
                <div className="w-5 h-0.5 bg-red-500" />
                <span className="text-red-400">Anomalous Cycle</span>
              </div>
            </div>

            {/* Hint */}
            <div className="absolute top-3 left-3 bg-black/60 border border-gray-700 text-gray-300 text-[11px] px-2.5 py-1.5 rounded-lg z-10 backdrop-blur-sm shadow-sm font-medium">
              🖱 Click Node: AI Profile &nbsp;|&nbsp; Right Click (or ⌘/Ctrl+Click): External OSINT Search
            </div>

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 z-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-gray-300 text-sm">Extracting Network...</p>
              </div>
            )}

            {!loading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-red-400 text-sm max-w-sm text-center">{error}</p>
                <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && data.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <p className="text-gray-500 text-sm">No network data found matching criteria.</p>
              </div>
            )}

            {!loading && !error && data.nodes.length > 0 && (
              <GraphErrorBoundary
                fallback={
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                    <p className="text-amber-400 text-sm">3D renderer encountered an error.</p>
                    <p className="text-gray-500 text-xs mt-1">Try refreshing the page.</p>
                  </div>
                }
              >
                <ForceGraph3D
                  ref={fgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  backgroundColor="#030712"
                  graphData={{ nodes: data.nodes, links: data.edges }}
                  nodeLabel={(n: any) => `${(n as GraphNode).label}\nType: ${(n as GraphNode).type}\nWeight: ${(n as GraphNode).frequency}`}
                  nodeColor={getNodeColor}
                  nodeThreeObject={getThreeObject}
                  nodeOpacity={0.92}
                  linkWidth={getLinkWidth}
                  linkColor={getLinkColor}
                  linkDirectionalArrowLength={(l: any) => {
                    const srcId = getId(l.source);
                    const tgtId = getId(l.target);
                    if (l.type === 'CROSS_CASE_LINK') return 4;
                    return (anomalySet.has(`${srcId}-${tgtId}`) || anomalySet.has(`${tgtId}-${srcId}`)) ? 5 : 2;
                  }}
                  linkDirectionalArrowRelPos={1}
                  linkDirectionalParticles={(l: any) => {
                    if (l.type === 'CROSS_CASE_LINK') return 2;
                    const srcId = getId(l.source);
                    const tgtId = getId(l.target);
                    return (anomalySet.has(`${srcId}-${tgtId}`) || anomalySet.has(`${tgtId}-${srcId}`)) ? 4 : 0;
                  }}
                  linkDirectionalParticleColor={(l: any) => {
                    if (l.type === 'CROSS_CASE_LINK') return '#a78bfa'; // light purple
                    const srcId = getId(l.source);
                    const tgtId = getId(l.target);
                    return (anomalySet.has(`${srcId}-${tgtId}`) || anomalySet.has(`${tgtId}-${srcId}`)) ? '#ef4444' : '#6b7280';
                  }}
                  linkDirectionalParticleSpeed={0.006}
                  onNodeClick={handleNodeClick}
                  onNodeRightClick={handleRightClick}
                  enableNodeDrag={true}
                  d3VelocityDecay={0.3}
                  showNavInfo={false}
                />
              </GraphErrorBoundary>
            )}
          </div>

          {/* ── AI Evidence Sidebar */}
          <div className="w-96 bg-gray-900 rounded-xl border border-gray-800 flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">AI Intelligence Panel</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-950/20">
              <div className="space-y-6">
                {aiHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-gray-700" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Click any node to begin<br/>AI forensic analysis</p>
                  </div>
                ) : (
                  aiHistory.map((item, idx) => (
                    <div key={idx} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* View Case File button for Case nodes */}
                      {item.type === 'Case' && item.status === 'done' && (
                        <button
                          onClick={() => {
                            const linkedCaseId = item.properties?.id;
                            if (linkedCaseId) navigate(`/io/case/${linkedCaseId}`);
                          }}
                          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 hover:from-purple-800/60 hover:to-indigo-800/60 border border-purple-500/30 rounded-lg text-purple-300 text-xs font-bold transition-all duration-200 group"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          View Case File
                          <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition" />
                        </button>
                      )}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${item.type === 'Case' ? 'bg-yellow-900/30 border-yellow-500/20' : 'bg-blue-900/30 border-blue-500/20'}`}>
                            {item.type === 'Case' ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400" /> : <Search className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{item.type === 'Case' ? 'Cross-Case Intelligence' : 'Investigation Log'}</p>
                            <p className="text-xs font-bold text-gray-200 truncate max-w-[140px]">{item.label}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          item.status === 'done' ? 'bg-emerald-900/40 text-emerald-400' :
                          item.status === 'error' ? 'bg-red-900/40 text-red-400' :
                          'bg-blue-900/40 text-blue-400 animate-pulse'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs">
                        <IntelligenceRenderer text={item.text} />
                        
                        {item.status === 'thinking' && !item.text && (
                          <div className="flex items-center gap-2 py-3 bg-gray-900/50 rounded-lg px-3 border border-gray-800/50">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-[11px] text-gray-400 italic">Extracting evidence profiles...</span>
                          </div>
                        )}

                        {item.status === 'streaming' && (
                           <div className="mt-2 flex items-center gap-2">
                              <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">AI Processing...</span>
                           </div>
                        )}
                      </div>

                      {item.evidence.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700/40">
                          <p className="text-[10px] uppercase font-black text-gray-500 mb-2 tracking-widest flex items-center gap-2">
                            <RefreshCw className="w-3 h-3" /> Artifact Correlation
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.evidence.slice(0, 8).map((ev, ei) => (
                              <span key={ei} className="px-2 py-1 bg-gray-950 border border-gray-800 rounded text-[10px] text-gray-400 hover:text-white transition cursor-default">
                                {ev.source?.name || ev.source?.type || 'Source Item'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} className="h-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex gap-4 text-xs text-gray-500 pb-2">
          <span>{data.nodes.length} Nodes</span>
          <span>{data.edges.length} Edges</span>
          <span className={data.anomalies.length > 0 ? 'text-red-400 font-semibold' : ''}>
            {data.anomalies.length} Cycles
          </span>
          {expandedNodes.size > 0 && <span className="text-green-400">{expandedNodes.size} Expanded</span>}
        </div>
      </div>
    </div>
  );
};
