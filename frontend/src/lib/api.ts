import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for retries that doesn't have the retry interceptor
const retryApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and rate limiting
const addAuthInterceptor = (instance: any) => {
  instance.interceptors.request.use(
    async (config: any) => {
      // Apply rate limiting
      await rateLimitApiCall(() => Promise.resolve());

      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );
};

addAuthInterceptor(api);
addAuthInterceptor(retryApi);

// Client-side rate limiting to prevent overwhelming the backend
let lastApiCallTime = 0;
const MIN_API_CALL_INTERVAL = 100; // Minimum 100ms between API calls

const rateLimitApiCall = async (originalRequest: any) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;

  if (timeSinceLastCall < MIN_API_CALL_INTERVAL) {
    const delay = MIN_API_CALL_INTERVAL - timeSinceLastCall;
    await sleep(delay);
  }

  lastApiCallTime = Date.now();
  return originalRequest();
};

// Utility function for exponential backoff retry
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryRequest = async (fn: () => Promise<any>, maxRetries = 1, baseDelay = 5000): Promise<any> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on 4xx client errors (except 429), auth errors, or if it's the last attempt
      if (
        (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) ||
        error.response?.status === 401 ||
        attempt === maxRetries
      ) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, error.message);
      await sleep(delay);
    }
  }

  throw lastError;
};

// Response interceptor for error handling and retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Implement retry logic for specific errors with conservative settings
    if (
      error.response?.status === 429 || // Too Many Requests
      error.response?.status >= 500 || // Server errors
      error.code === 'NETWORK_ERROR' || // Network issues
      !error.response // No response (network error)
    ) {
      // Retry with very conservative settings to prevent overwhelming backend
      try {
        return await retryRequest(() => retryApi.request(error.config), 1, 5000);
      } catch (retryError) {
        // If retry fails, return the original error
        return Promise.reject(retryError);
      }
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
  
  getCaseEntities: (caseId: number, params?: any) => api.get(`/cases/${caseId}/entities`, { params }),
  
  getCaseChats: (caseId: number, params?: any) => api.get(`/cases/${caseId}/chats`, { params }),
  
  getStatistics: () => api.get('/cases/statistics'),
};

