import os
import httpx
from fastapi import APIRouter, Request, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services import repo_manager
from app.services.analyze_local_folder import analyze_local_folder

router = APIRouter(tags=["github"])

# Simple in-memory token store: access_token -> username
_TOKENS = {}


class RepoAnalyzeRequest(BaseModel):
    repo_url: str
    token: Optional[str] = None


@router.get("/auth/github/login")
async def github_login():
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID not configured")

    # scopes: repo for private repo access, read:user to obtain username
    auth_url = (
        f"https://github.com/login/oauth/authorize?client_id={client_id}&scope=repo%20read:user&allow_signup=true"
    )
    return {"auth_url": auth_url}


@router.get("/auth/github/callback")
async def github_callback(code: str):
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth client not configured")

    token_url = "https://github.com/login/oauth/access_token"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
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

    # In a real app we would set a secure cookie or session. For now return token.
    return {"access_token": access_token, "username": username}


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
        raise HTTPException(status_code=500, detail=f"Failed to clone repo: {str(exc)}")

    try:
        analysis = analyze_local_folder(local_path)
        return {"folder_name": local_path, "analysis": analysis}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze repo: {str(exc)}")
