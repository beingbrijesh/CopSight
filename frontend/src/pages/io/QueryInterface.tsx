import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, History, Sparkles, X, Brain, Trash2, User, MessageCircle, Bot, AlertCircle, Plus, Info } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { QueryHistory } from '../../components/QueryHistory';
import { EvidenceChip } from '../../components/EvidenceChip';
import axios from 'axios';
import ForceGraph3D from 'react-force-graph-3d';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface EvidenceItem {
  id: string;
  content: string;
  score: number;
  source?: { type: string; name: string };
  metadata?: any;
  value?: string;
}

type StreamStatus = 'idle' | 'thinking' | 'streaming' | 'done' | 'error';

interface MiniGraphData {
  nodes: any[];
  edges: any[];
  anomalies: any[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: StreamStatus;
  statusMessage?: string;
  evidence?: EvidenceItem[];
  findings?: any[];
  confidence?: number;
  hasRelationships?: boolean;
  fromCache?: boolean;
  miniGraph?: MiniGraphData | null;
}

// ─────────────────────────────────────────
// Mini Graph Component
// ─────────────────────────────────────────
const MiniGraph = ({ data }: { data: MiniGraphData }) => {
  const NODE_COLORS: Record<string, string> = {
    PhoneNumber: '#10f981',
    Contact: '#3b82f6',
    Device: '#818cf8',
    CryptoAddress: '#f59e0b',
    Default: '#6b7280'
  };

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-700 overflow-hidden mt-4 shadow-2xl relative" style={{ height: 320 }}>
      <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 bg-gray-900/80 backdrop-blur-md border-b border-gray-700 text-[10px] text-gray-400 font-black uppercase tracking-widest flex justify-between items-center">
        <span>🔗 Forensic Relationship Map</span>
        <span className="text-blue-400">{data.nodes.length} Entities</span>
      </div>
      <ForceGraph3D
        width={640}
        height={320}
        backgroundColor="#030712"
        graphData={{ nodes: data.nodes, links: data.edges }}
        nodeLabel={(n: any) => `${n.label} (${n.type})`}
        nodeColor={(n: any) => NODE_COLORS[n.type] || NODE_COLORS.Default}
        nodeVal={() => 5}
        linkColor={() => 'rgba(107, 114, 128, 0.4)'}
        linkWidth={1.5}
        showNavInfo={false}
        d3VelocityDecay={0.3}
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [historyVersion, setHistoryVersion] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const exampleQueries = [
    "Identify high-frequency foreign communication patterns",
    "Trace transactions exceeding 5,000 USDT",
    "Analyze WhatsApp messages for 'hawala' keywords",
    "Map connections between suspect and top 3 associates",
    "Show suspicious night-time calls (11 PM - 4 AM)"
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessage = useCallback((id: string, updater: (msg: Message) => Message) => {
    setMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
  }, []);

  const handleExecute = useCallback(async (textToSubmit: string) => {
    if (!textToSubmit.trim()) return;

    // Prevent multiple concurrent queries
    const active = messages.length > 0 && (messages[messages.length-1].status === 'thinking' || messages[messages.length-1].status === 'streaming');
    if (active) return;

    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;

    const userMsg: Message = { id: userMsgId, role: 'user', content: textToSubmit };
    const asstMsg: Message = { 
      id: asstMsgId, 
      role: 'assistant', 
      content: '', 
      status: 'thinking', 
      statusMessage: 'Scanning database...',
      evidence: [],
      findings: []
    };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setQuery('');
    
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
        body: JSON.stringify({ 
          queryText: textToSubmit, 
          queryType: 'natural_language',
          sessionId 
        }),
        signal: abortRef.current.signal
      });

      if (!response.ok) {
        throw new Error('AI Service error');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream body');

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
            updateMessage(asstMsgId, m => ({ ...m, status: 'done' }));
            setHistoryVersion(v => v + 1); // Trigger sidebar refresh
            break;
          }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'status') {
              updateMessage(asstMsgId, m => ({ 
                ...m, 
                statusMessage: parsed.message || m.statusMessage,
                status: parsed.status === 'streaming' ? 'streaming' : m.status
              }));
            } else if (parsed.type === 'token') {
              updateMessage(asstMsgId, m => ({ 
                ...m, 
                content: m.content + parsed.token,
                status: 'streaming'
              }));
            } else if (parsed.type === 'metadata') {
              updateMessage(asstMsgId, m => ({
                ...m,
                evidence: parsed.evidence || [],
                findings: parsed.findings || [],
                confidence: parsed.confidence || 0,
                hasRelationships: parsed.has_relationships || false,
                fromCache: parsed.from_cache || false,
                status: 'done'
              }));
              
              if (parsed.has_relationships) {
                fetchMiniGraph(asstMsgId, textToSubmit);
              }
            }
          } catch (e) {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      updateMessage(asstMsgId, m => ({ 
        ...m, 
        status: 'error', 
        content: 'Failed to retrieve AI analysis. Ensure background services are running.' 
      }));
    }
  }, [caseId, messages, updateMessage]);

  const fetchMiniGraph = async (msgId: string, q: string) => {
    try {
      const res = await axios.post(`http://localhost:8005/api/query/relationships`, {
        case_id: parseInt(caseId!),
        query: q,
        user_id: 1
      });
      if (res.data.has_graph) {
        updateMessage(msgId, m => ({ ...m, miniGraph: res.data.graph }));
      }
    } catch (e) {}
  };

  const clearChat = () => {
    if (messages.length > 0 && !window.confirm('Start a new forensic investigation? Current chat history will be cleared from view.')) {
      return;
    }
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setHistoryVersion(v => v + 1);
    abortRef.current?.abort();
  };

  const handleSelectHistoryItem = useCallback((item: any) => {
    // If we have a stored answer, load it as a pair of messages (User and Assistant)
    // This allows "recalling" an investigation without re-running the LLM.
    const userMsg: Message = { 
      id: `u-hist-${item.id}`, 
      role: 'user', 
      content: item.queryText || item.query_text 
    };
    
    const asstMsg: Message = {
      id: `a-hist-${item.id}`,
      role: 'assistant',
      content: item.answer || 'No answer stored.',
      status: 'done',
      evidence: item.evidence || [],
      findings: item.findings || []
    };

    setMessages([userMsg, asstMsg]);
    // Set the session ID to the history item's session if available, 
    // so follow-up queries continue that thread's context.
    if (item.sessionId || item.session_id) {
      setSessionId(item.sessionId || item.session_id);
    }
  }, []);

  // ── Advanced Markdown & Forensic Highlighting ──────────────────────
  
  const parseMarkdown = (text: string, msgEvidence: EvidenceItem[]) => {
    if (!text) return null;

    // Pre-processing: Highlight forensic terms (Money, Crime, Comms)
    const highlight = (str: string) => {
      let parts: any[] = [str];
      
      const applyRegex = (regex: RegExp, className: string) => {
        parts = parts.flatMap(p => {
          if (typeof p !== 'string') return p;
          return p.split(regex).map((chunk, i) => 
            regex.test(chunk) ? <span key={i} className={className}>{chunk}</span> : chunk
          );
        });
      };

      // Financials (Green)
      applyRegex(/(transaction|usdt|crypto|bitcoin|usdc|transfer|amount|payment|funds|money|wallet|bank|account)/gi, "text-emerald-500 font-bold bg-emerald-500/10 px-1 rounded mx-0.5 border-b border-emerald-500/30");
      // Crimes (Red)
      applyRegex(/(suspicious|fraud|laundering|scam|stolen|hacking|illicit|crime|illegal|malicious|syndicate|threat)/gi, "text-rose-500 font-bold bg-rose-500/10 px-1 rounded mx-0.5 border-b border-rose-500/30");
      // Comms (Blue)
      applyRegex(/(whatsapp|telegram|signal|call|message|sms|chat|log|ip address|email|server|contact|phone)/gi, "text-blue-500 font-bold bg-blue-500/10 px-1 rounded mx-0.5 border-b border-blue-500/30");

      return parts;
    };

    // Replace evidence chunks
    const insertEvidence = (parts: any[]) => {
      if (msgEvidence.length === 0) return parts;
      
      const searchMap = new Map<string, EvidenceItem>();
      msgEvidence.forEach(ev => {
        const terms = [ev.value, ev.source?.name, ev.metadata?.sender, ev.metadata?.receiver, ev.metadata?.tx_hash, ev.metadata?.address].filter(t => t && t.length > 3);
        terms.forEach(t => searchMap.set(t!.toLowerCase(), ev));
      });

      if (searchMap.size === 0) return parts;
      const sortedKeys = Array.from(searchMap.keys()).sort((a,b) => b.length - a.length);
      const regex = new RegExp(`(${sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

      return parts.flatMap(p => {
        if (typeof p !== 'string') return p;
        return p.split(regex).map((chunk, i) => {
          const match = searchMap.get(chunk.toLowerCase());
          if (match) {
            const mappedType = match.source?.type?.includes('call') ? 'call' : match.source?.type?.includes('msg') || match.source?.type?.includes('whatsapp') ? 'message' : 'entity';
            return (
              <span key={`ev-${i}`} className="inline-block align-bottom mx-0.5">
                <EvidenceChip 
                  compact 
                  evidence={{
                    ...match, 
                    type: mappedType as any,
                    value: match.value || match.content || 'Evidence',
                    source: {
                      view: 'AI Chat',
                      caseId: caseId!,
                      evidenceId: match.id
                    }
                  }} 
                  className="scale-90 origin-bottom"
                />
              </span>
            );
          }
          return chunk;
        });
      });
    };

    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={i} className="text-gray-100 font-bold mt-4 mb-2 text-sm border-l-2 border-purple-500/50 pl-2">{insertEvidence(highlight(line.slice(4)))}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-purple-400 font-black mt-6 mb-3 text-base flex items-center gap-2 tracking-tight uppercase"><Sparkles className="w-4 h-4"/> {insertEvidence(highlight(line.slice(3)))}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-white font-black mt-8 mb-4 text-xl border-b border-gray-800 pb-2">{insertEvidence(highlight(line.slice(2)))}</h1>;
      
      // Bullets
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().slice(2);
        const boldParts = content.split(/\*\*(.*?)\*\*/g);
        const rendered = boldParts.map((part, idx) => {
          if (idx % 2 !== 0) return <strong key={idx} className="text-white font-extrabold bg-white/5 px-1 rounded">{insertEvidence(highlight(part))}</strong>;
          return insertEvidence(highlight(part));
        });
        return (
          <div key={i} className="flex gap-2 ml-4 my-2 text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
            <div className="flex-1">{rendered}</div>
          </div>
        );
      }

      // Paragraph & Bold Handling
      // We extract bold **text** and render as highlighted/bold
      const boldParts = line.split(/\*\*(.*?)\*\*/g);
      const renderedLine = boldParts.map((part, idx) => {
        if (idx % 2 !== 0) {
          return <strong key={idx} className="text-white font-extrabold bg-white/5 px-1 rounded">{insertEvidence(highlight(part))}</strong>;
        }
        return insertEvidence(highlight(part));
      });

      return <p key={i} className="my-2 leading-relaxed text-gray-400 text-sm">{renderedLine}</p>;
    });
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col text-white overflow-hidden">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for Sessions/History */}
        <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Investigation Log
            </h3>
            <button 
              onClick={clearChat}
              className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition"
              title="Reset Chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              <QueryHistory 
                caseId={parseInt(caseId!)} 
                onSelectQuery={handleSelectHistoryItem} 
                refreshTrigger={historyVersion}
              />
          </div>
          
          <div className="p-4 border-t border-gray-800 bg-black/20">
            <p className="text-[10px] text-gray-600 font-bold uppercase mb-3">Templates</p>
            <div className="space-y-2">
              {exampleQueries.slice(0, 3).map((ex, i) => (
                <button 
                  key={i} 
                  onClick={() => setQuery(ex)}
                  className="w-full text-left p-2 rounded-lg bg-gray-800/50 hover:bg-purple-600/20 border border-transparent hover:border-purple-500/30 text-[11px] text-gray-400 hover:text-white transition group flex gap-2 items-start"
                >
                  <MessageCircle className="w-3 h-3 mt-0.5 group-hover:text-purple-400" />
                  <span className="line-clamp-2">{ex}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-[#030712] overflow-hidden">
          {/* Top Bar Controls */}
          <div className="h-14 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-950/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition"
              >
                <History className="w-5 h-5" />
              </button>
              <div className="h-4 w-[1px] bg-gray-800 mx-1" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold tracking-tight">Forensic Intelligence Assistant</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {messages.length >= 10 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse group relative cursor-help">
                  <Info className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 line-clamp-1">Context Full</span>
                  
                  {/* Tooltip */}
                  <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <p className="text-[10px] text-gray-400 leading-relaxed normal-case font-medium">
                      The AI&apos;s short-term memory buffer is at capacity. To maintain high analytical precision, we recommend starting a <strong className="text-purple-400">New Investigation</strong>.
                    </p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={clearChat}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition shadow-[0_0_15px_rgba(147,51,234,0.3)] group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                <span className="text-xs font-black uppercase tracking-widest px-1">New Investigation</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll Container */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 mb-6 relative">
                   <div className="absolute inset-0 bg-purple-600/20 rounded-full animate-ping" />
                   <div className="absolute inset-0 border-2 border-purple-500/50 rounded-full animate-pulse" />
                   <div className="relative z-10 w-full h-full bg-gray-900 rounded-full flex items-center justify-center">
                      <Brain className="w-10 h-10 text-purple-400" />
                   </div>
                </div>
                <h1 className="text-3xl font-black text-white tracking-tighter mb-4">Forensic Brain initialized.</h1>
                <p className="text-gray-500 max-w-sm mb-10 leading-relaxed font-medium">
                  Query case files, communication logs, and transaction nodes using natural language. I will find patterns for you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                   {exampleQueries.map((ex, i) => (
                     <button 
                       key={i} 
                       onClick={() => handleExecute(ex)}
                       className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-purple-500/40 hover:bg-purple-600/10 text-left transition group"
                     >
                       <p className="text-sm font-bold text-gray-300 group-hover:text-white transition">{ex}</p>
                       <p className="text-[10px] text-gray-600 group-hover:text-gray-400 mt-1 uppercase font-black tracking-widest">Execute Profile</p>
                     </button>
                   ))}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-10">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex gap-4 animate-in fade-in slide-in-from-bottom-5 duration-500 ${msg.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(147,51,234,0.3)] border border-purple-400/50">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    
                    <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'max-w-[70%]' : ''}`}>
                      <div className={`p-5 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-purple-600/90 backdrop-blur-md text-white shadow-xl rounded-tr-sm border border-purple-500/50' 
                          : 'bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-tl-sm'
                      }`}>
                         {msg.role === 'assistant' && (
                           <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-800">
                             <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${
                                  msg.status === 'thinking' ? 'bg-amber-500 animate-pulse' :
                                  msg.status === 'streaming' ? 'bg-blue-500 animate-ping' :
                                  msg.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                                }`} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                  {msg.status === 'thinking' ? (msg.statusMessage || 'Analyzing') : 
                                   msg.status === 'streaming' ? 'Streaming Live' : 
                                   msg.status === 'error' ? 'Analysis Halted' : 'Analysis Verified'}
                                </span>
                             </div>
                             {msg.confidence && msg.confidence > 0 && (
                               <div className="ml-auto text-[10px] font-bold text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
                                 Confidence: {Math.round(msg.confidence * 100)}%
                               </div>
                             )}
                           </div>
                         )}

                         <div className="space-y-2">
                           {msg.role === 'user' ? (
                             <p className="text-base font-medium leading-relaxed font-sans">{msg.content}</p>
                           ) : (
                             <>
                               {msg.status === 'thinking' && !msg.content ? (
                                 <div className="space-y-2">
                                    <div className="h-4 bg-gray-800 rounded w-full animate-pulse" />
                                    <div className="h-4 bg-gray-800 rounded w-5/6 animate-pulse" />
                                    <div className="h-4 bg-gray-800 rounded w-4/6 animate-pulse" />
                                 </div>
                               ) : (
                                 <div className="prose-assistant">
                                   {parseMarkdown(msg.content, msg.evidence || [])}
                                   {msg.status === 'streaming' && (
                                      <span className="inline-block w-2.5 h-4 bg-blue-500 ml-1.5 animate-pulse align-middle rounded-sm" />
                                   )}
                                 </div>
                               )}

                               {msg.miniGraph && <MiniGraph data={msg.miniGraph} />}

                               {msg.findings && msg.findings.length > 0 && (
                                 <div className="mt-8 pt-6 border-t border-gray-800">
                                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-4 flex items-center gap-2">
                                     <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Extracted Insights
                                   </p>
                                   <div className="space-y-3">
                                     {msg.findings.map((f, fi) => (
                                       <div key={fi} className="p-4 rounded-xl bg-black/40 border border-gray-800/50 hover:border-purple-500/30 transition-colors flex gap-3 group">
                                          <span className="text-xs font-black text-purple-500/50 mt-0.5">{fi+1}</span>
                                          <p className="text-sm text-gray-400 group-hover:text-gray-300 transition">{typeof f === 'string' ? f : (f.finding || '')}</p>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               )}
                               
                               {msg.evidence && msg.evidence.length > 0 && (
                                 <div className="mt-8 pt-6 border-t border-gray-800">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-4 flex items-center gap-2">
                                      <AlertCircle className="w-3.5 h-3.5 text-blue-400" /> Ground Truth Sources
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                       {msg.evidence.slice(0, 12).map((ev, ei) => (
                                         <EvidenceChip 
                                           key={ei} 
                                           compact 
                                           evidence={{
                                             ...ev, 
                                             type: (ev.source?.type?.includes('call') ? 'call' : ev.source?.type?.includes('msg') ? 'message' : 'entity') as any,
                                             value: ev.value || ev.content || 'Artifact',
                                             source: {
                                               view: 'AI Chat',
                                               caseId: caseId!,
                                               evidenceId: ev.id
                                             }
                                           }} 
                                         />
                                       ))}
                                       {msg.evidence.length > 12 && (
                                         <span className="px-2 py-1 bg-gray-900 border border-gray-800 rounded text-[9px] font-bold text-gray-600 flex items-center">
                                            +{msg.evidence.length - 12} Artifacts
                                         </span>
                                       )}
                                    </div>
                                 </div>
                               )}
                             </>
                           )}
                      </div>
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Bottom Prompt Area */}
          <div className="p-6 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent relative">
            <div className="max-w-4xl mx-auto relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl blur opacity-25 group-focus-within:opacity-75 transition duration-1000 group-focus-within:duration-200" />
               <div className="relative bg-gray-900/90 border border-gray-800 rounded-2xl p-2 flex items-center shadow-2xl focus-within:border-purple-500/50 transition-all">
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecute(query)}
                    placeholder="Enter forensic query... (e.g. 'Show me financial flow between suspected nodes')"
                    className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 px-4 py-3 text-base text-gray-100 placeholder-gray-600"
                  />
                  
                  {messages.length > 0 && messages[messages.length-1].status === 'streaming' ? (
                    <button 
                      onClick={() => abortRef.current?.abort()}
                      className="p-3 bg-rose-600/20 hover:bg-rose-600/40 text-rose-500 rounded-xl transition flex items-center gap-2 mr-1"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-widest px-1">Abort</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleExecute(query)}
                      disabled={!query.trim()}
                      className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 text-white rounded-xl transition flex items-center gap-2 mr-1 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                    >
                      <Send className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-widest px-2">Analyze</span>
                    </button>
                  )}
               </div>
               
               <div className="flex justify-between items-center px-4 mt-3">
                  <div className="flex gap-4">
                     <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full" /> Neural Engine Online
                     </p>
                     <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full" /> Graph Context Ready
                     </p>
                  </div>
                  <p className="text-[10px] text-gray-700 font-medium">Press ↵ Enter to submit</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
        
        .prose-assistant h1, .prose-assistant h2, .prose-assistant h3 {
          font-family: inherit;
        }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-bottom { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .animate-in {
          animation-duration: 0.5s;
          animation-fill-mode: both;
        }
      `}</style>
    </div>
  );
};
