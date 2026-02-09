import os
import tempfile
import asyncio
from pr_agent.algo.ai_handlers.base_ai_handler import BaseAiHandler
from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
from pr_agent.config_loader import get_settings
from pr_agent.git_providers import get_git_provider
from pr_agent.log import get_logger
from pr_agent.sonar.sonar_client import SonarClient
from pr_agent.sonar.sonar_scanner import SonarScanner

class PRSonarScan:
    def __init__(self, pr_url: str, args: list = None, ai_handler: BaseAiHandler = None):
        self.pr_url = pr_url
        self.args = args
        self.git_provider = get_git_provider()(pr_url)
        self.sonar_client = SonarClient()
        self.sonar_scanner = SonarScanner()

    async def run(self):
        get_logger().info(f"Starting SonarQube scan for PR: {self.pr_url}")
        
        # 1. Prepare Project Key (unique for this PR)
        repo_name = self.git_provider.repo_obj.full_name.replace("/", "_")
        pr_number = self.pr_url.split("/")[-1]
        project_key = f"{repo_name}_pr{pr_number}"
        project_name = f"{repo_name} PR #{pr_number}"
        
        # 2. Create Project in SonarQube
        await self.sonar_client.create_project(project_key, project_name)
        
        # 3. Clone Repository
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_path = os.path.join(temp_dir, "repo")
            clone_url = self.git_provider.get_git_repo_url()
            
            # For GitHub, we might need to inject token into URL for private repos
            # clone_url = clone_url.replace("https://", f"https://x-access-token:{token}@")
            # For MVP assuming public or SSH/Env configured
            
            branch = self.git_provider.get_pr_branch()
            
            get_logger().info(f"Cloning {clone_url} branch {branch} to {repo_path}")
            
            # Simple git clone
            proc = await asyncio.create_subprocess_exec(
                "git", "clone", "--depth", "1", "--branch", branch, clone_url, repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                get_logger().error(f"Git clone failed: {stderr.decode()}")
                return
                
            # 4. Run SonarScanner
            success = await self.sonar_scanner.scan(
                repo_path=repo_path,
                project_key=project_key,
                project_name=project_name,
                host_url=self.sonar_client.base_url,
                token=self.sonar_client.token
            )
            
            if not success:
                get_logger().error("SonarScanner failed, aborting.")
                return

            # 5. Fetch Findings
            issues = await self.sonar_client.get_issues(project_key)
            
            # 6. Format and Publish
            message = None
            if issues:
                message = self._format_findings(issues)
                if not self.args or "--no_publish" not in self.args:
                    self.git_provider.publish_comment(message)
            else:
                get_logger().info("No SonarQube issues found.")
            
            return message

    def _format_findings(self, issues: list) -> str:
        if not issues:
            return "## 🛡️ SonarQube Security Scan\n\nNo issues found. Great job! ✅"
            
        markdown = "## 🛡️ SonarQube Security Scan\n\n"
        markdown += f"Found **{len(issues)}** potential issues:\n\n"
        
        # Group by severity
        # ... (Simple formatting for MVP)
        
        for issue in issues[:10]: # Limit to top 10 for now
            severity_icon = "🔴" if issue.get("severity") in ["BLOCKER", "CRITICAL"] else "⚠️"
            markdown += f"### {severity_icon} {issue.get('message')}\n"
            markdown += f"- **Type**: {issue.get('type')}\n"
            markdown += f"- **File**: `{issue.get('component', '').split(':')[-1]}`\n"
            if 'line' in issue:
                markdown += f"- **Line**: {issue['line']}\n"
            markdown += f"- [Open in SonarQube]({self.sonar_client.base_url}/project/issues?id={issue.get('project')}&open={issue.get('key')})\n\n"
            
        if len(issues) > 10:
            markdown += f"\n*...and {len(issues) - 10} more issues.*"
            
        return markdown
