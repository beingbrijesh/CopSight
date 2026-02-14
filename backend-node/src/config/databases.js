import { Client } from '@elastic/elasticsearch';
import neo4j from 'neo4j-driver';
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
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

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
