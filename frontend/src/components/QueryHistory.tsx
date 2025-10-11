import { useState, useEffect } from 'react';
import { Clock, Search } from 'lucide-react';
import { api } from '../lib/api';

interface QueryHistoryProps {
  caseId: number;
  onSelectQuery: (query: string) => void;
}

export const QueryHistory = ({ caseId, onSelectQuery }: QueryHistoryProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [caseId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/query/case/${caseId}/history`);
      setHistory(response.data.data?.queries || []);
    } catch (error) {
      console.error('Failed to load query history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Query History
        </h3>
      </div>

      <div className="divide-y max-h-96 overflow-y-auto">
        {history.length > 0 ? (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectQuery(item.queryText || item.query_text)}
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{item.queryText || item.query_text}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{new Date(item.createdAt || item.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>{item.resultsCount || item.results_count || 0} results</span>
                    {item.confidenceScore && (
                      <>
                        <span>•</span>
                        <span>Confidence: {Math.round((item.confidenceScore || item.confidence_score) * 100)}%</span>
                      </>
                    )}
                  </div>
                </div>
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0 ml-4" />
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No query history yet</p>
            <p className="text-sm mt-1">Your previous queries will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};
