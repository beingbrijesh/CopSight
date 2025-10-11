import processingQueue from '../queues/processingQueue.js';
import { parseUFDRFile } from '../services/parser/ufdrParser.js';
import { extractEntities } from '../services/ner/entityExtractor.js';
import { indexToElasticsearch } from '../services/search/elasticsearchService.js';
import { indexToMilvus } from '../services/search/milvusService.js';
import { buildKnowledgeGraph } from '../services/graph/neo4jService.js';
import ProcessingJob from '../models/ProcessingJob.js';
import DataSource from '../models/DataSource.js';
import logger from '../config/logger.js';

// Process UFDR file
processingQueue.process('parse-ufdr', async (job) => {
  const { jobId, caseId, filePath, fileName } = job.data;
  
  try {
    // Update job status
    await ProcessingJob.update(
      { status: 'processing', startedAt: new Date() },
      { where: { id: jobId } }
    );

    job.progress(10);

    // Step 1: Parse UFDR file
    logger.info(`Parsing UFDR file: ${fileName}`);
    const parsedData = await parseUFDRFile(filePath);
    job.progress(30);

    // Step 2: Extract entities using NER
    logger.info('Extracting entities...');
    const entities = await extractEntities(parsedData);
    job.progress(50);

    // Step 3: Index to Elasticsearch (keyword search)
    logger.info('Indexing to Elasticsearch...');
    await indexToElasticsearch(caseId, parsedData, entities);
    job.progress(65);

    // Step 4: Generate embeddings and index to Milvus (semantic search)
    logger.info('Generating embeddings and indexing to Milvus...');
    await indexToMilvus(caseId, parsedData);
    job.progress(80);

    // Step 5: Build knowledge graph in Neo4j
    logger.info('Building knowledge graph...');
    await buildKnowledgeGraph(caseId, parsedData, entities);
    job.progress(95);

    // Update job status
    await ProcessingJob.update(
      { 
        status: 'completed',
        completedAt: new Date(),
        result: {
          devicesProcessed: parsedData.devices?.length || 0,
          entitiesExtracted: entities.length,
          recordsIndexed: parsedData.totalRecords || 0
        }
      },
      { where: { id: jobId } }
    );

    // Update data source status
    await DataSource.update(
      { status: 'processed' },
      { where: { caseId, filePath } }
    );

    job.progress(100);

    return {
      success: true,
      devicesProcessed: parsedData.devices?.length || 0,
      entitiesExtracted: entities.length,
      recordsIndexed: parsedData.totalRecords || 0
    };

  } catch (error) {
    logger.error('Processing job failed:', error);

    // Update job status
    await ProcessingJob.update(
      { 
        status: 'failed',
        completedAt: new Date(),
        error: error.message
      },
      { where: { id: jobId } }
    );

    throw error;
  }
});

logger.info('Processing worker started');
