import requests
import time

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k"
SUPABASE_URL = "https://mlgtlirrhlftjgfdsajy.supabase.co"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Read SQL file and parse
with open('/home/john/.openclaw/workspace/pmax-sentry/dist/master_junk_list_2500.sql', 'r') as f:
    content = f.read()

# Extract VALUES blocks
import re
blocks = re.findall(r"VALUES\s*\(([^)]+)\)", content, re.DOTALL)

count = 0
for block in blocks[:50]:  # Insert first 50 batches
    # Parse individual rows
    rows = block.split('),(')
    
    for row in rows:
        # Clean up
        row = row.strip()
        if not row:
            continue
            
        # Extract values
        parts = row.split("','")
        if len(parts) >= 4:
            name = parts[0].replace("'", "").strip()
            ch_id = parts[1].replace("'", "").strip()
            cat = parts[2].replace("'", "").strip()
            status = parts[3].replace("'", "").replace(")", "").strip()
            
            data = {
                "channel_name": name,
                "channel_id": ch_id,
                "category": cat,
                "status": status
            }
            
            try:
                response = requests.post(f"{SUPABASE_URL}/rest/v1/master_junk_list", 
                                       headers=headers, json=data, timeout=5)
                if response.status_code in [201, 409]:
                    count += 1
                    if count % 100 == 0:
                        print(f"Inserted {count} channels...")
                else:
                    print(f"Error {response.status_code}: {response.text[:100]}")
            except Exception as e:
                print(f"Error: {e}")
                continue
    
    time.sleep(0.1)  # Rate limiting

print(f"\nDone! Inserted {count} channels.")