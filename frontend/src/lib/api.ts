import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  logout: () => api.post('/auth/logout'),
  
  getCurrentUser: () => api.get('/auth/me'),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// User API
export const userAPI = {
  getUsers: (params?: any) => api.get('/users', { params }),
  
  createUser: (data: any) => api.post('/users', data),
  
  updateUser: (userId: number, data: any) => api.put(`/users/${userId}`, data),
  
  resetPassword: (userId: number, newPassword: string) =>
    api.post(`/users/${userId}/reset-password`, { newPassword }),
  
  getOfficers: () => api.get('/users/officers'),
  
  getSupervisors: () => api.get('/users/supervisors'),
};

// Case API
export const caseAPI = {
  getCases: (params?: any) => api.get('/cases', { params }),
  
  createCase: (data: any) => api.post('/cases', data),
  
  getCase: (caseId: number) => api.get(`/cases/${caseId}`),
  
  updateCase: (caseId: number, data: any) => api.put(`/cases/${caseId}`, data),
  
  getStatistics: () => api.get('/cases/statistics'),
};

// Upload API
export const uploadAPI = {
  uploadFile: (caseId: number, file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(`/cases/${caseId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  getJobStatus: (jobId: number) => api.get(`/jobs/${jobId}`),
  
  getProcessingSummary: (caseId: number) => api.get(`/cases/${caseId}/processing`),
};

// Query API
export const queryAPI = {
  createQuery: (caseId: number, data: any) =>
    api.post(`/cases/${caseId}/queries`, data),
  
  getQueryHistory: (caseId: number, params?: any) =>
    api.get(`/cases/${caseId}/queries`, { params }),
  
  getQuery: (queryId: number) => api.get(`/queries/${queryId}`),
};

// Bookmark API
export const bookmarkAPI = {
  createBookmark: (caseId: number, data: any) =>
    api.post(`/cases/${caseId}/bookmarks`, data),
  
  getBookmarks: (caseId: number, params?: any) =>
    api.get(`/cases/${caseId}/bookmarks`, { params }),
  
  updateBookmark: (bookmarkId: number, data: any) =>
    api.put(`/bookmarks/${bookmarkId}`, data),
  
  deleteBookmark: (bookmarkId: number) =>
    api.delete(`/bookmarks/${bookmarkId}`),
  
  reorderBookmarks: (caseId: number, bookmarkIds: number[]) =>
    api.post(`/cases/${caseId}/bookmarks/reorder`, { bookmarkIds }),
};
