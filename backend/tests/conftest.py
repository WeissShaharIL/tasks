"""
Integration test configuration.

Tests run against the actual backend at http://localhost:8000.
Each test creates and cleans up its own data so production data is untouched.

Run inside the container:
    docker exec tasks-backend-1 python -m pytest tests/ -q
"""
import os
import pytest
import httpx

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "")

# Cookie name from auth.py
COOKIE_NAME = "tasks_token"


class AuthClient:
    """Thin wrapper around httpx.Client that re-injects the auth cookie.

    httpx doesn't forward cookies to localhost in all situations, so we
    extract the JWT from the login response and send it manually.
    """
    def __init__(self, base_url: str, token: str):
        self._base = base_url
        self._token = token

    def _headers(self):
        return {"Cookie": f"{COOKIE_NAME}={self._token}"}

    def get(self, path, **kw):
        return httpx.get(self._base + path, headers=self._headers(), timeout=10, **kw)

    def post(self, path, **kw):
        return httpx.post(self._base + path, headers=self._headers(), timeout=10, **kw)

    def patch(self, path, **kw):
        return httpx.patch(self._base + path, headers=self._headers(), timeout=10, **kw)

    def delete(self, path, **kw):
        return httpx.delete(self._base + path, headers=self._headers(), timeout=10, **kw)


@pytest.fixture(scope="module")
def http():
    """Unauthenticated httpx client."""
    with httpx.Client(base_url=BASE, timeout=10) as c:
        yield c


@pytest.fixture(scope="module")
def authed():
    """Authenticated admin client with cookie forwarded manually."""
    r = httpx.post(f"{BASE}/api/auth/login",
                   json={"username": ADMIN_USER, "password": ADMIN_PASS},
                   timeout=10)
    assert r.status_code == 200, f"Admin login failed ({r.status_code}): {r.text}"
    token = r.cookies.get(COOKIE_NAME)
    assert token, "No tasks_token cookie in login response"
    return AuthClient(BASE, token)
