import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FolderOpen, 
  RefreshCw, 
  ArrowRight, 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  FolderPlus,
  Server,
  Clock,
  Activity
} from 'lucide-react';
import { caseAPI, userAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { loggerService, type AuditLogEntry } from '../../lib/loggerService';
import { CreateUser } from './CreateUser';
import { CreateCase } from './CreateCase';
import { AdminAuditModal } from '../../components/AdminAuditModal';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ users: 0, cases: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    loadStats();
    const unsubscribe = loggerService.subscribeLogs((logs) => {
      setErrorCount(logs.filter((l) => l.level === 'ERROR').length);
      setRecentLogs(logs.slice(-6).reverse());
    });
    return unsubscribe;
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [usersRes, casesRes, statsRes] = await Promise.all([
        userAPI.getUsers(),
        caseAPI.getCases(),
        caseAPI.getStatistics(),
      ]);
      
      setStats({
        users: usersRes.data.data.pagination?.total || 0,
        cases: casesRes.data.data.pagination?.total || 0,
        active: statsRes.data.data.statistics?.active || 0,
      });
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      
      {/* ─── Header: Greeting & Quick Metrics Counters ────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-1.5">
            Welcome back, <span className="font-bold text-white">{user?.fullName || user?.username || 'Administrator'}</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-black/20 dark:bg-white/10 rounded-full px-3.5 py-1 flex items-center gap-2 border border-white/15">
              <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white">Admin Control</span>
              <span className="font-mono text-xs text-white font-semibold">
                Enterprise Node
              </span>
            </div>
            <span className="text-xs opacity-75 text-white">CopSight Unified Forensic Repository</span>
          </div>
        </div>

        {/* Live Stat Counters (Bento Header Style) */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#FF7A59] dark:bg-white shadow-[0_0_8px_#FF7A59]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(stats.users).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Total Users</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(stats.cases).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Total Cases</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(stats.active).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Active Cases</p>
          </div>

          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 text-white border border-white/15 text-xs font-mono font-medium transition cursor-pointer disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* ─── Bento Grid Core ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Card 1: Administrator Profile & Station Status (4 cols) */}
        <div className="md:col-span-12 xl:col-span-4 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-white/10 text-white border border-white/10">
                Security Profile
              </span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Authorized</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7A59] to-orange-600 flex items-center justify-center text-white shadow-lg text-xl font-bold">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.fullName || 'Super Admin'}</h3>
                <p className="text-xs text-white/75 font-mono">Role: {user?.role || 'admin'}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{user?.email || 'admin@copsight.local'}</p>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs text-white/90">
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                <span className="opacity-70">Access Boundary</span>
                <span className="text-cyan-300 font-bold">Global / Multi-Tenant</span>
              </div>
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                <span className="opacity-70">Active Sessions</span>
                <span className="text-emerald-400 font-bold">E2EE Protected</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-red-500/30 hover:bg-red-500/40 text-red-100 dark:text-red-200 border border-red-500/40 text-xs font-mono font-bold transition shadow-lg cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Launch Forensic Audit Dossier</span>
              {errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px]">
                  {errorCount} Flagged
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: System Health & Uptime Telemetry (4 cols) */}
        <div className="md:col-span-12 xl:col-span-4 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-white/10 text-white border border-white/10">
                Engine Telemetry
              </span>
              <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>Live RPC</span>
              </div>
            </div>

            <div className="flex items-center justify-center my-4">
              {/* Circular Gauge Graphic (Inspired by Time Tracker in Ref Image) */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="w-full h-full rounded-full border-4 border-white/10 flex items-center justify-center">
                  <div className="w-28 h-28 rounded-full border-4 border-dashed border-[#FF7A59] dark:border-white animate-spin" style={{ animationDuration: '24s' }} />
                </div>
                <div className="absolute text-center">
                  <Clock className="w-5 h-5 mx-auto mb-0.5 text-[#FF7A59] dark:text-white" />
                  <span className="text-xl font-bold font-mono text-white">99.9%</span>
                  <span className="block text-[9px] uppercase tracking-wider opacity-70 text-white">Uptime</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs mt-2">
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-center">
                <span className="opacity-70 text-[10px] block">API Gateway</span>
                <span className="text-emerald-400 font-bold text-sm">Online</span>
              </div>
              <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-center">
                <span className="opacity-70 text-[10px] block">Database Cluster</span>
                <span className="text-emerald-400 font-bold text-sm">Synced</span>
              </div>
            </div>
          </div>

          <div className="pt-4 text-center">
            <p className="text-[11px] opacity-75 font-mono text-white">
              Hardware acceleration & Milvus vector indexing running
            </p>
          </div>
        </div>

        {/* Card 3: Live System Audit Feed (4 cols - Dark Bento Card) */}
        <div className="md:col-span-12 xl:col-span-4 rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-2xl bg-black/40 dark:bg-black/60 border border-white/15 backdrop-blur-2xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#FF7A59] dark:text-white" />
                <h3 className="text-base font-bold text-white">Live Audit Stream</h3>
              </div>
              <span className="text-[10px] font-mono text-white/70">
                {recentLogs.length} Events
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-xs max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {recentLogs.length > 0 ? (
                recentLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                      log.level === 'ERROR' 
                        ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                        : log.level === 'WARN'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-white/5 border-white/10 text-white/90'
                    }`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      log.level === 'ERROR' ? 'bg-red-500 text-white' : 'bg-white/10 text-white'
                    }`}>
                      {log.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] truncate">{log.message}</p>
                      <span className="text-[9px] opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-white/60 text-xs">
                  <p>Telemetry stream active. No anomalies logged.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setShowAuditModal(true)}
              className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Full System Audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ─── Bottom Actions Row ────────────────────────────────────────────── */}
        
        {/* User Management Action Card (6 cols) */}
        <div className="md:col-span-12 lg:col-span-6 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">User Accounts & Roles</h3>
                  <p className="text-xs opacity-75 text-white">Manage Officers, Supervisors, and Credentials</p>
                </div>
              </div>
              <span className="text-lg font-bold font-mono text-white">{stats.users}</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed mb-6">
              Create investigator profiles, assign security clearance levels, rotate cryptographic tokens, and manage organizational hierarchy.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/users')}
              className="flex-1 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View All Users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCreateUser(true)}
              className="flex-1 py-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Case Management Action Card (6 cols) */}
        <div className="md:col-span-12 lg:col-span-6 glass-panel rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Forensic Cases</h3>
                  <p className="text-xs opacity-75 text-white">Allocate Case Numbers and Investigating Officers</p>
                </div>
              </div>
              <span className="text-lg font-bold font-mono text-white">{stats.cases}</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed mb-6">
              Open FIR forensic dockets, establish evidentiary chains of custody, allocate target devices, and monitor analysis progress.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/cases')}
              className="flex-1 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View All Cases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCreateCase(true)}
              className="flex-1 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Create Case</span>
            </button>
          </div>
        </div>

      </div>

      {/* ─── Modals ────────────────────────────────────────────────────────── */}
      {showCreateUser && (
        <CreateUser
          onClose={() => setShowCreateUser(false)}
          onSuccess={loadStats}
        />
      )}

      {showCreateCase && (
        <CreateCase
          onClose={() => setShowCreateCase(false)}
          onSuccess={loadStats}
        />
      )}

      <AdminAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />
    </div>
  );
};
