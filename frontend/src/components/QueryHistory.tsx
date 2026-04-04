import { useState, useEffect } from 'react';
import { Clock, Search, MessageSquare, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

interface QueryHistoryProps {
  caseId: number;
  onSelectQuery: (item: any) => void;
  refreshTrigger?: number;
}

export const QueryHistory = ({ caseId, onSelectQuery, refreshTrigger }: QueryHistoryProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [caseId, refreshTrigger]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/query/case/${caseId}/history`);
      setHistory(response.data.data.queries || []);
    } catch (error) {
      console.error('Failed to load query history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-800/30 rounded-xl p-4 border border-gray-800/50">
            <div className="h-3 bg-gray-700/50 rounded w-3/4 mb-3"></div>
            <div className="h-2 bg-gray-700/30 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.length > 0 ? (
        history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectQuery(item)}
            className="w-full text-left p-4 rounded-xl bg-gray-800/20 hover:bg-purple-600/10 border border-gray-800/50 hover:border-purple-500/30 transition-all group relative overflow-hidden"
          >
            {/* Hover Accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 font-medium text-xs line-clamp-2 group-hover:text-white transition-colors duration-200 leading-relaxed mb-2">
                  {item.queryText || item.query_text}
                </p>
                <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-gray-600 group-hover:text-gray-500 transition-colors">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(item.createdAt || item.created_at).toLocaleDateString()}
                  </span>
                  {item.resultsCount || item.results_count ? (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-500/50" />
                      {item.resultsCount || item.results_count} hits
                    </span>
                  ) : null}
                </div>
              </div>
              <MessageSquare className="w-3 h-3 text-gray-700 group-hover:text-purple-400 mt-0.5 flex-shrink-0 transition-colors" />
            </div>
          </button>
        )
      )) : (
        <div className="py-20 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-gray-700" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-1">No Query Logs Found</p>
          <p className="text-[9px] text-gray-700">Submit a forensic query to begin.</p>
        </div>
      )}
    </div>
  );
};
