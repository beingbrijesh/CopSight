import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Sun, Moon, Lock, User as UserIcon } from 'lucide-react';
import { authAPI } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cliSuccess, setCliSuccess] = useState(false);
  
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isDarkMode, toggleTheme } = useThemeStore();
  
  const urlParams = new URLSearchParams(window.location.search);
  let cliCallback = urlParams.get('cli_callback');
  if (cliCallback && !cliCallback.startsWith('http')) {
    try {
      cliCallback = atob(cliCallback);
    } catch (e) {
      console.warn('Failed to decode cli_callback', e);
    }
  }

  if (cliSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
        <div className="glass-panel p-8 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500 flex items-center justify-center rounded-full mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Successful!</h2>
          <p className="text-white/80 text-sm max-w-md">Your secure CLI session is now connected with End-to-End Encryption. You may close this browser window and return to your terminal.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ username, password });
      const { token, user, sessionEncryptionKey } = response.data.data;
      
      login(token, user);
      
      // Check for CLI callback
      if (cliCallback) {
        try {
          await fetch(cliCallback, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, sessionEncryptionKey })
          });
          setCliSuccess(true);
        } catch (err) {
          setError('Failed to connect to local CLI server. Please ensure the CLI tool is running.');
        }
        return;
      }
      
      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'investigating_officer') {
        navigate('/io');
      } else if (user.role === 'supervisor') {
        navigate('/supervisor');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative text-white">
      {/* Theme Toggle Button at top right */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 flex items-center justify-center h-10 w-10 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 text-white border border-white/20 transition-all shadow-md cursor-pointer"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-white" />}
      </button>

      <div className="max-w-md w-full relative z-10">
        <div className="glass-panel rounded-[2.5rem] shadow-2xl p-8 sm:p-10 border border-white/20 backdrop-blur-2xl">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-white p-1.5 flex items-center justify-center mb-4 shadow-xl ring-4 ring-white/30 overflow-hidden">
              <img src="/logo.jpeg" alt="CopSight Logo" className="h-full w-full object-cover rounded-full" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">CopSight AI</h1>
            <p className="text-white/80 mt-1 text-xs uppercase tracking-widest font-mono">Unified Forensic Repository</p>
          </div>

          {cliCallback && (
            <div className="mb-6 p-3.5 bg-blue-500/20 border border-blue-400/30 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-100">
                Please {isAuthenticated ? "re-enter your credentials" : "sign in"} to securely connect your CLI session.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 bg-red-500/20 border border-red-400/30 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-100">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-mono uppercase tracking-wider text-white/80 mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 pl-11 rounded-2xl bg-black/25 dark:bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A59] dark:focus:ring-white transition text-sm font-mono"
                  placeholder="Officer / Admin username"
                  required
                />
                <UserIcon className="w-4 h-4 text-white/50 absolute left-4 top-3.5" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-11 rounded-2xl bg-black/25 dark:bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A59] dark:focus:ring-white transition text-sm font-mono"
                  placeholder="••••••••••••"
                  required
                />
                <Lock className="w-4 h-4 text-white/50 absolute left-4 top-3.5" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono tracking-wide"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-[11px] text-white/60 font-mono">
            <p>Authorized Law Enforcement Personnel Only</p>
          </div>
        </div>
      </div>
    </div>
  );
};
