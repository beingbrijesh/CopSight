import { Queue } from 'bullmq';

// Initialize a Redis-backed queue for "forensic-ingestion"
export const ingestionQueue = new Queue('forensic-ingestion', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

export default ingestionQueue;
