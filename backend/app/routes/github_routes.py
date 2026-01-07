import os
import httpx
from urllib.parse import quote
from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services import repo_manager
from app.services.analyze_local_folder import analyze_local_folder
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["github"])

# Simple in-memory token store: access_token -> username
_TOKENS = {}


class RepoAnalyzeRequest(BaseModel):
    repo_url: str
    token: Optional[str] = None


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
    nloc: int
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
        f"http://localhost:3000/?token={access_token}&username={username}"
    )

    return RedirectResponse(url=frontend_url)

@router.post("/auth/logout")
async def logout(token: str = Body(..., embed=True)):
    if token in _TOKENS:
        del _TOKENS[token]
        return {"status": "logged_out"}
    raise HTTPException(status_code=400, detail="Unknown token")


@router.post("/analyze/repo")
async def analyze_repo(payload: RepoAnalyzeRequest):
    # clone (or use cached) then analyze
    repo_url = payload.repo_url
    token = payload.token

    try:
        local_path = repo_manager.clone_repo(repo_url, token=token)
    except Exception as exc:
        # If the error is due to invalid repo format, return a 400
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=400, detail=str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to clone repo: {str(exc)}")

    try:
        analysis = analyze_local_folder(local_path)
        return {"repo_url": repo_url, "folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze repo: {str(exc)}")


@router.get("/repo/branches")
async def repo_branches(repo_url: str, token: Optional[str] = None):
    try:
        branches = repo_manager.list_branches(repo_url, token=token)
        return branches
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list branches: {str(exc)}")


@router.post("/repo/checkout")
async def repo_checkout(payload: RepoCheckoutRequest):
    try:
        local_path = repo_manager.checkout_branch(payload.repo_url, payload.branch, token=payload.token)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to checkout branch: {str(exc)}")

    try:
        analysis = analyze_local_folder(local_path)
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
        file_path = os.path.join(local_path, payload.filename)
        
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
            base_indent = len(start_line_content) - len(start_line_content.lstrip())
            
            # Find the end of the function by looking for lines with less or equal indentation
            # that are not blank and not part of the function body
            max_search_lines = min(start_idx + payload.nloc * 5 + 100, len(lines))
            
            for i in range(start_idx + 1, max_search_lines):
                line = lines[i]
                stripped = line.lstrip()
                
                # Skip blank lines
                if not stripped:
                    continue
                
                current_indent = len(line) - len(stripped)
                
                # If we find a line at the same or less indentation that's not a continuation,
                # we've reached the end of the function
                if current_indent <= base_indent and stripped:
                    # Check if it's a decorator (starts with @) - still part of function
                    if stripped.startswith('@'):
                        continue
                    # Check if it's a comment - still part of function if indented
                    if stripped.startswith('#'):
                        continue
                    # Otherwise, we've found the end
                    actual_end_idx = i
                    break
            else:
                # If we didn't break, use the last searched line
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
            max_search_lines = min(start_idx + payload.nloc * 5 + 100, len(lines))
            
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
            "nloc": payload.nloc
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
