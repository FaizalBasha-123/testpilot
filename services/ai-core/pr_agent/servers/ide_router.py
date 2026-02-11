from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, Request, HTTPException
from pydantic import BaseModel
import tempfile
import os
import shutil
from pr_agent.log import get_logger
from pr_agent.tools.pr_reviewer import PRReviewer
from pr_agent.tools.pr_sonar_scan import PRSonarScan
from pr_agent.git_providers.local_git_provider import LocalGitProvider
from pr_agent.config_loader import get_settings
from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
import difflib
import json
import asyncio
import re
import aiohttp
import time

# Code Graph v2 - Multi-language dependency analyzer
from pr_agent.algo.code_graph import build_codegraph_v2, CodeGraphBuilder

# ===========================================================================
# Refactored Modules - Phase 1 Extraction
# ===========================================================================
from pr_agent.servers.job_manager import (
    JOBS,
    create_job,
    update_job_log,
    update_job_progress,
    update_job_status,
    update_job_result,
    cancel_job as _cancel_job,  # Aliased to avoid conflict with route
    is_job_cancelled,
    complete_job,
    fail_job,
)
from pr_agent.servers.context_builder import (
    resolve_import_path,
    extract_code_snippet,
    extract_function_at_line,
    get_file_structure,
    get_related_files,
)
from pr_agent.servers.workspace_utils import (
    setup_workspace_sync,
    git_init_sync,
    create_temp_workspace,
    cleanup_workspace,
    find_files_by_extension,
    get_file_content,
    save_file_content,
    get_workspace_stats,
)

# ===========================================================================
# PR Agent Core Redesign - Parallel AI + Sonar Execution
# ===========================================================================
from pr_agent.algo.orchestrator import (
    AnalysisOrchestrator,
    run_unified_analysis,
)
from pr_agent.algo.findings import (
    UnifiedFinding,
    AnalysisResult,
    FindingSource,
    FindingSeverity,
    FindingCategory,
    create_summary,
)

SONAR_SERVICE_URL = os.environ.get("SONAR_SERVICE_URL", "http://sonar-service:8000")

async def scan_via_microservice(zip_path: str, job_id: str):
    """Call the Sonar Microservice to analyze the zip."""
    url = f"{SONAR_SERVICE_URL}/analyze"
    try:
        async with aiohttp.ClientSession() as session:
            with open(zip_path, 'rb') as f:
                data = aiohttp.FormData()
                data.add_field('file', f, filename='repo.zip')
                async with session.post(url, data=data) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        raise Exception(f"Sonar Service Error {resp.status}: {text}")
                    return await resp.json()
    except Exception as e:
        get_logger().error(f"Microservice Call Failed: {e}")
        raise e

def _extract_sonar_issues(result: dict) -> list:
    """Normalize Sonar microservice responses across versions."""
    if not isinstance(result, dict):
        return []
    for key in ("findings", "vulnerabilities", "issues"):
        value = result.get(key)
        if isinstance(value, list):
            return value
    return []

def generate_unified_diff(original: str, fixed: str, filename: str) -> str:
    """Generates a unified diff string (Git format) for inline highlighting."""
    original_lines = original.splitlines(keepends=True)
    fixed_lines = fixed.splitlines(keepends=True)
    diff = difflib.unified_diff(
        original_lines, fixed_lines,
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}"
    )
    return ''.join(diff)

router = APIRouter()

class IDEReviewRequest(BaseModel):
    file_path: str
    content: str


def _trace_headers(request: Request) -> dict:
    return {
        "x_request_id": request.headers.get("x-request-id", ""),
        "content_type": request.headers.get("content-type", ""),
        "content_length": request.headers.get("content-length", ""),
        "user_agent": request.headers.get("user-agent", ""),
    }

# [REMOVED] Legacy v1 review_repo_async handler.
# It hardcoded None for git_log/git_diff, shadowing the v2 handler at the
# bottom of this file which properly accepts them as Form fields.
# See: v2 handler @router.post("/api/v1/ide/review_repo_async") below.

