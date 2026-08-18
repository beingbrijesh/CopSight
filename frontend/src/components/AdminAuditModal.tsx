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
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { loggerService } from '../lib/loggerService';
import type { AuditLogEntry, LogLevel } from '../lib/loggerService';

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
      // Ignore
    }
  };

  const errorCount = logs.filter((l) => l.level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.level === 'WARN').length;
  const actionCount = logs.filter((l) => l.level === 'ACTION').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fade-in select-text">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[85vh] rounded-3xl p-6 sm:p-8 flex flex-col shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden select-text text-gray-900 dark:text-white">
        
        {/* Top Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold tracking-tight">System Audit & Diagnostic Center</h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 font-bold uppercase">
                  Admin Exclusive
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Real-time chain of events, API requests, authentication, and error telemetry across all systems.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-xs font-mono font-bold flex items-center gap-1.5 border border-gray-200 dark:border-white/10 transition cursor-pointer shadow-sm"
              title="Copy entire audit trail to clipboard"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-600 dark:text-slate-300" />}
              <span>{copiedAll ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <button
              type="button"
              onClick={() => loggerService.exportLogsJson()}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Save JSON dossier file"
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
              className="px-3.5 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 border border-red-200 dark:border-red-500/30 transition cursor-pointer shadow-sm"
              title="Clear In-Memory Log Buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-white transition cursor-pointer ml-2"
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
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition cursor-pointer ${
                filterLevel === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10'
              }`}
            >
              All Events ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('ERROR')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'ERROR'
                  ? 'bg-red-600 text-white shadow-sm'
                  : errorCount > 0
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-500'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Errors ({errorCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('WARN')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'WARN'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : warnCount > 0
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-500'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Warnings ({warnCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('ACTION')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'ACTION'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>User Actions ({actionCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('DEBUG')}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterLevel === 'DEBUG'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>API / Debug</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search traces, endpoints, errors..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Dual Pane Log Viewer & JSON Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 pt-2">
          {/* Left Column: Interactive Log Stream */}
          <div className="lg:col-span-7 flex flex-col bg-gray-50 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/10 p-3 overflow-hidden select-text">
            <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 pb-2 mb-2 border-b border-gray-200 dark:border-white/10 flex justify-between">
              <span>STREAM ({filteredLogs.length} entries)</span>
              <span>SELECT ROW FOR METADATA</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-text">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 dark:text-slate-500 font-mono text-xs">
                  <Info className="w-8 h-8 mb-2 opacity-50 text-blue-500" />
                  <span>No log entries match the selected filters or search query.</span>
                </div>
              ) : (
                filteredLogs.slice().reverse().map((entry) => {
                  const isSelected = selectedEntry?.id === entry.id;
                  const isError = entry.level === 'ERROR';
                  const isWarn = entry.level === 'WARN';
                  const isAction = entry.level === 'ACTION';

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`p-2.5 rounded-xl border text-xs font-mono transition cursor-pointer select-text flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/50 shadow-sm'
                          : isError
                          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40'
                          : isWarn
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40'
                          : isAction
                          ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/40'
                          : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/15'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isError ? (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : isWarn ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : isAction ? (
                          <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span
                            className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              isError
                                ? 'bg-red-200 dark:bg-red-500/30 text-red-800 dark:text-red-200'
                                : isWarn
                                ? 'bg-amber-200 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200'
                                : isAction
                                ? 'bg-purple-200 dark:bg-purple-500/30 text-purple-800 dark:text-purple-200'
                                : 'bg-gray-200 dark:bg-white/15 text-gray-800 dark:text-white/80'
                            }`}
                          >
                            {entry.category}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs break-words select-text text-gray-800 dark:text-slate-200">
                          {entry.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed JSON Inspector & Stack Trace */}
          <div className="lg:col-span-5 flex flex-col bg-gray-50 dark:bg-black/50 rounded-2xl border border-gray-200 dark:border-white/10 p-3 overflow-hidden select-text">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-white/10 shrink-0">
              <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">JSON DOSSIER & STACK</span>
              {selectedEntry && (
                <button
                  type="button"
                  onClick={() => handleCopyEntry(selectedEntry)}
                  className="px-2 py-1 rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-xs font-mono flex items-center gap-1 text-gray-700 dark:text-white transition cursor-pointer"
                >
                  {copiedEntry ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEntry ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] select-text pr-1">
              {selectedEntry ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">EVENT RECORD:</span>
                    <pre className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-gray-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 overflow-x-auto select-text whitespace-pre-wrap">
                      {JSON.stringify(selectedEntry, null, 2)}
                    </pre>
                  </div>

                  {selectedEntry.stack && (
                    <div>
                      <span className="text-red-500 dark:text-red-400 block mb-1 font-bold">ERROR STACK TRACE:</span>
                      <pre className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-[10px] overflow-x-auto select-text whitespace-pre-wrap">
                        {selectedEntry.stack}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-slate-500 text-xs">
                  <Code className="w-8 h-8 mb-2 opacity-40 text-gray-400" />
                  <span>Click on any log event on the left to inspect its complete JSON payload and stack trace.</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
