"""
Unified Findings - Common Format for All Issue Sources
========================================================

This module provides a unified format for findings from different sources:
- PR Agent AI (bugs, logic errors, style issues)
- Sonar Backend (security vulnerabilities, code smells)

All findings are converted to UnifiedFinding for consistent processing.

Author: BlackboxTester Team
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from enum import Enum
import hashlib
import json


# ============================================================================
# Enums
# ============================================================================

class FindingSource(str, Enum):
    """Source of the finding"""
    PR_AGENT = "pr_agent"
    SONAR = "sonar"
    MANUAL = "manual"


class FindingCategory(str, Enum):
    """Category of the finding"""
    SECURITY = "security"
    BUG = "bug"
    LOGIC = "logic"
    STYLE = "style"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"


class FindingSeverity(str, Enum):
    """Severity level"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


# ============================================================================
# Core Data Classes
# ============================================================================

@dataclass
class GeneratedFix:
    """A fix generated for a finding"""
    original_code: str
    fixed_code: str
    explanation: str
    applicable: bool = True  # Can this be auto-applied?


@dataclass
class UnifiedFinding:
    """
    Single format for all findings from any source.
    
    This is the core data structure that flows through the entire system:
    Source (AI/Sonar) → UnifiedFinding → Fix Generator → Output
    """
    # Identity
    id: str
    source: str  # "pr_agent" | "sonar"
    
    # Classification
    category: str  # "security" | "bug" | "logic" | "style" | etc.
    severity: str  # "critical" | "high" | "medium" | "low" | "info"
    
    # Location
    file: str
    start_line: int
    end_line: int
    
    # Content
    title: str
    description: str
    code_snippet: str = ""
    
    # Fix (may be None if not yet generated)
    fix: Optional[GeneratedFix] = None
    
    # Metadata
    sonar_rule_id: Optional[str] = None  # e.g., "S5131" for Sonar findings
    confidence: float = 0.8  # 0.0 - 1.0
    tags: List[str] = field(default_factory=list)
    
    # Deduplication tracking
    also_found_by: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        # Convert fix to dict if present
        if self.fix:
            result['fix'] = asdict(self.fix)
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UnifiedFinding':
        """Create from dictionary"""
        fix_data = data.pop('fix', None)
        fix = GeneratedFix(**fix_data) if fix_data else None
        return cls(**data, fix=fix)


@dataclass
class AnalysisResult:
    """Complete analysis result with all findings"""
    findings: List[UnifiedFinding]
    summary: Dict[str, Any]
    code_graph: Dict[str, Any] = field(default_factory=dict)
    execution_time_ms: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "findings": [f.to_dict() for f in self.findings],
            "summary": self.summary,
            "code_graph": self.code_graph,
            "execution_time_ms": self.execution_time_ms
        }


# ============================================================================
# Sonar Converters
# ============================================================================

# Sonar type → our category
SONAR_TYPE_MAP = {
    "BUG": FindingCategory.BUG.value,
    "VULNERABILITY": FindingCategory.SECURITY.value,
    "SECURITY_HOTSPOT": FindingCategory.SECURITY.value,
    "CODE_SMELL": FindingCategory.MAINTAINABILITY.value,
}

# Sonar severity → our severity
SONAR_SEVERITY_MAP = {
    "BLOCKER": FindingSeverity.CRITICAL.value,
    "CRITICAL": FindingSeverity.CRITICAL.value,
    "MAJOR": FindingSeverity.HIGH.value,
    "MINOR": FindingSeverity.MEDIUM.value,
    "INFO": FindingSeverity.LOW.value,
}


def sonar_to_unified(sonar_issue: Dict[str, Any]) -> UnifiedFinding:
    """
    Convert a Sonar finding to UnifiedFinding format.
    
    Args:
        sonar_issue: Sonar issue dict from sonar-backend response
        
    Returns:
        UnifiedFinding instance
    """
    # Extract fields with defaults
    rule_id = sonar_issue.get('rule_id', sonar_issue.get('rule', 'unknown'))
    line = sonar_issue.get('line', sonar_issue.get('start_line', 1))
    end_line = sonar_issue.get('end_line', line)
    
    # Generate unique ID
    finding_id = f"sonar-{rule_id}-{sonar_issue.get('file', 'unknown')}-{line}"
    finding_id = hashlib.md5(finding_id.encode()).hexdigest()[:12]
    
    # Map type and severity
    sonar_type = sonar_issue.get('type', 'CODE_SMELL')
    sonar_severity = sonar_issue.get('severity', 'MAJOR')
    
    category = SONAR_TYPE_MAP.get(sonar_type, FindingCategory.BUG.value)
    severity = SONAR_SEVERITY_MAP.get(sonar_severity, FindingSeverity.MEDIUM.value)
    
    # Build description
    description = sonar_issue.get('message', '')
    if sonar_issue.get('effort'):
        description += f"\n\nEstimated effort: {sonar_issue['effort']}"
    if sonar_issue.get('fix_recommendation'):
        description += f"\n\nRecommendation: {sonar_issue['fix_recommendation']}"
    
    return UnifiedFinding(
        id=f"sonar-{finding_id}",
        source=FindingSource.SONAR.value,
        category=category,
        severity=severity,
        file=sonar_issue.get('file', ''),
        start_line=line,
        end_line=end_line,
        title=sonar_issue.get('message', 'Sonar finding')[:100],
        description=description,
        code_snippet=sonar_issue.get('code_snippet', sonar_issue.get('snippet', '')),
        fix=None,  # Will be generated later
        sonar_rule_id=rule_id,
        confidence=0.95,  # Sonar is deterministic
        tags=[sonar_type.lower(), rule_id]
    )


