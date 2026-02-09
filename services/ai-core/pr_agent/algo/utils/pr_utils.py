"""
PR Utilities
==============

PR-specific utility functions for processing diffs, files, and descriptions.
"""

import difflib
import hashlib
import os
import re
import sys
from typing import List, Tuple, Any

from pr_agent.algo.git_patch_processing import extract_hunk_lines_from_patch
from pr_agent.algo.types import FilePatchInfo
from pr_agent.config_loader import get_settings
from pr_agent.log import get_logger


def load_large_diff(
    filename: str,
    new_file_content_str: str,
    original_file_content_str: str,
    show_warning: bool = True
) -> str:
    """
    Generate a patch for a modified file by comparing original with new content.
    
    Args:
        filename: Name of the file
        new_file_content_str: New file content
        original_file_content_str: Original file content
        show_warning: Whether to log a warning
        
    Returns:
        Unified diff string
    """
    if not original_file_content_str and not new_file_content_str:
        return ""

    try:
        original_file_content_str = (original_file_content_str or "").rstrip() + "\n"
        new_file_content_str = (new_file_content_str or "").rstrip() + "\n"
        diff = difflib.unified_diff(
            original_file_content_str.splitlines(keepends=True),
            new_file_content_str.splitlines(keepends=True)
        )
        if get_settings().config.verbosity_level >= 2 and show_warning:
            get_logger().info(f"File was modified, but no patch was found. Manually creating patch: {filename}.")
        patch = ''.join(diff)
        return patch
    except Exception as e:
        get_logger().exception(f"Failed to generate patch for file: {filename}")
        return ""


def set_custom_labels(variables: dict, git_provider=None) -> None:
    """
    Set custom labels based on PR context.
    
    Args:
        variables: Variables dict to update
        git_provider: Optional git provider
    """
    custom_labels = get_settings().get("custom_labels", {})
    if custom_labels:
        variables["custom_labels"] = custom_labels


def get_user_labels(current_labels: List[str] = None) -> List[str]:
    """
    Filter to only keep labels added by the user (not auto-generated).
    
    Args:
        current_labels: List of current labels
        
    Returns:
        Filtered list of user labels
    """
    if not current_labels:
        return []
    
    auto_labels = get_settings().get("auto_labels", [])
    return [label for label in current_labels if label not in auto_labels]


def set_file_languages(diff_files: List[FilePatchInfo]) -> List[FilePatchInfo]:
    """
    Set language attribute on diff files based on file extension.
    
    Args:
        diff_files: List of FilePatchInfo objects
        
    Returns:
        Same list with language attribute set
    """
    try:
        # if the language is already set, do not change it
        if hasattr(diff_files[0], 'language') and diff_files[0].language:
            return diff_files

        # map file extensions to programming languages
        language_extension_map_org = get_settings().language_extension_map_org
        extension_to_language = {}
        for language, extensions in language_extension_map_org.items():
            for ext in extensions:
                extension_to_language[ext] = language
                
        for file in diff_files:
            extension_s = '.' + file.filename.rsplit('.')[-1]
            language_name = "txt"
            if extension_s and (extension_s in extension_to_language):
                language_name = extension_to_language[extension_s]
            file.language = language_name.lower()
    except Exception as e:
        get_logger().exception(f"Failed to set file languages: {e}")

    return diff_files


