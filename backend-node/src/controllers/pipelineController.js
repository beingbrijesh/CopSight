import { ingestionQueue } from '../queues/jobQueue.js';
import logger from '../config/logger.js';
import path from 'path';

/**
 * Handle File Upload Logic for Streaming Pipeline.
 */
export const uploadForPipeline = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { caseId } = req.body;
    const filePath = path.resolve(req.file.path);

    logger.info(`📥 [UPLOAD] File received: ${req.file.originalname}, Size: ${req.file.size}, Case: ${caseId}`);

    // Create a job in the BullMQ queue
    const job = await ingestionQueue.add('forensic-ingestion', {
      filePath,
      caseId,
      userId: req.user?.id || 1, // Fallback if no user context
      originalName: req.file.originalname
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Forensic file accepted. Processing in background streaming pipeline.'
      }
    });

  } catch (error) {
    logger.error('Upload error in pipeline controller:', error);
    res.status(500).json({ success: false, message: 'Failed to queue file for ingestion' });
  }
};
