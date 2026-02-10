"""
Fix Generator - One-Click Applicable Fixes
===========================================

This module generates semantic diffs that can be applied with one click.
Unlike simple text suggestions, it provides:
- Exact original code to replace
- Exact fixed code
- Line range for precise replacement
- Confidence score

This matches CodeRabbit's "Apply Fix" feature.

Author: BlackboxTester Team
"""

import os
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from pr_agent.log import get_logger
from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
from pr_agent.config_loader import get_settings


class FixType(Enum):
    """Types of fixes that can be generated."""
    SECURITY = "security"
    PERFORMANCE = "performance"
    STYLE = "style"
    BUG = "bug"
    REFACTOR = "refactor"


@dataclass
class GeneratedFix:
    """Represents a one-click applicable fix."""
    issue_id: str
    issue_message: str
    fix_type: FixType
    
    # Location
    file_path: str
    start_line: int
    end_line: int
    
    # Content
    original_code: str
    fixed_code: str
    
    # Explanation
    explanation: str
    
    # Confidence (0-1)
    confidence: float
    
    # Whether this fix has been reviewed/tested
    is_validated: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "issue_id": self.issue_id,
            "issue_message": self.issue_message,
            "fix_type": self.fix_type.value,
            "file_path": self.file_path,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "original_code": self.original_code,
            "fixed_code": self.fixed_code,
            "explanation": self.explanation,
            "confidence": self.confidence,
            "is_validated": self.is_validated
        }
    
    def apply_to_content(self, file_content: str) -> str:
        """Apply this fix to file content."""
        lines = file_content.splitlines(keepends=True)
        
        # Replace the affected lines
        # Convert to 0-indexed
        start_idx = self.start_line - 1
        end_idx = self.end_line
        
        # Ensure fixed_code ends with newline if original lines did
        fixed_lines = self.fixed_code
        if lines[start_idx:end_idx] and lines[end_idx-1].endswith('\n'):
            if not fixed_lines.endswith('\n'):
                fixed_lines += '\n'
        
        # Reconstruct
        new_lines = lines[:start_idx] + [fixed_lines] + lines[end_idx:]
        return ''.join(new_lines)


