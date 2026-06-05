"""
Integration test configuration.

Tests run against the actual backend at http://localhost:8000 using a
dedicated test user. This is the correct approach for post-deployment tests:
they verify real behavior against the real database.

Run inside the container:
    docker exec tasks-backend-1 python -m pytest tests/ -q

Or locally (if uvicorn is running):
    cd backend && python -m pytest tests/ -q
"""
import os
import pytest
import httpx

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "")


@pytest.fixture(scope="session")
def http():
    """Unauthenticated httpx client."""
    with httpx.Client(base_url=BASE, timeout=10) as c:
        yield c


@pytest.fixture(scope="session")
def authed(http):
    """Authenticated admin httpx client (cookie-based)."""
    r = http.post("/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return http  # same client — cookie is stored in the client's cookie jar
