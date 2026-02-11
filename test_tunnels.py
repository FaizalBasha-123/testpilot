#!/usr/bin/env python3
"""
Tunnel Connectivity Tester for TestPilot
=========================================

Tests Cloudflare tunnel URLs to verify they can reach local services.
This ensures Render-hosted gateway can communicate with local Sonar/SonarQube.

Usage:
    python test_tunnels.py              # Auto-fetch from tunnel.md
    python test_tunnels.py --manual     # Manual URL entry
    python test_tunnels.py --update     # Test and show Render env update commands
"""

import argparse
import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    print("⚠️  aiohttp not found. Install with: pip install aiohttp")

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

@dataclass
class TunnelEndpoint:
    """Represents a tunnel endpoint to test"""
    name: str
    url: str
    health_path: str
    expected_status: int = 200
    expected_content: Optional[str] = None
    
    def __str__(self):
        return f"{self.name}: {self.url}"


class TunnelTester:
    """Tests connectivity to Cloudflare tunnel URLs"""
    
    def __init__(self):
        self.results: Dict[str, Tuple[bool, str]] = {}
    
    def parse_tunnel_md(self, filepath: str = "tunnel.md") -> Dict[str, str]:
        """Parse tunnel URLs from tunnel.md file"""
        if not os.path.exists(filepath):
            print(f"{Colors.FAIL}✗ {filepath} not found{Colors.ENDC}")
            return {}
        
        urls = {}
        with open(filepath, 'r') as f:
            content = f.read()
            
            # Parse key=value lines
            for line in content.split('\n'):
                line = line.strip()
                if '=' in line and not line.startswith('#') and 'http' in line:
                    # Match patterns like: AI_CORE_URL=https://...
                    match = re.match(r'^([A-Z_]+)=(.+)$', line)
                    if match:
                        key, value = match.groups()
                        # Clean up URL (remove trailing quotes, backticks, etc.)
                        value = value.strip('"\'`').split()[0]
                        if value.startswith('http'):
                            urls[key] = value
        
        return urls
    
    def create_endpoints(self, urls: Dict[str, str]) -> List[TunnelEndpoint]:
        """Create endpoint objects from URL dictionary"""
        endpoints = []
        
        # AI Core
        if 'AI_CORE_URL' in urls:
            endpoints.append(TunnelEndpoint(
                name="AI Core",
                url=urls['AI_CORE_URL'],
                health_path="/health",
                expected_content="ok"
            ))
        
        # Sonar Scanner Service
        if 'SONAR_SERVICE_URL' in urls:
            endpoints.append(TunnelEndpoint(
                name="Sonar Scanner",
                url=urls['SONAR_SERVICE_URL'],
                health_path="/health",
                expected_content="ok"
            ))
        
        # SonarQube
        sonar_url = urls.get('SONARQUBE_URL') or urls.get('SONARQUBE__URL')
        if sonar_url:
            endpoints.append(TunnelEndpoint(
                name="SonarQube",
                url=sonar_url,
                health_path="/api/system/status",
                expected_content="UP"
            ))
        
        return endpoints
    
    async def test_endpoint(self, endpoint: TunnelEndpoint, session: aiohttp.ClientSession) -> Tuple[bool, str]:
        """Test a single endpoint"""
        full_url = endpoint.url.rstrip('/') + endpoint.health_path
        
        try:
            async with session.get(full_url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                status = response.status
                
                # Check status code
                if status != endpoint.expected_status:
                    return False, f"HTTP {status} (expected {endpoint.expected_status})"
                
                # Check response content if specified
                if endpoint.expected_content:
                    try:
                        text = await response.text()
                        
                        # Try as JSON first
                        try:
                            data = json.loads(text)
                            # Check if expected content is in JSON
                            if isinstance(data, dict):
                                # Check any value in the dict
                                found = any(endpoint.expected_content.lower() in str(v).lower() 
                                          for v in data.values())
                                if not found:
                                    return False, f"Content mismatch: {text[:100]}"
                            else:
                                if endpoint.expected_content.lower() not in text.lower():
                                    return False, f"Content mismatch: {text[:100]}"
                        except json.JSONDecodeError:
                            # Not JSON, check raw text
                            if endpoint.expected_content.lower() not in text.lower():
                                return False, f"Content mismatch: {text[:100]}"
                    except Exception as e:
                        return False, f"Content check failed: {e}"
                
                return True, f"HTTP {status} ✓"
        
        except asyncio.TimeoutError:
            return False, "Timeout (15s)"
        except aiohttp.ClientConnectorError as e:
            return False, f"Connection failed: {str(e)[:50]}"
        except Exception as e:
            return False, f"Error: {str(e)[:50]}"
    
    async def test_all(self, endpoints: List[TunnelEndpoint]) -> Dict[str, Tuple[bool, str]]:
        """Test all endpoints concurrently"""
        if not AIOHTTP_AVAILABLE:
            print(f"{Colors.FAIL}Cannot run tests without aiohttp{Colors.ENDC}")
            return {}
        
        async with aiohttp.ClientSession() as session:
            tasks = [self.test_endpoint(ep, session) for ep in endpoints]
            results = await asyncio.gather(*tasks)
            
            return {ep.name: result for ep, result in zip(endpoints, results)}
    
    def print_results(self, endpoints: List[TunnelEndpoint], results: Dict[str, Tuple[bool, str]]):
        """Print formatted test results"""
        print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*70}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}  Tunnel Connectivity Test Results{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*70}{Colors.ENDC}\n")
        
        all_passed = True
        for endpoint in endpoints:
            if endpoint.name in results:
                passed, message = results[endpoint.name]
                
                status_color = Colors.OKGREEN if passed else Colors.FAIL
                status_symbol = "✓" if passed else "✗"
                
                print(f"{status_color}{status_symbol} {endpoint.name}{Colors.ENDC}")
                print(f"  URL: {Colors.OKCYAN}{endpoint.url}{endpoint.health_path}{Colors.ENDC}")
                print(f"  Status: {status_color}{message}{Colors.ENDC}\n")
                
                if not passed:
                    all_passed = False
        
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*70}{Colors.ENDC}")
        if all_passed:
            print(f"{Colors.OKGREEN}{Colors.BOLD}✓ All tunnels are operational!{Colors.ENDC}\n")
        else:
            print(f"{Colors.FAIL}{Colors.BOLD}✗ Some tunnels failed. Check local services or restart tunnels.{Colors.ENDC}\n")
        
        return all_passed
    
    def generate_render_env_script(self, urls: Dict[str, str]):
        """Generate commands to update Render environment variables"""
        print(f"\n{Colors.BOLD}{Colors.OKCYAN}Render Environment Variable Update Commands:{Colors.ENDC}\n")
        print(f"{Colors.WARNING}# Copy these to Render Dashboard → Environment Variables{Colors.ENDC}\n")
        
        for key, value in urls.items():
            # Skip webhook URL as it's derived
            if 'WEBHOOK' not in key:
                print(f"{key}={value}")
        
        print(f"\n{Colors.WARNING}# Or use Render CLI:{Colors.ENDC}")
        print(f"{Colors.OKCYAN}# Install: npm install -g @render-dev/cli{Colors.ENDC}")
        print(f"{Colors.OKCYAN}# Login: render login{Colors.ENDC}\n")
        
        for key, value in urls.items():
            if 'WEBHOOK' not in key:
                print(f"render env set {key}='{value}' --service=<your-service-id>")


