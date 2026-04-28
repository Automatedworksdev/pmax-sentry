-- Migration 002: Intelligence Engine
-- Run in Supabase SQL Editor

-- 1. Community suggestions table
CREATE TABLE IF NOT EXISTS community_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    channel_url TEXT,
    category TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON community_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_channel ON community_suggestions(lower(channel_name));

-- 2. Add versioning to master_junk_list
ALTER TABLE master_junk_list ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '2.0';
ALTER TABLE master_junk_list ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE master_junk_list ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Update existing entries with categories
UPDATE master_junk_list SET category = 'Kids' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%kids%', '%cocomelon%', '%nursery%', '%cartoon%', '%baby%', '%toddler%', '%peppa%', '%paw patrol%', '%disney junior%']);
UPDATE master_junk_list SET category = 'Gaming' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%game%', '%gaming%', '%gameplay%', '%lets play%', '%stream%', '%esports%']);
UPDATE master_junk_list SET category = 'MFA' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%mobile reward%', '%app reward%', '%offer wall%', '%get paid%', '%earn money%']);
UPDATE master_junk_list SET category = 'ASMR' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%asmr%', '%sleep%', '%relax%', '%meditation%', '%white noise%']);
UPDATE master_junk_list SET category = 'Music' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%music%', '%song%', '%lyric%', '%playlist%', '%hits%']);
UPDATE master_junk_list SET category = 'News' WHERE LOWER(channel_name) LIKE ANY(ARRAY['%news%', '%breaking%', '%live stream%', '%24/7%']);

-- 4. Set version for all entries
UPDATE master_junk_list SET version = '2.1' WHERE version = '2.0';

-- 5. Grant permissions
GRANT INSERT ON community_suggestions TO anon, authenticated;
GRANT SELECT ON community_suggestions TO anon, authenticated;
GRANT ALL ON community_suggestions TO service_role;