"""
Commit Review Engine
====================

Specialized engine for reviewing individual commits from VS Code extension.
Unlike PR review (which has full PR context), commit review works on:
- Single commit diff
- Local repository context
- Immediate feedback loop

Features:
- Fast review (< 5 seconds target)
- Context from code graph
- Severity-based findings
"""

import os
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

# Import from reorganized structure
try:
    from ..adapters.litellm_ai_handler import LiteLLMAIHandler
    from ..context.code_graph import CodeGraphBuilder, detect_language
    from ..models.findings import UnifiedFinding, FindingSeverity, FindingCategory, FindingSource
except ImportError:
    # Fallback for direct execution
    from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
    from pr_agent.algo.code_graph import CodeGraphBuilder, detect_language
    from pr_agent.algo.findings import UnifiedFinding, FindingSeverity, FindingCategory, FindingSource


class ReviewType(str, Enum):
    """Types of commit review."""
    QUICK = "quick"      # < 5 seconds, basic issues
    STANDARD = "standard"  # < 15 seconds, with context
    DEEP = "deep"        # < 60 seconds, full analysis


@dataclass
class CommitReviewRequest:
    """Request for commit review."""
    commit_hash: str
    diff_content: str
    changed_files: List[str]
    commit_message: str = ""
    workspace_path: Optional[str] = None
    review_type: ReviewType = ReviewType.STANDARD


@dataclass
class CommitReviewResult:
    """Result of commit review."""
    commit_hash: str
    findings: List[UnifiedFinding] = field(default_factory=list)
    summary: str = ""
    review_time_ms: int = 0
    context_files_used: int = 0


class CommitReviewEngine:
    """
    Engine for reviewing individual commits.
    
    Optimized for:
    - Speed (< 15 seconds for standard review)
    - VS Code integration
    - Immediate developer feedback
    """
    
    def __init__(self, ai_handler: LiteLLMAIHandler = None):
        """
        Initialize commit review engine.
        
        Args:
            ai_handler: Optional AI handler, creates new one if not provided
        """
        self.ai_handler = ai_handler or LiteLLMAIHandler()
        self._model = os.environ.get("COMMIT_REVIEW_MODEL", "groq/llama-3.3-70b-versatile")
    
    async def review(self, request: CommitReviewRequest) -> CommitReviewResult:
        """
        Review a commit.
        
        Args:
            request: CommitReviewRequest with diff and context
        
        Returns:
            CommitReviewResult with findings
        """
        import time
        start_time = time.time()
        
        # Build context if workspace provided
        context = ""
        context_files_used = 0
        if request.workspace_path and request.review_type != ReviewType.QUICK:
            context, context_files_used = self._build_context(
                request.workspace_path,
                request.changed_files
            )
        
        # Create prompt
        prompt = self._create_prompt(request, context)
        
        # Call AI
        system_prompt = self._get_system_prompt(request.review_type)
        response = await self.ai_handler.chat_completion(
            model=self._model,
            system=system_prompt,
            user=prompt,
            temperature=0.2
        )
        
        # Parse response
        findings, summary = self._parse_response(response, request.commit_hash)
        
        review_time_ms = int((time.time() - start_time) * 1000)
        
        return CommitReviewResult(
            commit_hash=request.commit_hash,
            findings=findings,
            summary=summary,
            review_time_ms=review_time_ms,
            context_files_used=context_files_used
        )
    
    def _build_context(self, workspace_path: str, changed_files: List[str]) -> tuple:
        """Build context from code graph for changed files."""
        try:
            builder = CodeGraphBuilder(workspace_path, max_depth=2, max_deps=10)
            contexts = []
            
            for file_path in changed_files[:5]:  # Limit to 5 files
                try:
                    ctx = builder.build_context(file_path)
                    formatted = builder.format_context_for_llm(ctx)
                    if formatted:
                        contexts.append(f"=== Context for {file_path} ===\n{formatted}")
                except Exception:
                    continue
            
            return "\n\n".join(contexts), len(contexts)
        except Exception:
            return "", 0
    
    def _get_system_prompt(self, review_type: ReviewType) -> str:
        """Get system prompt based on review type."""
        base = """You are an expert code reviewer. Review the commit and identify issues.

Focus on:
- Bugs and logic errors
- Security vulnerabilities
- Performance problems
- Code style issues

Return JSON format:
{
    "summary": "Brief summary of the commit quality",
    "findings": [
        {
            "severity": "critical|high|medium|low|info",
            "category": "bug|security|performance|style|documentation",
            "file": "path/to/file",
            "line": 42,
            "message": "Description of the issue",
            "suggestion": "How to fix it"
        }
    ]
}

If no issues found, return an empty findings array with a positive summary."""
        
        if review_type == ReviewType.QUICK:
            return base + "\n\nBe concise. Focus only on critical and high severity issues."
        elif review_type == ReviewType.DEEP:
            return base + "\n\nBe thorough. Include style suggestions and best practices."
        return base
    
    def _create_prompt(self, request: CommitReviewRequest, context: str) -> str:
        """Create the review prompt."""
        prompt_parts = []
        
        if request.commit_message:
            prompt_parts.append(f"## Commit Message\n{request.commit_message}")
        
        prompt_parts.append(f"## Changed Files\n{', '.join(request.changed_files)}")
        
        if context:
            prompt_parts.append(f"## Code Context\n{context}")
        
        prompt_parts.append(f"## Diff\n```diff\n{request.diff_content}\n```")
        
        return "\n\n".join(prompt_parts)
    
    def _parse_response(self, response: str, commit_hash: str) -> tuple:
        """Parse AI response into findings."""
        findings = []
        summary = "Review completed"
        
        try:
            # Extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(response[json_start:json_end])
                summary = data.get("summary", summary)
                
                for item in data.get("findings", []):
                    severity = self._parse_severity(item.get("severity", "info"))
                    category = self._parse_category(item.get("category", "bug"))
                    
                    finding = UnifiedFinding(
                        id=f"{commit_hash[:8]}-{len(findings)}",
                        source=FindingSource.AI_REVIEW,
                        severity=severity,
                        category=category,
                        file_path=item.get("file", ""),
                        line_number=item.get("line", 0),
                        message=item.get("message", ""),
                        suggestion=item.get("suggestion", "")
                    )
                    findings.append(finding)
        except json.JSONDecodeError:
            # If JSON parsing fails, create a single finding with the raw response
            findings.append(UnifiedFinding(
                id=f"{commit_hash[:8]}-parse-error",
                source=FindingSource.AI_REVIEW,
                severity=FindingSeverity.INFO,
                category=FindingCategory.OTHER,
                file_path="",
                line_number=0,
                message="AI response parsing failed",
                suggestion=response[:500]
            ))
        
        return findings, summary
    
    def _parse_severity(self, severity: str) -> FindingSeverity:
        """Parse severity string to enum."""
        mapping = {
            "critical": FindingSeverity.CRITICAL,
            "high": FindingSeverity.HIGH,
            "medium": FindingSeverity.MEDIUM,
            "low": FindingSeverity.LOW,
            "info": FindingSeverity.INFO
        }
        return mapping.get(severity.lower(), FindingSeverity.INFO)
    
    def _parse_category(self, category: str) -> FindingCategory:
        """Parse category string to enum."""
        mapping = {
            "bug": FindingCategory.BUG,
            "security": FindingCategory.SECURITY,
            "performance": FindingCategory.PERFORMANCE,
            "style": FindingCategory.CODE_SMELL,
            "documentation": FindingCategory.OTHER
        }
        return mapping.get(category.lower(), FindingCategory.OTHER)


