import asyncio
import os
import shutil
from pr_agent.log import get_logger

class SonarScanner:
    def __init__(self):
        self.scanner_path = shutil.which("sonar-scanner")
        if not self.scanner_path:
            # Fallback for local testing if not in PATH
            self.scanner_path = "sonar-scanner"

    async def scan(self, repo_path: str, project_key: str, project_name: str, host_url: str, token: str):
        """
        Runs the sonar-scanner CLI on the given repo_path.
        """
        cmd = [
            self.scanner_path,
            f"-Dsonar.projectKey={project_key}",
            f"-Dsonar.projectName={project_name}",
            f"-Dsonar.sources=.",
            f"-Dsonar.host.url={host_url}",
            f"-Dsonar.login=admin",
            f"-Dsonar.password=admin",
            "-Dsonar.scm.disabled=true", # Disable SCM for simpler scanning of cloned dir
            "-Dsonar.cpd.exclusions=**/*", # Disable duplication detection for speed
        ]
        
        get_logger().info(f"Starting SonarScan for {project_key} in {repo_path}")
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                get_logger().error(f"SonarScanner failed: {stderr.decode()}")
                return False
                
            get_logger().info(f"SonarScan completed successfully for {project_key}")
            return True
            
        except Exception as e:
            get_logger().error(f"Error running SonarScanner: {e}")
            return False
