import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

// Rate limiting configurations for different endpoints
export const createRateLimit = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use memory store (will switch to Redis in production)
    ...options
  };

  return rateLimit(defaultOptions);
};

// Different rate limits for different types of endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // Higher limit in dev for testing
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 900
  }
});

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes for general API
});

export const searchRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 search requests per minute
  message: {
    success: false,
    message: 'Search rate limit exceeded. Please wait before searching again.',
    retryAfter: 60
  }
});

export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 uploads per hour (increased from 20 for development)
  message: {
    success: false,
    message: 'Upload rate limit exceeded. Please wait before uploading more files.',
    retryAfter: 3600
  }
});

export const aiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 AI requests per minute
  message: {
    success: false,
    message: 'AI service rate limit exceeded. Please wait before making more requests.',
    retryAfter: 60
  }
});
