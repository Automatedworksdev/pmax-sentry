-- Migration 002: Intelligence Engine - FIXED
-- Run this in Supabase SQL Editor

-- 1. Create community suggestions table
CREATE TABLE IF NOT EXISTS community_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    channel_url TEXT,
    category TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON community_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_channel ON community_suggestions(LOWER(channel_name));

-- 3. Add category column to master_junk_list (check if table exists first)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'master_junk_list') THEN
        -- Add category column if not exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'master_junk_list' AND column_name = 'category') THEN
            ALTER TABLE master_junk_list ADD COLUMN category TEXT DEFAULT 'General';
        END IF;
        
        -- Update categories based on channel_name column
        -- Assuming column is named 'channel_name' or similar
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'master_junk_list' AND column_name = 'channel_name') THEN
            UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%kids%'; 
            UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%cocomelon%';
            UPDATE master_junk_list SET category = 'Gaming' WHERE channel_name ILIKE '%game%';
            UPDATE master_junk_list SET category = 'ASMR' WHERE channel_name ILIKE '%asmr%';
            UPDATE master_junk_list SET category = 'News' WHERE channel_name ILIKE '%news%';
            UPDATE master_junk_list SET category = 'Music' WHERE channel_name ILIKE '%music%';
        END IF;
    END IF;
END $$;

-- 4. Enable RLS on community_suggestions
ALTER TABLE community_suggestions ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
CREATE POLICY IF NOT EXISTS "Allow anon insert" ON community_suggestions
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow service role" ON community_suggestions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Grant permissions
GRANT INSERT ON community_suggestions TO anon, authenticated;
GRANT ALL ON community_suggestions TO service_role;