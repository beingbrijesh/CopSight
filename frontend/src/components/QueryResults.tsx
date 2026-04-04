import { useState } from 'react';
import { CheckCircle, AlertCircle, MessageSquare, Phone, Users, Download } from 'lucide-react';
import { EvidenceChip } from './EvidenceChip';
import type { EvidenceItem } from '../store/evidenceStore';

interface QueryResultsProps {
  results: {
    query: any;
    answer: string;
    findings: any[];
    evidence: any[];
    confidence: number;
    query_components: any;
  };
}

export const QueryResults = ({ results }: QueryResultsProps) => {
  const [activeTab, setActiveTab] = useState<'answer' | 'evidence' | 'analysis'>('answer');

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Query Results</h2>
            <p className="text-purple-100 text-sm mt-1">
              Found {results.evidence?.length || 0} relevant items
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(results.confidence || 0)}`}>
              {getConfidenceLabel(results.confidence || 0)}
            </div>
            <button className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('answer')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'answer'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            AI Answer
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'evidence'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Evidence ({results.evidence?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'analysis'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Answer Tab */}
        {activeTab === 'answer' && (
          <div>
            {results.answer ? (
              <div className="prose max-w-none">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-gray-800 whitespace-pre-wrap">{results.answer}</div>
                  </div>
                </div>

                {results.findings && results.findings.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Findings</h3>
                    <div className="space-y-3">
                      {results.findings.map((finding: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-gray-800">{finding.finding || finding}</p>
                            {finding.type && (
                              <span className="text-xs text-gray-500 mt-1 inline-block">
                                Type: {finding.type}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No answer available. The AI service may not be running.
              </div>
            )}
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            {results.evidence && results.evidence.length > 0 ? (
              results.evidence.map((item: any, idx: number) => {
                const evidenceItem: EvidenceItem = {
                  id: item.id || `evidence_${idx}`,
                  type: item.source?.type === 'call_log' ? 'call' : item.source?.type === 'sms' || item.source?.type === 'whatsapp' ? 'message' : 'entity',
                  value: item.content || item.source?.content || 'Evidence Record',
                  content: item.content || item.source?.content,
                  summary: `${item.source?.type || 'Unknown'} evidence with relevance score ${(item.score || 0).toFixed(2)}`,
                  source: {
                    view: 'Query Results',
                    evidenceId: item.id,
                    timestamp: item.metadata?.timestamp,
                  },
                  metadata: {
                    phoneNumber: item.metadata?.phoneNumber,
                    sourceType: item.source?.type || item.metadata?.sourceType,
                    score: item.score,
                    ...(item.metadata || {}),
                  },
                };

                return (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {item.source?.type === 'sms' || item.source?.type === 'whatsapp' ? (
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      ) : item.source?.type === 'call_log' ? (
                        <Phone className="w-5 h-5 text-green-600" />
                      ) : (
                        <Users className="w-5 h-5 text-purple-600" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {item.source?.type || item.metadata?.sourceType || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Score: {(item.score || 0).toFixed(2)}
                      </span>
                    </div>
                    <EvidenceChip evidence={evidenceItem} label="View Details" compact />
                  </div>

                  <div className="mb-3">
                    <p className="text-gray-800">{item.content || item.source?.content}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {item.metadata?.phoneNumber && (
                      <EvidenceChip
                        evidence={{
                          ...evidenceItem,
                          id: `phone_${item.metadata.phoneNumber}`,
                          type: 'phone',
                          value: item.metadata.phoneNumber,
                          summary: `Phone number found in ${item.source?.type || 'evidence'}`,
                        }}
                        compact
                      />
                    )}
                    {item.metadata?.timestamp && (
                      <span>Date: {new Date(item.metadata.timestamp).toLocaleString()}</span>
                    )}
                  </div>

                  {item.highlight && (
                    <div className="mt-3 p-2 bg-yellow-50 border-l-2 border-yellow-400 text-sm">
                      <span dangerouslySetInnerHTML={{ __html: item.highlight.content?.[0] }} />
                    </div>
                  )}
                </div>
              );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No evidence found for this query
              </div>
            )}
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Query Analysis</h3>
              
              {results.query_components && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Intent</h4>
                    <p className="text-gray-900">{results.query_components.intent || 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {results.query_components.keywords?.map((keyword: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {results.query_components.entities && results.query_components.entities.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg col-span-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Detected Entities</h4>
                      <div className="flex flex-wrap gap-2">
                        {results.query_components.entities.map((entity: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.query_components.filters && Object.keys(results.query_components.filters).length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg col-span-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Applied Filters</h4>
                      <pre className="text-xs text-gray-700 overflow-auto">
                        {JSON.stringify(results.query_components.filters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{results.evidence?.length || 0}</div>
                  <div className="text-sm text-gray-600">Evidence Items</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((results.confidence || 0) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Confidence</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{results.findings?.length || 0}</div>
                  <div className="text-sm text-gray-600">Key Findings</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
