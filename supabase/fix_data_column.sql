-- Add data column default and fix structure
-- Run this first

-- Remove the NOT NULL constraint from data column if it exists
DO $$
BEGIN
    -- Check if data column exists and modify it
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'master_junk_list' AND column_name = 'data') THEN
        ALTER TABLE master_junk_list ALTER COLUMN data DROP NOT NULL;
        ALTER TABLE master_junk_list ALTER COLUMN data SET DEFAULT '{}';
    ELSE
        -- Add data column if it doesn't exist
        ALTER TABLE master_junk_list ADD COLUMN data JSONB DEFAULT '{}';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'master_junk_list'
ORDER BY ordinal_position;