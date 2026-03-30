import subprocess

import pytest

from app.services import repo_manager


pytestmark = pytest.mark.unit


class RunResult:
    def __init__(self, stdout=b"", stderr=b""):
        self.stdout = stdout
        self.stderr = stderr


@pytest.mark.parametrize(
    ("spec", "expected"),
    [
        ("", False),
        ("owner/repo", True),
        ("https://github.com/Nukie90/CodeWorld.git", True),
        ("git@github.com:Nukie90/CodeWorld.git", True),
        ("bad\ninput", False),
    ],
)
def test_is_probably_git_spec_boundaries(spec, expected):
    assert repo_manager._is_probably_git_spec(spec) is expected


def test_to_full_url_expands_short_github_spec():
    assert (
        repo_manager._to_full_url("Nukie90/CodeWorld")
        == "https://github.com/Nukie90/CodeWorld.git"
    )


def test_list_branches_returns_remote_and_cached_local_data(monkeypatch):
    def fake_run(cmd, env=None, check=None, stdout=None, stderr=None, timeout=None):
        assert "ls-remote" in cmd
        return RunResult(
            stdout=(
                b"abc123\trefs/heads/main\n"
                b"def456\trefs/heads/refactor\n"
            )
        )

    def fake_run_git(path, args):
        if args[:2] == ["rev-parse", "--abbrev-ref"]:
            return "main\n"
        if args[:3] == ["for-each-ref", "--format=%(refname:short)", "refs/heads"]:
            return "main\nrefactor\n"
        raise AssertionError(f"Unexpected git args: {args}")

    monkeypatch.setattr(repo_manager.subprocess, "run", fake_run)
    monkeypatch.setattr(repo_manager, "get_cached_path", lambda repo_url: "/tmp/repo")
    monkeypatch.setattr(repo_manager.os.path, "exists", lambda path: True)
    monkeypatch.setattr(repo_manager, "_run_git", fake_run_git)

    result = repo_manager.list_branches("https://github.com/Nukie90/CodeWorld.git")

    assert result == {
        "current": "main",
        "local": ["main", "refactor"],
        "remote": ["origin/main", "origin/refactor"],
    }


def test_checkout_branch_uses_existing_local_branch(monkeypatch):
    commands = []

    def fake_run(cmd, env=None, check=None, stdout=None, stderr=None):
        commands.append(cmd)
        return RunResult()

    def fake_run_git(path, args):
        if args[:3] == ["for-each-ref", "--format=%(refname:short)", "refs/heads"]:
            return "main\nfeature\n"
        if args[:3] == ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]:
            return "origin/main\norigin/feature\n"
        raise AssertionError(f"Unexpected git args: {args}")

    monkeypatch.setattr(repo_manager, "clone_repo", lambda *args, **kwargs: "/tmp/repo")
    monkeypatch.setattr(repo_manager, "_run_git", fake_run_git)
    monkeypatch.setattr(repo_manager.subprocess, "run", fake_run)

    path = repo_manager.checkout_branch(
        "https://github.com/Nukie90/CodeWorld.git",
        "feature",
    )

    assert path == "/tmp/repo"
    assert any(cmd[-2:] == ["checkout", "feature"] for cmd in commands)
    assert not any("checkout" in cmd and "-B" in cmd for cmd in commands)


@pytest.mark.parametrize(
    ("requested_branch", "expected_local", "expected_remote"),
    [
        ("refactor", "refactor", "origin/refactor"),
        ("origin/refactor", "refactor", "origin/refactor"),
    ],
)
def test_checkout_branch_tracks_remote_when_only_remote_exists(
    monkeypatch,
    requested_branch,
    expected_local,
    expected_remote,
):
    commands = []

    def fake_run(cmd, env=None, check=None, stdout=None, stderr=None):
        commands.append(cmd)
        return RunResult()

    def fake_run_git(path, args):
        if args[:3] == ["for-each-ref", "--format=%(refname:short)", "refs/heads"]:
            return "main\n"
        if args[:3] == ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]:
            return "origin/main\norigin/refactor\n"
        raise AssertionError(f"Unexpected git args: {args}")

    monkeypatch.setattr(repo_manager, "clone_repo", lambda *args, **kwargs: "/tmp/repo")
    monkeypatch.setattr(repo_manager, "_run_git", fake_run_git)
    monkeypatch.setattr(repo_manager.subprocess, "run", fake_run)

    repo_manager.checkout_branch(
        "https://github.com/Nukie90/CodeWorld.git",
        requested_branch,
    )

    assert any(
        cmd[-4:] == ["checkout", "-B", expected_local, expected_remote]
        for cmd in commands
    )


def test_get_commit_history_normalizes_origin_prefix_when_checkout_fails(monkeypatch):
    captured_args = {}

    def fake_run(cmd, env=None, check=None, stdout=None, stderr=None):
        return RunResult()

    def fake_run_git(path, args):
        captured_args["args"] = args
        return (
            "abc123|Alice|2026-03-30 10:00:00 +0000|Initial commit\n"
            "def456|Bob|2026-03-29 10:00:00 +0000|Refactor work\n"
        )

    monkeypatch.setattr(repo_manager, "get_cached_path", lambda repo_url: "/tmp/repo")
    monkeypatch.setattr(repo_manager.os.path, "exists", lambda path: True)
    monkeypatch.setattr(repo_manager.subprocess, "run", fake_run)
    monkeypatch.setattr(
        repo_manager,
        "checkout_branch",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("checkout failed")),
    )
    monkeypatch.setattr(repo_manager, "_run_git", fake_run_git)

    commits = repo_manager.get_commit_history(
        "https://github.com/Nukie90/CodeWorld.git",
        branch="origin/refactor",
        limit=2,
        skip=1,
    )

    assert captured_args["args"][-1] == "refactor"
    assert "--skip=1" in captured_args["args"]
    assert "-2" in captured_args["args"]
    assert commits == [
        {
            "hash": "abc123",
            "author": "Alice",
            "date": "2026-03-30 10:00:00 +0000",
            "message": "Initial commit",
        },
        {
            "hash": "def456",
            "author": "Bob",
            "date": "2026-03-29 10:00:00 +0000",
            "message": "Refactor work",
        },
    ]


def test_get_file_content_returns_empty_string_for_missing_file(monkeypatch):
    monkeypatch.setattr(repo_manager, "get_cached_path", lambda repo_url: "/tmp/repo")
    monkeypatch.setattr(repo_manager.os.path, "exists", lambda path: True)
    monkeypatch.setattr(
        repo_manager,
        "_run_git",
        lambda path, args: (_ for _ in ()).throw(
            subprocess.CalledProcessError(128, ["git", "show"])
        ),
    )

    content = repo_manager.get_file_content(
        "https://github.com/Nukie90/CodeWorld.git",
        "abc123",
        "src/missing.js",
    )

    assert content == ""
