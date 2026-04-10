import { LogOut, Menu, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">CopSight</p>
            <p className="text-xs text-gray-500">Unified Forensic Data Repository</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
