"""
Learning from Feedback - Adaptive Review System
=================================================

This module implements CodeRabbit-style learning from user feedback.
Features:
- Track thumbs up/down on suggestions
- Learn repository-specific preferences
- Adjust review prompts based on history
- Suppress disliked suggestion patterns
- Boost approved suggestion patterns

Storage: SQLite for simplicity (can be swapped to PostgreSQL)

Author: BlackboxTester Team
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from contextlib import contextmanager

from pr_agent.log import get_logger


class FeedbackType(Enum):
    """Types of user feedback."""
    POSITIVE = "positive"      # 👍 Thumbs up
    NEGATIVE = "negative"      # 👎 Thumbs down
    APPLIED = "applied"        # User applied the fix
    REJECTED = "rejected"      # User explicitly rejected
    IGNORED = "ignored"        # User didn't interact


class SuggestionCategory(Enum):
    """Categories of suggestions."""
    SECURITY = "security"
    PERFORMANCE = "performance"
    STYLE = "style"
    BUG = "bug"
    DOCS = "docs"
    REFACTOR = "refactor"


@dataclass
class FeedbackRecord:
    """A single feedback record."""
    id: Optional[int] = None
    repo: str = ""
    category: str = ""
    rule_pattern: str = ""       # e.g., "sql-injection", "unused-variable"
    suggestion_hash: str = ""     # Hash of the suggestion for deduplication
    feedback_type: str = ""
    context: str = ""             # Additional context about why
    created_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LearningStats:
    """Statistics for a particular pattern."""
    pattern: str
    positive_count: int
    negative_count: int
    applied_count: int
    rejected_count: int
    net_score: float  # positive - negative + (applied * 2) - (rejected * 2)
    
    @property
    def should_boost(self) -> bool:
        """Should this pattern be boosted in prompts?"""
        return self.net_score >= 2.0
    
    @property
    def should_suppress(self) -> bool:
        """Should this pattern be suppressed?"""
        return self.net_score <= -2.0


class FeedbackDatabase:
    """
    SQLite-based storage for feedback data.
    """
    
    def __init__(self, db_path: str = None):
        """
        Initialize database.
        
        Args:
            db_path: Path to SQLite database. Defaults to ~/.blackbox/learning.db
        """
        if db_path is None:
            db_dir = Path.home() / ".blackbox"
            db_dir.mkdir(exist_ok=True)
            db_path = str(db_dir / "learning.db")
        
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo TEXT NOT NULL,
                    category TEXT NOT NULL,
                    rule_pattern TEXT NOT NULL,
                    suggestion_hash TEXT,
                    feedback_type TEXT NOT NULL,
                    context TEXT,
                    created_at TEXT NOT NULL,
                    
                    -- Indexes for fast lookup
                    UNIQUE(repo, rule_pattern, suggestion_hash)
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_feedback_repo 
                ON feedback(repo)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_feedback_pattern 
                ON feedback(repo, rule_pattern)
            """)
            
            # Table for storing learned preferences
            conn.execute("""
                CREATE TABLE IF NOT EXISTS preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo TEXT NOT NULL,
                    preference_key TEXT NOT NULL,
                    preference_value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    
                    UNIQUE(repo, preference_key)
                )
            """)
    
    @contextmanager
    def _get_conn(self):
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    
    def record_feedback(
        self,
        repo: str,
        category: str,
        rule_pattern: str,
        feedback_type: FeedbackType,
        suggestion_hash: str = "",
        context: str = ""
    ) -> bool:
        """
        Record user feedback.
        
        Args:
            repo: Repository identifier (e.g., "owner/repo")
            category: Category of suggestion
            rule_pattern: Pattern/rule that generated the suggestion
            feedback_type: Type of feedback
            suggestion_hash: Optional hash for deduplication
            context: Optional additional context
            
        Returns:
            True if recorded successfully
        """
        try:
            with self._get_conn() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO feedback 
                    (repo, category, rule_pattern, suggestion_hash, feedback_type, context, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    repo,
                    category,
                    rule_pattern,
                    suggestion_hash,
                    feedback_type.value,
                    context,
                    datetime.utcnow().isoformat()
                ))
            return True
        except Exception as e:
            get_logger().error(f"Failed to record feedback: {e}")
            return False
    
    def get_pattern_stats(self, repo: str, rule_pattern: str) -> LearningStats:
        """Get statistics for a specific pattern in a repo."""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT 
                    feedback_type,
                    COUNT(*) as count
                FROM feedback
                WHERE repo = ? AND rule_pattern = ?
                GROUP BY feedback_type
            """, (repo, rule_pattern))
            
            stats = {
                "positive": 0,
                "negative": 0,
                "applied": 0,
                "rejected": 0
            }
            
            for row in cursor:
                if row["feedback_type"] in stats:
                    stats[row["feedback_type"]] = row["count"]
            
            net_score = (
                stats["positive"] - stats["negative"] +
                stats["applied"] * 2 - stats["rejected"] * 2
            )
            
            return LearningStats(
                pattern=rule_pattern,
                positive_count=stats["positive"],
                negative_count=stats["negative"],
                applied_count=stats["applied"],
                rejected_count=stats["rejected"],
                net_score=net_score
            )
    
    def get_all_patterns(self, repo: str) -> Dict[str, LearningStats]:
        """Get stats for all patterns in a repo."""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT DISTINCT rule_pattern
                FROM feedback
                WHERE repo = ?
            """, (repo,))
            
            patterns = [row["rule_pattern"] for row in cursor]
        
        return {p: self.get_pattern_stats(repo, p) for p in patterns}
    
    def get_boosted_patterns(self, repo: str) -> List[str]:
        """Get patterns that should be boosted."""
        all_stats = self.get_all_patterns(repo)
        return [p for p, s in all_stats.items() if s.should_boost]
    
    def get_suppressed_patterns(self, repo: str) -> List[str]:
        """Get patterns that should be suppressed."""
        all_stats = self.get_all_patterns(repo)
        return [p for p, s in all_stats.items() if s.should_suppress]
    
    def set_preference(self, repo: str, key: str, value: str) -> bool:
        """Set a repo preference."""
        try:
            with self._get_conn() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO preferences
                    (repo, preference_key, preference_value, updated_at)
                    VALUES (?, ?, ?, ?)
                """, (repo, key, value, datetime.utcnow().isoformat()))
            return True
        except Exception as e:
            get_logger().error(f"Failed to set preference: {e}")
            return False
    
    def get_preference(self, repo: str, key: str, default: str = "") -> str:
        """Get a repo preference."""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT preference_value
                FROM preferences
                WHERE repo = ? AND preference_key = ?
            """, (repo, key))
            row = cursor.fetchone()
            return row["preference_value"] if row else default