# ============================================================================
# Convenience Functions
# ============================================================================

_engine: Optional[CommitReviewEngine] = None

def get_commit_review_engine() -> CommitReviewEngine:
    """Get singleton commit review engine."""
    global _engine
    if _engine is None:
        _engine = CommitReviewEngine()
    return _engine


async def review_commit(
    commit_hash: str,
    diff_content: str,
    changed_files: List[str],
    commit_message: str = "",
    workspace_path: str = None,
    quick: bool = False
) -> Dict[str, Any]:
    """
    Convenience function to review a commit.
    
    Args:
        commit_hash: Git commit hash
        diff_content: Git diff output
        changed_files: List of changed file paths
        commit_message: Optional commit message
        workspace_path: Optional workspace path for context
        quick: Use quick review mode (faster, less thorough)
    
    Returns:
        Dict with findings and summary
    """
    engine = get_commit_review_engine()
    
    request = CommitReviewRequest(
        commit_hash=commit_hash,
        diff_content=diff_content,
        changed_files=changed_files,
        commit_message=commit_message,
        workspace_path=workspace_path,
        review_type=ReviewType.QUICK if quick else ReviewType.STANDARD
    )
    
    result = await engine.review(request)
    
    return {
        "commit_hash": result.commit_hash,
        "summary": result.summary,
        "review_time_ms": result.review_time_ms,
        "context_files_used": result.context_files_used,
        "findings": [
            {
                "id": f.id,
                "severity": f.severity.value,
                "category": f.category.value,
                "file_path": f.file_path,
                "line_number": f.line_number,
                "message": f.message,
                "suggestion": f.suggestion
            }
            for f in result.findings
        ]
    }
