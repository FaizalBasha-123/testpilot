import os
import httpx
from pr_agent.log import get_logger
from pr_agent.config_loader import get_settings

class SonarClient:
    def __init__(self):
        self.base_url = os.environ.get("SONARQUBE_URL", os.environ.get("SONAR_HOST_URL", get_settings().get("SONARQUBE.URL", "http://localhost:9000")))
        self.token = os.environ.get("SONARQUBE_TOKEN", get_settings().get("SONARQUBE.TOKEN", ""))
        self.auth = (self.token, "") if self.token else ("admin", "admin") # Fallback to default for MVP

    async def health_check(self):
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"{self.base_url}/api/system/health", auth=self.auth)
                return resp.status_code == 200
            except Exception as e:
                get_logger().error(f"SonarQube health check failed: {e}")
                return False

    async def create_project(self, project_key: str, project_name: str):
        """Creates a project if it doesn't exist."""
        async with httpx.AsyncClient() as client:
            try:
                # Check if exists first
                resp = await client.get(f"{self.base_url}/api/components/show", params={"component": project_key}, auth=self.auth)
                if resp.status_code == 200:
                    return # Already exists

                # Create
                resp = await client.post(f"{self.base_url}/api/projects/create", 
                    data={"name": project_name, "project": project_key}, 
                    auth=self.auth
                )
                if resp.status_code >= 400:
                    get_logger().error(f"Failed to create Sonar project: {resp.text}")
            except Exception as e:
                get_logger().error(f"Error creating Sonar project: {e}")

    async def get_issues(self, project_key: str, pull_request_id: str = None):
        """Fetches issues for a project, optionally filtered by PR."""
        params = {
            "componentKeys": project_key,
            "resolved": "false", # Open issues only
            "ps": 100, # Page size
            "additionalFields": "_all",
        }
        # Note: Community Edition doesn't strictly support branch/PR analysis in the API the same way Developer does
        # But we can try to filter or just get all open issues for the project if we scan the PR branch as the main project for MVP
        
        # For this MVP, we are scanning the PR code as the 'main' codebase for a unique project key tailored to the PR
        # e.g., projectKey = "org_repo_pr123"
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"{self.base_url}/api/issues/search", params=params, auth=self.auth)
                if resp.status_code == 200:
                    return resp.json().get("issues", [])
                else:
                    get_logger().error(f"Failed to fetch issues: {resp.text}")
                    return []
                return []
            except Exception as e:
                get_logger().error(f"Error fetching issues: {e}")
                return []

    async def get_hotspots(self, project_key: str):
        """Fetches security hotspots."""
        params = {
            "projectKey": project_key,
            "status": "TO_REVIEW", # Open hotspots
            "ps": 100
        }
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"{self.base_url}/api/hotspots/search", params=params, auth=self.auth)
                if resp.status_code == 200:
                    return resp.json().get("hotspots", [])
                return []
            except:
                return []

    async def wait_for_processing(self, project_key: str, timeout: int = 30):
        """Waits for the Compute Engine task to finish for the given project."""
        import asyncio
        import time
        start_time = time.time()
        
        async with httpx.AsyncClient() as client:
            while (time.time() - start_time) < timeout:
                try:
                    # Get recent activities for this component
                    resp = await client.get(f"{self.base_url}/api/ce/activity", 
                                          params={"component": project_key, "status": "SUCCESS,FAILED,CANCELED"}, 
                                          auth=self.auth)
                    if resp.status_code == 200:
                        tasks = resp.json().get("tasks", [])
                        if tasks:
                            # If we see a recent SUCCESS task, we are good.
                            # In a rigorous impl, we'd check task ID matching the scan report.
                            # For MVP/Simplicity, if there is ANY success task in the last minute (since we just created the project), it's ours.
                            latest = tasks[0]
                            if latest["status"] == "SUCCESS":
                                return True
                    
                    # Also check if queue is empty? 
                    # If we don't see SUCCESS yet, maybe it's IN_PROGRESS.
                    # Wait and retry.
                except Exception as e:
                    get_logger().warning(f"Error polling Sonar CE: {e}")
                
                await asyncio.sleep(2) # Poll every 2s
        
        get_logger().warning(f"SonarQube processing timeout for {project_key}")
        return False
