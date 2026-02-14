-- UFDR Database Schema Setup
-- Creates all 14 model tables and seeds initial users

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'investigating_officer',
    badge_number VARCHAR(50),
    rank VARCHAR(50),
    unit VARCHAR(100),
    supervisor_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cases table
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    category VARCHAR(100),
    assigned_to INTEGER REFERENCES users(id),
    supervisor_id INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    unit VARCHAR(100),
    court_name VARCHAR(255),
    fir_number VARCHAR(100),
    act_section VARCHAR(255),
    evidence_count INTEGER DEFAULT 0,
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Devices table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    imei VARCHAR(50),
    phone_number VARCHAR(50),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    os_version VARCHAR(100),
    extraction_date TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Data Sources table
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    app_name VARCHAR(100),
    record_count INTEGER DEFAULT 0,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Processing Jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    file_name VARCHAR(255),
    file_size BIGINT,
    file_path VARCHAR(500),
    result JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Case Queries table
CREATE TABLE IF NOT EXISTS case_queries (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT NOT NULL,
    query_type VARCHAR(50),
    filters JSONB,
    results_count INTEGER DEFAULT 0,
    confidence_score FLOAT,
    answer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Evidence Bookmarks table
CREATE TABLE IF NOT EXISTS evidence_bookmarks (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    query_id INTEGER REFERENCES case_queries(id),
    evidence_id VARCHAR(255),
    evidence_type VARCHAR(50),
    content TEXT,
    notes TEXT,
    tags TEXT[],
    source VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Entity Tags table
CREATE TABLE IF NOT EXISTS entity_tags (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_value VARCHAR(500) NOT NULL,
    confidence FLOAT DEFAULT 0.8,
    source VARCHAR(50),
    context TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Case Reports table
CREATE TABLE IF NOT EXISTS case_reports (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    content TEXT,
    format VARCHAR(20) DEFAULT 'pdf',
    file_path VARCHAR(500),
    generated_by INTEGER REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    case_id INTEGER REFERENCES cases(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Cross Case Links table
CREATE TABLE IF NOT EXISTS cross_case_links (
    id SERIAL PRIMARY KEY,
    source_case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    target_case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    link_type VARCHAR(50),
    entity_type VARCHAR(50),
    entity_value VARCHAR(500),
    strength VARCHAR(20) DEFAULT 'medium',
    confidence_score FLOAT DEFAULT 0.5,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Case Shared Entities table
CREATE TABLE IF NOT EXISTS case_shared_entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_value VARCHAR(500) NOT NULL,
    case_count INTEGER DEFAULT 1,
    first_seen_case_id INTEGER REFERENCES cases(id),
    last_seen_case_id INTEGER REFERENCES cases(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    source VARCHAR(50),
    metadata JSONB,
    created_by INTEGER REFERENCES users(id),
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Alert Rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB,
    actions JSONB,
    severity VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Users (passwords hashed with bcrypt, 12 rounds)
-- Password: Admin@123
INSERT INTO users (username, email, password_hash, full_name, role, badge_number, rank, is_active)
VALUES ('admin', 'admin@ufdr.local', 
    crypt('Admin@123', gen_salt('bf', 12)),
    'System Administrator', 'admin', 'ADMIN-001', 'System Admin', true)
ON CONFLICT (username) DO NOTHING;

-- Password: password123
INSERT INTO users (username, email, password_hash, full_name, role, badge_number, rank, unit, is_active)
VALUES ('io_sharma', 'io_sharma@ufdr.local',
    crypt('password123', gen_salt('bf', 12)),
    'IO Sharma', 'investigating_officer', 'IO-001', 'Inspector', 'Cyber Crime', true)
ON CONFLICT (username) DO NOTHING;

-- Password: password123
INSERT INTO users (username, email, password_hash, full_name, role, badge_number, rank, unit, is_active)
VALUES ('supervisor_kumar', 'supervisor@ufdr.local',
    crypt('password123', gen_salt('bf', 12)),
    'Supervisor Kumar', 'supervisor', 'SUP-001', 'DCP', 'Cyber Crime', true)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT id, username, role, is_active FROM users ORDER BY id;
