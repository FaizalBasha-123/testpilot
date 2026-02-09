"""
Markdown Generation Utilities
===============================

Functions for generating markdown output for PR reviews and suggestions.
"""

import textwrap
from typing import List

from pr_agent.algo.git_patch_processing import extract_hunk_lines_from_patch
from pr_agent.algo.utils.types import PRReviewHeader, TodoItem
from pr_agent.algo.utils.text import emphasize_header, is_value_no
from pr_agent.config_loader import get_settings
from pr_agent.log import get_logger


def convert_to_markdown_v2(
    output_data: dict,
    gfm_supported: bool = True,
    incremental_review=None,
    git_provider=None,
    files=None
) -> str:
    """
    Convert a dictionary of data into markdown format.
    
    Args:
        output_data: Dictionary containing review data
        gfm_supported: Whether GitHub Flavored Markdown is supported
        incremental_review: Incremental review info
        git_provider: Git provider for links
        files: List of files for context
        
    Returns:
        Markdown formatted string
    """
    emojis = {
        "Can be split": "🔀",
        "Key issues to review": "⚡",
        "Recommended focus areas for review": "⚡",
        "Score": "🏅",
        "Relevant tests": "🧪",
        "Focused PR": "✨",
        "Relevant ticket": "🎫",
        "Security concerns": "🔒",
        "Todo sections": "📝",
        "Insights from user's answers": "📝",
        "Code feedback": "🤖",
        "Estimated effort to review [1-5]": "⏱️",
        "Contribution time cost estimate": "⏳",
        "Ticket compliance check": "🎫",
    }
    
    markdown_text = ""
    if not incremental_review:
        markdown_text += f"{PRReviewHeader.REGULAR.value} 🔍\n\n"
    else:
        markdown_text += f"{PRReviewHeader.INCREMENTAL.value} 🔍\n\n"
        markdown_text += f"⏮️ Review for commits since previous PR-Agent review {incremental_review}.\n\n"
    
    if not output_data or not output_data.get('review', {}):
        return ""

    if get_settings().get("pr_reviewer.enable_intro_text", False):
        markdown_text += f"Here are some key observations to aid the review process:\n\n"

    if gfm_supported:
        markdown_text += "<table>\n"

    for key, value in output_data['review'].items():
        if value is None or value == '' or value == {} or value == []:
            if key.lower() not in ['can_be_split', 'key_issues_to_review']:
                continue
        key_nice = key.replace('_', ' ').capitalize()
        emoji = emojis.get(key_nice, "")
        
        # Handle different key types
        if 'Estimated effort to review' in key_nice:
            key_nice = 'Estimated effort to review'
            value = str(value).strip()
            try:
                value_int = int(value) if value.isnumeric() else int(value.split(',')[0])
            except ValueError:
                continue
            blue_bars = '🔵' * value_int
            white_bars = '⚪' * (5 - value_int)
            value = f"{value_int} {blue_bars}{white_bars}"
            if gfm_supported:
                markdown_text += f"<tr><td>{emoji}&nbsp;<strong>{key_nice}</strong>: {value}</td></tr>\n"
            else:
                markdown_text += f"### {emoji} {key_nice}: {value}\n\n"
        elif 'security concerns' in key_nice.lower():
            if gfm_supported:
                markdown_text += f"<tr><td>"
                if is_value_no(value):
                    markdown_text += f"{emoji}&nbsp;<strong>No security concerns identified</strong>"
                else:
                    markdown_text += f"{emoji}&nbsp;<strong>Security concerns</strong><br><br>\n\n"
                    value = emphasize_header(value.strip())
                    markdown_text += f"{value}"
                markdown_text += f"</td></tr>\n"
            else:
                if is_value_no(value):
                    markdown_text += f'### {emoji} No security concerns identified\n\n'
                else:
                    markdown_text += f"### {emoji} Security concerns\n\n"
                    value = emphasize_header(value.strip(), only_markdown=True)
                    markdown_text += f"{value}\n\n"
        else:
            if gfm_supported:
                markdown_text += f"<tr><td>"
                markdown_text += f"{emoji}&nbsp;<strong>{key_nice}</strong>: {value}"
                markdown_text += f"</td></tr>\n"
            else:
                markdown_text += f"### {emoji} {key_nice}: {value}\n\n"

    if gfm_supported:
        markdown_text += "</table>\n"

    return markdown_text


