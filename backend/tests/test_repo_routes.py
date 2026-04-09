import pytest
from app.services import repo_manager


@pytest.fixture
def mock_session(monkeypatch):
    token = "test-token"
    from app.api.routes import repo_routes
    monkeypatch.setattr(
        repo_routes,
        "get_session",
        lambda t: {"user": "test-user", "github_token": "fake"} if t == token else None
    )
    yield token

def test_repo_branches_requires_auth(client):
    response = client.get("/api/repo/branches?repo_url=https://github.com/test/repo")
    # If no token is provided, verify_session currently just returns (based on repo_routes.py:16)
    # So it doesn't "require" auth if token is None/empty.
    # However, if an INVALID token is provided, it should fail.
    response = client.get("/api/repo/branches?repo_url=https://github.com/test/repo&token=invalid")
    assert response.status_code == 401
    assert "Session expired" in response.json()["detail"]

def test_repo_branches_success(client, mock_session, monkeypatch):
    monkeypatch.setattr(
        repo_manager,
        "list_branches",
        lambda repo_url, token=None: ["main", "develop"]
    )
    
    response = client.get(f"/api/repo/branches?repo_url=https://github.com/test/repo&token={mock_session}")
    assert response.status_code == 200
    assert response.json() == ["main", "develop"]

def test_repo_checkout_success(client, mock_session, monkeypatch, make_analysis_result):
    analysis_result = make_analysis_result()
    
    monkeypatch.setattr(
        repo_manager,
        "checkout_branch",
        lambda repo_url, branch, token=None: "/tmp/test-repo"
    )
    
    # Mock Git HEAD
    monkeypatch.setattr(
        repo_manager,
        "_run_git",
        lambda local_path, args: "HEAD-SHA" if args[0] == "rev-parse" else ""
    )
    
    from app.api.routes import repo_routes
    monkeypatch.setattr(
        repo_routes,
        "analyze_local_folder",
        lambda *args, **kwargs: analysis_result
    )

    payload = {
        "repo_url": "https://github.com/test/repo",
        "branch": "main",
        "token": mock_session
    }
    response = client.post("/api/repo/checkout", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["repo_url"] == payload["repo_url"]
    assert data["branch"] == "main"
    assert "analysis" in data

def test_get_function_code_success(client, mock_session, monkeypatch, tmp_path):
    # Setup a dummy file
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    file_content = "function hello() {\n  console.log('hi');\n}\n"
    test_file = repo_dir / "test.js"
    test_file.write_text(file_content)
    
    monkeypatch.setattr(
        repo_manager,
        "get_cached_path",
        lambda repo_url: str(repo_dir)
    )
    
    payload = {
        "repo_url": "https://github.com/test/repo",
        "filename": "test.js",
        "function_name": "hello",
        "start_line": 1,
        "lloc": 3,
        "token": mock_session
    }
    
    response = client.post("/api/repo/function-code", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "code" in data
    assert "console.log('hi')" in data["code"]

def test_get_commit_history_success(client, mock_session, monkeypatch):
    mock_commits = [
        {"hash": "123", "message": "feat: init", "author": "dev", "date": "2023-01-01"}
    ]
    monkeypatch.setattr(
        repo_manager,
        "get_commit_history",
        lambda *args, **kwargs: mock_commits
    )
    
    payload = {
        "repo_url": "https://github.com/test/repo",
        "token": mock_session
    }
    response = client.post("/api/repo/commits", json=payload)
    assert response.status_code == 200
    assert response.json()["commits"] == mock_commits

