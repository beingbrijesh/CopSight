import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ufdr_db',
  process.env.DB_USER || 'ufdr_user',
  process.env.DB_PASSWORD || 'ufdr_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

const cleanupDatabase = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully');

    console.log('🗑️ Starting database cleanup...');

    // Check which tables exist
    const [existingTables] = await sequelize.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tableNames = existingTables.map(row => row.tablename);
    console.log('📋 Existing tables:', tableNames);

    // Delete data in correct order to respect foreign keys
    const tablesToDelete = [
      'alerts',
      'alert_rules',
      'case_shared_entities',
      'cross_case_links',
      'case_access_log',
      'case_reports',
      'case_queries',
      'evidence_bookmarks',
      'audit_log',  // Delete this first since it references cases
      'entity_tags',
      'data_sources',
      'devices',
      'processing_jobs',
      'cases'  // Delete cases last
    ];

    for (const table of tablesToDelete) {
      if (tableNames.includes(table)) {
        console.log(`🗑️ Deleting from table: ${table}`);
        await sequelize.query(`DELETE FROM ${table}`);
      } else {
        console.log(`⚠️ Table ${table} does not exist, skipping...`);
      }
    }

    console.log('✅ Database cleanup completed successfully!');
    console.log('📊 All case data, devices, entities, and processing jobs have been deleted.');

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    console.log('\n💡 Alternative: You can also run these SQL commands manually in your database:');
    console.log('DELETE FROM entity_tags;');
    console.log('DELETE FROM data_sources;');
    console.log('DELETE FROM devices;');
    console.log('DELETE FROM processing_jobs;');
    console.log('DELETE FROM cases;');
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Check processing jobs status
const checkProcessingJobs = async () => {
  try {
    console.log('🔄 Checking processing jobs...');
    await sequelize.authenticate();

    const [jobs] = await sequelize.query(`
      SELECT id, case_id, status, progress, error_message, created_at, started_at, completed_at
      FROM processing_jobs
      WHERE status IN ('processing', 'queued', 'pending', 'waiting')
      ORDER BY created_at DESC
    `);

    const [allJobs] = await sequelize.query(`
      SELECT COUNT(*) as total, status
      FROM processing_jobs
      GROUP BY status
    `);

    console.log('📊 Job status summary:');
    allJobs.forEach(job => {
      console.log(`  ${job.status}: ${job.total} jobs`);
    });

    if (jobs.length === 0) {
      console.log('ℹ️ No active processing jobs found');
    } else {
      console.log('⚠️ Active processing jobs:');
      jobs.forEach(job => {
        const age = Math.floor((Date.now() - new Date(job.created_at)) / 1000 / 60);
        console.log(`  ID: ${job.id}, Case: ${job.case_id}, Status: ${job.status}, Progress: ${job.progress}%, Age: ${age}min`);
        if (job.error_message) {
          console.log(`    Error: ${job.error_message}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Failed to check processing jobs:', error);
  } finally {
    await sequelize.close();
  }
};

// Reset stuck jobs
const resetStuckJobs = async () => {
  try {
    console.log('🔄 Resetting stuck processing jobs...');
    await sequelize.authenticate();

    const [result] = await sequelize.query(`
      UPDATE processing_jobs
      SET status = 'failed', error_message = 'Job reset by admin'
      WHERE status IN ('processing', 'queued', 'waiting')
      AND created_at < NOW() - INTERVAL '5 minutes'
      RETURNING id, case_id, status
    `);

    console.log(`✅ Reset ${result.length} stuck processing jobs to failed status`);

  } catch (error) {
    console.error('❌ Failed to reset stuck jobs:', error);
  } finally {
    await sequelize.close();
  }
};

const command = process.argv[2];

switch (command) {
  case 'cleanup':
    cleanupDatabase();
    break;
  case 'check-jobs':
    checkProcessingJobs();
    break;
  case 'reset-jobs':
    resetStuckJobs();
    break;
  default:
    console.log('Usage:');
    console.log('  node cleanup.js cleanup      - Delete all data from database');
    console.log('  node cleanup.js check-jobs   - Check processing jobs status');
    console.log('  node cleanup.js reset-jobs   - Reset stuck processing jobs');
    break;
}
