"""
JSON/YAML Processing Utilities
===============================

Functions for parsing, fixing, and converting JSON and YAML.
"""

import copy
import json
import re
from datetime import datetime
from typing import List

import yaml

from pr_agent.log import get_logger


def try_fix_json(review: str, max_iter: int = 10, code_suggestions: bool = False) -> dict:
    """
    Fix broken or incomplete JSON messages and return the parsed JSON data.

    Args:
        review: A string containing the JSON message to be fixed
        max_iter: Maximum number of iterations to try fixing
        code_suggestions: Whether this is a code suggestions response

    Returns:
        Parsed JSON as dict, or empty dict if parsing fails
    """
    if review.endswith("}"):
        return fix_json_escape_char(review)

    data = {}
    if code_suggestions:
        closing_bracket = "]}"
    else:
        closing_bracket = "]}}"

    if (review.rfind("'Code feedback': [") > 0 or review.rfind('"Code feedback": [') > 0) or \
            (review.rfind("'Code suggestions': [") > 0 or review.rfind('"Code suggestions": [') > 0):
        last_code_suggestion_ind = [m.end() for m in re.finditer(r"\}\s*,", review)][-1] - 1
        valid_json = False
        iter_count = 0

        while last_code_suggestion_ind > 0 and not valid_json and iter_count < max_iter:
            try:
                data = json.loads(review[:last_code_suggestion_ind] + closing_bracket)
                valid_json = True
                review = review[:last_code_suggestion_ind].strip() + closing_bracket
            except json.decoder.JSONDecodeError:
                review = review[:last_code_suggestion_ind]
                last_code_suggestion_ind = [m.end() for m in re.finditer(r"\}\s*,", review)][-1] - 1
                iter_count += 1

        if not valid_json:
            get_logger().error("Unable to decode JSON response from AI")
            data = {}

    return data


def fix_json_escape_char(json_message: str = None) -> dict:
    """
    Fix JSON messages with escape character issues.

    Args:
        json_message: JSON string with potential escape issues

    Returns:
        Parsed JSON as dict
    """
    try:
        result = json.loads(json_message)
    except Exception as e:
        # Find the offending character index:
        idx_to_replace = int(str(e).split(' ')[-1].replace(')', ''))
        # Remove the offending character:
        json_message = list(json_message)
        json_message[idx_to_replace] = ' '
        new_message = ''.join(json_message)
        return fix_json_escape_char(json_message=new_message)
    return result


def convert_str_to_datetime(date_str: str) -> datetime:
    """
    Convert a string representation of a date and time into a datetime object.

    Args:
        date_str: Date string in format '%a, %d %b %Y %H:%M:%S %Z'

    Returns:
        datetime object

    Example:
        >>> convert_str_to_datetime('Mon, 01 Jan 2022 12:00:00 UTC')
        datetime.datetime(2022, 1, 1, 12, 0, 0)
    """
    datetime_format = '%a, %d %b %Y %H:%M:%S %Z'
    return datetime.strptime(date_str, datetime_format)


def load_yaml(response_text: str, keys_fix_yaml: List[str] = [], first_key: str = "", last_key: str = "") -> dict:
    """
    Load YAML from a response text with error handling.

    Args:
        response_text: YAML string to parse
        keys_fix_yaml: Additional keys to try fixing
        first_key: Expected first key
        last_key: Expected last key

    Returns:
        Parsed YAML as dict
    """
    response_text_original = copy.deepcopy(response_text)
    response_text = response_text.strip('\n').removeprefix('yaml').removeprefix('```yaml').rstrip().removesuffix('```')
    try:
        data = yaml.safe_load(response_text)
    except Exception as e:
        get_logger().warning(f"Initial failure to parse AI prediction: {e}")
        data = try_fix_yaml(response_text, keys_fix_yaml=keys_fix_yaml, first_key=first_key, last_key=last_key,
                            response_text_original=response_text_original)
        if not data:
            get_logger().error(f"Failed to parse AI prediction after fallbacks",
                               artifact={'response_text': response_text})
        else:
            get_logger().info(f"Successfully parsed AI prediction after fallbacks",
                              artifact={'response_text': response_text})
    return data


def try_fix_yaml(
    response_text: str,
    keys_fix_yaml: List[str] = [],
    first_key: str = "",
    last_key: str = "",
    response_text_original: str = ""
) -> dict:
    """
    Try various methods to fix and parse broken YAML.

    Args:
        response_text: YAML text to fix
        keys_fix_yaml: Additional keys to try fixing
        first_key: Expected first key
        last_key: Expected last key
        response_text_original: Original text before initial cleanup

    Returns:
        Parsed YAML as dict, or empty dict if all methods fail
    """
    response_text_lines = response_text.split('\n')

    keys_yaml = ['relevant line:', 'suggestion content:', 'relevant file:', 'existing code:',
                 'improved code:', 'label:', 'why:', 'suggestion_summary:']
    keys_yaml = keys_yaml + keys_fix_yaml

    # First fallback - try to convert 'relevant line: ...' to 'relevant line: |-\n        ...'
    response_text_lines_copy = response_text_lines.copy()
    for i in range(0, len(response_text_lines_copy)):
        for key in keys_yaml:
            if key in response_text_lines_copy[i] and not '|' in response_text_lines_copy[i]:
                response_text_lines_copy[i] = response_text_lines_copy[i].replace(f'{key}',
                                                                                  f'{key} |\n        ')
    try:
        data = yaml.safe_load('\n'.join(response_text_lines_copy))
        get_logger().info(f"Successfully parsed AI prediction after adding |-\\n")
        return data
    except:
        pass

    # 1.5 fallback - try to convert '|' to '|2'. Will solve cases of indent decreasing during the code
    response_text_copy = copy.deepcopy(response_text)
    response_text_copy = response_text_copy.replace('|\n', '|2\n')
    try:
        data = yaml.safe_load(response_text_copy)
        get_logger().info(f"Successfully parsed AI prediction after replacing | with |2")
        return data
    except:
        pass

    # Second fallback - try to extract first and last keys
    if first_key and last_key:
        try:
            first_idx = response_text.find(first_key)
            last_idx = response_text.rfind(last_key)
            if first_idx >= 0 and last_idx > first_idx:
                # Try to find the end of the last key's value
                lines_after_last = response_text[last_idx:].split('\n')
                # Find where next top-level key or end occurs
                end_of_value = len(response_text)
                for i, line in enumerate(lines_after_last[1:], 1):
                    if line and not line.startswith(' ') and not line.startswith('\t'):
                        end_of_value = last_idx + sum(len(l) + 1 for l in lines_after_last[:i])
                        break
                
                extracted = response_text[first_idx:end_of_value]
                data = yaml.safe_load(extracted)
                get_logger().info(f"Successfully parsed AI prediction after key extraction")
                return data
        except:
            pass

    return {}
