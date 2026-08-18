import React, { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useCaseStore } from './store/caseStore';
import { AuthGate } from './pages/AuthGate';
import { CaseGate } from './pages/CaseGate';
import { Workspace } from './pages/Workspace';
import { ToastContainer } from './components/ToastContainer';
import { loggerService } from './lib/loggerService';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { selectedCase } = useCaseStore();

  useEffect(() => {
    loggerService.initGlobalListeners();
  }, []);

  // Initialize and synchronize theme with macOS System theme by default
  useEffect(() => {
    const savedTheme = localStorage.getItem('copsight_theme');

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (savedTheme === 'dark') {
      applyTheme(true);
    } else if (savedTheme === 'light') {
      applyTheme(false);
    } else {
      // By default: sync with macOS system appearance
      const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemDark);
    }

    const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const currentSaved = localStorage.getItem('copsight_theme');
      if (!currentSaved || currentSaved === 'system') {
        applyTheme(e.matches);
      }
    };

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, []);

  return (
    <>
      {/* Global Toast System */}
      <ToastContainer />

      {/* Stage 1: Mandatory Officer Authentication Gate */}
      {!isAuthenticated ? (
        <AuthGate />
      ) : !selectedCase ? (
        /* Stage 2: Assigned Case Selection Gate */
        <CaseGate />
      ) : (
        /* Stage 3: Real Forensic Investigation Workspace */
        <Workspace />
      )}
    </>
  );
};

export default App;
