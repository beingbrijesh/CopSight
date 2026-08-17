import { elasticsearchClient } from '../../config/databases.js';
import logger from '../../config/logger.js';

/**
 * Initialize Elasticsearch indices
 */
export const initializeIndices = async () => {
  try {
    const indices = ['copsight-messages', 'copsight-calls', 'copsight-contacts'];

    for (const index of indices) {
      const { body: exists } = await elasticsearchClient.indices.exists({ index });

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
                indexedAt: { type: 'date' },
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
 * Index parsed CopSight AI data to Elasticsearch
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
          const content = record.content || record.message || record.body || record.text || record.msg || record.snippet || '';
          const phoneNumber = record.phoneNumber || record.phone || record.address || record.caller || record.receiver || record.sender || record.recipient || null;
          const timestamp = record.timestamp || record.date || record.created_at || record.datetime || new Date().toISOString();
          const appName = record.appName || record.app || record.channel || source.appName || source.sourceType || 'Chat';

          const recordEntities = entities.filter(e =>
            (content && typeof content === 'string' && content.includes(e.value)) ||
            (phoneNumber && typeof phoneNumber === 'string' && phoneNumber.includes(e.value))
          );

          operations.push(
            { index: { _index: indexName } },
            {
              caseId,
              sourceType: source.sourceType,
              appName,
              content,
              phoneNumber,
              timestamp,
              entities: recordEntities,
              indexedAt: new Date().toISOString(),
              metadata: record
            }
          );
        }
      }
    }

    if (operations.length > 0) {
      const { body: result } = await elasticsearchClient.bulk({ body: operations });

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
      { term: { caseId } }
    ];

    if (query && query.trim() !== '') {
      must.push({
        multi_match: {
          query,
          fields: ['content^2', 'phoneNumber', 'appName'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    } else {
      must.push({ match_all: {} });
    }

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

    const { body: result } = await elasticsearchClient.search({
      index: 'copsight-*,ufdr-*',
      body: {
        query: { bool: { must } },
        size: filters.limit || 1000,
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
      total: result.hits?.total?.value ?? (typeof result.hits?.total === 'number' ? result.hits.total : 0),
      results: (result.hits?.hits || []).map(hit => ({
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
  const st = (sourceType || '').toLowerCase();
  if (st.includes('call') || st.includes('phone_call')) {
    return 'copsight-calls';
  } else if (st.includes('contact')) {
    return 'copsight-contacts';
  }
  return 'copsight-messages';
};

export default {
  initializeIndices,
  indexToElasticsearch,
  searchElasticsearch
};
