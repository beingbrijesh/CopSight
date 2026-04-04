import { useEvidenceStore, type EvidenceItem } from '../store/evidenceStore';
import { Bookmark } from 'lucide-react';

// ── Color map by evidence type ──────────────────────────────────────
const CHIP_STYLES: Record<string, string> = {
  phone:   'bg-blue-100   text-blue-800   border-blue-200   hover:bg-blue-200',
  contact: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
  crypto:  'bg-amber-100  text-amber-800  border-amber-200  hover:bg-amber-200',
  message: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200',
  entity:  'bg-teal-100   text-teal-800   border-teal-200   hover:bg-teal-200',
  anomaly: 'bg-rose-100   text-rose-800   border-rose-200   hover:bg-rose-200',
  url:     'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200',
  email:   'bg-sky-100    text-sky-800    border-sky-200    hover:bg-sky-200',
  call:    'bg-lime-100   text-lime-800   border-lime-200   hover:bg-lime-200',
  other:   'bg-gray-100   text-gray-800   border-gray-200   hover:bg-gray-200',
};

const CHIP_ICONS: Record<string, string> = {
  phone:   '📱',
  contact: '👤',
  crypto:  '₿',
  message: '💬',
  entity:  '🏷️',
  anomaly: '⚠️',
  url:     '🔗',
  email:   '✉️',
  call:    '📞',
  other:   '📎',
};

interface EvidenceChipProps {
  /** The evidence data to display and link to */
  evidence: EvidenceItem;
  /** Override display label (defaults to evidence.value) */
  label?: string;
  /** Compact mode — no icon, smaller */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EvidenceChip — A highlighted, clickable inline component that wraps
 * any evidence reference. Clicking opens the EvidenceDetailPanel.
 */
export const EvidenceChip = ({ evidence, label, compact = false, className = '' }: EvidenceChipProps) => {
  const { openEvidence, bookmarkedIds } = useEvidenceStore();
  const isBookmarked = bookmarkedIds.has(evidence.id);
  const style = CHIP_STYLES[evidence.type] || CHIP_STYLES.other;
  const icon = CHIP_ICONS[evidence.type] || '📎';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openEvidence(evidence);
      }}
      title={`Click to view evidence: ${evidence.value}`}
      className={`
        inline-flex items-center gap-1 border rounded-md
        cursor-pointer transition-all duration-150
        font-medium leading-tight
        ${compact ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-xs'}
        ${style}
        ${className}
      `}
    >
      {!compact && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate max-w-[200px]">{label || evidence.value}</span>
      {isBookmarked && (
        <Bookmark className="w-3 h-3 flex-shrink-0 text-yellow-600 fill-yellow-500" />
      )}
    </button>
  );
};

export default EvidenceChip;
