import React, { useEffect, useRef } from 'react';
import { Activity, Square, Trash2, ShieldCheck } from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { daemonClient } from '../lib/daemonClient';

export const LiveConsole: React.FC = () => {
  const {
    isAcquiring,
    logs,
    clearLogs,
    totalArtifactsExtracted,
    currentSpeedMbps,
    latestArtifactName,
  } = useDaemonStore();

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAbort = async () => {
    await daemonClient.cancelAcquisition();
  };

  // Progress gauge calculation
  const progressPercent = isAcquiring
    ? Math.min(Math.max((totalArtifactsExtracted / 250) * 100, 15), 95)
    : totalArtifactsExtracted > 0 ? 100 : 0;
  const circleRadius = 54;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6 h-full flex flex-col justify-between overflow-hidden relative shadow-lg">
      
      {/* Top Header */}
      <div className="flex items-start justify-between shrink-0 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-sm shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-light tracking-wide text-white">Forensic Stream</h2>
            <p className="text-[10px] uppercase tracking-wider opacity-70">Live Telemetry & Logs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAcquiring && (
            <button
              onClick={handleAbort}
              className="px-3 py-1 rounded-full btn-danger text-white font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer animate-pulse shadow-md flex items-center gap-1"
              title="Abort Extraction"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Abort</span>
            </button>
          )}
          <button
            onClick={clearLogs}
            className="p-2.5 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 transition-all cursor-pointer text-white"
            title="Clear Console Output"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Responsive Telemetry Gauge & Quick Metrics Bar */}
      <div className="shrink-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 mb-3">
        
        {/* Speedometer Radial Gauge */}
        <div className="flex items-center gap-3">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              {/* Background track ring */}
              <circle
                cx="80"
                cy="80"
                r="54"
                fill="transparent"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="12"
              />
              {/* Active Progress Ring in vibrant coral #FF7A59 */}
              <circle
                cx="80"
                cy="80"
                r="54"
                fill="transparent"
                stroke="#FF7A59"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="dark:stroke-white transition-all duration-700 ease-out"
              />
            </svg>
            
            {/* Speed Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                {currentSpeedMbps.toFixed(1)}
              </span>
              <span className="text-[8px] uppercase tracking-wider font-mono opacity-70">
                MB/s
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${isAcquiring ? 'bg-emerald-400 animate-ping' : 'bg-[#FF7A59] dark:bg-white'}`} />
              <span className="text-xs font-mono font-bold text-white">
                {isAcquiring ? 'STREAMING DATA' : 'ENGINE READY'}
              </span>
            </div>
            <p className="text-[10px] font-mono opacity-70 truncate max-w-[180px]">
              {latestArtifactName || 'Awaiting bitstream...'}
            </p>
          </div>
        </div>

        {/* Counter Stats */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-4">
          <div className="text-left">
            <span className="text-sm font-mono font-bold text-white block">{totalArtifactsExtracted}</span>
            <span className="text-[9px] uppercase opacity-60 font-mono">Artifacts</span>
          </div>
          <div className="h-6 w-px bg-white/15" />
          <div className="text-left">
            <span className={`text-xs font-mono font-bold block ${isAcquiring ? 'text-emerald-400' : 'text-white/80'}`}>
              {isAcquiring ? 'Active' : 'Standby'}
            </span>
            <span className="text-[9px] uppercase opacity-60 font-mono">Status</span>
          </div>
        </div>

      </div>

      {/* Responsive Terminal Log Feed */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-black/40 dark:bg-black/60 rounded-2xl p-3 border border-white/10 overflow-y-auto font-mono text-[10.5px] sm:text-[11px] space-y-1.5 min-h-[140px] max-h-[280px] sm:max-h-none shadow-inner select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-6">
            <ShieldCheck className="w-6 h-6 mb-1 opacity-50" />
            <span className="text-[10px]">Forensic telemetry stream initialized. Logs output in real-time.</span>
          </div>
        ) : (
          logs.map((log) => {
            let colorClass = 'text-white/80';
            let badgeClass = 'text-white/50';

            if (log.level === 'SUCCESS') {
              colorClass = 'text-emerald-300 font-medium';
              badgeClass = 'text-emerald-400';
            } else if (log.level === 'WARN') {
              colorClass = 'text-amber-300 font-medium';
              badgeClass = 'text-amber-400';
            } else if (log.level === 'ERROR') {
              colorClass = 'text-red-200 dark:text-rose-400 font-bold';
              badgeClass = 'text-red-300 dark:text-rose-400';
            }

            return (
              <div key={log.id} className="leading-relaxed flex items-start gap-1.5 break-all select-text">
                <span className="opacity-40 shrink-0 select-text">{log.timestamp.slice(11, 19)}</span>
                <span className={`font-bold shrink-0 select-text ${badgeClass}`}>[{log.level}]</span>
                <span className={`${colorClass} break-all select-text`}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
