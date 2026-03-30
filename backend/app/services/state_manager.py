import json
import os
import secrets
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional


DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

# Session store: session_token -> session payload
_TOKENS: Dict[str, dict] = {}

# Global store for progress: task_id -> {"progress": int, "message": str, "done": bool}
_PROGRESS: Dict[str, Any] = {}

# Global store for analysis cache: commit_hash -> FolderAnalysisResult
_ANALYSIS_CACHE: Dict[str, Any] = {}


def _session_store_path() -> Path:
    configured = os.environ.get("SESSION_STORE_PATH")
    if configured:
        return Path(configured)
    return Path(tempfile.gettempdir()) / "codeworld-sessions.json"


def _session_ttl_seconds() -> int:
    raw = os.environ.get("SESSION_TTL_SECONDS")
    if not raw:
        return DEFAULT_SESSION_TTL_SECONDS
    try:
        return max(60, int(raw))
    except ValueError:
        return DEFAULT_SESSION_TTL_SECONDS


def _persist_sessions() -> None:
    store_path = _session_store_path()
    store_path.parent.mkdir(parents=True, exist_ok=True)
    store_path.write_text(json.dumps(_TOKENS), encoding="utf-8")


def _normalize_session(session_token: str, payload: Any) -> Optional[dict]:
    now = int(time.time())
    ttl = _session_ttl_seconds()

    if isinstance(payload, str):
        return {
            "github_token": session_token,
            "user": payload,
            "created_at": now,
            "expires_at": now + ttl,
        }

    if isinstance(payload, dict):
        session = dict(payload)
        session.setdefault("github_token", session_token)
        session.setdefault("user", "")
        session.setdefault("created_at", now)
        session.setdefault("expires_at", now + ttl)
        return session

    return None


def load_sessions() -> None:
    store_path = _session_store_path()
    _TOKENS.clear()
    if not store_path.exists():
        return

    try:
        raw = json.loads(store_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return

    if not isinstance(raw, dict):
        return

    for session_token, payload in raw.items():
        normalized = _normalize_session(session_token, payload)
        if normalized:
            _TOKENS[session_token] = normalized


def clear_sessions() -> None:
    _TOKENS.clear()
    store_path = _session_store_path()
    if store_path.exists():
        store_path.unlink()


def create_session(github_token: str, username: str) -> str:
    now = int(time.time())
    session_token = secrets.token_urlsafe(32)
    _TOKENS[session_token] = {
        "github_token": github_token,
        "user": username,
        "created_at": now,
        "expires_at": now + _session_ttl_seconds(),
    }
    _persist_sessions()
    return session_token


def delete_session(session_token: str) -> bool:
    if session_token in _TOKENS:
        del _TOKENS[session_token]
        _persist_sessions()
        return True
    return False


def get_session(session_token: str, *, refresh: bool = True) -> Optional[dict]:
    if not session_token:
        return None

    session = _normalize_session(session_token, _TOKENS.get(session_token))
    if not session:
        return None

    now = int(time.time())
    if session["expires_at"] <= now:
        delete_session(session_token)
        return None

    if refresh:
        session["expires_at"] = now + _session_ttl_seconds()

    _TOKENS[session_token] = session
    if refresh:
        _persist_sessions()
    return session

load_sessions()
