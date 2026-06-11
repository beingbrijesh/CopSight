import axios from 'axios';
import logger from '../../config/logger.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8005';

const sendBatch = async (caseId, batchRecords) => {
  const payload = {
    case_id: parseInt(caseId),
    records: batchRecords
  };
  try {
    await axios.post(`${AI_SERVICE_URL}/api/ingest/text/batch`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // allow more time for batch submission
    });
  } catch (error) {
    logger.error(`Failed to send batch of ${batchRecords.length} records to AI service: ${error.message}`);
    throw error;
  }
};

/**
 * Index parsed CopSight AI data to AI service (ChromaDB)
 */
export const indexToAIService = async (caseId, parsedData, entities) => {
  try {
    let indexed = 0;
    
    // Process each data source and send text records to the new ingestion pipeline
    if (parsedData.dataSources && parsedData.dataSources.length > 0) {
      for (const source of parsedData.dataSources) {
        
        // Accumulate records into batches of 500
        const batchSize = 500;
        let batch = [];
        
        for (const record of source.data || []) {
          batch.push({
            source_type: source.sourceType || 'text',
            content: record.content || record.message || record.body || JSON.stringify(record),
            metadata: record,
            entities: entities || []
          });

          if (batch.length >= batchSize) {
            await sendBatch(caseId, batch);
            indexed += batch.length;
            batch = [];
          }
        }
        
        // Send any remaining records
        if (batch.length > 0) {
          await sendBatch(caseId, batch);
          indexed += batch.length;
        }
      }
    }

    logger.info(`Queued ${indexed} documents for background AI ingestion for case ${caseId}`);
    return { indexed };
  } catch (error) {
    logger.error('Error queuing to AI ingestion service:', error.message);
    return { indexed: 0 };
  }
};
