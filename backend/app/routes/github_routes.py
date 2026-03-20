import os
import httpx
from urllib.parse import quote
from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services import repo_manager
from app.services.analyze_local_folder import analyze_local_folder
from fastapi.responses import RedirectResponse, StreamingResponse
import asyncio
import uuid
import json
from app.model.analyzer_model import FileLint

router = APIRouter(tags=["github"])

# Simple in-memory token store: access_token -> username
_TOKENS = {}


class RepoAnalyzeRequest(BaseModel):
    repo_url: str
    task_id: Optional[str] = None
    token: Optional[str] = None

class LintRequest(BaseModel):
    code: str

@router.post("/lint/{file_name:path}", response_model=FileLint)
async def lint_file(file_name: str, payload: LintRequest):
    if file_name.endswith('.py'):
        from app.python_plugin.python_analyzer import run_pylint
        result = run_pylint(payload.code, file_name)
        return FileLint(lint_score=result.get("score"), lint_errors=result.get("errors", []))
    elif file_name.endswith(('.js', '.jsx', '.ts', '.tsx')):
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post("http://localhost:3001/lint-code", json={"code": payload.code, "filename": file_name})
            if resp.status_code == 200:
                data = resp.json()
                return FileLint(lint_score=data.get("lint_score"), lint_errors=data.get("lint_errors", []))
        except Exception as e:
            print(f"Failed to fetch JS lint: {e}")
            
    return FileLint(lint_score=None, lint_errors=[])


# Global store for progress: task_id -> {"progress": int, "message": str, "done": bool}
_PROGRESS = {}

# Global store for analysis cache: commit_hash -> FolderAnalysisResult
_ANALYSIS_CACHE = {}


class RepoBranchRequest(BaseModel):
    repo_url: str
    token: Optional[str] = None


class RepoCheckoutRequest(BaseModel):
    repo_url: str
    branch: str
    token: Optional[str] = None


class FunctionCodeRequest(BaseModel):
    repo_url: str
    filename: str
    function_name: str
    start_line: int
    lloc: int
    token: Optional[str] = None


class CommitHistoryRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    limit: Optional[int] = 50
    skip: Optional[int] = 0
    token: Optional[str] = None


class CommitDetailsRequest(BaseModel):
    repo_url: str
    commit_hash: str
    token: Optional[str] = None


@router.get("/auth/github/login")
async def github_login(request: Request):
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID not configured")

    # Use environment variable for redirect_uri, or fallback to dynamic generation
    # IMPORTANT: This must match EXACTLY what's configured in GitHub OAuth app settings
    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI")
    if not redirect_uri:
        # Fallback to dynamic generation from request
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/auth/github/callback"
    
    # scopes: repo for private repo access, read:user to obtain username
    # redirect_uri must match what's configured in GitHub OAuth app settings
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&scope=repo%20read:user"
        f"&allow_signup=true"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
    )
    return {"auth_url": auth_url}


@router.get("/auth/github/callback")
async def github_callback(code: str, request: Request):
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth client not configured")

    # Use the same redirect_uri logic as in login endpoint
    # This must match EXACTLY what's configured in GitHub OAuth app settings
    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI")
    if not redirect_uri:
        # Fallback to dynamic generation from request
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/auth/github/callback"

    token_url = "https://github.com/login/oauth/access_token"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,  # Must match the one used in auth URL
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to obtain access token")

    body = resp.json()
    access_token = body.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="No access token returned")

    # get username
    async with httpx.AsyncClient() as client:
        user_resp = await client.get("https://api.github.com/user", headers={"Authorization": f"token {access_token}"}, timeout=10)

    if user_resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch user info")

    user_json = user_resp.json()
    username = user_json.get("login") or "unknown"

    _TOKENS[access_token] = username

    frontend_url = (
        f"http://localhost:5173/?token={access_token}&username={username}"
    )

    return RedirectResponse(url=frontend_url)

