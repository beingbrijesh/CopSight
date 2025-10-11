import { milvusClient, initMilvus } from '../../config/databases.js';
import { generateEmbedding } from '../ai/embeddingService.js';
import logger from '../../config/logger.js';

const COLLECTION_NAME = 'ufdr_embeddings';
const VECTOR_DIM = 384; // MiniLM embedding dimension

/**
 * Initialize Milvus collection
 */
export const initializeMilvusCollection = async () => {
  try {
    // Initialize Milvus if not already done
    if (!milvusClient) {
      const client = initMilvus();
      if (!client) {
        logger.warn('Milvus not available, skipping collection initialization');
        return;
      }
    }
    
    const hasCollection = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME
    });
    
    if (!hasCollection.value) {
      await milvusClient.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          {
            name: 'id',
            data_type: 'Int64',
            is_primary_key: true,
            autoID: true
          },
          {
            name: 'case_id',
            data_type: 'Int64'
          },
          {
            name: 'source_type',
            data_type: 'VarChar',
            max_length: 50
          },
          {
            name: 'content',
            data_type: 'VarChar',
            max_length: 5000
          },
          {
            name: 'embedding',
            data_type: 'FloatVector',
            dim: VECTOR_DIM
          },
          {
            name: 'timestamp',
            data_type: 'Int64'
          }
        ]
      });
      
      // Create index for vector search
      await milvusClient.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: { nlist: 1024 }
      });
      
      logger.info('Milvus collection created');
    }
    
    // Load collection into memory
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME
    });
    
  } catch (error) {
    logger.error('Error initializing Milvus collection:', error);
  }
};

/**
 * Index data to Milvus with embeddings
 */
export const indexToMilvus = async (caseId, parsedData) => {
  // Skip if Milvus is not available
  if (!milvusClient) {
    logger.info('Milvus not available, skipping indexing');
    return { indexed: 0 };
  }
  
  try {
    const records = [];
    
    // Extract text content from all sources
    if (parsedData.dataSources) {
      for (const source of parsedData.dataSources) {
        for (const record of source.data) {
          if (record.content && record.content.trim().length > 0) {
            records.push({
              case_id: caseId,
              source_type: source.sourceType,
              content: record.content.substring(0, 5000), // Limit length
              timestamp: new Date(record.timestamp).getTime(),
              originalRecord: record
            });
          }
        }
      }
    }
    
    if (records.length === 0) {
      logger.info('No text content to index to Milvus');
      return { indexed: 0 };
    }
    
    // Generate embeddings in batches
    const batchSize = 50;
    const embeddings = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const texts = batch.map(r => r.content);
      const batchEmbeddings = await Promise.all(
        texts.map(text => generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
      
      logger.info(`Generated embeddings for batch ${Math.floor(i / batchSize) + 1}`);
    }
    
    // Insert into Milvus
    const insertData = records.map((record, idx) => ({
      case_id: record.case_id,
      source_type: record.source_type,
      content: record.content,
      embedding: embeddings[idx],
      timestamp: record.timestamp
    }));
    
    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: insertData
    });
    
    logger.info(`Indexed ${records.length} records to Milvus`);
    return { indexed: records.length };
    
  } catch (error) {
    logger.error('Error indexing to Milvus:', error);
    throw error;
  }
};

/**
 * Semantic search using Milvus
 */
export const semanticSearch = async (caseId, query, limit = 20) => {
  // Skip if Milvus is not available
  if (!milvusClient) {
    logger.info('Milvus not available, skipping semantic search');
    return [];
  }
  
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Search Milvus
    const results = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vectors: [queryEmbedding],
      search_params: {
        anns_field: 'embedding',
        topk: limit,
        metric_type: 'L2',
        params: { nprobe: 10 }
      },
      output_fields: ['case_id', 'source_type', 'content', 'timestamp'],
      filter: `case_id == ${caseId}`
    });
    
    return results[0]?.map(result => ({
      id: result.id,
      score: result.score,
      content: result.content,
      sourceType: result.source_type,
      timestamp: new Date(result.timestamp)
    })) || [];
    
  } catch (error) {
    logger.error('Error performing semantic search:', error);
    throw error;
  }
};

export default {
  initializeMilvusCollection,
  indexToMilvus,
  semanticSearch
};
