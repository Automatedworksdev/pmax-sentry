-- Supabase Migration: PMax Sentry Licensing Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    user_email TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'revoked')) DEFAULT 'active',
    use_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Master junk list table (private API data)
CREATE TABLE IF NOT EXISTS master_junk_list (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    version TEXT NOT NULL DEFAULT '2.0.0',
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial master data (will be populated by script)
INSERT INTO master_junk_list (version, data)
VALUES ('2.0.0', '{}'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- Function to increment use_count safely
CREATE OR REPLACE FUNCTION increment_license_use(license_key TEXT)
RETURNS TABLE (
    id UUID,
    key TEXT,
    user_email TEXT,
    status TEXT,
    use_count INTEGER,
    max_uses INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE licenses
    SET 
        use_count = use_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE licenses.key = license_key
      AND licenses.status = 'active'
      AND licenses.use_count < licenses.max_uses
    RETURNING licenses.id, licenses.key, licenses.user_email, licenses.status, licenses.use_count, licenses.max_uses;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_junk_list ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write
CREATE POLICY "Service role full access" ON licenses
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON master_junk_list
    FOR ALL
    USING (auth.role() = 'service_role');

-- Sample licenses for testing (replace with real keys)
-- INSERT INTO licenses (key, user_email, max_uses) VALUES
-- ('PMX-ALPHA-001', 'test@example.com', 100),
-- ('PMX-ALPHA-002', 'test2@example.com', 100);

COMMENT ON TABLE licenses IS 'License keys for PMax Sentry extension';
COMMENT ON TABLE master_junk_list IS 'Master junk channel data served to licensed users';