class FixGenerator:
    """
    Generates one-click applicable fixes using LLM.
    """
    
    def __init__(self, ai_handler: LiteLLMAIHandler = None):
        """
        Initialize FixGenerator.
        
        Args:
            ai_handler: Optional AI handler, creates new one if not provided
        """
        self.ai_handler = ai_handler or LiteLLMAIHandler()
        self.logger = get_logger()
    
    async def generate_fix(
        self,
        issue_id: str,
        issue_message: str,
        issue_type: str,
        file_path: str,
        file_content: str,
        affected_line: int,
        context_code: str = "",
        fix_type: FixType = FixType.BUG
    ) -> Optional[GeneratedFix]:
        """
        Generate a one-click fix for an issue.
        
        Args:
            issue_id: Unique identifier for the issue
            issue_message: Description of the issue
            issue_type: Type from static analyzer (e.g., "sql-injection")
            file_path: Path to the affected file
            file_content: Full content of the file
            affected_line: Line number where issue occurs
            context_code: Additional code context (optional)
            fix_type: Category of fix
            
        Returns:
            GeneratedFix if successful, None if generation failed
        """
        try:
            # Extract the code around the affected line
            lines = file_content.splitlines()
            
            # Get context window (5 lines before and after)
            start_line = max(1, affected_line - 5)
            end_line = min(len(lines), affected_line + 5)
            
            code_snippet = '\n'.join(lines[start_line-1:end_line])
            
            # Build prompt
            prompt = self._build_fix_prompt(
                issue_message=issue_message,
                issue_type=issue_type,
                file_path=file_path,
                code_snippet=code_snippet,
                affected_line=affected_line,
                context_code=context_code
            )
            
            # Call LLM
            response, _ = await self.ai_handler.chat_completion(
                model=get_settings().config.model,
                system="You are a security-focused code fixer. Generate precise, minimal fixes.",
                user=prompt
            )
            
            # Parse response
            fix = self._parse_fix_response(
                response=response,
                issue_id=issue_id,
                issue_message=issue_message,
                file_path=file_path,
                file_content=file_content,
                affected_line=affected_line,
                fix_type=fix_type
            )
            
            return fix
            
        except Exception as e:
            self.logger.error(f"Fix generation failed: {e}")
            return None
    
    def _build_fix_prompt(
        self,
        issue_message: str,
        issue_type: str,
        file_path: str,
        code_snippet: str,
        affected_line: int,
        context_code: str
    ) -> str:
        """Build the prompt for fix generation."""
        return f"""You are a code security expert. Generate a minimal, safe fix for this issue.

ISSUE:
- Type: {issue_type}
- Message: {issue_message}
- File: {file_path}
- Affected Line: {affected_line}

CODE SNIPPET (lines around issue):
```
{code_snippet}
```

{f'ADDITIONAL CONTEXT:{chr(10)}{context_code}' if context_code else ''}

REQUIREMENTS:
1. Generate the EXACT code fix - no placeholders
2. Only change what's necessary to fix the issue
3. Preserve formatting, indentation, and style
4. Ensure the fix is syntactically correct

OUTPUT FORMAT (JSON):
{{
    "original_code": "... the exact code to replace (can be multi-line) ...",
    "fixed_code": "... the exact fixed code ...",
    "explanation": "Brief explanation of the fix",
    "start_line": <first line number of code to replace>,
    "end_line": <last line number of code to replace>,
    "confidence": <0.0 to 1.0>
}}

Return ONLY valid JSON, no markdown code blocks."""
    
    def _parse_fix_response(
        self,
        response: str,
        issue_id: str,
        issue_message: str,
        file_path: str,
        file_content: str,
        affected_line: int,
        fix_type: FixType
    ) -> Optional[GeneratedFix]:
        """Parse LLM response into GeneratedFix object."""
        import json
        
        try:
            # Clean up response - remove markdown code blocks if present
            response = response.strip()
            if response.startswith("```"):
                # Remove ```json and ```
                response = re.sub(r'^```\w*\n?', '', response)
                response = re.sub(r'\n?```$', '', response)
            
            data = json.loads(response)
            
            # Validate required fields
            required = ["original_code", "fixed_code", "explanation", "start_line", "end_line"]
            for field in required:
                if field not in data:
                    self.logger.warning(f"Missing field in fix response: {field}")
                    return None
            
            # Validate that original code exists in file
            if data["original_code"] not in file_content:
                self.logger.warning("Original code not found in file - fix may be inaccurate")
                # Try to find similar code
                lines = file_content.splitlines()
                actual_start = max(1, data["start_line"])
                actual_end = min(len(lines), data["end_line"])
                data["original_code"] = '\n'.join(lines[actual_start-1:actual_end])
            
            return GeneratedFix(
                issue_id=issue_id,
                issue_message=issue_message,
                fix_type=fix_type,
                file_path=file_path,
                start_line=data["start_line"],
                end_line=data["end_line"],
                original_code=data["original_code"],
                fixed_code=data["fixed_code"],
                explanation=data["explanation"],
                confidence=data.get("confidence", 0.7)
            )
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse fix JSON: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error parsing fix response: {e}")
            return None
    
    async def generate_fixes_for_issues(
        self,
        issues: List[Dict[str, Any]],
        file_path: str,
        file_content: str,
        context_code: str = ""
    ) -> List[GeneratedFix]:
        """
        Generate fixes for multiple issues in a file.
        
        Args:
            issues: List of issues from static analyzer
            file_path: Path to the file
            file_content: Content of the file
            context_code: Additional context
            
        Returns:
            List of generated fixes
        """
        fixes = []
        
        for issue in issues:
            issue_id = issue.get("key", issue.get("id", "unknown"))
            issue_message = issue.get("message", "Unknown issue")
            issue_type = issue.get("type", issue.get("rule", "unknown"))
            affected_line = issue.get("line", 1)
            
            # Determine fix type
            fix_type = self._classify_issue(issue_type)
            
            fix = await self.generate_fix(
                issue_id=issue_id,
                issue_message=issue_message,
                issue_type=issue_type,
                file_path=file_path,
                file_content=file_content,
                affected_line=affected_line,
                context_code=context_code,
                fix_type=fix_type
            )
            
            if fix:
                fixes.append(fix)
        
        return fixes
    
    def _classify_issue(self, issue_type: str) -> FixType:
        """Classify issue type into FixType category."""
        issue_lower = issue_type.lower()
        
        if any(kw in issue_lower for kw in ["security", "injection", "xss", "csrf", "vulnerability"]):
            return FixType.SECURITY
        elif any(kw in issue_lower for kw in ["performance", "slow", "optimize"]):
            return FixType.PERFORMANCE
        elif any(kw in issue_lower for kw in ["style", "format", "naming", "convention"]):
            return FixType.STYLE
        elif any(kw in issue_lower for kw in ["refactor", "duplicate", "complexity"]):
            return FixType.REFACTOR
        else:
            return FixType.BUG


