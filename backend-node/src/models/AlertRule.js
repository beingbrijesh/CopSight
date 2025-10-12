import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AlertRule = sequelize.define('AlertRule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ruleName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'rule_name'
  },
  ruleType: {
    type: DataTypes.ENUM('cross_case', 'entity_frequency', 'pattern_match', 'threshold'),
    allowNull: false,
    field: 'rule_type'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  conditions: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  actions: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'created_by'
  }
}, {
  tableName: 'alert_rules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default AlertRule;