// Upload API
export const uploadAPI = {
  uploadFile: (caseId: number, file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(`/upload/case/${caseId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  getJobStatus: (jobId: number) => api.get(`/upload/job/${jobId}`),
  
  getProcessingSummary: (caseId: number) => api.get(`/upload/case/${caseId}/processing-summary`),
};

// Query API
export const queryAPI = {
  createQuery: (caseId: number, data: any) =>
    api.post(`/query/case/${caseId}`, data),
  
  getQueryHistory: (caseId: number, params?: any) =>
    api.get(`/query/case/${caseId}/history`, { params }),
  
  getQuery: (queryId: number) => api.get(`/query/${queryId}`),
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

// Cross-Case API
export const crossCaseAPI = {
  analyzeAllCases: () =>
    api.post('/cross-case/analyze-all'),
  
  analyzeCase: (caseId: number) =>
    api.post(`/cross-case/analyze/${caseId}`),
  
  getConnections: (caseId: number, maxDepth?: number) =>
    api.get(`/cross-case/connections/${caseId}`, { params: { maxDepth } }),
  
  getSharedEntities: (params?: any) =>
    api.get('/cross-case/shared-entities', { params }),
  
  getStatistics: () =>
    api.get('/cross-case/statistics'),
};

// Alerts API
export const alertsAPI = {
  getAlerts: (params?: any) =>
    api.get('/alerts', { params }),
  
  getStatistics: () =>
    api.get('/alerts/statistics'),
  
  acknowledgeAlert: (alertId: number) =>
    api.put(`/alerts/${alertId}/acknowledge`),
  
  resolveAlert: (alertId: number, resolutionNotes?: string) =>
    api.put(`/alerts/${alertId}/resolve`, { resolutionNotes }),
  
  getCaseAlerts: (caseId: number, params?: any) =>
    api.get(`/alerts/case/${caseId}`, { params }),
  
  createAlert: (alertData: any) =>
    api.post('/alerts', alertData),
  
  runDetection: () =>
    api.post('/alerts/run-detection'),
};

// Advanced AI API (for deep learning and advanced analysis)
export const advancedAIApi = {
  // Deep Learning Analysis
  deepLearningAnalysis: (operation: string, data: any[], parameters?: any) =>
    api.post('/ai/analysis/deep-learning', { operation, data, parameters }),

  // Evidence Classification
  classifyEvidence: (evidenceList: any[], algorithm?: string, batchSize?: number) =>
    api.post('/ai/analysis/evidence-classification', { evidence_list: evidenceList, algorithm, batch_size: batchSize }),

  // Evidence Clustering
  clusterEvidence: (evidenceList: any[], nClusters?: number, algorithm?: string) =>
    api.post('/ai/analysis/evidence-clustering', { evidence_list: evidenceList, n_clusters: nClusters, algorithm }),

  // Pattern Recognition
  recognizePatterns: (data: any[], patternTypes?: string[], analysisDepth?: string) =>
    api.post('/ai/analysis/pattern-recognition', { data, pattern_types: patternTypes, analysis_depth: analysisDepth }),

  // Model Training
  trainModel: (trainingData: any[], modelType: string, parameters?: any) =>
    api.post('/ai/analysis/train-model', { training_data: trainingData, model_type: modelType, parameters }),

  // Hyperparameter Optimization
  optimizeHyperparameters: (trainingData: any[], algorithm?: string, modelType?: string) =>
    api.post('/ai/analysis/hyperparameter-optimization', { training_data: trainingData, algorithm, model_type: modelType }),

  // Model Statistics
  getModelStats: () =>
    api.get('/ai/analysis/model-stats'),

  // Comprehensive Analysis
  comprehensiveAnalysis: (caseData: any, analysisTypes?: string[]) =>
    api.post('/ai/analysis/comprehensive-analysis', { case_data: caseData, analysis_types: analysisTypes }),
};

// Analysis API (for ML-based anomaly detection)
export const analysisAPI = {
  detectPatterns: (caseId: number, analysisType: string) =>
    api.post('/analysis/detect-patterns', { caseId, analysisType }),
  
  detectAnomalies: (caseId: number) =>
    api.post('/analysis/detect-anomalies', { caseId, analysisType: 'anomalies' }),
  
  getCaseSummary: (caseId: number) =>
    api.post('/analysis/case-summary', { caseId, analysisType: 'summary' }),
  
  predictiveAnalysis: (caseId: number) =>
    api.post('/analysis/predictive-analysis', { caseId, analysisType: 'predictive' }),
  
  trainPredictiveModel: () =>
    api.post('/analysis/train-predictive-model'),
};

// Integration API (for external tool integration)
export const integrationAPI = {
  getSystemStatus: () =>
    api.get('/integration/status'),
  
  exportCaseData: (caseId: number, format?: string, includeEvidence?: boolean) =>
    api.get(`/integration/cases/${caseId}/export`, {
      params: { format, includeEvidence }
    }),
  
  submitEvidence: (evidenceData: any) =>
    api.post('/integration/evidence/submit', evidenceData),
  
  registerTool: (toolData: any) =>
    api.post('/integration/register-tool', toolData),
  
  bulkOperation: (operation: string, items: any[], options?: any) =>
    api.post(`/integration/bulk/${operation}`, { items, options }),
  
  realTimeSync: (toolName: string, syncType: string, data: any, lastSync?: string) =>
    api.post(`/integration/sync/${toolName}`, { syncType, data, lastSync }),
  
  transformData: (format: string, sourceFormat: string, data: any, mappings?: any, options?: any) =>
    api.post(`/integration/transform/${format}`, { sourceFormat, data, mappings, options }),
  
  getIntegrationMetrics: (toolName: string, timeframe?: string) =>
    api.get(`/integration/monitoring/${toolName}`, { params: { timeframe } }),
  
  authenticateTool: (toolName: string, apiKey: string, signature?: string, timestamp?: string) =>
    api.post(`/integration/auth/${toolName}`, { apiKey, signature, timestamp }),
  
  runIntegrationTest: (toolName: string, testType: string, testData?: any) =>
    api.post(`/integration/test/${toolName}`, { testType, testData }),
  
  validateData: (dataType: string, data: any, schema?: any, strict?: boolean) =>
    api.post(`/integration/validate/${dataType}`, { data, schema, strict }),
};

// Performance API (for system monitoring and optimization)
export const performanceAPI = {
  getMetrics: () =>
    api.get('/performance/metrics'),
  
  getInsights: () =>
    api.get('/performance/insights'),
  
  getHealthStatus: () =>
    api.get('/performance/health'),
  
  getCacheStats: () =>
    api.get('/performance/cache'),
  
  clearCache: (pattern?: string) =>
    api.post('/performance/cache/clear', { pattern }),
};
