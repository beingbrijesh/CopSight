import streamQueue from '../queues/streamQueue.js';
import { extractEntities } from '../services/ner/entityExtractor.js';
import { indexToElasticsearch } from '../services/search/elasticsearchService.js';
import { indexToAIService } from '../services/search/aiService.js';
import EntityTag from '../models/EntityTag.js';
import Device from '../models/Device.js';
import ProcessingJob from '../models/ProcessingJob.js';
import DataSource from '../models/DataSource.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

// Simple CSV parser supporting quotes
function parseCSV(content) {
  if (!content) return [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] !== undefined ? values[idx] : null;
    });
    records.push(record);
  }
  return records;
}

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

      let recordEntities = [];
      
      // If it's an uploaded file (media, backups, large CSV)
      if (artifact.data && artifact.data.method === 'file_upload') {
        const filePath = artifact.data.filePath;
        const mimeType = artifact.data.mimeType || '';
        
        // Check if it's media
        if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || filePath.endsWith('.pdf')) {
          try {
            const FormData = (await import('form-data')).default;
            const fs = await import('fs');
            const axios = (await import('axios')).default;
            
            const form = new FormData();
            form.append('case_id', caseId.toString());
            form.append('device_id', deviceId.toString());
            form.append('file', fs.createReadStream(filePath), artifact.data.fileName);
            
            const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
            await axios.post(`${aiServiceUrl}/api/v1/ingestion/media`, form, {
              headers: form.getHeaders()
            });
            logger.info(`Forwarded media ${artifact.data.fileName} to AI Service`);
          } catch (err) {
            logger.error(`Failed to forward media to AI Service: ${err.message}`);
          }
        } else {
          // Handle other files like CSVs or backups locally if needed
          logger.info(`Received file upload for ${artifact.data.fileName}, stored at ${filePath}`);
        }
      } else {
        // Standard streaming JSON payload
        let parsedRecords = [artifact.data];
        
        // If it's a CSV file, parse it into individual records
        if (artifact.data.content && artifact.data.source_path && artifact.data.source_path.toLowerCase().endsWith('.csv')) {
           parsedRecords = parseCSV(artifact.data.content);
        }
        
        const recordData = {
          dataSources: [{
            sourceType: sourceType,
            data: parsedRecords,
            totalRecords: parsedRecords.length
          }]
        };
        
        const extractedEntities = await extractEntities(recordData);
        
        recordEntities = extractedEntities.map((entity, idx) => ({
          caseId: parseInt(caseId),
          evidenceType: sourceType,
          evidenceId: artifact.data?.id?.toString() || `stream_${Date.now()}_${extractedCount}_${idx}`,
          entityType: entity.type,
          entityValue: entity.value,
          entityMetadata: entity.metadata || {},
          confidenceScore: entity.confidence || 0.8,
          startPosition: entity.startPosition || 0
        }));
      }
      
      
      
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
    
    try {
      await indexToElasticsearch(parseInt(caseId), parsedData, allEntities);
      logger.info('Elasticsearch indexing for stream completed');
    } catch (error) {
      logger.error('Elasticsearch indexing for stream failed:', error);
    }
    
    await indexToAIService(parseInt(caseId), parsedData, allEntities);
    
    logger.info(`Successfully streamed and processed ${artifacts.length} artifacts`);
    return { success: true, count: artifacts.length };
  } catch (err) {
    logger.error('Stream processing failed:', err);
    throw err;
  }
});
