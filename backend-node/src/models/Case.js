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
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'created',
    validate: {
      isIn: [[
        'created', 'active', 'processing', 'ready_for_analysis',
        'under_review', 'closed', 'archived'
      ]]
    }
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'assigned_to'
  },
  supervisorId: {
    type: DataTypes.INTEGER,
    field: 'supervisor_id'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by'
  },
  unit: {
    type: DataTypes.STRING(100)
  },
  priority: {
    type: DataTypes.STRING(20),
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']]
    },
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
