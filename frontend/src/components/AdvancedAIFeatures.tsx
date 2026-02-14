import React, { useState, useEffect } from 'react';
import { Brain, Network, TrendingUp, Target, Zap, BarChart3, Settings } from 'lucide-react';
import { advancedAIApi } from '../lib/api';

interface AdvancedAIFeaturesProps {
  caseData?: any;
}

export const AdvancedAIFeatures: React.FC<AdvancedAIFeaturesProps> = ({ caseData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>({});
  const [modelStats, setModelStats] = useState<any>({});

  useEffect(() => {
    loadModelStats();
  }, []);

  const loadModelStats = async () => {
    try {
      const response = await advancedAIApi.getModelStats();
      setModelStats(response.data.model_statistics);
    } catch (error) {
      console.error('Failed to load model stats:', error);
    }
  };

  const runDeepLearningAnalysis = async (operation: string) => {
    setLoading(true);
    try {
      const data = caseData?.communications || [];
      const response = await advancedAIApi.deepLearningAnalysis(operation, data);
      setResults((prev: any) => ({ ...prev, [operation]: response.data }));
    } catch (error) {
      console.error('Deep learning analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runEvidenceClassification = async () => {
    setLoading(true);
    try {
      const evidence = caseData?.evidence || [];
      const response = await advancedAIApi.classifyEvidence(evidence);
      setResults((prev: any) => ({ ...prev, evidenceClassification: response.data }));
    } catch (error) {
      console.error('Evidence classification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runPatternRecognition = async () => {
    setLoading(true);
    try {
      const data = caseData?.communications || [];
      const response = await advancedAIApi.recognizePatterns(data);
      setResults((prev: any) => ({ ...prev, patternRecognition: response.data }));
    } catch (error) {
      console.error('Pattern recognition failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runComprehensiveAnalysis = async () => {
    setLoading(true);
    try {
      const response = await advancedAIApi.comprehensiveAnalysis(caseData || {});
      setResults((prev: any) => ({ ...prev, comprehensive: response.data }));
    } catch (error) {
      console.error('Comprehensive analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'deep-learning', label: 'Deep Learning', icon: Brain },
    { id: 'classification', label: 'Classification', icon: Target },
    { id: 'patterns', label: 'Patterns', icon: TrendingUp },
    { id: 'comprehensive', label: 'Comprehensive', icon: Zap },
    { id: 'models', label: 'Model Management', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Advanced AI Analysis</h1>
        </div>
        <p className="text-purple-100">
          Leverage cutting-edge AI technologies for forensic analysis including deep learning,
          pattern recognition, and automated evidence classification.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'overview' && (
          <OverviewTab modelStats={modelStats} results={results} />
        )}

        {activeTab === 'deep-learning' && (
          <DeepLearningTab
            onRunAnalysis={runDeepLearningAnalysis}
            results={results}
            loading={loading}
          />
        )}

        {activeTab === 'classification' && (
          <ClassificationTab
            onRunClassification={runEvidenceClassification}
            results={results.evidenceClassification}
            loading={loading}
          />
        )}

        {activeTab === 'patterns' && (
          <PatternsTab
            onRunRecognition={runPatternRecognition}
            results={results.patternRecognition}
            loading={loading}
          />
        )}

        {activeTab === 'comprehensive' && (
          <ComprehensiveTab
            onRunAnalysis={runComprehensiveAnalysis}
            results={results.comprehensive}
            loading={loading}
          />
        )}

        {activeTab === 'models' && (
          <ModelsTab modelStats={modelStats} />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ modelStats: any; results: any }> = ({ modelStats, results }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Model Status Cards */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Deep Learning Models</h3>
          <Brain className="w-6 h-6 text-purple-600" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Models:</span>
            <span className="font-medium">{modelStats?.deep_learning?.total_models || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Trained:</span>
            <span className="font-medium">{modelStats?.deep_learning?.trained_models || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Evidence Classification</h3>
          <Target className="w-6 h-6 text-blue-600" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Algorithms:</span>
            <span className="font-medium">{modelStats?.evidence_classifier?.trained_classifiers?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Categories:</span>
            <span className="font-medium">{modelStats?.evidence_classifier?.evidence_categories?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Pattern Recognition</h3>
          <TrendingUp className="w-6 h-6 text-green-600" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Pattern Types:</span>
            <span className="font-medium">{modelStats?.pattern_recognition?.pattern_types?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('healthy')}`}>
              Available
            </span>
          </div>
        </div>
      </div>

      {/* Recent Results Summary */}
      <div className="bg-white rounded-lg border p-6 md:col-span-2 lg:col-span-3">
        <h3 className="text-lg font-semibold mb-4">Recent Analysis Results</h3>
        {Object.keys(results).length === 0 ? (
          <p className="text-gray-500">No analysis results yet. Run some analyses to see results here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(results).map(([key, value]: [string, any]) => (
              <div key={key} className="border rounded p-3">
                <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {value?.success ? 'Completed successfully' : 'Analysis in progress...'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Deep Learning Tab Component
const DeepLearningTab: React.FC<{
  onRunAnalysis: (operation: string) => void;
  results: any;
  loading: boolean;
}> = ({ onRunAnalysis, results, loading }) => {
  const operations = [
    { id: 'detect_anomalies', label: 'Anomaly Detection', description: 'Use autoencoders to detect anomalies in data' },
    { id: 'classify_evidence', label: 'Evidence Classification', description: 'Classify evidence using neural networks' },
    { id: 'analyze_patterns', label: 'Pattern Analysis', description: 'CNN-based pattern recognition' },
    { id: 'analyze_temporal', label: 'Temporal Analysis', description: 'LSTM-based sequence analysis' },
    { id: 'model_status', label: 'Model Status', description: 'Check current model training status' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operations.map((op) => (
          <div key={op.id} className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-2">{op.label}</h3>
            <p className="text-sm text-gray-600 mb-4">{op.description}</p>
            <button
              onClick={() => onRunAnalysis(op.id)}
              disabled={loading}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Analysis'}
            </button>
          </div>
        ))}
      </div>

      {/* Results Display */}
      {Object.keys(results).length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// Classification Tab Component
const ClassificationTab: React.FC<{
  onRunClassification: () => void;
  results: any;
  loading: boolean;
}> = ({ onRunClassification, results, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Evidence Classification</h3>
            <p className="text-gray-600">Automatically classify evidence using ML algorithms</p>
          </div>
          <button
            onClick={onRunClassification}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Classifying...' : 'Run Classification'}
          </button>
        </div>

        {results && (
          <div className="mt-6">
            <h4 className="font-medium mb-3">Classification Results</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.results?.map((item: any, index: number) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{item.classification?.predicted_category}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.classification?.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                      item.classification?.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {(item.classification?.confidence * 100)?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Algorithm: {results.algorithm}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Patterns Tab Component
const PatternsTab: React.FC<{
  onRunRecognition: () => void;
  results: any;
  loading: boolean;
}> = ({ onRunRecognition, results, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Pattern Recognition</h3>
            <p className="text-gray-600">Discover complex patterns across multiple data dimensions</p>
          </div>
          <button
            onClick={onRunRecognition}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Discover Patterns'}
          </button>
        </div>

        {results?.pattern_analysis && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {results.pattern_analysis.total_patterns || 0}
                </div>
                <div className="text-sm text-blue-800">Total Patterns</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {Object.keys(results.pattern_analysis.patterns_discovered || {}).length}
                </div>
                <div className="text-sm text-green-800">Pattern Types</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {results.pattern_analysis.analysis_summary?.high_confidence_patterns?.length || 0}
                </div>
                <div className="text-sm text-purple-800">High Confidence</div>
              </div>
            </div>

            <div className="border rounded p-4">
              <h4 className="font-medium mb-3">Pattern Analysis Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.pattern_analysis.patterns_discovered &&
                  Object.entries(results.pattern_analysis.patterns_discovered).map(([type, patterns]: [string, any]) => (
                    <div key={type} className="bg-gray-50 p-3 rounded">
                      <div className="font-medium capitalize">{type} Patterns</div>
                      <div className="text-2xl font-bold text-gray-700">{patterns.length}</div>
                      <div className="text-sm text-gray-600">
                        Avg Confidence: {results.pattern_analysis.analysis_summary?.average_confidence_by_type?.[type]?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Comprehensive Tab Component
const ComprehensiveTab: React.FC<{
  onRunAnalysis: () => void;
  results: any;
  loading: boolean;
}> = ({ onRunAnalysis, results, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Comprehensive AI Analysis</h3>
            <p className="text-gray-600">Run all AI analysis types for complete case investigation</p>
          </div>
          <button
            onClick={onRunAnalysis}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Comprehensive Analysis'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-white p-4 rounded shadow-sm">
            <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="font-medium">Anomaly Detection</div>
            <div className="text-sm text-gray-600">ML-powered anomaly identification</div>
          </div>
          <div className="bg-white p-4 rounded shadow-sm">
            <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="font-medium">Evidence Classification</div>
            <div className="text-sm text-gray-600">Automated evidence categorization</div>
          </div>
          <div className="bg-white p-4 rounded shadow-sm">
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="font-medium">Pattern Recognition</div>
            <div className="text-sm text-gray-600">Advanced pattern discovery</div>
          </div>
        </div>
      </div>

      {results?.comprehensive_analysis && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Comprehensive Analysis Results</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {results.comprehensive_analysis.summary?.total_findings || 0}
              </div>
              <div className="text-sm text-gray-600">Total Findings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {results.comprehensive_analysis.summary?.high_confidence_findings || 0}
              </div>
              <div className="text-sm text-gray-600">High Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {results.comprehensive_analysis.analysis_types?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Analysis Types</div>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(results.comprehensive_analysis.results || {}).map(([type, result]: [string, any]) => (
              <div key={type} className="border rounded p-4">
                <h4 className="font-medium capitalize mb-2">{type.replace(/_/g, ' ')}</h4>
                <div className="text-sm text-gray-600">
                  {type === 'anomaly_detection' && result.summary && (
                    <div>Found {result.summary.total_anomalies} anomalies ({result.summary.high_confidence_count} high confidence)</div>
                  )}
                  {type === 'evidence_classification' && result.successful !== undefined && (
                    <div>Classified {result.successful} items successfully, {result.failed} failed</div>
                  )}
                  {type === 'pattern_recognition' && result.pattern_analysis && (
                    <div>Discovered {result.pattern_analysis.total_patterns} patterns across {Object.keys(result.pattern_analysis.patterns_discovered || {}).length} types</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Models Tab Component
const ModelsTab: React.FC<{ modelStats: any }> = ({ modelStats }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deep Learning Models */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold">Deep Learning Models</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Architectures:</span>
              <span className="font-medium">{modelStats?.deep_learning?.total_models || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Trained Models:</span>
              <span className="font-medium">{modelStats?.deep_learning?.trained_models || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Available Types:</span>
              <span className="font-medium">{modelStats?.deep_learning?.available_architectures?.length || 0}</span>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Available Architectures:</h4>
            <div className="flex flex-wrap gap-2">
              {modelStats?.deep_learning?.available_architectures?.map((arch: string) => (
                <span key={arch} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                  {arch}
                </span>
              )) || []}
            </div>
          </div>
        </div>

        {/* Evidence Classification */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Evidence Classification</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Trained Algorithms:</span>
              <span className="font-medium">{modelStats?.evidence_classifier?.trained_classifiers?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Evidence Categories:</span>
              <span className="font-medium">{modelStats?.evidence_classifier?.evidence_categories?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Available Algorithms:</span>
              <span className="font-medium">{modelStats?.evidence_classifier?.available_algorithms?.length || 0}</span>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Trained Algorithms:</h4>
            <div className="flex flex-wrap gap-2">
              {modelStats?.evidence_classifier?.trained_classifiers?.map((alg: string) => (
                <span key={alg} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {alg}
                </span>
              )) || []}
            </div>
          </div>
        </div>

        {/* Pattern Recognition */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold">Pattern Recognition</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pattern Types:</span>
              <span className="font-medium">{modelStats?.pattern_recognition?.pattern_types?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className="font-medium capitalize">{modelStats?.pattern_recognition?.status || 'Unknown'}</span>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Supported Patterns:</h4>
            <div className="flex flex-wrap gap-2">
              {modelStats?.pattern_recognition?.pattern_types?.map((pattern: string) => (
                <span key={pattern} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {pattern}
                </span>
              )) || []}
            </div>
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold">Anomaly Detection</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Algorithms:</span>
              <span className="font-medium">{modelStats?.anomaly_detector?.algorithms?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className="font-medium capitalize">{modelStats?.anomaly_detector?.status || 'Available'}</span>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Available Algorithms:</h4>
            <div className="flex flex-wrap gap-2">
              {modelStats?.anomaly_detector?.algorithms?.map((alg: string) => (
                <span key={alg} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                  {alg}
                </span>
              )) || []}
            </div>
          </div>
        </div>
      </div>

      {/* Model Training Section */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Model Training & Optimization</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
            Train Deep Learning Model
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Optimize Hyperparameters
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Update Model Statistics
          </button>
        </div>
      </div>
    </div>
  );
};
