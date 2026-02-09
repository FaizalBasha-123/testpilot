import asyncio
import os
import shutil
import httpx
import time
import subprocess
import logging

# Configure dummy logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("debug_sonar")

class SonarClient:
    def __init__(self):
        self.base_url = "http://sonarqube:9000"
        self.token = "admin" # Admin/Admin
        self.auth = ("admin", "admin")

    async def create_project(self, project_key: str, project_name: str):
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}/api/projects/create", 
                data={"name": project_name, "project": project_key}, 
                auth=self.auth
            )
            print(f"Create Project Status: {resp.status_code} {resp.text}")

    async def wait_for_processing(self, project_key: str, timeout: int = 60):
        start_time = time.time()
        async with httpx.AsyncClient() as client:
            while (time.time() - start_time) < timeout:
                try:
                    resp = await client.get(f"{self.base_url}/api/ce/activity", 
                                          params={"component": project_key}, 
                                          auth=self.auth)
                    if resp.status_code == 200:
                        tasks = resp.json().get("tasks", [])
                        if tasks:
                            latest = tasks[0]
                            print(f"Task Status: {latest['status']}")
                            if latest["status"] == "SUCCESS":
                                return True
                            if latest["status"] == "FAILED":
                                print("Task FAILED")
                                return False
                except Exception as e:
                    print(f"Polling Error: {e}")
                await asyncio.sleep(2)
        return False

    async def get_issues(self, project_key: str):
        params = {
            "componentKeys": project_key,
            "resolutions": "FALSE",
            "ps": 100,
            "additionalFields": "_all",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/api/issues/search", params=params, auth=self.auth)
            print(f"Get Issues Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"DEBUG RESPONSE: {resp.json()}") # Print FULL JSON
                return resp.json().get("issues", [])
            return []

class SonarScanner:
    def __init__(self):
        self.scanner_path = "/usr/local/bin/sonar-scanner" # Correct path from Dockerfile

    async def scan(self, repo_path, project_key, project_name, host_url, token):
        cmd = [
            self.scanner_path,
            f"-Dsonar.projectKey={project_key}",
            f"-Dsonar.projectName={project_name}",
            f"-Dsonar.sources=.",
            f"-Dsonar.host.url={host_url}",
            f"-Dsonar.login={token}",
            f"-Dsonar.scm.disabled=true",
            f"-Dsonar.cpd.exclusions=**" # Disable duplication check for speed
        ]
        
        print(f"Running: {' '.join(cmd)}")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=repo_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            print("Scanner STDOUT:", stdout.decode())
            print("Scanner STDERR:", stderr.decode())
            return False
        
        return True

async def main():
    print("--- Debugging Sonar (Self-Contained) ---")
    
    # 1. Setup Dummy Repo
    temp_dir = "/tmp/debug_sonar_scan"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    # Create valid python file with issues
    with open(os.path.join(temp_dir, "bad.py"), "w") as f:
        f.write("def foo():\n    eval('print(1)')\n    password = 'admin'\n")

    print(f"Created vulnerable file at {temp_dir}/bad.py")
    
    # 2. Scan
    scanner = SonarScanner()
    client = SonarClient()
    project_key = f"debug_{os.urandom(4).hex()}"
    
    print(f"Creating project {project_key}...")
    await client.create_project(project_key, "Debug Project")
    
    print("Scanning...")
    success = await scanner.scan(
        repo_path=temp_dir,
        project_key=project_key,
        project_name=project_key,
        host_url=client.base_url,
        token="admin"
    )
    
    if not success:
        print("❌ Scan Failed!")
        return

    print("Scan Success. Waiting for processing...")
    ready = await client.wait_for_processing(project_key, timeout=60)
    if not ready:
        print("❌ Processing Timeout!")
        return
        
    print("Processing Done. Fetching issues...")
    issues = await client.get_issues(project_key)
    
    print(f"Issues Found: {len(issues)}")
    for i in issues:
        print(f"- {i.get('message')} ({i.get('component')})")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(main())
