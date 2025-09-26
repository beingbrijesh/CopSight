import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
  
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Parser API
export const parserAPI = {
  uploadFile: async (file: File, caseId?: string, deviceId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (caseId) formData.append('case_id', caseId);
    if (deviceId) formData.append('device_id', deviceId);
    
    const response = await api.post('/api/parser/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  getJobStatus: async (jobId: string) => {
    const response = await api.get(`/api/parser/jobs/${jobId}`);
    return response.data;
  },
  
  listJobs: async () => {
    const response = await api.get('/api/parser/jobs');
    return response.data;
  },
};

// Search API
export const searchAPI = {
  search: async (query: string, filters?: any, topK?: number) => {
    const response = await api.post('/api/search/search', {
      query,
      filters,
      top_k: topK || 10,
      include_context: true,
    });
    return response.data;
  },
  
  intelligentSearch: async (query: string, filters?: any, topK?: number) => {
    const response = await api.post('/api/search/search', {
      query,
      filters,
      top_k: topK || 10,
      include_context: true,
    });
    return response.data;
  },
  
  searchMessages: async (params: {
    query: string;
    size?: number;
    from?: number;
    app_name?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await api.get('/api/search/messages', { params });
    return response.data;
  },
  
  searchCalls: async (params: {
    phone_number?: string;
    call_type?: string;
    date_from?: string;
    date_to?: string;
    size?: number;
    from?: number;
  }) => {
    const response = await api.get('/api/search/calls', { params });
    return response.data;
  },
  
  searchContacts: async (query: string, size?: number, from?: number) => {
    const response = await api.get('/api/search/contacts', {
      params: { query, size, from },
    });
    return response.data;
  },
};

// Graph API
export const graphAPI = {
  getNetwork: async (nodeId: string, depth?: number, limit?: number) => {
    const response = await api.get(`/api/graph/network/${nodeId}`, {
      params: { depth, limit },
    });
    return response.data;
  },
  
  findPath: async (startNode: string, endNode: string, maxDepth?: number) => {
    const response = await api.get(`/api/graph/path/${startNode}/${endNode}`, {
      params: { max_depth: maxDepth },
    });
    return response.data;
  },
  
  detectCommunities: async (algorithm?: string, minSize?: number) => {
    const response = await api.get('/api/graph/communities', {
      params: { algorithm, min_size: minSize },
    });
    return response.data;
  },
  
  getCentrality: async (nodeId: string) => {
    const response = await api.get(`/api/graph/centrality/${nodeId}`);
    return response.data;
  },
  
  getTimeline: async (nodeId: string, days?: number) => {
    const response = await api.get(`/api/graph/timeline/${nodeId}`, {
      params: { days },
    });
    return response.data;
  },
  
  getFrequentContacts: async (nodeId: string, limit?: number) => {
    const response = await api.get(`/api/graph/frequent_contacts/${nodeId}`, {
      params: { limit },
    });
    return response.data;
  },
  
  detectSuspiciousPatterns: async () => {
    const response = await api.get('/api/graph/suspicious_patterns');
    return response.data;
  },
  
  getStats: async () => {
    const response = await api.get('/api/graph/stats');
    return response.data;
  },
};

export default api;
