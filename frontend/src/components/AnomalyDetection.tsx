import { useState } from 'react';
import { Brain, AlertTriangle, TrendingUp, Network, Clock, Zap } from 'lucide-react';
import { analysisAPI } from '../lib/api';

interface AnomalyDetectionProps {
  caseId: number;
}

interface AnomalyResult {
  anomaly_score?: number;
  confidence: number;
  anomaly_type: string;
  description?: string;
  record?: any;
  features?: any;
  hour?: number;
  count?: number;
  z_score?: number;
  expected_count?: number;
  time_window?: string;
  day?: string;
  gap_hours?: number;
  start_time?: string;
  end_time?: string;
  burst_score?: number;
  window_size?: number;
  local_density?: number;
  degree?: number;
  phone_number?: string;
  expected_degree?: number;
  contact_diversity?: number;
  bridge_score?: number;
  frequency?: number;
  diversity?: number;
  isolation_score?: number;
}

export const AnomalyDetection = ({ caseId }: AnomalyDetectionProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnomalyDetection = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await analysisAPI.detectAnomalies(caseId);
      setResults(response.data.anomalies_detected);
    } catch (err) {
      setError('Failed to run anomaly detection');
      console.error('Anomaly detection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-red-600 bg-red-100';
    if (confidence >= 0.6) return 'text-orange-600 bg-orange-100';
    if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  const formatAnomalyType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTotalAnomalies = () => {
    if (!results) return 0;
    return (
      results.communication_anomalies?.length || 0 +
      results.temporal_anomalies?.length || 0 +
      results.network_anomalies?.length || 0
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-medium text-gray-900">
              ML Anomaly Detection
            </h3>
            {results && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {getTotalAnomalies()} anomalies found
              </span>
            )}
          </div>
          <button
            onClick={runAnomalyDetection}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Detection
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {!results && !loading && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Machine Learning Anomaly Detection
            </h4>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Use advanced ML algorithms to detect unusual patterns in communication data,
              temporal behavior, and network relationships that may indicate suspicious activity.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                <span>Communication Patterns</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Temporal Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Network Anomalies</span>
              </div>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            {/* Summary */}
            {results.summary && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Detection Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Anomalies:</span>
                    <div className="font-semibold text-lg">{results.summary.total_anomalies}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">High Confidence:</span>
                    <div className="font-semibold text-lg text-orange-600">
                      {results.summary.high_confidence_count}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Risk Level:</span>
                    <div className={`font-semibold text-lg capitalize ${
                      results.summary.risk_level === 'critical' ? 'text-red-600' :
                      results.summary.risk_level === 'high' ? 'text-orange-600' :
                      results.summary.risk_level === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {results.summary.risk_level}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Anomaly Types:</span>
                    <div className="font-semibold text-lg">{results.summary.anomaly_types?.length || 0}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Communication Anomalies */}
            {results.communication_anomalies && results.communication_anomalies.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Network className="w-5 h-5 text-blue-600" />
                  Communication Anomalies ({results.communication_anomalies.length})
                </h4>
                <div className="space-y-3">
                  {results.communication_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {formatAnomalyType(anomaly.anomaly_type)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                              {(anomaly.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{anomaly.description}</p>

                          {anomaly.record && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Phone:</strong> {anomaly.record.phone_number}</div>
                              <div><strong>Frequency:</strong> {anomaly.record.frequency}</div>
                              <div><strong>Source:</strong> {anomaly.record.source_type}</div>
                              {anomaly.record.timestamp && (
                                <div><strong>Time:</strong> {new Date(anomaly.record.timestamp).toLocaleString()}</div>
                              )}
                            </div>
                          )}

                          {anomaly.anomaly_score && (
                            <div className="mt-2 text-xs text-gray-500">
                              Anomaly Score: {anomaly.anomaly_score.toFixed(3)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Temporal Anomalies */}
            {results.temporal_anomalies && results.temporal_anomalies.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  Temporal Anomalies ({results.temporal_anomalies.length})
                </h4>
                <div className="space-y-3">
                  {results.temporal_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {formatAnomalyType(anomaly.anomaly_type)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                              {(anomaly.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{anomaly.description}</p>

                          {/* Show specific details based on anomaly type */}
                          {anomaly.hour !== undefined && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Hour:</strong> {anomaly.hour}:00</div>
                              <div><strong>Communications:</strong> {anomaly.count}</div>
                              <div><strong>Z-Score:</strong> {anomaly.z_score?.toFixed(2)}</div>
                              <div><strong>Expected:</strong> {anomaly.expected_count?.toFixed(1)}</div>
                              <div><strong>Time Window:</strong> {anomaly.time_window}</div>
                            </div>
                          )}

                          {anomaly.day && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Day:</strong> {anomaly.day}</div>
                              <div><strong>Communications:</strong> {anomaly.count}</div>
                              <div><strong>Z-Score:</strong> {anomaly.z_score?.toFixed(2)}</div>
                              <div><strong>Expected:</strong> {anomaly.expected_count?.toFixed(1)}</div>
                            </div>
                          )}

                          {anomaly.gap_hours && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Gap Duration:</strong> {anomaly.gap_hours.toFixed(1)} hours</div>
                              <div><strong>From:</strong> {anomaly.start_time}</div>
                              <div><strong>To:</strong> {anomaly.end_time}</div>
                              <div><strong>Z-Score:</strong> {anomaly.z_score?.toFixed(2)}</div>
                            </div>
                          )}

                          {anomaly.burst_score && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Burst Score:</strong> {anomaly.burst_score.toFixed(2)}</div>
                              <div><strong>Window Size:</strong> {anomaly.window_size}</div>
                              <div><strong>Local Density:</strong> {anomaly.local_density?.toFixed(2)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Network Anomalies */}
            {results.network_anomalies && results.network_anomalies.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Network Anomalies ({results.network_anomalies.length})
                </h4>
                <div className="space-y-3">
                  {results.network_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {formatAnomalyType(anomaly.anomaly_type)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                              {(anomaly.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{anomaly.description}</p>

                          {/* Show specific details based on anomaly type */}
                          {anomaly.degree !== undefined && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Phone:</strong> {anomaly.phone_number}</div>
                              <div><strong>Communication Degree:</strong> {anomaly.degree}</div>
                              <div><strong>Z-Score:</strong> {anomaly.z_score?.toFixed(2)}</div>
                              <div><strong>Expected Degree:</strong> {anomaly.expected_degree?.toFixed(1)}</div>
                            </div>
                          )}

                          {anomaly.contact_diversity !== undefined && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Phone:</strong> {anomaly.phone_number}</div>
                              <div><strong>Contact Diversity:</strong> {anomaly.contact_diversity}</div>
                              <div><strong>Z-Score:</strong> {anomaly.z_score?.toFixed(2)}</div>
                            </div>
                          )}

                          {anomaly.bridge_score !== undefined && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Phone:</strong> {anomaly.phone_number}</div>
                              <div><strong>Bridge Score:</strong> {anomaly.bridge_score.toFixed(2)}</div>
                              <div><strong>Frequency:</strong> {anomaly.frequency}</div>
                              <div><strong>Diversity:</strong> {anomaly.diversity}</div>
                            </div>
                          )}

                          {anomaly.isolation_score !== undefined && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div><strong>Phone:</strong> {anomaly.phone_number}</div>
                              <div><strong>Frequency:</strong> {anomaly.frequency}</div>
                              <div><strong>Diversity:</strong> {anomaly.diversity}</div>
                              <div><strong>Isolation Score:</strong> {anomaly.isolation_score.toFixed(3)}</div>
                            </div>
                          )}

                          {/* Legacy support for old format */}
                          {anomaly.record && (
                            <div className="text-sm text-gray-600">
                              <div><strong>Phone:</strong> {anomaly.record.phone_number}</div>
                              <div><strong>Frequency:</strong> {anomaly.record.communication_frequency || 0}</div>
                              <div><strong>Connections:</strong> {anomaly.record.unique_contacts || 0}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )};

            {getTotalAnomalies() === 0 && results.summary && (
              <div className="text-center py-8">
                <div className="text-green-600 mb-2">
                  <Brain className="w-12 h-12 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  No Anomalies Detected
                </h4>
                <p className="text-gray-600">
                  The ML analysis found no significant anomalies in the case data.
                  This suggests normal communication patterns.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
