import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User, Lock, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../lib/api';
import logoImg from '../assets/logo.jpeg';

export const AuthGate: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Verifying Credentials...');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'warming_up' | 'online' | 'offline'>('checking');

  const { login } = useAuthStore();
  const isProbingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const retryTimerRef = useRef<any>(null);

  // Sequential health probe: waits for acknowledgement of old request before hitting any new one.
  // If no acknowledgement is received within 1 min (60s), times out and retries.
  const probeServer = useCallback(async (manual = false) => {
    if (isProbingRef.current || !isMountedRef.current) return;
    isProbingRef.current = true;

    if (manual || backendStatus === 'offline') {
      setBackendStatus('checking');
    }

    try {
      // Single request with strict 60s (1 min) acknowledgement timeout
      const res = await authService.checkHealth(60000);
      if (!isMountedRef.current) return;

      if (res.isOnline) {
        setBackendStatus('online');
        // Server is acknowledged and online. Terminate further polling.
        return;
      } else {
        setBackendStatus(res.isWarmingUp ? 'warming_up' : 'offline');
      }
    } catch {
      if (!isMountedRef.current) return;
      setBackendStatus('offline');
    } finally {
      isProbingRef.current = false;
      // Schedule the next single probe only after the previous request has completed or timed out
      if (isMountedRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            probeServer();
          }
        }, 3000);
      }
    }
  }, [backendStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    probeServer();

    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimerRef.current);
    };
  }, [probeServer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setLoadingMessage('Verifying Credentials...');

    // If server takes longer than 3.5s, update indicator to inform officer of cold start
    const msgTimer = setTimeout(() => {
      setLoadingMessage('Waking up server instance (cold start in progress)...');
    }, 3500);

    try {
      const response = await authService.login({ username, password });
      const { token, user, sessionEncryptionKey } = response.data || response;

      if (!token || !user) {
        throw new Error('Invalid authentication response from backend.');
      }

      login(token, user, sessionEncryptionKey);
    } catch (err: any) {
      if (err.response) {
        setError(err.response.data?.message || `Authentication failed: ${err.response.statusText}`);
      } else {
        setError(
          `Unable to connect to CopSight backend. Please ensure the server is online and accessible.`
        );
        setBackendStatus('warming_up');
      }
    } finally {
      clearTimeout(msgTimer);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 pt-12 relative overflow-y-auto transition-colors duration-300 titlebar-drag-region">
      
      {/* Main Authentication Card */}
      <div className="w-full max-w-md relative z-10 my-auto no-drag">
        <div className="glass-panel rounded-[2.5rem] p-7 sm:p-9 shadow-2xl border border-white/20">
          
          {/* Top Status Bar */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
              Stage 1: Authorization
            </span>

            <button
              type="button"
              onClick={() => probeServer(true)}
              title="Click to probe backend connectivity"
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-[11px] font-mono hover:bg-white/15 transition-all cursor-pointer"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : backendStatus === 'warming_up' || backendStatus === 'checking'
                    ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                    : 'bg-[#EF4444] dark:bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                }`}
              />
              <span className="text-white opacity-70">Server:</span>
              <span
                className={`font-bold ${
                  backendStatus === 'online'
                    ? 'text-emerald-400'
                    : backendStatus === 'warming_up'
                    ? 'text-amber-300'
                    : backendStatus === 'checking'
                    ? 'text-cyan-300'
                    : 'text-rose-300'
                }`}
              >
                {backendStatus === 'online'
                  ? 'ONLINE'
                  : backendStatus === 'warming_up'
                  ? 'WAKING UP...'
                  : backendStatus === 'checking'
                  ? 'CHECKING...'
                  : 'OFFLINE'}
              </span>
              {backendStatus === 'checking' && (
                <RefreshCw className="w-3 h-3 text-white/50 animate-spin" />
              )}
            </button>
          </div>

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-16 h-16 rounded-full bg-white p-1.5 flex items-center justify-center shadow-xl ring-4 ring-white/30 mb-3.5 overflow-hidden">
              <img src={logoImg} alt="ForensixD Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-wide uppercase">ForensixD</h1>
            <p className="text-xs font-mono text-[#FF7A59] dark:text-white/90 font-bold mt-0.5">by CopSight AI</p>
            <p className="text-[11px] font-mono text-white opacity-75 mt-1">Forensic Data Extraction Station</p>
          </div>

          {/* Server Cold-Start Notice */}
          {backendStatus === 'warming_up' && (
            <div className="mb-5 p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-[11px] font-mono flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>Server instance is spinning up (cold start). Awaiting acknowledgement...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl alert-danger flex items-start gap-2.5 text-xs font-mono shadow-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-300 dark:text-rose-400" />
              <span className="leading-relaxed font-semibold">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10.5px] font-mono uppercase tracking-wider text-white opacity-80 block mb-1.5 font-semibold">
                Officer Username / Badge ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/50 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. io_officer or badge_id"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 dark:bg-black/50 border border-white/20 text-xs font-mono text-white placeholder:text-white/40 focus:border-[#FF7A59] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-mono uppercase tracking-wider text-white opacity-80 block mb-1.5 font-semibold">
                Authorization Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 dark:bg-black/50 border border-white/20 text-xs font-mono text-white placeholder:text-white/40 focus:border-[#FF7A59] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black font-mono text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{loadingMessage}</span>
                </span>
              ) : (
                <>
                  <span>Authenticate & Open Station</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Law Enforcement Notice */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] font-mono text-white opacity-70 tracking-wide">
              RESTRICTED: AUTHORIZED LAW ENFORCEMENT PERSONNEL ONLY
            </p>
            <p className="text-[9px] font-mono text-white opacity-50 mt-0.5">
              Strict authentication against CopSight central database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
