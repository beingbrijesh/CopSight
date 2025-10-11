import User from './User.js';
import Case from './Case.js';
import Device from './Device.js';
import DataSource from './DataSource.js';
import ProcessingJob from './ProcessingJob.js';
import CaseQuery from './CaseQuery.js';
import EvidenceBookmark from './EvidenceBookmark.js';
import EntityTag from './EntityTag.js';
import CaseReport from './CaseReport.js';
import AuditLog from './AuditLog.js';

// Define associations
// User self-referential association (supervisor)
User.hasMany(User, { foreignKey: 'supervisorId', as: 'subordinates' });
User.belongsTo(User, { foreignKey: 'supervisorId', as: 'supervisor' });

User.hasMany(Case, { foreignKey: 'assignedTo', as: 'assignedCases' });
User.hasMany(Case, { foreignKey: 'supervisorId', as: 'supervisedCases' });
User.hasMany(Case, { foreignKey: 'createdBy', as: 'createdCases' });

Case.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedOfficer' });
Case.belongsTo(User, { foreignKey: 'supervisorId', as: 'supervisor' });
Case.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Case.hasMany(Device, { foreignKey: 'caseId', as: 'devices' });
Case.hasMany(ProcessingJob, { foreignKey: 'caseId', as: 'jobs' });
Case.hasMany(CaseQuery, { foreignKey: 'caseId', as: 'queries' });
Case.hasMany(EvidenceBookmark, { foreignKey: 'caseId', as: 'bookmarks' });
Case.hasMany(EntityTag, { foreignKey: 'caseId', as: 'entityTags' });
Case.hasMany(CaseReport, { foreignKey: 'caseId', as: 'reports' });
Case.hasMany(AuditLog, { foreignKey: 'caseId', as: 'auditLogs' });

Device.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });
Device.hasMany(DataSource, { foreignKey: 'deviceId', as: 'dataSources' });

DataSource.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });

ProcessingJob.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });

EntityTag.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });

CaseQuery.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });
CaseQuery.belongsTo(User, { foreignKey: 'userId', as: 'user' });

EvidenceBookmark.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });
EvidenceBookmark.belongsTo(User, { foreignKey: 'userId', as: 'user' });
EvidenceBookmark.belongsTo(CaseQuery, { foreignKey: 'queryId', as: 'query' });

CaseReport.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });
CaseReport.belongsTo(User, { foreignKey: 'generatedBy', as: 'generator' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AuditLog.belongsTo(Case, { foreignKey: 'caseId', as: 'case' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

export {
  User,
  Case,
  Device,
  DataSource,
  ProcessingJob,
  CaseQuery,
  EvidenceBookmark,
  EntityTag,
  CaseReport,
  AuditLog
};
