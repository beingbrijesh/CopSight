import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrossCaseLink = sequelize.define('CrossCaseLink', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sourceCaseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  targetCaseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  linkType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'phone_number, email, crypto_address, contact, etc.'
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'phone, email, crypto, contact, device'
  },
  entityValue: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  strength: {
    type: DataTypes.ENUM('weak', 'medium', 'strong', 'critical'),
    defaultValue: 'weak'
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.5,
    validate: {
      min: 0.0,
      max: 1.0
    }
  },
  linkMetadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'cross_case_links',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['sourceCaseId', 'targetCaseId', 'linkType', 'entityType', 'entityValue'],
      name: 'cross_case_links_unique'
    },
    {
      fields: ['sourceCaseId'],
      name: 'idx_cross_case_links_source'
    },
    {
      fields: ['targetCaseId'],
      name: 'idx_cross_case_links_target'
    },
    {
      fields: ['linkType'],
      name: 'idx_cross_case_links_type'
    },
    {
      fields: ['entityType', 'entityValue'],
      name: 'idx_cross_case_links_entity'
    },
    {
      fields: ['strength'],
      name: 'idx_cross_case_links_strength'
    }
  ]
});

// Custom validation to ensure no self-links
CrossCaseLink.addHook('beforeCreate', (link) => {
  if (link.sourceCaseId === link.targetCaseId) {
    throw new Error('Cannot create self-links between the same case');
  }
  // Ensure consistent ordering (smaller case_id first)
  if (link.sourceCaseId > link.targetCaseId) {
    [link.sourceCaseId, link.targetCaseId] = [link.targetCaseId, link.sourceCaseId];
  }
});

export default CrossCaseLink;
