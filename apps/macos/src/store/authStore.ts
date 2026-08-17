import { create } from 'zustand';

export interface Officer {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'investigating_officer' | 'supervisor';
  badgeNumber?: string;
  rank?: string;
  unit?: string;
  avatarUrl?: string;
}

interface AuthState {
  officer: Officer | null;
  token: string | null;
  sessionEncryptionKey: string | null;
  isAuthenticated: boolean;
  login: (token: string, officer: Officer, sessionEncryptionKey?: string) => void;
  logout: () => void;
  updateOfficer: (updated: Partial<Officer>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  officer: JSON.parse(localStorage.getItem('copsight_officer') || 'null'),
  token: localStorage.getItem('copsight_token'),
  sessionEncryptionKey: localStorage.getItem('copsight_e2e_key'),
  isAuthenticated: Boolean(localStorage.getItem('copsight_token')),

  login: (token, officer, sessionEncryptionKey) => {
    localStorage.setItem('copsight_token', token);
    localStorage.setItem('copsight_officer', JSON.stringify(officer));
    if (sessionEncryptionKey) {
      localStorage.setItem('copsight_e2e_key', sessionEncryptionKey);
    }
    set({
      token,
      officer,
      sessionEncryptionKey: sessionEncryptionKey || null,
      isAuthenticated: true,
    });
  },

  updateOfficer: (updated) => {
    const current = get().officer;
    if (!current) return;
    const newOfficer = { ...current, ...updated };
    localStorage.setItem('copsight_officer', JSON.stringify(newOfficer));
    set({ officer: newOfficer });
  },

  logout: () => {
    localStorage.removeItem('copsight_token');
    localStorage.removeItem('copsight_officer');
    localStorage.removeItem('copsight_e2e_key');
    localStorage.removeItem('copsight_selected_case');
    set({
      token: null,
      officer: null,
      sessionEncryptionKey: null,
      isAuthenticated: false,
    });
  },
}));
