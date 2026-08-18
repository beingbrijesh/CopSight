import { useState, useEffect } from 'react';
import { LogOut, Sun, Moon, ShieldAlert, Shield, Crosshair, Eye } from 'lucide-react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { authAPI } from '../lib/api';
import { loggerService } from '../lib/loggerService';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  onOpenAdminAudit?: () => void;
}

const roleLabel: Record<string, string> = {
  admin: 'Administrator',
  investigating_officer: 'Investigating Officer',
  supervisor: 'Supervisor',
};

const roleIcon: Record<string, typeof Shield> = {
  admin: Shield,
  investigating_officer: Crosshair,
  supervisor: Eye,
};

export const Navbar = ({ onOpenAdminAudit }: NavbarProps) => {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const unsubscribe = loggerService.subscribeLogs((logs) => {
      setErrorCount(logs.filter((l) => l.level === 'ERROR').length);
    });
    return unsubscribe;
  }, []);

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

  const caseMatch = location.pathname.match(/\/case\/([^/]+)/);
  const caseId = caseMatch ? caseMatch[1] : undefined;

  const rolePrefix = user?.role === 'supervisor' ? '/supervisor' : user?.role === 'admin' ? '/admin' : '/io';

  // Define tabs per role
  const getNavTabs = (): { label: string; to: string; disabled?: boolean; end?: boolean }[] => {
    if (user?.role === 'admin') {
      return [
        { label: 'Dashboard', to: '/admin', end: true },
        { label: 'Users', to: '/admin/users' },
        { label: 'Cases', to: '/admin/cases' },
      ];
    }

    const isSup = user?.role === 'supervisor';
    const dashTo = isSup ? '/supervisor' : '/io';
    const casesTo = isSup ? '/supervisor/cases' : '/io';
    const prefix = isSup ? '/supervisor' : '/io';
    const ctxId = caseId || 'none';
    const noCtx = !caseId;

    return [
      { label: 'Dashboard', to: dashTo, end: true },
      { label: 'Cases', to: casesTo, end: isSup ? false : true },
      { label: caseId ? `Case #${caseId}` : 'Active Case', to: `${prefix}/case/${ctxId}`, disabled: noCtx, end: true },
      { label: 'Queries', to: `${prefix}/case/${ctxId}/query`, disabled: noCtx },
      { label: 'Bookmarks', to: `${prefix}/case/${ctxId}/bookmarks`, disabled: noCtx },
      { label: 'Reports', to: `${prefix}/case/${ctxId}/report`, disabled: noCtx },
      { label: 'Entities', to: `${prefix}/case/${ctxId}/entities`, disabled: noCtx },
      { label: 'Network', to: `${prefix}/case/${ctxId}/network`, disabled: noCtx }
    ];
  };

  const navTabs = getNavTabs();
  const RoleIcon = roleIcon[user?.role || ''] || Shield;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-4 sm:pt-6 pb-2 px-4 sm:px-8 md:px-[2cm] mx-auto w-full pointer-events-none">
      <div className="pointer-events-auto min-h-16 py-2.5 px-4 sm:px-6 glass-panel rounded-[2.5rem] flex flex-wrap items-center justify-between gap-3 sm:gap-4 select-none shadow-2xl backdrop-blur-2xl">
        
        {/* Left: Brand with Official Frontend Logo */}
        <div 
          onClick={() => navigate(rolePrefix)} 
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/40 overflow-hidden group-hover:scale-105 transition-transform">
            <img
              src="/logo.jpeg"
              alt="CopSight Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-extrabold tracking-tight uppercase text-white block leading-tight group-hover:text-[#FF7A59] transition-colors">
              CopSight AI
            </span>
            <p className="text-[10px] uppercase tracking-widest opacity-80 text-white leading-tight">
              Unified Forensic Data
            </p>
          </div>
        </div>

        {/* Center: Navigation Menu Bar with Balanced Spacing & Active Highlights */}
        <nav className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 shadow-inner overflow-x-auto custom-scrollbar max-w-full">
          {navTabs.map((tab, idx) => {
            if (tab.disabled) {
              return (
                <div
                  key={idx}
                  title="Open a case to unlock this tab"
                  className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs font-semibold tracking-wide text-white/30 cursor-not-allowed whitespace-nowrap"
                >
                  {tab.label}
                </div>
              );
            }

            const isActive = tab.end 
              ? location.pathname === tab.to 
              : location.pathname.startsWith(tab.to);

            return (
              <NavLink
                key={idx}
                to={tab.to}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#FF7A59] text-white shadow-md font-bold scale-[1.02] dark:bg-white dark:text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10 dark:text-white/70 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Actions, Theme Toggle, Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Admin Diagnostics Button */}
          {user?.role === 'admin' && onOpenAdminAudit && (
            <button
              type="button"
              onClick={onOpenAdminAudit}
              className="px-3 sm:px-3.5 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-100 dark:text-red-300 border border-red-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              title="Open Administrator Diagnostics & System Error Logs"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-300 dark:text-red-400" />
              <span className="hidden md:inline">Admin Diagnostics</span>
              {errorCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {errorCount}
                </span>
              )}
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 text-white border border-white/15 transition-all shadow-sm cursor-pointer"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 text-amber-300" />
            ) : (
              <Moon className="h-4 w-4 text-white" />
            )}
          </button>

          {/* Notifications */}
          <div className="text-white">
            <NotificationBell />
          </div>

          {/* User Profile Badge */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="text-right hidden xl:block">
              <div className="text-xs font-bold text-white leading-tight">
                {user?.fullName || user?.username || 'Officer'}
              </div>
              <div className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">
                {user?.badgeNumber || roleLabel[user?.role || ''] || user?.role}
              </div>
            </div>

            <div 
              className="w-9 h-9 rounded-full bg-white/20 dark:bg-white/10 border border-white/30 flex items-center justify-center text-white overflow-hidden shadow-md"
              title={`${user?.fullName} (${user?.role})`}
            >
              <RoleIcon className="w-4 h-4" />
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-black/20 dark:bg-white/10 hover:bg-red-500/30 text-white border border-white/15 transition-all shadow-sm cursor-pointer ml-1"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
