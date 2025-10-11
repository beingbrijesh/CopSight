import { useState } from 'react';
import { Send, Loader2, History, Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../../components/Navbar.tsx';
import { QueryResults } from '../../components/QueryResults.tsx';
import { QueryHistory } from '../../components/QueryHistory.tsx';
import { api } from '../../lib/api.ts';

export const QueryInterface = () => {
  const { caseId } = useParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const exampleQueries = [
    "Show me all communications with foreign numbers",
    "Find messages mentioning 'payment' or 'transfer'",
    "List all WhatsApp messages after September 1st",
    "Who did the suspect communicate with most frequently?",
    "Find messages containing crypto addresses",
    "Show me late-night communications (12 AM - 5 AM)"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResults(null);

    try {
      const response = await api.post(`/api/query/case/${caseId}`, {
        queryText: query,
        queryType: 'natural_language'
      });

      setResults(response.data.data);
    } catch (error) {
      console.error('Query failed:', error);
      alert('Failed to execute query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Natural Language Query
            </h1>
            <p className="text-gray-600 mt-1">Ask questions about the case data in plain English</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <History className="w-4 h-4" />
            Query History
          </button>
        </div>

        {/* Query Input */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about the case data..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Execute
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Example Queries */}
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition"
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Query History Sidebar */}
        {showHistory && (
          <div className="mb-6">
            <QueryHistory caseId={parseInt(caseId!)} onSelectQuery={setQuery} />
          </div>
        )}

        {/* Results */}
        {results && (
          <QueryResults results={results} />
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Analyzing case data...</p>
            <p className="text-sm text-gray-500 mt-2">
              Searching across messages, calls, and contacts
            </p>
          </div>
        )}

        {/* Empty State */}
        {!results && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ready to analyze case data
            </h3>
            <p className="text-gray-600">
              Enter a natural language query above or click an example to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
