import httpx
import pytest

from app.api.routes import analyze_routes, auth_routes


pytestmark = pytest.mark.integration


def test_upstream_timeout_returns_internal_error(
    no_raise_client,
    monkeypatch,
    fake_async_client_factory,
):
    monkeypatch.setattr(
        auth_routes,
        "get_session",
        lambda token: {"github_token": "qa", "user": "qa-user"} if token == "live-token" else None
    )

    monkeypatch.setattr(
        auth_routes.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_async_client_factory(
            get_exc=httpx.ReadTimeout("GitHub API timed out"),
        ),
    )

    response = no_raise_client.get("/api/auth/github/repos?token=live-token")

    assert response.status_code == 500


def test_github_api_failure_is_forwarded_to_client(
    client,
    monkeypatch,
    fake_async_client_factory,
    make_async_response,
):
    monkeypatch.setattr(
        auth_routes,
        "get_session",
        lambda token: {"github_token": "qa", "user": "qa-user"} if token == "live-token" else None
    )

    monkeypatch.setattr(
        auth_routes.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_async_client_factory(
            get_response=make_async_response(
                502,
                {"message": "Bad Gateway"},
            ),
        ),
    )

    response = client.get("/api/auth/github/repos?token=live-token")

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to fetch repositories from GitHub"


def test_analyzer_service_unavailable_returns_internal_error(client, monkeypatch):
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "clone_repo",
        lambda repo_url, token=None, progress_callback=None: "/tmp/broken-repo",
    )
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "_run_git",
        lambda local_path, args: "abc123\n",
    )
    monkeypatch.setattr(
        analyze_routes,
        "analyze_local_folder",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            RuntimeError("Analyzer service unavailable")
        ),
    )

    response = client.post(
        "/api/analyze/repo",
        json={"repo_url": "https://github.com/example/broken-repo.git"},
    )

    assert response.status_code == 500
    assert "Analyzer service unavailable" in response.json()["detail"]
