import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl dark:shadow-2xl border border-red-100 dark:border-red-500/20 max-w-md w-full">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Access Denied</h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium mb-8">
          You do not have the required permissions to access this page. Please contact your administrator if you believe this is a mistake.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3 px-4 rounded-xl transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};
