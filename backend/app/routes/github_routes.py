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
