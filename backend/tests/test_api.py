"""
Integration tests against the running backend (http://localhost:8000).
Each test creates and cleans up its own data so the production database is
left unchanged after the test run.
"""
import pytest


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(http):
    r = http.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_login_wrong_password(http):
    r = http.post("/api/auth/login", json={"username": "admin", "password": "definitely-wrong"})
    assert r.status_code == 401


def test_me_unauthenticated(http):
    # fresh client, no cookie
    import httpx
    with httpx.Client(base_url=http.base_url, timeout=10) as c:
        r = c.get("/api/auth/me")
    assert r.status_code == 401


def test_me_authenticated(authed):
    r = authed.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["is_admin"] is True


# ── Board ─────────────────────────────────────────────────────────────────────

def test_board_requires_auth(http):
    import httpx
    with httpx.Client(base_url=http.base_url, timeout=10) as c:
        r = c.get("/api/board")
    assert r.status_code == 401


def test_board_has_columns(authed):
    r = authed.get("/api/board")
    assert r.status_code == 200
    data = r.json()
    assert len(data["columns"]) >= 1
    assert "tasks" in data
    assert "users" in data


# ── Task CRUD ─────────────────────────────────────────────────────────────────

@pytest.fixture
def test_column(authed):
    """Returns the first column id."""
    return authed.get("/api/board").json()["columns"][0]["id"]


@pytest.fixture
def test_task(authed, test_column):
    """Creates a task and deletes it after the test."""
    r = authed.post("/api/tasks", json={"title": "[TEST] task", "column_id": test_column})
    assert r.status_code == 200
    task_id = r.json()["id"]
    yield r.json()
    authed.delete(f"/api/tasks/{task_id}")


def test_create_task(authed, test_task):
    assert test_task["title"] == "[TEST] task"
    assert test_task["column_id"] is not None


def test_task_visible_in_board(authed, test_task):
    board = authed.get("/api/board").json()
    ids = [t["id"] for t in board["tasks"]]
    assert test_task["id"] in ids


def test_update_task(authed, test_task):
    r = authed.patch(f"/api/tasks/{test_task['id']}", json={"title": "[TEST] updated"})
    assert r.status_code == 200
    assert r.json()["title"] == "[TEST] updated"


def test_move_task(authed, test_task):
    cols = authed.get("/api/board").json()["columns"]
    # move to the second column
    target = cols[1]["id"]
    r = authed.post(f"/api/tasks/{test_task['id']}/move",
                    json={"column_id": target, "position": 9999.0})
    assert r.status_code == 200
    board = authed.get("/api/board").json()
    moved = next(t for t in board["tasks"] if t["id"] == test_task["id"])
    assert moved["column_id"] == target


# ── Column admin ──────────────────────────────────────────────────────────────

@pytest.fixture
def test_col(authed):
    """Creates a test column and deletes it after the test."""
    r = authed.post("/api/columns", json={"name": "[TEST] col", "color": "#123456"})
    assert r.status_code == 200
    col_id = r.json()["id"]
    yield r.json()
    authed.delete(f"/api/columns/{col_id}")


def test_create_column(test_col):
    assert test_col["name"] == "[TEST] col"
    assert test_col["color"] == "#123456"


def test_delete_column_with_tasks_blocked(authed, test_col):
    authed.post("/api/tasks", json={"title": "[TEST] blocking", "column_id": test_col["id"]})
    r = authed.delete(f"/api/columns/{test_col['id']}")
    assert r.status_code == 400
    # clean up the task so the fixture can delete the column
    board = authed.get("/api/board").json()
    for t in board["tasks"]:
        if t["column_id"] == test_col["id"]:
            authed.delete(f"/api/tasks/{t['id']}")


# ── Property defs ─────────────────────────────────────────────────────────────

@pytest.fixture
def test_prop(authed):
    r = authed.post("/api/admin/property-defs",
                    json={"name": "[TEST] prop", "field_type": "text"})
    assert r.status_code == 200
    pid = r.json()["id"]
    yield r.json()
    authed.delete(f"/api/admin/property-defs/{pid}")


def test_property_def_visible(authed, test_prop):
    defs = authed.get("/api/admin/property-defs").json()
    assert any(d["id"] == test_prop["id"] for d in defs)


# ── User management ───────────────────────────────────────────────────────────

@pytest.fixture
def test_user(authed):
    import uuid
    username = f"t_{uuid.uuid4().hex[:10]}"
    r = authed.post("/api/admin/users",
                    json={"username": username, "display_name": "Test", "password": "pass123"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    yield r.json()
    authed.delete(f"/api/admin/users/{uid}")


def test_user_visible(authed, test_user):
    users = authed.get("/api/admin/users").json()
    assert any(u["id"] == test_user["id"] for u in users)


def test_user_color_set_and_clear(authed, test_user):
    uid = test_user["id"]
    # set
    r = authed.patch(f"/api/admin/users/{uid}", json={"color": "#ff8800"})
    assert r.status_code == 200
    assert r.json()["color"] == "#ff8800"
    # color shows up in the board users list too
    board = authed.get("/api/board").json()
    bu = next(u for u in board["users"] if u["id"] == uid)
    assert bu["color"] == "#ff8800"
    # clear (empty string → null)
    r = authed.patch(f"/api/admin/users/{uid}", json={"color": ""})
    assert r.status_code == 200
    assert r.json()["color"] is None


# ── Change password ───────────────────────────────────────────────────────────

def test_change_password_wrong_current(authed):
    r = authed.post("/api/auth/change-password",
                    json={"current_password": "definitely-wrong", "new_password": "whatever123"})
    assert r.status_code == 400


def test_change_password_roundtrip(authed):
    import os
    BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
    pw = os.environ.get("ADMIN_PASSWORD", "")
    # change to a temp password, then change back, verifying login works each way
    r = authed.post("/api/auth/change-password",
                    json={"current_password": pw, "new_password": "tmp_pw_9931"})
    assert r.status_code == 200, r.text
    import httpx
    # login with the new password works
    r2 = httpx.post(f"{BASE}/api/auth/login",
                    json={"username": "admin", "password": "tmp_pw_9931"}, timeout=10)
    assert r2.status_code == 200
    # restore original password using the new session
    token = r2.cookies.get("tasks_token")
    r3 = httpx.post(f"{BASE}/api/auth/change-password",
                    headers={"Cookie": f"tasks_token={token}"},
                    json={"current_password": "tmp_pw_9931", "new_password": pw}, timeout=10)
    assert r3.status_code == 200
