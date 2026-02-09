import requests
import zipfile
import io
import os
import json

# 1. Create a dummy vulnerable file
content = """
def connect():
    password = "admin" # Hardcoded password (Sonar Issue)
    print(password)
"""
os.makedirs("test_scan", exist_ok=True)
with open("test_scan/vulnerable.py", "w") as f:
    f.write(content)

# 2. Zip it
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
    zip_file.write("test_scan/vulnerable.py", "vulnerable.py")
zip_buffer.seek(0)

# 3. Send to API
print("Sending request to http://localhost:3000/api/v1/ide/review_repo...")
try:
    files = {"file": ("repo.zip", zip_buffer, "application/zip")}
    response = requests.post("http://localhost:3000/api/v1/ide/review_repo", files=files)
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("\n--- RESPONSE DATA ---")
        print(f"AI Summary: {data.get('review')[:100]}...")
        
        sonar = data.get('sonar_data', [])
        print(f"\nSonar Findings Count: {len(sonar)}")
        for i, issue in enumerate(sonar):
            print(f"[{i}] {issue.get('message')} ({issue.get('component')})")
            
        fixes = data.get('fixes', [])
        print(f"\nAI Fixes Count: {len(fixes)}")
        for fix in fixes:
            print(f"- Fixed: {fix.get('filename')}")
            
        limit = data.get('limit_reached')
        print(f"\nLimit Reached: {limit}")
    else:
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
