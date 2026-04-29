import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  fullName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'full_name'
  },
  role: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'investigating_officer',
    validate: {
      isIn: [['admin', 'investigating_officer', 'supervisor']]
    }
  },
  badgeNumber: {
    type: DataTypes.STRING(50),
    field: 'badge_number'
  },
  rank: {
    type: DataTypes.STRING(50)
  },
  unit: {
    type: DataTypes.STRING(100)
  },
  supervisorId: {
    type: DataTypes.INTEGER,
    field: 'supervisor_id'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login'
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'password_changed_at'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        user.passwordChangedAt = new Date();
      }
    }
  }
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.passwordHash;
  return values;
};

// Class methods
User.hasPermission = function(role, permission) {
  const permissions = {
    admin: [
      'create_user', 'modify_user', 'delete_user', 'view_users',
      'create_case', 'view_system_health', 'modify_system_config', 'view_audit_log'
    ],
    investigating_officer: [
      'view_own_cases', 'modify_case', 'upload_ufdr', 'execute_query',
      'bookmark_evidence', 'generate_report', 'sign_report'
    ],
    supervisor: [
      'view_unit_cases', 'view_query_history', 'view_bookmarks',
      'view_reports', 'view_audit_log'
    ]
  };
  
  return permissions[role]?.includes(permission) || false;
};

export default User;
