import React, { useEffect, useRef } from 'react';
import { Terminal, Activity, Square, Trash2 } from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { daemonClient } from '../lib/daemonClient';

export const LiveConsole: React.FC = () => {
  const {
    isAcquiring,
    logs,
    clearLogs,
    totalArtifactsExtracted,
    currentSpeedMbps,
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
    <div className="glass-panel rounded-[2rem] p-6 h-full flex flex-col justify-between overflow-hidden relative">
      
      {/* Header */}
      <div className="flex items-start justify-between shrink-0 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-light tracking-wide text-white">Forensic Stream</h2>
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

      {/* Circular Speed & Artifacts Gauge */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-1 min-h-0">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background track ring */}
            <circle
              cx="80" cy="80" r="54"
              fill="transparent"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="10"
            />
            {/* Active Progress Ring in vibrant #FF7A59 in light mode, white in dark mode */}
            <circle
              cx="80" cy="80" r="54"
              fill="transparent"
              stroke="#FF7A59"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="dark:stroke-white transition-all duration-700 ease-out"
            />
            {/* Dashed outer accent ring */}
            <circle
              cx="80" cy="80" r="70"
              fill="transparent"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          </svg>
          
          {/* Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            <span className="text-2xl sm:text-3xl font-light tracking-tight text-white">
              {currentSpeedMbps.toFixed(1)}
            </span>
            <span className="text-[9px] uppercase tracking-widest font-mono opacity-70">
              MB/s Speed
            </span>
            <div className="mt-1 flex items-center gap-1 text-[9px] font-mono font-semibold text-[#FF7A59] dark:text-white bg-black/20 dark:bg-white/10 px-2 py-0.5 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full ${isAcquiring ? 'bg-emerald-400 animate-pulse' : 'bg-[#FF7A59] dark:bg-white'}`} />
              <span>{isAcquiring ? 'EXTRACTING' : 'IDLE'}</span>
            </div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-4 mt-2">
          <div className="text-center">
            <span className="text-xs font-mono font-bold text-white">{totalArtifactsExtracted}</span>
            <span className="block text-[9px] uppercase opacity-60">Artifacts</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="text-center">
            <span className="text-xs font-mono font-bold text-white">{isAcquiring ? 'Active' : 'Standby'}</span>
            <span className="block text-[9px] uppercase opacity-60">Status</span>
          </div>
        </div>
      </div>

      {/* Terminal Feed at bottom */}
      <div className="h-[95px] bg-black/35 dark:bg-black/55 rounded-2xl p-3 border border-white/10 font-mono text-[9.5px] overflow-y-auto shrink-0 flex flex-col space-y-1 select-text" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="opacity-40 text-center my-auto flex items-center justify-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>Forensic stream initialized. Awaiting events...</span>
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
              <div key={log.id} className="leading-relaxed flex items-start gap-1.5 break-all">
                <span className="opacity-40 select-none shrink-0">{log.timestamp.slice(11, 19)}</span>
                <span className={`font-bold select-none shrink-0 ${badgeClass}`}>[{log.level}]</span>
                <span className={`${colorClass} break-all`}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