@router.post("/auth/logout")
async def logout(token: str = Body(..., embed=True)):
    if token in _TOKENS:
        del _TOKENS[token]
        return {"status": "logged_out"}
    raise HTTPException(status_code=400, detail="Unknown token")


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
    token = payload.token
    task_id = payload.task_id or str(uuid.uuid4())

    def update_progress(progress: int, message: str, done: bool = False, error: Optional[str] = None):
        _PROGRESS[task_id] = {"progress": progress, "message": message, "done": done, "error": error}

    update_progress(1, "Starting analysis...")

    try:
        local_path = repo_manager.clone_repo(repo_url, token=token, progress_callback=update_progress)
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
             analysis = _ANALYSIS_CACHE[current_head]
        else:
             analysis = analyze_local_folder(local_path, progress_callback=update_progress)
             if current_head:
                 _ANALYSIS_CACHE[current_head] = analysis
                 
        update_progress(100, "Analysis complete", done=True)
        return {"repo_url": repo_url, "folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        err_msg = str(exc)
        update_progress(0, f"Failed to analyze: {err_msg}", error=err_msg)
        raise HTTPException(status_code=500, detail=f"Failed to analyze repo: {str(exc)}")


@router.get("/repo/branches")
async def repo_branches(repo_url: str, token: Optional[str] = None):
    try:
        branches = repo_manager.list_branches(repo_url, token=token)
        return branches
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list branches: {str(exc)}")


import re as _re

_COMMIT_RE = _re.compile(r'^[0-9a-f]{7,40}$', _re.IGNORECASE)


def _is_commit_hash(s: str) -> bool:
    """Return True if the string looks like a git commit hash (7-40 hex chars)."""
    return bool(_COMMIT_RE.match(s.strip()))


def _read_files_at_commit(local_path: str, commit_hash: str, file_list: list[str]) -> dict:
    """
    Read the content of each file at the given commit directly from git objects.
    Returns a dict {relative_path: content_str}. Files that error are silently skipped.
    This avoids any working-tree checkout — git reads straight from pack files.
    """
    contents = {}
    for rel_path in file_list:
        try:
            result = repo_manager._run_git(local_path, ["show", f"{commit_hash}:{rel_path}"])
            contents[rel_path] = result
        except Exception:
            pass
    return contents


@router.post("/repo/checkout")
async def repo_checkout(payload: RepoCheckoutRequest):
    # ---- Fast path: when branch is a commit hash, skip git checkout entirely ----
    # git checkout rewrites all tracked files to disk (~200-400ms).
    # For timeline playback we only need file contents, which we can read
    # directly from git objects using `git show hash:file` (no disk writes).
    if _is_commit_hash(payload.branch):
        # Get (or ensure) local repo exists
        try:
            local_path = repo_manager.get_cached_path(payload.repo_url)
            if not local_path:
                local_path = repo_manager.clone_repo(payload.repo_url, token=payload.token)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to get repo: {str(exc)}")

        commit_hash = payload.branch.strip()

        # Cache hit — return immediately
        if commit_hash in _ANALYSIS_CACHE:
            return {
                "repo_url": payload.repo_url,
                "branch": payload.branch,
                "folder_name": local_path,
                "analysis": _ANALYSIS_CACHE[commit_hash]
            }

        # Find parent commit and determine changed files
        previous_analysis = None
        changed_files = None
        deleted_files = []
        file_contents_override = None

        try:
            parent_hash = repo_manager._run_git(local_path, ["rev-parse", f"{commit_hash}^"])
            parent_hash = parent_hash.strip()
            if parent_hash in _ANALYSIS_CACHE:
                previous_analysis = _ANALYSIS_CACHE[parent_hash]
                # Use --name-status to distinguish Added/Modified from Deleted files
                diff_output = repo_manager._run_git(
                    local_path,
                    ["diff-tree", "--no-commit-id", "--name-status", "-r", commit_hash]
                )
                changed_files = []
                deleted_files = []
                for line in diff_output.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split('\t', 1)
                    if len(parts) == 2:
                        status, fname = parts[0].strip(), parts[1].strip()
                        if status.startswith('D'):
                            deleted_files.append(fname)
                        else:
                            # A=added, M=modified, R=renamed, C=copied — all need re-analysis
                            # For renames: "R100\told\tnew" — take the new name (second tab)
                            fname_parts = fname.split('\t')
                            changed_files.append(fname_parts[-1])

                # Read ONLY the changed/added files from git objects (no disk checkout)
                if changed_files:
                    file_contents_override = _read_files_at_commit(local_path, commit_hash, changed_files)
        except Exception:
            pass  # Fall through to full analysis

        try:
            # Only checkout if no parent cache (cold first commit)
            if previous_analysis is None or changed_files is None:
                repo_manager.checkout_branch(payload.repo_url, payload.branch, token=payload.token)

            analysis = analyze_local_folder(
                local_path,
                previous_analysis=previous_analysis,
                changed_files=changed_files,
                deleted_files=deleted_files if changed_files is not None else None,
                file_contents_override=file_contents_override,
            )
            _ANALYSIS_CACHE[commit_hash] = analysis
            return {
                "repo_url": payload.repo_url,
                "branch": payload.branch,
                "folder_name": local_path,
                "analysis": analysis
            }
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to analyze commit: {str(exc)}")

    # ---- Normal path: branch name checkout (non-timeline use) ----
    try:
        local_path = repo_manager.checkout_branch(payload.repo_url, payload.branch, token=payload.token)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to checkout branch: {str(exc)}")

    try:
        current_head = repo_manager._run_git(local_path, ["rev-parse", "HEAD"]).strip()
    except Exception:
        current_head = None

    if current_head and current_head in _ANALYSIS_CACHE:
        return {
            "repo_url": payload.repo_url,
            "branch": payload.branch,
            "folder_name": local_path,
            "analysis": _ANALYSIS_CACHE[current_head]
        }

    previous_analysis = None
    changed_files = None

    if current_head:
        try:
            parent_hash = repo_manager._run_git(local_path, ["rev-parse", f"{current_head}^"]).strip()
            if parent_hash in _ANALYSIS_CACHE:
                previous_analysis = _ANALYSIS_CACHE[parent_hash]
                diff_output = repo_manager._run_git(local_path, ["diff-tree", "--no-commit-id", "--name-only", "-r", current_head])
                changed_files = [line.strip() for line in diff_output.splitlines() if line.strip()]
        except Exception:
            pass

    try:
        analysis = analyze_local_folder(local_path, previous_analysis=previous_analysis, changed_files=changed_files)
        if current_head:
            _ANALYSIS_CACHE[current_head] = analysis
        return {"repo_url": payload.repo_url, "branch": payload.branch, "folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze after checkout: {str(exc)}")



@router.post("/repo/function-code")
async def get_function_code(payload: FunctionCodeRequest):
    """Retrieve the code for a specific function from a repository."""
    try:
        if not payload.start_line:
            raise HTTPException(status_code=400, detail="Function start_line is required but was not provided")
        
        # Get the cached repo path
        local_path = repo_manager.get_cached_path(payload.repo_url)
        if not local_path or not os.path.exists(local_path):
            # Try to clone if not cached
            local_path = repo_manager.clone_repo(payload.repo_url, token=payload.token)
        
        # Construct full file path
        # payload.filename comes from the frontend/analysis result which is POSIX style (forward slashes)
        # We need to ensure it's compatible with the local OS (e.g. backslashes on Windows)
        normalized_filename = os.path.normpath(payload.filename)
        file_path = os.path.join(local_path, normalized_filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {payload.filename}")
        
        # Read the file
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        
        # Extract function code based on start_line
        # start_line is 1-indexed, convert to 0-indexed
        start_idx = max(0, payload.start_line - 1)
        
        if start_idx >= len(lines):
            raise HTTPException(status_code=400, detail=f"Start line {payload.start_line} is beyond file length")
        
        # Detect file language from extension
        file_ext = os.path.splitext(payload.filename)[1].lower()
        is_python = file_ext == '.py'
        
        actual_end_idx = start_idx
        
        if is_python:
            # Python: use indentation-based detection
            start_line_content = lines[start_idx]
            
            # Find the base indentation of the function definition
            # Handle async def or just def
            def_line_stripped = start_line_content.lstrip()
            base_indent = len(start_line_content) - len(def_line_stripped)
            
            # First, find the end of the function definition (handling multi-line defs)
            # The function body starts after the line ending with ':'
            body_start_idx = start_idx
            paren_count = 0
            
            # Scan forward to find end of definition (colon)
            # We track parentheses to avoid false positives inside args
            for i in range(start_idx, min(start_idx + 20, len(lines))):
                line = lines[i]
                for char in line:
                    if char == '(': paren_count += 1
                    elif char == ')': paren_count -= 1
                
                stripped = line.strip()
                if stripped.endswith(':') and paren_count == 0:
                    body_start_idx = i + 1
                    break
            
            # Now find the end of the function body
            max_search_lines = min(start_idx + payload.lloc * 5 + 100, len(lines))
            actual_end_idx = body_start_idx
            
            for i in range(body_start_idx, max_search_lines):
                line = lines[i]
                stripped = line.lstrip()
                
                # Skip blank lines (but not comments)
                if not stripped:
                    continue
                
                # Check indentation for comments too
                # If a comment is dedented to base_indent, it likely belongs to the outer scope
                current_indent = len(line) - len(stripped)
                
                # If we find a line with indentation <= base_indent, the function has ended
                if current_indent <= base_indent:
                     # Check if it's a decorator (starts with @) - could be next function
                    if stripped.startswith('@'):
                        actual_end_idx = i
                        break
                    # Otherwise it's code/comment outside the function
                    actual_end_idx = i
                    break
            else:
                 # If we hit the loop limit, just take all lines we searched
                 actual_end_idx = max_search_lines
        else:
            # For brace-based languages (JS, Java, C++, etc.)
            # We need to find the opening brace first, then match it
            brace_count = 0
            paren_count = 0
            in_string = False
            string_char = None
            found_opening_brace = False
            
            # Look ahead to find the function end
            max_search_lines = min(start_idx + payload.lloc * 5 + 100, len(lines))
            
            for i in range(start_idx, max_search_lines):
                line = lines[i]
                escaped = False
                
                # Check if we've found the opening brace of the function body
                if '{' in line and not found_opening_brace:
                    # Make sure it's not in a string
                    temp_in_string = False
                    temp_string_char = None
                    for char in line:
                        if escaped:
                            escaped = False
                            continue
                        if char == '\\':
                            escaped = True
                            continue
                        if char in ('"', "'", '`') and not escaped:
                            if not temp_in_string:
                                temp_in_string = True
                                temp_string_char = char
                            elif char == temp_string_char:
                                temp_in_string = False
                                temp_string_char = None
                            continue
                        if not temp_in_string and char == '{':
                            found_opening_brace = True
                            break
                    escaped = False
                
                for char in line:
                    if escaped:
                        escaped = False
                        continue
                    if char == '\\':
                        escaped = True
                        continue
                    
                    # Track string boundaries
                    if char in ('"', "'", '`') and not escaped:
                        if not in_string:
                            in_string = True
                            string_char = char
                        elif char == string_char:
                            in_string = False
                            string_char = None
                        continue
                    
                    # Only count braces when not in a string
                    if not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                
                actual_end_idx = i + 1
                
                # Function ends when we've closed the opening brace and we're past the start
                if found_opening_brace and brace_count == 0 and i > start_idx:
                    break
        
        # Extract the function code
        actual_function_code = "".join(lines[start_idx:actual_end_idx])
        
        return {
            "code": actual_function_code,
            "filename": payload.filename,
            "function_name": payload.function_name,
            "start_line": payload.start_line,
            "end_line": actual_end_idx,
            "lloc": payload.lloc
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve function code: {str(exc)}")


@router.post("/repo/commits")
async def get_commit_history(payload: CommitHistoryRequest):
    """Get commit history for a repository."""
    try:
        commits = repo_manager.get_commit_history(
            payload.repo_url,
            branch=payload.branch,
            limit=payload.limit or 50,
            skip=payload.skip or 0,
            token=payload.token
        )
        return {"commits": commits}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get commit history: {str(exc)}")


@router.post("/repo/commit-details")
async def get_commit_details(payload: CommitDetailsRequest):
    """Get detailed information about a specific commit."""
    try:
        commit_details = repo_manager.get_commit_details(
            payload.repo_url,
            payload.commit_hash,
            token=payload.token
        )
        return commit_details
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get commit details: {str(exc)}")


class PrefetchCommitRequest(BaseModel):
    repo_url: str
    commit_hash: str
    token: Optional[str] = None


@router.post("/repo/prefetch-commit")
async def prefetch_commit(payload: PrefetchCommitRequest):
    """
    Non-blocking endpoint to warm the analysis cache for a future commit.
    Called by the frontend during each delay window so the next commit's
    analysis is ready before it's needed.
    Returns immediately — analysis runs in the background if not already cached.
    """
    # If already cached, return immediately
    if payload.commit_hash in _ANALYSIS_CACHE:
        return {"status": "cached", "commit_hash": payload.commit_hash}

    # Queue analysis in background (non-blocking)
    async def _warm_cache():
        try:
            local_path = repo_manager.checkout_branch(payload.repo_url, payload.commit_hash, token=payload.token)
            current_head = repo_manager._run_git(local_path, ["rev-parse", "HEAD"]).strip()
            if current_head in _ANALYSIS_CACHE:
                return  # Another request already cached it
            # Try incremental analysis using parent commit
            previous_analysis = None
            changed_files = None
            try:
                parent_hash = repo_manager._run_git(local_path, ["rev-parse", f"{current_head}^"]).strip()
                if parent_hash in _ANALYSIS_CACHE:
                    previous_analysis = _ANALYSIS_CACHE[parent_hash]
                    diff_output = repo_manager._run_git(local_path, ["diff-tree", "--no-commit-id", "--name-only", "-r", current_head])
                    changed_files = [line.strip() for line in diff_output.splitlines() if line.strip()]
            except Exception:
                pass
            analysis = analyze_local_folder(local_path, previous_analysis=previous_analysis, changed_files=changed_files)
            _ANALYSIS_CACHE[current_head] = analysis
        except Exception:
            pass  # Silently fail — prefetch is best-effort

    asyncio.create_task(_warm_cache())
    return {"status": "queued", "commit_hash": payload.commit_hash}


class FileContentRequest(BaseModel):
    repo_url: str
    commit_hash: str
    file_path: str
    token: Optional[str] = None


@router.post("/repo/file-content")
async def get_file_content(payload: FileContentRequest):
    """Get the full content of a file at a specific commit."""
    try:
        content = repo_manager.get_file_content(
            payload.repo_url,
            payload.commit_hash,
            payload.file_path,
            
            token=payload.token
        )
        return {"content": content}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(exc)}")
