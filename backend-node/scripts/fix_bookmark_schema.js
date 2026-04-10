import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load env
const envLocal = resolve(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config();
}

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'ufdr_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ufdr_db',
  password: process.env.DB_PASSWORD || 'ufdr_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runFix() {
  const client = await pool.connect();
  try {
    console.log('--- Database Patch: Adding missing columns to evidence_bookmarks ---');
    
    // Check for 'content' column
    const contentCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='evidence_bookmarks' AND column_name='content';
    `);
    
    if (contentCheck.rowCount === 0) {
      console.log('Adding "content" column...');
      await client.query('ALTER TABLE evidence_bookmarks ADD COLUMN content TEXT;');
      console.log('✓ Added "content"');
    } else {
      console.log('- "content" column already exists');
    }

    // Check for 'bookmark_order' column
    const orderCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='evidence_bookmarks' AND column_name='bookmark_order';
    `);
    
    if (orderCheck.rowCount === 0) {
      console.log('Adding "bookmark_order" column...');
      await client.query('ALTER TABLE evidence_bookmarks ADD COLUMN bookmark_order INTEGER DEFAULT 0;');
      console.log('✓ Added "bookmark_order"');
    } else {
      console.log('- "bookmark_order" column already exists');
    }

    // Check for 'updated_at' column
    const updateCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='evidence_bookmarks' AND column_name='updated_at';
    `);
    
    if (updateCheck.rowCount === 0) {
      console.log('Adding "updated_at" column...');
      await client.query('ALTER TABLE evidence_bookmarks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();');
      console.log('✓ Added "updated_at"');
    } else {
      console.log('- "updated_at" column already exists');
    }

    console.log('--- Patch Complete ---');
  } catch (err) {
    console.error('Error applying patch:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runFix();
