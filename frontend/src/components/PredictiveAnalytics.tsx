import { useState } from 'react';
import { TrendingUp, Target, Lightbulb, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { analysisAPI } from '../lib/api';

interface PredictiveAnalyticsProps {
  caseId: number;
}

interface InvestigationLead {
  lead_type: string;
  title: string;
  description: string;
  confidence: number;
  recommendations: string[];
  related_cases?: any[];
  entities?: any[];
  time_periods?: string[];
  connections?: any[];
}

export const PredictiveAnalytics = ({ caseId }: PredictiveAnalyticsProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [trainingModel, setTrainingModel] = useState(false);

  const runPredictiveAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await analysisAPI.predictiveAnalysis(caseId);
      setResults(response.data);
    } catch (err) {
      setError('Failed to run predictive analysis');
      console.error('Predictive analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    try {
      setTrainingModel(true);
      const response = await analysisAPI.trainPredictiveModel();
      alert('Model training completed successfully!');
      console.log('Training result:', response.data);
    } catch (err) {
      console.error('Model training error:', err);
      alert('Model training failed. Check console for details.');
    } finally {
      setTrainingModel(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      case 'minimal': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-blue-600 bg-blue-100';
    if (confidence >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getLeadIcon = (type: string) => {
    switch (type) {
      case 'similar_cases': return <Target className="w-5 h-5 text-blue-600" />;
      case 'communication_patterns': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'timeline_analysis': return <CheckCircle className="w-5 h-5 text-purple-600" />;
      case 'network_analysis': return <Lightbulb className="w-5 h-5 text-orange-600" />;
      default: return <Lightbulb className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow h-[600px] flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Predictive Analytics
            </h3>
            {results && (
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {results.lead_count} leads generated
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={trainModel}
              disabled={trainingModel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {trainingModel ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Training...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Train Model
                </>
              )}
            </button>
            <button
              onClick={runPredictiveAnalysis}
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
                  <Target className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">

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
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Predictive Investigation Analytics
            </h4>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Use machine learning to predict case risk levels and generate investigation leads
              based on historical patterns and similar cases.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span>Risk Level Prediction</span>
              </div>
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-green-600" />
                <span>Investigation Leads</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Similar Case Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-600" />
                <span>Pattern Recognition</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <p className="mb-2">⚠️ Note: Train the model first using historical case data for best results.</p>
              <p>Model training requires completed cases with known outcomes.</p>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            {/* Risk Prediction */}
            {results.risk_prediction && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Risk Assessment
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(results.risk_prediction.prediction)}`}>
                      {results.risk_prediction.prediction.toUpperCase()} RISK
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(results.risk_prediction.confidence)}`}>
                      {(results.risk_prediction.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {(results.risk_prediction.risk_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Risk Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {(results.risk_prediction.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold capitalize ${
                      results.risk_prediction.prediction === 'critical' ? 'text-red-600' :
                      results.risk_prediction.prediction === 'high' ? 'text-orange-600' :
                      results.risk_prediction.prediction === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {results.risk_prediction.prediction}
                    </div>
                    <div className="text-sm text-gray-600">Risk Level</div>
                  </div>
                </div>

                <p className="text-gray-700">{results.risk_prediction.message}</p>
              </div>
            )}

            {/* Investigation Leads */}
            {results.investigation_leads && results.investigation_leads.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                  Investigation Leads ({results.investigation_leads.length})
                </h4>

                <div className="space-y-4">
                  {results.investigation_leads.map((lead: InvestigationLead, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getLeadIcon(lead.lead_type)}
                          <div>
                            <h5 className="font-medium text-gray-900">{lead.title}</h5>
                            <p className="text-sm text-gray-600">{lead.description}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(lead.confidence)}`}>
                          {(lead.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>

                      {lead.recommendations && lead.recommendations.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-sm font-medium text-gray-900 mb-2">Recommendations:</h6>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {lead.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-purple-600 mt-1">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lead.related_cases && lead.related_cases.length > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                          <h6 className="text-sm font-medium text-gray-900 mb-2">Related Cases:</h6>
                          <div className="flex flex-wrap gap-2">
                            {lead.related_cases.slice(0, 3).map((case_item: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                {case_item.case_number}
                              </span>
                            ))}
                            {lead.related_cases.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{lead.related_cases.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.investigation_leads && results.investigation_leads.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  No Investigation Leads Generated
                </h4>
                <p className="text-gray-600">
                  The predictive analysis did not identify any specific investigation leads for this case.
                  This may indicate the case follows typical patterns.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
