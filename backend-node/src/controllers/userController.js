import { User, AuditLog } from '../models/index.js';
import { Op } from 'sequelize';
import logger, { auditLogger } from '../config/logger.js';

/**
 * Create new user (Admin only)
 */
export const createUser = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      role,
      badgeNumber,
      rank,
      unit,
      supervisorId
    } = req.body;

    // Validate required fields
    if (!username || !email || !password || !fullName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, full name, and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'investigating_officer', 'supervisor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, investigating_officer, or supervisor'
      });
    }

    // Validate supervisor if provided
    if (supervisorId) {
      const supervisor = await User.findByPk(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        return res.status(400).json({
          success: false,
          message: 'Invalid supervisor'
        });
      }
    }

    // Create user
    const newUser = await User.create({
      username,
      email,
      passwordHash: password, // Will be hashed by model hook
      fullName,
      role,
      badgeNumber,
      rank,
      unit,
      supervisorId,
      createdBy: req.user.id
    });

    // Log user creation
    await AuditLog.create({
      userId: req.user.id,
      action: 'user_created',
      resourceType: 'user',
      resourceId: newUser.id.toString(),
      details: {
        username: newUser.username,
        role: newUser.role,
        createdUser: newUser.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('User created', {
      createdBy: req.user.id,
      newUserId: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: newUser }
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

/**
 * Get all users (Admin only)
 */
export const getUsers = async (req, res) => {
  try {
    const { role, unit, isActive, page = 1, limit = 50 } = req.query;

    const whereClause = {};
    if (role) whereClause.role = role;
    if (unit) whereClause.unit = unit;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'fullName', 'rank']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
};

/**
 * Get user by ID (Admin only)
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'fullName', 'rank']
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user'
    });
  }
};

/**
 * Update user (Admin only)
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email,
      fullName,
      badgeNumber,
      rank,
      unit,
      supervisorId,
      isActive
    } = req.body;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate supervisor if provided
    if (supervisorId) {
      const supervisor = await User.findByPk(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        return res.status(400).json({
          success: false,
          message: 'Invalid supervisor'
        });
      }
    }

    const updates = {};
    if (email) updates.email = email;
    if (fullName) updates.fullName = fullName;
    if (badgeNumber !== undefined) updates.badgeNumber = badgeNumber;
    if (rank) updates.rank = rank;
    if (unit) updates.unit = unit;
    if (supervisorId !== undefined) updates.supervisorId = supervisorId;
    if (isActive !== undefined) updates.isActive = isActive;

    await user.update(updates);

    // Log update
    await AuditLog.create({
      userId: req.user.id,
      action: 'user_updated',
      resourceType: 'user',
      resourceId: user.id.toString(),
      details: {
        username: user.username,
        updates
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.info('User updated', {
      updatedBy: req.user.id,
      userId: user.id,
      username: user.username,
      updates
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

/**
 * Reset user password (Admin only)
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.passwordHash = newPassword;
    await user.save();

    // Log password reset
    await AuditLog.create({
      userId: req.user.id,
      action: 'password_reset',
      resourceType: 'user',
      resourceId: user.id.toString(),
      details: {
        username: user.username,
        resetBy: req.user.username
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionId
    });

    auditLogger.warn('Password reset by admin', {
      adminId: req.user.id,
      userId: user.id,
      username: user.username
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

/**
 * Get investigating officers for assignment
 */
export const getInvestigatingOfficers = async (req, res) => {
  try {
    const { unit } = req.query;

    const whereClause = {
      role: 'investigating_officer',
      isActive: true
    };

    if (unit) {
      whereClause.unit = unit;
    }

    const officers = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'fullName', 'badgeNumber', 'rank', 'unit'],
      order: [['fullName', 'ASC']]
    });

    res.json({
      success: true,
      data: { officers }
    });
  } catch (error) {
    logger.error('Get investigating officers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve investigating officers'
    });
  }
};

/**
 * Get supervisors for assignment
 */
export const getSupervisors = async (req, res) => {
  try {
    const { unit } = req.query;

    const whereClause = {
      role: 'supervisor',
      isActive: true
    };

    if (unit) {
      whereClause.unit = unit;
    }

    const supervisors = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'fullName', 'rank', 'unit'],
      order: [['fullName', 'ASC']]
    });

    res.json({
      success: true,
      data: { supervisors }
    });
  } catch (error) {
    logger.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve supervisors'
    });
  }
};
