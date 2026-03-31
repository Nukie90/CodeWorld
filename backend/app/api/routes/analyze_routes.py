import asyncio
import uuid
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services import repo_manager
from app.services.analyze_local_folder import analyze_local_folder
from app.services.state_manager import _PROGRESS, _ANALYSIS_CACHE, get_session
from app.utils.analysis_helpers import normalize_analysis_result

router = APIRouter(tags=["analyze"])

def verify_session(token: Optional[str]):
    """Ensure a provided token belongs to an active session."""
    # Treat empty string as "no token" (logged out/guest)
    if not token or token.strip() == "":
        return None
        
    session = get_session(token)
    if not session:
        raise HTTPException(
            status_code=401, 
            detail="Session expired. Please log in with GitHub again."
        )
    return session["github_token"]

class RepoAnalyzeRequest(BaseModel):
    repo_url: str
    task_id: Optional[str] = None
    token: Optional[str] = None

@router.get("/analyze/progress/{task_id}")
async def analyze_progress(task_id: str):
    """EventSource endpoint for repo analysis progress."""
    async def event_generator():
        while True:
            data = _PROGRESS.get(task_id)
            if not data:
                # If no data yet, wait a bit
                await asyncio.sleep(0.5)
                continue
            
            yield f"data: {json.dumps(data)}\n\n"
            
            if data.get("done") or data.get("error"):
                break
            
            await asyncio.sleep(0.5)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/analyze/repo")
def analyze_repo(payload: RepoAnalyzeRequest):
    # clone (or use cached) then analyze
    repo_url = payload.repo_url
    github_token = verify_session(payload.token)
    task_id = payload.task_id or str(uuid.uuid4())

    def update_progress(progress: int, message: str, done: bool = False, error: Optional[str] = None):
        _PROGRESS[task_id] = {"progress": progress, "message": message, "done": done, "error": error}

    update_progress(1, "Initializing...")

    try:
        local_path = repo_manager.clone_repo(repo_url, token=github_token, progress_callback=update_progress)
    except Exception as exc:
        err_msg = str(exc)
        update_progress(0, f"Failed to clone: {err_msg}", error=err_msg)
        # If the error is due to invalid repo format, return a 400
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=400, detail=str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to clone repo: {str(exc)}")

    try:
        # Before full analysis, see if we can get HEAD and cache it
        current_head = None
        try:
             current_head = repo_manager._run_git(local_path, ["rev-parse", "HEAD"]).strip()
        except Exception:
             pass

        if current_head and current_head in _ANALYSIS_CACHE:
             analysis = normalize_analysis_result(_ANALYSIS_CACHE[current_head])
        else:
             analysis = analyze_local_folder(local_path, progress_callback=update_progress)
             analysis = normalize_analysis_result(analysis)
             if current_head:
                 _ANALYSIS_CACHE[current_head] = analysis
                 
        update_progress(100, "Analysis complete! ✓", done=True)
        return {"repo_url": repo_url, "folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        err_msg = str(exc)
        update_progress(0, f"Failed to analyze: {err_msg}", error=err_msg)
        raise HTTPException(status_code=500, detail=f"Failed to analyze repo: {str(exc)}")
