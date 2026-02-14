import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CrossCaseLink = sequelize.define('CrossCaseLink', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  source_case_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'source_case_id',
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  target_case_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'target_case_id',
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  link_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'link_type',
    comment: 'phone_number, email, crypto_address, contact, etc.'
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'entity_type',
    comment: 'phone, email, crypto, contact, device'
  },
  entity_value: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'entity_value'
  },
  strength: {
    type: DataTypes.ENUM('weak', 'medium', 'strong', 'critical'),
    defaultValue: 'weak',
    field: 'strength'
  },
  confidence_score: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.5,
    field: 'confidence_score',
    validate: {
      min: 0.0,
      max: 1.0
    }
  },
  link_metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'link_metadata'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'cross_case_links',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['source_case_id', 'target_case_id', 'link_type', 'entity_type', 'entity_value'],
      name: 'cross_case_links_unique'
    },
    {
      fields: ['source_case_id'],
      name: 'idx_cross_case_links_source'
    },
    {
      fields: ['target_case_id'],
      name: 'idx_cross_case_links_target'
    },
    {
      fields: ['link_type'],
      name: 'idx_cross_case_links_type'
    },
    {
      fields: ['entity_type', 'entity_value'],
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
  if (link.source_case_id === link.target_case_id) {
    throw new Error('Cannot create self-links between the same case');
  }
  // Ensure consistent ordering (smaller case_id first)
  if (link.source_case_id > link.target_case_id) {
    [link.source_case_id, link.target_case_id] = [link.target_case_id, link.source_case_id];
  }
});

export default CrossCaseLink;