# ============================================================================
# Convenience Functions
# ============================================================================

async def generate_single_fix(
    issue_message: str,
    file_path: str,
    file_content: str,
    affected_line: int
) -> Optional[GeneratedFix]:
    """
    Convenience function to generate a single fix.
    
    Example:
        fix = await generate_single_fix(
            "SQL injection vulnerability",
            "app/db.py",
            open("app/db.py").read(),
            42
        )
        if fix:
            new_content = fix.apply_to_content(file_content)
    """
    generator = FixGenerator()
    return await generator.generate_fix(
        issue_id="manual",
        issue_message=issue_message,
        issue_type="manual",
        file_path=file_path,
        file_content=file_content,
        affected_line=affected_line
    )


def format_fix_for_github_comment(fix: GeneratedFix) -> str:
    """
    Format a fix for display in a GitHub PR comment.
    
    Returns markdown with suggestion syntax.
    """
    return f"""### 🔧 Suggested Fix ({fix.fix_type.value})

**Issue:** {fix.issue_message}
**File:** `{fix.file_path}` (lines {fix.start_line}-{fix.end_line})
**Confidence:** {fix.confidence:.0%}

**Original:**
```
{fix.original_code}
```

**Fixed:**
```suggestion
{fix.fixed_code}
```

**Explanation:** {fix.explanation}
"""


def format_fix_for_ide(fix: GeneratedFix) -> Dict[str, Any]:
    """
    Format a fix for IDE consumption (VS Code, etc).
    
    Returns dict with all info needed for quick-fix UI.
    """
    return {
        "title": f"Fix: {fix.issue_message[:50]}...",
        "kind": "quickfix",
        "isPreferred": fix.confidence > 0.8,
        "diagnostics": [{
            "message": fix.issue_message,
            "range": {
                "start": {"line": fix.start_line - 1, "character": 0},
                "end": {"line": fix.end_line, "character": 0}
            },
            "severity": 1 if fix.fix_type == FixType.SECURITY else 2
        }],
        "edit": {
            "changes": [{
                "filePath": fix.file_path,
                "range": {
                    "start": {"line": fix.start_line - 1, "character": 0},
                    "end": {"line": fix.end_line, "character": 0}
                },
                "newText": fix.fixed_code
            }]
        },
        "data": fix.to_dict()
    }


# ============================================================================
# UnifiedFinding Support
# ============================================================================

