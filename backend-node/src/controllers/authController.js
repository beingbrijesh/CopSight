import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, AuditLog } from '../models/index.js';
import logger, { auditLogger } from '../config/logger.js';

/**
 * Generate JWT token
 */
const generateToken = (user, sessionId) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: `${process.env.JWT_EXPIRE_HOURS || 24}h`
    }
  );
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ where: { username } });

    if (!user || !user.isActive) {
      auditLogger.warn('Failed login attempt', {
        username,
        reason: 'User not found or inactive',
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      auditLogger.warn('Failed login attempt', {
        username,
        userId: user.id,
        reason: 'Invalid password',
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate session ID and token
    const sessionId = uuidv4();
    const token = generateToken(user, sessionId);

    // Log successful login
    await AuditLog.create({
      userId: user.id,
      action: 'user_login',
      resourceType: 'auth',
      details: { username: user.username, role: user.role },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId
    });

    auditLogger.info('Successful login', {
      userId: user.id,
      username: user.username,
      role: user.role,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        badgeNumber: user.badgeNumber,
        rank: user.rank,
        unit: user.unit
      },
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          badgeNumber: user.badgeNumber,
          rank: user.rank,
          unit: user.unit
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['passwordHash'] }
    });

    res.json({
      success: true,
      user,
      data: { user }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
};

/**
 * Logout user
 */
export const logout = async (req, res) => {
  try {
    // Log logout
    await AuditLog.create({
      userId: req.user.id,
      action: 'user_logout',
      resourceType: 'auth',
      details: { username: req.user.username },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('User logout', {
      userId: req.user.id,
      username: req.user.username
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * Change password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findByPk(req.user.id);

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    // Log password change
    await AuditLog.create({
      userId: user.id,
      action: 'password_changed',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('Password changed', {
      userId: user.id,
      username: user.username
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};
