/**
 * Analysis Routes — proxy to the Python AI service (port 8005)
 *
 * These routes are a thin authenticated pass-through so the frontend
 * can call /api/analysis/* with a JWT token and have it forwarded to
 * the AI FastAPI service, which is not publicly exposed.
 */

import express from 'express';
import axios from 'axios';
import logger from '../config/logger.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8005';
const ALLOWED_ROLES = ['admin', 'supervisor', 'investigating_officer'];

// Shared axios instance toward the AI service
const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * @route  POST /api/analysis/detect-anomalies
 * @desc   Run full anomaly detection (Isolation Forest + XGBoost + DNN + LSTM-AE)
 * @access Private
 * @body   { caseId: number, analysisType?: string }
 */
router.post(
  '/detect-anomalies',
  authenticate,
  authorize(...ALLOWED_ROLES),
  async (req, res) => {
    const { caseId, analysisType } = req.body;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'caseId is required',
      });
    }

    logger.info(`[Analysis] Running anomaly detection for case ${caseId} (by user ${req.user?.id})`);

    try {
      const response = await aiClient.post('/api/analysis/detect-anomalies', {
        case_id: String(caseId),
        analysis_type: analysisType || 'all',
      });

      return res.json({
        success: true,
        ...response.data,
      });
    } catch (error) {
      const isDown = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      const status = isDown ? 503 : (error.response?.status || 503);
      const message = isDown
        ? 'The AI Analysis engine is currently warming up or unreachable. Please try again in a few moments.'
        : 'Analysis could not be completed at this time. Please try again later.';

      logger.error(`[Analysis] detect-anomalies failed: ${error.message}`);
      return res.status(status).json({ success: false, message });
    }
  }
);

/**
 * @route  POST /api/analysis/detect-patterns
 * @desc   Proxy pattern detection to AI service
 * @access Private
 */
router.post(
  '/detect-patterns',
  authenticate,
  authorize(...ALLOWED_ROLES),
  async (req, res) => {
    const { caseId, analysisType } = req.body;
    try {
      const response = await aiClient.post('/api/analysis/detect-patterns', {
        case_id: String(caseId),
        analysis_type: analysisType || 'suspicious',
      });
      return res.json({ success: true, ...response.data });
    } catch (error) {
      const isDown = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      logger.error(`[Analysis] detect-patterns failed: ${error.message}`);
      return res.status(isDown ? 503 : (error.response?.status || 503)).json({
        success: false,
        message: isDown
          ? 'The AI Analysis engine is currently warming up or unreachable. Please try again in a few moments.'
          : 'Pattern detection could not be completed at this time. Please try again later.',
      });
    }
  }
);

/**
 * @route  POST /api/analysis/case-summary
 * @desc   Proxy case summary to AI service
 * @access Private
 */
router.post(
  '/case-summary',
  authenticate,
  authorize(...ALLOWED_ROLES),
  async (req, res) => {
    const { caseId } = req.body;
    try {
      const response = await aiClient.get(`/api/analysis/summary/${caseId}`);
      return res.json({ success: true, ...response.data });
    } catch (error) {
      const isDown = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      logger.error(`[Analysis] case-summary failed: ${error.message}`);
      return res.status(isDown ? 503 : (error.response?.status || 503)).json({
        success: false,
        message: isDown
          ? 'The AI Analysis engine is currently warming up or unreachable. Please try again in a few moments.'
          : 'Case summary could not be generated at this time. Please try again later.',
      });
    }
  }
);

/**
 * @route  POST /api/analysis/predictive-analysis
 * @desc   Proxy predictive analysis to AI service
 * @access Private
 */
router.post(
  '/predictive-analysis',
  authenticate,
  authorize(...ALLOWED_ROLES),
  async (req, res) => {
    const { caseId } = req.body;
    try {
      const response = await aiClient.post('/api/analysis/predictive-analysis', {
        case_id: String(caseId),
      });
      return res.json({ success: true, ...response.data });
    } catch (error) {
      const isDown = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
      logger.error(`[Analysis] predictive-analysis failed: ${error.message}`);
      return res.status(isDown ? 503 : (error.response?.status || 503)).json({
        success: false,
        message: isDown
          ? 'The AI Analysis engine is currently warming up or unreachable. Please try again in a few moments.'
          : 'Predictive analysis could not be completed at this time. Please try again later.',
      });
    }
  }
);

export default router;
