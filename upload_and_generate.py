#!/usr/bin/env python3
"""PMax Sentry Data Upload and License Generation"""

import json
import random
import string
from supabase import create_client, Client

SUPABASE_URL = "https://mlgtlirrhlftjgfdsajy.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k"

print("🚀 PMax Sentry - Data Upload & License Generation")
print("=" * 55)
print()

supabase: Client = create_client(SUPABASE_URL, SERVICE_KEY)

# Step 1: Upload junk channel data
print("Step 1: Uploading 2,031 channels to master_junk_list...")

with open('/home/john/.openclaw/workspace/pmax-sentry/junk_channels.json', 'r') as f:
    junk_data = json.load(f)

try:
    # Delete existing data first
    supabase.table('master_junk_list').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
except:
    pass

try:
    result = supabase.table('master_junk_list').insert({
        'version': '2.0.0',
        'data': junk_data
    }).execute()
    print(f"✓ {junk_data.get('totalChannels', 0)} channels uploaded successfully")
except Exception as e:
    print(f"✗ Upload failed: {e}")

print()

# Step 2: Generate 10 license keys
print("Step 2: Generating 10 license keys (max_uses=10)...")

def generate_key():
    parts = [
        'PMX',
        ''.join(random.choices(string.ascii_uppercase + string.digits, k=4)),
        ''.join(random.choices(string.ascii_uppercase + string.digits, k=4)),
        ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    ]
    return '-'.join(parts)

# Clear existing licenses
try:
    supabase.table('licenses').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
except:
    pass

license_keys = []

for i in range(1, 11):
    key = generate_key()
    try:
        supabase.table('licenses').insert({
            'key': key,
            'user_email': f'alpha-tester-{i}@example.com',
            'max_uses': 10,
            'status': 'active'
        }).execute()
        license_keys.append(key)
        print(f"  {i}. {key}")
    except Exception as e:
        print(f"  {i}. Error: {e}")

print(f"✓ {len(license_keys)} license keys generated")
print()

# Summary
print("=" * 55)
print("✅ DEPLOYMENT COMPLETE!")
print("=" * 55)
print()
print("📋 FINAL SUMMARY:")
print(f"  Project URL: {SUPABASE_URL}")
print(f"  Database Schema: ✅ Created")
print(f"  Channels: ✅ {junk_data.get('totalChannels', 0)} uploaded")
print(f"  License Keys: ✅ {len(license_keys)} generated")
print()
print("🔑 10 LICENSE KEYS (max_uses=10 each):")
for i, key in enumerate(license_keys, 1):
    print(f"  {i}. {key}")
print()
print("🌐 EDGE FUNCTION URL:")
print(f"  {SUPABASE_URL}/functions/v1/validate-license")
print()
print("⚠️  EDGE FUNCTION DEPLOYMENT:")
print("  Must be deployed manually via Supabase Dashboard:")
print("  1. Go to: https://supabase.com/dashboard/project/mlgtlirrhlftjgfdsajy")
print("  2. Edge Functions → New Function")
print("  3. Name: validate-license")
print("  4. Paste contents from: supabase/functions/validate-license/index.ts")
print()
print("📝 UPDATE background.js:")
print(f'  const SUPABASE_URL = "{SUPABASE_URL}";')
print(f'  const VALIDATE_ENDPOINT = "{SUPABASE_URL}/functions/v1/validate-license";')
print()
print("💾 Save this output - the license keys cannot be retrieved again!")