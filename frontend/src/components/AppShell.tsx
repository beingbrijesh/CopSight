import { useState } from 'react';
import {
  BookMarked,
  ChevronLeft,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Navbar } from './Navbar';

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

  // useParams doesn't always work in layout routes, so we parse it from the URL
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
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400"
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </div>
      );
    }

    return (
      <NavLink
        key={item.label}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onMenuToggle={() => setSidebarOpen((open) => !open)} />

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-30 w-64 border-r border-gray-200 bg-white transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 lg:hidden">
              <span className="text-sm font-medium text-gray-900">Navigation</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">{navItems.map(renderNavItem)}</nav>

            {user?.role !== 'admin' && (
              <div className="border-t border-gray-100 px-4 py-4">
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

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:ml-64 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
