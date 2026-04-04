import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────
export interface EvidenceItem {
  /** Unique key for de-duplication (e.g. ES doc id, entity DB id, or generated) */
  id: string;
  /** Display type badge */
  type: 'phone' | 'contact' | 'crypto' | 'message' | 'entity' | 'anomaly' | 'url' | 'email' | 'call' | 'other';
  /** Primary display value (the phone number, name, address…) */
  value: string;
  /** Full message / record content (scrollable) */
  content?: string;
  /** One-line auto-generated summary */
  summary?: string;
  /** Where this evidence was surfaced */
  source: {
    view: string;          // e.g. "Anomaly Detection", "Query Results", "Entities"
    caseId?: string | number;
    evidenceId?: string;   // ES doc id or DB id
    timestamp?: string;    // When the evidence was extracted / indexed
  };
  /** Arbitrary metadata for the detail panel */
  metadata?: Record<string, any>;
}

interface EvidenceState {
  /** Currently selected evidence (shown in detail panel) */
  selected: EvidenceItem | null;
  /** Is the detail panel open? */
  isOpen: boolean;
  /** Set of evidence IDs that are bookmarked (for chip indicators) */
  bookmarkedIds: Set<string>;

  /** Open the detail panel for a specific evidence item */
  openEvidence: (item: EvidenceItem) => void;
  /** Close the detail panel */
  closeEvidence: () => void;
  /** Mark an ID as bookmarked (after API success) */
  addBookmarkId: (id: string) => void;
  /** Remove a bookmarked ID */
  removeBookmarkId: (id: string) => void;
  /** Bulk-set bookmarked IDs (e.g. on initial load) */
  setBookmarkedIds: (ids: string[]) => void;
}

export const useEvidenceStore = create<EvidenceState>((set) => ({
  selected: null,
  isOpen: false,
  bookmarkedIds: new Set(),

  openEvidence: (item) => set({ selected: item, isOpen: true }),
  closeEvidence: () => set({ isOpen: false }),

  addBookmarkId: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedIds);
      next.add(id);
      return { bookmarkedIds: next };
    }),

  removeBookmarkId: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedIds);
      next.delete(id);
      return { bookmarkedIds: next };
    }),

  setBookmarkedIds: (ids) => set({ bookmarkedIds: new Set(ids) }),
}));
