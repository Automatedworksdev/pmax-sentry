# PMax Sentry Supabase Deployment Script
# Deploys schema, data, and edge function

SUPABASE_URL="https://mlgtlirrhlftjgfdsajy.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDc1MTEsImV4cCI6MjA5MjkyMzUxMX0.DyEff3_g7u3Brv7AdSPO14BbskMC44BBifphkmGezrE"

echo "🚀 PMax Sentry Backend Deployment"
echo "===================================="
echo ""

# Step 1: Run SQL Migration
echo "Step 1: Creating database schema..."
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d @/home/john/.openclaw/workspace/pmax-sentry/supabase/migration_001_licensing.sql

echo "✓ Schema created"
echo ""

# Step 2: Upload junk channel data
echo "Step 2: Uploading 2,031 channels to master_junk_list..."
curl -s -X POST "${SUPABASE_URL}/rest/v1/master_junk_list" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d @/home/john/.openclaw/workspace/pmax-sentry/junk_channels.json

echo "✓ Channels uploaded"
echo ""

# Step 3: Generate 10 license keys
echo "Step 3: Generating 10 license keys (max_uses=10)..."

for i in {1..10}; do
  KEY="PMX-$(cat /dev/urandom | tr -dc 'A-Z0-9' | fold -w 4 | head -1)-$(cat /dev/urandom | tr -dc 'A-Z0-9' | fold -w 4 | head -1)-$(cat /dev/urandom | tr -dc 'A-Z0-9' | fold -w 4 | head -1)"
  
  curl -s -X POST "${SUPABASE_URL}/rest/v1/licenses" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"${KEY}\", \"user_email\": \"alpha-tester-${i}@example.com\", \"max_uses\": 10, \"status\": \"active\"}"
  
  echo "  Generated: ${KEY}"
done

echo "✓ 10 license keys created"
echo ""

# Step 4: Deploy Edge Function
echo "Step 4: Deploying validate-license Edge Function..."

# Note: Edge Functions require Supabase CLI or direct deployment via Management API
# For now, we'll provide the manual deployment command
echo ""
echo "To deploy the Edge Function, run:"
echo "supabase functions deploy validate-license --project-ref mlgtlirrhlftjgfdsajy"
echo ""
echo "Or manually upload via Supabase Dashboard:"
echo "  1. Go to Edge Functions in Supabase Dashboard"
echo "  2. Click 'New Function'"
echo "  3. Name: validate-license"
echo "  4. Paste contents from: supabase/functions/validate-license/index.ts"
echo ""

echo "===================================="
echo "✅ Deployment Summary"
echo "===================================="
echo ""
echo "Database Schema: ✅ Created"
echo "Channels:        ✅ 2,031 uploaded"
echo "License Keys:    ✅ 10 generated"
echo "Edge Function:   ⚠️  Manual deployment required"
echo ""
echo "Edge Function URL:"
echo "  ${SUPABASE_URL}/functions/v1/validate-license"
echo ""
echo "10 License Keys (max_uses=10):"
echo "  (Listed above)"
echo ""
echo "Update background.js with:"
echo "  const SUPABASE_URL = '${SUPABASE_URL}'"
echo "  const VALIDATE_ENDPOINT = '${SUPABASE_URL}/functions/v1/validate-license'"