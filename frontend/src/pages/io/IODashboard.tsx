import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, CloudUpload, SearchCode, BookmarkCheck, ArrowRight, Crosshair, Clock } from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AlertsPanel } from '../../components/AlertsPanel';

export const IODashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [cases, setCases] = useState([]);
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

  const statCards = [
    { label: 'Assigned Cases', value: cases.length, icon: FolderOpen, accent: 'accent-card-blue', iconBg: 'bg-blue-100 dark:bg-blue-500/10', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Files Uploaded', value: 0, icon: CloudUpload, accent: 'accent-card-green', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Queries Executed', value: 0, icon: SearchCode, accent: 'accent-card-purple', iconBg: 'bg-purple-100 dark:bg-purple-500/10', iconColor: 'text-purple-600 dark:text-purple-400' },
    { label: 'Evidence Bookmarked', value: 0, icon: BookmarkCheck, accent: 'accent-card-amber', iconBg: 'bg-amber-100 dark:bg-amber-500/10', iconColor: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
          <Crosshair className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Welcome, {user?.fullName?.split(' ')[0] || 'Officer'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500">
            {cases.length > 0 ? `You have ${cases.length} active case${cases.length > 1 ? 's' : ''} assigned` : 'No cases assigned yet'}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        {statCards.map(({ label, value, icon: Icon, accent, iconBg, iconColor }) => (
          <div key={label} className={`accent-card ${accent} glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-4 card-hover-lift animate-fade-in`}>
            <div className="flex items-center gap-3">
              <div className={`${iconBg} p-2.5 rounded-xl`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Panel */}
      <div>
        <AlertsPanel limit={5} />
      </div>

      {/* Active Cases */}
      <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10">
        <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Cases</h3>
          </div>
          <span className="text-sm text-gray-500 dark:text-slate-500">{cases.length} total</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-sm">Loading cases...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No cases assigned</h3>
            <p className="text-sm text-gray-500 dark:text-slate-500">Cases will appear here once an admin assigns them to you.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800/50">
            {cases.map((c: any) => (
              <div 
                key={c.id} 
                className="p-5 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition group"
                onClick={() => navigate(`/io/case/${c.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">{c.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        c.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
                        c.status === 'processing' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                        c.status === 'ready_for_analysis' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300' :
                        'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 mb-2 line-clamp-1">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
                      <span className="font-medium">#{c.caseNumber}</span>
                      <span>•</span>
                      <span className="capitalize">{c.priority} priority</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(c.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition shrink-0 ml-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
