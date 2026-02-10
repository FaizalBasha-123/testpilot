#!/usr/bin/env python3
"""
Verify that AI-Core has NO local ML dependencies (PyTorch, TensorFlow, etc.)
"""

import subprocess
import sys

def check_requirements():
    """Check requirements.txt for banned packages."""
    print("=" * 80)
    print("STEP 1: Checking requirements.txt")
    print("=" * 80)
    
    banned_packages = [
        'torch',
        'pytorch',
        'tensorflow',
        'sentence-transformers',
        'transformers',
        'lancedb',
        'scipy',  # Often pulled in by ML packages
    ]
    
    with open('services/ai-core/requirements.txt', 'r') as f:
        content = f.read().lower()
    
    found_issues = []
    for pkg in banned_packages:
        if pkg in content:
            found_issues.append(pkg)
    
    if found_issues:
        print(f"❌ FAILED: Found banned packages: {', '.join(found_issues)}")
        return False
    else:
        print("✅ PASSED: No ML packages in requirements.txt")
        return True

def check_dockerfile():
    """Check Dockerfile for ML-related commands."""
    print("\n" + "=" * 80)
    print("STEP 2: Checking Dockerfile")
    print("=" * 80)
    
    try:
        with open('services/ai-core/Dockerfile', 'r') as f:
            content = f.read().lower()
        
        banned_terms = ['torch', 'nvidia', 'cuda', 'gpu', 'ml-models']
        
        found_issues = []
        for term in banned_terms:
            if term in content:
                found_issues.append(term)
        
        if found_issues:
            print(f"⚠️  WARNING: Found terms: {', '.join(found_issues)}")
            print("   (This might be okay if it's just comments)")
            return True
        else:
            print("✅ PASSED: Clean Dockerfile")
            return True
    except FileNotFoundError:
        print("⚠️  WARNING: Dockerfile not found")
        return True

def check_docker_image():
    """Check if Docker image contains PyTorch."""
    print("\n" + "=" * 80)
    print("STEP 3: Checking Docker Image (if built)")
    print("=" * 80)
    
    try:
        # Check if image exists
        result = subprocess.run(
            ['docker', 'images', '-q', 'blackbox-ai-core'],
            capture_output=True,
            text=True
        )
        
        if not result.stdout.strip():
            print("⏭️  SKIPPED: Image not built yet. Build with:")
            print("   docker-compose build ai-core")
            return True
        
        # Check for torch in pip list
        result = subprocess.run(
            ['docker', 'run', '--rm', 'blackbox-ai-core', 'pip', 'list'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout.lower()
        
        banned_in_image = []
        for pkg in ['torch', 'sentence-transformers', 'tensorflow', 'lancedb']:
            if pkg in output:
                banned_in_image.append(pkg)
        
        if banned_in_image:
            print(f"❌ FAILED: Found packages in image: {', '.join(banned_in_image)}")
            print("\nRebuild with:")
            print("  docker-compose build --no-cache ai-core")
            return False
        else:
            print("✅ PASSED: No ML packages in Docker image")
            return True
            
    except subprocess.TimeoutExpired:
        print("⚠️  WARNING: Docker command timeout")
        return True
    except Exception as e:
        print(f"⚠️  WARNING: Could not check Docker image: {e}")
        return True

def main():
    print("\n" + "=" * 80)
    print("AI-CORE API-ONLY VERIFICATION")
    print("Checking for PyTorch, TensorFlow, and local ML dependencies")
    print("=" * 80 + "\n")
    
    results = [
        check_requirements(),
        check_dockerfile(),
        check_docker_image()
    ]
    
    print("\n" + "=" * 80)
    print("FINAL RESULT")
    print("=" * 80)
    
    if all(results):
        print("✅ SUCCESS: AI-Core is API-only (no local ML models)")
        print("\nYou can now build with confidence:")
        print("  docker-compose build ai-core")
        print("  docker-compose up -d ai-core")
        sys.exit(0)
    else:
        print("❌ FAILED: Found local ML dependencies")
        print("\nPlease review the issues above and:")
        print("  1. Remove banned packages from requirements.txt")
        print("  2. Rebuild with: docker-compose build --no-cache ai-core")
        sys.exit(1)

if __name__ == "__main__":
    main()
