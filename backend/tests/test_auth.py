import pytest
from urllib.parse import parse_qs, urlparse

from app.api.routes import auth_routes
from app.services.state_manager import get_session

pytestmark = pytest.mark.integration


def test_github_callback_success_redirects_and_stores_session(
    client,
    monkeypatch,
    fake_async_client_factory,
    make_async_response,
):
    monkeypatch.setattr(
        auth_routes.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_async_client_factory(
            post_response=make_async_response(
                200,
                {"access_token": "gho_test_token"},
            ),
            get_response=make_async_response(
                200,
                {"login": "codeworld-user", "id": 12345},
            ),
        ),
    )

    response = client.get(
        "/api/auth/github/callback?code=valid-oauth-code",
        follow_redirects=False,
    )

    assert response.status_code in (302, 307)
    redirect = urlparse(response.headers["location"])
    params = parse_qs(redirect.query)
    session_token = params["token"][0]

    assert redirect.scheme == "http"
    assert redirect.netloc == "localhost:5173"
    assert params["username"] == ["codeworld-user"]
    session = get_session(session_token, refresh=False)
    assert session is not None
    assert session["github_token"] == "gho_test_token"
    assert session["user"] == "codeworld-user"


def test_github_callback_rejects_invalid_or_expired_code(
    client,
    monkeypatch,
    fake_async_client_factory,
    make_async_response,
):
    monkeypatch.setattr(
        auth_routes.httpx,
        "AsyncClient",
        lambda *args, **kwargs: fake_async_client_factory(
            post_response=make_async_response(
                200,
                {
                    "error": "bad_verification_code",
                    "error_description": "The code passed is incorrect or expired.",
                },
            ),
        ),
    )

    response = client.get("/api/auth/github/callback?code=expired-code")

    assert response.status_code == 400
    assert response.json()["detail"] == "GitHub error: The code passed is incorrect or expired."

