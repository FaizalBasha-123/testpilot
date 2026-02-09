import sys
import os
import asyncio
from unittest.mock import MagicMock, patch

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pr_agent.tools.pr_sonar_scan import PRSonarScan
from pr_agent.sonar.sonar_client import SonarClient

async def test_sonar_client():
    print("Testing SonarClient...")
    client = SonarClient()
    assert client.base_url == "http://sonarqube:9000"
    print("✅ SonarClient initialized correctly")

async def test_pr_sonar_scan_init():
    print("Testing PRSonarScan initialization...")
    with patch('pr_agent.tools.pr_sonar_scan.get_git_provider') as mock_git_provider:
        mock_provider_instance = MagicMock()
        mock_git_provider.return_value.return_value = mock_provider_instance
        
        scanner = PRSonarScan("https://github.com/owner/repo/pull/1")
        assert scanner.pr_url == "https://github.com/owner/repo/pull/1"
        assert scanner.sonar_client is not None
        print("✅ PRSonarScan initialized correctly")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(test_sonar_client())
    loop.run_until_complete(test_pr_sonar_scan_init())
    print("\n🎉 All Sonar integration tests passed!")
