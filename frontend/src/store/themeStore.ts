import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setDarkMode: (value: boolean) => void;
}

const getInitialTheme = (): boolean => {
  const stored = localStorage.getItem('copsight-theme');
  if (stored !== null) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: getInitialTheme(),

  toggleTheme: () =>
    set((state) => {
      const next = !state.isDarkMode;
      localStorage.setItem('copsight-theme', next ? 'dark' : 'light');
      return { isDarkMode: next };
    }),

  setDarkMode: (value: boolean) => {
    localStorage.setItem('copsight-theme', value ? 'dark' : 'light');
    set({ isDarkMode: value });
  },
}));
