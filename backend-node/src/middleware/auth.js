import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import logger, { auditLogger } from '../config/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header or query string (for SSE)
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please authenticate.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not active'
      });
    }

    // Attach user to request
    req.user = user;
    req.user.sessionEncryptionKey = decoded.sessionEncryptionKey;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      auditLogger.warn('Unauthorized access attempt', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!User.hasPermission(req.user.role, permission)) {
      auditLogger.warn('Insufficient permissions', {
        userId: req.user.id,
        role: req.user.role,
        requiredPermission: permission,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${permission}`
      });
    }

    next();
  };
};
