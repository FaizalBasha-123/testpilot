"""
Utils Package - Refactored Utilities
=====================================

This package contains utility functions previously in the monolithic utils.py.
All functions are re-exported here for backward compatibility.

Author: BlackboxTester Team
"""

# Re-export everything for backward compatibility
# Import order matters to avoid circular imports

# Types and Models
from pr_agent.algo.utils.types import (
    Range,
    ModelType,
    TodoItem,
    PRReviewHeader,
    ReasoningEffort,
    PRDescriptionHeader,
    get_model,
    get_setting,
)

# Text Processing
from pr_agent.algo.utils.text import (
    emphasize_header,
    unique_strings,
    replace_code_tags,
    is_value_no,
)

# Markdown Generation
from pr_agent.algo.utils.markdown import (
    convert_to_markdown_v2,
    extract_relevant_lines_str,
    ticket_markdown_logic,
    process_can_be_split,
    parse_code_suggestion,
    format_todo_item,
    format_todo_items,
)

# JSON/YAML Processing
from pr_agent.algo.utils.json_yaml import (
    try_fix_json,
    fix_json_escape_char,
    load_yaml,
    try_fix_yaml,
    convert_str_to_datetime,
)

# Token Management
from pr_agent.algo.utils.tokens import (
    get_max_tokens,
    clip_tokens,
)

# GitHub Utilities
from pr_agent.algo.utils.github import (
    get_rate_limit_status,
    validate_rate_limit_github,
    validate_and_await_rate_limit,
    github_action_output,
)

# Settings and Config
from pr_agent.algo.utils.settings import (
    update_settings_from_args,
    show_relevant_configurations,
)

# File/PR Processing
from pr_agent.algo.utils.pr_utils import (
    load_large_diff,
    set_custom_labels,
    get_user_labels,
    set_file_languages,
    find_line_number_of_relevant_line_in_file,
    set_pr_string,
    string_to_uniform_number,
    process_description,
    get_version,
)

# All exports for star import
__all__ = [
    # Types
    "Range",
    "ModelType",
    "TodoItem",
    "PRReviewHeader",
    "ReasoningEffort",
    "PRDescriptionHeader",
    "get_model",
    "get_setting",
    # Text
    "emphasize_header",
    "unique_strings",
    "replace_code_tags",
    "is_value_no",
    # Markdown
    "convert_to_markdown_v2",
    "extract_relevant_lines_str",
    "ticket_markdown_logic",
    "process_can_be_split",
    "parse_code_suggestion",
    "format_todo_item",
    "format_todo_items",
    # JSON/YAML
    "try_fix_json",
    "fix_json_escape_char",
    "load_yaml",
    "try_fix_yaml",
    "convert_str_to_datetime",
    # Tokens
    "get_max_tokens",
    "clip_tokens",
    # GitHub
    "get_rate_limit_status",
    "validate_rate_limit_github",
    "validate_and_await_rate_limit",
    "github_action_output",
    # Settings
    "update_settings_from_args",
    "show_relevant_configurations",
    # PR Utils
    "load_large_diff",
    "set_custom_labels",
    "get_user_labels",
    "set_file_languages",
    "find_line_number_of_relevant_line_in_file",
    "set_pr_string",
    "string_to_uniform_number",
    "process_description",
    "get_version",
]
