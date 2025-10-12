import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = express.Router();

// Webhook endpoint for external tool integrations
router.post('/webhook/:toolName/:eventType', async (req, res) => {
  try {
    const { toolName, eventType } = req.params;
    const payload = req.body;

    // Log the webhook event
    logger.info(`Webhook received from ${toolName}: ${eventType}`, {
      toolName,
      eventType,
      payloadSize: JSON.stringify(payload).length,
      headers: req.headers
    });

    // Validate webhook signature if provided
    if (req.headers['x-signature']) {
      const isValid = validateWebhookSignature(req.headers['x-signature'], payload, toolName);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
    }

    // Process webhook based on tool and event type
    const result = await processWebhookEvent(toolName, eventType, payload);

    res.json({
      success: true,
      message: `Webhook processed successfully`,
      result
    });

  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// API endpoint for external tools to query case data
router.get('/cases/:caseId/export', authenticate, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { format = 'json', includeEvidence = 'false' } = req.query;

    // Check if user has access to this case
    const hasAccess = await checkCaseAccess(req.user.id, parseInt(caseId));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this case'
      });
    }

    // Export case data in requested format
    const exportData = await exportCaseData(parseInt(caseId), format, includeEvidence === 'true');

    if (format === 'json') {
      res.json({
        success: true,
        data: exportData
      });
    } else if (format === 'xml') {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="case_${caseId}_export.xml"`);
      res.send(exportData);
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format. Use json or xml.'
      });
    }

  } catch (error) {
    logger.error('Case export error:', error);
    res.status(500).json({
      success: false,
      message: 'Case export failed'
    });
  }
});

// API endpoint for external tools to submit evidence
router.post('/evidence/submit', authenticate, async (req, res) => {
  try {
    const {
      caseId,
      toolName,
      toolVersion,
      evidenceType,
      evidenceData,
      metadata = {}
    } = req.body;

    if (!caseId || !toolName || !evidenceType || !evidenceData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: caseId, toolName, evidenceType, evidenceData'
      });
    }

    // Check case access
    const hasAccess = await checkCaseAccess(req.user.id, caseId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this case'
      });
    }

    // Submit evidence to the system
    const result = await submitExternalEvidence({
      caseId,
      toolName,
      toolVersion,
      evidenceType,
      evidenceData,
      metadata,
      submittedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Evidence submitted successfully',
      evidenceId: result.evidenceId
    });

  } catch (error) {
    logger.error('Evidence submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Evidence submission failed'
    });
  }
});

// API endpoint for external tools to get system status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    supportedTools: [
      'cellebrite',
      'magnet',
      'oxygen',
      'msab',
      'ufed'
    ],
    supportedFormats: ['json', 'xml'],
    timestamp: new Date().toISOString()
  });
});

// API endpoint for external tools to register
router.post('/register-tool', authenticate, async (req, res) => {
  try {
    const {
      toolName,
      toolVersion,
      description,
      webhookUrl,
      apiKey
    } = req.body;

    if (!toolName || !toolVersion) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: toolName, toolVersion'
      });
    }

    // Register the external tool
    const result = await registerExternalTool({
      toolName,
      toolVersion,
      description,
      webhookUrl,
      apiKey: apiKey || generateApiKey(),
      registeredBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Tool registered successfully',
      toolId: result.toolId,
      apiKey: result.apiKey
    });

  } catch (error) {
    logger.error('Tool registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Tool registration failed'
    });
  }
});

// Helper functions

function validateWebhookSignature(signature, payload, toolName) {
  // Implement webhook signature validation for different tools
  // This is a placeholder - implement actual validation logic
  return true;
}

async function processWebhookEvent(toolName, eventType, payload) {
  // Process different types of webhook events from external tools
  logger.info(`Processing ${toolName} webhook: ${eventType}`);

  switch (eventType) {
    case 'case_completed':
      return await handleCaseCompletedWebhook(toolName, payload);

    case 'evidence_extracted':
      return await handleEvidenceExtractedWebhook(toolName, payload);

    case 'analysis_complete':
      return await handleAnalysisCompleteWebhook(toolName, payload);

    default:
      logger.warn(`Unknown webhook event type: ${eventType}`);
      return { status: 'ignored', reason: 'unknown_event_type' };
  }
}

async function handleCaseCompletedWebhook(toolName, payload) {
  // Handle case completion notifications from external tools
  const { caseId, status, results } = payload;

  logger.info(`${toolName} reported case ${caseId} completion`);

  // Update case status, create alerts, etc.
  return {
    status: 'processed',
    caseId,
    actions: ['status_updated', 'alert_created']
  };
}

async function handleEvidenceExtractedWebhook(toolName, payload) {
  // Handle evidence extraction notifications
  const { caseId, evidenceCount, evidenceTypes } = payload;

  logger.info(`${toolName} extracted ${evidenceCount} evidence items for case ${caseId}`);

  // Process and store evidence
  return {
    status: 'processed',
    caseId,
    evidenceProcessed: evidenceCount
  };
}

async function handleAnalysisCompleteWebhook(toolName, payload) {
  // Handle analysis completion notifications
  const { caseId, analysisType, findings } = payload;

  logger.info(`${toolName} completed ${analysisType} analysis for case ${caseId}`);

  // Store analysis results
  return {
    status: 'processed',
    caseId,
    analysisStored: true
  };
}

async function checkCaseAccess(userId, caseId) {
  // Check if user has access to the case
  // This is a placeholder - implement actual access control
  return true;
}

async function exportCaseData(caseId, format, includeEvidence) {
  // Export case data in requested format
  // This is a placeholder - implement actual data export
  const mockData = {
    caseId,
    caseNumber: `CASE-${caseId}`,
    status: 'active',
    createdAt: new Date().toISOString(),
    evidence: includeEvidence ? [] : undefined
  };

  if (format === 'xml') {
    // Convert to XML format
    return `<case id="${caseId}"><caseNumber>CASE-${caseId}</caseNumber><status>active</status></case>`;
  }

  return mockData;
}

async function submitExternalEvidence(evidenceData) {
  // Submit evidence from external tools
  // This is a placeholder - implement actual evidence storage
  const evidenceId = Date.now(); // Simple ID generation

  logger.info(`Evidence submitted from ${evidenceData.toolName} for case ${evidenceData.caseId}`);

  return {
    evidenceId,
    status: 'submitted'
  };
}

async function registerExternalTool(toolData) {
  // Register external forensic tools
  // This is a placeholder - implement actual tool registration
  const toolId = Date.now();

  logger.info(`Tool registered: ${toolData.toolName} v${toolData.toolVersion}`);

  return {
    toolId,
    apiKey: toolData.apiKey
  };
}

function generateApiKey() {
  // Generate secure API key for external tools
  return 'api_' + Math.random().toString(36).substring(2, 15);
}

export default router;
