import { jest } from '@jest/globals';
import aiClient from '../src/services/ai/aiClient.js';
import { EventEmitter } from 'events';

describe('AI Client Stability - Slow LLM Testing', () => {
  let mockResponse;

  beforeEach(() => {
    // Mock the Express response object
    mockResponse = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      writableEnded: false
    };

    // Override the internal axio client post method
    aiClient.client.post = jest.fn();
    
    // Clear query cache
    if (aiClient.invalidateCaseCache) {
      aiClient.invalidateCaseCache(1);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('immediately emits thinking state to prevent UI freeze during long LLM initialization', async () => {
    // Setup a mock stream that takes 2.5 seconds to emit the first data to simulate slow initial TTFB
    const mockStream = new EventEmitter();
    
    aiClient.client.post.mockResolvedValueOnce({
      data: mockStream
    });

    const streamPromise = aiClient.streamQuery(1, 'Test query for stability', 1, mockResponse);

    // Initial sync headers and thinking state should be written immediately
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(mockResponse.write).toHaveBeenCalledWith(
      expect.stringContaining('"status":"thinking"')
    );

    // Now emit the slow response
    setTimeout(() => {
      mockStream.emit('data', Buffer.from(`data: {"type": "status", "status": "streaming"}\n\n`));
      mockStream.emit('data', Buffer.from(`data: {"type": "token", "token": "Response"}\n\n`));
      mockStream.emit('data', Buffer.from(`data: [DONE]\n\n`));
      mockStream.emit('end');
    }, 50);

    await streamPromise;

    // Verify it completed without crashing
    expect(mockResponse.write).toHaveBeenCalledWith(
      expect.stringContaining('data: [DONE]')
    );
    expect(mockResponse.end).toHaveBeenCalled();
  });

  it('handles upstream ECONNREFUSED/Timeout gracefully without throwing uncaught exceptions', async () => {
    const timeoutError = new Error('connect ECONNREFUSED');
    timeoutError.code = 'ECONNREFUSED';

    aiClient.client.post.mockRejectedValueOnce(timeoutError);

    await aiClient.streamQuery(1, 'Timeout query', 1, mockResponse);

    // It should have written the thinking state, then the error state, then closed.
    expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"status":"thinking"'));
    expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('AI Service is not running'));
    expect(mockResponse.end).toHaveBeenCalled();
  });
});
