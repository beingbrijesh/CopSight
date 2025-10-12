-- Migration: Add automated alerts system
-- This enables automatic detection and notification of suspicious patterns

-- Create alerts table for automated notifications
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL, -- 'cross_case', 'suspicious_pattern', 'anomaly', 'high_risk_entity'
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    case_id INTEGER REFERENCES cases(id),
    user_id INTEGER REFERENCES users(id), -- Who the alert is for
    created_by INTEGER REFERENCES users(id), -- System or specific user who triggered
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
    alert_metadata JSONB, -- Additional context data
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create alert_rules table for configurable alert triggers
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'cross_case', 'entity_frequency', 'pattern_match', 'threshold'
    is_active BOOLEAN DEFAULT true,
    conditions JSONB NOT NULL, -- Rule conditions in JSON format
    actions JSONB NOT NULL, -- Actions to take when rule triggers
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_case ON alerts(case_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);

-- Insert default alert rules
INSERT INTO alert_rules (rule_name, rule_type, conditions, actions, created_by) VALUES
(
    'High Risk Cross-Case Connection',
    'cross_case',
    '{"strength": "critical", "confidence_threshold": 0.8}',
    '{"notify_users": ["supervisor", "investigating_officer"], "create_alert": true, "escalate_priority": true}',
    1
),
(
    'Shared Entity Across Multiple Cases',
    'entity_frequency',
    '{"min_case_count": 3, "entity_types": ["phone", "crypto"]}',
    '{"notify_users": ["supervisor"], "create_alert": true}',
    1
),
(
    'Suspicious Communication Pattern',
    'pattern_match',
    '{"patterns": ["foreign_number_high_frequency", "late_night_communications"]}',
    '{"notify_users": ["investigating_officer"], "create_alert": true}',
    1
);

-- Add comments for documentation
COMMENT ON TABLE alerts IS 'Automated alerts for suspicious patterns and high-risk connections';
COMMENT ON TABLE alert_rules IS 'Configurable rules for triggering automated alerts';
COMMENT ON COLUMN alerts.severity IS 'Alert severity: low, medium, high, critical';
COMMENT ON COLUMN alerts.status IS 'Alert status: active, acknowledged, resolved, dismissed';
