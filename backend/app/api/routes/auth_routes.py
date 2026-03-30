import os
import httpx
import time
import asyncio
from urllib.parse import quote
from fastapi import APIRouter, Request, HTTPException, Body
from fastapi.responses import RedirectResponse
from app.services.state_manager import create_session, delete_session, get_session

router = APIRouter(tags=["auth"])

# Global state for handling OAuth race conditions
_USED_CODES = {}
_AUTH_LOCK = asyncio.Lock()

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
        f"&prompt=select_account"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
    )
    return {"auth_url": auth_url}

@router.get("/auth/github/callback")
async def github_callback(code: str, request: Request):
    # Ensure only one request processes this code at a time
    async with _AUTH_LOCK:
        # Check cache under lock
        now = time.time()
        if code in _USED_CODES:
            cached = _USED_CODES[code]
            if now - cached["ts"] < 60: # Extended window
                print(f"DEBUG: Handling duplicate request for code: {code[:8]}...")
                frontend_url = f"http://localhost:5173/?token={cached['token']}&username={cached['user']}"
                return RedirectResponse(url=frontend_url)

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
                headers={
                    "Accept": "application/json",
                    "User-Agent": "CodeWorld-App"
                },
                timeout=10,
            )

        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to obtain access token")

        body = resp.json()
        if "error" in body:
            error_msg = body.get("error_description") or body.get("error")
            print(f"ERROR: GitHub token exchange failed: {error_msg}")
            raise HTTPException(status_code=400, detail=f"GitHub error: {error_msg}")

        access_token = body.get("access_token")
        if not access_token:
            print("ERROR: GitHub returned no access token")
            raise HTTPException(status_code=500, detail="No access token returned")

        prefix = access_token[:5] if access_token else "NONE"
        print(f"DEBUG: Successfully obtained GitHub access token (prefix: {prefix}...)")
        print(f"DEBUG: Fetching user info with access token...")

        async with httpx.AsyncClient() as client:
            user_resp = await client.get(
                "https://api.github.com/user", 
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "User-Agent": "CodeWorld-App"
                }, 
                timeout=10
            )

        if user_resp.status_code != 200:
            print(f"ERROR: Failed to fetch user info from GitHub")
            print(f"ERROR: Status Code: {user_resp.status_code}")
            print(f"ERROR: Response Body: {user_resp.text}")
            raise HTTPException(status_code=500, detail="Failed to fetch user info")

        user_json = user_resp.json()
        username = user_json.get("login") or "unknown"

        session_token = create_session(access_token, username)
        
        # Cache the result to handle immediate duplicate requests
        _USED_CODES[code] = {
            "token": session_token,
            "user": username,
            "ts": time.time()
        }

        frontend_url = f"http://localhost:5173/?token={session_token}&username={username}"

        return RedirectResponse(url=frontend_url)

@router.post("/auth/logout")
async def logout(token: str = Body(..., embed=True)):
    if delete_session(token):
        return {"status": "logged_out"}
    raise HTTPException(status_code=400, detail="Unknown token")

@router.get("/auth/github/repos")
async def get_github_repos(token: str):
    """Fetch the authenticated user's GitHub repositories."""
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    async with httpx.AsyncClient() as client:
        # Fetching user's repositories (includes private ones if token has scope)
        # The 'scope=repo read:user' requested in github_login covers this.
        resp = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=100",
            headers={
                "Authorization": f"Bearer {session['github_token']}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "CodeWorld-App"
            },
            timeout=15,
        )

    if resp.status_code != 200:
        print(f"ERROR: GitHub API failed with status {resp.status_code}: {resp.text}")
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch repositories from GitHub")

    repos_data = resp.json()
    
    # Filter and format the data
    formatted_repos = []
    for repo in repos_data:
        formatted_repos.append({
            "id": repo.get("id"),
            "name": repo.get("name"),
            "full_name": repo.get("full_name"),
            "html_url": repo.get("html_url"),
            "description": repo.get("description"),
            "language": repo.get("language"),
            "stargazers_count": repo.get("stargazers_count"),
            "updated_at": repo.get("updated_at"),
            "private": repo.get("private"),
            "owner": repo.get("owner", {}).get("login")
        })

    return formatted_repos
