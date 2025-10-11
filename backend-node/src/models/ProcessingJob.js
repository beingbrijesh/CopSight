import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProcessingJob = sequelize.define('ProcessingJob', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'case_id',
    references: {
      model: 'cases',
      key: 'id'
    }
  },
  jobType: {
    type: DataTypes.STRING(50),
    field: 'job_type'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  errorMessage: {
    type: DataTypes.TEXT,
    field: 'error_message'
  },
  startedAt: {
    type: DataTypes.DATE,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  }
}, {
  tableName: 'processing_jobs',
  timestamps: true,
  updatedAt: false
});

export default ProcessingJob;
