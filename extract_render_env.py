#!/usr/bin/env python3
"""
Extract Render environment variables from tunnel.md
Usage: python extract_render_env.py
"""

import re
import os

def extract_urls_from_tunnel_md(filepath='tunnel.md'):
    """Parse tunnel.md and extract key=value pairs"""
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        return {}
    
    urls = {}
    with open(filepath, 'r') as f:
        content = f.read()
        
        for line in content.split('\n'):
            line = line.strip()
            if '=' in line and not line.startswith('#') and 'http' in line:
                match = re.match(r'^([A-Z_]+)=(.+)$', line)
                if match:
                    key, value = match.groups()
                    value = value.strip('"\'`').split()[0]
                    if value.startswith('http') and 'WEBHOOK' not in key:
                        urls[key] = value
    
    return urls

def main():
    urls = extract_urls_from_tunnel_md()
    
    if not urls:
        print("No URLs found in tunnel.md")
        return
    
    print("\n" + "="*70)
    print(" RENDER ENVIRONMENT VARIABLES (Copy & Paste)")
    print("="*70 + "\n")
    
    for key, value in urls.items():
        print(f"{key}={value}")
    
    print("\n" + "="*70)
    print(f" {len(urls)} variables extracted from tunnel.md")
    print("="*70 + "\n")
    
    print("📋 Instructions:")
    print("1. Go to https://dashboard.render.com")
    print("2. Select your service (testpilot-64v5)")
    print("3. Click 'Environment' tab")
    print("4. Copy-paste the variables above")
    print("5. Click 'Save Changes'\n")

if __name__ == "__main__":
    main()
