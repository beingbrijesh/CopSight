import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Clock3, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { QueryHistory } from '../../components/QueryHistory';
import { QueryResults } from '../../components/QueryResults';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
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
  const [activeRightTab, setActiveRightTab] = useState<'history' | 'response' | null>(null);

  const rightPanelOpen = activeRightTab !== null;
  const messages = conversation?.messages || [];
  const latestResult = conversation?.latestResult || null;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  // Auto-expand response panel when a new result arrives
  useEffect(() => {
    if (latestResult) {
      setActiveRightTab('response');
    }
  }, [latestResult]);

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
    <div className={`mx-auto grid max-w-7xl gap-6 transition-all duration-300 ${rightPanelOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[minmax(0,1fr)_64px]'}`}>
      {/* ── Main chat panel ── */}
      <section className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 8rem)', minHeight: '36rem' }}>
        {/* Header - Only show when no messages */}
        {messages.length === 0 && (
          <div className="flex-shrink-0 border-b border-gray-200 px-6 py-5">
            <div>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                Ask follow-up questions naturally and keep the full case conversation in one place.
              </p>
            </div>

            {/* Example query chips */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {exampleQueries.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                  disabled={loading}
                  className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages area — scrolls internally ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <Sparkles className="mb-4 h-10 w-10 text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900">Start the conversation</h2>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                Ask about communications, entities, timelines, or suspicious patterns. Each query
                stays in the chat until you clear it.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex flex-col ${message.role === 'user' ? 'items-end max-w-2xl' : 'items-start max-w-[90%]'}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm w-full ${
                        message.role === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 bg-white text-gray-800'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      ) : (
                        <div className="text-sm leading-6 overflow-hidden">
                          <MarkdownRenderer content={message.content} />
                        </div>
                      )}
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

        {/* ── Input bar — pinned to bottom ── */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
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
      </section>

      {/* ── Right side panel — independently scrollable ── */}
      <aside
        className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 border border-gray-200 rounded-lg bg-white shadow-sm ${rightPanelOpen ? 'p-4' : 'items-center py-4'}`}
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        {rightPanelOpen ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex w-full items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                {activeRightTab === 'history' ? (
                  <><Clock3 className="h-4 w-4 text-gray-500" /> Query History</>
                ) : (
                  <><Sparkles className="h-4 w-4 text-blue-500" /> Latest Response</>
                )}
              </h2>
              
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => clearConversation(caseKey)}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {activeRightTab === 'history' && caseId && (
                <QueryHistory caseId={parseInt(caseId, 10)} onSelectQuery={setQuery} />
              )}

              {activeRightTab === 'response' && (
                latestResult ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-gray-500">
                      Confidence {Math.round((latestResult.confidence || 0) * 100)}% • {latestResult.evidence.length} evidence items
                    </p>
                    <QueryResults results={latestResult} />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center mt-4">
                    <Clock3 className="mx-auto h-8 w-8 text-gray-300 mb-3" />
                    <h3 className="text-sm font-semibold text-gray-700">Ready for results</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Submit a query to see the detailed response and evidence.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          /* Icon-only collapsed state */
          <div className="flex flex-col items-center gap-4 w-full">
            <button
              onClick={() => setActiveRightTab(latestResult ? 'response' : 'history')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition mb-2"
              title="Expand sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="h-px w-8 bg-gray-200 my-1" />

            <button
              onClick={() => clearConversation(caseKey)}
              className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <Trash2 className="h-5 w-5" />
              <span className="absolute right-full mr-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block z-50">
                Clear chat
              </span>
            </button>

            <button
              onClick={() => setActiveRightTab('history')}
              className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <Clock3 className="h-5 w-5" />
              <span className="absolute right-full mr-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block z-50">
                History & Info
              </span>
            </button>

            {latestResult && (
              <button
                onClick={() => setActiveRightTab('response')}
                className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <Sparkles className="h-5 w-5" />
                <span className="absolute right-full mr-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block z-50">
                  Latest Response
                </span>
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
