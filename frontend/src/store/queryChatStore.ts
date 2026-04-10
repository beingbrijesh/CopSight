import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueryResultPayload {
  query: string | null;
  answer: string;
  findings: any[];
  evidence: any[];
  confidence: number;
  query_components: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CaseConversation {
  messages: ChatMessage[];
  latestResult: QueryResultPayload | null;
}

interface QueryChatState {
  conversations: Record<string, CaseConversation>;
  addMessage: (caseKey: string, message: ChatMessage) => void;
  setLatestResult: (caseKey: string, result: QueryResultPayload) => void;
  clearConversation: (caseKey: string) => void;
}

export const useQueryChatStore = create<QueryChatState>()(
  persist(
    (set) => ({
      conversations: {},
      addMessage: (caseKey, message) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [caseKey]: {
              messages: [...(state.conversations[caseKey]?.messages || []), message],
              latestResult: state.conversations[caseKey]?.latestResult || null,
            },
          },
        })),
      setLatestResult: (caseKey, result) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [caseKey]: {
              messages: state.conversations[caseKey]?.messages || [],
              latestResult: result,
            },
          },
        })),
      clearConversation: (caseKey) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [caseKey]: {
              messages: [],
              latestResult: null,
            },
          },
        })),
    }),
    {
      name: 'copsight-query-chat',
    }
  )
);
