import os
import json
import hashlib
import subprocess
from pathlib import Path
from typing import Optional, Callable

from app.utils.ignore import build_ignore_checker


BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = os.environ.get("REPO_CACHE_DIR", str(BACKEND_DIR / "temp_repos"))
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


def _get_git_base() -> list[str]:
    """Base git command that actively disables local credential helpers."""
    return ["git", "-c", "credential.helper=", "-c", "safe.directory=*"]

def _get_git_env() -> dict:
    """Environment variables to ensure git fails cleanly instead of prompting."""
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = "echo"
    return env


def _normalize_url(url: str) -> str:
    # strip trailing .git/ or trailing slash for consistent keys
    if url.endswith("/"):
        url = url[:-1]
    if url.endswith(".git"):
        url = url
    return url


def _is_probably_git_spec(s: str) -> bool:
    """Return True if the string looks like a git URL or a short github spec like owner/repo."""
    if not s or any(c in s for c in ['\n', '\r']):
        return False
    s = s.strip()
    # common git url forms
    if s.startswith('http://') or s.startswith('https://') or s.startswith('git@'):
        return True
    # short form owner/repo (no protocol)
    import re

    if re.match(r'^[\w.-]+\/[\w.-]+$', s):
        return True
    return False


def _to_full_url(spec: str) -> str:
    """Convert short owner/repo into a GitHub HTTPS URL, otherwise return spec unchanged."""
    spec = spec.strip()
    if spec.startswith('http://') or spec.startswith('https://') or spec.startswith('git@'):
        return spec
    import re

    if re.match(r'^[\w.-]+\/[\w.-]+$', spec):
        return f"https://github.com/{spec}.git"
    return spec


def get_cached_path(repo_url: str) -> Optional[str]:
    url = _normalize_url(repo_url)
    idx = _load_index()
    return idx.get(url)


def clone_repo(repo_url: str, token: Optional[str] = None, progress_callback: Optional[Callable] = None) -> str:
    """
    Clone the repository into the cache directory if not already present.

    If token is provided it will be injected into the https URL. Be aware
    that embedding tokens into URLs is sensitive — this is a pragmatic
    approach for private repos but you may want a more secure flow later.
    """
    # basic validation: reject obviously malformed input (e.g. pasted terminal output)
    if not _is_probably_git_spec(repo_url):
        raise ValueError(f"Invalid repository specification: {repo_url!r}")

    # expand short specs like owner/repo to full github https url
    full = _to_full_url(repo_url)
    url = _normalize_url(full)
    idx = _load_index()

    if url in idx and os.path.exists(idx[url]):
        # If no token provided, we MUST verify the repo is still public
        # to prevent logged-out users from accessing cached private code.
        is_public_verified = False
        if not token:
            try:
                # Test access without token
                subprocess.run(
                    _get_git_base() + ["ls-remote", "--heads", url], 
                    env=_get_git_env(),
                    check=True, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE,
                    timeout=5 # fast fail
                )
                is_public_verified = True
            except Exception:
                # Access denied or network error - cannot allow cache usage for guest
                raise ValueError(
                    "This repository is private or requires a valid GitHub login. "
                    "Please log in with GitHub and try again."
                )
        
        if token or is_public_verified:
            if progress_callback: progress_callback(30, "Using cached repository")
            return idx[url]

    if progress_callback: progress_callback(5, "Preparing to download repository...")

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

    # run git clone (shallow – depth 1 for speed; unshallowed on-demand when
    # commit history is needed, see _ensure_unshallow).
    try:
        if progress_callback: progress_callback(10, f"Downloading {repo_name} — this may take a moment for large projects...")
        subprocess.run(_get_git_base() + ["clone", "--depth", "1", clone_url, target_path], env=_get_git_env(), check=True)
        if progress_callback: progress_callback(30, "Download complete ✓")
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


