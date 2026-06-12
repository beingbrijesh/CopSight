import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, BookmarkCheck, FileSearch, FolderOpen, MessageSquareText, Eye } from 'lucide-react';
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
  active: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300',
  closed: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
  processing: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ready_for_analysis: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  under_review: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300',
};

const priorityBadgeStyles: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300',
  high: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300',
  medium: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300',
  low: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
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
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20">
          <Eye className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Supervisor Overview</h1>
          <p className="text-sm text-gray-500 dark:text-slate-500">Oversight for active investigations, officer workload, and flagged activity.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Cases', value: totals.total, icon: FolderOpen, accent: 'accent-card-blue', iconBg: 'bg-blue-100 dark:bg-blue-500/10', iconColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Active Cases', value: totals.active, icon: Activity, accent: 'accent-card-green', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Closed Cases', value: totals.closed, icon: FileSearch, accent: 'accent-card-amber', iconBg: 'bg-amber-100 dark:bg-amber-500/10', iconColor: 'text-amber-600 dark:text-amber-400' },
          { label: 'High Priority', value: totals.highPriority, icon: AlertTriangle, accent: 'accent-card-red', iconBg: 'bg-red-100 dark:bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, icon: Icon, accent, iconBg, iconColor }) => (
          <div key={label} className={`accent-card ${accent} rounded-2xl border border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl p-5 shadow-sm dark:shadow-none card-hover-lift`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {loading ? <span className="inline-block h-9 w-12 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" /> : value}
                </p>
              </div>
              <div className={`${iconBg} p-3 rounded-xl`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-none xl:col-span-2">
          <div className="border-b border-gray-200 dark:border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Case Overview</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">Tracked investigations and their current supervisory status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-slate-800/60">
                <tr>
                  {['Case ID', 'Title', 'Assigned Officer', 'Status', 'Priority', 'Action'].map((heading) => (
                    <th key={heading} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-transparent">
                {cases.length > 0 ? (
                  cases.map((caseItem: any) => (
                    <tr key={caseItem.id} className="transition hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{caseItem.caseNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{caseItem.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{caseItem.assignedOfficer?.fullName || 'Unassigned'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeStyles[caseItem.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'}`}>
                          {String(caseItem.status || 'unknown').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeStyles[caseItem.priority] || 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'}`}>
                          {caseItem.priority || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/supervisor/case/${caseItem.id}`}
                          className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition"
                        >
                          Open Case
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-slate-500">
                      {loading ? 'Loading cases...' : 'No cases available for supervisor review yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-sm dark:shadow-none">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">Latest queries, case updates, and bookmarks.</p>
          </div>
          <div className="space-y-4">
            {activity.length > 0 ? (
              activity.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-gray-200 dark:border-white/10 p-4">
                  <div className="mt-1 rounded-full bg-gray-100 dark:bg-slate-800 p-2">
                    {item.type === 'query' && <MessageSquareText className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                    {item.type === 'bookmark' && <BookmarkCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    {item.type === 'case' && <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    {item.type === 'alert' && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{item.detail}</p>
                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 dark:border-white/10 p-6 text-sm text-gray-500 dark:text-slate-500">
                Recent activity will appear here as supervisors review active cases.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="border-b border-gray-200 dark:border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alerts and Flags</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">Suspicious activity, high-risk entities, and unresolved case alerts.</p>
        </div>
        <div className="p-6">
          <AlertsPanel limit={6} showHeader={false} />
        </div>
      </div>
    </div>
  );
};
