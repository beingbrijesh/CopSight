// Load environment variables FIRST, before any imports read process.env
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Try .env.local first (workaround for macOS EPERM on .env), then .env
const envLocal = resolve(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config();
}

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  // We need logger here, but logger is imported later.
  // For critical early checks, a direct console.error is acceptable before logger is fully initialized.
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDatabase } from './config/database.js';
import { testDatabaseConnections, closeDatabaseConnections } from './config/databases.js';
import { initializeIndices } from './services/search/elasticsearchService.js';
import logger from './config/logger.js';
import aiClient from './services/ai/aiClient.js';
import './workers/processingWorker.js'; // Start background worker
import './workers/streamWorker.js'; // Start stream background worker

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import queryRoutes from './routes/queryRoutes.js';
import bookmarkRoutes from './routes/bookmarkRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import crossCaseRoutes from './routes/crossCaseRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import graphRoutes from './routes/graphRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';

// Import middleware
import { apiRateLimit, authRateLimit, searchRateLimit, uploadRateLimit, aiRateLimit } from './middleware/rateLimit.js';
import { performanceMiddleware } from './routes/performanceRoutes.js';


const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Root health check endpoint for load balancers
app.get('/', (req, res) => {
  res.json({
    status: 'live',
    service: 'copsight-backend'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'CopSight AI API Gateway is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'pong', version: '1.0.1' });
});

// API Routes with rate limiting and performance monitoring
app.use('/api/auth', authRateLimit, performanceMiddleware, authRoutes);
app.use('/api/users', apiRateLimit, performanceMiddleware, userRoutes);
app.use('/api/cases', apiRateLimit, performanceMiddleware, caseRoutes);
app.use('/api/upload', uploadRateLimit, performanceMiddleware, uploadRoutes);
app.use('/api/query', searchRateLimit, performanceMiddleware, queryRoutes);
app.use('/api/bookmarks', apiRateLimit, performanceMiddleware, bookmarkRoutes);
app.use('/api/reports', apiRateLimit, performanceMiddleware, reportRoutes);
app.use('/api/cross-case', apiRateLimit, performanceMiddleware, crossCaseRoutes);
app.use('/api/alerts', apiRateLimit, performanceMiddleware, alertRoutes);
app.use('/api/integration', apiRateLimit, performanceMiddleware, integrationRoutes);
app.use('/api/performance', apiRateLimit, performanceMiddleware, performanceRoutes);
app.use('/api/graph', apiRateLimit, performanceMiddleware, graphRoutes);
app.use('/api/notifications', apiRateLimit, performanceMiddleware, notificationRoutes);
app.use('/api/analysis', aiRateLimit, performanceMiddleware, analysisRoutes);
app.use('/api/ingest', apiRateLimit, performanceMiddleware, ingestRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to PostgreSQL database
    await connectDatabase();
    logger.info('✓ PostgreSQL connected');

    // Test other database connections
    const dbStatus = await testDatabaseConnections();

    // Initialize search indices (only if services are available)
    if (dbStatus.elasticsearch) {
      await initializeIndices();
    }

    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 CopSight AI API Gateway running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info('📊 Database Status:');
      logger.info(`   - PostgreSQL: ✓`);
      logger.info(`   - Elasticsearch: ${dbStatus.elasticsearch ? '✓' : '✗'}`);
      logger.info(`   - Neo4j: ${dbStatus.neo4j ? '✓' : '✗'}`);
      logger.info(`   - Redis: ${dbStatus.redis ? '✓' : '✗'}`);

      // ── Advanced Stealth Keep-Alive Ping System ──
      const USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
      ];

      let isAIServerDown = false;

      const performStealthPing = async () => {
        try {
          const headers = {
            "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          };

          // 1. Ping AI Server (Masked as root page visit instead of /health)
          const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8005';
          try {
            const resp = await fetch(`${aiUrl}/`, { headers });
            if (resp.ok) {
              logger.info('[STEALTH KEEPALIVE] ✅ AI Service (HuggingFace) ping successful.');
              isAIServerDown = false;
            } else {
              logger.warn(`[STEALTH KEEPALIVE] ⚠️ AI Service returned ${resp.status}`);
              isAIServerDown = true;
            }
          } catch (e) {
            logger.error('[STEALTH KEEPALIVE] ❌ AI Service (HuggingFace) is OFFLINE or UNREACHABLE');
            isAIServerDown = true;
          }

          // 2. Fail-over Logic: If AI is down, Ping Qdrant
          if (isAIServerDown && process.env.QDRANT_URL && process.env.QDRANT_API_KEY) {
            try {
              logger.info('[STEALTH KEEPALIVE] AI is offline. Executing fail-over ping to Qdrant...');
              const qHeaders = { ...headers, "api-key": process.env.QDRANT_API_KEY };
              const qResp = await fetch(`${process.env.QDRANT_URL}/collections`, { headers: qHeaders });
              if (qResp.ok) {
                logger.info('[STEALTH KEEPALIVE] ✅ Qdrant fail-over ping successful.');
              } else {
                logger.warn(`[STEALTH KEEPALIVE] ⚠️ Qdrant returned ${qResp.status}`);
              }
            } catch (e) {
              logger.error('[STEALTH KEEPALIVE] ❌ Qdrant fail-over ping failed');
            }
          }

        } catch (error) {
          logger.error(`[STEALTH KEEPALIVE] ❌ Keep-Alive Ping Failed: ${error.message}`);
        } finally {
          // Calculate next interval with Jitter
          // Normal: ~1 hour (3300 to 3900 seconds)
          // Fail-over: ~10 minutes (570 to 840 seconds)
          let nextDelayMs;
          if (isAIServerDown) {
            nextDelayMs = (Math.floor(Math.random() * (840 - 570 + 1)) + 570) * 1000;
          } else {
            nextDelayMs = (Math.floor(Math.random() * (3900 - 3300 + 1)) + 3300) * 1000;
          }
          
          setTimeout(performStealthPing, nextDelayMs);
        }
      };

      // Run once immediately at startup (after a small 5s delay)
      setTimeout(performStealthPing, 5000);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await closeDatabaseConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await closeDatabaseConnections();
  process.exit(0);
});

startServer();

export default app;
