import React, { useState } from 'react';
import { X, Smartphone, Terminal, Cpu, Copy, Check, ExternalLink, Zap, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface DirectExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: number | string;
  caseNumber?: string;
}

export const DirectExtractionModal: React.FC<DirectExtractionModalProps> = ({
  isOpen,
  onClose,
  caseId,
  caseNumber,
}) => {
  const { token, user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [protocolTriggered, setProtocolTriggered] = useState(false);

  if (!isOpen) return null;

  const protocolUrl = `copsight://extract?caseId=${caseId || ''}&caseNumber=${encodeURIComponent(caseNumber || '')}&token=${token || ''}&officer=${encodeURIComponent(user?.username || '')}`;
  const cliCommand = `forensixd acquire ${caseId ? `--output-dir ./cases/case_${caseId}/extractions` : ''}`;

  const handleLaunchProtocol = () => {
    setProtocolTriggered(true);
    // Trigger macOS custom URL scheme to open forensixd by CopSight AI
    window.location.href = protocolUrl;
    setTimeout(() => {
      setProtocolTriggered(false);
    }, 4000);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-white">
      <div className="glass-panel w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-white/20 relative bg-[#2475B5]/95 dark:bg-[#111111]/95 backdrop-blur-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF7A59]/20 dark:bg-white/10 border border-[#FF7A59]/30 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white tracking-tight">Direct Device Extraction</h3>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/15 text-white font-bold border border-white/10">
                  RBAC Verified
                </span>
              </div>
              <p className="text-xs text-white/75 font-mono mt-0.5">
                {caseNumber ? `Case #${caseNumber}` : 'Extraction Suite'} • Powered by <span className="font-bold text-white">CopSight AI</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option 1: One-Click Native macOS App Launch */}
        <div className="mb-5 p-5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15 hover:border-white/30 transition shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-200 border border-blue-500/30">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">forensixd by CopSight AI</h4>
                <p className="text-xs text-white/70 font-mono">Native macOS hardware USB extraction workstation</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchProtocol}
            className="w-full py-3 px-4 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>{protocolTriggered ? 'Opening forensixd Desktop App...' : 'Open in forensixd by CopSight AI'}</span>
          </button>
        </div>

        {/* Option 2: CLI / Daemon Command */}
        <div className="mb-5 p-5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15 hover:border-white/30 transition shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-500/30">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">forensixd CLI by CopSight AI</h4>
                <p className="text-xs text-white/70 font-mono">Terminal extraction & streaming pipeline</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCli}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-mono text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-black/40 dark:bg-black/70 border border-white/10 font-mono text-xs text-emerald-300 dark:text-emerald-400 select-all overflow-x-auto custom-scrollbar">
            <code>$ {cliCommand}</code>
          </div>
        </div>

        {/* Hardware & Protocols Support Badge */}
        <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-white/80">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-300" />
            <span>iOS (DFXML), Android (ADB/MTK BROM), Physical Disks</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-300 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Section 65B Certified</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
