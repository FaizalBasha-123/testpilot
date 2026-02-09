"""
Workspace Utilities - File System Operations for Analysis
==========================================================

This module handles workspace setup and file operations.
Includes:
- Zip extraction
- Git initialization
- File counting and validation

Extracted from ide_router.py for better modularity.

Author: BlackboxTester Team
"""

import os
import shutil
import tempfile
import zipfile
from typing import Tuple, Optional
from pathlib import Path

from pr_agent.log import get_logger


# ============================================================================
# Workspace Setup
# ============================================================================

def setup_workspace_sync(zip_path: str, temp_dir: str) -> int:
    """
    Blocking I/O operations - extract zip and prepare workspace.
    
    Args:
        zip_path: Path to the uploaded zip file
        temp_dir: Target directory for extraction
        
    Returns:
        Number of files extracted
    """
    logger = get_logger()
    
    # Extract
    logger.debug(f"Unzipping {zip_path} to {temp_dir}...")
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        file_count = len(zip_ref.namelist())
        logger.debug(f"Extracted {file_count} entries")
    
    # Remove the zip after extraction
    os.remove(zip_path)
    
    # Count actual files (not directories)
    actual_count = sum([len(files) for r, d, files in os.walk(temp_dir)])
    logger.debug(f"Workspace contains {actual_count} files")
    
    return actual_count


def git_init_sync(temp_dir: str) -> bool:
    """
    Initialize git repository for the workspace.
    
    Args:
        temp_dir: Workspace directory
        
    Returns:
        True if successful, False otherwise
    """
    logger = get_logger()
    
    try:
        # Use subprocess for better control
        import subprocess
        
        commands = [
            ["git", "init"],
            ["git", "config", "user.email", "blackbox@localhost"],
            ["git", "config", "user.name", "Blackbox Tester"],
            ["git", "add", "."],
            ["git", "commit", "-m", "initial"]
        ]
        
        for cmd in commands:
            result = subprocess.run(
                cmd, 
                cwd=temp_dir, 
                capture_output=True, 
                text=True
            )
            if result.returncode != 0:
                logger.warning(f"Git command failed: {' '.join(cmd)}")
                # Continue anyway - some warnings are expected
        
        return True
        
    except Exception as e:
        logger.error(f"Git init failed: {e}")
        return False


def create_temp_workspace() -> Tuple[str, str]:
    """
    Create a temporary workspace directory.
    
    Returns:
        Tuple of (temp_dir_path, zip_save_path)
    """
    temp_dir = tempfile.mkdtemp(prefix="blackbox_")
    zip_path = os.path.join(temp_dir, "repo.zip")
    return temp_dir, zip_path


def cleanup_workspace(temp_dir: str) -> bool:
    """
    Clean up a temporary workspace.
    
    Args:
        temp_dir: Workspace directory to remove
        
    Returns:
        True if successful, False otherwise
    """
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return True
    except Exception as e:
        get_logger().error(f"Failed to cleanup {temp_dir}: {e}")
        return False


# ============================================================================
# File Operations
# ============================================================================

def find_files_by_extension(
    directory: str, 
    extensions: list[str],
    exclude_dirs: list[str] = None
) -> list[str]:
    """
    Find all files with given extensions in a directory.
    
    Args:
        directory: Root directory to search
        extensions: List of extensions (e.g., ['.py', '.js'])
        exclude_dirs: Directories to skip (e.g., ['node_modules', '.git'])
        
    Returns:
        List of relative file paths
    """
    exclude_dirs = exclude_dirs or ['node_modules', '.git', '__pycache__', 'venv', '.venv']
    result = []
    
    for root, dirs, files in os.walk(directory):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for f in files:
            if any(f.endswith(ext) for ext in extensions):
                rel_path = os.path.relpath(os.path.join(root, f), directory)
                result.append(rel_path)
    
    return result


def get_file_content(directory: str, file_path: str) -> Optional[str]:
    """
    Read file content safely.
    
    Args:
        directory: Base directory
        file_path: Relative file path
        
    Returns:
        File content as string, or None if read fails
    """
    try:
        full_path = os.path.join(directory, file_path)
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception as e:
        get_logger().debug(f"Failed to read {file_path}: {e}")
        return None


def save_file_content(directory: str, file_path: str, content: str) -> bool:
    """
    Save content to a file.
    
    Args:
        directory: Base directory
        file_path: Relative file path
        content: Content to write
        
    Returns:
        True if successful, False otherwise
    """
    try:
        full_path = os.path.join(directory, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        get_logger().error(f"Failed to save {file_path}: {e}")
        return False


def get_workspace_stats(directory: str) -> dict:
    """
    Get statistics about a workspace.
    
    Args:
        directory: Workspace directory
        
    Returns:
        Dict with file counts, total size, etc.
    """
    stats = {
        "total_files": 0,
        "total_size_bytes": 0,
        "by_extension": {},
        "directory_count": 0
    }
    
    for root, dirs, files in os.walk(directory):
        stats["directory_count"] += len(dirs)
        
        for f in files:
            stats["total_files"] += 1
            full_path = os.path.join(root, f)
            
            try:
                size = os.path.getsize(full_path)
                stats["total_size_bytes"] += size
            except OSError:
                pass
            
            ext = Path(f).suffix.lower() or '.no_ext'
            stats["by_extension"][ext] = stats["by_extension"].get(ext, 0) + 1
    
    return stats
