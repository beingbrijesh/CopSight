import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import performanceMonitor from '../services/performanceMonitor.js';
import cacheService from '../services/cacheService.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get system performance metrics
 * GET /api/performance/metrics
 */
router.get('/metrics', authorize(['admin']), async (req, res) => {
  try {
    const [systemMetrics, appMetrics] = await Promise.all([
      performanceMonitor.getSystemMetrics(),
      performanceMonitor.getApplicationMetrics()
    ]);

    res.json({
      success: true,
      data: {
        system: systemMetrics,
        application: appMetrics
      }
    });
  } catch (error) {
    logger.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics'
    });
  }
});

/**
 * Get performance insights and recommendations
 * GET /api/performance/insights
 */
router.get('/insights', authorize(['admin']), async (req, res) => {
  try {
    const insights = performanceMonitor.getPerformanceInsights();

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Performance insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate performance insights'
    });
  }
});

/**
 * Get system health status
 * GET /api/performance/health
 */
router.get('/health', (req, res) => {
  try {
    const health = performanceMonitor.getHealthStatus();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
});

/**
 * Get cache statistics
 * GET /api/performance/cache
 */
router.get('/cache', authorize(['admin']), async (req, res) => {
  try {
    const cacheStats = await cacheService.getCacheStats();

    res.json({
      success: true,
      data: cacheStats
    });
  } catch (error) {
    logger.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cache statistics'
    });
  }
});

/**
 * Clear cache (admin only)
 * POST /api/performance/cache/clear
 */
router.post('/cache/clear', authorize(['admin']), async (req, res) => {
  try {
    const { pattern } = req.body;

    if (pattern) {
      // Clear specific pattern
      const keys = await cacheService.client.keys(pattern);
      if (keys.length > 0) {
        await cacheService.client.del(keys);
      }
      res.json({
        success: true,
        message: `Cleared ${keys.length} cache entries matching pattern: ${pattern}`
      });
    } else {
      // Clear all cache
      await cacheService.client.flushAll();
      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    }
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

/**
 * Performance monitoring middleware
 * Records request metrics for performance tracking
 */
export const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const endpoint = req.route ? req.route.path : req.path;
    const method = req.method;

    // Record metrics
    performanceMonitor.recordRequest(endpoint, method, responseTime);

    // Log slow requests
    if (responseTime > 5000) { // Over 5 seconds
      logger.warn(`Slow request: ${method} ${endpoint} took ${responseTime}ms`);
    }
  });

  next();
};

export default router;
