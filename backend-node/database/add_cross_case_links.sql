-- Migration: Add cross-case relationship support
-- This enables linking evidence entities across different cases

-- Create cross_case_links table for linking entities between cases
CREATE TABLE IF NOT EXISTS cross_case_links (
    id SERIAL PRIMARY KEY,
    source_case_id INTEGER REFERENCES cases(id) NOT NULL,
    target_case_id INTEGER REFERENCES cases(id) NOT NULL,
    link_type VARCHAR(50) NOT NULL, -- 'phone_number', 'email', 'crypto_address', 'contact', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'phone', 'email', 'crypto', 'contact', 'device'
    entity_value TEXT NOT NULL,
    strength VARCHAR(20) DEFAULT 'weak', -- 'weak', 'medium', 'strong', 'critical'
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    link_metadata JSONB, -- Additional context about the link
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure we don't create self-links
    CONSTRAINT no_self_links CHECK (source_case_id != target_case_id),

    -- Ensure consistent ordering (smaller case_id first)
    CONSTRAINT ordered_cases CHECK (source_case_id < target_case_id)
);

-- Create unique index to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_cross_case_links_unique
ON cross_case_links (source_case_id, target_case_id, link_type, entity_type, entity_value);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cross_case_links_source ON cross_case_links(source_case_id);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_target ON cross_case_links(target_case_id);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_type ON cross_case_links(link_type);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_entity ON cross_case_links(entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_strength ON cross_case_links(strength);
CREATE INDEX IF NOT EXISTS idx_cross_case_links_created ON cross_case_links(created_at);

-- Create case_shared_entities table for tracking which entities appear in multiple cases
CREATE TABLE IF NOT EXISTS case_shared_entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_value TEXT NOT NULL,
    case_count INTEGER DEFAULT 2,
    first_seen_case_id INTEGER REFERENCES cases(id),
    last_seen_case_id INTEGER REFERENCES cases(id),
    case_ids INTEGER[] NOT NULL,
    entity_metadata JSONB,
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(entity_type, entity_value)
);

-- Create indexes for shared entities
CREATE INDEX IF NOT EXISTS idx_shared_entities_type ON case_shared_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_shared_entities_value ON case_shared_entities(entity_value);
CREATE INDEX IF NOT EXISTS idx_shared_entities_risk ON case_shared_entities(risk_level);
CREATE INDEX IF NOT EXISTS idx_shared_entities_updated ON case_shared_entities(updated_at);

-- Add comments for documentation
COMMENT ON TABLE cross_case_links IS 'Links entities (phone numbers, emails, etc.) between different cases';
COMMENT ON TABLE case_shared_entities IS 'Tracks entities that appear across multiple cases';
COMMENT ON COLUMN cross_case_links.strength IS 'Strength of the link: weak, medium, strong, critical';
COMMENT ON COLUMN cross_case_links.confidence_score IS 'AI confidence score for the link (0.0-1.0)';
COMMENT ON COLUMN case_shared_entities.risk_level IS 'Risk assessment for shared entities';
