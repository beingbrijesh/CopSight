import { bulkWriteToAllDBs } from './dbWriters.js';
import logger from '../../config/logger.js';

/**
 * Manages buffering and batch flushing of forensic records.
 */
export class BatchProcessor {
  constructor(caseId, batchSize = 500, flushTimeout = 2000) {
    this.caseId = caseId;
    this.batchSize = batchSize;
    this.buffer = [];
    this.timeout = null;
    this.isFlushing = false;
    this.flushTimeout = flushTimeout;
  }

  /**
   * Adds a record to the buffer and triggers flush if full.
   */
  async add(record) {
    this.buffer.push(record);
    
    // Clear previous timeout if it was scheduled
    if (this.timeout) clearTimeout(this.timeout);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    } else {
      // Schedule a flush if no more records arrive after the timeout
      this.timeout = setTimeout(() => this.flush(), this.flushTimeout);
    }
  }

  /**
   * Flushes the buffer to the databases.
   */
  async flush() {
    if (this.buffer.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batchToFlush = [...this.buffer];
    this.buffer = [];
    
    logger.info(`📦 [BATCH] Flushing ${batchToFlush.length} records for Case: ${this.caseId}`);
    
    try {
      await bulkWriteToAllDBs(batchToFlush, this.caseId);
    } catch (error) {
      logger.error('Batch flush failed:', error);
    } finally {
      this.isFlushing = false;
    }
  }
}
