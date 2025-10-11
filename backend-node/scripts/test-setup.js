#!/usr/bin/env node

/**
 * UFDR System - Setup Verification and Testing Script
 * Tests all implemented features and identifies issues
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

console.log('🔍 UFDR System - Setup Verification\n');
console.log('=' .repeat(60));

// Test 1: Check Node.js version
console.log('\n✓ Test 1: Node.js Version');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 18) {
  console.log(`  ✅ Node.js ${nodeVersion} (>= 18.0.0 required)`);
} else {
  console.log(`  ❌ Node.js ${nodeVersion} - Please upgrade to >= 18.0.0`);
  process.exit(1);
}

// Test 2: Check environment variables
console.log('\n✓ Test 2: Environment Variables');
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET'
];

let envMissing = false;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} is set`);
  } else {
    console.log(`  ❌ ${envVar} is missing`);
    envMissing = true;
  }
}

if (envMissing) {
  console.log('\n  ⚠️  Please copy .env.example to .env and configure it');
}

// Test 3: Check database connection
console.log('\n✓ Test 3: Database Connection');
try {
  const { default: sequelize } = await import('../src/config/database.js');
  await sequelize.authenticate();
  console.log('  ✅ Database connection successful');
  
  // Test database version
  const [results] = await sequelize.query('SELECT version()');
  console.log(`  ✅ PostgreSQL version: ${results[0].version.split(' ')[1]}`);
  
  await sequelize.close();
} catch (error) {
  console.log('  ❌ Database connection failed');
  console.log(`  Error: ${error.message}`);
  console.log('\n  📝 Setup Instructions:');
  console.log('  1. Install PostgreSQL:');
  console.log('     macOS: brew install postgresql@15');
  console.log('     Ubuntu: sudo apt-get install postgresql-15');
  console.log('  2. Start PostgreSQL service');
  console.log('  3. Create database and user:');
  console.log('     psql -U postgres');
  console.log('     CREATE DATABASE ufdr_db;');
  console.log('     CREATE USER ufdr_user WITH PASSWORD \'ufdr_password\';');
  console.log('     GRANT ALL PRIVILEGES ON DATABASE ufdr_db TO ufdr_user;');
  console.log('  4. Run: psql -U ufdr_user -d ufdr_db -f backend/database/init.sql');
  process.exit(1);
}

// Test 4: Check models
console.log('\n✓ Test 4: Database Models');
try {
  const models = await import('../src/models/index.js');
  const modelNames = ['User', 'Case', 'CaseQuery', 'EvidenceBookmark', 'CaseReport', 'AuditLog'];
  
  for (const modelName of modelNames) {
    if (models[modelName]) {
      console.log(`  ✅ ${modelName} model loaded`);
    } else {
      console.log(`  ❌ ${modelName} model missing`);
    }
  }
} catch (error) {
  console.log('  ❌ Error loading models');
  console.log(`  Error: ${error.message}`);
  process.exit(1);
}

// Test 5: Check if tables exist
console.log('\n✓ Test 5: Database Tables');
try {
  const { default: sequelize } = await import('../src/config/database.js');
  const tables = ['users', 'cases', 'case_queries', 'evidence_bookmarks', 'case_reports', 'audit_log'];
  
  for (const table of tables) {
    const [results] = await sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
    );
    
    if (results[0].exists) {
      console.log(`  ✅ Table '${table}' exists`);
    } else {
      console.log(`  ❌ Table '${table}' missing`);
      console.log(`     Run: psql -U ufdr_user -d ufdr_db -f backend/database/init.sql`);
    }
  }
  
  await sequelize.close();
} catch (error) {
  console.log('  ❌ Error checking tables');
  console.log(`  Error: ${error.message}`);
}

// Test 6: Check if admin user exists
console.log('\n✓ Test 6: Admin User');
try {
  const { default: sequelize } = await import('../src/config/database.js');
  const { User } = await import('../src/models/index.js');
  
  const admin = await User.findOne({ where: { username: 'admin' } });
  
  if (admin) {
    console.log('  ✅ Admin user exists');
    console.log(`     Username: admin`);
    console.log(`     Role: ${admin.role}`);
  } else {
    console.log('  ❌ Admin user not found');
    console.log('     Run: node scripts/seed-admin.js');
  }
  
  await sequelize.close();
} catch (error) {
  console.log('  ⚠️  Could not check admin user');
  console.log(`  Error: ${error.message}`);
}

// Test 7: Check server configuration
console.log('\n✓ Test 7: Server Configuration');
try {
  const port = process.env.PORT || 8080;
  console.log(`  ✅ Server port: ${port}`);
  console.log(`  ✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  ✅ CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
} catch (error) {
  console.log('  ❌ Server configuration error');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary\n');
console.log('If all tests passed:');
console.log('  1. Start server: npm run dev');
console.log('  2. Test health: curl http://localhost:8080/health');
console.log('  3. Login: curl -X POST http://localhost:8080/api/auth/login \\');
console.log('            -H "Content-Type: application/json" \\');
console.log('            -d \'{"username":"admin","password":"Admin@123"}\'');
console.log('\nIf tests failed:');
console.log('  - Follow the setup instructions above');
console.log('  - Check backend-node/SETUP.md for detailed guide');
console.log('  - Review logs in backend-node/logs/');
console.log('\n' + '='.repeat(60));

process.exit(0);
