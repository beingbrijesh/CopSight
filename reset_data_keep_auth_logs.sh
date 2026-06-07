#!/bin/bash

echo "🔄 UFDR Custom Database Reset Script (Preserving Auth and Logs)"
echo "================================================================"

# Check if we're in the right directory
if [ ! -d "backend-node" ] || [ ! -d "frontend" ]; then
    echo "[ERROR] Please run this script from the UFDR project root directory"
    exit 1
fi

echo "[INFO] Starting complete database reset (preserving auth & logs)..."

# 1. PostgreSQL Database Reset
echo "[INFO] Resetting PostgreSQL database..."
cd backend-node

cat > reset_postgres_custom.js << 'EOF'
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ufdr_db',
  process.env.DB_USER || 'ufdr_user',
  process.env.DB_PASSWORD || 'ufdr_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function resetPostgres() {
  try {
    await sequelize.authenticate();
    console.log('Connected successfully');

    // Drop all tables EXCEPT users and audit_log
    const tablesToDrop = [
      'entity_tags', 'data_sources', 'devices',
      'processing_jobs', 'cases', 'evidence_bookmarks', 'case_queries',
      'case_reports', 'case_access_log', 'cross_case_links', 'alerts',
      'alert_rules', 'case_shared_entities'
    ];

    for (const table of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`Dropped table: ${table}`);
      } catch (error) {
        console.log(`Table ${table} doesn't exist or already dropped`);
      }
    }

    // Recreate missing tables
    console.log('Recreating tables...');
    const { default: User } = await import('./src/models/User.js');
    const { default: Case } = await import('./src/models/Case.js');
    const { default: Device } = await import('./src/models/Device.js');
    const { default: DataSource } = await import('./src/models/DataSource.js');
    const { default: ProcessingJob } = await import('./src/models/ProcessingJob.js');
    const { default: EntityTag } = await import('./src/models/EntityTag.js');
    const { default: AuditLog } = await import('./src/models/AuditLog.js');

    await sequelize.sync();
    console.log('All missing tables recreated successfully');

    process.exit(0);
  } catch (error) {
    console.error('PostgreSQL reset failed:', error);
    process.exit(1);
  }
}

resetPostgres();
EOF

node reset_postgres_custom.js
rm reset_postgres_custom.js
cd ..

# 2. Redis Reset
echo "[INFO] Resetting Redis database..."
redis-cli FLUSHALL > /dev/null 2>&1

# 3. Elasticsearch Reset
echo "[INFO] Resetting Elasticsearch indices..."
curl -X DELETE "http://localhost:9200/_all" > /dev/null 2>&1

# 4. Neo4j Reset
echo "[INFO] Resetting Neo4j database..."
cat > neo4j_reset.cyp << 'EOF'
MATCH (n)
DETACH DELETE n;
EOF
if command -v cypher-shell &> /dev/null; then
    cypher-shell -f neo4j_reset.cyp > /dev/null 2>&1
fi
rm -f neo4j_reset.cyp

# 5. Clear Uploads & Vector DB
echo "[INFO] Clearing file directories..."
rm -rf backend-node/uploads/*
mkdir -p backend-node/uploads/temp
rm -rf backend-node/vector_db/* 2>/dev/null
rm -rf backend-node/chroma_db/* 2>/dev/null
rm -rf ai-service/chroma_data/* 2>/dev/null

echo "[SUCCESS] Complete database reset finished! Authentication and Logs were preserved."
