import requests
import time
import sys

print("Wait for SonarQube...")
url = "http://sonarqube:9000/api/system/health"

# Wait up to 3 mins
for i in range(36): 
    try:
        r = requests.get(url, auth=("admin", "admin"), timeout=5)
        if r.status_code == 200:
            data = r.json()
            health = data.get("health")
            print(f"Attempt {i+1}: Health={health}")
            if health in ["GREEN", "YELLOW"]:
                print("SonarQube is UP!")
                sys.exit(0)
        else:
            print(f"Attempt {i+1}: Status={r.status_code}")
    except Exception as e:
        print(f"Attempt {i+1}: Error={e}")
    time.sleep(5)

print("SonarQube Timeout")
sys.exit(1)
