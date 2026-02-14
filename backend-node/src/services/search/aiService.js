import axios from 'axios';
import logger from '../../config/logger.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8005';

/**
 * Index parsed UFDR data to AI service (ChromaDB)
 */
export const indexToAIService = async (caseId, parsedData, entities) => {
  try {
    const payload = {
      case_id: caseId,
      data_sources: parsedData.dataSources || [],
      entities: entities || []
    };

    const response = await axios.post(`${AI_SERVICE_URL}/api/index/case/${caseId}`, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout (reduced from 30)
    });

    if (response.data.success) {
      logger.info(`Indexed ${response.data.indexed_count || 0} documents to AI service for case ${caseId}`);
      return { indexed: response.data.indexed_count || 0 };
    } else {
      throw new Error('AI service indexing failed');
    }
  } catch (error) {
    logger.error('Error indexing to AI service:', error.message);
    // Don't throw error - allow processing to continue even if AI indexing fails
    return { indexed: 0 };
  }
};
