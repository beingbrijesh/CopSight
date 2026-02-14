import { createClient } from 'redis';
import logger from '../config/logger.js';

class CacheService {
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => {
      logger.error('Redis cache connection error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis cache');
    });

    this.client.connect().catch((err) => {
      logger.warn('Failed to connect to Redis cache:', err.message);
    });
  }

  // Generic cache operations
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Application-specific caching methods

  // Cache case data
  async getCaseData(caseId) {
    const key = `case:${caseId}:data`;
    return await this.get(key);
  }

  async setCaseData(caseId, data, ttl = 1800) { // 30 minutes
    const key = `case:${caseId}:data`;
    await this.set(key, data, ttl);
  }

  async invalidateCaseData(caseId) {
    const key = `case:${caseId}:data`;
    await this.del(key);
  }

  // Cache user permissions
  async getUserPermissions(userId) {
    const key = `user:${userId}:permissions`;
    return await this.get(key);
  }

  async setUserPermissions(userId, permissions, ttl = 3600) { // 1 hour
    const key = `user:${userId}:permissions`;
    await this.set(key, permissions, ttl);
  }

  // Cache search results
  async getSearchResults(queryHash, filters = {}) {
    const filterStr = JSON.stringify(filters);
    const key = `search:${queryHash}:${filterStr}`;
    return await this.get(key);
  }

  async setSearchResults(queryHash, filters, results, ttl = 600) { // 10 minutes
    const filterStr = JSON.stringify(filters);
    const key = `search:${queryHash}:${filterStr}`;
    await this.set(key, results, ttl);
  }

  // Cache AI responses
  async getAIResponse(queryHash) {
    const key = `ai:${queryHash}:response`;
    return await this.get(key);
  }

  async setAIResponse(queryHash, response, ttl = 1800) { // 30 minutes
    const key = `ai:${queryHash}:response`;
    await this.set(key, response, ttl);
  }

  // Cache analytics data
  async getAnalyticsData(type, timeframe) {
    const key = `analytics:${type}:${timeframe}`;
    return await this.get(key);
  }

  async setAnalyticsData(type, timeframe, data, ttl = 3600) { // 1 hour
    const key = `analytics:${type}:${timeframe}`;
    await this.set(key, data, ttl);
  }

  // Cache session data
  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async setSession(sessionId, data, ttl = 86400) { // 24 hours
    const key = `session:${sessionId}`;
    await this.set(key, data, ttl);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    await this.del(key);
  }

  // Bulk operations
  async invalidateUserCache(userId) {
    const patterns = [
      `user:${userId}:*`,
      `case:*:user:${userId}`,
      `search:*:user:${userId}`
    ];

    for (const pattern of patterns) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        logger.error('Error invalidating user cache:', error);
      }
    }
  }

  async invalidateCaseCache(caseId) {
    const patterns = [
      `case:${caseId}:*`,
      `search:*:case:${caseId}`,
      `ai:*:case:${caseId}`
    ];

    for (const pattern of patterns) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        logger.error('Error invalidating case cache:', error);
      }
    }
  }

  // Cache statistics
  async getCacheStats() {
    try {
      const info = await this.client.info('memory');
      const keys = await this.client.dbsize();

      return {
        connected: this.client.isOpen,
        totalKeys: keys,
        memory: {
          used: info.match(/used_memory:(\d+)/)?.[1],
          peak: info.match(/used_memory_peak:(\d+)/)?.[1],
          rss: info.match(/used_memory_rss:(\d+)/)?.[1]
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Health check
  async ping() {
    try {
      return await this.client.ping() === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Cleanup
  async close() {
    try {
      await this.client.quit();
      logger.info('Redis cache connection closed');
    } catch (error) {
      logger.error('Error closing cache connection:', error);
    }
  }
}

// Global cache instance
export const cacheService = new CacheService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cacheService.close();
});

process.on('SIGINT', async () => {
  await cacheService.close();
});

export default cacheService;
