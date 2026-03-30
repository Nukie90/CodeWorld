import os
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.services import repo_manager
from app.services.analyze_local_folder import analyze_local_folder
from app.services.state_manager import _ANALYSIS_CACHE, get_session
from app.utils.analysis_helpers import normalize_analysis_result
import re as _re

router = APIRouter(tags=["repo"])

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

@router.get("/repo/branches")
def repo_branches(repo_url: str, token: Optional[str] = None):
    github_token = verify_session(token)
    try:
        branches = repo_manager.list_branches(repo_url, token=github_token)
        return branches
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list branches: {str(exc)}")

_COMMIT_RE = _re.compile(r'^[0-9a-f]{7,40}$', _re.IGNORECASE)

def _is_commit_hash(s: str) -> bool:
    """Return True if the string looks like a git commit hash (7-40 hex chars)."""
    return bool(_COMMIT_RE.match(s.strip()))

import subprocess

def _read_files_at_commit(local_path: str, commit_hash: str, file_list: list[str]) -> dict:
    """
    Read the content of each file at the given commit directly from git objects.
    Returns a dict {relative_path: content_str}. Files that error are silently skipped.
    This avoids any working-tree checkout and uses `git cat-file --batch` for massive speedup.
    """
    if not file_list:
        return {}

    contents = {}
    input_str = "\n".join(f"{commit_hash}:{rel_path}" for rel_path in file_list) + "\n"
    
    try:
        proc = subprocess.Popen(
            ["git", "-C", local_path, "cat-file", "--batch"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout_data, _ = proc.communicate(input=input_str.encode("utf-8"))
        
        offset = 0
        file_idx = 0
        while offset < len(stdout_data) and file_idx < len(file_list):
            nl_idx = stdout_data.find(b"\n", offset)
            if nl_idx == -1:
                break
            
            header = stdout_data[offset:nl_idx].decode("utf-8", errors="replace")
            offset = nl_idx + 1
            rel_path = file_list[file_idx]
            file_idx += 1
            
            if header.endswith(" missing"):
                continue
                
            parts = header.split()
            if len(parts) >= 3 and parts[-2] == "blob":
                try:
                    size = int(parts[-1])
                    content_bytes = stdout_data[offset:offset + size]
                    contents[rel_path] = content_bytes.decode("utf-8", errors="replace")
                    offset = offset + size + 1
                except ValueError:
                    break
    except Exception:
        pass

    return contents

@router.post("/repo/checkout")
def repo_checkout(payload: RepoCheckoutRequest):
    github_token = verify_session(payload.token)
    # ---- Fast path: when branch is a commit hash, skip git checkout entirely ----
    if _is_commit_hash(payload.branch):
        # Get (or ensure) local repo exists
        try:
            local_path = repo_manager.get_cached_path(payload.repo_url)
            if not local_path:
                local_path = repo_manager.clone_repo(payload.repo_url, token=github_token)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to get repo: {str(exc)}")

        commit_hash = payload.branch.strip()

        # Cache hit — return immediately
        if commit_hash in _ANALYSIS_CACHE:
            return {
                "repo_url": payload.repo_url,
                "branch": payload.branch,
                "folder_name": local_path,
                "analysis": normalize_analysis_result(_ANALYSIS_CACHE[commit_hash])
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
                repo_manager.checkout_branch(payload.repo_url, payload.branch, token=github_token)

            analysis = analyze_local_folder(
                local_path,
                previous_analysis=previous_analysis,
                changed_files=changed_files,
                deleted_files=deleted_files if changed_files is not None else None,
                file_contents_override=file_contents_override,
            )
            analysis = normalize_analysis_result(analysis)
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
        local_path = repo_manager.checkout_branch(payload.repo_url, payload.branch, token=github_token)
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
            "analysis": normalize_analysis_result(_ANALYSIS_CACHE[current_head])
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
        analysis = normalize_analysis_result(analysis)
        if current_head:
            _ANALYSIS_CACHE[current_head] = analysis
        return {"repo_url": payload.repo_url, "branch": payload.branch, "folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze after checkout: {str(exc)}")

@router.post("/repo/function-code")
def get_function_code(payload: FunctionCodeRequest):
    """Retrieve the code for a specific function from a repository."""
    github_token = verify_session(payload.token)
    try:
        if not payload.start_line:
            raise HTTPException(status_code=400, detail="Function start_line is required but was not provided")
        
        local_path = repo_manager.get_cached_path(payload.repo_url)
        if not local_path or not os.path.exists(local_path):
            local_path = repo_manager.clone_repo(payload.repo_url, token=github_token)
        
        normalized_filename = os.path.normpath(payload.filename)
        file_path = os.path.join(local_path, normalized_filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {payload.filename}")
        
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        
        start_idx = max(0, payload.start_line - 1)
        
        if start_idx >= len(lines):
            raise HTTPException(status_code=400, detail=f"Start line {payload.start_line} is beyond file length")
        
        file_ext = os.path.splitext(payload.filename)[1].lower()
        is_python = file_ext == '.py'
        
        actual_end_idx = start_idx
        
        if is_python:
            start_line_content = lines[start_idx]
            def_line_stripped = start_line_content.lstrip()
            base_indent = len(start_line_content) - len(def_line_stripped)
            body_start_idx = start_idx
            paren_count = 0
            
            for i in range(start_idx, min(start_idx + 20, len(lines))):
                line = lines[i]
                for char in line:
                    if char == '(': paren_count += 1
                    elif char == ')': paren_count -= 1
                
                stripped = line.strip()
                if stripped.endswith(':') and paren_count == 0:
                    body_start_idx = i + 1
                    break
            
            max_search_lines = min(start_idx + payload.lloc * 5 + 100, len(lines))
            actual_end_idx = body_start_idx
            
            for i in range(body_start_idx, max_search_lines):
                line = lines[i]
                stripped = line.lstrip()
                
                if not stripped:
                    continue
                
                current_indent = len(line) - len(stripped)
                if current_indent <= base_indent:
                    if stripped.startswith('@'):
                        actual_end_idx = i
                        break
                    actual_end_idx = i
                    break
            else:
                 actual_end_idx = max_search_lines
        else:
            brace_count = 0
            paren_count = 0
            in_string = False
            string_char = None
            found_opening_brace = False
            max_search_lines = min(start_idx + payload.lloc * 5 + 100, len(lines))
            
            for i in range(start_idx, max_search_lines):
                line = lines[i]
                escaped = False
                
                if '{' in line and not found_opening_brace:
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
                    if char in ('"', "'", '`') and not escaped:
                        if not in_string:
                            in_string = True
                            string_char = char
                        elif char == string_char:
                            in_string = False
                            string_char = None
                        continue
                    if not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                
                actual_end_idx = i + 1
                if found_opening_brace and brace_count == 0 and i > start_idx:
                    break
        
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
def get_commit_history(payload: CommitHistoryRequest):
    """Get commit history for a repository."""
    github_token = verify_session(payload.token)
    try:
        commits = repo_manager.get_commit_history(
            payload.repo_url,
            branch=payload.branch,
            limit=payload.limit or 50,
            skip=payload.skip or 0,
            token=github_token
        )
        return {"commits": commits}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get commit history: {str(exc)}")

@router.post("/repo/commit-details")
def get_commit_details(payload: CommitDetailsRequest):
    """Get detailed information about a specific commit."""
    github_token = verify_session(payload.token)
    try:
        commit_details = repo_manager.get_commit_details(
            payload.repo_url,
            payload.commit_hash,
            token=github_token
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
def prefetch_commit(payload: PrefetchCommitRequest, background_tasks: BackgroundTasks):
    github_token = verify_session(payload.token)
    if payload.commit_hash in _ANALYSIS_CACHE:
        return {"status": "cached", "commit_hash": payload.commit_hash}

    def _warm_cache():
        try:
            local_path = repo_manager.checkout_branch(payload.repo_url, payload.commit_hash, token=github_token)
            current_head = repo_manager._run_git(local_path, ["rev-parse", "HEAD"]).strip()
            if current_head in _ANALYSIS_CACHE:
                return
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
            analysis = normalize_analysis_result(analysis)
            _ANALYSIS_CACHE[current_head] = analysis
        except Exception:
            pass

    background_tasks.add_task(_warm_cache)
    return {"status": "queued", "commit_hash": payload.commit_hash}

class FileContentRequest(BaseModel):
    repo_url: str
    commit_hash: str
    file_path: str
    token: Optional[str] = None

@router.post("/repo/file-content")
def get_file_content(payload: FileContentRequest):
    """Get the full content of a file at a specific commit."""
    github_token = verify_session(payload.token)
    try:
        content = repo_manager.get_file_content(
            payload.repo_url,
            payload.commit_hash,
            payload.file_path,
            token=github_token
        )
        return {"content": content}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(exc)}")
