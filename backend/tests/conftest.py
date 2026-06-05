"""
Test configuration.

Tests run against a dedicated `tasks_test` PostgreSQL database so they never
touch production data. The database is created once by deploy.sh / the test
setup below.

Run:
    docker exec tasks-backend-1 python -m pytest tests/ -q
"""
import os

# Use a dedicated test database — never touches the production `tasks` DB.
# Falls back to SQLite if TEST_DATABASE_URL is not set (for local dev without Postgres).
_test_db_url = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://tasks_test:TasksTest2024!@postgres:5432/tasks_test",
)
os.environ["DATABASE_URL"] = _test_db_url
os.environ["SECRET_KEY"] = "test-secret-key-not-for-prod"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "testpass"
os.environ["UPLOAD_DIR"] = "/tmp/tasks_test_uploads"

import pytest
from fastapi.testclient import TestClient

import models  # noqa: F401 — register all ORM tables with Base
from db import Base, SessionLocal, engine
from main import app


@pytest.fixture(autouse=True)
def clean_db():
    """Drop and recreate all tables before each test for full isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(clean_db):
    from bootstrap import run_migrations, seed_admin, seed_default_columns
    db = SessionLocal()
    try:
        run_migrations(db)
        seed_admin(db)
        seed_default_columns(db)
    finally:
        db.close()
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def auth_client(client):
    """Pre-authenticated admin TestClient."""
    r = client.post("/api/auth/login", json={"username": "admin", "password": "testpass"})
    assert r.status_code == 200, r.text
    return client