async def generate_fix_for_unified_finding(
    finding,  # UnifiedFinding from findings.py
    file_content: str,
    context_code: str = ""
) -> Optional[GeneratedFix]:
    """
    Generate a fix for a UnifiedFinding (from AI or Sonar).
    
    This bridges the new unified findings system with the fix generator.
    
    Args:
        finding: UnifiedFinding instance
        file_content: Content of the affected file
        context_code: Additional context (from code graph)
        
    Returns:
        GeneratedFix if successful
    """
    generator = FixGenerator()
    
    # Map category to fix type
    category_map = {
        "security": FixType.SECURITY,
        "bug": FixType.BUG,
        "logic": FixType.BUG,
        "performance": FixType.PERFORMANCE,
        "style": FixType.STYLE,
        "maintainability": FixType.REFACTOR,
    }
    fix_type = category_map.get(finding.category, FixType.BUG)
    
    # Add Sonar rule context if available
    enhanced_context = context_code
    if finding.sonar_rule_id:
        enhanced_context += f"\n\nSonar Rule: {finding.sonar_rule_id}\n"
        enhanced_context += "This is a static analysis finding - ensure the fix addresses the specific rule.\n"
    
    return await generator.generate_fix(
        issue_id=finding.id,
        issue_message=finding.title,
        issue_type=finding.category,
        file_path=finding.file,
        file_content=file_content,
        affected_line=finding.start_line,
        context_code=enhanced_context,
        fix_type=fix_type
    )


async def batch_generate_fixes_for_findings(
    findings: List,  # List[UnifiedFinding]
    file_contents: Dict[str, str],
    code_graph: Dict[str, Any] = None
) -> List:
    """
    Batch generate fixes for multiple UnifiedFinding objects.
    
    Groups by file for efficiency and generates fixes in parallel.
    
    Args:
        findings: List of UnifiedFinding instances needing fixes
        file_contents: Dict mapping file paths to their contents
        code_graph: Optional code graph for context
        
    Returns:
        List of (finding, GeneratedFix) tuples
    """
    import asyncio
    
    results = []
    
    # Group findings by file
    by_file: Dict[str, List] = {}
    for finding in findings:
        if finding.file not in by_file:
            by_file[finding.file] = []
        by_file[finding.file].append(finding)
    
    # Process each file's findings
    for file_path, file_findings in by_file.items():
        file_content = file_contents.get(file_path, "")
        if not file_content:
            continue
        
        # Get context from code graph
        context = ""
        if code_graph and file_path in code_graph:
            graph_data = code_graph[file_path]
            if isinstance(graph_data, dict):
                context = str(graph_data.get('signatures', ''))[:2000]
        
        # Generate fixes for this file's findings (max 5 per file)
        for finding in file_findings[:5]:
            try:
                fix = await generate_fix_for_unified_finding(
                    finding=finding,
                    file_content=file_content,
                    context_code=context
                )
                if fix:
                    results.append((finding, fix))
            except Exception as e:
                get_logger().warning(f"Failed to generate fix for {finding.id}: {e}")
    
    return results


def unified_finding_to_generated_fix(finding) -> Optional[GeneratedFix]:
    """
    Convert a UnifiedFinding's embedded fix to GeneratedFix format.
    
    If the finding already has a fix attached, convert it to the
    legacy GeneratedFix format for compatibility.
    
    Args:
        finding: UnifiedFinding with fix attribute
        
    Returns:
        GeneratedFix or None
    """
    if not finding.fix:
        return None
    
    # Map category to fix type
    category_map = {
        "security": FixType.SECURITY,
        "bug": FixType.BUG,
        "logic": FixType.BUG,
        "performance": FixType.PERFORMANCE,
        "style": FixType.STYLE,
        "maintainability": FixType.REFACTOR,
    }
    fix_type = category_map.get(finding.category, FixType.BUG)
    
    return GeneratedFix(
        issue_id=finding.id,
        issue_message=finding.title,
        fix_type=fix_type,
        file_path=finding.file,
        start_line=finding.start_line,
        end_line=finding.end_line,
        original_code=finding.fix.original_code,
        fixed_code=finding.fix.fixed_code,
        explanation=finding.fix.explanation,
        confidence=finding.confidence,
        is_validated=False
    )
