import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FolderOpen, Activity, Plus, RefreshCw, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import { caseAPI, userAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { loggerService } from '../../lib/loggerService';
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

  useEffect(() => {
    loadStats();
    const unsubscribe = loggerService.subscribeLogs((logs) => {
      setErrorCount(logs.filter((l) => l.level === 'ERROR').length);
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

  const statCards = [
    {
      label: 'Total Users',
      value: stats.users,
      icon: Users,
      accent: 'accent-card-blue',
      iconBg: 'bg-blue-100 dark:bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Total Cases',
      value: stats.cases,
      icon: FolderOpen,
      accent: 'accent-card-green',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Active Cases',
      value: stats.active,
      icon: Activity,
      accent: 'accent-card-amber',
      iconBg: 'bg-amber-100 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user?.fullName?.split(' ')[0] || 'Admin'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-500">System overview, diagnostics, and multi-user administration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl transition text-sm font-medium shadow-sm cursor-pointer"
            title="Open Administrator Diagnostics & System-Wide Audit Dossier"
          >
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span>Admin Diagnostics</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {errorCount}
              </span>
            )}
          </button>

          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl transition disabled:opacity-50 text-sm font-medium cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger-children">
        {statCards.map(({ label, value, icon: Icon, accent, iconBg, iconColor }) => (
          <div key={label} className={`accent-card ${accent} glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 card-hover-lift animate-fade-in`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {loading ? (
                    <span className="inline-block h-9 w-16 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                  ) : value}
                </p>
              </div>
              <div className={`${iconBg} p-3 rounded-xl`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Management */}
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 card-hover-lift flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
              Create and manage user accounts, assign roles, and configure permissions across your organization.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition text-sm font-medium cursor-pointer"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowCreateUser(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Case Management */}
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 card-hover-lift flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg">
                  <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Case Management</h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
              Create forensic cases, allocate access boundaries, and assign them to investigating officers.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/admin/cases')}
              className="flex items-center gap-2 px-4 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition text-sm font-medium cursor-pointer"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowCreateCase(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Case
            </button>
          </div>
        </div>

        {/* System Diagnostics & Audit Logs */}
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 card-hover-lift flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-500/10 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit & Diagnostics</h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-slate-400 text-sm mb-5">
              Review live audit logs, API telemetry, operational errors, and export JSON forensic dossiers.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAuditModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-sm text-sm font-medium cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Open Audit Center
            </button>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <CreateUser
          onClose={() => setShowCreateUser(false)}
          onSuccess={loadStats}
        />
      )}

      {/* Create Case Modal */}
      {showCreateCase && (
        <CreateCase
          onClose={() => setShowCreateCase(false)}
          onSuccess={loadStats}
        />
      )}

      {/* Administrator System Audit Modal */}
      <AdminAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />
    </div>
  );
};
