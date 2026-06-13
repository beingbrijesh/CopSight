import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { decryptPayload } from '../middleware/encryptionMiddleware.js';
import streamQueue from '../queues/streamQueue.js';
import logger from '../config/logger.js';
import Case from '../models/Case.js';

const router = express.Router();

router.use(authenticate);
router.use(decryptPayload);

// Stream artifacts
router.post('/stream/case/:caseId', async (req, res) => {
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
    
    // Push chunk to the streamQueue
    const job = await streamQueue.add({
      caseId,
      deviceId,
      artifacts,
      userId: req.user.id
    });
    
    res.status(202).json({
      success: true,
      message: `Stream chunk queued successfully`,
      jobId: job.id
    });
  } catch (err) {
    logger.error('Error queuing stream chunk:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
