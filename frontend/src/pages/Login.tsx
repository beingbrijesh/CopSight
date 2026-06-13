import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Sun, Moon } from 'lucide-react';
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

  // Removed the "Authenticating CLI..." overlay because the user must log in again to generate a new sessionEncryptionKey

  if (cliSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-1 rounded-full mb-6 overflow-hidden h-20 w-20 shadow-lg border border-gray-100 dark:border-white/10 flex items-center justify-center">
          <div className="h-full w-full bg-green-500 flex items-center justify-center rounded-full">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Authentication Successful!</h2>
        <p className="text-gray-600 dark:text-slate-400 text-center max-w-md">Your secure CLI session is now connected with End-to-End Encryption. You may close this browser window and return to your terminal.</p>
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
      const urlParams = new URLSearchParams(window.location.search);
      const cliCallback = urlParams.get('cli_callback');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4 relative">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-300/20 dark:bg-blue-500/5 blur-[120px]"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-300/20 dark:bg-indigo-500/5 blur-[120px]"></div>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 flex items-center justify-center h-10 w-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all shadow-sm"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
      </button>

      <div className="max-w-md w-full relative z-10">
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl/80 backdrop-blur-xl rounded-3xl shadow-xl dark:shadow-2xl dark:shadow-blue-500/5 p-8 border border-white/50 dark:border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-white dark:bg-slate-800 p-1 rounded-full mb-4 overflow-hidden h-24 w-24 shadow-lg border border-gray-100 dark:border-white/10 flex items-center justify-center">
              <img src="/logo.jpeg" alt="CopSight Logo" className="h-full w-full object-cover rounded-full" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">CopSight AI</h1>
            <p className="text-gray-600 dark:text-slate-400 mt-2 font-medium">Unified Forensic Data Repository</p>
          </div>

          {cliCallback && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Please {isAuthenticated ? "re-enter your credentials" : "sign in"} to securely connect your CLI session.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-slate-500">
            <p>Authorized Personnel Only</p>
          </div>
        </div>
      </div>
    </div>
  );
};
