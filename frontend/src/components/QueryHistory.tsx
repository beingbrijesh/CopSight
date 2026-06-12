import { useState, useEffect } from 'react';
import { Clock, Search } from 'lucide-react';
import { queryAPI } from '../lib/api';

interface QueryHistoryProps {
  caseId: number;
  onSelectQuery: (item: any) => void;
  refreshTrigger?: number;
}

export const QueryHistory = ({ caseId, onSelectQuery, refreshTrigger }: QueryHistoryProps) => {
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
  }, [caseId, refreshTrigger]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 divide-y divide-gray-100">
        {history.length > 0 ? (
          history.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelectQuery(item.queryText || item.query_text)}
              className="flex w-full items-start justify-between px-2 py-4 text-left transition hover:bg-gray-50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {item.queryText || item.query_text}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                  <span>{new Date(item.createdAt || item.created_at).toLocaleString()}</span>
                  <span className="text-gray-300 dark:text-slate-600">•</span>
                  <span>{item.resultsCount ?? item.results_count ?? 0} results</span>
                  {(item.confidenceScore || item.confidence_score) && (
                    <>
                      <span className="text-gray-300 dark:text-slate-600">•</span>
                      <span>
                        {Math.round(
                          ((item.confidenceScore || item.confidence_score) ?? 0) * 100,
                        )}
                        % conf
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Search className="ml-3 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-slate-500" />
            </button>
          ))
        ) : (
          <div className="px-6 py-8 text-center text-gray-500 h-full flex flex-col justify-center items-center">
            <Clock className="mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-gray-600 dark:text-slate-400">No query history yet</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Your previous queries will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
