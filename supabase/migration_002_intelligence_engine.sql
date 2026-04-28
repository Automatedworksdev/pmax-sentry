-- Migration 002: Intelligence Engine
-- Run this in Supabase SQL Editor

-- 1. Community suggestions table
CREATE TABLE IF NOT EXISTS community_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    channel_url TEXT,
    category TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON community_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_channel ON community_suggestions(LOWER(channel_name));

-- 3. Add category column to master_junk_list
ALTER TABLE master_junk_list ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- 4. Update existing entries with categories
UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%kids%'; 
UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%cocomelon%';
UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%nursery%';
UPDATE master_junk_list SET category = 'Kids' WHERE channel_name ILIKE '%cartoon%';
UPDATE master_junk_list SET category = 'Gaming' WHERE channel_name ILIKE '%game%';
UPDATE master_junk_list SET category = 'Gaming' WHERE channel_name ILIKE '%gaming%';
UPDATE master_junk_list SET category = 'ASMR' WHERE channel_name ILIKE '%asmr%';
UPDATE master_junk_list SET category = 'ASMR' WHERE channel_name ILIKE '%sleep%';
UPDATE master_junk_list SET category = 'News' WHERE channel_name ILIKE '%news%';
UPDATE master_junk_list SET category = 'Music' WHERE channel_name ILIKE '%music%';

-- 5. Enable RLS and add policies
ALTER TABLE community_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert" ON community_suggestions
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow service role" ON community_suggestions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role" ON community_suggestions
    FOR ALL TO service_role USING (true) WITH CHECK (true);