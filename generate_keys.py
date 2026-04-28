#!/usr/bin/env python3
"""Generate license keys in Supabase"""

import requests
import json
import random
import string

SUPABASE_URL = "https://mlgtlirrhlftjgfdsajy.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("Generating 10 license keys...")

def generate_key():
    return f"PMX-{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}-{''.join(random.choices(string.ascii_uppercase + string.digits, k=4))}"

# Clear existing
try:
    requests.delete(f"{SUPABASE_URL}/rest/v1/licenses?id=neq.0", headers=HEADERS)
    print("Cleared existing keys")
except:
    pass

license_keys = []
for i in range(1, 11):
    key = generate_key()
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/licenses",
            headers=HEADERS,
            json={
                "key": key,
                "user_email": f"alpha-tester-{i}@example.com",
                "max_uses": 10,
                "status": "active",
                "use_count": 0
            }
        )
        if r.status_code == 201:
            license_keys.append(key)
            print(f"  {i}. {key}")
        else:
            print(f"  {i}. Error {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"  {i}. Exception: {e}")

print(f"\n✓ {len(license_keys)} keys generated")
print("\n10 LICENSE KEYS:")
for i, key in enumerate(license_keys, 1):
    print(f"  {i}. {key}")