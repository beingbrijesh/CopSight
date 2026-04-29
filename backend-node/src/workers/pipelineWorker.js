import { Worker } from 'bullmq';
import { detectFileFormat } from '../services/pipeline/formatDetector.js';
import { createXmlParser, createJsonParser } from '../services/pipeline/parsers.js';
import { normalizeRecord } from '../services/pipeline/normalizer.js';
import { BatchProcessor } from '../services/pipeline/batchProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

// Connection details for the worker
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

/**
 * Pipeline Worker Logic:
 * Consumes jobs from "forensic-ingestion" queue and executes the streaming pipeline.
 */
export const pipelineWorker = new Worker('forensic-ingestion', async (job) => {
  const { filePath, caseId, userId } = job.data;
  logger.info(`🚀 [WORKER] Starting Pipeline for Job: ${job.id}, Case: ${caseId}, File: ${filePath}`);

  try {
    // 1. Detect Format
    const format = await detectFileFormat(filePath);
    logger.info(`🔍 [FORMAT] Detected: ${format.toUpperCase()} for file: ${filePath}`);

    if (format === 'unknown') {
      throw new Error('Unsupported or unknown file format');
    }

    // 2. Initialize Batch Processor
    const processor = new BatchProcessor(caseId);

    // 3. Initialize Parser
    const parser = format === 'xml' ? createXmlParser(filePath) : createJsonParser(filePath);

    // 4. Process Records as they Stream in
    return new Promise((resolve, reject) => {
      parser.on('record', async (rawRecord) => {
        const traceId = uuidv4();
        // 5. Normalization Phase
        const normalized = normalizeRecord(rawRecord, traceId);
        
        // 6. Batching Phase
        await processor.add(normalized);
      });

      parser.on('error', (err) => {
        logger.error(`❌ [PARSER_ERROR] Stream processing failed:`, err);
        reject(err);
      });

      parser.on('result', async (res) => {
        // Final flush to catch remaining records in buffer
        await processor.flush();
        logger.info(`✅ [COMPLETE] Finished processing file: ${filePath}`);
        resolve(res);
      });
    });

  } catch (error) {
    logger.error(`🚨 [WORKER_CRASH] Job ${job.id} failed:`, error);
    throw error;
  }
}, { connection });

logger.info('Pipeline worker initialized and listening on "forensic-ingestion" queue');
