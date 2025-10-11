import Queue from 'bull';
import { redisClient } from '../config/databases.js';
import logger from '../config/logger.js';

// Create Bull queue for file processing
export const processingQueue = new Queue('ufdr-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

// Queue event handlers
processingQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed:`, result);
});

processingQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err.message);
});

processingQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`);
});

processingQueue.on('progress', (job, progress) => {
  logger.info(`Job ${job.id} progress: ${progress}%`);
});

export default processingQueue;
