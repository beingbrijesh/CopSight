import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Access Denied</h1>
        <p className="text-slate-600 font-medium mb-8">
          You do not have the required permissions to access this page. Please contact your administrator if you believe this is a mistake.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};
