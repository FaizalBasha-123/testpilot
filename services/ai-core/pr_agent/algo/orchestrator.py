"""
Analysis Orchestrator - Parallel Execution and Unified Output
==============================================================

This module orchestrates the parallel execution of:
- PR Agent AI review (bugs, logic errors)
- Sonar Backend scan (security vulnerabilities)
- Code Graph building (context for both)

All findings are merged, deduplicated, and fixes are generated.

Author: BlackboxTester Team
"""

import asyncio
import aiohttp
import os
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from pr_agent.log import get_logger
from pr_agent.algo.findings import (
    UnifiedFinding,
    AnalysisResult,
    GeneratedFix,
    sonar_response_to_unified,
    ai_response_to_unified,
    merge_findings,
    deduplicate_findings,
    create_summary,
    FindingSource,
)
from pr_agent.algo.code_graph import build_codegraph_v2
from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
from pr_agent.config_loader import get_settings


# ============================================================================
# Configuration
# ============================================================================

SONAR_SERVICE_URL = os.environ.get("SONAR_SERVICE_URL", "http://sonar-service:8000")
SONAR_TIMEOUT_SECONDS = 120
AI_REVIEW_TIMEOUT_SECONDS = 180


# ============================================================================
# Analysis Orchestrator
# ============================================================================