@router.get("/api/v1/ide/job_status/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in JOBS:
        get_logger().warning(f"[ide-job-status:v1] job not found job_id={job_id}")
        return {"status": "not_found"}
    get_logger().debug(f"[ide-job-status:v1] job status request job_id={job_id} status={JOBS[job_id].get('status')}")
    return JOBS[job_id]

@router.post("/api/v1/ide/review")
async def review_ide_file(
    file: UploadFile = File(None),
    content: str = Form(None),
    filename: str = Form("file.py"),
    background_tasks: BackgroundTasks = None
):
    """
    Endpoint for VS Code / JetBrains extensions to review specific files.
    This mimics the full PR review but on a single file context.
    """
    get_logger().info(f"IDE Request: Reviewing {filename}")
    
    # Create temp workspace
    temp_dir = tempfile.mkdtemp(prefix="blackbox_ide_")
    try:
        file_path = os.path.join(temp_dir, filename)
        
        # Save content
        code_content = ""
        if file:
            content = await file.read()
            code_content = content.decode("utf-8")
            with open(file_path, "wb") as f:
                f.write(content)
        elif content:
            code_content = content
            with open(file_path, "w") as f:
                f.write(content)
        
        # Initialize Git layout for tools to work
        # PR-Agent expects a git repo
        os.system(f"cd {temp_dir} && git init && git add . && git commit -m 'initial'")
        
        # 1. SonarQube Scan (Microservice)
        sonar_findings = ""
        if get_settings().get("sonarqube.enabled", False):
            try:
                get_logger().info("IDE: Running Sonar Scan (via Microservice)")
                # Zip the temp dir
                zip_path = os.path.join(temp_dir, "ide_scan.zip")
                shutil.make_archive(zip_path.replace(".zip", ""), 'zip', temp_dir)
                
                result = await scan_via_microservice(zip_path, f"ide_{os.urandom(4).hex()}")
                issues = _extract_sonar_issues(result)
                
                if issues:
                    sonar_findings = "\n".join([f"- {i['message']} (Line {i.get('line', '?')})" for i in issues])
                    
            except Exception as e:
                get_logger().error(f"IDE Sonar failed: {e}")

        # 2. AI Review (Hierarchy Step 2: Fix)
        # We need to construct a prompt manually or wrap PRReviewer
        # PRReviewer is heavily tied to GitProvider.
        # We can implement a simplified AI call here directly using the agent's handler.
        
        from pr_agent.agent.pr_agent import PRAgent
        from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler
        
        ai_handler = LiteLLMAIHandler()
        
        # Construct Prompt
        system_prompt = "You are an expert Code Reviewer. Review the provided code."
        user_prompt = f"Code to review ({filename}):\n\n```\n{code_content}\n```"
        
        if sonar_findings:
            user_prompt += f"\n\n🔍 **Static Analysis Findings** (You MUST fix these):\n{sonar_findings}"
            user_prompt += "\n\nProvide specific code fixes for the static analysis issues and any logic bugs you find."
        else:
            user_prompt += "\n\nHunt for logic bugs, security issues, and provide fixes."

        user_prompt += """
Please provide a JSON response with the following structure:
{
    "summary": "A markdown summary of the issues and fixes.",
    "fixes": [
        {
            "filename": "THE_FILENAME_I_PROVIDED",
            "new_content": "THE FULL FIXED CONTENT OF THE FILE"
        }
    ]
}
IMPORTANT: Return ONLY valid JSON. Ensure new_content is the COMPLETE file.
"""

        structured_data = {"summary": "AI Analysis Failed", "fixes": []}
        try:
            response, _ = await ai_handler.chat_completion(
                model=get_settings().config.model,
                system=system_prompt,
                user=user_prompt
            )
            
            import json
            import re
            clean_response = response
            if "```" in response:
                match = re.search(r"```(?:json)?(.*?)```", response, re.DOTALL)
                if match: clean_response = match.group(1).strip()
            
            try:
                structured_data = json.loads(clean_response)
                get_logger().info(f"AI Response Parsed: {json.dumps(structured_data, indent=2)}") 
                # Ensure filename matches if AI forgot it
                for fix in structured_data.get("fixes", []):
                    if not fix.get("filename") or fix["filename"] == "THE_FILENAME_I_PROVIDED":
                        fix["filename"] = filename
            except json.JSONDecodeError as e:
                get_logger().error(f"AI JSON Parse Failed. Raw Response: {response}")
                structured_data = {"summary": f"Failed to parse AI response: {str(e)}", "fixes": []}
        except Exception as e:
            get_logger().error(f"Single File AI Failed: {e}", exc_info=True)
            structured_data["summary"] = f"⚠️ **AI Review Failed**: {str(e)}\n\n(SonarQube findings below)"
            structured_data["summary"] = f"⚠️ **AI Review Failed**: {str(e)}\n\n(SonarQube findings below)"

        return {"review": structured_data.get("summary", ""), "fixes": structured_data.get("fixes", []), "sonar_raw": sonar_findings}

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

import uuid
import asyncio
from fastapi import BackgroundTasks

# Store for async jobs
# Structure: { job_id: { "status": "pending|processing|completed|failed|cancelled", "logs": [], "progress": {"current_file": "", "processed": 0, "total": 0, "percentage": 0}, "result": {} } }
JOBS = {}

def update_job_log(job_id, message):
    if job_id in JOBS:
        JOBS[job_id]["logs"].append(message)
        # Use args to prevent Loguru/logging from interpreting braces in 'message' as format specifiers
        get_logger().info(f"Job {job_id}: " + str(message).replace("{", "{{").replace("}", "}}"))

def update_job_progress(job_id, current_file=None, processed=None, total=None):
    if job_id in JOBS:
        p = JOBS[job_id].get("progress", {})
        if current_file: p["current_file"] = current_file
        if processed is not None: p["processed"] = processed
        if total is not None: p["total"] = total
        if p.get("total", 0) > 0:
            p["percentage"] = int((p.get("processed", 0) / p["total"]) * 100)
        JOBS[job_id]["progress"] = p

@router.post("/api/v1/ide/cancel_job/{job_id}")
async def cancel_job(job_id: str):
    if job_id in JOBS:
        JOBS[job_id]["status"] = "cancelled"
        update_job_log(job_id, "Job Cancellation Requested by User.")
        return {"status": "cancelled"}
    return {"status": "not_found"}

class AgentRunRequest(BaseModel):
    pr_url: str
    command: str
    is_auto: bool = False

@router.post("/api/v1/agent/run")
async def run_agent_api(req: AgentRunRequest, background_tasks: BackgroundTasks):
    """
    Generic API to trigger the Agent on a PR.
    Used by git-app-backend to delegate work.
    """
    from pr_agent.agent.pr_agent import PRAgent
    get_logger().info(f"API Request: Run Agent on {req.pr_url} with {req.command}")
    
    agent = PRAgent()
    # We run this in background to avoid timeouts
    background_tasks.add_task(agent.handle_request, req.pr_url, req.command)
    
    return {"status": "queued", "pr_url": req.pr_url}


# [BlackboxTester] Codegraph: AST-based Dependency Graph Config
import ast

def resolve_import_path(repo_path: str, module_name: str) -> str | None:
    """
    Tries to map an import (e.g., 'pr_agent.algo.utils') to a filepath.
    Returns absolute path if found, Else None.
    I prefer accuracy over guessing - exact matches only.
    """
    possible_rel_paths = [
        module_name.replace('.', '/') + '.py',
        module_name.replace('.', '/') + '/__init__.py',
        'src/' + module_name.replace('.', '/') + '.py', # Common src folder
    ]
    
    for rel in possible_rel_paths:
        full_path = os.path.join(repo_path, rel)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return full_path
    return None

def build_codegraph(repo_path: str, target_file_rel: str) -> str:
    """
    [DEPRECATED] Use build_codegraph_v2 instead for multi-language support.
    This is kept for backward compatibility only.
    Constructs a 'Codegraph' context by parsing the target file for imports
    and reading ONLY the dependencies. This copies CodeRabbit's 'Graph' approach.
    """
    context_str = ["<codegraph_context>"]
    
    target_abs = os.path.join(repo_path, target_file_rel)
    if not os.path.exists(target_abs): return ""
    
    # 1. Parse Target File to find Imports
    try:
        with open(target_abs, 'r', encoding='utf-8') as f:
            code = f.read()
        tree = ast.parse(code)
    except Exception as e:
        get_logger().warning(f"Codegraph Parse Error for {target_file_rel}: {e}")
        return ""

    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for n in node.names: imports.append(n.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module: imports.append(node.module)

    # 2. Resolve & Read Dependencies (Codegraph Nodes)
    resolved_count = 0
    MAX_DEPS = 5 # Budget-friendly limit
    
    context_str.append(f"<!-- Detected Imports: {', '.join(imports[:10])}... -->")
    
    for mod in imports:
        if resolved_count >= MAX_DEPS: break
        
        dep_path = resolve_import_path(repo_path, mod)
        if dep_path:
            try:
                # Read dependency content
                with open(dep_path, "r", encoding="utf-8") as f:
                    dep_code = f.read()
                
                # Truncate to avoid exploding context (CodeRabbit strategy: headers/classes only? For now, raw truncate)
                dep_code_trunc = dep_code[:1500] + "\n... (truncated)" if len(dep_code) > 1500 else dep_code
                
                context_str.append(f"\n<!-- Dependency: {mod} -->\n```python\n{dep_code_trunc}\n```")
                resolved_count += 1
            except Exception as e:
                get_logger().warning(f"Failed to read dependency {dep_path}: {e}")
    
    context_str.append("</codegraph_context>")
    return "\n".join(context_str)



# [BlackboxTester] Snippet Extraction for Targeted LLM Prompting (CodeRabbit Strategy)
def extract_code_snippet(file_content: str, target_line: int, context_lines: int = 10) -> tuple:
    """
    Extracts the relevant code slice. 
    1. Tries to find the enclosing Function/Class (AST).
    2. Fallback to line-based slicing if AST fails.
    """
    lines = file_content.splitlines()
    total_lines = len(lines)
    
    # AST Strategy: Find enclosing scope
    try:
        tree = ast.parse(file_content)
        best_node = None
        
        for node in ast.walk(tree):
            # Check if node has line info and covers our target
            if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
                if node.lineno <= target_line <= node.end_lineno:
                    # Prefer smaller scopes (inner functions) over larger ones (classes)
                    # But we also want context. For now, take the specific function.
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        # If we already have a node, only replace if this one is 'inner'
                        if best_node and (node.lineno > best_node.lineno):
                            best_node = node
                        elif not best_node:
                            best_node = node
                            
        if best_node:
            start_line = best_node.lineno
            end_line = best_node.end_lineno
            # Add a bit of buffer around the function for decorators/comments
            start = max(0, start_line - 2) 
            end = min(total_lines, end_line + 1)
            
            snippet_lines = lines[start:end]
            numbered_lines = []
            for i, line in enumerate(snippet_lines, start=start + 1):
                prefix = ">>> " if i == target_line else "    "
                numbered_lines.append(f"{prefix}{i:4d} | {line}")
            
            return "\n".join(numbered_lines), start + 1, end
            
    except Exception as e:
        pass # AST failed (syntax error or non-python), fall back
        
    # Fallback Strategy: Dumb Slicing
    start = max(0, target_line - context_lines - 1)
    end = min(total_lines, target_line + context_lines)
    
    snippet_lines = lines[start:end]
    numbered_lines = []
    for i, line in enumerate(snippet_lines, start=start + 1):
        prefix = ">>> " if i == target_line else "    "
        numbered_lines.append(f"{prefix}{i:4d} | {line}")
    
    return "\n".join(numbered_lines), start + 1, end

def _setup_workspace_sync(zip_path: str, temp_dir: str):
    """Blocking I/O operations (Unzip + Git Init) moved to thread."""
    # Extract
    print(f"[Profiling] Unzipping {zip_path} to {temp_dir}...")
    import zipfile
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        print(f"[Profiling] Unzip complete. Extracted {len(zip_ref.namelist())} entries.")
    
    # Count files immediately
    print(f"[Profiling] Counting files in {temp_dir}...")
    count = sum([len(files) for r, d, files in os.walk(temp_dir)])
    print(f"[Profiling] Count complete: {count} files.")
    return count

def _git_init_sync(temp_dir: str):
    """Blocking Git Init operations moved to thread."""
    # Git Init
    os.system(f"cd {temp_dir} && git init && git config user.email 'blackbox@localhost' && git config user.name 'Blackbox Tester' && git add . && git commit -m 'initial'")

def _build_workspace_file_index(temp_dir: str):
    """
    Build a normalized index of extracted files so Sonar-reported paths can be
    resolved even when the zip contains an extra root folder.
    """
    files_by_rel = {}
    basenames = {}

    for root, dirs, files in os.walk(temp_dir):
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__", "venv", ".venv"]]
        for name in files:
            abs_path = os.path.join(root, name)
            rel_path = os.path.relpath(abs_path, temp_dir).replace("\\", "/").lstrip("./")
            files_by_rel[rel_path] = abs_path
            basenames.setdefault(name, []).append(rel_path)

    return {"files_by_rel": files_by_rel, "basenames": basenames}

def _resolve_workspace_file(temp_dir: str, filename: str, file_index: dict):
    """
    Resolve a Sonar/AI-reported filename to an actual extracted file path.
    Returns: (absolute_path_or_none, resolution_mode, debug_details)
    """
    files_by_rel = file_index.get("files_by_rel", {})
    basenames = file_index.get("basenames", {})

    raw = (filename or "").strip()
    normalized = raw.replace("\\", "/").lstrip("./").lstrip("/")
    candidates = []

    if normalized:
        candidates.append(normalized)
        # If absolute path accidentally arrives, keep only workspace-relative suffix.
        if "/tmp/" in normalized:
            candidates.append(normalized.split("/tmp/", 1)[-1].lstrip("/"))

    # 1) Exact normalized relative path
    for candidate in candidates:
        if candidate in files_by_rel:
            return files_by_rel[candidate], "exact", {"candidate": candidate}

    # 2) Suffix match (handles zip with extra top-level root directory)
    for candidate in candidates:
        suffix_hits = [rel for rel in files_by_rel.keys() if rel.endswith("/" + candidate) or rel == candidate]
        if len(suffix_hits) == 1:
            hit = suffix_hits[0]
            return files_by_rel[hit], "suffix", {"candidate": candidate, "matched": hit}
        if len(suffix_hits) > 1:
            hit = sorted(suffix_hits, key=len)[0]
            return files_by_rel[hit], "suffix_ambiguous_shortest", {"candidate": candidate, "matched": hit, "matches": len(suffix_hits)}

    # 3) Basename unique match
    base = os.path.basename(normalized)
    if base and base in basenames:
        hits = basenames[base]
        if len(hits) == 1:
            hit = hits[0]
            return files_by_rel[hit], "basename", {"basename": base, "matched": hit}
        if len(hits) > 1:
            hit = sorted(hits, key=len)[0]
            return files_by_rel[hit], "basename_ambiguous_shortest", {"basename": base, "matched": hit, "matches": len(hits)}

    # 4) Last chance direct join (legacy behavior)
    legacy = os.path.join(temp_dir, filename)
    if os.path.exists(legacy):
        return legacy, "legacy_direct", {"path": legacy}

    legacy_backslash = os.path.join(temp_dir, filename.replace("/", "\\"))
    if os.path.exists(legacy_backslash):
        return legacy_backslash, "legacy_backslash", {"path": legacy_backslash}

    return None, "not_found", {"filename": filename, "normalized": normalized}

def _extract_issue_filename(issue: dict) -> str:
    """
    Normalize file path field from heterogeneous Sonar payload shapes.
    Supports: component, file, filename, path
    """
    if not isinstance(issue, dict):
        return ""

    component = str(issue.get("component") or "").strip()
    if component:
        candidate = component.split(":")[-1].strip()
        if candidate:
            return candidate

    for key in ("file", "filename", "path"):
        val = str(issue.get(key) or "").strip()
        if val:
            return val

    return ""

def _apply_secret_fallback_fix(filename: str, content: str, issue: dict):
    """
    Deterministic fallback for secret exposure findings (e.g. Sonar secrets:S6334).
    Returns a fixed file string when a safe automatic replacement is possible.
    """
    try:
        rule = str(issue.get("rule") or "").lower()
        message = str(issue.get("message") or "").lower()
        is_secret_finding = ("s6334" in rule) or ("secret" in message) or ("api key" in message) or ("not disclosed" in message)
        if not is_secret_finding:
            return None

        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".js", ".jsx", ".ts", ".tsx"]:
            return None

        patterns = [
            # apiKey: "value" / api_key = "value"
            (
                re.compile(r'(?i)(\bapi[_-]?key\b\s*[:=]\s*)(["\'])([^"\']{8,})\2'),
                r'\1process.env.FIREBASE_API_KEY'
            ),
            # token: "value" / secret: "value" / password: "value"
            (
                re.compile(r'(?i)(\b(token|secret|password)\b\s*[:=]\s*)(["\'])([^"\']{8,})\3'),
                r'\1process.env.APP_SECRET'
            ),
        ]

        fixed = content
        changed = False
        for pattern, replacement in patterns:
            new_fixed = pattern.sub(replacement, fixed)
            if new_fixed != fixed:
                fixed = new_fixed
                changed = True

        if changed and fixed != content:
            return fixed
    except Exception:
        return None

    return None

async def process_repo_job(job_id: str, zip_path: str, temp_dir: str, git_log: str = None, git_diff: str = None, force_review: bool = False):
    JOBS[job_id]["status"] = "processing"
    JOBS[job_id]["progress"] = {"current_file": "Initializing...", "processed": 0, "total": 0, "percentage": 0}
    
    update_job_log(job_id, "Job Started. Extracting Workspace...")
    
    update_job_log(job_id, "Initializing AI Handler...")
    try:
        ai_handler = LiteLLMAIHandler()
        update_job_log(job_id, "AI Handler Initialized.")
    except Exception as e:
        update_job_log(job_id, f"AI Handler Init Failed: {e}")
        ai_handler = None
    
    # [Phoenix] Debug Logging for Context
    
    # [Phoenix] Debug Logging for Context
    has_log = git_log is not None and git_log.strip() != "" and not git_log.startswith("[git-log-error]")
    has_diff = git_diff is not None and git_diff.strip() != "" and not git_diff.startswith("[git-diff-error]")
    
    if has_log:
        update_job_log(job_id, f"Received Git Log ({len(git_log)} chars)")
    else:
        update_job_log(job_id, f"No Git Log received (value={repr(git_log[:80] if git_log else None)})")
        
    if has_diff:
        update_job_log(job_id, f"Received Git Diff ({len(git_diff)} chars)")
    else:
        update_job_log(job_id, f"No Git Diff received (value={repr(git_diff[:80] if git_diff else None)}); continuing security scan")
    if force_review:
        update_job_log(job_id, "Force review enabled (full scan)")
    
    try:
        if JOBS[job_id]["status"] == "cancelled": return
        
        if JOBS[job_id]["status"] == "cancelled": return
        
        # 1. Unzip & Count (Fast Feedback)
        total_files_in_workspace = await asyncio.to_thread(_setup_workspace_sync, zip_path, temp_dir)
        
        update_job_progress(job_id, current_file="Scanning...", total=total_files_in_workspace)
        update_job_log(job_id, f"Scanning {total_files_in_workspace} files...")

        # 2. Git Init (Slower, background)
        await asyncio.to_thread(_git_init_sync, temp_dir)
        workspace_index = _build_workspace_file_index(temp_dir)
        update_job_log(job_id, f"[Trace] Workspace index ready: {len(workspace_index.get('files_by_rel', {}))} files")
        
        # Sonar Scan
        
        # Sonar Scan (Microservice)
        update_job_log(job_id, f"Scanning {total_files_in_workspace} files for Vulnerabilities...")
        sonar_findings = ""
        sonar_report_raw = []
        
        if get_settings().get("sonarqube.enabled", False):
            try:
                # Use the original zip_path if available to save time re-zipping?
                # process_repo_job receives zip_path. Perfect.
                
                update_job_log(job_id, "Sending to Sonar Service...")
                result = await scan_via_microservice(zip_path, job_id)

                issues = _extract_sonar_issues(result)
                sonar_report_raw = issues
                
                if issues:
                    update_job_log(job_id, f"Found {len(issues)} issues/hotspots.")
                    sonar_findings = "\n".join([f"- {i['message']} at `{i.get('component', '').split(':')[-1]}:{i.get('line', '?')}`" for i in issues[:20]])
                    if len(issues) > 20:
                        sonar_findings += f"\n...and {len(issues)-20} more."
                else:
                    update_job_log(job_id, "No static analysis issues found.")

            except Exception as e:
                update_job_log(job_id, f"Sonar Analysis Failed: {e}")

        # [BlackboxTester] Feature: PR Summaries & Walkthroughs
        # Generate a high-level summary of intent BEFORE fixing bugs.
        pr_walkthrough = ""
        if (has_log or has_diff) and ai_handler:
            update_job_log(job_id, "Generating PR Walkthrough...")
            try:
                # Truncate context for summary to avoid limits
                glog_trunc = git_log[:3000] if git_log else "No Git Log"
                gdiff_trunc = git_diff[:3000] if git_diff else "No Git Diff"
                
                summary_prompt = f"""You are a Technical Writer for a Software Development team.
Analyze the following Git Log and Diff.
Generate a concise, structured 'PR Walkthrough' in Markdown.

GIT LOG:
{glog_trunc}

GIT DIFF SUMMARY:
{gdiff_trunc}

OUTPUT REQUIREMENTS:
- Use H2 (##) for Main Intent.
- Use H3 (###) for "Architectural Changes".
- Use bullet points for specific file changes.
- Tone: Professional, descriptive, encouraging.
"""
                pr_walkthrough, _ = await ai_handler.chat_completion(
                    model=get_settings().config.model, 
                    system="You are a Technical Writer.", 
                    user=summary_prompt
                )
                update_job_log(job_id, "PR Walkthrough Generated.")
            except Exception as e:
                get_logger().warning(f"Failed to generate summary: {e}")
                pr_walkthrough = "### Changes Overview\n(Automated summary generation failed, refer to file diffs.)"

        # AI Fix
        update_job_log(job_id, "Starting AI Analysis " + ("(Fixing Findings)" if sonar_findings else "(General Review)"))
        
        # ai_handler is already initialized at start of function
        if ai_handler is None:
             update_job_log(job_id, "AI Handler is missing. Attempting re-init...")
             try:
                 ai_handler = LiteLLMAIHandler()
             except: pass

        # Hard fail if LLM is unavailable; do not pretend success with empty fixes.
        if ai_handler is None:
            err_msg = "AI handler unavailable: set GROQ_API_KEY (or configured model provider key) on AI Core."
            update_job_log(job_id, err_msg)
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["error"] = err_msg
            return
        
        fixes = []
        limit_reached = False
        limit_error_msg = ""
        summary_lines = []

        # [Phoenix] Enable Analysis if we have Sonar Findings OR Git Diff (Logic changes)
        if sonar_findings or git_diff or force_review:
            files_to_issues = {}
            if sonar_findings:
                for issue in sonar_report_raw:
                    issue_file = _extract_issue_filename(issue)
                    if issue_file:
                        if issue_file not in files_to_issues:
                            files_to_issues[issue_file] = []
                        files_to_issues[issue_file].append(issue)
                    else:
                        update_job_log(job_id, f"[Trace] Issue missing filename keys: {list(issue.keys())}")

            total_files = min(len(files_to_issues), 20) # Boost to 20 for full coverage
            update_job_progress(job_id, current_file="Starting...", processed=0, total=total_files)

            # [Phoenix] Stage A Preparation: Parse Diff to find ALL changed files
            # This ensures we fix files that have logic bugs but NO Sonar issues
            changed_files_from_diff = []
            if git_diff:
                update_job_log(job_id, f"[Debug] Git Diff Length: {len(git_diff)}")
                # Regex to find "diff --git a/filename b/filename"
                matches = re.findall(r"diff --git a/(.*?) b/", git_diff)
                changed_files_from_diff = list(set(matches)) # Unique files
                update_job_log(job_id, f"[Debug] Files in Diff: {changed_files_from_diff}")
                get_logger().info(f"[Stage A] Detected changed files from Diff: {changed_files_from_diff}")

            # Merge Diff Files into candidates
            if not sonar_findings: files_to_issues = {} 
            
            for file in changed_files_from_diff:
                if file not in files_to_issues:
                    files_to_issues[file] = [] 

            # Force review fallback: include top code files if nothing queued
            if force_review and not files_to_issues:
                update_job_log(job_id, "Force review: scanning top files")
                candidates = []
                for root, dirs, files in os.walk(temp_dir):
                    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', 'venv', '.venv']]
                    for f in files:
                        if f.endswith(('.py', '.js', '.ts', '.go', '.java', '.rs')):
                            rel_path = os.path.relpath(os.path.join(root, f), temp_dir)
                            candidates.append(rel_path)
                    if len(candidates) >= 10:
                        break
                for candidate in candidates[:10]:
                    if candidate not in files_to_issues:
                        files_to_issues[candidate] = []
                    
            # [DEBUG] Log all identified files from Sonar + Diff
            update_job_log(job_id, f"[Debug] Final Queue: {list(files_to_issues.keys())}")
            get_logger().info(f"[FLOW TRACE] Final Candidates for fixing: {list(files_to_issues.keys())}")

            processed_count = 0
            for filename, file_issues in files_to_issues.items():
                if JOBS[job_id]["status"] == "cancelled": return

                # Incremental Limit: Process up to 20 files (CodeRabbit Scale)
                if processed_count >= 20: break

                full_path, resolve_mode, resolve_details = _resolve_workspace_file(temp_dir, filename, workspace_index)
                if not full_path:
                    get_logger().warning(f"[FLOW TRACE] File resolution failed for issue path: {filename} details={resolve_details}")
                    update_job_log(job_id, f"[Trace] Skip unresolved file: {filename}")
                    continue
                update_job_log(job_id, f"[Trace] Resolved `{filename}` via {resolve_mode}")
                
                # [BlackboxTester] Filter out "trash" (Markdown, Text, Configs) - Focus on Logic
                # [BlackboxTester] Filter out "trash" (Markdown, Text, Binaries) - Include Configs for Logic Check
                if filename.endswith(('.md', '.txt', '.lock', '.png', '.jpg', '.jpeg', '.gif')):
                    update_job_log(job_id, f"Skipping non-code file: {filename}")
                    continue

                msg = f"AI Fixing ({processed_count + 1}/{total_files}): {filename}..."
                update_job_log(job_id, msg)
                update_job_progress(job_id, current_file=filename, processed=processed_count + 1, total=total_files)

                try:
                    update_job_log(job_id, f"Reading file: {filename}")
                    with open(full_path, 'r') as f:
                        content = f.read()
                    
                    if JOBS[job_id]["status"] == "cancelled": return

                    # [BlackboxTester] Optimization: Calc CodeGraph once per file
                    codegraph_context = None

                    if JOBS[job_id]["status"] == "cancelled": return
                    
                    # [Phoenix Stage A] Review Logic Changes (if diff exists and touches this file)
                    # Note: We need a way to know if this file was changed. 
                    # If git_diff is provided, we can either parse it or run a "Review" pass separately.
                    # For MVP: We will do a generic "Review" pass on the file content using the Diff context IF the file is in the diff.
                    # Simplified: We treat 'git_diff' as global context for the file fixer.
                    
                    if filename in changed_files_from_diff: # Precise check from parsed diff
                        # [BlackboxTester] Context Engineering: Build CodeGraph for Reviewer (Stage A)
                        if not codegraph_context:
                             codegraph_context = build_codegraph_v2(temp_dir, filename)

                        # [Stage A] Logical Review Prompt
                        update_job_log(job_id, f"Running Stage A (Review) on {filename}...")
                        stage_a_prompt = f"""You are a Senior Code Reviewer.
Analyze the **ENTIRE FILE CONTENT** for LOGICAL BUGS, SECURITY FLAWS, or bad patterns.
Use the GIT DIFF to understand the *latest* changes, but **DO NOT** limit your review to only changed lines.
If you see a critical bug in the existing code (e.g., hardcoded secrets, race conditions) that was introduced in a **previous commit**, YOU MUST FLAG IT.

Ignore style/formatting.

CODEGRAPH CONTEXT (Dependencies):
{codegraph_context if codegraph_context else "None"}

GIT DIFF CONTEXT:
{git_diff[:2000]}... (truncated)

GIT LOG:
{git_log[:2000] + '... (truncated)' if git_log and len(git_log) > 2000 else (git_log if git_log else "None")}

CURRENT FILE CONTENT:
```
{content}
```

Identify CRITICAL issues to fix. Return JSON:
{{
    "issues": [
        {{ "line": 10, "message": "Possible null pointer here due to recent change..." }},
        {{ "line": 45, "message": "Insecure direct object reference introduced..." }}
    ]
}}
"""
                        # Call LLM for Review
                        # For this MVP step, we will APPEND these issues to 'file_issues' so they get fixed in Stage B.
                        try:
                            # Reuse AI Handler for Review
                            get_logger().info(f"[Stage A] Deep Log - Prompt:\n{stage_a_prompt}")
                            update_job_log(job_id, "Analyzing Changes (Stage A)...")
                            review_resp, _ = await ai_handler.chat_completion(model=get_settings().config.model, system="You are a Critical Code Reviewer.", user=stage_a_prompt)
                            
                            # [Deep Log] Send to UI so user can see what happened
                            get_logger().info(f"[Stage A] Deep Log - Raw Response:\n{review_resp}")
                            update_job_log(job_id, f"[AI RAW DEBUG]: {review_resp[:500]}...") # Show first 500 chars to user
                            
                            if "```" in review_resp:
                                match = re.search(r"```(?:json)?(.*?)```", review_resp, re.DOTALL)
                                if match: review_resp = match.group(1).strip()
                            
                            review_data = json.loads(review_resp)
                            for logic_issue in review_data.get("issues", []):
                                logic_issue["source"] = "ai_review" # [UI] Distinguish from Sonar
                                file_issues.append(logic_issue)
                                update_job_log(job_id, f"  + [Stage A] Found Issue: {logic_issue.get('message')}")
                        except Exception as e:
                            get_logger().warning(f"[Stage A] Review Failed: {e}")

                    # [BlackboxTester] Process EACH ISSUE individually with targeted snippets
                    # [Phoenix] Ensure we iterate over the updated list (including Stage A findings)
                    current_file_issues = files_to_issues[filename]
                    file_fix_applied = False
                    current_content = content  # Track content as we apply fixes
                    
                    print(f"[FLOW TRACE] Processing file: {filename} with {len(current_file_issues)} issues (Sonar + Stage A)")
                    for issue in current_file_issues:
                        if JOBS[job_id]["status"] == "cancelled": return
                        if JOBS[job_id]["status"] == "cancelled": return
                        
                        issue_line = issue.get("line", 1)
                        issue_msg = issue.get("message", "Security Issue")
                        print(f"[FLOW TRACE] Issue: line {issue_line} - {issue_msg[:50]}...")
                        
                        # Extract targeted snippet (±10 lines) - CodeRabbit Strategy
                        snippet, start_line, end_line = extract_code_snippet(current_content, issue_line, context_lines=10)
                        print(f"[FLOW TRACE] Snippet extracted: lines {start_line}-{end_line} ({len(snippet)} chars)")
                        
                        update_job_log(job_id, f"  → Fixing: {issue_msg[:50]}... (line {issue_line})")

                        # Deterministic fallback for common secret findings.
                        fallback_fixed = _apply_secret_fallback_fix(filename, current_content, issue)
                        if fallback_fixed and fallback_fixed != current_content:
                            current_content = fallback_fixed
                            file_fix_applied = True
                            update_job_log(job_id, "  + Applied deterministic secret redaction fallback.")
                            continue
                        
                        system_prompt = f"""You are an expert Security Fixer.
Fix ONLY the specific vulnerability described below. Do not refactor unrelated code.

RULES:
1. Replace hardcoded secrets with environment variable reads (e.g. process.env.X or os.environ.get("X")).
2. Do NOT create .env files with REAL secret values. Use placeholders like "your_db_password_here".
3. If fixing secret exposure, suggest adding .env to .gitignore via additional_edits.
4. Each additional_edits entry must have a unique filename. Do NOT repeat filenames from previous fixes.

OUTPUT FORMAT: Return a JSON object with the fixed snippet.
IMPORTANT: The 'fixed_snippet' must contain ONLY clean, valid code. Do NOT include line numbers (e.g. "1 |") or prefixes.

Structure:
{{
    "fixed_snippet": "THE FIXED CODE...",
    "issue_line": 123,
    "issue_message": "...",
    "additional_edits": [
        {{ "filename": ".env.example", "content": "DB_PASSWORD=your_db_password_here" }},
        {{ "filename": ".gitignore", "content": ".env\\n.env.local" }}
    ]
}}"""
                        
                        # [BlackboxTester] Context Engineering: Build CodeGraph (Lazy Load)
                        if not codegraph_context:
                            codegraph_context = build_codegraph_v2(temp_dir, filename)
                        
                        # print(f"[FLOW TRACE] Codegraph Context Length: {len(codegraph_context)}")

                        user_prompt = f"""
**Vulnerability**: {issue_msg}
**Location**: {filename}:{issue_line}

**Code Snippet** (lines {start_line}-{end_line}, issue at line {issue_line} marked with >>>):
```
{snippet}
```

**Codegraph Context** (Imports & Dependencies):
{codegraph_context if codegraph_context else "No dependency context available."}

**Git History Context** (Use this to understand recent changes/intent):
{git_log[:2000] + '... (truncated)' if git_log and len(git_log) > 2000 else (git_log if git_log else "No git history available.")}

Return ONLY valid JSON with the fixed code for this snippet:
{{
    "fixed_snippet": "THE FIXED CODE FOR LINES {start_line}-{end_line}",
    "issue_line": {issue_line},
    "issue_message": "{issue_msg[:100]}",
    "additional_edits": []
}}
"""
                        
                        # [DEBUG] Print model and API key info
                        import os as debug_os
                        debug_model = get_settings().config.model
                        debug_groq_key = debug_os.environ.get("GROQ_API_KEY", "NOT_SET")[:20] + "..."
                        print(f"[DEBUG] Using Model: {debug_model}")
                        print(f"[DEBUG] GROQ_API_KEY: {debug_groq_key}")
                        
                        print(f"[FLOW TRACE] Sending request to LLM...")
                        
                        # [BlackboxTester] Make LLM call interruptible for "Kill Analysis"
                        llm_task = asyncio.create_task(ai_handler.chat_completion(
                            model=debug_model,
                            system=system_prompt,
                            user=user_prompt
                        ))

                        # Poll for cancellation while waiting
                        while not llm_task.done():
                            if JOBS[job_id]["status"] == "cancelled":
                                llm_task.cancel()
                                print(f"[Fixing Agent] Job {job_id} cancelled during LLM call.")
                                return
                            await asyncio.sleep(1) # Check every second
                        
                        response, _ = await llm_task
                        print(f"[FLOW TRACE] LLM Response received (length: {len(response) if response else 0})")
                        
                        clean_response = response
                        if "```" in response:
                            match = re.search(r"```(?:json)?(.*?)```", response, re.DOTALL)
                            if match: clean_response = match.group(1).strip()
                        
                        try:
                            # [DEBUG] Log the raw text before parsing
                            # ERROR FIX: Escape braces to prevent Loguru crash
                            safe_raw = clean_response[:200].replace("{", "{{").replace("}", "}}")
                            get_logger().info(f"[FLOW TRACE] Raw LLM Response: {safe_raw}...")

                            # [BlackboxTester] Fix for "Invalid control character" (newlines in JSON strings from LLM)
                            data = json.loads(clean_response, strict=False)
                            # Safe printing of JSON avoids Loguru/logging format specifier crashes with {}
                            safe_json = json.dumps(data, indent=2).replace("{", "{{").replace("}", "}}")
                            get_logger().info(f"[FLOW TRACE] Valid JSON parsed: {safe_json}")

                            fixed_snippet = data.get("fixed_snippet")
                            
                            if fixed_snippet:
                                get_logger().info(f"[FLOW TRACE] Applying fix for {filename}...")
                                # Apply the fix to current_content
                                lines = current_content.splitlines()
                                fixed_lines = fixed_snippet.splitlines()
                                
                                # Replace lines in the snippet range
                                # NOTE: start_line is 1-indexed for display, convert to 0-indexed index
                                idx_start = start_line - 1
                                idx_end = end_line 
                                
                                # Ensure bounds
                                if idx_start < 0: idx_start = 0
                                if idx_end > len(lines): idx_end = len(lines)

                                new_lines = lines[:idx_start] + fixed_lines + lines[idx_end:]
                                current_content = "\n".join(new_lines)
                                file_fix_applied = True
                                get_logger().info(f"[FLOW TRACE] Fix applied to in-memory content.")

                                # [BlackboxTester] Handle Additional Edits (e.g. .env, .gitignore)
                                # Deduplicated: merge content if same filename already proposed
                                extra_edits = data.get("additional_edits", [])
                                for edit in extra_edits:
                                    ef_name = edit.get("filename")
                                    ef_content = edit.get("content")
                                    if ef_name and ef_content:
                                        # Context-Aware .env/.env.example Placement
                                        if ef_name in (".env", ".env.example"):
                                            parent_dir = os.path.dirname(filename)
                                            if parent_dir:
                                                ef_name = os.path.join(parent_dir, ef_name).replace("\\", "/")
                                            
                                        ef_path = os.path.join(temp_dir, ef_name)
                                        
                                        # Dedup: Check if we already have a fix for this filename
                                        existing_fix = next((f for f in fixes if f["filename"] == ef_name), None)
                                        if existing_fix:
                                            # Merge: append new env vars that aren't already present
                                            existing_lines = set(existing_fix["new_content"].splitlines())
                                            new_lines = [l for l in ef_content.splitlines() if l not in existing_lines]
                                            if new_lines:
                                                merged = existing_fix["new_content"] + "\n" + "\n".join(new_lines)
                                                existing_fix["new_content"] = merged
                                                existing_fix["unified_diff"] = f"--- /dev/null\n+++ {ef_name}\n@@ -0,0 +1 @@\n+{merged}"
                                                update_job_log(job_id, f"Merged new entries into existing {ef_name}")
                                            else:
                                                update_job_log(job_id, f"Skipped duplicate {ef_name} (already proposed)")
                                            continue
                                        
                                        # Write to temp dir
                                        with open(ef_path, "w") as ef:
                                            ef.write(ef_content)
                                        
                                        msg = f"Created/Updated auxiliary file: {ef_name}"
                                        update_job_log(job_id, msg)
                                            
                                        # Add to Fixes List
                                        fixes.append({
                                            "filename": ef_name,
                                            "new_content": ef_content,
                                            "unified_diff": f"--- /dev/null\n+++ {ef_name}\n@@ -0,0 +1 @@\n+{ef_content}",
                                            "original_content": "",
                                            "issues_fixed": 0
                                        })
                                        summary_lines.append(f"- Created/Updated `{ef_name}`")

                            else:
                                safe_resp = clean_response.replace("{", "{{").replace("}", "}}")
                                get_logger().info(f"[FLOW TRACE] 'fixed_snippet' key missing in JSON response: {safe_resp}")
                                update_job_log(job_id, "AI did not provide a valid fix structure.")
                                
                        except Exception as parse_err:
                            safe_resp = clean_response.replace("{", "{{").replace("}", "}}")
                            get_logger().info(f"[FLOW TRACE] JSON Parse error: {parse_err}. Response: {safe_resp}")
                            update_job_log(job_id, f"Failed to parse AI response: {parse_err}")
                    
                    # After all issues processed, generate final diff
                    if file_fix_applied and current_content != content:
                        print(f"[FLOW TRACE] Generating final unified diff for {filename}...")
                        unified_diff = generate_unified_diff(content, current_content, filename)
                        fixes.append({
                            "filename": filename, 
                            "new_content": current_content,
                            "unified_diff": unified_diff,
                            "original_content": content,
                            "issues_fixed": file_issues # [UI] Pass full objects (with source/message)
                        })
                        summary_lines.append(f"- Fixed {len(file_issues)} issues in `{filename}`")
                    else:
                        print(f"[FLOW TRACE] No changes made to {filename} (file_fix_applied={file_fix_applied})")
                    
                    processed_count += 1

                except Exception as e:
                    # [BlackboxTester] Better RetryError Logging
                    import tenacity
                    if isinstance(e, tenacity.RetryError):
                        try:
                            last_attempt = e.last_attempt
                            if last_attempt.failed:
                                e = last_attempt.exception()
                        except: pass

                    err_str = str(e).lower()
                    print(f"\n[Fixing Agent] ERROR PROCESSING {filename}:")
                    print(f"--- ERROR DETAILS ---\n{e}")
                    
                    # [BlackboxTester] FIXED: Only detect ACTUAL LLM API limit errors
                    # - Must contain rate limit indicators AND be from litellm/openrouter/groq
                    is_llm_rate_limit = (
                        ("ratelimiterror" in err_str or "rate_limit" in err_str) or
                        ("429" in err_str and ("litellm" in err_str or "openrouter" in err_str or "groq" in err_str)) or
                        ("402" in err_str and "credit" in err_str) or
                        ("provider returned error" in err_str and "429" in err_str)
                    )
                    
                    if is_llm_rate_limit:
                        limit_reached = True
                        limit_error_msg = str(e)
                        update_job_log(job_id, f"LLM API Limit Reached ({str(e)[:50]}...). Stopping.")
                        print("[Fixing Agent] STOPPING: LLM API Limit Triggered.")
                        break
                    else:
                        # Not an API limit error, just log and continue to next file
                        update_job_log(job_id, f"Error processing {filename}: {str(e)[:50]}...")
        else:
            summary_lines.append("No SonarQube issues found to fix.")
            update_job_log(job_id, "No issues to fix.")

        final_summary = "\n".join(summary_lines)
        if limit_reached:
            final_summary += f"\n\nAPI Limit Reached during analysis. Showing partial results."

        result = {
            "review": final_summary, 
            "fixes": fixes, 
            "sonar_raw": sonar_findings,
            "sonar_data": sonar_report_raw,
            "sonar_raw": sonar_findings,
            "sonar_data": sonar_report_raw,
            "pr_walkthrough": pr_walkthrough, # [UI] New Field
            "limit_reached": limit_reached
        }
        
        JOBS[job_id]["result"] = result
        JOBS[job_id]["status"] = "completed"
        update_job_log(job_id, "Analysis Completed Successfully.")

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        update_job_log(job_id, f"Job Failed: {e}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@router.post("/api/v1/ide/review_repo_async")
async def review_repo_async(
    request: Request,
    file: UploadFile = File(...),
    git_log: str = Form(""),
    git_diff: str = Form(""),
    force_review: str = Form(None),
    background_tasks: BackgroundTasks = None
):
    trace = _trace_headers(request)
    get_logger().info(
        "[ide-review-async:v2] received upload",
        artifact={
            "trace": trace,
            "filename": file.filename,
            "has_git_log": bool(git_log),
            "has_git_diff": bool(git_diff),
        },
    )

    job_id = str(uuid.uuid4())
    temp_dir = os.path.join("/tmp", f"blackbox_repo_{os.urandom(4).hex()}")
    os.makedirs(temp_dir, exist_ok=True)
    
    zip_path = os.path.join(temp_dir, "repo.zip")
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    zip_size = os.path.getsize(zip_path)
    get_logger().info(
        f"[ide-review-async:v2] job={job_id} persisted zip bytes={zip_size} path={zip_path}"
    )
        
    JOBS[job_id] = {
        "status": "pending",
        "logs": ["Job Queued..."],
        "progress": {"current_file": "Uploading...", "processed": 0, "total": 0},
        "result": None
    }
    update_job_log(job_id, f"ZIP received ({zip_size} bytes)")
    force_flag = str(force_review).lower() in ["1", "true", "yes", "on"]
    if background_tasks:
        background_tasks.add_task(process_repo_job, job_id, zip_path, temp_dir, git_log, git_diff, force_flag)
        update_job_log(job_id, "Background task scheduled")
        get_logger().info(f"[ide-review-async:v2] job={job_id} background task scheduled")
    else:
        get_logger().warning(f"[ide-review-async:v2] job={job_id} missing background_tasks; task will not start")
    
    return {"job_id": job_id, "status": "pending"}

@router.get("/api/v1/ide/job_status/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in JOBS:
        get_logger().warning(f"[ide-job-status:v2] job not found job_id={job_id}")
        return {"status": "not_found"}
    get_logger().debug(f"[ide-job-status:v2] job status request job_id={job_id} status={JOBS[job_id].get('status')}")
    return JOBS[job_id]

@router.post("/api/v1/ide/cancel/{job_id}")
async def cancel_job(job_id: str):
    if job_id in JOBS:
        JOBS[job_id]["status"] = "cancelled"
        update_job_log(job_id, "User requested cancellation. Stopping...")
        return {"status": "cancelled"}
    return {"status": "not_found"}


# ===========================================================================
# Unified Analysis - Parallel AI + Sonar with Merged Findings
# ===========================================================================

@router.post("/api/v1/ide/analyze_unified")
async def analyze_unified(
    file: UploadFile = File(...),
    git_diff: str = Form(None),
    background_tasks: BackgroundTasks = None
):
    """
    Unified Analysis Endpoint - New Architecture
    
    Runs PR Agent AI review and Sonar scan in PARALLEL, then:
    1. Merges findings into unified format
    2. Deduplicates overlapping issues
    3. Generates fixes for all findings
    4. Returns unified result
    
    Returns:
        job_id: Use to poll /job_status/{job_id}
    """
    job_id = None
    temp_dir = None
    
    try:
        job_id = str(uuid.uuid4())
        get_logger().info(f"[ide-analyze-unified] Starting job {job_id}")
        
        temp_dir = os.path.join("/tmp", f"blackbox_unified_{os.urandom(4).hex()}")
        os.makedirs(temp_dir, exist_ok=True)

        zip_path = os.path.join(temp_dir, "repo.zip")
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        get_logger().info(f"[ide-analyze-unified] Saved upload to {zip_path}")
    
    except Exception as exc:
        get_logger().error(f"[ide-analyze-unified] Failed to persist upload: {exc}", exc_info=True)
        # Clean up on failure
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except:
                pass
        return {
            "error": "Failed to process upload",
            "detail": str(exc),
            "job_id": job_id or f"error-{uuid.uuid4()}",
            "status": "failed"
        }
    
    # Initialize job tracking
    JOBS[job_id] = {
        "status": "pending",
        "logs": ["Job initialized"],
        "progress": {"current_file": "", "processed": 0, "total": 0, "percentage": 0},
        "result": None,
        "analysis_type": "unified"
    }
    
    # Start background processing
    try:
        if background_tasks is None:
            get_logger().warning("[ide-analyze-unified] background_tasks missing; using asyncio task")
            asyncio.create_task(process_unified_analysis(job_id, zip_path, temp_dir, git_diff))
        else:
            background_tasks.add_task(
                process_unified_analysis,
                job_id, zip_path, temp_dir, git_diff
            )
    except Exception as exc:
        get_logger().error(f"[ide-analyze-unified] Failed to start background task: {exc}", exc_info=True)
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["result"] = {"error": str(exc)}
    
    return {"job_id": job_id, "status": "pending", "analysis_type": "unified"}


async def process_unified_analysis(
    job_id: str,
    zip_path: str,
    temp_dir: str,
    git_diff: str = None
):
    """
    Background task for unified analysis.
    
    Uses AnalysisOrchestrator to run AI + Sonar in parallel.
    """
    import zipfile
    
    try:
        JOBS[job_id]["status"] = "processing"
        update_job_log(job_id, "Starting unified analysis (AI + Sonar parallel)")
        
        # Extract zip
        update_job_log(job_id, "Extracting repository...")
        extract_dir = os.path.join(temp_dir, "extracted")
        with zipfile.ZipFile(zip_path, 'r') as archive:
            archive.extractall(extract_dir)
        
        # Find repository root
        contents = os.listdir(extract_dir)
        if len(contents) == 1 and os.path.isdir(os.path.join(extract_dir, contents[0])):
            workspace_path = os.path.join(extract_dir, contents[0])
        else:
            workspace_path = extract_dir
        
        # Get changed files from git diff or scan all
        changed_files = []
        if git_diff:
            # Parse diff to get file list
            for line in git_diff.split('\n'):
                if line.startswith('diff --git'):
                    parts = line.split(' b/')
                    if len(parts) > 1:
                        changed_files.append(parts[1])
        
        if not changed_files:
            # Scan for code files
            for root, dirs, files in os.walk(workspace_path):
                dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', 'venv', '.venv']]
                for f in files:
                    if f.endswith(('.py', '.js', '.ts', '.go', '.java', '.rs')):
                        rel_path = os.path.relpath(os.path.join(root, f), workspace_path)
                        changed_files.append(rel_path)
        
        update_job_log(job_id, f"Found {len(changed_files)} files to analyze")
        JOBS[job_id]["progress"]["total"] = len(changed_files)
        
        # Run unified analysis using orchestrator
        update_job_log(job_id, "Running parallel analysis (AI review + Sonar scan)...")
        
        try:
            orchestrator = AnalysisOrchestrator()
            result = await orchestrator.analyze(
                workspace_path=workspace_path,
                diff_content=git_diff or "",
                changed_files=changed_files[:50],  # Limit files
                job_id=job_id
            )
        except Exception as orch_err:
            get_logger().error(f"Orchestrator failed: {orch_err}", exc_info=True)
            # Create minimal result to avoid complete failure
            from pr_agent.algo.findings import AnalysisResult
            result = AnalysisResult(
                findings=[],
                summary={
                    "total": 0,
                    "by_source": {},
                    "by_severity": {},
                    "quality_gate": "ERROR",
                    "error": str(orch_err)
                },
                execution_time_ms=0
            )
        
        # Update progress
        JOBS[job_id]["progress"]["processed"] = len(changed_files)
        JOBS[job_id]["progress"]["percentage"] = 100
        
        # Log summary
        summary = result.summary
        update_job_log(job_id, f"Analysis complete: {summary.get('total', 0)} issues found")
        update_job_log(job_id, f"  - By source: {summary.get('by_source', {})}")
        update_job_log(job_id, f"  - By severity: {summary.get('by_severity', {})}")
        update_job_log(job_id, f"  - Quality gate: {summary.get('quality_gate', 'unknown')}")
        
        # Store result
        JOBS[job_id]["result"] = {
            "findings": [f.to_dict() for f in result.findings],
            "summary": summary,
            "execution_time_ms": result.execution_time_ms,
            "quality_gate": summary.get("quality_gate", "unknown")
        }
        JOBS[job_id]["status"] = "completed"
        update_job_log(job_id, "Unified analysis completed successfully")
        
    except Exception as e:
        get_logger().error(f"Unified analysis failed: {e}", exc_info=True)
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["result"] = {"error": str(e)}
        update_job_log(job_id, f"Analysis failed: {e}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/api/v1/ide/apply_fix")
async def apply_fix(
    file_path: str = Form(...),
    original_code: str = Form(...),
    fixed_code: str = Form(...),
    start_line: int = Form(...),
    end_line: int = Form(...)
):
    """
    Apply a fix to a file (for IDE integration).
    
    This endpoint allows VS Code to apply fixes generated by the unified analysis.
    """
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": "File not found"}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply fix
        lines = content.splitlines(keepends=True)
        start_idx = start_line - 1
        end_idx = end_line
        
        # Ensure fixed code ends with newline
        if lines[start_idx:end_idx] and lines[end_idx-1].endswith('\n'):
            if not fixed_code.endswith('\n'):
                fixed_code += '\n'
        
        new_lines = lines[:start_idx] + [fixed_code] + lines[end_idx:]
        new_content = ''.join(new_lines)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return {"success": True, "message": "Fix applied successfully"}
        
    except Exception as e:
        return {"success": False, "error": str(e)}
