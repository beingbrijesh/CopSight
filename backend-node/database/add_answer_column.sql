-- Migration to add answer column to case_queries table
-- This allows storing the actual AI-generated answers for conversation history

ALTER TABLE case_queries
ADD COLUMN IF NOT EXISTS answer TEXT;

-- Update existing records with a default answer if needed
UPDATE case_queries
SET answer = 'Query processed successfully'
WHERE answer IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN case_queries.answer IS 'The AI-generated answer/response to the query';
