# PMax Sentry Edge Function Deploy Script
# This deploys the Edge Function using Supabase CLI

echo "🚀 Deploying PMax Sentry Edge Function"
echo "========================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if needed)
echo "Step 1: Ensure logged in to Supabase"
supabase login

# Link project
echo "Step 2: Linking to project mlgtlirrhlftjgfdsajy"
supabase link --project-ref mlgtlirrhlftjgfdsajy

# Deploy function
echo "Step 3: Deploying validate-license function"
supabase functions deploy validate-license

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Test URL:"
echo "https://mlgtlirrhlftjgfdsajy.supabase.co/functions/v1/validate-license"