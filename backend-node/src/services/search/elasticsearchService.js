import { elasticsearchClient } from '../../config/databases.js';
import logger from '../../config/logger.js';

/**
 * Initialize Elasticsearch indices
 */
export const initializeIndices = async () => {
  try {
    const indices = ['ufdr-messages', 'ufdr-calls', 'ufdr-contacts'];

    for (const index of indices) {
      const exists = await elasticsearchClient.indices.exists({ index });

      if (!exists) {
        await elasticsearchClient.indices.create({
          index,
          body: {
            mappings: {
              properties: {
                caseId: { type: 'integer' },
                deviceId: { type: 'integer' },
                sourceType: { type: 'keyword' },
                content: { type: 'text', analyzer: 'standard' },
                phoneNumber: { type: 'keyword' },
                timestamp: { type: 'date' },
                entities: {
                  type: 'nested',
                  properties: {
                    type: { type: 'keyword' },
                    value: { type: 'keyword' },
                    confidence: { type: 'float' }
                  }
                },
                metadata: { type: 'object', enabled: false }
              }
            }
          }
        });
        logger.info(`Created Elasticsearch index: ${index}`);
      }
    }
  } catch (error) {
    logger.error('Error initializing Elasticsearch indices:', error);
  }
};

/**
 * Index parsed UFDR data to Elasticsearch
 */
export const indexToElasticsearch = async (caseId, parsedData, entities) => {
  try {
    const operations = [];

    // Index messages
    if (parsedData.dataSources) {
      for (const source of parsedData.dataSources) {
        const indexName = getIndexName(source.sourceType);

        for (const record of source.data) {
          // Find entities in this record
          const recordEntities = entities.filter(e =>
            record.content?.includes(e.value) ||
            record.phoneNumber?.includes(e.value)
          );

          // Extract text content from various possible field names
          const content = record.content || record.message || record.body || record.text || '';
          // Extract phone number from various possible field names
          const phoneNumber = record.phoneNumber || record.phone || record.caller || record.receiver || record.sender || null;

          operations.push(
            { index: { _index: indexName } },
            {
              caseId,
              sourceType: source.sourceType,
              appName: source.appName,
              content,
              phoneNumber,
              timestamp: record.timestamp,
              entities: recordEntities,
              metadata: record
            }
          );
        }
      }
    }

    if (operations.length > 0) {
      const result = await elasticsearchClient.bulk({ body: operations });

      if (result.errors) {
        logger.error('Elasticsearch bulk indexing had errors');
      } else {
        logger.info(`Indexed ${operations.length / 2} documents to Elasticsearch`);
      }
    }

    return { indexed: operations.length / 2 };
  } catch (error) {
    logger.error('Error indexing to Elasticsearch:', error);
    throw error;
  }
};

/**
 * Search Elasticsearch
 */
export const searchElasticsearch = async (caseId, query, filters = {}) => {
  try {
    const must = [
      { term: { caseId } },
      {
        multi_match: {
          query,
          fields: ['content^2', 'phoneNumber', 'appName'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      }
    ];

    // Add filters
    if (filters.sourceType) {
      must.push({ term: { sourceType: filters.sourceType } });
    }

    if (filters.dateFrom || filters.dateTo) {
      const range = {};
      if (filters.dateFrom) range.gte = filters.dateFrom;
      if (filters.dateTo) range.lte = filters.dateTo;
      must.push({ range: { timestamp: range } });
    }

    if (filters.phoneNumber) {
      must.push({ term: { phoneNumber: filters.phoneNumber } });
    }

    const result = await elasticsearchClient.search({
      index: 'ufdr-*',
      body: {
        query: { bool: { must } },
        size: filters.limit || 100,
        from: filters.offset || 0,
        sort: [{ timestamp: 'desc' }],
        highlight: {
          fields: {
            content: { pre_tags: ['<mark>'], post_tags: ['</mark>'] }
          }
        }
      }
    });

    return {
      total: result.hits.total.value,
      results: result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        source: hit._source,
        highlight: hit.highlight
      }))
    };
  } catch (error) {
    logger.error('Error searching Elasticsearch:', error);
    throw error;
  }
};

/**
 * Get index name based on source type
 */
const getIndexName = (sourceType) => {
  if (sourceType === 'sms' || sourceType === 'whatsapp' || sourceType === 'telegram') {
    return 'ufdr-messages';
  } else if (sourceType === 'call_log') {
    return 'ufdr-calls';
  } else if (sourceType === 'contacts') {
    return 'ufdr-contacts';
  }
  return 'ufdr-messages';
};

export default {
  initializeIndices,
  indexToElasticsearch,
  searchElasticsearch
};
