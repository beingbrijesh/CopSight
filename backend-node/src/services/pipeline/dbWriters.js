import { elasticsearchClient, neo4jDriver } from '../../config/databases.js';
import sequelize from '../../config/database.js';
import { indexToAIService } from '../search/aiService.js'; // Reuse existing AI service logic
import logger from '../../config/logger.js';

/**
 * Perform bulk writes to all 4 databases.
 */
export async function bulkWriteToAllDBs(batch, caseId) {
  const traceId = batch[0]?.traceId || 'batch';
  logger.info(`📦 [BATCH] Starting bulk write for ${batch.length} records, Case: ${caseId}, Trace: ${traceId}`);

  try {
    await Promise.all([
      writeToPostgres(batch, caseId),
      writeToElasticsearch(batch, caseId),
      writeToNeo4j(batch, caseId),
      writeToChroma(batch, caseId)
    ]);

    logger.info(`💾 [WRITE] Successfully flushed batch to all 4 DBs`);
  } catch (error) {
    logger.error(`❌ [WRITE_ERROR] Batch write failed:`, error);
    // In production, we would push failed batches to a dead-letter queue (DLQ).
  }
}

/**
 * PostgreSQL write using Sequelize/SQL.
 */
async function writeToPostgres(batch, caseId) {
  // Use raw SQL or bulkCreate for performance
  const values = batch.map(r => ({
    caseId,
    traceId: r.traceId,
    sourceType: r.sourceType,
    content: r.content,
    sender: r.sender,
    receiver: r.receiver,
    timestamp: r.timestamp,
    metadata: JSON.stringify(r.metadata)
  }));

  // Assuming a table 'extracted_records' exists (or reusing DataSource/Evidence structure)
  await sequelize.query('INSERT INTO "DataSourceRecords" ("caseId", "traceId", "sourceType", "content", "sender", "receiver", "timestamp", "metadata", "createdAt", "updatedAt") VALUES ' + 
    values.map((_, i) => `(:caseId, :traceId_${i}, :sourceType_${i}, :content_${i}, :sender_${i}, :receiver_${i}, :timestamp_${i}, :metadata_${i}, NOW(), NOW())`).join(','),
    { 
      replacements: values.reduce((acc, v, i) => {
        acc['caseId'] = caseId;
        acc[`traceId_${i}`] = v.traceId;
        acc[`sourceType_${i}`] = v.sourceType;
        acc[`content_${i}`] = v.content;
        acc[`sender_${i}`] = v.sender;
        acc[`receiver_${i}`] = v.receiver;
        acc[`timestamp_${i}`] = v.timestamp;
        acc[`metadata_${i}`] = v.metadata;
        return acc;
      }, {})
    }
  );
}

/**
 * Elasticsearch Bulk Index.
 */
async function writeToElasticsearch(batch, caseId) {
  const operations = batch.flatMap(doc => [
    { index: { _index: `forensic-case-${caseId}` } },
    { ...doc, caseId }
  ]);
  
  await elasticsearchClient.bulk({ refresh: true, body: operations });
}

/**
 * Neo4j Graph MERGE.
 */
async function writeToNeo4j(batch, caseId) {
  const session = neo4jDriver.session();
  try {
    const query = `
      UNWIND $batch AS row
      MERGE (c1:Contact {phone: row.sender})
      MERGE (c2:Contact {phone: row.receiver})
      CREATE (c1)-[r:MESSAGED {traceId: row.traceId, timestamp: row.timestamp, content: row.content, caseId: $caseId}]->(c2)
    `;
    await session.run(query, { batch, caseId });
  } finally {
    await session.close();
  }
}

/**
 * ChromaDB Semantic AI.
 */
async function writeToChroma(batch, caseId) {
  // Reusing existing AI service which handles embeddings and ChromaDB storage
  // Alternatively, we can use the batch and map to indexToAIService
  try {
    // Basic mock example: map to AIService structure
    const fauxParsedData = {
      dataSources: [{
        sourceType: 'pipeline_batch',
        data: batch
      }]
    };
    await indexToAIService(caseId, fauxParsedData, []);
  } catch (e) {
    logger.warn('ChromaDB batch index failed:', e.message);
  }
}
