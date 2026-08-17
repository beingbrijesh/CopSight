import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { decryptPayload } from '../middleware/encryptionMiddleware.js';
import streamQueue from '../queues/streamQueue.js';
import logger from '../config/logger.js';
import Case from '../models/Case.js';
import ProcessingJob from '../models/ProcessingJob.js';

import upload from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

// Stream artifacts (JSON payload with E2E encryption)
router.post('/stream/case/:caseId', decryptPayload, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { deviceId, artifacts } = req.body;
    
    // Authorization Check: the case must be assigned to the logged-in IO
    const targetCase = await Case.findByPk(caseId);
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    if (targetCase.assignedTo !== req.user.id && req.user.role !== 'admin' && targetCase.supervisorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Not assigned to this case' });
    }
    
    if (!artifacts || !Array.isArray(artifacts)) {
      return res.status(400).json({ success: false, message: 'Invalid payload: artifacts array required' });
    }

    // Create ProcessingJob in database so IO dashboard shows active and recent jobs
    const processingJob = await ProcessingJob.create({
      caseId: parseInt(caseId),
      jobType: 'stream_extraction',
      status: 'processing',
      progress: 10,
      startedAt: new Date()
    });

    if (targetCase.status === 'active') {
      await targetCase.update({ status: 'processing' });
    }
    
    // Push chunk to the streamQueue with processingJobId
    const job = await streamQueue.add({
      processingJobId: processingJob.id,
      caseId: parseInt(caseId),
      deviceId,
      artifacts,
      userId: req.user.id
    });
    
    res.status(202).json({
      success: true,
      message: `Stream chunk queued successfully`,
      jobId: processingJob.id
    });
  } catch (err) {
    logger.error('Error queuing stream chunk:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Upload artifact file (media, documents, large CSVs)
router.post('/upload/case/:caseId', upload.single('file'), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { deviceId, sourceType } = req.body;
    
    // Authorization Check
    const targetCase = await Case.findByPk(caseId);
    if (!targetCase) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    if (targetCase.assignedTo !== req.user.id && req.user.role !== 'admin' && targetCase.supervisorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Create ProcessingJob in database
    const processingJob = await ProcessingJob.create({
      caseId: parseInt(caseId),
      jobType: 'artifact_upload',
      status: 'processing',
      progress: 10,
      startedAt: new Date()
    });

    if (targetCase.status === 'active') {
      await targetCase.update({ status: 'processing' });
    }

    // Push the file processing job to the streamQueue
    const job = await streamQueue.add({
      processingJobId: processingJob.id,
      caseId: parseInt(caseId),
      deviceId,
      userId: req.user.id,
      artifacts: [{
        sourceType: sourceType || 'upload',
        data: {
          id: `file_${Date.now()}`,
          fileName: req.file.originalname,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
          method: 'file_upload'
        }
      }]
    });
    
    res.status(202).json({
      success: true,
      message: 'File uploaded and queued for processing',
      jobId: processingJob.id,
      filePath: req.file.path
    });
  } catch (err) {
    logger.error('Error handling file upload:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
