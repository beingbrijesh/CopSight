import Device from '../models/Device.js';
import ProcessingJob from '../models/ProcessingJob.js';
import EntityTag from '../models/EntityTag.js';
import logger from '../config/logger.js';
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

    // Decrypt the file if it's AES-256-GCM encrypted
    if (req.body.encrypted === 'true' && req.body.iv && req.body.tag) {
      if (!req.user || !req.user.sessionEncryptionKey) {
        return res.status(401).json({ success: false, message: 'Missing session encryption key for file decryption' });
      }
      
      const crypto = await import('crypto');
      const fs = await import('fs');
      const key = Buffer.from(req.user.sessionEncryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(req.body.iv, 'hex'), key);
      decipher.setAuthTag(Buffer.from(req.body.tag, 'hex'));
      
      const tempPath = file.path + '.tmp';
      
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(file.path);
        const writeStream = fs.createWriteStream(tempPath);
        
        readStream.pipe(decipher).pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });
      
      // Replace encrypted file with decrypted file
      fs.renameSync(tempPath, file.path);
      logger.info(`Decrypted AES-256-GCM file for case ${caseId}`);
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
      jobId: job.id.toString(),
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
