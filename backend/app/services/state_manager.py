import json
import os
import secrets
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional
from app.db.database import get_db


DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

# Global store for progress: task_id -> {"progress": int, "message": str, "done": bool}
_PROGRESS: Dict[str, Any] = {}

# Global store for analysis cache: commit_hash -> FolderAnalysisResult
_ANALYSIS_CACHE: Dict[str, Any] = {}


def _session_ttl_seconds() -> int:
    raw = os.environ.get("SESSION_TTL_SECONDS")
    if not raw:
        return DEFAULT_SESSION_TTL_SECONDS
    try:
        return max(60, int(raw))
    except ValueError:
        return DEFAULT_SESSION_TTL_SECONDS


def clear_sessions() -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_sessions")
    conn.commit()
    conn.close()


def create_session(github_token: str, username: str) -> str:
    now = int(time.time())
    session_token = secrets.token_urlsafe(32)
    expires_at = now + _session_ttl_seconds()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_sessions (session_token, github_token, username, created_at, expires_at, is_logged_in)
        VALUES (?, ?, ?, ?, ?, 1)
    """, (session_token, github_token, username, now, expires_at))
    conn.commit()
    conn.close()
    return session_token


def delete_session(session_token: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE user_sessions SET is_logged_in = 0 WHERE session_token = ?", (session_token,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_session(session_token: str, *, refresh: bool = True) -> Optional[dict]:
    if not session_token:
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_sessions WHERE session_token = ?", (session_token,))
    row = cursor.fetchone()
    
    if not row or not row["is_logged_in"]:
        conn.close()
        return None

    now = int(time.time())
    if row["expires_at"] <= now:
        cursor.execute("UPDATE user_sessions SET is_logged_in = 0 WHERE session_token = ?", (session_token,))
        conn.commit()
        conn.close()
        return None

    session = {
        "github_token": row["github_token"],
        "user": row["username"],
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
        "is_logged_in": True
    }

    if refresh:
        new_expires_at = now + _session_ttl_seconds()
        cursor.execute("UPDATE user_sessions SET expires_at = ? WHERE session_token = ?", (new_expires_at, session_token))
        conn.commit()
        session["expires_at"] = new_expires_at

    conn.close()
    return session
