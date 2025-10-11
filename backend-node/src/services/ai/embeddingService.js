import { Ollama } from 'ollama';
import logger from '../../config/logger.js';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

/**
 * Generate text embedding using Ollama
 */
export const generateEmbedding = async (text) => {
  try {
    const response = await ollama.embeddings({
      model: EMBEDDING_MODEL,
      prompt: text
    });
    
    return response.embedding;
  } catch (error) {
    logger.error('Error generating embedding:', error);
    // Fallback: return zero vector
    return new Array(384).fill(0);
  }
};

/**
 * Generate embeddings for multiple texts
 */
export const generateEmbeddings = async (texts) => {
  try {
    const embeddings = await Promise.all(
      texts.map(text => generateEmbedding(text))
    );
    return embeddings;
  } catch (error) {
    logger.error('Error generating embeddings:', error);
    throw error;
  }
};

export default {
  generateEmbedding,
  generateEmbeddings
};
