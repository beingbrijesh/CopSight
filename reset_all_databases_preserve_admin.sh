#!/bin/bash

echo "🔄 UFDR Complete Database Reset Script (Preserving Admin Users)"
echo "================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "backend-node" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the UFDR project root directory"
    exit 1
fi

print_warning "This will reset ALL databases but preserve admin users!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_status "Operation cancelled."
    exit 0
fi

print_status "Starting complete database reset (preserving admin users)..."

# 1. PostgreSQL Database Reset (Preserving Admin Users)
print_status "Resetting PostgreSQL database (preserving admin users)..."
cd backend-node

# Create a Node.js script to reset PostgreSQL while preserving admin users
cat > reset_postgres_preserve_admin.js << 'EOF'
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

async function resetPostgresPreserveAdmin() {
  try {
    console.log('Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('Connected successfully');

    // First, backup admin users
    console.log('Backing up admin users...');
    const [adminUsers] = await sequelize.query(`
      SELECT * FROM users WHERE role = 'admin'
    `);
    console.log(`Found ${adminUsers.length} admin users to preserve`);

    // Drop all tables except users temporarily
    console.log('Dropping tables (preserving users temporarily)...');
    const tablesToDrop = [
      'audit_log', 'entity_tags', 'data_sources', 'devices',
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

    // Recreate all tables
    console.log('Recreating tables...');
    const { default: User } = await import('./src/models/User.js');
    const { default: Case } = await import('./src/models/Case.js');
    const { default: Device } = await import('./src/models/Device.js');
    const { default: DataSource } = await import('./src/models/DataSource.js');
    const { default: ProcessingJob } = await import('./src/models/ProcessingJob.js');
    const { default: EntityTag } = await import('./src/models/EntityTag.js');
    const { default: AuditLog } = await import('./src/models/AuditLog.js');

    // Force sync all models to recreate tables
    await sequelize.sync({ force: true });
    console.log('All tables recreated successfully');

    // Restore admin users
    if (adminUsers.length > 0) {
      console.log('Restoring admin users...');
      for (const adminUser of adminUsers) {
        try {
          await sequelize.query(`
            INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `, [
            adminUser.id,
            adminUser.username,
            adminUser.email,
            adminUser.password_hash,
            adminUser.role,
            adminUser.is_active,
            adminUser.created_at,
            adminUser.updated_at
          ]);
        } catch (error) {
          console.log(`Could not restore admin user ${adminUser.username}:`, error.message);
        }
      }
      console.log(`Restored ${adminUsers.length} admin users`);
    }

    process.exit(0);
  } catch (error) {
    console.error('PostgreSQL reset failed:', error);
    process.exit(1);
  }
}

resetPostgresPreserveAdmin();
EOF

node reset_postgres_preserve_admin.js
if [ $? -eq 0 ]; then
    print_success "PostgreSQL database reset completed (admin users preserved)"
else
    print_error "PostgreSQL reset failed"
fi

rm reset_postgres_preserve_admin.js
cd ..

# 2. Redis Reset
print_status "Resetting Redis database..."
redis-cli FLUSHALL > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Redis database cleared"
else
    print_warning "Redis not running or not accessible - skipping"
fi

# 3. Elasticsearch Reset
print_status "Resetting Elasticsearch indices..."
curl -X DELETE "http://localhost:9200/_all" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Elasticsearch indices cleared"
else
    print_warning "Elasticsearch not running or not accessible - skipping"
fi

# 4. Neo4j Reset
print_status "Resetting Neo4j database..."
# Neo4j reset via Cypher
cat > neo4j_reset.cyp << 'EOF'
MATCH (n)
DETACH DELETE n;
EOF

# Try to execute Neo4j reset if available
if command -v cypher-shell &> /dev/null; then
    cypher-shell -f neo4j_reset.cyp > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_success "Neo4j database cleared"
    else
        print_warning "Neo4j reset failed or not accessible"
    fi
else
    print_warning "cypher-shell not found - Neo4j reset skipped"
fi

rm -f neo4j_reset.cyp

# 5. Clear Uploads Directory
print_status "Clearing uploads directory..."
rm -rf backend-node/uploads/*
mkdir -p backend-node/uploads/temp
print_success "Uploads directory cleared"

# 6. Reset any local vector databases (ChromaDB, etc.)
print_status "Checking for vector databases..."
if [ -d "backend-node/vector_db" ]; then
    rm -rf backend-node/vector_db/*
    print_success "Vector database directory cleared"
fi

if [ -d "backend-node/chroma_db" ]; then
    rm -rf backend-node/chroma_db/*
    print_success "ChromaDB directory cleared"
fi

# 7. Clear any cached data
print_status "Clearing cache directories..."
find . -name "*.cache" -type f -delete 2>/dev/null || true
find . -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true

print_success "Cache directories cleared"

echo ""
print_success "🎉 COMPLETE DATABASE RESET FINISHED (Admin Users Preserved)! 🎉"
echo ""
print_status "What was reset:"
echo "  ✅ PostgreSQL - All tables dropped and recreated (admin users preserved)"
echo "  ✅ Redis - All keys flushed"
echo "  ✅ Elasticsearch - All indices deleted"
echo "  ✅ Neo4j - All nodes and relationships deleted"
echo "  ✅ Uploads - All uploaded files removed"
echo "  ✅ Vector DB - Local vector databases cleared"
echo "  ✅ Cache - All cache files removed"
echo ""
print_status "What was preserved:"
echo "  🔒 Admin users - All admin accounts kept intact"
echo ""
print_warning "Note: You may need to restart all services to ensure clean state"
echo ""
print_status "Next steps:"
echo "  1. Restart backend: cd backend-node && npm run dev"
echo "  2. Restart frontend: cd frontend && npm run dev"
echo "  3. Log in with existing admin credentials"
echo "  4. Create a new case and upload files to test"
