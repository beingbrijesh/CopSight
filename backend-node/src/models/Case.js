import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Case = sequelize.define('Case', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caseNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'case_number'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM(
      'created', 'active', 'processing', 'ready_for_analysis',
      'under_review', 'closed', 'archived'
    ),
    allowNull: false,
    defaultValue: 'created'
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'assigned_to',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  supervisorId: {
    type: DataTypes.INTEGER,
    field: 'supervisor_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  unit: {
    type: DataTypes.STRING(100)
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  caseType: {
    type: DataTypes.STRING(50),
    field: 'case_type'
  },
  incidentDate: {
    type: DataTypes.DATE,
    field: 'incident_date'
  },
  location: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  closedAt: {
    type: DataTypes.DATE,
    field: 'closed_at'
  }
}, {
  tableName: 'cases',
  timestamps: true
});

export default Case;