def _run_git(path: str, args: list[str]) -> str:
    """Run git command in path and return stdout (decoded). Raises CalledProcessError on failure."""
    res = subprocess.run(_get_git_base() + ["-C", path] + args, env=_get_git_env(), check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return res.stdout.decode("utf-8", errors="replace")


def _ensure_unshallow(path: str, token: Optional[str] = None, repo_url: Optional[str] = None):
    """If the repo at *path* is a shallow clone, fetch the full history."""
    try:
        out = _run_git(path, ["rev-parse", "--is-shallow-repository"]).strip()
    except Exception:
        return  # can't tell – leave as-is
    if out != "true":
        return  # already has full history
    # Build remote URL with token if needed so private repos can unshallow
    fetch_args = ["fetch", "--unshallow"]
    env = _get_git_env()
    if token and repo_url:
        url = _normalize_url(repo_url)
        remote = url.replace("https://", f"https://{token}@") if url.startswith("https://") else url
        fetch_args.extend([remote])
    try:
        subprocess.run(
            _get_git_base() + ["-C", path] + fetch_args,
            env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        pass  # best-effort


def list_branches(repo_url: str, token: Optional[str] = None, progress_callback: Optional[Callable] = None) -> dict:
    """Return dict with local and remote branches and current branch for a cached repo."""
    # prefer querying remote refs directly (ls-remote) so we get all branches even
    # if the cached clone is shallow or hasn't fetched everything.
    remote_list = []
    try:
        # build URL with token if necessary
        url = _normalize_url(repo_url)
        clone_url = url
        if token and url.startswith("https://"):
            clone_url = url.replace("https://", f"https://{token}@")

        res = subprocess.run(_get_git_base() + ["ls-remote", "--heads", clone_url], env=_get_git_env(), check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = res.stdout.decode("utf-8", errors="replace")
        for line in out.splitlines():
            parts = line.split('\t')
            if len(parts) == 2 and parts[1].startswith('refs/heads/'):
                branch_name = parts[1].split('/', 2)[-1]
                # keep remote-style name for compatibility (origin/branch)
                remote_list.append(f"origin/{branch_name}")
    except Exception:
        # fallback to using cached repo if ls-remote failed
        try:
            path = clone_repo(repo_url, token=token, progress_callback=progress_callback)
            subprocess.run(_get_git_base() + ["-C", path, "fetch", "--all", "--prune"], env=_get_git_env(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # get current branch
            try:
                current = _run_git(path, ["rev-parse", "--abbrev-ref", "HEAD"]).strip()
            except Exception:
                current = ""

            locals_out = _run_git(path, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]).splitlines()
            remotes_out = _run_git(path, ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]).splitlines()

            locals_list = [b for b in locals_out if b]
            remotes_list = [b for b in remotes_out if b]
            return {"current": current, "local": locals_list, "remote": remotes_list}
        except Exception:
            # if all else fails, return empty lists
            return {"current": "", "local": [], "remote": []}

    # if we got here, ls-remote succeeded. Try to determine current & local from cache if available
    current = ""
    local_list = []
    try:
        path = get_cached_path(repo_url)
        if path and os.path.exists(path):
            try:
                current = _run_git(path, ["rev-parse", "--abbrev-ref", "HEAD"]).strip()
            except Exception:
                current = ""
            try:
                locals_out = _run_git(path, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]).splitlines()
                local_list = [b for b in locals_out if b]
            except Exception:
                local_list = []
    except Exception:
        pass

    return {"current": current, "local": local_list, "remote": remote_list}


def checkout_branch(repo_url: str, branch: str, token: Optional[str] = None, progress_callback: Optional[Callable] = None) -> str:
    """Checkout the given branch in the cached repo. Returns the local path."""
    path = clone_repo(repo_url, token=token, progress_callback=progress_callback)

    # fetch first
    try:
        # A shallow clone default to tracking only the default branch. We need to tell git
        # to fetch all branches from origin so we can actually check out other branches.
        subprocess.run(_get_git_base() + ["-C", path, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"], env=_get_git_env(), check=True)
        subprocess.run(_get_git_base() + ["-C", path, "fetch", "--all"], env=_get_git_env(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        pass

    # Determine if branch is a remote like origin/feature
    try:
        # if branch exists locally
        local_branches = _run_git(path, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]).splitlines()
        remote_branches = _run_git(path, ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]).splitlines()
    except subprocess.CalledProcessError:
        local_branches = []
        remote_branches = []

    if branch in local_branches:
        subprocess.run(_get_git_base() + ["-C", path, "checkout", branch], env=_get_git_env(), check=True)
    else:
        # try to find a matching remote branch
        candidate = None
        if branch in remote_branches:
            candidate = branch
        else:
            # try origin/branch
            origin_name = f"origin/{branch}"
            if origin_name in remote_branches:
                candidate = origin_name

        if candidate:
            # create/update local branch to track remote
            local_name = candidate.split('/', 1)[-1]
            subprocess.run(_get_git_base() + ["-C", path, "checkout", "-B", local_name, candidate], env=_get_git_env(), check=True)
        else:
            # fallback: attempt to checkout branch directly (may fail)
            subprocess.run(_get_git_base() + ["-C", path, "checkout", branch], env=_get_git_env(), check=True)

    return path


def get_commit_history(repo_url: str, branch: Optional[str] = None, limit: int = 50, skip: int = 0, token: Optional[str] = None) -> list:
    """Get commit history for a repository. Returns list of commit dicts."""
    path = get_cached_path(repo_url)
    if not path or not os.path.exists(path):
        path = clone_repo(repo_url, token=token)
    
    # Ensure full history is available (unshallow if needed)
    _ensure_unshallow(path, token=token, repo_url=repo_url)

    # Fetch latest changes
    try:
        subprocess.run(_get_git_base() + ["-C", path, "fetch", "--all"], env=_get_git_env(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        pass
    
    # Checkout branch if specified
    branch_checked_out = False
    if branch:
        try:
            checkout_branch(repo_url, branch, token=token)
            branch_checked_out = True
        except Exception:
            pass
    
    # Get commit log with format: hash|author|date|message
    try:
        format_str = "%H|%an|%ad|%s"
        date_format = "--date=iso"
        args = ["log", f"--pretty=format:{format_str}", date_format]
        
        # Add skip if specified
        if skip > 0:
            args.append(f"--skip={skip}")
        
        # Add limit
        args.append(f"-{limit}")
        
        # If branch was checked out successfully, use HEAD (current branch)
        # Otherwise, try to use the branch name directly (normalize if needed)
        if branch and not branch_checked_out:
            # Normalize branch name - remove origin/ prefix if present
            normalized_branch = branch
            if normalized_branch.startswith("origin/"):
                normalized_branch = normalized_branch.replace("origin/", "", 1)
            args.append(normalized_branch)
        
        output = _run_git(path, args)
        commits = []
        
        for line in output.strip().split('\n'):
            if not line:
                continue
            parts = line.split('|', 3)
            if len(parts) == 4:
                commits.append({
                    "hash": parts[0],
                    "author": parts[1],
                    "date": parts[2],
                    "message": parts[3]
                })
        
        return commits
    except Exception as exc:
        return []


def get_commit_details(repo_url: str, commit_hash: str, token: Optional[str] = None) -> dict:
    """Get detailed information about a specific commit including changes."""
    path = get_cached_path(repo_url)
    if not path or not os.path.exists(path):
        path = clone_repo(repo_url, token=token)
    
    # Ensure full history is available (unshallow if needed)
    _ensure_unshallow(path, token=token, repo_url=repo_url)
    
    try:
        # Get commit info
        format_str = "%H|%an|%ae|%ad|%s|%b"
        date_format = "--date=iso"
        commit_info = _run_git(path, ["show", "--pretty=format:" + format_str, date_format, "--no-patch", commit_hash])
        
        parts = commit_info.strip().split('|', 5)
        if len(parts) < 5:
            raise ValueError("Invalid commit format")
        
        commit_data = {
            "hash": parts[0],
            "author": parts[1],
            "email": parts[2],
            "date": parts[3],
            "message": parts[4],
            "body": parts[5] if len(parts) > 5 else ""
        }
        
        # Get file changes details using numstat to avoid truncation
        stat_output = _run_git(path, ["show", "--numstat", "--format=", commit_hash])
        files_changed = []
        is_ignored = build_ignore_checker(path)
        
        # Parse numstat output
        for line in stat_output.strip().split('\n'):
            if not line:
                continue
            parts = line.split('\t', 2)
            if len(parts) == 3:
                added = parts[0]
                deleted = parts[1]
                filename = parts[2]
                
                if is_ignored(os.path.join(path, filename)):
                    continue
                
                # Handle binary files which show as - - filename
                if added == '-': added = 0
                if deleted == '-': deleted = 0
                    
                files_changed.append({
                    "filename": filename,
                    "additions": int(added),
                    "deletions": int(deleted)
                })
        
        commit_data["files_changed"] = files_changed
        
        # Get actual diff
        diff_output = _run_git(path, ["show", commit_hash])
        commit_data["diff"] = diff_output
        
        return commit_data
    except Exception as exc:
        raise ValueError(f"Failed to get commit details: {str(exc)}")


def get_file_content(repo_url: str, commit_hash: str, file_path: str, token: Optional[str] = None) -> str:
    """Get the full content of a file at a specific commit."""
    path = get_cached_path(repo_url)
    if not path or not os.path.exists(path):
        path = clone_repo(repo_url, token=token)
    
    try:
        # Use git show commit:path to get file content
        # We use strict path spec to avoid ambiguity
        # Git expects forward slashes for paths in revision specs, even on Windows
        posix_file_path = file_path.replace("\\", "/")
        return _run_git(path, ["show", f"{commit_hash}:{posix_file_path}"])
    except subprocess.CalledProcessError:
        # If file doesn't exist in that commit or other git error
        return ""
    except Exception as exc:
        raise ValueError(f"Failed to get file content: {str(exc)}")