def sonar_response_to_unified(sonar_response: Dict[str, Any]) -> List[UnifiedFinding]:
    """
    Convert entire Sonar response to list of UnifiedFindings.
    
    Args:
        sonar_response: Full response from sonar-backend /analyze endpoint
        
    Returns:
        List of UnifiedFinding instances
    """
    findings = []
    
    # Handle different response formats from Sonar backend
    # The Rust sonar-backend returns: { "vulnerabilities": [...], "total_count": N }
    issues = (
        sonar_response.get('vulnerabilities', []) or  # Rust sonar-backend format
        sonar_response.get('issues', []) or           # SonarQube API format
        sonar_response.get('findings', []) or         # Alternative format
        []
    )
    
    for issue in issues:
        try:
            # Map fields from Rust sonar-backend format
            # { key, rule, severity, component, line, message, type }
            normalized = {
                'rule_id': issue.get('rule', issue.get('rule_id', 'unknown')),
                'line': issue.get('line', 1),
                'file': issue.get('component', issue.get('file', '')),
                'message': issue.get('message', ''),
                'severity': issue.get('severity', 'MAJOR'),
                'type': issue.get('type', issue.get('issue_type', 'CODE_SMELL')),
            }
            # Extract just filename from component (removes project prefix)
            if ':' in normalized['file']:
                normalized['file'] = normalized['file'].split(':')[-1]
            
            findings.append(sonar_to_unified(normalized))
        except Exception as e:
            # Log but don't fail on single issue
            print(f"Warning: Failed to convert Sonar issue: {e}")
    
    return findings


# ============================================================================
# AI Review Converters
# ============================================================================

# AI type → our category
AI_TYPE_MAP = {
    "bug": FindingCategory.BUG.value,
    "error": FindingCategory.BUG.value,
    "logic": FindingCategory.LOGIC.value,
    "logical_error": FindingCategory.LOGIC.value,
    "security": FindingCategory.SECURITY.value,
    "style": FindingCategory.STYLE.value,
    "performance": FindingCategory.PERFORMANCE.value,
    "possible_bug": FindingCategory.BUG.value,
    "possible_issue": FindingCategory.BUG.value,
}


def ai_to_unified(ai_issue: Dict[str, Any]) -> UnifiedFinding:
    """
    Convert an AI review finding to UnifiedFinding format.
    
    Args:
        ai_issue: AI review issue dict from PR Agent LLM response
        
    Returns:
        UnifiedFinding instance
    """
    # Generate unique ID from content
    content_hash = hashlib.md5(
        f"{ai_issue.get('file', '')}-{ai_issue.get('start_line', 0)}-{ai_issue.get('title', '')}".encode()
    ).hexdigest()[:12]
    
    # Map type
    ai_type = ai_issue.get('type', ai_issue.get('issue_header', 'issue')).lower()
    ai_type = ai_type.replace(' ', '_')
    category = AI_TYPE_MAP.get(ai_type, FindingCategory.BUG.value)
    
    # Map severity
    severity_str = ai_issue.get('severity', 'medium').lower()
    if severity_str not in [s.value for s in FindingSeverity]:
        severity_str = FindingSeverity.MEDIUM.value
    
    # Build fix if AI provided suggestion
    fix = None
    if ai_issue.get('suggestion') or ai_issue.get('fixed_code'):
        fix = GeneratedFix(
            original_code=ai_issue.get('original_code', ai_issue.get('code_snippet', '')),
            fixed_code=ai_issue.get('fixed_code', ai_issue.get('suggestion', '')),
            explanation=ai_issue.get('explanation', ai_issue.get('description', '')),
            applicable=True
        )
    
    return UnifiedFinding(
        id=f"ai-{content_hash}",
        source=FindingSource.PR_AGENT.value,
        category=category,
        severity=severity_str,
        file=ai_issue.get('file', ai_issue.get('relevant_file', '')),
        start_line=int(ai_issue.get('start_line', ai_issue.get('line', 1))),
        end_line=int(ai_issue.get('end_line', ai_issue.get('start_line', ai_issue.get('line', 1)))),
        title=ai_issue.get('title', ai_issue.get('issue_header', 'Issue detected'))[:100],
        description=ai_issue.get('description', ai_issue.get('issue_content', '')),
        code_snippet=ai_issue.get('code_snippet', ''),
        fix=fix,
        sonar_rule_id=None,
        confidence=float(ai_issue.get('confidence', 0.75)),
        tags=[category, 'ai-detected']
    )


