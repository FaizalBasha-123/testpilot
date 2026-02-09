"""
Context Builder - Code Context Extraction for LLM Prompts
==========================================================

This module handles extracting relevant code context for AI review.
Includes:
- Code snippet extraction with AST-based scope detection
- Import resolution for dependency context

Extracted from ide_router.py for better modularity.

Author: BlackboxTester Team
"""

import ast
import os
from typing import Tuple, Optional, List

from pr_agent.log import get_logger


# ============================================================================
# Import Resolution
# ============================================================================

def resolve_import_path(repo_path: str, module_name: str) -> Optional[str]:
    """
    Tries to map an import (e.g., 'pr_agent.algo.utils') to a filepath.
    Returns absolute path if found, else None.
    
    Args:
        repo_path: Root path of the repository
        module_name: Import module name (e.g., 'pr_agent.algo.utils')
        
    Returns:
        Absolute path to the module file, or None if not found
    """
    possible_rel_paths = [
        module_name.replace('.', '/') + '.py',
        module_name.replace('.', '/') + '/__init__.py',
        'src/' + module_name.replace('.', '/') + '.py',  # Common src folder
    ]
    
    for rel in possible_rel_paths:
        full_path = os.path.join(repo_path, rel)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return full_path
    return None


# ============================================================================
# Code Snippet Extraction
# ============================================================================

def extract_code_snippet(
    file_content: str, 
    target_line: int, 
    context_lines: int = 10
) -> Tuple[str, int, int]:
    """
    Extracts the relevant code slice around a target line.
    
    Strategy:
    1. Tries to find the enclosing Function/Class using AST
    2. Falls back to line-based slicing if AST fails
    
    Args:
        file_content: Full file content as string
        target_line: Line number to focus on (1-indexed)
        context_lines: Number of context lines for fallback (default 10)
        
    Returns:
        Tuple of (snippet_with_line_numbers, start_line, end_line)
    """
    lines = file_content.splitlines()
    total_lines = len(lines)
    
    # AST Strategy: Find enclosing scope
    try:
        tree = ast.parse(file_content)
        best_node = None
        
        for node in ast.walk(tree):
            # Check if node has line info and covers our target
            if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
                if node.lineno <= target_line <= node.end_lineno:
                    # Prefer smaller scopes (inner functions) over larger ones (classes)
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        # If we already have a node, only replace if this one is 'inner'
                        if best_node and (node.lineno > best_node.lineno):
                            best_node = node
                        elif not best_node:
                            best_node = node
                            
        if best_node:
            start_line = best_node.lineno
            end_line = best_node.end_lineno
            # Add a bit of buffer around the function for decorators/comments
            start = max(0, start_line - 2) 
            end = min(total_lines, end_line + 1)
            
            snippet_lines = lines[start:end]
            numbered_lines = []
            for i, line in enumerate(snippet_lines, start=start + 1):
                prefix = ">>> " if i == target_line else "    "
                numbered_lines.append(f"{prefix}{i:4d} | {line}")
            
            return "\n".join(numbered_lines), start + 1, end
            
    except Exception:
        pass  # AST failed (syntax error or non-python), fall back
        
    # Fallback Strategy: Line-based Slicing
    start = max(0, target_line - context_lines - 1)
    end = min(total_lines, target_line + context_lines)
    
    snippet_lines = lines[start:end]
    numbered_lines = []
    for i, line in enumerate(snippet_lines, start=start + 1):
        prefix = ">>> " if i == target_line else "    "
        numbered_lines.append(f"{prefix}{i:4d} | {line}")
    
    return "\n".join(numbered_lines), start + 1, end


def extract_function_at_line(file_content: str, target_line: int) -> Optional[str]:
    """
    Extract just the function/class definition at a specific line.
    
    Args:
        file_content: Full file content
        target_line: Line number (1-indexed)
        
    Returns:
        Function/class name if found, None otherwise
    """
    try:
        tree = ast.parse(file_content)
        
        for node in ast.walk(tree):
            if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
                if node.lineno <= target_line <= node.end_lineno:
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        return node.name
                    elif isinstance(node, ast.ClassDef):
                        return node.name
    except Exception:
        pass
    
    return None


def get_file_structure(file_content: str) -> List[dict]:
    """
    Get a summary of the file structure (classes, functions).
    
    Args:
        file_content: Full file content
        
    Returns:
        List of dicts with 'type', 'name', 'start_line', 'end_line'
    """
    result = []
    
    try:
        tree = ast.parse(file_content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                result.append({
                    "type": "class",
                    "name": node.name,
                    "start_line": node.lineno,
                    "end_line": node.end_lineno or node.lineno
                })
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Only include top-level functions (not methods)
                # Methods would have parent as ClassDef
                result.append({
                    "type": "function",
                    "name": node.name,
                    "start_line": node.lineno,
                    "end_line": node.end_lineno or node.lineno
                })
    except Exception:
        pass
    
    # Sort by start line
    result.sort(key=lambda x: x["start_line"])
    return result


# ============================================================================
# Multi-File Context
# ============================================================================

def get_related_files(
    repo_path: str, 
    target_file: str, 
    max_files: int = 5
) -> List[str]:
    """
    Find files that are likely related to the target file.
    
    Args:
        repo_path: Root path of the repository
        target_file: Path to the target file
        max_files: Maximum number of related files to return
        
    Returns:
        List of relative file paths
    """
    related = []
    target_name = os.path.basename(target_file)
    target_dir = os.path.dirname(target_file)
    
    # Strategy 1: Files in the same directory
    if os.path.isdir(os.path.join(repo_path, target_dir)):
        for f in os.listdir(os.path.join(repo_path, target_dir)):
            if f.endswith('.py') and f != target_name:
                related.append(os.path.join(target_dir, f))
    
    # Strategy 2: Test files for the target
    test_patterns = [
        f"test_{target_name}",
        f"test{target_name}",
        target_name.replace('.py', '_test.py')
    ]
    for pattern in test_patterns:
        for root, dirs, files in os.walk(repo_path):
            for f in files:
                if f == pattern:
                    rel_path = os.path.relpath(os.path.join(root, f), repo_path)
                    if rel_path not in related:
                        related.append(rel_path)
    
    return related[:max_files]
