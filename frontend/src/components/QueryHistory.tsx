import { useEffect, useState } from 'react';
import { Clock, Search } from 'lucide-react';
import { queryAPI } from '../lib/api';

interface QueryHistoryProps {
  caseId: number;
  onSelectQuery: (query: string) => void;
}

export const QueryHistory = ({ caseId, onSelectQuery }: QueryHistoryProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const response = await queryAPI.getQueryHistory(caseId);
        setHistory(response.data.data?.queries || []);
      } catch (error) {
        console.error('Failed to load query history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [caseId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Clock className="h-5 w-5" />
          Query History
        </h3>
      </div>

      <div className="max-h-96 divide-y overflow-y-auto">
        {history.length > 0 ? (
          history.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelectQuery(item.queryText || item.query_text)}
              className="flex w-full items-start justify-between px-6 py-4 text-left transition hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{item.queryText || item.query_text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span>{new Date(item.createdAt || item.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{item.resultsCount || item.results_count || 0} results</span>
                  {(item.confidenceScore || item.confidence_score) && (
                    <>
                      <span>•</span>
                      <span>
                        Confidence {Math.round(((item.confidenceScore || item.confidence_score) ?? 0) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Search className="ml-4 h-4 w-4 flex-shrink-0 text-gray-400" />
            </button>
          ))
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            <Clock className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>No query history yet</p>
            <p className="mt-1 text-sm">Your previous queries will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
