"""
GitHub Utilities
=================

Functions for GitHub API interactions, rate limits, and actions.
"""

import os
import time

import requests

from pr_agent.log import get_logger


def get_rate_limit_status(github_token: str) -> dict:
    """
    Get the current rate limit status from GitHub API.
    
    Args:
        github_token: GitHub personal access token
        
    Returns:
        Dict with rate limit info (limit, remaining, reset)
    """
    try:
        url = "https://api.github.com/rate_limit"
        headers = {"Authorization": f"token {github_token}"}
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            core = data.get("rate", {})
            return {
                "limit": core.get("limit", 0),
                "remaining": core.get("remaining", 0),
                "reset": core.get("reset", 0),
                "used": core.get("used", 0)
            }
        else:
            get_logger().warning(f"Failed to get rate limit: {response.status_code}")
            return {}
    except Exception as e:
        get_logger().error(f"Rate limit check failed: {e}")
        return {}


def validate_rate_limit_github(
    github_token: str,
    installation_id: str = None,
    threshold: float = 0.1
) -> bool:
    """
    Validate that we have sufficient rate limit remaining.
    
    Args:
        github_token: GitHub token
        installation_id: Optional installation ID
        threshold: Minimum ratio of remaining/limit (default 10%)
        
    Returns:
        True if rate limit is OK, False if nearly exhausted
    """
    status = get_rate_limit_status(github_token)
    
    if not status:
        return True  # Assume OK if we can't check
    
    limit = status.get("limit", 1)
    remaining = status.get("remaining", 1)
    
    ratio = remaining / limit if limit > 0 else 0
    
    if ratio < threshold:
        get_logger().warning(
            f"Rate limit nearly exhausted: {remaining}/{limit} ({ratio:.1%})"
        )
        return False
    
    return True


def validate_and_await_rate_limit(github_token: str) -> bool:
    """
    Validate rate limit and wait for reset if needed.
    
    Args:
        github_token: GitHub token
        
    Returns:
        True when rate limit is available
    """
    status = get_rate_limit_status(github_token)
    
    if not status:
        return True
    
    remaining = status.get("remaining", 1)
    
    if remaining < 10:
        reset_time = status.get("reset", 0)
        current_time = int(time.time())
        wait_seconds = max(0, reset_time - current_time + 5)
        
        if wait_seconds > 0:
            get_logger().info(f"Rate limit low ({remaining}), waiting {wait_seconds}s for reset")
            time.sleep(min(wait_seconds, 60))  # Cap at 60 seconds
    
    return True


def github_action_output(output_data: dict, key_name: str) -> None:
    """
    Write output for GitHub Actions.
    
    Args:
        output_data: Data to output
        key_name: Key name for the output
    """
    github_output = os.environ.get("GITHUB_OUTPUT")
    
    if github_output:
        try:
            import json
            output_value = json.dumps(output_data)
            
            with open(github_output, "a") as f:
                f.write(f"{key_name}={output_value}\n")
                
            get_logger().debug(f"Wrote GitHub Action output: {key_name}")
        except Exception as e:
            get_logger().error(f"Failed to write GitHub Action output: {e}")
    else:
        # Fallback for local testing
        get_logger().debug(f"GitHub Action output (local): {key_name}={output_data}")
