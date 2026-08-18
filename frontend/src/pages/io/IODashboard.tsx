import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderOpen, 
  ArrowRight, 
  Crosshair, 
  Activity,
  Shield,
  Layers
} from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AlertsPanel } from '../../components/AlertsPanel';

export const IODashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await caseAPI.getCases();
      setCases(response.data.data.cases || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      
      {/* ─── Header: Greeting & High-Level Stats ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-1.5">
            Welcome, <span className="font-bold text-white">{user?.fullName || user?.username || 'Officer'}</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-black/20 dark:bg-white/10 rounded-full px-3.5 py-1 flex items-center gap-2 border border-white/15">
              <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white">Active Docket</span>
              <span className="font-mono text-xs text-white font-semibold">
                {cases.length} Assigned Case{cases.length === 1 ? '' : 's'}
              </span>
            </div>
            <span className="text-xs opacity-75 text-white">Digital Forensics & AI Extraction Terminal</span>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#FF7A59] dark:bg-white shadow-[0_0_8px_#FF7A59]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(cases.length).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Assigned</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(cases.filter(c => c.status === 'active' || c.status === 'ready_for_analysis').length).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Ready for Analysis</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(cases.filter(c => c.priority === 'high' || c.priority === 'critical').length).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">High Priority</p>
          </div>
        </div>
      </div>

      {/* ─── Bento Grid Core ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Card 1: Officer Profile & Station Info (4 cols) */}
        <div className="md:col-span-12 xl:col-span-4 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-white/10 text-white border border-white/10">
                Officer Clearance
              </span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <Shield className="w-3.5 h-3.5" />
                <span>Forensic Lead</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                <Crosshair className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.fullName || 'Investigating Officer'}</h3>
                <p className="text-xs text-white/75 font-mono">Badge: {user?.badgeNumber || 'IO-7729'}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{(user as any)?.department || 'Digital Forensics Unit'}</p>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs text-white/90">
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                <span className="opacity-70">Case Jurisdiction</span>
                <span className="text-white font-bold">Assigned FIRs Only</span>
              </div>
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                <span className="opacity-70">AI Query Engine</span>
                <span className="text-emerald-400 font-bold">RAG / Neo4j Ready</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            {cases.length > 0 ? (
              <button
                onClick={() => navigate(`/io/case/${cases[0].id}`)}
                className="w-full py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>Open Current Case ({cases[0].caseNumber})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-white/5 text-center text-xs opacity-75 font-mono">
                No active case assigned
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Investigation Pipeline Telemetry (4 cols) */}
        <div className="md:col-span-12 xl:col-span-4 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-white/10 text-white border border-white/10">
                Triage Pipeline
              </span>
              <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono">
                <Activity className="w-3.5 h-3.5" />
                <span>Multimodal NLP</span>
              </div>
            </div>

            <div className="flex items-center justify-center my-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="w-full h-full rounded-full border-4 border-white/10 flex items-center justify-center">
                  <div className="w-28 h-28 rounded-full border-4 border-dashed border-cyan-400 dark:border-white animate-spin" style={{ animationDuration: '30s' }} />
                </div>
                <div className="absolute text-center">
                  <Layers className="w-5 h-5 mx-auto mb-0.5 text-cyan-400 dark:text-white" />
                  <span className="text-xl font-bold font-mono text-white">Ready</span>
                  <span className="block text-[9px] uppercase tracking-wider opacity-70 text-white">Extraction Engine</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs mt-2">
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-center">
                <span className="opacity-70 text-[10px] block">Graph Analytics</span>
                <span className="text-emerald-400 font-bold text-sm">Active</span>
              </div>
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-center">
                <span className="opacity-70 text-[10px] block">Cryptographic Seal</span>
                <span className="text-cyan-300 font-bold text-sm">SHA-256</span>
              </div>
            </div>
          </div>

          <div className="pt-4 text-center">
            <p className="text-[11px] opacity-75 font-mono text-white">
              Compliant with Section 65B Electronic Evidence Certifications
            </p>
          </div>
        </div>

        {/* Card 3: Assigned Forensic Cases (4 cols) */}
        <div className="md:col-span-12 xl:col-span-4 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#FF7A59] dark:text-white" />
                <h3 className="text-base font-bold text-white">Assigned Cases</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/io/cases')}
                className="text-[11px] font-mono text-[#FF7A59] dark:text-white hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({cases.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-white/70 text-xs font-mono">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF7A59] mx-auto mb-2" />
                <span>Loading active cases...</span>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center text-white/60 text-xs">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No forensic cases currently assigned to your docket.</p>
              </div>
            ) : (
              <div className="space-y-2.5 font-mono text-xs max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/io/case/${c.id}`)}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white truncate">{c.title}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          c.priority === 'critical' || c.priority === 'high' ? 'bg-red-500/30 text-red-200 border border-red-500/30' : 'bg-blue-500/20 text-blue-200'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] opacity-70">
                        <span>#{c.caseNumber}</span>
                        <span>•</span>
                        <span className="capitalize">{c.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition text-[#FF7A59] dark:text-white shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={() => navigate('/io/cases')}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-center text-white font-mono transition cursor-pointer"
            >
              Browse All Cases in Docket →
            </button>
          </div>
        </div>

        {/* ─── Alerts & Activity Stream ──────────────────────────────────────── */}
        <div className="md:col-span-12 glass-panel rounded-[2rem] p-6 sm:p-7 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Live Intelligence & Case Alerts</h3>
                <p className="text-xs opacity-75 text-white">Anomalies, High-Risk Entities, and Telemetry</p>
              </div>
            </div>
          </div>

          <AlertsPanel limit={6} showHeader={false} />
        </div>

      </div>
    </div>
  );
};
