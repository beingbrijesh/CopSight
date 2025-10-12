import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import { testDatabaseConnections, closeDatabaseConnections } from './config/databases.js';
import { initializeIndices } from './services/search/elasticsearchService.js';
import logger from './config/logger.js';
import './workers/processingWorker.js'; // Start background worker

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

// Load environment variables
dotenv.config();

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'UFDR API Gateway is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cross-case', crossCaseRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/integration', integrationRoutes);

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
    app.listen(PORT, () => {
      logger.info(`🚀 UFDR API Gateway running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info('📊 Database Status:');
      logger.info(`   - PostgreSQL: ✓`);
      logger.info(`   - Elasticsearch: ${dbStatus.elasticsearch ? '✓' : '✗'}`);
      logger.info(`   - Neo4j: ${dbStatus.neo4j ? '✓' : '✗'}`);
      logger.info(`   - Redis: ${dbStatus.redis ? '✓' : '✗'}`);
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
