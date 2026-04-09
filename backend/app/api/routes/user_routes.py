from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
from app.services.state_manager import get_session
from app.db.database import get_recent_repos, get_favourite_repos, add_favourite_repo, remove_favourite_repo

router = APIRouter(tags=["user"])

def get_current_github_id(token: str) -> int:
    session = get_session(token)
    if not session or not session.get("github_id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return session["github_id"]

@router.get("/user/repos/recent")
async def fetch_recent_repos(token: str):
    github_id = get_current_github_id(token)
    try:
        return get_recent_repos(github_id)
    except Exception as e:
        print(f"Error fetching recent repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent repos")

@router.get("/user/repos/favourites")
async def fetch_favourite_repos(token: str):
    github_id = get_current_github_id(token)
    try:
        return get_favourite_repos(github_id)
    except Exception as e:
        print(f"Error fetching favourite repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch favourite repos")

@router.post("/user/repos/favourites")
async def add_favourite(
    token: str = Body(...),
    repo_full_name: str = Body(...),
    repo_url: str = Body(...)
):
    github_id = get_current_github_id(token)
    try:
        add_favourite_repo(github_id, repo_full_name, repo_url)
        return {"status": "success"}
    except Exception as e:
        print(f"Error adding favourite rep: {e}")
        raise HTTPException(status_code=500, detail="Failed to add favourite")

@router.delete("/user/repos/favourites")
async def remove_favourite(
    token: str,
    repo_full_name: str
):
    github_id = get_current_github_id(token)
    try:
        remove_favourite_repo(github_id, repo_full_name)
        return {"status": "success"}
    except Exception as e:
        print(f"Error removing favourite repo: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove favourite")