def extract_relevant_lines_str(
    end_line: int,
    files,
    relevant_file: str,
    start_line: int,
    dedent: bool = False
) -> str:
    """
    Extract relevant lines from a file as a formatted string.
    
    Args:
        end_line: End line number
        files: List of files
        relevant_file: File to extract from
        start_line: Start line number
        dedent: Whether to remove common leading whitespace
        
    Returns:
        Formatted code block string
    """
    try:
        relevant_lines_str = ""
        if files:
            from pr_agent.algo.utils.pr_utils import set_file_languages
            files = set_file_languages(files)
            
            for file in files:
                if file.filename.strip() == relevant_file:
                    if not file.head_file:
                        # Fallback to patch extraction
                        patch = file.patch
                        _, selected_lines = extract_hunk_lines_from_patch(
                            patch, file.filename, start_line, end_line, side='right'
                        )
                        if not selected_lines:
                            return ""
                        relevant_lines_str = ""
                        for line in selected_lines.splitlines():
                            if line.startswith('-'):
                                continue
                            relevant_lines_str += line[1:] + '\n'
                    else:
                        relevant_file_lines = file.head_file.splitlines()
                        relevant_lines_str = "\n".join(relevant_file_lines[start_line - 1:end_line])

                    if dedent and relevant_lines_str:
                        relevant_lines_str = textwrap.dedent(relevant_lines_str)
                    relevant_lines_str = f"```{file.language}\n{relevant_lines_str}\n```"
                    break

        return relevant_lines_str
    except Exception as e:
        get_logger().exception(f"Failed to extract relevant lines: {e}")
        return ""


def ticket_markdown_logic(emoji: str, markdown_text: str, value, gfm_supported: bool) -> str:
    """
    Generate markdown for ticket compliance check.
    
    Args:
        emoji: Emoji to use
        markdown_text: Existing markdown text
        value: Ticket compliance data
        gfm_supported: Whether GFM is supported
        
    Returns:
        Updated markdown text
    """
    # Simplified implementation
    if isinstance(value, list) and value:
        if gfm_supported:
            markdown_text += f"<tr><td>{emoji}&nbsp;<strong>Ticket compliance</strong></td></tr>\n"
        else:
            markdown_text += f"### {emoji} Ticket compliance\n\n"
    return markdown_text


def process_can_be_split(emoji: str, value) -> str:
    """
    Process the 'can be split' field.
    
    Args:
        emoji: Emoji to use
        value: Split data
        
    Returns:
        Markdown text
    """
    try:
        key_nice = "Multiple PR themes"
        markdown_text = ""
        if not value or isinstance(value, list) and len(value) == 1:
            markdown_text += f"{emoji} <strong>No multiple PR themes</strong>\n\n"
        else:
            markdown_text += f"{emoji} <strong>{key_nice}</strong><br><br>\n\n"
            for split in value:
                title = split.get('title', '')
                relevant_files = split.get('relevant_files', [])
                markdown_text += f"<details><summary>\nSub-PR theme: <b>{title}</b></summary>\n\n"
                markdown_text += f"___\n\nRelevant files:\n\n"
                for file in relevant_files:
                    markdown_text += f"- {file}\n"
                markdown_text += f"___\n\n</details>\n\n"
    except Exception as e:
        get_logger().exception(f"Failed to process can be split: {e}")
        return ""
    return markdown_text


