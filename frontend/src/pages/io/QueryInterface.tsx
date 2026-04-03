import { useEffect, useRef, useState } from 'react';
import { Clock3, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { QueryHistory } from '../../components/QueryHistory';
import { QueryResults } from '../../components/QueryResults';
import { queryAPI } from '../../lib/api';
import { useQueryChatStore, type QueryResultPayload } from '../../store/queryChatStore';

const exampleQueries = [
  'Show me all communications with foreign numbers',
  "Find messages mentioning 'payment' or 'transfer'",
  'List all WhatsApp messages after September 1st',
  'Who did the suspect communicate with most frequently?',
  'Find messages containing crypto addresses',
  'Show me late-night communications (12 AM - 5 AM)',
];

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const QueryInterface = () => {
  const { caseId } = useParams();
  const caseKey = caseId || 'unknown';
  const conversation = useQueryChatStore((state) => state.conversations[caseKey]);
  const addMessage = useQueryChatStore((state) => state.addMessage);
  const setLatestResult = useQueryChatStore((state) => state.setLatestResult);
  const clearConversation = useQueryChatStore((state) => state.clearConversation);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const messages = conversation?.messages || [];
  const latestResult = conversation?.latestResult || null;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  const appendAssistantResult = (result: QueryResultPayload) => {
    addMessage(caseKey, {
      role: 'assistant',
      content: result.answer,
      timestamp: new Date().toISOString(),
    });
    setLatestResult(caseKey, result);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const submittedQuery = query.trim();
    if (!submittedQuery || loading || !caseId) return;

    addMessage(caseKey, {
      role: 'user',
      content: submittedQuery,
      timestamp: new Date().toISOString(),
    });
    setQuery('');
    setLoading(true);

    try {
      const response = await queryAPI.createQuery(parseInt(caseId, 10), {
        queryText: submittedQuery,
        queryType: 'natural_language',
      });

      const payload = response.data.data;
      appendAssistantResult({
        query: payload.query?.queryText || submittedQuery,
        answer: payload.result?.answer || 'No answer returned.',
        evidence: payload.result?.evidence || [],
        confidence: payload.result?.confidence || 0,
        findings: payload.findings || [],
        query_components: payload.query_components || null,
      });
    } catch (error: any) {
      appendAssistantResult({
        query: submittedQuery,
        answer:
          error.response?.data?.message ||
          'Failed to execute query. Please check your connection and try again.',
        evidence: [],
        confidence: 0,
        findings: [],
        query_components: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
                <Sparkles className="h-5 w-5 text-gray-700" />
                Query Workspace
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Ask follow-up questions naturally and keep the full case conversation in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                {showHistory ? 'Hide history' : 'Show history'}
              </button>
              <button
                type="button"
                onClick={() => clearConversation(caseKey)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <Trash2 className="h-4 w-4" />
                Clear chat
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                disabled={loading}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-[calc(100vh-17rem)] min-h-[34rem] flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
                <Sparkles className="mb-4 h-10 w-10 text-gray-300" />
                <h2 className="text-lg font-semibold text-gray-900">Start the conversation</h2>
                <p className="mt-2 max-w-md text-sm text-gray-500">
                  Ask about communications, entities, timelines, or suspicious patterns. Each query stays in the chat until you clear it.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-2xl flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 shadow-sm ${
                          message.role === 'user'
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-200 bg-white text-gray-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 px-1 text-xs text-gray-400">
                        <span>{message.role === 'user' ? 'You' : 'CopSight AI'}</span>
                        <span>•</span>
                        <span>{formatTimestamp(message.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-sm rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>CopSight is analyzing the case...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-6 py-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about this case..."
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </form>
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-6">
        {showHistory && caseId && (
          <QueryHistory caseId={parseInt(caseId, 10)} onSelectQuery={setQuery} />
        )}

        {latestResult ? (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Latest response</h2>
              <p className="mt-1 text-sm text-gray-500">
                Confidence {Math.round((latestResult.confidence || 0) * 100)}% • {latestResult.evidence.length} evidence items
              </p>
            </div>
            <div className="p-4">
              <QueryResults results={latestResult} />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Clock3 className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Ready for results</h2>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              The latest answer, evidence, and extracted findings will appear here after you submit a query.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
