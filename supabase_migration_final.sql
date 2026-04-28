-- Run this SQL in Supabase SQL Editor
-- https://mlgtlirrhlftjgfdsajy.supabase.co

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean deployment)
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS master_junk_list CASCADE;

-- Licenses table
CREATE TABLE licenses (
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
CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_status ON licenses(status);

-- Master junk list table (private API data)
CREATE TABLE master_junk_list (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    version TEXT NOT NULL DEFAULT '2.0.0',
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial data placeholder
INSERT INTO master_junk_list (version, data)
VALUES ('2.0.0', '{}'::jsonb);

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

-- RLS Policies (disable for service role access)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_junk_list ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON licenses
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON master_junk_list
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON licenses TO service_role;
GRANT ALL ON master_junk_list TO service_role;
GRANT EXECUTE ON FUNCTION increment_license_use TO service_role;

-- Verify tables created
SELECT 'licenses table created' as status;
SELECT 'master_junk_list table created' as status;