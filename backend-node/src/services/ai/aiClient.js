import axios from 'axios';
import logger from '../../config/logger.js';
import crypto from 'crypto';

/**
 * In-memory TTL cache for AI responses.
 * Prevents redundant Ollama calls for the same entity queries
 * within a session. Keyed by caseId + normalized queryText.
 * 
 * Design: Uses Map with a WeakRef-style TTL check on access.
 * Falls back silently if entry is stale.
 */
class QueryCache {
  constructor(ttlMs = 30 * 60 * 1000) { // 30 minutes default
    this.store = new Map();
    this.ttlMs = ttlMs;
  }

  _makeKey(caseId, queryText) {
    const normalized = queryText.trim().toLowerCase();
    return `${caseId}::${crypto.createHash('md5').update(normalized).digest('hex')}`;
  }

  get(caseId, queryText) {
    const key = this._makeKey(caseId, queryText);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    logger.debug(`[QueryCache] HIT for key: ${key.slice(0, 20)}...`);
    return entry.value;
  }

  set(caseId, queryText, value) {
    const key = this._makeKey(caseId, queryText);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
    logger.debug(`[QueryCache] SET key: ${key.slice(0, 20)}... (${this.store.size} total entries)`);
  }

  invalidateCase(caseId) {
    const prefix = `${caseId}::`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const queryCache = new QueryCache();

/**
 * Client for Python AI Service (FastAPI at port 8005)
 */
class AIClient {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8005';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 130000, // 130s — slightly above the 120s Ollama hard cap
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Execute natural language query (non-streaming, cached)
   */
  async executeQuery(caseId, query, userId, sessionId = null) {
    try {
      // 1. Check cache first
      const cached = queryCache.get(caseId, query);
      if (cached) {
        logger.info(`[AIClient] Returning cached response for case ${caseId}`);
        return cached;
      }

      // 2. Call AI service
      const response = await this.client.post('/api/query/execute', {
        case_id: caseId,
        query,
        user_id: userId,
        session_id: sessionId
      });

      // 3. Cache successful responses
      queryCache.set(caseId, query, response.data);
      return response.data;
    } catch (error) {
      logger.error('AI query execution failed:', error.message);
      throw new Error('Failed to execute AI query');
    }
  }

  /**
   * Proxy a streaming SSE query from the Python AI service to an Express response.
   * This keeps the Node.js server as a transparent proxy for the SSE stream.
   * 
   * @param {number} caseId
   * @param {string} query
   * @param {number} userId
   * @param {import('express').Response} res - Express response to pipe into
   * @param {string} sessionId
   */
  async streamQuery(caseId, query, userId, res, sessionId = null) {
    // Check cache first — if we have a cached result, replay it as an SSE stream
    const cached = queryCache.get(caseId, query);
    if (cached) {
      logger.info(`[AIClient] Replaying cached SSE response for case ${caseId}`);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // emit thinking briefly, then stream the full cached answer
      res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking', message: 'Loading cached analysis...' })}\n\n`);
      await new Promise(r => setTimeout(r, 100));

      const answer = cached.answer || 'No analysis available.';
      const words = answer.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
        res.write(`data: ${JSON.stringify({ type: 'token', token: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 5)); // faster replay from cache
      }

      res.write(`data: ${JSON.stringify({
        type: 'metadata',
        evidence: cached.evidence || [],
        findings: cached.findings || [],
        confidence: cached.confidence || 0.0,
        query_components: cached.query_components || {},
        total_results: cached.total_results || 0,
        query_id: cached.query_id || 0,
        has_relationships: false,
        from_cache: true
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Set SSE headers before opening the upstream connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Immediately tell the client we are alive
    res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking', message: 'Connecting to AI service...' })}\n\n`);

    try {
      const upstream = await axios.post(
        `${this.baseURL}/api/query/stream`,
        { case_id: caseId, query, user_id: userId, session_id: sessionId },
        {
          responseType: 'stream',
          timeout: 130000
        }
      );

      // Buffer for accumulating the full answer (for caching)
      let fullAnswer = '';
      let metadataPayload = null;
      let buffer = '';

      upstream.data.on('data', (chunk) => {
        const text = chunk.toString();
        buffer += text;

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            // Cache the final result before ending
            if (metadataPayload) {
              queryCache.set(caseId, query, {
                answer: fullAnswer,
                evidence: metadataPayload.evidence || [],
                findings: metadataPayload.findings || [],
                confidence: metadataPayload.confidence || 0.0,
                query_components: metadataPayload.query_components || {},
                total_results: metadataPayload.total_results || 0,
                query_id: metadataPayload.query_id || 0
              });
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'token') fullAnswer += parsed.token;
            if (parsed.type === 'metadata') metadataPayload = parsed;
            res.write(`data: ${raw}\n\n`);
          } catch {
            // Non-JSON line, pass through as-is
            res.write(`data: ${raw}\n\n`);
          }
        }
      });

      upstream.data.on('error', (err) => {
        logger.error('[AIClient] Upstream SSE stream error:', err.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Connection to AI service lost. Please try again.' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      });

      upstream.data.on('end', () => {
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      });

      // Handle client disconnect
      res.on('close', () => {
        upstream.data.destroy();
        logger.debug('[AIClient] Client disconnected, upstream stream destroyed');
      });

    } catch (error) {
      logger.error(`[AIClient] Failed to open upstream SSE stream to ${this.baseURL}/api/query/stream:`, error.message);
      if (!res.writableEnded) {
        const isUnavailable = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
        const msg = isUnavailable
          ? `🔌 AI Service is not running at ${this.baseURL}. Please start the ai-service and try again.`
          : `⏱️ AI Service at ${this.baseURL} took too long. The local LLM may be under heavy load. Please try again.`;
        res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }

  /**
   * Fetch relationship graph data for a natural language query
   */
  async getQueryRelationships(caseId, query, userId, nodeLabel = null) {
    try {
      const response = await this.client.post('/api/query/relationships', {
        case_id: caseId,
        query,
        user_id: userId,
        node_label: nodeLabel
      });
      return response.data;
    } catch (error) {
      logger.error('Relationship query failed:', error.message);
      return { success: false, has_graph: false, graph: { nodes: [], edges: [], anomalies: [] } };
    }
  }

  /**
   * Get query history
   */
  async getQueryHistory(caseId, limit = 20) {
    try {
      const response = await this.client.get(`/api/query/history/${caseId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get query history:', error.message);
      throw new Error('Failed to get query history');
    }
  }

  /**
   * Get specific query result
   */
  async getQueryResult(queryId) {
    try {
      const response = await this.client.get(`/api/query/${queryId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get query result:', error.message);
      throw new Error('Failed to get query result');
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(texts) {
    try {
      const response = await this.client.post('/api/embeddings/generate', { texts });
      return response.data.embeddings;
    } catch (error) {
      logger.error('Embedding generation failed:', error.message);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Detect patterns in case data
   */
  async detectPatterns(caseId, analysisType = 'suspicious') {
    try {
      const response = await this.client.post('/api/analysis/detect-patterns', {
        case_id: caseId,
        analysis_type: analysisType
      });
      return response.data;
    } catch (error) {
      logger.error('Pattern detection failed:', error.message);
      throw new Error('Failed to detect patterns');
    }
  }

  /**
   * Get detailed cross-case analysis
   */
  async getCrossCaseAnalysis(caseId, targetCaseId, commonEntity, entityType) {
    try {
      const response = await this.client.post('/api/analysis/cross-case', {
        case_id: caseId,
        target_case_id: targetCaseId,
        common_entity: commonEntity,
        entity_type: entityType
      });
      return response.data;
    } catch (error) {
      logger.error('Cross-case analysis failed:', error.message);
      throw new Error('Failed to perform cross-case analysis');
    }
  }

  /**
   * Get case summary
   */
  async getCaseSummary(caseId) {
    try {
      const response = await this.client.get(`/api/analysis/summary/${caseId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get case summary:', error.message);
      throw new Error('Failed to get case summary');
    }
  }

  /**
   * Invalidate cache for a case (call after new data is uploaded)
   */
  invalidateCaseCache(caseId) {
    queryCache.invalidateCase(caseId);
    logger.info(`[AIClient] Cache invalidated for case ${caseId}`);
  }

  /**
   * Check AI service health
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.warn('AI service not available:', error.message);
      return { status: 'unavailable' };
    }
  }
}

export default new AIClient();
