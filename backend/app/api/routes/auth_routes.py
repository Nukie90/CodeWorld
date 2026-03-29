import os
import httpx
from urllib.parse import quote
from fastapi import APIRouter, Request, HTTPException, Body
from fastapi.responses import RedirectResponse
from app.services.state_manager import _TOKENS

router = APIRouter(tags=["auth"])

@router.get("/auth/github/login")
async def github_login(request: Request):
    client_id = os.environ.get("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID not configured")

    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI")
    if not redirect_uri:
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/auth/github/callback"

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

    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI")
    if not redirect_uri:
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
                "redirect_uri": redirect_uri,
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

    async with httpx.AsyncClient() as client:
        user_resp = await client.get("https://api.github.com/user", headers={"Authorization": f"token {access_token}"}, timeout=10)

    if user_resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch user info")

    user_json = user_resp.json()
    username = user_json.get("login") or "unknown"

    _TOKENS[access_token] = username

    frontend_url = f"http://localhost:5173/?token={access_token}&username={username}"

    return RedirectResponse(url=frontend_url)

@router.post("/auth/logout")
async def logout(token: str = Body(..., embed=True)):
    if token in _TOKENS:
        del _TOKENS[token]
        return {"status": "logged_out"}
    raise HTTPException(status_code=400, detail="Unknown token")
