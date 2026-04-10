import { create } from 'zustand';
import { notificationAPI } from '../lib/api';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  created_at: string;
  sender?: {
    id: number;
    fullName: string;
    role: string;
  };
  case?: {
    id: number;
    caseNumber: string;
    title: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchNotifications: async () => {
    try {
      set({ loading: true, error: null });
      const response = await notificationAPI.getNotifications({ limit: 50 });
      const { notifications, unreadCount } = response.data.data;
      
      set({ 
        notifications, 
        unreadCount,
        loading: false 
      });
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      set({ 
        error: error.message || 'Failed to fetch notifications',
        loading: false 
      });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await notificationAPI.markAsRead(id);
      
      // Optimiztic update
      set((state) => ({
        notifications: state.notifications.map((n) => 
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error(`Failed to mark notification ${id} as read:`, error);
      // Re-fetch to sync state if failed
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationAPI.markAllAsRead();
      
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  startPolling: (intervalMs = 30000) => {
    if (pollingInterval) return;
    
    // Initial fetch
    get().fetchNotifications();
    
    // Setup polling
    pollingInterval = setInterval(() => {
      get().fetchNotifications();
    }, intervalMs);
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
}));
