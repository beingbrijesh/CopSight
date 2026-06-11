import Queue from 'bull';
import logger from '../config/logger.js';

// Create Bull queue for real-time stream processing
export const streamQueue = new Queue('ufdr-stream-processing', {
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

streamQueue.on('completed', (job, result) => {
  logger.debug(`Stream Job ${job.id} completed`);
});

streamQueue.on('failed', (job, err) => {
  logger.error(`Stream Job ${job.id} failed:`, err.message);
});

export default streamQueue;
