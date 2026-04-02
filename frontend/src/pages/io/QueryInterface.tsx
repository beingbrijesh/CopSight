import { useState, useRef, useCallback } from 'react';
import { Send, Loader2, History, Sparkles, X, Brain } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../../components/Navbar.tsx';
import { QueryHistory } from '../../components/QueryHistory.tsx';
import axios from 'axios';

// ─────────────────────────────────────────
// Evidence item from AI stream metadata
// ─────────────────────────────────────────
interface EvidenceItem {
  id: string;
  content: string;
  score: number;
  source?: { type: string; name: string };
  metadata?: any;
}

type StreamStatus = 'idle' | 'thinking' | 'streaming' | 'done' | 'error';

// ─────────────────────────────────────────
// Mini inline graph for relationship results
// ─────────────────────────────────────────
import ForceGraph3D from 'react-force-graph-3d';

interface MiniGraphData {
  nodes: any[];
  edges: any[];
  anomalies: any[];
}

const MiniGraph = ({ data, caseId }: { data: MiniGraphData; caseId: string }) => {
  const NODE_COLORS: Record<string, string> = {
    PhoneNumber: '#10f981',
    Contact: '#3b82f6',
    Device: '#818cf8',
    CryptoAddress: '#f59e0b',
    Default: '#6b7280'
  };

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-700 overflow-hidden" style={{ height: 280 }}>
      <div className="px-3 py-2 bg-gray-900 border-b border-gray-700 text-xs text-gray-400 font-semibold">
        🔗 Relationship Map — {data.nodes.length} entities
      </div>
      <ForceGraph3D
        width={580}
        height={242}
        backgroundColor="#030712"
        graphData={{ nodes: data.nodes, links: data.edges }}
        nodeLabel={(n: any) => `${n.label} (${n.type})`}
        nodeColor={(n: any) => NODE_COLORS[n.type] || NODE_COLORS.Default}
        nodeVal={(n: any) => 4}
        linkColor={() => 'rgba(107, 114, 128, 0.4)'}
        linkWidth={1}
        showNavInfo={false}
        d3VelocityDecay={0.4}
      />
    </div>
  );
};

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export const QueryInterface = () => {
  const { caseId } = useParams();
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Stream state
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [streamText, setStreamText] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [findings, setFindings] = useState<any[]>([]);
  const [hasRelationships, setHasRelationships] = useState(false);
  const [miniGraph, setMiniGraph] = useState<MiniGraphData | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const exampleQueries = [
    "Show me all communications with foreign numbers",
    "Find messages mentioning 'payment' or 'transfer'",
    "List all WhatsApp messages after September 1st",
    "Who did the suspect communicate with most frequently?",
    "How are the top two entities connected?",
    "Show late-night communications (12 AM - 5 AM)"
  ];

  const resetState = () => {
    setStreamText('');
    setEvidence([]);
    setFindings([]);
    setConfidence(0);
    setHasRelationships(false);
    setMiniGraph(null);
    setFromCache(false);
    setStatusMessage('');
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || streamStatus === 'thinking' || streamStatus === 'streaming') return;

    resetState();
    setStreamStatus('thinking');
    setStatusMessage('Connecting to AI service...');

    // Cancel previous stream if any
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`http://localhost:8080/api/query/case/${caseId}/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ queryText: query, queryType: 'natural_language' }),
        signal: abortRef.current.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setStreamText(errData.message || 'Server error. Please try again.');
        setStreamStatus('error');
        return;
      }

      if (!response.body) {
        setStreamText('Streaming not supported. Please try again.');
        setStreamStatus('error');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            setStreamStatus('done');
            break;
          }
          try {
            const parsed = JSON.parse(raw);

            if (parsed.type === 'status') {
              setStatusMessage(parsed.message || '');
              if (parsed.status === 'streaming') setStreamStatus('streaming');
            } else if (parsed.type === 'token') {
              setStreamText(prev => prev + parsed.token);
              if (streamStatus !== 'streaming') setStreamStatus('streaming');
            } else if (parsed.type === 'metadata') {
              setEvidence(parsed.evidence || []);
              setFindings(parsed.findings || []);
              setConfidence(parsed.confidence || 0);
              setHasRelationships(parsed.has_relationships || false);
              setFromCache(parsed.from_cache || false);

              // If relationship intent detected, fetch mini-graph
              if (parsed.has_relationships && caseId) {
                fetchRelationshipGraph(query);
              }
              setStreamStatus('done');
            } else if (parsed.type === 'error') {
              setStreamText(parsed.message || 'An error occurred.');
              setStreamStatus('error');
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // user cancelled
      const isOffline = err.message?.includes('ECONNREFUSED') || err.message?.includes('Failed to fetch');
      setStreamText(isOffline
        ? '🔌 AI Service is not running. Start the ai-service and try again.'
        : '❌ Unexpected error. Check your connection and retry.');
      setStreamStatus('error');
    }
  }, [query, caseId, streamStatus]);

  const fetchRelationshipGraph = async (queryText: string) => {
    try {
      const res = await axios.post(`http://localhost:8005/api/query/relationships`, {
        case_id: parseInt(caseId!),
        query: queryText,
        user_id: 0 // will use auth context in real scenario
      }, { timeout: 30000 });

      if (res.data.has_graph) {
        setMiniGraph(res.data.graph);
      }
    } catch {
      // non-fatal: mini graph is a bonus
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreamStatus('done');
  };

  const isProcessing = streamStatus === 'thinking' || streamStatus === 'streaming';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Natural Language Query
            </h1>
            <p className="text-gray-600 mt-1">Ask questions about the case data in plain English</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <History className="w-4 h-4" />
            Query History
          </button>
        </div>

        {/* Query Input */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about the case data..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                disabled={isProcessing}
              />
              {isProcessing ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Execute
                </button>
              )}
            </div>
          </form>

          {/* Example Queries */}
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(example)}
                  className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition"
                  disabled={isProcessing}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Query History */}
        {showHistory && (
          <div className="mb-6">
            <QueryHistory caseId={parseInt(caseId!)} onSelectQuery={setQuery} />
          </div>
        )}

        {/* ── STREAM RESULTS ── */}
        {streamStatus !== 'idle' && (
          <div className="space-y-4">
            {/* Answer card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* Status bar */}
              <div className="flex items-center gap-3 mb-4">
                {streamStatus === 'thinking' && (
                  <div className="flex items-center gap-2 text-purple-600">
                    <Brain className="w-5 h-5 animate-pulse" />
                    <span className="text-sm font-medium animate-pulse">{statusMessage || 'Searching & Analyzing Evidence...'}</span>
                  </div>
                )}
                {streamStatus === 'streaming' && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Generating analysis...</span>
                  </div>
                )}
                {streamStatus === 'done' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-green-600 font-medium">✓ Analysis complete</span>
                    {fromCache && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">From cache</span>}
                    {confidence > 0 && (
                      <span className="text-xs text-gray-500">
                        Confidence: <strong>{(confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                    {hasRelationships && (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                        🔗 Relationship Graph Detected
                      </span>
                    )}
                  </div>
                )}
                {streamStatus === 'error' && (
                  <span className="text-sm text-red-600">⚠ Error</span>
                )}
              </div>

              {/* AI text with typewriter cursor */}
              <div className="prose prose-sm max-w-none text-gray-800 bg-gray-50 rounded-lg p-4 border border-gray-200 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                {streamText || (
                  streamStatus === 'thinking' ? (
                    <span className="text-gray-400 italic animate-pulse">
                      Analyzing case data, searching evidence...
                    </span>
                  ) : null
                )}
                {streamStatus === 'streaming' && (
                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>

            {/* Inline Relationship Mini-Graph */}
            {miniGraph && miniGraph.nodes.length > 0 && (
              <div>
                <MiniGraph data={miniGraph} caseId={caseId!} />
              </div>
            )}

            {/* Findings */}
            {findings.length > 0 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Key Findings ({findings.length})
                </h3>
                <ul className="space-y-2">
                  {findings.map((f: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 bg-purple-50 rounded-lg p-3">
                      <span className="text-purple-400 font-bold flex-shrink-0 mt-0.5">{idx + 1}.</span>
                      <span>{typeof f === 'string' ? f : f.finding || JSON.stringify(f)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence cards */}
            {evidence.length > 0 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Supporting Evidence ({evidence.length} records)
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {evidence.map((ev: EvidenceItem, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {ev.source?.name || ev.source?.type || 'Source'}
                        </span>
                        <span className="text-gray-400 text-xs">
                          Score: {((ev.score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-gray-700 line-clamp-4 leading-relaxed">{ev.content || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {streamStatus === 'idle' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to analyze case data</h3>
            <p className="text-gray-600">
              Enter a natural language query above or click an example to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
