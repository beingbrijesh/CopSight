import axios from 'axios';
import logger from '../../config/logger.js';

/**
 * Client for Python AI Service
 */
class AIClient {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8005';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 minutes timeout for slow local LLM
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Execute natural language query
   */
  async executeQuery(caseId, query, userId) {
    try {
      const response = await this.client.post('/api/query/execute', {
        case_id: caseId,
        query,
        user_id: userId
      });

      return response.data;
    } catch (error) {
      logger.error('AI query execution failed:', error.message);
      throw new Error('Failed to execute AI query');
    }
  }

  /**
   * Get query history
   */
  async getQueryHistory(caseId, limit = 20) {
    try {
      const response = await this.client.get(`/api/query/history/${caseId}`, {
        params: { limit }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get query history:', error.message);
      throw new Error('Failed to get query history');
    }
  }

  /**
   * Get specific query result
   */
  async getQueryResult(queryId) {
    try {
      const response = await this.client.get(`/api/query/${queryId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get query result:', error.message);
      throw new Error('Failed to get query result');
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(texts) {
    try {
      const response = await this.client.post('/api/embeddings/generate', {
        texts
      });

      return response.data.embeddings;
    } catch (error) {
      logger.error('Embedding generation failed:', error.message);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Detect patterns in case data
   */
  async detectPatterns(caseId, analysisType = 'suspicious') {
    try {
      const response = await this.client.post('/api/analysis/detect-patterns', {
        case_id: caseId,
        analysis_type: analysisType
      });

      return response.data;
    } catch (error) {
      logger.error('Pattern detection failed:', error.message);
      throw new Error('Failed to detect patterns');
    }
  }

  /**
   * Get case summary
   */
  async getCaseSummary(caseId) {
    try {
      const response = await this.client.get(`/api/analysis/summary/${caseId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get case summary:', error.message);
      throw new Error('Failed to get case summary');
    }
  }

  /**
   * Check AI service health
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.warn('AI service not available:', error.message);
      return { status: 'unavailable' };
    }
  }
}

export default new AIClient();
