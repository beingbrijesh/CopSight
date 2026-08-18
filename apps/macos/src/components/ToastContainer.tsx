import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { loggerService, ToastMessage } from '../lib/loggerService';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = loggerService.subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-4), toast]); // Max 5 visible toasts
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== toast.id));
      }, 5000);
    });
    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 select-text">
      {toasts.map((toast) => {
        let bgClass = 'bg-slate-900/90 border-white/20 text-white';
        let icon = <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />;

        if (toast.type === 'error') {
          bgClass = 'bg-[#1e0a0a]/95 border-red-500/40 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
          icon = <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />;
        } else if (toast.type === 'warn') {
          bgClass = 'bg-[#1e150a]/95 border-amber-500/40 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]';
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
        } else if (toast.type === 'success') {
          bgClass = 'bg-[#0a1e12]/95 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.2)]';
          icon = <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-2xl transition-all animate-slideUp flex items-start justify-between gap-3 shadow-2xl ${bgClass}`}
          >
            <div className="flex items-start gap-3 overflow-hidden">
              {icon}
              <div className="overflow-hidden">
                <h5 className="text-xs font-bold font-mono tracking-tight">{toast.title}</h5>
                <p className="text-[11px] opacity-90 font-mono mt-0.5 break-words leading-relaxed">
                  {toast.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(toast.id)}
              className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity shrink-0 cursor-pointer text-white"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
