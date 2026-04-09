import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.api.routes import auth_routes
from app.model.analyzer_model import (
    FileMetrics,
    FolderAnalysisResult,
    FolderMetrics,
    FunctionMetric,
)
from app.services.state_manager import _ANALYSIS_CACHE, _PROGRESS, clear_sessions


class FakeAsyncResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = json.dumps(self._payload)

    def json(self):
        return self._payload


class FakeAsyncClient:
    def __init__(self, *, post_response=None, get_response=None, post_exc=None, get_exc=None):
        self.post_response = post_response
        self.get_response = get_response
        self.post_exc = post_exc
        self.get_exc = get_exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        if self.post_exc:
            raise self.post_exc
        return self.post_response

    async def get(self, *args, **kwargs):
        if self.get_exc:
            raise self.get_exc
        return self.get_response


@pytest.fixture(autouse=True)
def reset_runtime_state(monkeypatch, tmp_path):
    monkeypatch.setenv("GITHUB_CLIENT_ID", "codeworld-client-id")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "codeworld-client-secret")
    monkeypatch.setenv(
        "GITHUB_REDIRECT_URI",
        "http://127.0.0.1:8000/api/auth/github/callback",
    )
    monkeypatch.setenv("REPO_CACHE_DIR", str(tmp_path / "repo-cache"))
    monkeypatch.setenv("SESSION_STORE_PATH", str(tmp_path / "sessions.json"))
    monkeypatch.setenv("SESSION_TTL_SECONDS", "604800")

    clear_sessions()
    _PROGRESS.clear()
    _ANALYSIS_CACHE.clear()
    auth_routes._USED_CODES.clear()

    yield

    clear_sessions()
    _PROGRESS.clear()
    _ANALYSIS_CACHE.clear()
    auth_routes._USED_CODES.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def no_raise_client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def make_async_response():
    def _make(status_code=200, payload=None):
        return FakeAsyncResponse(status_code=status_code, payload=payload)

    return _make


@pytest.fixture
def fake_async_client_factory():
    def _factory(*, post_response=None, get_response=None, post_exc=None, get_exc=None):
        return FakeAsyncClient(
            post_response=post_response,
            get_response=get_response,
            post_exc=post_exc,
            get_exc=get_exc,
        )

    return _factory


@pytest.fixture
def make_analysis_result():
    def _make(
        *,
        folder_name="CodeWorld",
        total_files=1,
        total_loc=10,
        total_lloc=6,
        total_functions=1,
        total_complexity=2,
        file_name="src/App.jsx",
    ):
        files = []
        if total_files > 0:
            function = FunctionMetric(
                id=1,
                name="renderApp",
                long_name="renderApp",
                start_line=1,
                end_line=6,
                lloc=6,
                cognitive_complexity=3,
                cyclomatic_complexity=2,
                total_cognitive_complexity=3,
                maintainability_index=82.5,
                max_nesting_depth=1,
                halstead_volume=24.0,
                children=[],
            )

            file_metrics = FileMetrics(
                filename=file_name,
                language="javascript",
                total_loc=total_loc,
                total_lloc=total_lloc,
                function_count=total_functions,
                total_complexity=total_complexity,
                total_cognitive_complexity=3 if total_functions else 0,
                maintainability_index=82.5 if total_functions else None,
                halstead_volume=24.0 if total_functions else None,
                functions=[function] if total_functions else [],
            )
            files.append(file_metrics)

        folder_metrics = FolderMetrics(
            folder_name=folder_name,
            total_files=total_files,
            total_loc=total_loc,
            total_lloc=total_lloc,
            total_functions=total_functions,
            total_complexity=total_complexity,
            maintainability_index=82.5 if files else None,
            halstead_volume=24.0 if files else None,
            files=files,
        )

        return FolderAnalysisResult(
            folder_metrics=folder_metrics,
            individual_files=files,
        )

    return _make
