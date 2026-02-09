"""
Text Processing Utilities
==========================

String manipulation and text formatting functions.
"""

import re
from typing import List

from pr_agent.log import get_logger


def emphasize_header(text: str, only_markdown=False, reference_link=None) -> str:
    """
    Emphasize the header portion of text (before first colon).
    
    Args:
        text: Text to process
        only_markdown: Use markdown instead of HTML
        reference_link: Optional link to wrap header with
        
    Returns:
        Text with emphasized header
    """
    try:
        # Finding the position of the first occurrence of ": "
        colon_position = text.find(": ")

        # Splitting the string and wrapping the first part in <strong> tags
        if colon_position != -1:
            # Everything before the colon (inclusive) is wrapped in <strong> tags
            if only_markdown:
                if reference_link:
                    transformed_string = f"[**{text[:colon_position + 1]}**]({reference_link})\n" + text[colon_position + 1:]
                else:
                    transformed_string = f"**{text[:colon_position + 1]}**\n" + text[colon_position + 1:]
            else:
                if reference_link:
                    transformed_string = f"<strong><a href='{reference_link}'>{text[:colon_position + 1]}</a></strong><br>" + text[colon_position + 1:]
                else:
                    transformed_string = "<strong>" + text[:colon_position + 1] + "</strong>" +'<br>' + text[colon_position + 1:]
        else:
            # If there's no ": ", return the original string
            transformed_string = text

        return transformed_string
    except Exception as e:
        get_logger().exception(f"Failed to emphasize header: {e}")
        return text


def unique_strings(input_list: List[str]) -> List[str]:
    """
    Return unique strings from a list while preserving order.
    
    Args:
        input_list: List of strings
        
    Returns:
        List with duplicates removed
    """
    if not input_list or not isinstance(input_list, list):
        return input_list
    seen = set()
    unique_list = []
    for item in input_list:
        if item not in seen:
            unique_list.append(item)
            seen.add(item)
    return unique_list


def replace_code_tags(text: str) -> str:
    """
    Replace backticks with <code> tags.
    
    Odd instances get <code>, even get </code>.
    
    Args:
        text: Text to process
        
    Returns:
        Text with code tags
    """
    def replacer(match):
        replacer.counter += 1
        if replacer.counter % 2 == 1:
            return '<code>'
        return '</code>'
    
    replacer.counter = 0
    return re.sub(r'`', replacer, text)


def is_value_no(value) -> bool:
    """
    Check if a value represents "no" or empty.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is empty/no
    """
    if not value:
        return True
    value_str = str(value).strip().lower()
    return value_str in ['no', 'none', 'n/a', '', 'false', '[]', '{}']
