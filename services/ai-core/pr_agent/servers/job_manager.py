"""
Job Manager - Async Job Tracking and Status Management
=======================================================

This module manages the lifecycle of async analysis jobs.
Extracted from ide_router.py for better modularity.

Author: BlackboxTester Team
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pr_agent.log import get_logger


# ============================================================================
# Job Storage
# ============================================================================

# Structure: 
# { 
#     job_id: { 
#         "status": "pending|processing|completed|failed|cancelled", 
#         "logs": [], 
#         "progress": {
#             "current_file": "", 
#             "processed": 0, 
#             "total": 0, 
#             "percentage": 0
#         }, 
#         "result": {},
#         "created_at": datetime,
#         "updated_at": datetime
#     } 
# }
JOBS: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# Job Lifecycle Functions
# ============================================================================

def create_job(job_id: str) -> Dict[str, Any]:
    """
    Create a new job with initial state.
    
    Args:
        job_id: Unique identifier for the job
        
    Returns:
        The created job dict
    """
    now = datetime.now(timezone.utc)
    job = {
        "status": "pending",
        "logs": [],
        "progress": {
            "current_file": "",
            "processed": 0,
            "total": 0,
            "percentage": 0
        },
        "result": {},
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    JOBS[job_id] = job
    get_logger().info(f"Created job {job_id}")
    return job


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a job by ID.
    
    Args:
        job_id: The job identifier
        
    Returns:
        Job dict or None if not found
    """
    return JOBS.get(job_id)


def update_job_status(job_id: str, status: str) -> bool:
    """
    Update job status.
    
    Args:
        job_id: The job identifier
        status: New status (pending, processing, completed, failed, cancelled)
        
    Returns:
        True if updated, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["status"] = status
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    get_logger().info(f"Job {job_id} status: {status}")
    return True


def update_job_log(job_id: str, message: str) -> bool:
    """
    Append a log message to a job.
    
    Args:
        job_id: The job identifier
        message: Log message to append
        
    Returns:
        True if updated, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["logs"].append(message)
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Use args to prevent Loguru/logging from interpreting braces in 'message' as format specifiers
    safe_msg = str(message).replace("{", "{{").replace("}", "}}")
    get_logger().info(f"Job {job_id}: {safe_msg}")
    return True


def update_job_progress(
    job_id: str, 
    current_file: Optional[str] = None, 
    processed: Optional[int] = None, 
    total: Optional[int] = None
) -> bool:
    """
    Update job progress tracking.
    
    Args:
        job_id: The job identifier
        current_file: Currently processing file
        processed: Number of files processed
        total: Total files to process
        
    Returns:
        True if updated, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    p = JOBS[job_id].get("progress", {})
    
    if current_file is not None:
        p["current_file"] = current_file
    if processed is not None:
        p["processed"] = processed
    if total is not None:
        p["total"] = total
    
    # Calculate percentage
    if p.get("total", 0) > 0:
        p["percentage"] = int((p.get("processed", 0) / p["total"]) * 100)
    
    JOBS[job_id]["progress"] = p
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    return True


def update_job_result(job_id: str, result: Dict[str, Any]) -> bool:
    """
    Update job result data.
    
    Args:
        job_id: The job identifier
        result: Result data dict
        
    Returns:
        True if updated, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["result"] = result
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    return True


def cancel_job(job_id: str) -> bool:
    """
    Mark a job as cancelled.
    
    Args:
        job_id: The job identifier
        
    Returns:
        True if cancelled, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["status"] = "cancelled"
    update_job_log(job_id, "Job Cancellation Requested by User.")
    return True


def is_job_cancelled(job_id: str) -> bool:
    """
    Check if a job has been cancelled.
    
    Args:
        job_id: The job identifier
        
    Returns:
        True if cancelled, False otherwise
    """
    job = JOBS.get(job_id)
    return job is not None and job.get("status") == "cancelled"


def complete_job(job_id: str, result: Dict[str, Any]) -> bool:
    """
    Mark a job as completed with result.
    
    Args:
        job_id: The job identifier
        result: Final result data
        
    Returns:
        True if completed, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["status"] = "completed"
    JOBS[job_id]["result"] = result
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_job_log(job_id, "Job completed successfully.")
    return True


def fail_job(job_id: str, error: str) -> bool:
    """
    Mark a job as failed with error message.
    
    Args:
        job_id: The job identifier
        error: Error description
        
    Returns:
        True if updated, False if job not found
    """
    if job_id not in JOBS:
        return False
    
    JOBS[job_id]["status"] = "failed"
    JOBS[job_id]["result"]["error"] = error
    JOBS[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_job_log(job_id, f"Job failed: {error}")
    return True


def cleanup_old_jobs(max_age_hours: int = 24) -> int:
    """
    Remove jobs older than max_age_hours.
    
    Args:
        max_age_hours: Maximum job age in hours
        
    Returns:
        Number of jobs removed
    """
    from datetime import timedelta
    
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    to_remove = []
    
    for job_id, job in JOBS.items():
        created_str = job.get("created_at", "")
        if created_str:
            try:
                created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                if created < cutoff:
                    to_remove.append(job_id)
            except (ValueError, TypeError):
                pass
    
    for job_id in to_remove:
        del JOBS[job_id]
    
    if to_remove:
        get_logger().info(f"Cleaned up {len(to_remove)} old jobs")
    
    return len(to_remove)


def get_all_jobs() -> Dict[str, Dict[str, Any]]:
    """
    Get all jobs (for debugging/admin).
    
    Returns:
        Copy of all jobs dict
    """
    return dict(JOBS)