class FeedbackLearner:
    """
    Main class for learning from feedback and adjusting prompts.
    """
    
    def __init__(self, db: FeedbackDatabase = None):
        """
        Initialize FeedbackLearner.
        
        Args:
            db: Optional database instance
        """
        self.db = db or FeedbackDatabase()
        self.logger = get_logger()
    
    def record_feedback(
        self,
        repo: str,
        rule: str,
        is_positive: bool,
        was_applied: bool = False,
        category: str = "general"
    ) -> bool:
        """
        Record user feedback on a suggestion.
        
        Args:
            repo: Repository identifier
            rule: Rule/pattern that generated the suggestion
            is_positive: True for 👍, False for 👎
            was_applied: True if user applied the fix
            category: Category of suggestion
        """
        if was_applied:
            feedback_type = FeedbackType.APPLIED
        elif is_positive:
            feedback_type = FeedbackType.POSITIVE
        else:
            feedback_type = FeedbackType.NEGATIVE
        
        return self.db.record_feedback(
            repo=repo,
            category=category,
            rule_pattern=rule,
            feedback_type=feedback_type
        )
    
    def adjust_prompt(self, repo: str, base_prompt: str) -> str:
        """
        Adjust a prompt based on learned preferences.
        
        Args:
            repo: Repository identifier
            base_prompt: Original prompt
            
        Returns:
            Adjusted prompt with learned preferences
        """
        # Get patterns to boost/suppress
        boosted = self.db.get_boosted_patterns(repo)
        suppressed = self.db.get_suppressed_patterns(repo)
        
        if not boosted and not suppressed:
            return base_prompt
        
        # Build adjustment section
        adjustments = []
        
        if boosted:
            adjustments.append(
                f"IMPORTANT: User has positively responded to suggestions about: "
                f"{', '.join(boosted)}. Focus on these areas."
            )
        
        if suppressed:
            adjustments.append(
                f"AVOID: User has negatively responded to suggestions about: "
                f"{', '.join(suppressed)}. Minimize or skip these suggestions."
            )
        
        # Get custom preferences
        style_pref = self.db.get_preference(repo, "code_style")
        if style_pref:
            adjustments.append(f"STYLE PREFERENCE: {style_pref}")
        
        if adjustments:
            adjustment_text = "\n\n[LEARNED PREFERENCES]\n" + "\n".join(adjustments) + "\n"
            return base_prompt + adjustment_text
        
        return base_prompt
    
    def get_repo_insights(self, repo: str) -> Dict[str, Any]:
        """
        Get insights about a repository's feedback patterns.
        
        Returns dict with statistics about what the repo prefers.
        """
        all_stats = self.db.get_all_patterns(repo)
        
        total_positive = sum(s.positive_count for s in all_stats.values())
        total_negative = sum(s.negative_count for s in all_stats.values())
        total_applied = sum(s.applied_count for s in all_stats.values())
        
        return {
            "total_feedback_count": total_positive + total_negative + total_applied,
            "acceptance_rate": total_positive / max(1, total_positive + total_negative),
            "apply_rate": total_applied / max(1, total_positive),
            "boosted_patterns": self.db.get_boosted_patterns(repo),
            "suppressed_patterns": self.db.get_suppressed_patterns(repo),
            "all_patterns": {p: s.net_score for p, s in all_stats.items()}
        }
    
    def should_skip_rule(self, repo: str, rule: str) -> bool:
        """
        Check if a rule should be skipped based on feedback.
        """
        stats = self.db.get_pattern_stats(repo, rule)
        return stats.should_suppress
    
    def get_confidence_boost(self, repo: str, rule: str) -> float:
        """
        Get confidence boost/penalty for a rule.
        
        Returns:
            Multiplier (1.0 = no change, >1 = boost, <1 = penalty)
        """
        stats = self.db.get_pattern_stats(repo, rule)
        
        if stats.net_score >= 5:
            return 1.3  # 30% boost
        elif stats.net_score >= 2:
            return 1.1  # 10% boost
        elif stats.net_score <= -5:
            return 0.5  # 50% penalty
        elif stats.net_score <= -2:
            return 0.8  # 20% penalty
        
        return 1.0


# ============================================================================
# Convenience Functions
# ============================================================================

# Global instance for easy access
_default_learner = None


def get_learner() -> FeedbackLearner:
    """Get the default FeedbackLearner instance."""
    global _default_learner
    if _default_learner is None:
        _default_learner = FeedbackLearner()
    return _default_learner


def record_positive_feedback(repo: str, rule: str, category: str = "general"):
    """Record positive feedback (👍)."""
    return get_learner().record_feedback(repo, rule, is_positive=True, category=category)


def record_negative_feedback(repo: str, rule: str, category: str = "general"):
    """Record negative feedback (👎)."""
    return get_learner().record_feedback(repo, rule, is_positive=False, category=category)


def record_fix_applied(repo: str, rule: str, category: str = "general"):
    """Record that a fix was applied."""
    return get_learner().record_feedback(repo, rule, is_positive=True, was_applied=True, category=category)
