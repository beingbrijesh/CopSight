import os from 'os';
import { performance } from 'perf_hooks';
import logger from '../config/logger.js';

class PerformanceMonitor {
  constructor() {
    this.startTime = performance.now();
    this.requestCounts = {};
    this.responseTimes = [];
  }

  async getSystemMetrics() {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const loadAverage = os.loadavg();

      return {
        cpu: {
          count: cpus.length,
          loadAverage: loadAverage,
          model: cpus[0]?.model || 'Unknown'
        },
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: totalMemory - freeMemory,
          usagePercent: ((totalMemory - freeMemory) / totalMemory) * 100
        },
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      return {};
    }
  }

  async getApplicationMetrics() {
    try {
      const uptime = (performance.now() - this.startTime) / 1000; // Convert to seconds
      const memoryUsage = process.memoryUsage();

      return {
        process: {
          pid: process.pid,
          uptime: uptime,
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external
          }
        },
        requests: this.requestCounts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting application metrics:', error);
      return {};
    }
  }

  recordRequest(endpoint, method, responseTime) {
    const key = `${method}:${endpoint}`;

    if (!this.requestCounts[key]) {
      this.requestCounts[key] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0
      };
    }

    const metrics = this.requestCounts[key];
    metrics.count += 1;
    metrics.totalTime += responseTime;
    metrics.avgTime = metrics.totalTime / metrics.count;
    metrics.minTime = Math.min(metrics.minTime, responseTime);
    metrics.maxTime = Math.max(metrics.maxTime, responseTime);

    // Keep only recent response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Log slow requests
    if (responseTime > 5000) {
      logger.warn(`Slow request: ${key} took ${responseTime}ms`);
    }
  }

  getPerformanceInsights() {
    try {
      const insights = {
        bottlenecks: [],
        recommendations: [],
        warnings: [],
        timestamp: new Date().toISOString()
      };

      // Analyze request performance
      if (Object.keys(this.requestCounts).length > 0) {
        const slowEndpoints = [];
        for (const [endpoint, metrics] of Object.entries(this.requestCounts)) {
          if (metrics.avgTime > 5000) { // Over 5 seconds average
            slowEndpoints.push({
              endpoint,
              avgTime: metrics.avgTime,
              count: metrics.count
            });
          }
        }

        if (slowEndpoints.length > 0) {
          insights.bottlenecks = slowEndpoints
            .sort((a, b) => b.avgTime - a.avgTime)
            .slice(0, 5)
            .map(item => `Slow endpoint: ${item.endpoint} (${(item.avgTime / 1000).toFixed(2)}s avg)`);
        }
      }

      // Response time analysis
      if (this.responseTimes.length > 0) {
        const avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
        const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

        if (p95ResponseTime > 10000) {
          insights.warnings.push(`P95 response time high: ${(p95ResponseTime / 1000).toFixed(2)}s`);
          insights.recommendations.push('Optimize slow API endpoints (>10s P95)');
        }

        if (avgResponseTime > 2000) {
          insights.recommendations.push('Consider implementing response caching for slow endpoints');
        }
      }

      // Default recommendations
      if (insights.recommendations.length === 0) {
        insights.recommendations = [
          'Monitor system resources regularly',
          'Implement proper database indexing',
          'Consider implementing API response caching',
          'Set up proper logging and monitoring alerts'
        ];
      }

      return insights;
    } catch (error) {
      logger.error('Error generating performance insights:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getHealthStatus() {
    try {
      const uptime = (performance.now() - this.startTime) / 1000;
      const memoryUsage = process.memoryUsage();
      const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      let status = 'healthy';
      const checks = {
        memory: {
          status: memoryPercent < 80 ? 'healthy' : memoryPercent < 95 ? 'warning' : 'critical',
          value: memoryPercent,
          threshold: 80
        },
        uptime: {
          status: 'healthy',
          value: uptime
        },
        requests: {
          status: 'healthy',
          value: Object.keys(this.requestCounts).length
        }
      };

      // Determine overall status
      const statuses = Object.values(checks).map(check => check.status);
      if (statuses.includes('critical')) {
        status = 'critical';
      } else if (statuses.includes('warning')) {
        status = 'warning';
      }

      return {
        status,
        checks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting health status:', error);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Global instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
