import pytest

from app.api.routes import analyze_routes

pytestmark = pytest.mark.integration


def test_valid_repository_analysis_request_returns_metrics(
    client,
    monkeypatch,
    make_analysis_result,
):
    analysis_result = make_analysis_result()

    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "clone_repo",
        lambda repo_url, token=None, progress_callback=None: "/tmp/CodeWorld",
    )
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "_run_git",
        lambda local_path, args: "abc123def\n",
    )
    monkeypatch.setattr(
        analyze_routes,
        "analyze_local_folder",
        lambda *args, **kwargs: analysis_result,
    )

    response = client.post(
        "/api/analyze/repo",
        json={"repo_url": "https://github.com/Nukie90/CodeWorld.git"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["repo_url"] == "https://github.com/Nukie90/CodeWorld.git"
    assert payload["folder_name"] == "/tmp/CodeWorld"
    assert payload["analysis"]["folder_metrics"]["folder_name"] == "CodeWorld"
    assert payload["analysis"]["folder_metrics"]["total_files"] == 1
    assert payload["analysis"]["individual_files"][0]["filename"] == "src/App.jsx"


def test_invalid_repository_url_returns_bad_request(client, monkeypatch):
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "clone_repo",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            ValueError("Invalid repository specification: 'not-a-repo'")
        ),
    )

    response = client.post(
        "/api/analyze/repo",
        json={"repo_url": "not-a-repo"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid repository specification: 'not-a-repo'"


def test_inaccessible_private_repository_returns_server_error(client, monkeypatch):
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "clone_repo",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            PermissionError("Repository is private or access is denied")
        ),
    )

    response = client.post(
        "/api/analyze/repo",
        json={"repo_url": "https://github.com/example/private-repo.git"},
    )

    assert response.status_code == 500
    assert "Failed to clone repo" in response.json()["detail"]


def test_empty_repository_returns_empty_analysis_result(
    client,
    monkeypatch,
    make_analysis_result,
):
    empty_result = make_analysis_result(
        folder_name="empty-repo",
        total_files=0,
        total_loc=0,
        total_lloc=0,
        total_functions=0,
        total_complexity=0,
    )

    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "clone_repo",
        lambda repo_url, token=None, progress_callback=None: "/tmp/empty-repo",
    )
    monkeypatch.setattr(
        analyze_routes.repo_manager,
        "_run_git",
        lambda local_path, args: "emptyhead\n",
    )
    monkeypatch.setattr(
        analyze_routes,
        "analyze_local_folder",
        lambda *args, **kwargs: empty_result,
    )

    response = client.post(
        "/api/analyze/repo",
        json={"repo_url": "https://github.com/example/empty-repo.git"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["folder_metrics"]["total_files"] == 0
    assert payload["analysis"]["folder_metrics"]["total_functions"] == 0
    assert payload["analysis"]["individual_files"] == []
