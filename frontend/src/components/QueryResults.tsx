import { useState } from 'react';
import { AlertCircle, Bookmark, CheckCircle, Download, MessageSquare, Phone, Users } from 'lucide-react';

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

const getConfidenceTone = (confidence: number) => {
  if (confidence >= 0.8) return 'bg-emerald-50 text-emerald-700';
  if (confidence >= 0.6) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
};

const getSourceIcon = (sourceType: string) => {
  if (sourceType === 'sms' || sourceType === 'whatsapp') return MessageSquare;
  if (sourceType === 'call_log') return Phone;
  return Users;
};

export const QueryResults = ({ results }: QueryResultsProps) => {
  const [activeTab, setActiveTab] = useState<'answer' | 'evidence' | 'analysis'>('answer');
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());

  const handleBookmark = (itemId: string) => {
    setBookmarkedItems((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Query Results</h2>
            <p className="mt-1 text-sm text-gray-500">
              {results.evidence?.length || 0} evidence items matched this request.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getConfidenceTone(results.confidence || 0)}`}>
              Confidence {Math.round((results.confidence || 0) * 100)}%
            </span>
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 px-2 sm:px-4">
        <div className="flex gap-1">
          {[
            ['answer', 'AI Answer'],
            ['evidence', `Evidence (${results.evidence?.length || 0})`],
            ['analysis', 'Analysis'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as 'answer' | 'evidence' | 'analysis')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'answer' && (
          <div className="space-y-6">
            {results.answer ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-700" />
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{results.answer}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                No answer is available for this query yet.
              </div>
            )}

            {results.findings?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Key Findings</h3>
                {results.findings.map((finding: any, index: number) => (
                  <div key={`${finding.finding || finding}-${index}`} className="flex gap-3 rounded-lg border border-gray-200 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-800">{finding.finding || finding}</p>
                      {finding.type && <p className="mt-1 text-xs text-gray-400">{finding.type}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-4">
            {results.evidence?.length > 0 ? (
              results.evidence.map((item: any, index: number) => {
                const sourceType = item.source?.type || item.metadata?.sourceType || 'unknown';
                const SourceIcon = getSourceIcon(sourceType);

                return (
                  <div key={item.id || index} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="rounded-lg bg-gray-100 p-2">
                          <SourceIcon className="h-4 w-4 text-gray-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium capitalize text-gray-900">{sourceType.replaceAll('_', ' ')}</span>
                            <span className="text-xs text-gray-400">Score {(item.score || 0).toFixed(2)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-700">{item.content || item.source?.content}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            {item.metadata?.phoneNumber && <span>From {item.metadata.phoneNumber}</span>}
                            {item.metadata?.timestamp && <span>{new Date(item.metadata.timestamp).toLocaleString()}</span>}
                          </div>
                          {item.highlight?.content?.[0] && (
                            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              <span dangerouslySetInnerHTML={{ __html: item.highlight.content[0] }} />
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBookmark(item.id || String(index))}
                        className={`rounded-lg p-2 transition ${
                          bookmarkedItems.has(item.id || String(index))
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                      >
                        <Bookmark className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                No evidence matched this query.
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            {results.query_components && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Intent</p>
                  <p className="mt-2 text-sm text-gray-900">{results.query_components.intent || 'N/A'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Keywords</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(results.query_components.keywords || []).map((keyword: string) => (
                      <span key={keyword} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                {results.query_components.entities?.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Detected Entities</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {results.query_components.entities.map((entity: string) => (
                        <span key={entity} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-2xl font-semibold text-gray-900">{results.evidence?.length || 0}</p>
                <p className="mt-1 text-sm text-gray-500">Evidence Items</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-2xl font-semibold text-gray-900">{Math.round((results.confidence || 0) * 100)}%</p>
                <p className="mt-1 text-sm text-gray-500">Confidence</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-2xl font-semibold text-gray-900">{results.findings?.length || 0}</p>
                <p className="mt-1 text-sm text-gray-500">Findings</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
