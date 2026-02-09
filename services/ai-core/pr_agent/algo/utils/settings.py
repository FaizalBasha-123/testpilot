"""
Settings Utilities
===================

Functions for managing PR Agent settings and configuration.
"""

from typing import List

import yaml

from pr_agent.config_loader import get_settings
from pr_agent.log import get_logger


def update_settings_from_args(args: List[str]) -> List[str]:
    """
    Update settings based on command line arguments.

    Args:
        args: List of arguments like ['--pr_code_suggestions.num_code_suggestions=3']

    Returns:
        List of unprocessed arguments

    Raises:
        ValueError: If argument format is invalid
    """
    other_args = []
    if args:
        for arg in args:
            arg = arg.strip()
            if arg.startswith('--'):
                arg = arg.strip('-').strip()
                vals = arg.split('=', 1)
                if len(vals) != 2:
                    if len(vals) > 2:  # --extended is a valid argument
                        get_logger().error(f'Invalid argument format: {arg}')
                    other_args.append(arg)
                    continue
                key, value = _fix_key_value(*vals)
                get_settings().set(key, value)
                get_logger().info(f'Updated setting {key} to: "{value}"')
            else:
                other_args.append(arg)
    return other_args


def _fix_key_value(key: str, value: str):
    """
    Normalize key and parse value.
    
    Args:
        key: Setting key
        value: Setting value string
        
    Returns:
        Tuple of (normalized_key, parsed_value)
    """
    key = key.strip().upper()
    value = value.strip()
    try:
        value = yaml.safe_load(value)
    except Exception as e:
        get_logger().debug(f"Failed to parse YAML for config override {key}={value}", exc_info=e)
    return key, value


def show_relevant_configurations(relevant_section: str) -> str:
    """
    Display configuration settings for a section.
    
    Args:
        relevant_section: Section name like 'pr_reviewer'
        
    Returns:
        Formatted configuration string
    """
    try:
        relevant_section = relevant_section.lower()
        settings = get_settings()
        
        if not settings.get(relevant_section):
            return f"No configuration found for section: {relevant_section}"
        
        section_settings = settings.get(relevant_section)
        
        if not isinstance(section_settings, dict):
            section_settings = dict(section_settings)
        
        result = f"### Configuration: {relevant_section}\n\n"
        result += "| Setting | Value |\n"
        result += "|:--------|:------|\n"
        
        for key, value in sorted(section_settings.items()):
            # Mask sensitive values
            if any(sensitive in key.lower() for sensitive in ['token', 'key', 'secret', 'password']):
                value = '***'
            result += f"| {key} | `{value}` |\n"
        
        return result
        
    except Exception as e:
        get_logger().error(f"Failed to show configurations: {e}")
        return f"Error displaying configuration: {e}"
