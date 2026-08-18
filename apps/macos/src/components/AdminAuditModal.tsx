import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  X,
  Trash2,
  Download,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  Terminal,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { loggerService, AuditLogEntry, LogLevel } from '../lib/loggerService';

interface AdminAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAuditModal: React.FC<AdminAuditModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedEntry, setCopiedEntry] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = loggerService.subscribeLogs((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = filterLevel === 'ALL' || l.level === filterLevel;
    const matchesSearch =
      searchTerm === '' ||
      l.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.stack && l.stack.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  const handleCopyAll = async () => {
    const ok = await loggerService.copyLogsToClipboard(true);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const handleCopyEntry = async (entry: AuditLogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopiedEntry(true);
      setTimeout(() => setCopiedEntry(false), 2500);
    } catch {
      // Fallback
    }
  };

  const errorCount = logs.filter((l) => l.level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.level === 'WARN').length;
  const actionCount = logs.filter((l) => l.level === 'ACTION').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-fadeIn select-text">
      <div className="glass-panel w-full max-w-6xl h-[85vh] rounded-[2.5rem] p-6 sm:p-8 flex flex-col shadow-2xl border border-white/20 overflow-hidden select-text">
        
        {/* Top Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold text-white tracking-tight">Administrator Diagnostic & Audit Center</h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold uppercase">
                  Admin Exclusive
                </span>
              </div>
              <p className="text-xs font-mono text-white/75 mt-0.5">
                Real-time chain of events, API errors, UI telemetry, and system warning traces.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer shadow-sm"
              title="Copy entire audit trail to clipboard"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <button
              type="button"
              onClick={() => loggerService.exportLogsJson()}
              className="px-3.5 py-2 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Save JSON dossier into Downloads and reveal in Finder"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Dossier</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all audit logs from memory?')) {
                  loggerService.clearLogs();
                  setSelectedEntry(null);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 border border-red-500/30 transition-all cursor-pointer shadow-sm"
              title="Clear In-Memory Log Buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer ml-2"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterLevel('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                filterLevel === 'ALL'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 text-white/75 hover:bg-white/10 border border-white/10'
              }`}
            >
              All Events ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('ERROR')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'ERROR'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Errors ({errorCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('WARN')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'WARN'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Warnings ({warnCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('ACTION')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'ACTION'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/20'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Clicks & Actions ({actionCount})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search traces, errors, APIs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-full bg-black/30 dark:bg-black/50 border border-white/15 text-xs font-mono text-white outline-none focus:border-white transition-all"
            />
          </div>
        </div>

        {/* Main Log Viewer & Detail Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 pt-2">
          
          {/* Left / Top: Logs Table */}
          <div className={`${selectedEntry ? 'lg:col-span-7' : 'lg:col-span-12'} bg-black/40 rounded-2xl border border-white/10 overflow-y-auto font-mono text-xs shadow-inner flex flex-col`}>
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60 p-8">
                <Terminal className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-bold">No matching diagnostic records.</p>
                <p className="text-xs opacity-75 mt-1">Events and errors will populate automatically in real-time.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredLogs.slice().reverse().map((entry) => {
                  let badgeStyle = 'bg-white/10 text-white border-white/15';
                  let icon = <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />;

                  if (entry.level === 'ERROR') {
                    badgeStyle = 'bg-red-500/20 text-red-300 border-red-500/30';
                    icon = <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
                  } else if (entry.level === 'WARN') {
                    badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />;
                  } else if (entry.level === 'ACTION') {
                    badgeStyle = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                    icon = <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />;
                  }

                  const isSelected = selectedEntry?.id === entry.id;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`p-3 hover:bg-white/5 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected ? 'bg-white/10 border-l-4 border-l-white' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 overflow-hidden">
                        {icon}
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] px-2 py-0.2 rounded font-bold uppercase border ${badgeStyle}`}>
                              {entry.level}
                            </span>
                            <span className="text-[10px] opacity-75 font-semibold text-white/90">
                              [{entry.category}]
                            </span>
                            <span className="text-[9.5px] opacity-50">
                              {entry.timestamp.slice(11, 23)}
                            </span>
                          </div>
                          <p className="text-white/90 font-medium text-[11px] truncate leading-tight">
                            {entry.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected Log Entry Stack Trace & Metadata Inspector */}
          {selectedEntry && (
            <div className="lg:col-span-5 bg-black/60 rounded-2xl border border-white/15 p-4 overflow-y-auto font-mono text-xs flex flex-col justify-between shadow-xl select-text">
              <div className="space-y-3 select-text">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">Event Detail Inspector</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyEntry(selectedEntry)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono flex items-center gap-1 border border-white/10 transition-all cursor-pointer"
                      title="Copy this event JSON"
                    >
                      {copiedEntry ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedEntry ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(null)}
                      className="opacity-70 hover:opacity-100 text-xs ml-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-[11px]">
                  <span className="opacity-60 block">Message:</span>
                  <p className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-medium break-words">
                    {selectedEntry.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded bg-black/40 border border-white/10">
                    <span className="opacity-60 block">Category:</span>
                    <span className="font-bold text-white">{selectedEntry.category}</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/10">
                    <span className="opacity-60 block">Timestamp:</span>
                    <span className="text-white">{selectedEntry.timestamp}</span>
                  </div>
                </div>

                {selectedEntry.metadata && (
                  <div className="space-y-1 text-[10px]">
                    <span className="opacity-60 block">Metadata / Context:</span>
                    <pre className="p-2.5 rounded-xl bg-black/50 border border-white/10 text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEntry.stack && (
                  <div className="space-y-1 text-[10px]">
                    <span className="opacity-60 block text-red-300">Stack Trace:</span>
                    <pre className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 overflow-x-auto whitespace-pre-wrap leading-tight">
                      {selectedEntry.stack}
                    </pre>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/10 mt-3 flex justify-between items-center text-[10px] opacity-60">
                <span>Record ID: {selectedEntry.id}</span>
                <span>SHA-256 Verified</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
