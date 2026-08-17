import React, { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useCaseStore } from './store/caseStore';
import { AuthGate } from './pages/AuthGate';
import { CaseGate } from './pages/CaseGate';
import { Workspace } from './pages/Workspace';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { selectedCase } = useCaseStore();

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

  // Stage 1: Mandatory Officer Authentication Gate (No theme switch option)
  if (!isAuthenticated) {
    return <AuthGate />;
  }

  // Stage 2: Assigned Case Selection Gate (No theme switch option)
  if (!selectedCase) {
    return <CaseGate />;
  }

  // Stage 3: Real Forensic Investigation Workspace
  return <Workspace />;
};

export default App;