def parse_code_suggestion(code_suggestion: dict, i: int = 0, gfm_supported: bool = True) -> str:
    """
    Convert a code suggestion dictionary into markdown format.
    
    Args:
        code_suggestion: Suggestion data
        i: Index number
        gfm_supported: Whether GFM is supported
        
    Returns:
        Markdown formatted string
    """
    markdown_text = ""
    if gfm_supported and 'relevant_line' in code_suggestion:
        markdown_text += '<table>'
        for sub_key, sub_value in code_suggestion.items():
            try:
                if sub_key.lower() == 'relevant_file':
                    relevant_file = sub_value.strip('`').strip('"').strip("'")
                    markdown_text += f"<tr><td>relevant file</td><td>{relevant_file}</td></tr>"
                elif sub_key.lower() == 'suggestion':
                    markdown_text += (f"<tr><td>{sub_key} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>"
                                      f"<td>\n\n<strong>\n\n{sub_value.strip()}\n\n</strong>\n</td></tr>")
                elif sub_key.lower() == 'relevant_line':
                    markdown_text += f"<tr><td>relevant line</td>"
                    sub_value_list = sub_value.split('](')
                    relevant_line = sub_value_list[0].lstrip('`').lstrip('[')
                    if len(sub_value_list) > 1:
                        link = sub_value_list[1].rstrip(')').strip('`')
                        markdown_text += f"<td><a href='{link}'>{relevant_line}</a></td>"
                    else:
                        markdown_text += f"<td>{relevant_line}</td>"
                    markdown_text += "</tr>"
            except Exception as e:
                get_logger().exception(f"Failed to parse code suggestion: {e}")
        markdown_text += '</table>'
        markdown_text += "<hr>"
    else:
        for sub_key, sub_value in code_suggestion.items():
            if isinstance(sub_key, str):
                sub_key = sub_key.rstrip()
            if isinstance(sub_value, str):
                sub_value = sub_value.rstrip()
            if isinstance(sub_value, dict):
                markdown_text += f"  - **{sub_key}:**\n"
                for code_key, code_value in sub_value.items():
                    code_str = f"```\n{code_value}\n```"
                    code_str_indented = textwrap.indent(code_str, '        ')
                    markdown_text += f"    - **{code_key}:**\n{code_str_indented}\n"
            else:
                if "relevant_file" in sub_key.lower():
                    markdown_text += f"\n  - **{sub_key}:** {sub_value}  \n"
                else:
                    markdown_text += f"   **{sub_key}:** {sub_value}  \n"
                if "relevant_line" not in sub_key.lower():
                    markdown_text = markdown_text.rstrip('\n') + "   \n"

        markdown_text += "\n"
    return markdown_text


def format_todo_item(todo_item: TodoItem, git_provider, gfm_supported: bool) -> str:
    """
    Format a single TODO item.
    
    Args:
        todo_item: TODO item data
        git_provider: Git provider for link generation
        gfm_supported: Whether GFM is supported
        
    Returns:
        Formatted string
    """
    relevant_file = todo_item.get('relevant_file', '').strip()
    line_number = todo_item.get('line_number', '')
    content = todo_item.get('content', '')
    reference_link = git_provider.get_line_link(relevant_file, line_number, line_number) if git_provider else None
    file_ref = f"{relevant_file} [{line_number}]"
    
    if reference_link:
        if gfm_supported:
            file_ref = f"<a href='{reference_link}'>{file_ref}</a>"
        else:
            file_ref = f"[{file_ref}]({reference_link})"

    if content:
        return f"{file_ref}: {content.strip()}"
    else:
        return file_ref


def format_todo_items(value: List[TodoItem], git_provider, gfm_supported: bool) -> str:
    """
    Format a list of TODO items.
    
    Args:
        value: List of TODO items
        git_provider: Git provider
        gfm_supported: Whether GFM is supported
        
    Returns:
        Formatted markdown string
    """
    markdown_text = ""
    MAX_ITEMS = 5
    
    if gfm_supported:
        if isinstance(value, list):
            markdown_text += "<ul>\n"
            if len(value) > MAX_ITEMS:
                value = value[:MAX_ITEMS]
            for todo_item in value:
                markdown_text += f"<li>{format_todo_item(todo_item, git_provider, gfm_supported)}</li>\n"
            markdown_text += "</ul>\n"
        else:
            markdown_text += f"<p>{format_todo_item(value, git_provider, gfm_supported)}</p>\n"
    else:
        if isinstance(value, list):
            if len(value) > MAX_ITEMS:
                value = value[:MAX_ITEMS]
            for todo_item in value:
                markdown_text += f"- {format_todo_item(todo_item, git_provider, gfm_supported)}\n"
        else:
            markdown_text += f"- {format_todo_item(value, git_provider, gfm_supported)}\n"
            
    return markdown_text
