import pytest

from app.services.repo_manager import (
    _is_probably_git_spec,
    _normalize_url,
    _repo_hash,
    _to_full_url,
    clone_repo,
)


def canonicalize_repo_spec(spec: str) -> str:
    return _normalize_url(_to_full_url(spec))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://github.com/example/repo", True),
        ("git@github.com:example/repo.git", True),
        ("example/repo", True),
        ("", False),
        ("not a repo name", False),
        ("example/repo\nextra", False),
    ],
)
def test_is_probably_git_spec(value, expected):
    assert _is_probably_git_spec(value) is expected


def test_to_full_url_expands_short_github_spec():
    assert _to_full_url("example/repo") == "https://github.com/example/repo.git"
    assert _to_full_url("https://github.com/example/repo.git") == "https://github.com/example/repo.git"


@pytest.mark.parametrize(
    ("spec", "expected"),
    [
        pytest.param(
            "team/project",
            "https://github.com/team/project.git",
            id="pairwise-short-none-no-slash",
        ),
        pytest.param(
            "  team/project/  ",
            "team/project",
            id="pairwise-short-padded-with-slash",
        ),
        pytest.param(
            "https://github.com/team/project/",
            "https://github.com/team/project",
            id="pairwise-https-none-with-slash",
        ),
        pytest.param(
            "  https://github.com/team/project  ",
            "https://github.com/team/project",
            id="pairwise-https-padded-no-slash",
        ),
        pytest.param(
            "git@github.com:team/project.git",
            "git@github.com:team/project.git",
            id="pairwise-ssh-none-no-slash",
        ),
        pytest.param(
            "  git@github.com:team/project.git/  ",
            "git@github.com:team/project.git",
            id="pairwise-ssh-padded-with-slash",
        ),
    ],
)
def test_repo_spec_canonicalization_pairwise(spec, expected):
    assert canonicalize_repo_spec(spec) == expected


def test_normalize_url_trims_trailing_slash_only():
    assert _normalize_url("https://github.com/example/repo/") == "https://github.com/example/repo"
    assert _normalize_url("https://github.com/example/repo.git") == "https://github.com/example/repo.git"


def test_repo_hash_is_stable_and_short():
    repo_hash = _repo_hash("https://github.com/example/repo.git")

    assert repo_hash == _repo_hash("https://github.com/example/repo.git")
    assert len(repo_hash) == 12


def test_clone_repo_rejects_invalid_repository_spec_before_git_runs():
    with pytest.raises(ValueError, match="Invalid repository specification"):
        clone_repo("definitely not a git repo")
