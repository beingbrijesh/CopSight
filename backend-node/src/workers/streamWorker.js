import streamQueue from '../queues/streamQueue.js';
import { extractEntities } from '../services/ner/entityExtractor.js';
import { indexToAIService } from '../services/search/aiService.js';
import EntityTag from '../models/EntityTag.js';
import Device from '../models/Device.js';
import ProcessingJob from '../models/ProcessingJob.js';
import DataSource from '../models/DataSource.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

logger.info('WORKER FILE LOADED: streamWorker.js imported');

streamQueue.process(async (job) => {
  logger.info(`Stream Worker processing job ID: ${job.id}`);
  try {
    const { caseId, deviceId, artifacts, userId } = job.data;
    
    // 1. Ensure Device exists
    const [device] = await Device.findOrCreate({
      where: { caseId: parseInt(caseId), deviceName: 'Streaming Device' },
      defaults: {
        deviceType: 'Stream',
        extractionDate: new Date()
      }
    });

    // 2. Ensure ProcessingJob exists for streaming
    const [processingJob] = await ProcessingJob.findOrCreate({
      where: { caseId: parseInt(caseId), jobType: 'stream_ingestion' },
      defaults: {
        progress: 100,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      }
    });
    
    const allEntities = [];
    let extractedCount = 0;
    
    for (const artifact of artifacts) {
      const sourceType = artifact.sourceType || 'stream';

      // 3. Ensure DataSource exists and update counts
      const [dataSource] = await DataSource.findOrCreate({
        where: { deviceId: device.id, sourceType: sourceType },
        defaults: {
          appName: sourceType,
          totalRecords: 0,
          processedRecords: 0,
          status: 'completed'
        }
      });
      await dataSource.increment(['totalRecords', 'processedRecords'], { by: 1 });

      const recordData = {
        dataSources: [{
          sourceType: sourceType,
          data: [artifact.data],
          totalRecords: 1
        }]
      };
      
      const extractedEntities = await extractEntities(recordData);
      
      const recordEntities = extractedEntities.map(entity => ({
        caseId: parseInt(caseId),
        evidenceType: sourceType,
        evidenceId: artifact.data?.id?.toString() || `stream_${Date.now()}_${extractedCount}`,
        entityType: entity.type,
        entityValue: entity.value,
        entityMetadata: entity.metadata || {},
        confidenceScore: entity.confidence || 0.8,
        startPosition: entity.startPosition || 0
      }));
      
      allEntities.push(...recordEntities);
      extractedCount++;
    }
    
    if (allEntities.length > 0) {
      await EntityTag.bulkCreate(allEntities);
    }
    
    const sourceTypesMap = {};
    for (const artifact of artifacts) {
      const st = artifact.sourceType || 'stream';
      if (!sourceTypesMap[st]) sourceTypesMap[st] = [];
      sourceTypesMap[st].push(artifact.data);
    }
    
    const dataSources = Object.keys(sourceTypesMap).map(st => ({
      sourceType: st,
      data: sourceTypesMap[st],
      totalRecords: sourceTypesMap[st].length
    }));
    
    const parsedData = { dataSources };
    
    await indexToAIService(parseInt(caseId), parsedData, allEntities);
    
    logger.info(`Successfully streamed and processed ${artifacts.length} artifacts`);
    return { success: true, count: artifacts.length };
  } catch (err) {
    logger.error('Stream processing failed:', err);
    throw err;
  }
});
