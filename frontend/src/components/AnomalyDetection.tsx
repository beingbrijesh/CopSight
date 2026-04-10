import { useState, useMemo } from 'react';
import {
  Brain, AlertTriangle, TrendingUp, Network, Clock, Zap,
  ChevronDown, ChevronUp, Download, Shield, Activity,
  Target, BarChart2, CheckCircle, XCircle
} from 'lucide-react';
import { analysisAPI } from '../lib/api';
import { EvidenceChip } from './EvidenceChip';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface AnomalyDetectionProps { caseId: number }

interface AnomalyResult {
  anomaly_score?: number;
  confidence: number;
  anomaly_type: string;
  description?: string;
  record?: any;
  model?: string;
  attack_category?: string;
  reconstruction_error?: number;
  threshold?: number;
  window_start?: number;
  window_end?: number;
  hour?: number; count?: number; z_score?: number; expected_count?: number;
  time_window?: string; day?: string; gap_hours?: number;
  start_time?: string; end_time?: string; burst_score?: number;
  window_size?: number; local_density?: number; degree?: number;
  phone_number?: string; expected_degree?: number; contact_diversity?: number;
  bridge_score?: number; frequency?: number; diversity?: number;
  isolation_score?: number;
}

interface DetectionResults {
  communication_anomalies: AnomalyResult[];
  temporal_anomalies: AnomalyResult[];
  network_anomalies: AnomalyResult[];
  advanced_anomalies: {
    xgb_anomalies: AnomalyResult[];
    dnn_anomalies: AnomalyResult[];
    lstm_anomalies: AnomalyResult[];
  };
  summary: {
    total_anomalies: number;
    classic_anomalies?: number;
    advanced_anomalies?: number;
    high_confidence_count: number;
    risk_level: string;
    anomaly_types: string[];
    models_used?: string[];
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high:     'text-orange-600 bg-orange-50 border-orange-200',
  medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  low:      'text-blue-600 bg-blue-50 border-blue-200',
  none:     'text-green-600 bg-green-50 border-green-200',
};

const RISK_DOT: Record<string, string> = {
  critical: 'bg-red-500 animate-pulse',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-blue-500',
  none:     'bg-green-500',
};

const confidenceColor = (c: number) =>
  c >= 0.8 ? '#dc2626' : c >= 0.6 ? '#ea580c' : c >= 0.4 ? '#ca8a04' : '#2563eb';

const confidenceBg = (c: number) =>
  c >= 0.8 ? 'bg-red-100 text-red-700' : c >= 0.6 ? 'bg-orange-100 text-orange-700'
           : c >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';

const fmtType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const fmtPct  = (c: number) => `${(c * 100).toFixed(0)}%`;

/* ─── Keyword Highlighter ────────────────────────────────────────────── */
const PHONE_RE    = /(\+\d[\d\s-]{7,})/g;
const ATTACK_RE   = /\b(DoS|Probe|R2L|U2R|attack|suspicious|anomaly|critical|malicious)\b/gi;
const CONF_RE     = /(\d{2,3}%\s*confidence)/gi;
const TIME_RE     = /(\b(?:late.night|off.hour|night.time|midnight|3:00|2:00|1:00|4:00)\b)/gi;
const FOREIGN_RE  = /\b(foreign|international|\+44|\+1|\+33|\+49)\b/gi;

function HighlightedText({ text }: { text: string }) {
  if (!text) return null;

  const parts: Array<{ text: string; type?: string }> = [];
  let remaining = text;

  // Expanded patterns to include contact names and entities
  const patterns: Array<[RegExp, string]> = [
    [PHONE_RE,    'phone'],
    [ATTACK_RE,   'attack'],
    [CONF_RE,     'conf'],
    [TIME_RE,     'time'],
    [FOREIGN_RE,  'foreign'],
    [/['"]([^'"]+)['"]/g, 'entity'], // Quoted names/entities
  ];

  while (remaining.length > 0) {
    let earliest: { idx: number; len: number; type: string } | null = null;
    for (const [re, type] of patterns) {
      re.lastIndex = 0;
      const m = re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, len: m[0].length, type };
      }
    }
    if (!earliest) { parts.push({ text: remaining }); break; }
    if (earliest.idx > 0) parts.push({ text: remaining.slice(0, earliest.idx) });
    parts.push({ text: remaining.slice(earliest.idx, earliest.idx + earliest.len), type: earliest.type });
    remaining = remaining.slice(earliest.idx + earliest.len);
  }

  const hlClass: Record<string, string> = {
    phone:   'bg-blue-100   text-blue-800   rounded px-0.5 font-mono text-sm',
    attack:  'bg-red-100    text-red-800    rounded px-0.5 font-semibold',
    conf:    'bg-orange-100 text-orange-800 rounded px-0.5 font-medium',
    time:    'bg-yellow-100 text-yellow-800 rounded px-0.5',
    foreign: 'bg-purple-100 text-purple-800 rounded px-0.5',
    entity:  'bg-emerald-100 text-emerald-800 rounded px-0.5 font-medium italic',
  };

  return (
    <span>
      {parts.map((p, i) =>
        p.type ? (
          <mark key={i} className={`${hlClass[p.type]} not-italic`} style={{ background: 'none' }}>
            <span className={hlClass[p.type]}>{p.text}</span>
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

/* ─── SVG Donut Chart ────────────────────────────────────────────────── */
function DonutChart({ data }: { data: Array<{ label: string; count: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  let offset = 0;
  const R = 40, C = 2 * Math.PI * R;

  return (
    <div className="flex items-center gap-4">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={R} fill="none" stroke="#f3f4f6" strokeWidth={18} />
        {data.map((d, i) => {
          const dash = (d.count / total) * C;
          const gap  = C - dash;
          const seg  = (
            <circle
              key={i}
              cx={50} cy={50} r={R}
              fill="none"
              stroke={d.color}
              strokeWidth={18}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
              transform="rotate(-90 50 50)"
            />
          );
          offset += dash;
          return seg;
        })}
        <text x={50} y={54} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#111827">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span>{d.label}: <strong>{d.count}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Confidence Bar ─────────────────────────────────────────────────── */
function ConfBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: confidenceColor(value) }}
      />
    </div>
  );
}

/* ─── Anomaly Card ───────────────────────────────────────────────────── */
function AnomalyCard({ anomaly, modelBadge }: { anomaly: AnomalyResult; modelBadge?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            <span className="font-semibold text-gray-900 text-sm">{fmtType(anomaly.anomaly_type)}</span>
            {anomaly.attack_category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">
                {anomaly.attack_category}
              </span>
            )}
            {modelBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">
                {modelBadge}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${confidenceBg(anomaly.confidence)}`}>
              {fmtPct(anomaly.confidence)} confidence
            </span>
          </div>
          <ConfBar value={anomaly.confidence} />
          {anomaly.description && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              <HighlightedText text={anomaly.description} />
            </p>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {open && (anomaly.record || anomaly.reconstruction_error !== undefined) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Forensic Evidence Records</span>
          </div>
          
          <div className="max-h-64 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {/* Simple key-value metrics first */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
              {anomaly.hour !== undefined && (
                <>
                  <span className="font-medium text-gray-700">Hour</span><span>{anomaly.hour}:00</span>
                  <span className="font-medium text-gray-700">Z-Score</span><span>{anomaly.z_score?.toFixed(2)}</span>
                </>
              )}
              {anomaly.degree !== undefined && (
                <>
                  <span className="font-medium text-gray-700">Comm Degree</span><span>{anomaly.degree}</span>
                  <span className="font-medium text-gray-700">Bridge Score</span><span>{anomaly.bridge_score?.toFixed(2)}</span>
                </>
              )}
              {anomaly.reconstruction_error !== undefined && (
                <>
                  <span className="font-medium text-gray-700">Recon Error</span>
                  <span className="font-mono">{anomaly.reconstruction_error.toFixed(2)} / {anomaly.threshold?.toFixed(2)}</span>
                </>
              )}
            </div>

            {/* Evidence Chips for clickable entities */}
            {anomaly.record && typeof anomaly.record === 'object' && !Array.isArray(anomaly.record) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {anomaly.record.preceding_communication?.contact_name && (
                  <EvidenceChip
                    evidence={{
                      id: `anomaly_pre_${anomaly.record.preceding_communication.contact_name}`,
                      type: 'contact',
                      value: anomaly.record.preceding_communication.contact_name,
                      content: anomaly.record.preceding_communication.content,
                      summary: 'Contact before communication gap',
                      source: { view: 'Anomaly Detection', evidenceId: anomaly.anomaly_type },
                      metadata: anomaly.record.preceding_communication,
                    }}
                  />
                )}
                {anomaly.record.resuming_communication?.contact_name && (
                  <EvidenceChip
                    evidence={{
                      id: `anomaly_post_${anomaly.record.resuming_communication.contact_name}`,
                      type: 'contact',
                      value: anomaly.record.resuming_communication.contact_name,
                      content: anomaly.record.resuming_communication.content,
                      summary: 'Contact after communication gap',
                      source: { view: 'Anomaly Detection', evidenceId: anomaly.anomaly_type },
                      metadata: anomaly.record.resuming_communication,
                    }}
                  />
                )}
                {anomaly.record.contact_name && (
                  <EvidenceChip
                    evidence={{
                      id: `anomaly_record_${anomaly.record.contact_name}_${anomaly.anomaly_type}`,
                      type: 'contact',
                      value: anomaly.record.contact_name,
                      content: anomaly.record.content,
                      summary: `Flagged by ${anomaly.model || 'anomaly detector'}`,
                      source: { view: 'Anomaly Detection', evidenceId: anomaly.anomaly_type },
                      metadata: anomaly.record,
                    }}
                  />
                )}
                {anomaly.record.phone_number && (
                  <EvidenceChip
                    evidence={{
                      id: `anomaly_phone_${anomaly.record.phone_number}`,
                      type: 'phone',
                      value: anomaly.record.phone_number,
                      content: anomaly.record.content,
                      summary: `Phone number flagged by ${anomaly.model || 'detector'}`,
                      source: { view: 'Anomaly Detection', evidenceId: anomaly.anomaly_type },
                      metadata: anomaly.record,
                    }}
                    compact
                  />
                )}
              </div>
            )}

            {/* Comprehensive Record Display (Scrollable) */}
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
              <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(anomaly.record, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Collapsible Section ────────────────────────────────────────────── */
function Section({
  title, icon, count, color, children, defaultOpen = true
}: {
  title: string; icon: React.ReactNode; count: number;
  color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color === 'text-red-600' ? 'bg-red-100 text-red-700' : color === 'text-orange-600' ? 'bg-orange-100 text-orange-700' : color === 'text-green-600' ? 'bg-green-100 text-green-700' : color === 'text-blue-600' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
            {count}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ─── Forensic Report ────────────────────────────────────────────────── */
function ForensicReport({ results }: { results: DetectionResults }) {
  const allAnoms = [
    ...results.communication_anomalies,
    ...results.temporal_anomalies,
    ...results.network_anomalies,
    ...(results.advanced_anomalies?.xgb_anomalies || []),
    ...(results.advanced_anomalies?.dnn_anomalies  || []),
    ...(results.advanced_anomalies?.lstm_anomalies || []),
  ];

  const { summary } = results;
  const risk = summary.risk_level || 'none';
  const rl = risk.charAt(0).toUpperCase() + risk.slice(1);

  const attackTypes = [...new Set(allAnoms.filter(a => a.attack_category).map(a => a.attack_category!))]
  const highConf = allAnoms.filter(a => a.confidence >= 0.7);
  const phones = [...new Set(allAnoms.filter(a => a.record?.phone_number).map(a => a.record.phone_number as string))];
  const modelsUsed = summary.models_used || [];

  const narrative = [
    `Forensic anomaly analysis completed for case data using ${modelsUsed.length > 0 ? modelsUsed.join(', ') + ' models' : 'classic ML algorithms'}.`,
    summary.total_anomalies === 0
      ? 'No significant anomalies were detected. All communication patterns are within normal parameters.'
      : `A total of ${summary.total_anomalies} anomalies were detected${summary.advanced_anomalies ? `, of which ${summary.advanced_anomalies} were flagged by advanced deep-learning models` : ''}.`,
    highConf.length > 0 ? `${highConf.length} anomaly${highConf.length > 1 ? 'ies' : ''} exceed 70% confidence threshold and require immediate review.` : '',
    attackTypes.length > 0 ? `XGBoost classifier identified potential ${attackTypes.join(', ')} attack patterns in the network traffic.` : '',
    phones.length > 0 ? `Suspicious activity was associated with the following numbers: ${phones.slice(0, 3).join(', ')}${phones.length > 3 ? ` and ${phones.length - 3} more` : ''}.` : '',
    results.advanced_anomalies?.lstm_anomalies?.length > 0 ? `LSTM Autoencoder flagged ${results.advanced_anomalies.lstm_anomalies.length} communication sequence window(s) with abnormal temporal patterns.` : '',
    `Overall risk assessment: ${rl}.`,
  ].filter(Boolean).join(' ');

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <FileText16 />
        <span className="font-semibold text-gray-900 text-sm">Forensic Report Generator (Full Result)</span>
      </div>
      <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        <p className="text-sm text-gray-700 leading-relaxed">
          <HighlightedText text={narrative} />
        </p>
      </div>
    </div>
  );
}
const FileText16 = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

/* ─── Main Component ─────────────────────────────────────────────────── */
export const AnomalyDetection = ({ caseId }: AnomalyDetectionProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DetectionResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analysisAPI.detectAnomalies(caseId);
      setResults(res.data.anomalies_detected);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to run anomaly detection. Ensure the AI service is running.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const allAdvanced = useMemo(() => {
    if (!results?.advanced_anomalies) return [];
    const a = results.advanced_anomalies;
    return [...(a.xgb_anomalies || []), ...(a.dnn_anomalies || []), ...(a.lstm_anomalies || [])];
  }, [results]);

  const allClassic = useMemo(() => {
    if (!results) return [];
    return [...results.communication_anomalies, ...results.temporal_anomalies, ...results.network_anomalies];
  }, [results]);

  const donutData = useMemo(() => {
    if (!results) return [];
    const a = results.advanced_anomalies || {};
    return [
      { label: 'XGBoost',       count: a.xgb_anomalies?.length  || 0, color: '#dc2626' },
      { label: 'DNN',           count: a.dnn_anomalies?.length   || 0, color: '#7c3aed' },
      { label: 'LSTM-AE',       count: a.lstm_anomalies?.length  || 0, color: '#0891b2' },
      { label: 'Communication', count: results.communication_anomalies?.length || 0, color: '#2563eb' },
      { label: 'Temporal',      count: results.temporal_anomalies?.length || 0, color: '#16a34a' },
      { label: 'Network',       count: results.network_anomalies?.length  || 0, color: '#ea580c' },
    ].filter(d => d.count > 0);
  }, [results]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `anomaly_report_case_${caseId}.json`;
    a.click();
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[600px] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">AI Anomaly Detection</h3>
              <p className="text-xs text-gray-500">XGBoost · DNN · LSTM-AE · Isolation Forest</p>
            </div>
            {results && (
              <span className="ml-1 bg-violet-100 text-violet-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {results.summary.total_anomalies} anomalies
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {results && (
              <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <Download size={13} /> Export JSON
              </button>
            )}
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing…</>
              ) : (
                <><Zap className="w-4 h-4" /> Run Detection</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!results && !loading && (
          <div className="text-center py-14">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-9 h-9 text-violet-300" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-1">Multi-Model Anomaly Detection</h4>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Analyse all communication logs through four AI models simultaneously — detecting attack patterns, behavioural anomalies, and temporal irregularities.
            </p>
            <div className="flex justify-center flex-wrap gap-3 text-xs text-gray-500">
              {[['XGBoost', 'Attack Classification', '🎯'], ['Universal DNN', 'Pattern Anomalies', '🧠'], ['LSTM-AE', 'Sequence Anomalies', '📈'], ['Isolation Forest', 'Outlier Detection', '🔍']].map(([m, desc, em]) => (
                <div key={m} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl">
                  <span>{em}</span>
                  <div className="text-left">
                    <div className="font-semibold text-gray-700">{m}</div>
                    <div className="text-gray-400">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div className="space-y-6">

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">Total Anomalies</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{results.summary.total_anomalies}</div>
                {results.summary.classic_anomalies != null && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    {results.summary.classic_anomalies} classic · {results.summary.advanced_anomalies} advanced
                  </div>
                )}
              </div>

              {/* Risk */}
              <div className={`rounded-xl border p-4 ${RISK_COLORS[results.summary.risk_level] || RISK_COLORS.none}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${RISK_DOT[results.summary.risk_level] || RISK_DOT.none}`} />
                  <span className="text-xs font-medium">Risk Level</span>
                </div>
                <div className="text-2xl font-bold capitalize">{results.summary.risk_level || 'none'}</div>
              </div>

              {/* High confidence */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-orange-400" />
                  <span className="text-xs text-gray-500 font-medium">High Confidence</span>
                </div>
                <div className="text-3xl font-bold text-orange-600">{results.summary.high_confidence_count}</div>
                <div className="text-[10px] text-gray-400 mt-1">≥ 70% confidence</div>
              </div>

              {/* Models */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-violet-400" />
                  <span className="text-xs text-gray-500 font-medium">Models Used</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(results.summary.models_used || ['classic']).map(m => (
                    <span key={m} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-semibold rounded-md uppercase tracking-wide">{m}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Graphical View: Donut + Confidence Strip ── */}
            {results.summary.total_anomalies > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Donut */}
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Anomaly Distribution</span>
                  </div>
                  <DonutChart data={donutData} />
                </div>

                {/* Confidence bars */}
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Confidence Breakdown</span>
                  </div>
                  <div className="space-y-2">
                    {[...allAdvanced, ...allClassic].slice(0, 8).map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-28 truncate">{fmtType(a.anomaly_type)}</span>
                        <div className="flex-1">
                          <ConfBar value={a.confidence} />
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono w-8 text-right">{fmtPct(a.confidence)}</span>
                      </div>
                    ))}
                    {(allAdvanced.length + allClassic.length) > 8 && (
                      <p className="text-[10px] text-gray-400 pt-1">+{(allAdvanced.length + allClassic.length) - 8} more…</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Forensic Report ── */}
            <ForensicReport results={results} />

            {/* ── Advanced AI Anomalies ── */}
            {results.advanced_anomalies && (
              <>
                <Section
                  title="XGBoost — Attack Classification"
                  icon={<Target size={16} />}
                  count={results.advanced_anomalies.xgb_anomalies?.length || 0}
                  color="text-red-600"
                >
                  {results.advanced_anomalies.xgb_anomalies?.map((a, i) => (
                    <AnomalyCard key={i} anomaly={a} modelBadge="XGBoost" />
                  ))}
                </Section>

                <Section
                  title="Universal DNN — Behavioural Anomalies"
                  icon={<Brain size={16} />}
                  count={results.advanced_anomalies.dnn_anomalies?.length || 0}
                  color="text-violet-600"
                >
                  {results.advanced_anomalies.dnn_anomalies?.map((a, i) => (
                    <AnomalyCard key={i} anomaly={a} modelBadge="DNN" />
                  ))}
                </Section>

                <Section
                  title="LSTM Autoencoder — Sequence Anomalies"
                  icon={<TrendingUp size={16} />}
                  count={results.advanced_anomalies.lstm_anomalies?.length || 0}
                  color="text-cyan-600"
                >
                  {results.advanced_anomalies.lstm_anomalies?.map((a, i) => (
                    <AnomalyCard key={i} anomaly={a} modelBadge="LSTM-AE" />
                  ))}
                </Section>
              </>
            )}

            {/* ── Classic Anomalies ── */}
            <Section
              title="Communication Anomalies"
              icon={<Network size={16} />}
              count={results.communication_anomalies?.length || 0}
              color="text-blue-600"
            >
              {results.communication_anomalies?.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            </Section>

            <Section
              title="Temporal Anomalies"
              icon={<Clock size={16} />}
              count={results.temporal_anomalies?.length || 0}
              color="text-green-600"
            >
              {results.temporal_anomalies?.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            </Section>

            <Section
              title="Network Anomalies"
              icon={<Activity size={16} />}
              count={results.network_anomalies?.length || 0}
              color="text-orange-600"
            >
              {results.network_anomalies?.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
            </Section>

            {/* Clean slate */}
            {results.summary.total_anomalies === 0 && (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-gray-900 mb-1">No Anomalies Detected</h4>
                <p className="text-sm text-gray-500">All communication patterns are within normal parameters.</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
