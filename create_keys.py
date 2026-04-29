import requests

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k"
SUPABASE_URL = "https://mlgtlirrhlftjgfdsajy.supabase.co"

keys = [
    ("PMX-A1B2-C3D4-E5F6", 10),
    ("PMX-G7H8-I9J0-K1L2", 10),
    ("PMX-M3N4-O5P6-Q7R8", 10),
    ("PMX-S9T0-U1V2-W3X4", 10),
    ("PMX-Y5Z6-A7B8-C9D0", 10),
    ("PMX-E1F2-G3H4-I5J6", 10),
    ("PMX-K7L8-M9N0-O1P2", 10),
    ("PMX-Q3R4-S5T6-U7V8", 10),
    ("PMX-W9X0-Y1Z2-A3B4", 10),
    ("PMX-C5D6-E7F8-G9H0", 10),
    ("PMX-MASTER-UNLIMITED-TEST", 999999)
]

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

for key, max_uses in keys:
    data = {
        "key": key,
        "user_email": "admin@pmaxsentry.com",
        "status": "active",
        "max_uses": max_uses,
        "use_count": 0
    }
    
    try:
        response = requests.post(f"{SUPABASE_URL}/rest/v1/licenses", headers=headers, json=data)
        if response.status_code == 201:
            print(f"✓ Created: {key} (uses: {max_uses})")
        else:
            print(f"✗ Failed {key}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"✗ Error {key}: {e}")

print("\nDone! Master key: PMX-MASTER-UNLIMITED-TEST")