def manual_input_mode() -> Dict[str, str]:
    """Manually enter tunnel URLs"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}Manual Tunnel URL Entry{Colors.ENDC}\n")
    print(f"{Colors.WARNING}Enter tunnel URLs (press Enter to skip):{Colors.ENDC}\n")
    
    urls = {}
    
    prompts = [
        ("AI_CORE_URL", "AI Core tunnel URL (e.g., https://xxx.trycloudflare.com)"),
        ("SONAR_SERVICE_URL", "Sonar Scanner tunnel URL"),
        ("SONARQUBE_URL", "SonarQube tunnel URL"),
    ]
    
    for key, prompt in prompts:
        value = input(f"{Colors.OKCYAN}{prompt}:{Colors.ENDC} ").strip()
        if value and value.startswith('http'):
            urls[key] = value
    
    return urls


async def main():
    parser = argparse.ArgumentParser(description="Test Cloudflare tunnel connectivity")
    parser.add_argument('--manual', action='store_true', help='Manual URL entry mode')
    parser.add_argument('--update', action='store_true', help='Show Render env update commands')
    parser.add_argument('--file', default='tunnel.md', help='Path to tunnel.md file')
    args = parser.parse_args()
    
    tester = TunnelTester()
    
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║         TestPilot Tunnel Connectivity Tester                      ║")
    print("║         Verify Cloudflare Tunnels → Local Services               ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")
    
    # Get URLs
    if args.manual:
        urls = manual_input_mode()
    else:
        print(f"{Colors.OKCYAN}→ Reading tunnel URLs from {args.file}...{Colors.ENDC}")
        urls = tester.parse_tunnel_md(args.file)
    
    if not urls:
        print(f"{Colors.FAIL}No tunnel URLs found. Use --manual to enter manually.{Colors.ENDC}")
        return 1
    
    print(f"{Colors.OKGREEN}✓ Found {len(urls)} tunnel URL(s){Colors.ENDC}\n")
    for key, value in urls.items():
        print(f"  {Colors.BOLD}{key}{Colors.ENDC}: {value}")
    
    # Create endpoints
    endpoints = tester.create_endpoints(urls)
    
    if not endpoints:
        print(f"{Colors.FAIL}No valid endpoints to test{Colors.ENDC}")
        return 1
    
    print(f"\n{Colors.OKCYAN}→ Testing {len(endpoints)} endpoint(s)...{Colors.ENDC}\n")
    
    # Run tests
    results = await tester.test_all(endpoints)
    
    # Print results
    all_passed = tester.print_results(endpoints, results)
    
    # Show Render update commands if requested
    if args.update or not all_passed:
        tester.generate_render_env_script(urls)
    
    # Local service check reminder
    print(f"\n{Colors.BOLD}{Colors.WARNING}Local Services Check:{Colors.ENDC}")
    print(f"  Run: {Colors.OKCYAN}docker ps{Colors.ENDC} to verify services are running")
    print(f"  Expected: ai-core (3000), sonar-scanner (8001), sonarqube (9000)\n")
    
    if not all_passed:
        print(f"{Colors.FAIL}To restart tunnels:{Colors.ENDC}")
        print(f"  Windows: {Colors.OKCYAN}.\\start_tunnels.ps1{Colors.ENDC}")
        print(f"  Linux/Mac: {Colors.OKCYAN}./setup-tunnels.sh{Colors.ENDC}\n")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    if not AIOHTTP_AVAILABLE:
        print(f"\n{Colors.WARNING}Installing aiohttp...{Colors.ENDC}")
        os.system(f"{sys.executable} -m pip install aiohttp")
        print(f"\n{Colors.OKGREEN}Please run the script again.{Colors.ENDC}\n")
        sys.exit(1)
    
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Test interrupted by user{Colors.ENDC}")
        sys.exit(130)
