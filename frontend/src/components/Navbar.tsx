import { LogOut, Menu, Sun, Moon, Shield, Eye, Crosshair } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
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

const roleIcon: Record<string, typeof Shield> = {
  admin: Shield,
  investigating_officer: Crosshair,
  supervisor: Eye,
};

export const Navbar = ({ onMenuToggle }: NavbarProps) => {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
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

  // Build breadcrumb segments from current path
  const buildBreadcrumbs = (): { label: string; to?: string }[] => {
    const path = location.pathname;
    const crumbs: { label: string; to?: string }[] = [];

    const rolePrefix = user?.role === 'admin' ? '/admin' : user?.role === 'supervisor' ? '/supervisor' : '/io';
    const dashLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'supervisor' ? 'Supervisor' : 'Dashboard';

    if (path === rolePrefix) {
      crumbs.push({ label: dashLabel });
      return crumbs;
    }

    crumbs.push({ label: dashLabel, to: rolePrefix });

    if (path.includes('/users')) {
      crumbs.push({ label: 'Users' });
    } else if (path.includes('/cases') && !path.includes('/case/')) {
      crumbs.push({ label: 'Cases' });
    } else if (path.includes('/case/')) {
      const caseMatch = path.match(/\/case\/([^/]+)/);
      const caseId = caseMatch?.[1];
      if (caseId) {
        crumbs.push({ label: `Case #${caseId}`, to: `${rolePrefix}/case/${caseId}` });

        if (path.includes('/query')) crumbs.push({ label: 'Query' });
        else if (path.includes('/bookmarks')) crumbs.push({ label: 'Bookmarks' });
        else if (path.includes('/report')) crumbs.push({ label: 'Report' });
        else if (path.includes('/entities')) crumbs.push({ label: 'Entities' });
        else if (path.includes('/network')) crumbs.push({ label: 'Network' });
      }
    }

    return crumbs;
  };

  const breadcrumbs = buildBreadcrumbs();
  const RoleIcon = roleIcon[user?.role || ''] || Shield;

  return (
    <nav className="glass-panel sticky top-0 z-40 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left section — Logo + Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2 h-10 w-10 justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 ml-2 overflow-hidden shadow-lg shadow-blue-500/20">
            <img src="/logo.jpeg" alt="CopSight Logo" className="h-full w-full object-cover" />
          </div>
          <div className="hidden lg:block">
            <p className="text-base font-bold text-gray-900 dark:text-white">CopSight</p>
            <p className="text-xs text-gray-500 dark:text-slate-500">Unified Forensic Data</p>
          </div>
        </div>

        {/* Center section — Contextual breadcrumb */}
        <div className="hidden lg:flex flex-1 items-center justify-center min-w-0 px-6">
          <div className="flex items-center gap-1 text-sm max-w-lg truncate">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex items-center">
                  {i > 0 && <span className="breadcrumb-sep" />}
                  {isLast ? (
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to!} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition truncate">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-all duration-200 shadow-sm"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600" />
            )}
          </button>

          <NotificationBell />
          
          <div className="hidden items-center gap-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800/60 px-3 py-2 sm:flex">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <RoleIcon className="h-3.5 w-3.5" />
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{user?.fullName}</div>
              <div className="text-xs text-gray-500 dark:text-slate-500">
                {user?.badgeNumber || roleLabel[user?.role || ''] || user?.role}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 transition hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
