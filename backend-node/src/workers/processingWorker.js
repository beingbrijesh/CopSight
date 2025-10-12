import processingQueue from '../queues/processingQueue.js';
import { parseUFDRFile } from '../services/parser/ufdrParser.js';
import { extractEntities } from '../services/ner/entityExtractor.js';
import { indexToElasticsearch } from '../services/search/elasticsearchService.js';
import { buildKnowledgeGraph } from '../services/graph/neo4jService.js';
import ProcessingJob from '../models/ProcessingJob.js';
import logger from '../config/logger.js';

// Process UFDR file
processingQueue.process('parse-ufdr', async (job) => {
  const { jobId, caseId, filePath, fileName } = job.data;
  
  try {
    // Update job status
    await ProcessingJob.update(
      { status: 'processing', progress: 10, startedAt: new Date() },
      { where: { id: jobId } }
    );

    job.progress(10);

    // Step 1: Parse UFDR file
    logger.info(`Parsing UFDR file: ${fileName}`);
    const parsedData = await parseUFDRFile(filePath);
    await ProcessingJob.update({ progress: 30 }, { where: { id: jobId } });
    job.progress(30);

    // Step 2: Extract entities using NER
    logger.info('Extracting entities...');
    const entities = await extractEntities(parsedData);
    await ProcessingJob.update({ progress: 50 }, { where: { id: jobId } });
    job.progress(50);

    // Step 3: Index to Elasticsearch (full-text search)
    logger.info('Indexing to Elasticsearch...');
    await indexToElasticsearch(caseId, parsedData, entities);
    await ProcessingJob.update({ progress: 70 }, { where: { id: jobId } });
    job.progress(70);

    // Step 4: Build knowledge graph in Neo4j
    logger.info('Building knowledge graph...');
    await buildKnowledgeGraph(caseId, parsedData, entities);
    await ProcessingJob.update({ progress: 95 }, { where: { id: jobId } });
    job.progress(95);

    // Update job status
    await ProcessingJob.update(
      { 
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      },
      { where: { id: jobId } }
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
        errorMessage: error.message
      },
      { where: { id: jobId } }
    );

    throw error;
  }
});

logger.info('Processing worker started');
