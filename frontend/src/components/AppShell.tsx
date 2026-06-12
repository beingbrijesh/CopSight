import { useState } from 'react';
import {
  BookMarked,
  ChevronLeft,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Users,
  ArrowLeft,
  Fingerprint,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Navbar } from './Navbar';
import { ChangePasswordModal } from './ChangePasswordModal';

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
  disabled?: boolean;
};

const buildCaseRoute = (
  rolePrefix: string,
  caseId: string | undefined,
  suffix: 'query' | 'bookmarks' | 'report'
) => (caseId ? `${rolePrefix}/case/${caseId}/${suffix}` : undefined);

export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const caseMatch = location.pathname.match(/\/case\/([^/]+)/);
  const caseId = caseMatch ? caseMatch[1] : undefined;
  const hasCaseContext = Boolean(caseId);

  const adminItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/admin' },
    { label: 'Users', icon: Users, to: '/admin/users' },
    { label: 'Cases', icon: FolderOpen, to: '/admin/cases' },
  ];

  const rolePrefix = user?.role === 'supervisor' ? '/supervisor' : '/io';
  const dashboardPath = user?.role === 'supervisor' ? '/supervisor' : '/io';
  const casesPath = user?.role === 'supervisor' ? '/supervisor/cases' : '/io';

  const officerItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, to: dashboardPath },
    { label: 'Cases', icon: FolderOpen, to: casesPath },
    {
      label: 'Queries',
      icon: MessageSquareText,
      to: buildCaseRoute(rolePrefix, caseId, 'query'),
      disabled: !hasCaseContext,
    },
    {
      label: 'Bookmarks',
      icon: BookMarked,
      to: buildCaseRoute(rolePrefix, caseId, 'bookmarks'),
      disabled: !hasCaseContext,
    },
    {
      label: 'Reports',
      icon: FileText,
      to: buildCaseRoute(rolePrefix, caseId, 'report'),
      disabled: !hasCaseContext,
    },
  ];

  const navItems = user?.role === 'admin' ? adminItems : officerItems;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.to
      ? location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      : false;

    if (!item.to || item.disabled) {
      return (
        <div
          key={item.label}
          className={`flex items-center gap-3 rounded-xl py-2.5 text-sm text-gray-400 dark:text-slate-600 cursor-not-allowed ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
          title={!sidebarOpen ? `${item.label} (open a case first)` : undefined}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {sidebarOpen && <span>{item.label}</span>}
        </div>
      );
    }

    return (
      <NavLink
        key={item.label}
        to={item.to}
        onClick={() => {
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white'
        } ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
        title={!sidebarOpen ? item.label : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {sidebarOpen && <span>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-transparent">
      <ChangePasswordModal />
      <Navbar onMenuToggle={() => setSidebarOpen((open) => !open)} />

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-30 border-r border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl transition-all duration-300 ${
            sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar toggle header */}
            <div className={`flex items-center border-b border-gray-100 dark:border-white/10 py-3 ${sidebarOpen ? 'px-4 justify-between' : 'justify-center'}`}>
              {sidebarOpen && <span className="text-sm font-semibold text-gray-900 dark:text-white">Navigation</span>}
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden rounded-xl p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white lg:block"
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Back button — distinct from nav items */}
            <div className={`border-b border-gray-100 dark:border-white/10 py-2 ${sidebarOpen ? 'px-3' : 'px-2'}`}>
              <button
                onClick={() => navigate(-1)}
                className={`w-full flex items-center gap-3 rounded-xl py-2 text-sm transition-all duration-200 text-gray-500 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-300 ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="text-xs font-medium">Back</span>}
              </button>
            </div>

            {/* Nav items */}
            <nav className={`flex-1 space-y-1 py-4 ${sidebarOpen ? 'px-3' : 'px-2'}`}>
              {navItems.map(renderNavItem)}
            </nav>

            {/* Case context footer */}
            {user?.role !== 'admin' && (
              <div className={`border-t border-gray-100 dark:border-white/10 py-4 ${sidebarOpen ? 'px-4' : 'px-2 flex justify-center'}`}>
                {sidebarOpen ? (
                  <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/50 p-3">
                    {hasCaseContext ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">Active case</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Case #{caseId}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
                          Query, bookmark, and report links follow the open case context.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">No case open</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
                          Open a case from the list to unlock queries, bookmarks, and reports.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div 
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900/50"
                    title={hasCaseContext ? `Active Case #${caseId}` : 'No case selected'}
                  >
                    {hasCaseContext ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    ) : (
                      <Fingerprint className="h-4 w-4 text-gray-400 dark:text-slate-600" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 top-16 z-20 bg-gray-900/20 dark:bg-white/5 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'} lg:px-8`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
