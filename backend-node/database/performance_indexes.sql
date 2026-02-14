-- Performance optimization: Additional database indexes
-- These indexes improve query performance for high-traffic operations

-- Cases table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_status_priority ON cases(status, priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_assigned_supervisor ON cases(assigned_to_id, supervisor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_created_updated ON cases(created_at, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_unit_status ON cases(unit, status);

-- Evidence bookmarks optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_case_created ON evidence_bookmarks(case_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user_case ON evidence_bookmarks(user_id, case_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_tags ON evidence_bookmarks USING gin(tags);

-- Entity tags optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entity_tags_case_type ON entity_tags(case_id, entity_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entity_tags_content_gin ON entity_tags USING gin(to_tsvector('english', content));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entity_tags_created ON entity_tags(created_at DESC);

-- Query history optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_queries_case_created ON case_queries(case_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_queries_user_created ON case_queries(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_queries_results_count ON case_queries(results_count DESC);

-- Processing jobs optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_jobs_case_status ON processing_jobs(case_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_jobs_created ON processing_jobs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_jobs_status_created ON processing_jobs(status, created_at DESC);

-- Audit logs optimizations (for performance monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_action ON audit_logs(resource_type, action);

-- Alerts optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user_status ON alerts(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_case_status ON alerts(case_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_type_status_created ON alerts(alert_type, status, created_at DESC);

-- Cross-case links optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cross_case_links_source_target ON cross_case_links(source_case_id, target_case_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cross_case_links_entity ON cross_case_links(entity_type, entity_value);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cross_case_links_confidence ON cross_case_links(confidence_score DESC);

-- Data sources optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_sources_case_type ON data_sources(case_id, source_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_sources_status_created ON data_sources(status, created_at DESC);

-- Case reports optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_reports_case_created ON case_reports(case_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_reports_template ON case_reports(template_type);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_active ON cases(created_at) WHERE status IN ('active', 'processing', 'ready_for_analysis');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_active ON alerts(created_at) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_jobs_active ON processing_jobs(created_at) WHERE status IN ('pending', 'processing');

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_search ON cases(title, description) WHERE status != 'archived';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entity_tags_search ON entity_tags(entity_type, confidence_score DESC) WHERE confidence_score > 0.7;

-- Foreign key indexes (if not already present)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_supervisor ON cases(supervisor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_created_by ON cases(created_by_id);

-- Comments for documentation
COMMENT ON INDEX idx_cases_status_priority IS 'Optimizes case filtering by status and priority';
COMMENT ON INDEX idx_entity_tags_content_gin IS 'Full-text search index on entity content';
COMMENT ON INDEX idx_case_queries_case_created IS 'Optimizes query history retrieval for cases';
COMMENT ON INDEX idx_processing_jobs_case_status IS 'Optimizes job status monitoring per case';
