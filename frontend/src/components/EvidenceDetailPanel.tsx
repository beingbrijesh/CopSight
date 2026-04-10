import { useState } from 'react';
import { X, Bookmark, BookmarkCheck, Copy, Check, ExternalLink, Tag, FileText, Clock, MapPin, Hash } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useEvidenceStore } from '../store/evidenceStore';
import { bookmarkAPI } from '../lib/api';

// ── Badge colours (matching EvidenceChip) ─────────────────────────
const TYPE_BADGE: Record<string, { bg: string; icon: string; label: string }> = {
  phone:   { bg: 'bg-blue-100 text-blue-800',      icon: '📱', label: 'Phone Number' },
  contact: { bg: 'bg-emerald-100 text-emerald-800', icon: '👤', label: 'Contact' },
  crypto:  { bg: 'bg-amber-100 text-amber-800',     icon: '₿',  label: 'Crypto Address' },
  message: { bg: 'bg-violet-100 text-violet-800',   icon: '💬', label: 'Message' },
  entity:  { bg: 'bg-teal-100 text-teal-800',       icon: '🏷️', label: 'Entity' },
  anomaly: { bg: 'bg-rose-100 text-rose-800',       icon: '⚠️', label: 'Anomaly' },
  url:     { bg: 'bg-purple-100 text-purple-800',   icon: '🔗', label: 'URL' },
  email:   { bg: 'bg-sky-100 text-sky-800',         icon: '✉️', label: 'Email' },
  call:    { bg: 'bg-lime-100 text-lime-800',       icon: '📞', label: 'Call Record' },
  other:   { bg: 'bg-gray-100 text-gray-800',       icon: '📎', label: 'Evidence' },
};

/**
 * EvidenceDetailPanel — a slide-over drawer (right side) that displays
 * full evidence details, citation, content, and a bookmark button.
 * Rendered once at the App root; visibility is driven by the evidence store.
 */
export const EvidenceDetailPanel = () => {
  const { selected, isOpen, closeEvidence, bookmarkedIds, addBookmarkId, removeBookmarkId } = useEvidenceStore();
  const { caseId: routeCaseId } = useParams();
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!selected) return null;

  const badge = TYPE_BADGE[selected.type] || TYPE_BADGE.other;
  const isBookmarked = bookmarkedIds.has(selected.id);
  const caseId = selected.source.caseId || routeCaseId;

  // Build citation string
  const citation = [
    `Source: ${selected.source.view}`,
    caseId ? `Case #${caseId}` : null,
    selected.source.evidenceId ? `Evidence ID: ${selected.source.evidenceId}` : null,
    selected.source.timestamp ? `Extracted: ${new Date(selected.source.timestamp).toLocaleDateString()}` : null,
  ].filter(Boolean).join(' | ');

  const handleCopyCitation = () => {
    const text = `[Evidence] ${selected.value}\n${citation}\n${selected.summary || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = async () => {
    if (!caseId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (isBookmarked) {
        // For simplicity, we just toggle the local state.
        // A full implementation would call deleteBookmark with the bookmark's DB id.
        removeBookmarkId(selected.id);
      } else {
        await bookmarkAPI.createBookmark(Number(caseId), {
          evidenceType: selected.type,
          evidenceId: selected.id,
          evidenceSource: selected.source.view,
          evidenceContent: {
            value: selected.value,
            content: selected.content,
            summary: selected.summary,
            citation,
            metadata: selected.metadata,
          },
          notes: notes || `Bookmarked from ${selected.source.view}`,
          tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [selected.type],
        });
        addBookmarkId(selected.id);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={closeEvidence}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold ${badge.bg}`}>
              {badge.icon} {badge.label}
            </span>
          </div>
          <button
            onClick={closeEvidence}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">

          {/* Primary Value */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 break-all leading-tight">
              {selected.value}
            </h2>
            {selected.summary && (
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed italic">
                {selected.summary}
              </p>
            )}
          </div>

          {/* ── Citation Block ──────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3" /> Citation
              </span>
              <button
                onClick={handleCopyCitation}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span>Source: <span className="font-medium text-slate-800">{selected.source.view}</span></span>
              </div>
              {caseId && (
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>Case: <span className="font-medium text-slate-800">#{caseId}</span></span>
                </div>
              )}
              {selected.source.evidenceId && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>Evidence ID: <span className="font-mono text-slate-800">{selected.source.evidenceId}</span></span>
                </div>
              )}
              {selected.source.timestamp && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span>Extracted: <span className="font-medium text-slate-800">{new Date(selected.source.timestamp).toLocaleString()}</span></span>
                </div>
              )}
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────────── */}
          {selected.content && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                📝 Full Content
              </span>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-52 overflow-y-auto custom-scrollbar">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selected.content}
                </p>
              </div>
            </div>
          )}

          {/* ── Metadata ────────────────────────────────────────── */}
          {selected.metadata && Object.keys(selected.metadata).length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                🔍 Details
              </span>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto custom-scrollbar">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  {Object.entries(selected.metadata).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="font-medium text-gray-500 capitalize whitespace-nowrap">
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-gray-800 break-all">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* ── Bookmark Footer ───────────────────────────────────── */}
        <div className="border-t bg-gray-50 px-5 py-4 space-y-3">
          {!isBookmarked && (
            <>
              <input
                type="text"
                placeholder="Add notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tags (comma-separated)..."
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          <button
            onClick={handleBookmark}
            disabled={saving}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              font-semibold text-sm transition-all duration-200
              ${isBookmarked
                ? 'bg-yellow-50 text-yellow-700 border-2 border-yellow-300 hover:bg-yellow-100'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              }
              ${saving ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isBookmarked ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
            {isBookmarked ? 'Bookmarked ✓' : 'Bookmark Evidence'}
          </button>

          {saveSuccess && (
            <p className="text-center text-xs text-green-600 font-medium animate-pulse">
              ✓ Evidence bookmarked with citation
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default EvidenceDetailPanel;
