import React, { useEffect, useState } from 'react';
import { User, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../lib/api';

export const AuthGate: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const { login } = useAuthStore();

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    setBackendStatus('checking');
    const res = await authService.checkHealth();
    if (res.isOnline) {
      setBackendStatus('online');
    } else {
      setBackendStatus('offline');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

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
        setBackendStatus('offline');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 relative select-none overflow-y-auto transition-colors duration-300">
      
      {/* Main Authentication Card */}
      <div className="w-full max-w-md relative z-10 my-auto">
        <div className="glass-panel rounded-[2.5rem] p-7 sm:p-9 shadow-2xl border border-white/20">
          
          {/* Top Status Bar */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
              Stage 1: Authorization
            </span>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-[11px] font-mono">
              <div
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : backendStatus === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-[#EF4444] dark:bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                }`}
              />
              <span className="text-white opacity-70">Server:</span>
              <span
                className={`font-bold ${
                  backendStatus === 'online'
                    ? 'text-emerald-400'
                    : backendStatus === 'checking'
                    ? 'text-amber-300'
                    : 'text-white'
                }`}
              >
                {backendStatus === 'online' ? 'ONLINE' : backendStatus === 'checking' ? 'CHECKING...' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-16 h-16 rounded-full bg-white p-1.5 flex items-center justify-center shadow-xl ring-4 ring-white/30 mb-3.5 overflow-hidden">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-wide uppercase">CopSight AI</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                macOS
              </span>
            </div>
            <p className="text-xs font-mono text-white opacity-75 mt-1">Digital Forensic Acquisition Station</p>
          </div>

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
                  placeholder="e.g. admin or officer_username"
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
                <span>Verifying Credentials...</span>
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
