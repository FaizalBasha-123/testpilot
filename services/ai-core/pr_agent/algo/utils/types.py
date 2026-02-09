"""
Types and Models for PR Agent
==============================

Core type definitions, enums, and model selection utilities.
"""

from enum import Enum
from typing import Any, Tuple, TypedDict

from pydantic import BaseModel
from starlette_context import context

from pr_agent.config_loader import get_settings, global_settings


# ============================================================================
# Type Definitions
# ============================================================================

class Range(BaseModel):
    """Line/column range in a file."""
    line_start: int  # should be 0-indexed
    line_end: int
    column_start: int = -1
    column_end: int = -1


class ModelType(str, Enum):
    """AI model strength levels."""
    REGULAR = "regular"
    WEAK = "weak"
    REASONING = "reasoning"


class TodoItem(TypedDict):
    """A TODO item found in code."""
    relevant_file: str
    line_range: Tuple[int, int]
    content: str


class PRReviewHeader(str, Enum):
    """Headers for PR review output."""
    REGULAR = "## PR Reviewer Guide"
    INCREMENTAL = "## Incremental PR Reviewer Guide"


class ReasoningEffort(str, Enum):
    """Reasoning effort levels for AI models."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PRDescriptionHeader(str, Enum):
    """Headers for PR description sections."""
    DIAGRAM_WALKTHROUGH = "Diagram Walkthrough"
    FILE_WALKTHROUGH = "File Walkthrough"


# ============================================================================
# Model Selection
# ============================================================================

def get_model(model_type: str = "model_weak") -> str:
    """
    Get the appropriate AI model based on type.
    
    Args:
        model_type: "model_weak", "model_reasoning", or default
        
    Returns:
        Model name string
    """
    if model_type == "model_weak" and get_settings().get("config.model_weak"):
        return get_settings().config.model_weak
    elif model_type == "model_reasoning" and get_settings().get("config.model_reasoning"):
        return get_settings().config.model_reasoning
    return get_settings().config.model


def get_setting(key: str) -> Any:
    """
    Get a setting value by key.
    
    Args:
        key: Setting key (will be uppercased)
        
    Returns:
        Setting value or None
    """
    try:
        key = key.upper()
        return context.get("settings", global_settings).get(key, global_settings.get(key, None))
    except Exception:
        return global_settings.get(key, None)
