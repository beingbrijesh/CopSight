-- UFDR Database Initialization Script - Enhanced RBAC & Case Management

-- Create enum types for roles and statuses
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'investigating_officer', 'supervisor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_status AS ENUM ('created', 'active', 'processing', 'ready_for_analysis', 'under_review', 'closed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table with enhanced RBAC
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'investigating_officer',
    badge_number VARCHAR(50),
    rank VARCHAR(50),
    unit VARCHAR(100),
    supervisor_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Create cases table with enhanced tracking
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status case_status NOT NULL DEFAULT 'created',
    assigned_to INTEGER REFERENCES users(id) NOT NULL,
    supervisor_id INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id) NOT NULL,
    unit VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'medium',
    case_type VARCHAR(50),
    incident_date TIMESTAMP,
    location TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    imei VARCHAR(20),
    phone_number VARCHAR(20),
    owner_name VARCHAR(100),
    extraction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create data_sources table
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id),
    source_type VARCHAR(50),
    app_name VARCHAR(50),
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create processing_jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    job_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_log table with enhanced tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    case_id INTEGER REFERENCES cases(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create case_queries table to track all queries made by IOs
CREATE TABLE IF NOT EXISTS case_queries (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) DEFAULT 'natural_language',
    filters JSONB,
    results_count INTEGER,
    processing_time_ms INTEGER,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create evidence_bookmarks table for IO to save important findings
CREATE TABLE IF NOT EXISTS evidence_bookmarks (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    query_id INTEGER REFERENCES case_queries(id),
    evidence_type VARCHAR(50) NOT NULL,
    evidence_id VARCHAR(255) NOT NULL,
    evidence_source VARCHAR(100),
    evidence_content JSONB NOT NULL,
    notes TEXT,
    tags TEXT[],
    bookmark_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create entity_tags table for NER results
CREATE TABLE IF NOT EXISTS entity_tags (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) NOT NULL,
    evidence_type VARCHAR(50) NOT NULL,
    evidence_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_value TEXT NOT NULL,
    entity_metadata JSONB,
    confidence_score DECIMAL(3,2),
    start_position INTEGER,
    end_position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create case_reports table for generated reports
CREATE TABLE IF NOT EXISTS case_reports (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) NOT NULL,
    generated_by INTEGER REFERENCES users(id) NOT NULL,
    report_type VARCHAR(50) DEFAULT 'evidentiary',
    title VARCHAR(200) NOT NULL,
    report_content JSONB NOT NULL,
    included_bookmarks INTEGER[],
    included_queries INTEGER[],
    pdf_path TEXT,
    digital_signature TEXT,
    signature_timestamp TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create case_access_log for tracking who viewed what (supervisor oversight)
CREATE TABLE IF NOT EXISTS case_access_log (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    access_type VARCHAR(50) NOT NULL,
    resource_accessed TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cross_case_links table for linking related cases
CREATE TABLE IF NOT EXISTS cross_case_links (
    id SERIAL PRIMARY KEY,
    source_case_id INTEGER REFERENCES cases(id) NOT NULL,
    target_case_id INTEGER REFERENCES cases(id) NOT NULL,
    link_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_value TEXT NOT NULL,
    strength VARCHAR(20) DEFAULT 'weak',
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    link_metadata JSONB,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_strength CHECK (strength IN ('weak', 'medium', 'strong', 'critical')),
    CONSTRAINT check_confidence CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT no_self_link CHECK (source_case_id != target_case_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_unit ON users(unit);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_supervisor ON cases(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_cases_unit ON cases(unit);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON cases(created_by);

CREATE INDEX IF NOT EXISTS idx_devices_case_id ON devices(case_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_device_id ON data_sources(device_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_case ON processing_jobs(case_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON audit_log(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

CREATE INDEX IF NOT EXISTS idx_case_queries_case ON case_queries(case_id);
CREATE INDEX IF NOT EXISTS idx_case_queries_user ON case_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_case_queries_created ON case_queries(created_at);

CREATE INDEX IF NOT EXISTS idx_evidence_bookmarks_case ON evidence_bookmarks(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bookmarks_user ON evidence_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bookmarks_type ON evidence_bookmarks(evidence_type);

CREATE INDEX IF NOT EXISTS idx_entity_tags_case ON entity_tags(case_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_type ON entity_tags(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_tags_value ON entity_tags(entity_value);

CREATE INDEX IF NOT EXISTS idx_case_reports_case ON case_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_case_reports_generated_by ON case_reports(generated_by);

CREATE INDEX IF NOT EXISTS idx_case_access_log_case ON case_access_log(case_id);
CREATE INDEX IF NOT EXISTS idx_case_access_log_user ON case_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_case_access_log_created ON case_access_log(created_at);

-- Indexes for cross_case_links table
CREATE UNIQUE INDEX IF NOT EXISTS cross_case_links_unique ON cross_case_links (source_case_id, target_case_id, link_type, entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_source ON cross_case_links(source_case_id);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_target ON cross_case_links(target_case_id);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_type ON cross_case_links(link_type);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_entity ON cross_case_links(entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_strength ON cross_case_links(strength);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_sources_updated_at ON data_sources;
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cross_case_links_updated_at ON cross_case_links;
CREATE TRIGGER update_cross_case_links_updated_at BEFORE UPDATE ON cross_case_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
