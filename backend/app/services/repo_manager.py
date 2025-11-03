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


def clone_repo(repo_url: str, token: Optional[str] = None) -> str:
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
        subprocess.run(["git", "clone", clone_url, target_path], check=True)
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
    res = subprocess.run(["git", "-C", path] + args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return res.stdout.decode("utf-8", errors="replace")


def list_branches(repo_url: str, token: Optional[str] = None) -> dict:
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

        res = subprocess.run(["git", "ls-remote", "--heads", clone_url], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
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
            path = clone_repo(repo_url, token=token)
            subprocess.run(["git", "-C", path, "fetch", "--all", "--prune"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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


def checkout_branch(repo_url: str, branch: str, token: Optional[str] = None) -> str:
    """Checkout the given branch in the cached repo. Returns the local path."""
    path = clone_repo(repo_url, token=token)

    # fetch first
    try:
        subprocess.run(["git", "-C", path, "fetch", "--all"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        subprocess.run(["git", "-C", path, "checkout", branch], check=True)
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
            subprocess.run(["git", "-C", path, "checkout", "-B", local_name, candidate], check=True)
        else:
            # fallback: attempt to checkout branch directly (may fail)
            subprocess.run(["git", "-C", path, "checkout", branch], check=True)

    return path
