import { useState, useEffect } from 'react';
import { LogOut, Sun, Moon, ShieldAlert, Shield, Crosshair, Eye, FolderSearch, Search, X, ChevronRight, FolderOpen } from 'lucide-react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { authAPI, caseAPI } from '../lib/api';
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

  // Case Selection Modal State
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [targetTabPath, setTargetTabPath] = useState<string>('query');
  const [targetTabLabel, setTargetTabLabel] = useState<string>('Queries');
  const [casesList, setCasesList] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [caseSearchTerm, setCaseSearchTerm] = useState('');

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

  // Load cases when opening selection modal
  const openCaseSelector = async (tabPath: string, tabLabel: string) => {
    setTargetTabPath(tabPath);
    setTargetTabLabel(tabLabel);
    setIsCaseModalOpen(true);
    setCaseSearchTerm('');

    try {
      setLoadingCases(true);
      const res = await caseAPI.getCases();
      setCasesList(res.data.data.cases || []);
    } catch (err) {
      console.error('Failed to load cases for selector modal:', err);
      setCasesList([]);
    } finally {
      setLoadingCases(false);
    }
  };

  const handleSelectCaseForTab = (selectedId: number | string) => {
    setIsCaseModalOpen(false);
    navigate(`${rolePrefix}/case/${selectedId}/${targetTabPath}`);
  };

  // Define tabs per role
  const getNavTabs = () => {
    if (user?.role === 'admin') {
      return [
        { label: 'Dashboard', to: '/admin', end: true },
        { label: 'Users', to: '/admin/users' },
        { label: 'Cases', to: '/admin/cases' },
      ];
    }

    const isSup = user?.role === 'supervisor';
    const dashTo = isSup ? '/supervisor' : '/io';
    const casesTo = isSup ? '/supervisor/cases' : '/io/cases';
    const prefix = isSup ? '/supervisor' : '/io';
    const ctxId = caseId || 'none';

    return [
      { label: 'Dashboard', to: dashTo, end: true },
      { label: 'Cases', to: casesTo, end: true },
      ...(caseId ? [{ label: `Case #${caseId}`, to: `${prefix}/case/${ctxId}`, end: true }] : []),
      { label: 'Queries', to: `${prefix}/case/${ctxId}/query`, tabKey: 'query', requiresCase: !caseId },
      { label: 'Bookmarks', to: `${prefix}/case/${ctxId}/bookmarks`, tabKey: 'bookmarks', requiresCase: !caseId },
      { label: 'Reports', to: `${prefix}/case/${ctxId}/report`, tabKey: 'report', requiresCase: !caseId },
      { label: 'Entities', to: `${prefix}/case/${ctxId}/entities`, tabKey: 'entities', requiresCase: !caseId },
      { label: 'Network', to: `${prefix}/case/${ctxId}/network`, tabKey: 'network', requiresCase: !caseId }
    ];
  };

  const navTabs = getNavTabs();
  const RoleIcon = roleIcon[user?.role || ''] || Shield;

  const filteredModalCases = casesList.filter((c) =>
    (c.title || '').toLowerCase().includes(caseSearchTerm.toLowerCase()) ||
    (c.caseNumber || '').toLowerCase().includes(caseSearchTerm.toLowerCase())
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-5 pb-2 px-4 sm:px-8 md:px-[2cm] mx-auto w-full pointer-events-none">
        <div className="pointer-events-auto min-h-16 py-2 px-4 sm:px-6 glass-panel rounded-[2.5rem] flex items-center justify-between gap-3 sm:gap-4 select-none shadow-2xl backdrop-blur-2xl flex-nowrap overflow-hidden">
          
          {/* Left: Brand Identity */}
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
            <div className="hidden md:block">
              <span className="text-sm sm:text-base font-extrabold tracking-tight uppercase text-white block leading-tight group-hover:text-[#FF7A59] transition-colors">
                CopSight AI
              </span>
              <p className="text-[9.5px] uppercase tracking-widest opacity-80 text-white leading-tight">
                Unified Forensic Data
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu Tabs (Cleanly Centered & Scrollable) */}
          <nav className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 shadow-inner overflow-x-auto custom-scrollbar max-w-full">
            {navTabs.map((tab: any, idx: number) => {
              // If tab requires a case and none is active, clicking prompts the modal
              if (tab.requiresCase) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => openCaseSelector(tab.tabKey, tab.label)}
                    className="px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                    title={`Select a case to open ${tab.label}`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              }

              const isActive = tab.end 
                ? location.pathname === tab.to 
                : location.pathname.startsWith(tab.to);

              return (
                <NavLink
                  key={idx}
                  to={tab.to}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
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

          {/* Right: Diagnostics, Theme, Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Admin Diagnostics Button */}
            {user?.role === 'admin' && onOpenAdminAudit && (
              <button
                type="button"
                onClick={onOpenAdminAudit}
                className="px-3 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-100 dark:text-red-300 border border-red-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                title="Open Administrator Diagnostics & System Error Logs"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-300 dark:text-red-400" />
                <span className="hidden xl:inline">Admin Diagnostics</span>
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
              className="flex items-center justify-center h-9 w-9 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 text-white border border-white/15 transition-all shadow-sm cursor-pointer shrink-0"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 text-amber-300" />
              ) : (
                <Moon className="h-4 w-4 text-white" />
              )}
            </button>

            {/* Notifications */}
            <div className="text-white shrink-0">
              <NotificationBell />
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-1 shrink-0">
              <div className="text-right hidden 2xl:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {user?.fullName || user?.username || 'Officer'}
                </div>
                <div className="text-[9px] uppercase tracking-wider opacity-75 text-white">
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
              className="flex items-center justify-center h-9 w-9 rounded-full bg-black/20 dark:bg-white/10 hover:bg-red-500/30 text-white border border-white/15 transition-all shadow-sm cursor-pointer shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* ─── Case Selector Modal (When Clicking Queries/Bookmarks/Reports without Active Case) ── */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-[2rem] p-6 sm:p-7 shadow-2xl border border-white/20 relative bg-slate-900/90 dark:bg-black/90 text-white">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF7A59]/20 dark:bg-white/10 border border-[#FF7A59]/30 flex items-center justify-center text-[#FF7A59] dark:text-white">
                  <FolderSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Select Case for {targetTabLabel}</h3>
                  <p className="text-xs text-white/70 font-mono">Choose an active case to open its {targetTabLabel} workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCaseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search case name, FIR number..."
                value={caseSearchTerm}
                onChange={(e) => setCaseSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A59]"
                autoFocus
              />
            </div>

            {/* Case List */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {loadingCases ? (
                <div className="py-12 text-center text-xs font-mono text-white/70">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF7A59] mx-auto mb-2" />
                  <span>Loading assigned cases...</span>
                </div>
              ) : filteredModalCases.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-white/60">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No matching forensic cases found.</p>
                </div>
              ) : (
                filteredModalCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCaseForTab(c.id)}
                    className="p-3.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white truncate">{c.title}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          c.priority === 'critical' || c.priority === 'high' ? 'bg-red-500/30 text-red-200 border border-red-500/30' : 'bg-blue-500/20 text-blue-200'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/60 font-mono">
                        <span>#{c.caseNumber}</span>
                        <span>•</span>
                        <span className="capitalize">{c.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-[#FF7A59] dark:text-white opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition shrink-0">
                      <span>Open</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCaseModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
