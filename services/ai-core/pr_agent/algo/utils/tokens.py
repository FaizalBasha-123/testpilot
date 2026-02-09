"""
Token Management Utilities
===========================

Functions for handling token limits and text clipping for LLMs.
"""

from pr_agent.algo import MAX_TOKENS
from pr_agent.algo.token_handler import TokenEncoder
from pr_agent.config_loader import get_settings
from pr_agent.log import get_logger


def get_max_tokens(model: str) -> int:
    """
    Get the maximum number of tokens allowed for a model.
    
    Logic:
    1. If the model is in './pr_agent/algo/__init__.py', use the value from there.
    2. Else, the user needs to define explicitly 'config.custom_model_max_tokens'
    
    For both cases, we further limit to 'config.max_model_tokens' if set.
    
    Args:
        model: Model name
        
    Returns:
        Maximum token count
    """
    max_tokens_model = MAX_TOKENS.get(model, -1)
    
    if max_tokens_model == -1:
        # Model not in predefined list
        max_tokens_model = get_settings().get("config.custom_model_max_tokens", 4000)
    
    # Apply user limit if set
    max_model_tokens_setting = get_settings().get("config.max_model_tokens")
    if max_model_tokens_setting:
        max_tokens_model = min(max_tokens_model, max_model_tokens_setting)
    
    return max_tokens_model


def clip_tokens(
    text: str,
    max_tokens: int,
    add_three_dots: bool = True,
    num_input_tokens: int = None,
    delete_last_line: bool = False
) -> str:
    """
    Clip the number of tokens in a string to a maximum number of tokens.

    This function limits text to a specified token count by calculating the approximate
    character limit based on the ratio of characters to tokens, then truncating the text.

    Args:
        text: The input text to be clipped
        max_tokens: The maximum number of tokens allowed in the output text
        add_three_dots: If True, adds "..." at the end of clipped text
        num_input_tokens: Pre-calculated token count (optimization to avoid recounting)
        delete_last_line: If True, removes the last (potentially partial) line after clipping

    Returns:
        The clipped text, or original text if within limits.
        If token encoding fails, the original text is returned with a warning logged.
    """
    if not text or max_tokens <= 0:
        return text
    
    try:
        encoder = TokenEncoder.get_token_encoder()
        
        # Get or calculate token count
        if num_input_tokens is None:
            tokens = encoder.encode(text)
            num_input_tokens = len(tokens)
        
        if num_input_tokens <= max_tokens:
            return text
        
        # Calculate approximate character limit
        # Use ratio-based approach for efficiency
        ratio = len(text) / num_input_tokens
        target_length = int(max_tokens * ratio * 0.95)  # 0.95 safety factor
        
        clipped = text[:target_length]
        
        if delete_last_line:
            # Remove last (potentially partial) line
            last_newline = clipped.rfind('\n')
            if last_newline > 0:
                clipped = clipped[:last_newline]
        
        if add_three_dots:
            clipped = clipped.rstrip() + "\n...(truncated)"
        
        return clipped
        
    except Exception as e:
        get_logger().warning(f"Token clipping failed: {e}")
        return text