def ai_response_to_unified(ai_response: Dict[str, Any]) -> List[UnifiedFinding]:
    """
    Convert AI review response to list of UnifiedFindings.
    
    Args:
        ai_response: Full response from PR Agent AI review
        
    Returns:
        List of UnifiedFinding instances
    """
    findings = []
    
    # Handle different response formats
    issues = (
        ai_response.get('issues', []) or
        ai_response.get('review', {}).get('key_issues_to_review', []) or
        ai_response.get('code_feedback', []) or
        []
    )
    
    for issue in issues:
        try:
            findings.append(ai_to_unified(issue))
        except Exception as e:
            print(f"Warning: Failed to convert AI issue: {e}")
    
    return findings


# ============================================================================
# Merge & Deduplication
# ============================================================================

def merge_findings(
    ai_findings: List[UnifiedFinding],
    sonar_findings: List[UnifiedFinding]
) -> List[UnifiedFinding]:
    """
    Merge findings from both sources.
    
    Args:
        ai_findings: Findings from AI review
        sonar_findings: Findings from Sonar scan
        
    Returns:
        Combined list of findings
    """
    return ai_findings + sonar_findings


def normalize_for_dedup(text: str) -> str:
    """Normalize text for deduplication comparison"""
    return text.lower().strip()[:50]


def deduplicate_findings(findings: List[UnifiedFinding]) -> List[UnifiedFinding]:
    """
    Deduplicate findings that appear in both sources.
    
    When both AI and Sonar find the same issue:
    - Keep the one with higher confidence
    - Note that it was also found by the other source
    
    Args:
        findings: Combined findings from all sources
        
    Returns:
        Deduplicated list
    """
    # Key: (file, line, normalized_title)
    seen: Dict[tuple, UnifiedFinding] = {}
    
    for finding in findings:
        # Generate dedup key
        key = (
            finding.file,
            finding.start_line,
            normalize_for_dedup(finding.title)
        )
        
        if key in seen:
            existing = seen[key]
            
            # Decide which to keep based on confidence
            if finding.confidence > existing.confidence:
                # New one is better, keep it but note existing source
                finding.also_found_by.append(existing.source)
                if existing.fix and not finding.fix:
                    finding.fix = existing.fix  # Preserve any existing fix
                seen[key] = finding
            else:
                # Existing is better, note new source
                existing.also_found_by.append(finding.source)
                if finding.fix and not existing.fix:
                    existing.fix = finding.fix
        else:
            seen[key] = finding
    
    return list(seen.values())


# ============================================================================
# Summary Generation
# ============================================================================

def create_summary(findings: List[UnifiedFinding]) -> Dict[str, Any]:
    """
    Create a summary of all findings.
    
    Args:
        findings: List of all findings
        
    Returns:
        Summary dict with counts by source, severity, category
    """
    by_source = {}
    by_severity = {}
    by_category = {}
    with_fix = 0
    
    for f in findings:
        # Count by source
        by_source[f.source] = by_source.get(f.source, 0) + 1
        
        # Count by severity
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        
        # Count by category
        by_category[f.category] = by_category.get(f.category, 0) + 1
        
        # Count with fix
        if f.fix:
            with_fix += 1
    
    return {
        "total": len(findings),
        "with_fix": with_fix,
        "by_source": by_source,
        "by_severity": by_severity,
        "by_category": by_category,
        "quality_gate": determine_quality_gate(findings)
    }


def determine_quality_gate(findings: List[UnifiedFinding]) -> str:
    """
    Determine quality gate status based on findings.
    
    Returns: "passed" | "failed" | "warning"
    """
    critical_count = sum(1 for f in findings if f.severity == FindingSeverity.CRITICAL.value)
    high_count = sum(1 for f in findings if f.severity == FindingSeverity.HIGH.value)
    security_count = sum(1 for f in findings if f.category == FindingCategory.SECURITY.value)
    
    # Fail on any critical or security issues
    if critical_count > 0 or security_count > 0:
        return "failed"
    
    # Warning on high severity
    if high_count > 2:
        return "warning"
    
    return "passed"
