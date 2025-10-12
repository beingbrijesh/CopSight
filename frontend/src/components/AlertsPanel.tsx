import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, X, Eye, Check } from 'lucide-react';
import { alertsAPI } from '../lib/api';

interface Alert {
  id: number;
  alertType: 'cross_case' | 'suspicious_pattern' | 'anomaly' | 'high_risk_entity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  case?: {
    id: number;
    caseNumber: string;
    title: string;
  };
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

interface AlertsPanelProps {
  caseId?: number; // Optional: show alerts for specific case
  limit?: number;
  showHeader?: boolean;
}

export const AlertsPanel = ({ caseId, limit = 10, showHeader = true }: AlertsPanelProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [caseId]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = { limit, status: 'active,acknowledged' };
      const response = caseId
        ? await alertsAPI.getCaseAlerts(caseId, params)
        : await alertsAPI.getAlerts(params);
      setAlerts(response.data.data);
    } catch (err) {
      setError('Failed to load alerts');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await alertsAPI.getStatistics();
      setStats(response.data.data);
    } catch (err) {
      console.error('Error fetching alert stats:', err);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await alertsAPI.acknowledgeAlert(alertId);
      await fetchAlerts();
      await fetchStats();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const handleResolve = async (alertId: number, resolutionNotes?: string) => {
    try {
      await alertsAPI.resolveAlert(alertId, resolutionNotes);
      await fetchAlerts();
      await fetchStats();
      setShowModal(false);
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium': return <Info className="w-5 h-5 text-yellow-600" />;
      case 'low': return <Info className="w-5 h-5 text-blue-600" />;
      default: return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Active</span>;
      case 'acknowledged':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Acknowledged</span>;
      case 'resolved':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Resolved</span>;
      case 'dismissed':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Dismissed</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-gray-600">Loading alerts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Alerts {caseId ? `for Case ${caseId}` : ''}
              </h3>
              {stats && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {stats.byStatus?.active || 0} active
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No Active Alerts
            </h4>
            <p className="text-gray-600">
              {caseId ? 'This case has no active alerts.' : 'You have no active alerts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{alert.title}</h4>
                        {getStatusBadge(alert.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{alert.description}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {alert.case && (
                          <span>Case: {alert.case.caseNumber} - {alert.case.title}</span>
                        )}
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                        {alert.acknowledgedAt && (
                          <span>Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</span>
                        )}
                        {alert.resolvedAt && (
                          <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {alert.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition"
                        title="Acknowledge alert"
                      >
                        <Eye className="w-3 h-3" />
                        Acknowledge
                      </button>
                    )}

                    {alert.status === 'acknowledged' && (
                      <button
                        onClick={() => {
                          setSelectedAlert(alert);
                          setShowModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition"
                        title="Resolve alert"
                      >
                        <Check className="w-3 h-3" />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {alerts.length >= limit && (
              <div className="text-center pt-4">
                <button className="text-purple-600 hover:text-purple-800 font-medium">
                  Load more alerts...
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alert Statistics */}
        {stats && !caseId && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-medium text-gray-900 mb-3">Alert Statistics</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.byStatus?.active || 0}</div>
                <div className="text-xs text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.byStatus?.acknowledged || 0}</div>
                <div className="text-xs text-gray-600">Acknowledged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.byStatus?.resolved || 0}</div>
                <div className="text-xs text-gray-600">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Alert Modal */}
      {showModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Resolve Alert</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">{selectedAlert.title}</h4>
              <p className="text-sm text-gray-600">{selectedAlert.description}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  rows={3}
                  placeholder="Add notes about how this alert was resolved..."
                  onChange={(e) => {
                    // Store the resolution notes - in a real app, you'd use state
                    (selectedAlert as any).resolutionNotes = e.target.value;
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResolve(selectedAlert.id, (selectedAlert as any).resolutionNotes)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Resolve Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
