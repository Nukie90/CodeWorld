import os
import json
import hashlib
import subprocess
from typing import Optional


CACHE_DIR = os.environ.get("REPO_CACHE_DIR", os.path.join(os.getcwd(), "temp_repos"))
INDEX_FILE = os.path.join(CACHE_DIR, "index.json")


def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)
    if not os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)


def _load_index() -> dict:
    _ensure_cache_dir()
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return {}


def _save_index(idx: dict):
    _ensure_cache_dir()
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(idx, f)


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


def _normalize_url(url: str) -> str:
    # strip trailing .git/ or trailing slash for consistent keys
    if url.endswith("/"):
        url = url[:-1]
    if url.endswith(".git"):
        url = url
    return url


def get_cached_path(repo_url: str) -> Optional[str]:
    url = _normalize_url(repo_url)
    idx = _load_index()
    return idx.get(url)


def clone_repo(repo_url: str, token: Optional[str] = None) -> str:
    """
    Clone the repository into the cache directory if not already present.

    If token is provided it will be injected into the https URL. Be aware
    that embedding tokens into URLs is sensitive — this is a pragmatic
    approach for private repos but you may want a more secure flow later.
    """
    url = _normalize_url(repo_url)
    idx = _load_index()

    if url in idx and os.path.exists(idx[url]):
        return idx[url]

    # determine folder name
    repo_hash = _repo_hash(url)
    repo_name = url.rstrip("/").split("/")[-1]
    folder_name = f"{repo_name}-{repo_hash}"
    target_path = os.path.join(CACHE_DIR, folder_name)

    # build clone URL (optionally with token)
    clone_url = url
    if token and url.startswith("https://"):
        # insert token after scheme
        clone_url = url.replace("https://", f"https://{token}@")

    # run git clone (shallow)
    try:
        subprocess.run(["git", "clone", "--depth", "1", clone_url, target_path], check=True)
    except subprocess.CalledProcessError as exc:
        # clean up partial clone if present
        if os.path.exists(target_path):
            try:
                import shutil

                shutil.rmtree(target_path)
            except Exception:
                pass
        raise

    # update index
    idx[url] = target_path
    _save_index(idx)
    return target_path
