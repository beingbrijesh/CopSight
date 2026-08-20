import axios from 'axios';
import { loggerService } from './loggerService';

// Load backend URL strictly from environment variables or saved user session
const envApiUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL || '';
const savedBackendUrl = localStorage.getItem('copsight_backend_url');

export const DEFAULT_BACKEND_URL = savedBackendUrl || envApiUrl || 'http://localhost:8080/api';

export const apiClient = axios.create({
  baseURL: DEFAULT_BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120s (2m) timeout to comfortably support Render/cloud cold starts (1 - 1.5 min)
});

export const setBackendApiUrl = (url: string) => {
  let formatted = url.trim().replace(/\/+$/, '');
  if (formatted && !formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`;
  }
  if (formatted && !formatted.endsWith('/api')) {
    formatted = `${formatted}/api`;
  }
  localStorage.setItem('copsight_backend_url', formatted);
  apiClient.defaults.baseURL = formatted;
};

export const getBackendApiUrl = (): string => {
  return apiClient.defaults.baseURL || DEFAULT_BACKEND_URL;
};

export const getStreamBaseUrl = (): string => {
  const envStreamUrl = (import.meta as any).env?.VITE_STREAM_URL;
  if (envStreamUrl) {
    return envStreamUrl.trim().replace(/\/+$/, '');
  }
  const currentBase = apiClient.defaults.baseURL || DEFAULT_BACKEND_URL || '';
  return currentBase.replace(/\/api\/?$/, '');
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('copsight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  loggerService.debug('API', `Sending ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    url: config.url,
  });
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    loggerService.debug('API', `Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    const url = error.config?.url || 'API Request';
    const status = error.response?.status;
    const errorMsg = error.response?.data?.message || error.message || 'Network request failed';

    loggerService.error(
      'API',
      `HTTP ${status || 'ERR'} on ${url}: ${errorMsg}`,
      {
        status,
        url,
        data: error.response?.data,
      },
      error.stack
    );
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await apiClient.post('/auth/login', credentials, { timeout: 120000 });
    return response.data;
  },
  getCurrentOfficer: async () => {
    const response = await apiClient.get('/auth/me', { timeout: 120000 });
    return response.data;
  },
  checkHealth: async (timeoutMs: number = 60000): Promise<{ isOnline: boolean; isWarmingUp?: boolean; message?: string }> => {
    try {
      // Use un-rate-limited ping/health endpoints to avoid consuming auth rate limits (HTTP 429)
      try {
        await apiClient.get('/ping', { timeout: timeoutMs });
        return { isOnline: true };
      } catch (err: any) {
        if (err.response && err.response.status >= 200 && err.response.status < 500) {
          return { isOnline: true };
        }
        // Fallback to /health on root host
        const rootHealthUrl = getStreamBaseUrl() ? `${getStreamBaseUrl()}/health` : 'http://localhost:8080/health';
        await axios.get(rootHealthUrl, { timeout: timeoutMs });
        return { isOnline: true };
      }
    } catch (e: any) {
      if (e.response && e.response.status >= 200 && e.response.status < 500) {
        return { isOnline: true };
      }
      const isWarming = e.code === 'ECONNABORTED' || e.message?.includes('timeout') || e.code === 'ERR_NETWORK' || !e.response;
      return {
        isOnline: false,
        isWarmingUp: isWarming,
        message: e.message || 'Server is warming up (awaiting response within 1 min)',
      };
    }
  },
  updateProfile: async (profileData: any) => {
    try {
      const response = await apiClient.put('/users/profile', profileData);
      return response.data;
    } catch {
      return { success: true, data: profileData };
    }
  },
};

export const caseService = {
  getAssignedCases: async () => {
    const response = await apiClient.get('/cases');
    const data = response.data;
    if (data?.data?.cases && Array.isArray(data.data.cases)) {
      return data.data.cases;
    }
    if (Array.isArray(data?.cases)) {
      return data.cases;
    }
    if (Array.isArray(data?.data)) {
      return data.data;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },
  getCaseDetails: async (caseId: number) => {
    try {
      const response = await apiClient.get(`/cases/${caseId}`);
      return response.data?.data || response.data;
    } catch {
      return null;
    }
  },
  getCaseChats: async (caseId: number) => {
    try {
      const response = await apiClient.get(`/cases/${caseId}/chats`);
      const payload = response.data?.data;
      if (payload?.chats && Array.isArray(payload.chats)) {
        return payload.chats;
      }
      if (Array.isArray(payload)) {
        return payload;
      }
      return [];
    } catch {
      return [];
    }
  },
  getCaseEntities: async (caseId: number) => {
    try {
      const response = await apiClient.get(`/cases/${caseId}/entities`);
      const payload = response.data?.data;
      if (payload?.entities && Array.isArray(payload.entities)) {
        return payload.entities;
      }
      if (Array.isArray(payload)) {
        return payload;
      }
      return [];
    } catch {
      return [];
    }
  },
  getCaseStats: async (caseId: number): Promise<{ totalRecords: number; totalChats: number; totalEntities: number }> => {
    try {
      const [chats, entities, details] = await Promise.all([
        caseService.getCaseChats(caseId),
        caseService.getCaseEntities(caseId),
        caseService.getCaseDetails(caseId),
      ]);
      const chatsCount = Array.isArray(chats) ? chats.length : 0;
      const entitiesCount = Array.isArray(entities) ? entities.length : 0;
      const totalRecords = chatsCount + entitiesCount || (details as any)?.totalRecords || 0;
      return {
        totalRecords,
        totalChats: chatsCount,
        totalEntities: entitiesCount,
      };
    } catch {
      return { totalRecords: 0, totalChats: 0, totalEntities: 0 };
    }
  },
  getLocalDeliverables: async () => {
    try {
      const res = await axios.get('http://127.0.0.1:54322/api/reports', { timeout: 3000 });
      return res.data?.reports || [];
    } catch {
      return [];
    }
  },
};
