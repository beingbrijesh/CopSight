import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Bookmark, FileSearch, FolderOpen, MessageSquareText } from 'lucide-react';
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
  active: 'bg-blue-50 text-blue-700',
  closed: 'bg-gray-100 text-gray-700',
  processing: 'bg-amber-50 text-amber-700',
  ready_for_analysis: 'bg-emerald-50 text-emerald-700',
  under_review: 'bg-purple-50 text-purple-700',
};

const priorityBadgeStyles: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-gray-100 text-gray-700',
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
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Supervisor Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Oversight for active investigations, officer workload, and flagged activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Cases', value: totals.total, icon: FolderOpen },
          { label: 'Active Cases', value: totals.active, icon: Activity },
          { label: 'Closed Cases', value: totals.closed, icon: FileSearch },
          { label: 'High Priority Cases', value: totals.highPriority, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-gray-900">{loading ? '...' : value}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <Icon className="h-5 w-5 text-gray-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Case Overview</h2>
            <p className="mt-1 text-sm text-gray-500">Tracked investigations and their current supervisory status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Case ID', 'Title', 'Assigned Officer', 'Status', 'Priority', 'Action'].map((heading) => (
                    <th key={heading} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {cases.length > 0 ? (
                  cases.map((caseItem: any) => (
                    <tr key={caseItem.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{caseItem.caseNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{caseItem.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{caseItem.assignedOfficer?.fullName || 'Unassigned'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeStyles[caseItem.status] || 'bg-gray-100 text-gray-700'}`}>
                          {String(caseItem.status || 'unknown').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeStyles[caseItem.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {caseItem.priority || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/supervisor/case/${caseItem.id}`}
                          className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          Open Case
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      {loading ? 'Loading cases...' : 'No cases available for supervisor review yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <p className="mt-1 text-sm text-gray-500">Latest queries, case updates, and bookmarks.</p>
          </div>
          <div className="space-y-4">
            {activity.length > 0 ? (
              activity.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-lg border border-gray-200 p-4">
                  <div className="mt-1 rounded-full bg-gray-100 p-2">
                    {item.type === 'query' && <MessageSquareText className="h-4 w-4 text-gray-700" />}
                    {item.type === 'bookmark' && <Bookmark className="h-4 w-4 text-gray-700" />}
                    {item.type === 'case' && <FolderOpen className="h-4 w-4 text-gray-700" />}
                    {item.type === 'alert' && <AlertTriangle className="h-4 w-4 text-gray-700" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                    <p className="mt-2 text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                Recent activity will appear here as supervisors review active cases.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Alerts and Flags</h2>
          <p className="mt-1 text-sm text-gray-500">Suspicious activity, high-risk entities, and unresolved case alerts.</p>
        </div>
        <div className="p-6">
          <AlertsPanel limit={6} showHeader={false} />
        </div>
      </div>
    </div>
  );
};
