import { LogOut, Menu, User, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../lib/api';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  onMenuToggle?: () => void;
}

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  investigating_officer: 'Investigating Officer',
  supervisor: 'Supervisor',
};

export const Navbar = ({ onMenuToggle }: NavbarProps) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/io' || path === '/supervisor') return 'Dashboard';
    if (path.includes('/users')) return 'User Management';
    if (path.includes('/cases')) return 'Case Management';
    if (path.includes('/query')) return 'Query Interface';
    if (path.includes('/bookmarks')) return 'Bookmarks';
    if (path.includes('/report')) return 'Report Generator';
    if (path.includes('/entities')) return 'Entities View';
    if (path.includes('/network')) return 'Network Graph';
    if (path.includes('/case/')) return 'Case Detail';
    return 'CopSight AI';
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left section */}
        <div className="flex items-center gap-3 lg:w-1/3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2 h-10 w-10 justify-center rounded-lg bg-gray-900 ml-2 overflow-hidden">
            <img src="/logo.jpeg" alt="CopSight Logo" className="h-full w-full object-cover" />
          </div>
          <div className="hidden lg:block">
            <p className="text-base font-semibold text-gray-900">CopSight</p>
            <p className="text-xs text-gray-500">Unified Forensic Data</p>
          </div>
        </div>

        {/* Center section */}
        <div className="hidden lg:flex lg:w-1/3 items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-gray-50 px-5 py-2 border border-gray-200 shadow-sm">
            <Sparkles className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">{getPageTitle()}</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center justify-end gap-4 lg:w-1/3">
          <NotificationBell />
          
          <div className="hidden items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:flex">
            <User className="h-4 w-4 text-gray-500" />
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user?.fullName}</div>
              <div className="text-xs text-gray-500">
                {user?.badgeNumber || roleLabel[user?.role || ''] || user?.role}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
