-- Migration: Add updated_at column to cross_case_links table
-- Fixes Sequelize model expecting both created_at and updated_at timestamps

-- Add updated_at column to cross_case_links table
ALTER TABLE cross_case_links
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have updated_at set to created_at initially
UPDATE cross_case_links
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Create trigger to automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cross_case_links_updated_at
    BEFORE UPDATE ON cross_case_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON COLUMN cross_case_links.updated_at IS 'Timestamp of last update to this link';
