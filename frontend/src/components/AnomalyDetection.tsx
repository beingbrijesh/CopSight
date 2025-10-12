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
                  Communication Anomalies
                </h4>
                <div className="space-y-3">
                  {results.communication_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
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
                          {anomaly.record && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Phone: {anomaly.record.phone_number}</div>
                              <div>Frequency: {anomaly.record.frequency}</div>
                              {anomaly.record.timestamp && (
                                <div>Time: {new Date(anomaly.record.timestamp).toLocaleString()}</div>
                              )}
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
                  Temporal Anomalies
                </h4>
                <div className="space-y-3">
                  {results.temporal_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              Hour {anomaly.hour}:00 - {anomaly.count} communications
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                              {(anomaly.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Z-score: {anomaly.z_score?.toFixed(2)} | {anomaly.description}
                          </p>
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
                  Network Anomalies
                </h4>
                <div className="space-y-3">
                  {results.network_anomalies.map((anomaly: AnomalyResult, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              Network Outlier
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(anomaly.confidence)}`}>
                              {(anomaly.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <div>Phone: {anomaly.record?.phone_number}</div>
                            <div>Frequency: {anomaly.features?.communication_frequency || 0}</div>
                            <div>Connections: {anomaly.features?.unique_contacts || 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
