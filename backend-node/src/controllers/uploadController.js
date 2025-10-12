import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import DataSource from '../models/DataSource.js';
import Device from '../models/Device.js';
import ProcessingJob from '../models/ProcessingJob.js';
import Case from '../models/Case.js';
import EntityTag from '../models/EntityTag.js';
import logger from '../config/logger.js';
import ufdrParser from '../services/parser/ufdrParser.js';
import processingQueue from '../queues/processingQueue.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Upload UFDR file and start processing
 */
export const uploadUFDRFile = async (req, res) => {
  try {
    const { caseId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    logger.info(`File uploaded for case ${caseId}: ${file.filename}`);

    // Create processing job
    const job = await ProcessingJob.create({
      caseId: parseInt(caseId),
      jobType: 'parse_ufdr',
      status: 'processing',
      progress: 0
    });

    // Log upload
    await AuditLog.create({
      userId: req.user.id,
      caseId: parseInt(caseId),
      action: 'file_uploaded',
      resourceType: 'upload',
      resourceId: file.filename,
      details: {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    // Add job to processing queue
    await processingQueue.add('parse-ufdr', {
      jobId: job.id,
      caseId: parseInt(caseId),
      filePath: file.path,
      fileName: file.originalname,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'File uploaded successfully. Processing started.',
      data: {
        jobId: job.id,
        filename: file.originalname,
        size: file.size
      }
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
};

/**
 * Background processing of UFDR file
 */
async function processUFDRFile(filePath, caseId, jobId, userId) {
  try {
    logger.info(`Starting background processing for job ${jobId}`);

    // Update job status
    await ProcessingJob.update(
      { status: 'processing', progress: 10, startedAt: new Date() },
      { where: { id: jobId } }
    );

    // Parse file based on extension
    const ext = path.extname(filePath).toLowerCase();
    let parsedData;

    if (ext === '.xml' || ext === '.ufd' || ext === '.ufdr') {
      parsedData = await ufdrParser.parseUFDRFile(filePath);
    } else if (ext === '.json') {
      parsedData = await ufdrParser.parseJSONFile(filePath);
    } else {
      throw new Error('Unsupported file format');
    }

    await ProcessingJob.update(
      { progress: 30 },
      { where: { id: jobId } }
    );

    // Create device record
    const device = await Device.create({
      caseId: parseInt(caseId),
      ...parsedData.deviceInfo
    });

    logger.info(`Device created: ${device.id}`);

    await ProcessingJob.update(
      { progress: 40 },
      { where: { id: jobId } }
    );

    // Process each data source
    const totalSources = parsedData.dataSources.length;
    let processedSources = 0;

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
        // Extract entities from text content
        const textContent = record.content || record.message || record.body || '';
        
        if (textContent) {
          const recordEntities = nerEngine.extractEntities(
            textContent,
            source.sourceType,
            record.id
          );

          // Add case ID to entities
          recordEntities.forEach(entity => {
            entity.caseId = parseInt(caseId);
          });

          entities.push(...recordEntities);
        }

        processedRecords++;

        // Update progress every 100 records
        if (processedRecords % 100 === 0) {
          await DataSource.update(
            { processedRecords },
            { where: { id: dataSource.id } }
          );
        }
      }

      // Save all entities for this source
      if (entities.length > 0) {
        await EntityTag.bulkCreate(entities);
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
      const progress = 40 + Math.floor((processedSources / totalSources) * 50);
      await ProcessingJob.update(
        { progress },
        { where: { id: jobId } }
      );
    }

    // Mark job as completed
    await ProcessingJob.update(
      {
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      },
      { where: { id: jobId } }
    );

    // Update case status
    await Case.update(
      { status: 'ready_for_analysis' },
      { where: { id: caseId } }
    );

    // Log completion
    await AuditLog.create({
      userId,
      caseId: parseInt(caseId),
      action: 'file_processed',
      resourceType: 'processing_job',
      resourceId: jobId.toString(),
      details: {
        deviceId: device.id,
        sourcesProcessed: totalSources,
        entitiesExtracted: await EntityTag.count({ where: { caseId } })
      }
    });

    auditLogger.info('UFDR file processed successfully', {
      jobId,
      caseId,
      deviceId: device.id,
      sourcesProcessed: totalSources
    });

  } catch (error) {
    logger.error('Processing error:', error);

    // Mark job as failed
    await ProcessingJob.update(
      {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      },
      { where: { id: jobId } }
    );

    // Log error
    await AuditLog.create({
      userId,
      caseId: parseInt(caseId),
      action: 'file_processing_failed',
      resourceType: 'processing_job',
      resourceId: jobId.toString(),
      details: {
        error: error.message
      }
    });
  }
}

/**
 * Get processing job status
 */
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await ProcessingJob.findByPk(jobId, {
      include: [
        {
          association: 'case',
          attributes: ['id', 'caseNumber', 'title']
        }
      ]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: { job }
    });
  } catch (error) {
    logger.error('Get job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status'
    });
  }
};

/**
 * Get case processing summary
 */
export const getCaseProcessingSummary = async (req, res) => {
  try {
    const { caseId } = req.params;

    const devices = await Device.findAll({
      where: { caseId },
      include: [
        {
          association: 'dataSources',
          attributes: ['id', 'sourceType', 'appName', 'totalRecords', 'processedRecords', 'status']
        }
      ]
    });

    const jobs = await ProcessingJob.findAll({
      where: { caseId },
      order: [['created_at', 'DESC']]
    });

    const entityCount = await EntityTag.count({ where: { caseId } });

    const entityTypes = await EntityTag.findAll({
      where: { caseId },
      attributes: [
        'entityType',
        [EntityTag.sequelize.fn('COUNT', EntityTag.sequelize.col('id')), 'count']
      ],
      group: ['entityType']
    });

    res.json({
      success: true,
      data: {
        devices,
        jobs,
        entityCount,
        entityTypes: entityTypes.map(et => ({
          type: et.entityType,
          count: parseInt(et.get('count'))
        }))
      }
    });
  } catch (error) {
    logger.error('Get processing summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get processing summary'
    });
  }
};
