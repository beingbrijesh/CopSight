import processingQueue from '../queues/processingQueue.js';
import { parseUFDRFile } from '../services/parser/ufdrParser.js';
import { extractEntities } from '../services/ner/entityExtractor.js';
import { indexToElasticsearch } from '../services/search/elasticsearchService.js';
import { buildKnowledgeGraph } from '../services/graph/neo4jService.js';
import { indexToAIService } from '../services/search/aiService.js';
import ProcessingJob from '../models/ProcessingJob.js';
import Device from '../models/Device.js';
import DataSource from '../models/DataSource.js';
import EntityTag from '../models/EntityTag.js';
import Case from '../models/Case.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

logger.info('WORKER FILE LOADED: processingWorker.js imported');

// Process UFDR file
logger.info('Registering worker: Setting up processingQueue.process handler');
try {
  processingQueue.process('parse-ufdr', async (job) => {
    logger.info(`Worker executing: Starting job processing for job ID: ${job.id}`);
    logger.debug('Job data received:', JSON.stringify(job.data, null, 2));

    try {
      const { filePath, caseId, jobId } = job.data;
      logger.info(`Extracted job parameters - filePath: ${filePath}, caseId: ${caseId}, jobId: ${jobId}`);
      // Update job status
      await ProcessingJob.update(
        { status: 'processing', progress: 10, startedAt: new Date() },
        { where: { id: jobId } }
      );

      job.progress(10);

      // Step 1: Parse UFDR file
      logger.info(`Parsing UFDR file: ${filePath}`);
      const parsedData = await parseUFDRFile(filePath);
      logger.info('Parsed data structure:', JSON.stringify(parsedData, null, 2).substring(0, 500) + '...');
      await ProcessingJob.update({ progress: 30 }, { where: { id: jobId } });
      job.progress(30);

      // Step 2: Create device record
      const device = await Device.create({
        caseId: parseInt(caseId),
        ...parsedData.deviceInfo
      });
      logger.info(`Device created: ${device.id}`);
      await ProcessingJob.update({ progress: 40 }, { where: { id: jobId } });
      job.progress(40);

      // Step 3: Process each data source
      const totalSources = parsedData.dataSources.length;
      logger.info(`WORKER DEBUG: Starting to process ${totalSources} data sources`);
      logger.debug('Data sources array:', JSON.stringify(parsedData.dataSources, null, 2));

      let processedSources = 0;
      let totalEntities = 0;
      const allEntities = []; // Collect all entities for indexing

      for (const source of parsedData.dataSources) {
        // Create data source record
        const dataSource = await DataSource.create({
          deviceId: device.id,
          sourceType: source.sourceType,
          appName: source.appName,
          totalRecords: source.totalRecords,
          processedRecords: 0,
          status: 'processing'
        });

        logger.info(`Processing ${source.sourceType}: ${source.totalRecords} records`);

        // Process records and extract entities
        let processedRecords = 0;
        const entities = [];

        for (const record of source.data || []) {
          logger.info(`WORKER DEBUG: Processing record ${processedRecords + 1} of ${source.totalRecords} in ${source.sourceType}`);

          // Extract entities from the record (both text content and fields)
          const recordData = {
            dataSources: [{
              sourceType: source.sourceType,
              data: [record],
              totalRecords: 1
            }]
          };

          const extractedEntities = await extractEntities(recordData);

          // Debug: Log what we're processing
          const textContent = record.content || record.message || record.body || '';
          logger.info(`WORKER DEBUG: Processing text: ${textContent.substring(0, 50)}`);
          logger.info(`WORKER DEBUG: Found ${extractedEntities.length} entities`);

          // Format entities for database storage
          const recordEntities = extractedEntities.map(entity => ({
            caseId: parseInt(caseId),
            evidenceType: source.sourceType,
            evidenceId: record.id?.toString() || `record_${processedRecords}`,
            entityType: entity.type,
            entityValue: entity.value,
            entityMetadata: entity.metadata || {},
            confidenceScore: entity.confidence || 0.8,
            startPosition: entity.startPosition || 0
          }));

          entities.push(...recordEntities);
          allEntities.push(...recordEntities); // Add to global collection
          logger.info(`WORKER DEBUG: Added ${recordEntities.length} entities to save`);

          processedRecords++;
        }

        // Save all entities for this source
        if (entities.length > 0) {
          await EntityTag.bulkCreate(entities);
          totalEntities += entities.length;
          logger.info(`Extracted ${entities.length} entities from ${source.sourceType}`);
        }

        // Mark source as completed
        await DataSource.update(
          {
            processedRecords: source.totalRecords,
            status: 'completed'
          },
          { where: { id: dataSource.id } }
        );

        processedSources++;
        const progress = 40 + Math.floor((processedSources / totalSources) * 30);
        await ProcessingJob.update({ progress }, { where: { id: jobId } });
        job.progress(progress);
      }

      // Step 4: Index to Elasticsearch (full-text search)
      logger.info('Indexing to Elasticsearch...');
      await ProcessingJob.update({ progress: 80 }, { where: { id: jobId } });
      job.progress(80);

      try {
        await indexToElasticsearch(parseInt(caseId), parsedData, allEntities.flat());
        logger.info('Elasticsearch indexing completed');
      } catch (error) {
        logger.error('Elasticsearch indexing failed:', error);
        // Continue processing even if indexing fails
      }

      // Step 5: Index to ChromaDB via AI service
      logger.info('Indexing to ChromaDB via AI service...');
      await ProcessingJob.update({ progress: 90 }, { where: { id: jobId } });
      job.progress(90);

      try {
        await indexToAIService(parseInt(caseId), parsedData, allEntities.flat());
        logger.info('ChromaDB indexing via AI service completed');
      } catch (error) {
        logger.error('ChromaDB indexing via AI service failed:', error);
        // Continue processing even if indexing fails
      }

      // Step 6: Build knowledge graph in Neo4j
      logger.info('Building knowledge graph...');
      await ProcessingJob.update({ progress: 95 }, { where: { id: jobId } });
      job.progress(95);

      try {
        await buildKnowledgeGraph(parseInt(caseId), parsedData, allEntities.flat());
        logger.info('Knowledge graph building completed');
      } catch (error) {
        logger.error('Knowledge graph building failed:', error);
        // Continue processing even if graph building fails
      }

      // Update case status
      await Case.update(
        { status: 'ready_for_analysis' },
        { where: { id: caseId } }
      );

      // Log completion
      await AuditLog.create({
        userId: job.data.userId,
        caseId: parseInt(caseId),
        action: 'file_processed',
        resourceType: 'processing_job',
        resourceId: jobId.toString(),
        details: {
          deviceId: device.id,
          sourcesProcessed: totalSources,
          entitiesExtracted: totalEntities
        }
      });

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
        devicesProcessed: 1,
        entitiesExtracted: totalEntities,
        recordsIndexed: parsedData.dataSources.reduce((sum, source) => sum + source.totalRecords, 0)
      };

    } catch (error) {
      logger.error(`Worker error: Job ${job.id} failed:`, error);

      // Mark job as failed
      await ProcessingJob.update(
        {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        },
        { where: { id: jobId } }
      );

      throw error;
    }
  });

  logger.info('Worker registered: processingQueue.process handler set up successfully');
} catch (error) {
  logger.error('Worker registration failed:', error);
}

logger.info('Processing worker started');
