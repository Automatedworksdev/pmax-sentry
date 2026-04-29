-- Fix master_junk_list table structure
-- Run this first to create/update the table

-- Check if table exists and add missing columns
DO $$
BEGIN
    -- Create table if not exists
    CREATE TABLE IF NOT EXISTS master_junk_list (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        channel_name TEXT NOT NULL,
        channel_id TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'General',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_junk_list' AND column_name = 'channel_name') THEN
        ALTER TABLE master_junk_list ADD COLUMN channel_name TEXT NOT NULL DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_junk_list' AND column_name = 'channel_id') THEN
        ALTER TABLE master_junk_list ADD COLUMN channel_id TEXT UNIQUE NOT NULL DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_junk_list' AND column_name = 'category') THEN
        ALTER TABLE master_junk_list ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'master_junk_list' AND column_name = 'status') THEN
        ALTER TABLE master_junk_list ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'master_junk_list'
ORDER BY ordinal_position;