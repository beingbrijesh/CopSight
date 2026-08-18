import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, BookmarkCheck, FolderOpen, MessageSquareText, ArrowRight } from 'lucide-react';
import { alertsAPI, bookmarkAPI, caseAPI, queryAPI } from '../../lib/api';
import { AlertsPanel } from '../../components/AlertsPanel';

interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  type: 'query' | 'bookmark' | 'case' | 'alert';
}

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  closed: 'bg-white/10 text-white/80 border border-white/10',
  processing: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
  ready_for_analysis: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
  under_review: 'bg-purple-500/20 text-purple-200 border border-purple-500/30',
};

const priorityBadgeStyles: Record<string, string> = {
  critical: 'bg-red-500/30 text-red-200 border border-red-500/30 font-bold',
  high: 'bg-orange-500/30 text-orange-200 border border-orange-500/30 font-bold',
  medium: 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  low: 'bg-white/10 text-white/70 border border-white/10',
};

export const SupervisorDashboard = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const casesResponse = await caseAPI.getCases();
        const caseRows = casesResponse.data.data?.cases || [];
        setCases(caseRows);

        const selectedCases = caseRows.slice(0, 4);
        const [queryHistories, bookmarkHistories, alertsResponse] = await Promise.all([
          Promise.all(
            selectedCases.map(async (caseItem: any) => {
              try {
                const response = await queryAPI.getQueryHistory(caseItem.id, { limit: 3 });
                return (response.data.data?.queries || []).map((query: any) => ({
                  id: `query-${query.id}`,
                  label: 'Latest query',
                  detail: `${caseItem.caseNumber}: ${query.queryText || query.query_text}`,
                  timestamp: query.createdAt || query.created_at,
                  type: 'query' as const,
                }));
              } catch {
                return [];
              }
            })
          ),
          Promise.all(
            selectedCases.map(async (caseItem: any) => {
              try {
                const response = await bookmarkAPI.getBookmarks(caseItem.id, { limit: 2 });
                return (response.data.data?.bookmarks || []).map((bookmark: any) => ({
                  id: `bookmark-${bookmark.id}`,
                  label: 'Bookmark added',
                  detail: `${caseItem.caseNumber}: ${bookmark.notes || bookmark.evidenceType || 'Saved evidence'}`,
                  timestamp: bookmark.createdAt || bookmark.created_at,
                  type: 'bookmark' as const,
                }));
              } catch {
                return [];
              }
            })
          ),
          alertsAPI.getAlerts({ limit: 4, status: 'active,acknowledged' }).catch(() => null),
        ]);

        const caseActivity = caseRows.slice(0, 6).map((caseItem: any) => ({
          id: `case-${caseItem.id}`,
          label: 'Case update',
          detail: `${caseItem.caseNumber}: ${caseItem.title}`,
          timestamp: caseItem.updatedAt || caseItem.updated_at || caseItem.createdAt || caseItem.created_at,
          type: 'case' as const,
        }));

        const alertActivity = (alertsResponse?.data.data || []).map((alert: any) => ({
          id: `alert-${alert.id}`,
          label: 'Alert flagged',
          detail: alert.title,
          timestamp: alert.createdAt || alert.created_at,
          type: 'alert' as const,
        }));

        const mergedActivity = [
          ...caseActivity,
          ...queryHistories.flat(),
          ...bookmarkHistories.flat(),
          ...alertActivity,
        ]
          .filter((item) => item.timestamp)
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 8);

        setActivity(mergedActivity);
      } catch (error) {
        console.error('Failed to load supervisor dashboard:', error);
        setCases([]);
        setActivity([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const totals = {
    total: cases.length,
    active: cases.filter((caseItem: any) => ['active', 'processing', 'ready_for_analysis', 'under_review'].includes(caseItem.status)).length,
    closed: cases.filter((caseItem: any) => caseItem.status === 'closed').length,
    highPriority: cases.filter((caseItem: any) => ['high', 'critical'].includes(caseItem.priority)).length,
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-1.5">
            Supervisor <span className="font-bold text-white">Oversight Center</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-black/20 dark:bg-white/10 rounded-full px-3.5 py-1 flex items-center gap-2 border border-white/15">
              <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white">Review Docket</span>
              <span className="font-mono text-xs text-white font-semibold">
                {totals.total} Tracked Cases
              </span>
            </div>
            <span className="text-xs opacity-75 text-white">Cross-Investigation Supervisory Console</span>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#FF7A59] dark:bg-white shadow-[0_0_8px_#FF7A59]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(totals.total).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Total Cases</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(totals.active).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Active Cases</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                {loading ? '..' : String(totals.highPriority).padStart(2, '0')}
              </p>
            </div>
            <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">High Priority</p>
          </div>
        </div>
      </div>

      {/* ─── Bento Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Cases Overview Table (8 cols) */}
        <div className="xl:col-span-8 glass-panel rounded-[2rem] p-6 sm:p-7 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Investigative Cases Docket</h3>
                <p className="text-xs opacity-75 text-white">Tracked investigations and officer workloads</p>
              </div>
            </div>
            <span className="text-xs font-mono opacity-80">{cases.length} Total</span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/60">
                  <th className="pb-3 px-3">Case ID</th>
                  <th className="pb-3 px-3">Title</th>
                  <th className="pb-3 px-3">Officer</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Priority</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.length > 0 ? (
                  cases.map((caseItem: any) => (
                    <tr key={caseItem.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-3 font-bold text-white">#{caseItem.caseNumber}</td>
                      <td className="py-3 px-3 font-sans text-white font-medium truncate max-w-[180px]">{caseItem.title}</td>
                      <td className="py-3 px-3 text-white/80">{caseItem.assignedOfficer?.fullName || 'Unassigned'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusBadgeStyles[caseItem.status] || 'bg-white/10 text-white'}`}>
                          {String(caseItem.status || 'unknown').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${priorityBadgeStyles[caseItem.priority] || 'bg-white/10 text-white'}`}>
                          {caseItem.priority || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/supervisor/case/${caseItem.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white text-[11px] font-bold transition shadow-sm"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/60">
                      {loading ? 'Loading cases...' : 'No cases assigned for supervisory review.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Activity Stream (4 cols) */}
        <div className="xl:col-span-4 rounded-[2rem] p-6 sm:p-7 shadow-2xl bg-black/40 dark:bg-black/60 border border-white/15 backdrop-blur-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#FF7A59] dark:text-white" />
                <h3 className="text-base font-bold text-white">Supervisory Activity</h3>
              </div>
              <span className="text-[10px] font-mono text-white/70">
                {activity.length} Events
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-xs max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {activity.length > 0 ? (
                activity.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2.5">
                    <div className="mt-0.5 p-1 rounded bg-white/10 shrink-0">
                      {item.type === 'query' && <MessageSquareText className="w-3.5 h-3.5 text-purple-300" />}
                      {item.type === 'bookmark' && <BookmarkCheck className="w-3.5 h-3.5 text-amber-300" />}
                      {item.type === 'case' && <FolderOpen className="w-3.5 h-3.5 text-blue-300" />}
                      {item.type === 'alert' && <AlertTriangle className="w-3.5 h-3.5 text-red-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-bold text-[11px] truncate">{item.label}</p>
                      <p className="text-white/70 text-[10px] truncate">{item.detail}</p>
                      <span className="text-[9px] opacity-50 block mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-white/60 text-xs">
                  <p>No recent supervisory activity recorded.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <p className="text-[10px] text-center opacity-60 font-mono">
              Audit trail synchronized with forensic backend
            </p>
          </div>
        </div>

        {/* Alerts & Risk Flagging Section (12 cols) */}
        <div className="xl:col-span-12 glass-panel rounded-[2rem] p-6 sm:p-7 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Supervisory Risk & Alerts Triage</h3>
              <p className="text-xs opacity-75 text-white">Cross-case anomaly triggers, critical keywords, and audit alarms</p>
            </div>
          </div>

          <AlertsPanel limit={6} showHeader={false} />
        </div>

      </div>

    </div>
  );
};
