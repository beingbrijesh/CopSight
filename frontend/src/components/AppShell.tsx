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
          className={`flex items-center gap-3 rounded-lg py-2 text-sm text-gray-400 ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
          title={!sidebarOpen ? item.label : undefined}
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
        className={`flex items-center gap-3 rounded-lg py-2 text-sm transition ${
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        } ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
        title={!sidebarOpen ? item.label : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {sidebarOpen && <span>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ChangePasswordModal />
      <Navbar onMenuToggle={() => setSidebarOpen((open) => !open)} />

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-30 border-r border-gray-200 bg-white transition-all duration-300 ${
            sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className={`flex items-center border-b border-gray-100 py-3 ${sidebarOpen ? 'px-4 justify-between' : 'justify-center'}`}>
              {sidebarOpen && <span className="text-sm font-medium text-gray-900">Navigation</span>}
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:block"
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <nav className={`flex-1 space-y-2 py-4 ${sidebarOpen ? 'px-3' : 'px-2'}`}>
              <button
                onClick={() => navigate(-1)}
                className={`w-full flex items-center gap-3 rounded-lg py-2 text-sm transition text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${sidebarOpen ? 'px-3' : 'justify-center px-0'}`}
                title="Go back"
              >
                <ArrowLeft className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>Back</span>}
              </button>
              {navItems.map(renderNavItem)}
            </nav>

            {user?.role !== 'admin' && (
              <div className={`border-t border-gray-100 py-4 ${sidebarOpen ? 'px-4' : 'px-2 flex justify-center'}`}>
                {sidebarOpen ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {hasCaseContext ? (
                      <>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Active case</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">Case #{caseId}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Query, bookmark, and report links follow the open case context.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Case context</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">Open a case first</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Queries, bookmarks, and reports unlock after you open a case from the cases list.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div 
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                    title={hasCaseContext ? `Active Case #${caseId}` : 'No case selected'}
                  >
                    <FolderOpen className="h-5 w-5" />
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
            className="fixed inset-0 top-16 z-20 bg-gray-900/20 lg:hidden"
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
