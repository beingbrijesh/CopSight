import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Terminal, 
  Cpu, 
  Copy, 
  Check, 
  ExternalLink, 
  Zap, 
  ShieldCheck, 
  Usb, 
  PlayCircle, 
  Radio, 
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'app' | 'cli'>('cli');
  const [copied, setCopied] = useState(false);
  const [protocolTriggered, setProtocolTriggered] = useState(false);
  const [showFlags, setShowFlags] = useState(false);

  if (!isOpen) return null;

  const protocolUrl = `copsight://extract?caseId=${caseId || ''}&caseNumber=${encodeURIComponent(caseNumber || '')}&token=${token || ''}&officer=${encodeURIComponent(user?.username || '')}`;
  const cliCommand = `forensixd acquire ${caseId ? `--output-dir ./cases/case_${caseId}/extractions` : ''}`;

  const handleLaunchProtocol = () => {
    setProtocolTriggered(true);
    window.location.href = protocolUrl;
    setTimeout(() => {
      setProtocolTriggered(false);
    }, 4000);
  };

  const handleCopyCli = (cmd?: string) => {
    navigator.clipboard.writeText(cmd || cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-white">
      <div className="glass-panel w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-white/20 relative bg-[#2475B5]/95 dark:bg-[#111111]/95 backdrop-blur-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF7A59]/20 dark:bg-white/10 border border-[#FF7A59]/30 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-lg shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white tracking-tight">Direct Device Extraction</h3>
                <span className="text-[9.5px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/15 text-white font-bold border border-white/10">
                  RBAC Verified
                </span>
              </div>
              <p className="text-xs text-white/75 font-mono mt-0.5">
                {caseNumber ? `Case #${caseNumber}` : 'Evidence Docket'} • Powered by <span className="font-bold text-white">CopSight AI</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Extraction Tool Selector (App vs CLI) */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/25 dark:bg-white/5 border border-white/15 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'cli'
                ? 'bg-[#FF7A59] text-white shadow-lg scale-[1.01] dark:bg-white dark:text-black'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>forensixd CLI (Terminal)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('app')}
            className={`py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'app'
                ? 'bg-[#FF7A59] text-white shadow-lg scale-[1.01] dark:bg-white dark:text-black'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>forensixd Desktop App (GUI)</span>
          </button>
        </div>

        {/* ─── TAB 1: CLI Guide & Execution ─── */}
        {activeTab === 'cli' && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Step-by-Step Officer Workflow */}
            <div className="p-4 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15 space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white/90 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#FF7A59] dark:text-white" />
                <span>How to Extract Evidence via Terminal</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 font-mono mb-1.5">
                    <Usb className="w-3.5 h-3.5" />
                    <span>Step 1: Connect</span>
                  </div>
                  <p className="text-[11px] text-white/75 leading-relaxed">
                    Plug the suspect's phone into your Mac via USB and unlock or trust the connection.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 font-mono mb-1.5">
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Step 2: Run Command</span>
                  </div>
                  <p className="text-[11px] text-white/75 leading-relaxed">
                    Open macOS Terminal, paste the command below, and press <kbd className="px-1 py-0.5 bg-white/20 rounded text-[9px]">Enter</kbd>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 font-mono mb-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Step 3: Auto-Ingest</span>
                  </div>
                  <p className="text-[11px] text-white/75 leading-relaxed">
                    Data will parse automatically and stream directly into this CopSight case.
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Command Box */}
            <div className="p-5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15">
              <div className="flex items-center justify-between gap-4 mb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-white">Terminal Command</h4>
                  <p className="text-xs text-white/60 font-mono">Runs hardware detection and begins automated acquisition</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCli()}
                  className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-mono font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Command'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 dark:bg-black/80 border border-white/10 font-mono text-xs text-emerald-300 dark:text-emerald-400 select-all overflow-x-auto custom-scrollbar flex items-center justify-between">
                <code>$ {cliCommand}</code>
              </div>
            </div>

            {/* Advanced CLI Options Dropdown */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setShowFlags(!showFlags)}
                className="w-full flex items-center justify-between text-xs font-mono text-white/80 hover:text-white transition cursor-pointer"
              >
                <span className="font-bold">Optional: Acquisition Flags & Profiles</span>
                {showFlags ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showFlags && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs font-mono text-white/75">
                  <div className="p-2 rounded-lg bg-black/30 flex items-center justify-between">
                    <div>
                      <span className="text-cyan-300 font-bold">Interactive Wizard:</span>
                      <span className="ml-2 text-white/60">forensixd</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleCopyCli('forensixd')} 
                      className="text-[10px] text-white/80 hover:text-white underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="p-2 rounded-lg bg-black/30 flex items-center justify-between">
                    <div>
                      <span className="text-cyan-300 font-bold">Logical Only (Chats & Calls):</span>
                      <span className="ml-2 text-white/60">forensixd acquire --level logical</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleCopyCli('forensixd acquire --level logical')} 
                      className="text-[10px] text-white/80 hover:text-white underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="p-2 rounded-lg bg-black/30 flex items-center justify-between">
                    <div>
                      <span className="text-cyan-300 font-bold">Physical Bitstream (Full Flash):</span>
                      <span className="ml-2 text-white/60">forensixd acquire --level physical</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleCopyCli('forensixd acquire --level physical')} 
                      className="text-[10px] text-white/80 hover:text-white underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─── TAB 2: Desktop GUI App ─── */}
        {activeTab === 'app' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-5 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-200 border border-blue-500/30 shrink-0">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Launch forensixd by CopSight AI</h4>
                  <p className="text-xs text-white/70 font-mono mt-0.5">
                    Opens the native macOS forensic station with live waveform visualization, USB device diagnostics, and automatic Section 65B hash generator.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLaunchProtocol}
                className="w-full py-3.5 px-4 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{protocolTriggered ? 'Opening forensixd Desktop Station...' : 'Open in forensixd Desktop App'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 text-xs font-mono text-white/75 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <Cpu className="w-4 h-4" />
                <span>Device Compatibility</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-80">
                Supports iOS (DFXML, Keychain, WhatsApp, Telegram, Call logs), Android (ADB backup, MTK BROM hardware bypass), and external physical drives.
              </p>
            </div>
          </div>
        )}

        {/* Hardware & Compliance Footer */}
        <div className="mt-5 p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-white/80">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-300" />
            <span>Encrypted Protocol Bridge</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300 dark:text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Section 65B Certified Chain of Custody</span>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
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