def find_line_number_of_relevant_line_in_file(
    diff_files: List[FilePatchInfo],
    relevant_file: str,
    relevant_line_in_file: str,
    absolute_position: int = None
) -> Tuple[int, int]:
    """
    Find the line number of a relevant line in a diff file.
    
    Args:
        diff_files: List of diff files
        relevant_file: File to search in
        relevant_line_in_file: Line content to find
        absolute_position: Optional absolute position
        
    Returns:
        Tuple of (position, absolute_position)
    """
    position = -1
    if absolute_position is None:
        absolute_position = -1
    re_hunk_header = re.compile(
        r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@[ ]?(.*)")

    if not diff_files:
        return position, absolute_position

    for file in diff_files:
        if file.filename and (file.filename.strip() == relevant_file):
            patch = file.patch
            patch_lines = patch.splitlines()
            delta = 0
            start1, size1, start2, size2 = 0, 0, 0, 0
            
            if absolute_position != -1:  # matching absolute to relative
                for i, line in enumerate(patch_lines):
                    # new hunk
                    if line.startswith('@@'):
                        delta = 0
                        match = re_hunk_header.match(line)
                        start1, size1, start2, size2 = map(int, match.groups()[:4])
                    elif not line.startswith('-'):
                        delta += 1

                    absolute_position_curr = start2 + delta - 1

                    if absolute_position_curr == absolute_position:
                        position = i
                        break
            else:
                # try to find the line in the patch using difflib
                matches_difflib: list[str | Any] = difflib.get_close_matches(
                    relevant_line_in_file, patch_lines, n=3, cutoff=0.93
                )
                if len(matches_difflib) == 1 and matches_difflib[0].startswith('+'):
                    relevant_line_in_file = matches_difflib[0]

                for i, line in enumerate(patch_lines):
                    if line.startswith('@@'):
                        delta = 0
                        match = re_hunk_header.match(line)
                        start1, size1, start2, size2 = map(int, match.groups()[:4])
                    elif not line.startswith('-'):
                        delta += 1

                    if relevant_line_in_file in line and line[0] != '-':
                        position = i
                        absolute_position = start2 + delta - 1
                        break

                if position == -1 and relevant_line_in_file[0] == '+':
                    no_plus_line = relevant_line_in_file[1:].lstrip()
                    for i, line in enumerate(patch_lines):
                        if line.startswith('@@'):
                            delta = 0
                            match = re_hunk_header.match(line)
                            start1, size1, start2, size2 = map(int, match.groups()[:4])
                        elif not line.startswith('-'):
                            delta += 1

                        if no_plus_line in line and line[0] != '-':
                            position = i
                            absolute_position = start2 + delta - 1
                            break
                            
    return position, absolute_position


def set_pr_string(repo_name: str, pr_number: int) -> str:
    """
    Create a standardized PR string.
    
    Args:
        repo_name: Repository name
        pr_number: PR number
        
    Returns:
        Formatted PR string like "owner/repo#123"
    """
    return f"{repo_name}#{pr_number}"


def string_to_uniform_number(s: str) -> float:
    """
    Convert a string to a uniform number in the range [0, 1].
    
    Uses SHA-256 hash for uniform distribution.
    
    Args:
        s: String to convert
        
    Returns:
        Float in [0, 1]
    """
    hash_object = hashlib.sha256(s.encode())
    hash_int = int(hash_object.hexdigest(), 16)
    max_hash_int = 2 ** 256 - 1
    uniform_number = float(hash_int) / max_hash_int
    return uniform_number


def process_description(description_full: str) -> Tuple[str, List]:
    """
    Process a PR description, extracting base description and file walkthrough.
    
    Args:
        description_full: Full PR description
        
    Returns:
        Tuple of (base_description, files_list)
    """
    from pr_agent.algo.utils.types import PRDescriptionHeader
    
    if not description_full:
        return "", []

    if PRDescriptionHeader.FILE_WALKTHROUGH.value not in description_full:
        return description_full.strip(), []

    try:
        # FILE_WALKTHROUGH are presented in a collapsible section
        regex_pattern = r'<details.*?>\s*<summary>\s*<h3>\s*' + re.escape(PRDescriptionHeader.FILE_WALKTHROUGH.value) + r'\s*</h3>\s*</summary>'
        description_split = re.split(regex_pattern, description_full, maxsplit=1, flags=re.DOTALL)

        if len(description_split) == 1:
            description_split = description_full.split(PRDescriptionHeader.FILE_WALKTHROUGH.value, 1)

        if len(description_split) < 2:
            get_logger().error("Failed to split description")
            return description_full.strip(), []

        base_description_str = description_split[0].strip()
        # For now, return empty files list - full parsing is complex
        return base_description_str, []

    except Exception as e:
        get_logger().exception(f"Failed to process description: {e}")
        return description_full.strip(), []


def get_version() -> str:
    """
    Get the PR Agent version.
    
    Returns:
        Version string
    """
    from importlib.metadata import PackageNotFoundError, version
    
    # First check pyproject.toml if running directly out of repository
    if os.path.exists("pyproject.toml"):
        if sys.version_info >= (3, 11):
            import tomllib
            with open("pyproject.toml", "rb") as f:
                data = tomllib.load(f)
                if "project" in data and "version" in data["project"]:
                    return data["project"]["version"]

    # Otherwise get the installed pip package version
    try:
        return version('pr-agent')
    except PackageNotFoundError:
        get_logger().warning("Unable to find package named 'pr-agent'")
        return "unknown"