class AnalysisOrchestrator:
    """
    Orchestrates parallel execution of AI review + Sonar scan.
    
    Flow:
    1. Build code graph (sync, needed by AI review)
    2. Run AI review + Sonar scan in parallel
    3. Convert both to UnifiedFinding format
    4. Merge and deduplicate
    5. Generate fixes for findings without them
    6. Return unified AnalysisResult
    """
    
    def __init__(self):
        self.logger = get_logger()
        self.ai_handler = None  # Lazy init
    
    async def analyze(
        self,
        workspace_path: str,
        diff_content: str,
        changed_files: List[str],
        job_id: str = None
    ) -> AnalysisResult:
        """
        Main analysis entry point.
        
        Args:
            workspace_path: Path to extracted workspace
            diff_content: Git diff content
            changed_files: List of changed file paths
            job_id: Optional job ID for logging
            
        Returns:
            AnalysisResult with unified findings and fixes
        """
        start_time = time.time()
        self.logger.info(f"[Orchestrator] Starting analysis for {len(changed_files)} files")
        
        # Step 1: Build code graph (sync - needed for AI context)
        self.logger.info("[Orchestrator] Building code graph...")
        code_graph = await self._build_code_graph(workspace_path, changed_files)
        
        # Step 2: Run AI review + Sonar scan in parallel
        self.logger.info("[Orchestrator] Running parallel analysis (AI + Sonar)...")
        ai_findings, sonar_findings = await self._run_parallel_analysis(
            workspace_path=workspace_path,
            diff_content=diff_content,
            changed_files=changed_files,
            code_graph=code_graph
        )
        
        self.logger.info(f"[Orchestrator] AI found {len(ai_findings)} issues, Sonar found {len(sonar_findings)} issues")
        
        # Step 3: Merge findings
        all_findings = merge_findings(ai_findings, sonar_findings)
        
        # Step 4: Deduplicate
        unique_findings = deduplicate_findings(all_findings)
        self.logger.info(f"[Orchestrator] After deduplication: {len(unique_findings)} unique issues")
        
        # Step 5: Generate fixes for findings without them
        with_fixes = await self._generate_missing_fixes(unique_findings, code_graph)
        
        # Step 6: Create summary
        summary = create_summary(with_fixes)
        
        execution_time = int((time.time() - start_time) * 1000)
        self.logger.info(f"[Orchestrator] Analysis complete in {execution_time}ms")
        
        return AnalysisResult(
            findings=with_fixes,
            summary=summary,
            code_graph=code_graph,
            execution_time_ms=execution_time
        )
    
    # ========================================================================
    # Code Graph
    # ========================================================================
    
    async def _build_code_graph(
        self,
        workspace_path: str,
        changed_files: List[str]
    ) -> Dict[str, Any]:
        """Build code graph for changed files."""
        try:
            # Run in executor to not block event loop
            loop = asyncio.get_event_loop()
            
            graphs = {}
            for file_path in changed_files[:10]:  # Limit to 10 files
                try:
                    graph = await loop.run_in_executor(
                        None,
                        build_codegraph_v2,
                        workspace_path,
                        file_path,
                        3  # depth
                    )
                    graphs[file_path] = graph
                except Exception as e:
                    self.logger.warning(f"Failed to build graph for {file_path}: {e}")
            
            return graphs
            
        except Exception as e:
            self.logger.error(f"Code graph building failed: {e}")
            return {}
    
    # ========================================================================
    # Parallel Analysis
    # ========================================================================
    
    async def _run_parallel_analysis(
        self,
        workspace_path: str,
        diff_content: str,
        changed_files: List[str],
        code_graph: Dict[str, Any]
    ) -> Tuple[List[UnifiedFinding], List[UnifiedFinding]]:
        """
        Run AI review and Sonar scan in parallel.
        
        Returns:
            Tuple of (ai_findings, sonar_findings)
        """
        # Create tasks
        ai_task = asyncio.create_task(
            self._run_ai_review(diff_content, changed_files, code_graph)
        )
        sonar_task = asyncio.create_task(
            self._run_sonar_scan(workspace_path)
        )
        
        # Wait for both with individual error handling
        ai_findings = []
        sonar_findings = []
        
        try:
            ai_findings = await asyncio.wait_for(ai_task, timeout=AI_REVIEW_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            self.logger.error("[Orchestrator] AI review timed out")
        except Exception as e:
            self.logger.error(f"[Orchestrator] AI review failed: {e}")
        
        try:
            sonar_findings = await asyncio.wait_for(sonar_task, timeout=SONAR_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            self.logger.error("[Orchestrator] Sonar scan timed out")
        except Exception as e:
            self.logger.error(f"[Orchestrator] Sonar scan failed: {e}")
        
        return ai_findings, sonar_findings
    
    async def _run_ai_review(
        self,
        diff_content: str,
        changed_files: List[str],
        code_graph: Dict[str, Any]
    ) -> List[UnifiedFinding]:
        """
        Run AI-based code review.
        
        Returns:
            List of UnifiedFinding from AI review
        """
        try:
            # Initialize AI handler if needed
            if not self.ai_handler:
                self.ai_handler = LiteLLMAIHandler()
            
            # Build context from code graph
            context = self._build_ai_context(code_graph)
            
            # Create prompt
            prompt = self._create_review_prompt(diff_content, context)
            
            # Call LLM
            response, _ = await self.ai_handler.chat_completion(
                model=get_settings().config.model,
                system="",
                user=prompt,
                temperature=0.2
            )
            
            # Parse response
            import json
            response_text = response
            
            # Try to extract JSON from response
            ai_result = self._parse_ai_response(response_text)
            
            # Convert to unified format
            return ai_response_to_unified(ai_result)
            
        except Exception as e:
            self.logger.error(f"AI review error: {e}")
            return []
    
    def _build_ai_context(self, code_graph: Dict[str, Any]) -> str:
        """Build context string from code graph for AI prompt."""
        context_parts = []
        
        for file_path, graph in code_graph.items():
            if isinstance(graph, dict):
                context_parts.append(f"## {file_path}")
                
                # Add function signatures
                if graph.get('functions'):
                    context_parts.append("Functions:")
                    for func in graph['functions'][:10]:
                        if isinstance(func, dict):
                            context_parts.append(f"  - {func.get('name', 'unknown')}: {func.get('signature', '')}")
                
                # Add class info
                if graph.get('classes'):
                    context_parts.append("Classes:")
                    for cls in graph['classes'][:5]:
                        if isinstance(cls, dict):
                            context_parts.append(f"  - {cls.get('name', 'unknown')}")
        
        return "\n".join(context_parts[:100])  # Limit context size
    
    def _create_review_prompt(self, diff_content: str, context: str) -> str:
        """Create the review prompt for AI."""
        return f"""You are an expert code reviewer. Analyze the following code diff and identify:
1. Bugs and errors
2. Logic issues
3. Security concerns (if any obvious ones)
4. Code quality issues

Respond with a JSON object containing an "issues" array. Each issue should have:
- file: the filename
- start_line: line number
- end_line: line number  
- type: "bug" | "logic" | "security" | "style"
- severity: "critical" | "high" | "medium" | "low"
- title: short description
- description: detailed explanation
- suggestion: how to fix it (if applicable)
- original_code: the problematic code
- fixed_code: the corrected code

## Code Context (function signatures)
{context}

## Diff to Review
```diff
{diff_content[:15000]}
```

Respond with ONLY valid JSON, no markdown code blocks."""
    
    def _parse_ai_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response to extract JSON."""
        import json
        import re
        
        # Try direct JSON parse
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from markdown code block
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try to find JSON object in text
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        self.logger.warning("Could not parse AI response as JSON")
        return {"issues": []}
    
    async def _run_sonar_scan(self, workspace_path: str) -> List[UnifiedFinding]:
        """
        Run Sonar backend scan.
        
        Returns:
            List of UnifiedFinding from Sonar
        """
        try:
            # Create zip of workspace for Sonar
            import tempfile
            import zipfile
            import shutil
            
            zip_path = tempfile.mktemp(suffix='.zip')
            
            # Create zip file
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(workspace_path):
                    # Skip common non-code directories
                    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', '.venv', 'venv']]
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, workspace_path)
                        try:
                            zf.write(file_path, arcname)
                        except Exception:
                            pass
            
            # Send to Sonar service
            async with aiohttp.ClientSession() as session:
                with open(zip_path, 'rb') as f:
                    data = aiohttp.FormData()
                    data.add_field('file', f, filename='repo.zip', content_type='application/zip')
                    
                    async with session.post(
                        f"{SONAR_SERVICE_URL}/analyze",
                        data=data,
                        timeout=aiohttp.ClientTimeout(total=SONAR_TIMEOUT_SECONDS)
                    ) as response:
                        if response.status == 200:
                            sonar_result = await response.json()
                            return sonar_response_to_unified(sonar_result)
                        else:
                            self.logger.error(f"Sonar returned status {response.status}")
                            return []
            
        except Exception as e:
            self.logger.error(f"Sonar scan error: {e}")
            return []
        finally:
            # Cleanup temp zip
            try:
                if 'zip_path' in locals():
                    os.remove(zip_path)
            except Exception:
                pass
    
    # ========================================================================
    # Fix Generation
    # ========================================================================
    
    async def _generate_missing_fixes(
        self,
        findings: List[UnifiedFinding],
        code_graph: Dict[str, Any]
    ) -> List[UnifiedFinding]:
        """
        Generate fixes for findings that don't have them.
        
        Args:
            findings: All findings
            code_graph: Code graph for context
            
        Returns:
            Findings with fixes generated
        """
        # Separate findings with and without fixes
        needs_fix = [f for f in findings if f.fix is None]
        has_fix = [f for f in findings if f.fix is not None]
        
        if not needs_fix:
            return findings
        
        self.logger.info(f"[Orchestrator] Generating fixes for {len(needs_fix)} findings")
        
        # Batch generate fixes (group by file for efficiency)
        for finding in needs_fix:
            try:
                fix = await self._generate_fix(finding, code_graph)
                if fix:
                    finding.fix = fix
            except Exception as e:
                self.logger.warning(f"Failed to generate fix for {finding.id}: {e}")
        
        return has_fix + needs_fix
    
    async def _generate_fix(
        self,
        finding: UnifiedFinding,
        code_graph: Dict[str, Any]
    ) -> Optional[GeneratedFix]:
        """Generate a fix for a single finding."""
        try:
            if not self.ai_handler:
                self.ai_handler = LiteLLMAIHandler()
            
            # Get context for this file
            file_context = code_graph.get(finding.file, {})
            context_str = ""
            if isinstance(file_context, dict):
                context_str = str(file_context.get('signatures', ''))[:2000]
            
            # Create fix prompt
            prompt = f"""Generate a fix for this code issue.

Issue Type: {finding.category}
Severity: {finding.severity}
File: {finding.file}
Line: {finding.start_line}

Issue: {finding.title}
Description: {finding.description}

Problematic Code:
```
{finding.code_snippet}
```

Related Code Context:
{context_str}

{"Sonar Rule: " + finding.sonar_rule_id if finding.sonar_rule_id else ""}

Respond with a JSON object containing:
- original_code: the exact code to replace
- fixed_code: the corrected code
- explanation: why this fix works

Respond with ONLY valid JSON."""

            # Call LLM
            response, _ = await self.ai_handler.chat_completion(
                model=get_settings().config.model_weak or get_settings().config.model,
                system="",
                user=prompt,
                temperature=0.1
            )
            
            # Parse response
            response_text = response
            fix_data = self._parse_ai_response(response_text)
            
            if fix_data and fix_data.get('fixed_code'):
                return GeneratedFix(
                    original_code=fix_data.get('original_code', finding.code_snippet),
                    fixed_code=fix_data['fixed_code'],
                    explanation=fix_data.get('explanation', ''),
                    applicable=True
                )
            
        except Exception as e:
            self.logger.warning(f"Fix generation failed: {e}")
        
        return None


# ============================================================================
# Convenience Function
# ============================================================================

async def run_unified_analysis(
    workspace_path: str,
    diff_content: str,
    changed_files: List[str],
    job_id: str = None
) -> AnalysisResult:
    """
    Convenience function to run unified analysis.
    
    Args:
        workspace_path: Path to workspace
        diff_content: Git diff
        changed_files: List of changed files
        job_id: Optional job ID
        
    Returns:
        AnalysisResult with unified findings
    """
    orchestrator = AnalysisOrchestrator()
    return await orchestrator.analyze(
        workspace_path=workspace_path,
        diff_content=diff_content,
        changed_files=changed_files,
        job_id=job_id
    )
