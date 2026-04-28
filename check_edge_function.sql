-- Check if Edge Function environment variables are set
-- Run this in Supabase Dashboard → SQL Editor

-- Check current Edge Function config
SELECT 
    name,
    created_at,
    updated_at
FROM supabase_functions.functions
WHERE name = 'validate-license';

-- Check if secrets are set
SELECT 
    name,
    created_at
FROM vault.secrets
WHERE name IN ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');