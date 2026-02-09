import requests
import os

print("Generating SonarQube Token...")
SONAR_URL = "http://sonarqube:9000"
AUTH = ("admin", "admin")

try:
    # 1. Revoke existing if any (cleanup)
    requests.post(f"{SONAR_URL}/api/user_tokens/revoke", 
        data={"name": "blackbox_token"}, auth=AUTH)

    # 2. Generate new
    resp = requests.post(f"{SONAR_URL}/api/user_tokens/generate", 
        data={"name": "blackbox_token"}, auth=AUTH)

    if resp.status_code == 200:
        token = resp.json()["token"]
        print(f"SUCCESS: Generated token: {token}")
        
        # 3. Update .env
        env_path = ".env"
        with open(env_path, "r") as f:
            lines = f.readlines()
        
        new_lines = []
        token_set = False
        for line in lines:
            if line.startswith("SONARQUBE_TOKEN="):
                new_lines.append(f"SONARQUBE_TOKEN={token}\n")
                token_set = True
            else:
                new_lines.append(line)
        
        if not token_set:
            new_lines.append(f"SONARQUBE_TOKEN={token}\n")
            
        with open(env_path, "w") as f:
            f.writelines(new_lines)
            
        print("Updated .env with SONARQUBE_TOKEN")
    else:
        print(f"FAILED: {resp.text}")

except Exception as e:
    print(f"Error: {e}")
