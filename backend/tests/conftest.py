import os
import tempfile

# Set env vars before any project modules are imported
_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file.name}"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "testpass"
os.environ["UPLOAD_DIR"] = "/tmp/tasks_test_uploads"

import pytest
from fastapi.testclient import TestClient

import db as db_module
import models  # noqa: F401 — ensures all tables are registered
from db import Base, SessionLocal, engine
from main import app


@pytest.fixture(autouse=True)
def reset_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(reset_db):
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
    """Pre-authenticated admin client."""
    r = client.post("/api/auth/login", json={"username": "admin", "password": "testpass"})
    assert r.status_code == 200, r.text
    return client
