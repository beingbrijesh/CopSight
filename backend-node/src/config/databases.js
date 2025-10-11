import { Client } from '@elastic/elasticsearch';
import neo4j from 'neo4j-driver';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import Redis from 'ioredis';
import logger from './logger.js';

// Elasticsearch Client
export const elasticsearchClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  }
});

// Neo4j Driver
export const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URL || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Milvus Client (optional - will be initialized on demand)
export let milvusClient = null;

// Initialize Milvus only if needed
export const initMilvus = () => {
  try {
    milvusClient = new MilvusClient({
      address: process.env.MILVUS_URL || 'localhost:19530',
      username: process.env.MILVUS_USER || '',
      password: process.env.MILVUS_PASSWORD || ''
    });
    return milvusClient;
  } catch (error) {
    logger.warn('Milvus initialization skipped:', error.message);
    return null;
  }
};

// Redis Client (for Bull queue)
export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

// Test connections
export const testDatabaseConnections = async () => {
  const results = {
    elasticsearch: false,
    neo4j: false,
    milvus: false,
    redis: false
  };

  // Test Elasticsearch
  try {
    await elasticsearchClient.ping();
    results.elasticsearch = true;
    logger.info('✓ Elasticsearch connected');
  } catch (error) {
    logger.warn('✗ Elasticsearch not available:', error.message);
  }

  // Test Neo4j
  try {
    const session = neo4jDriver.session();
    await session.run('RETURN 1');
    await session.close();
    results.neo4j = true;
    logger.info('✓ Neo4j connected');
  } catch (error) {
    logger.warn('✗ Neo4j not available:', error.message);
  }

  // Test Milvus (optional)
  try {
    if (!milvusClient) {
      milvusClient = initMilvus();
    }
    if (milvusClient) {
      const health = await milvusClient.checkHealth();
      results.milvus = health.isHealthy;
      logger.info('✓ Milvus connected');
    }
  } catch (error) {
    logger.warn('✗ Milvus not available:', error.message);
    results.milvus = false;
  }

  // Test Redis
  try {
    await redisClient.ping();
    results.redis = true;
    logger.info('✓ Redis connected');
  } catch (error) {
    logger.warn('✗ Redis not available:', error.message);
  }

  return results;
};

// Graceful shutdown
export const closeDatabaseConnections = async () => {
  try {
    await neo4jDriver.close();
    await redisClient.quit();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};
