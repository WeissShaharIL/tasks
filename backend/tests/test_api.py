"""Basic API tests — run with: cd backend && python -m pytest tests/ -q"""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_login_success(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "testpass"})
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "admin"
    assert body["is_admin"] is True


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_authenticated(auth_client):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


def test_board_requires_auth(client):
    r = client.get("/api/board")
    assert r.status_code == 401


def test_board_returns_default_columns(auth_client):
    r = auth_client.get("/api/board")
    assert r.status_code == 200
    data = r.json()
    assert len(data["columns"]) == 3
    names = [c["name"] for c in data["columns"]]
    assert "לביצוע" in names
    assert "בתהליך" in names
    assert "הושלם" in names


def test_create_task(auth_client):
    board = auth_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]

    r = auth_client.post("/api/tasks", json={"title": "משימה לדוגמה", "column_id": col_id})
    assert r.status_code == 200
    task = r.json()
    assert task["title"] == "משימה לדוגמה"
    assert task["column_id"] == col_id


def test_task_appears_in_board(auth_client):
    col_id = auth_client.get("/api/board").json()["columns"][0]["id"]
    auth_client.post("/api/tasks", json={"title": "בדיקה", "column_id": col_id})

    board = auth_client.get("/api/board").json()
    titles = [t["title"] for t in board["tasks"]]
    assert "בדיקה" in titles


def test_update_task(auth_client):
    col_id = auth_client.get("/api/board").json()["columns"][0]["id"]
    task_id = auth_client.post("/api/tasks", json={"title": "ישן", "column_id": col_id}).json()["id"]

    r = auth_client.patch(f"/api/tasks/{task_id}", json={"title": "חדש"})
    assert r.status_code == 200
    assert r.json()["title"] == "חדש"


def test_move_task(auth_client):
    cols = auth_client.get("/api/board").json()["columns"]
    col1_id, col2_id = cols[0]["id"], cols[1]["id"]
    task_id = auth_client.post("/api/tasks", json={"title": "לזוז", "column_id": col1_id}).json()["id"]

    r = auth_client.post(f"/api/tasks/{task_id}/move", json={"column_id": col2_id, "position": 1.0})
    assert r.status_code == 200

    board = auth_client.get("/api/board").json()
    task = next(t for t in board["tasks"] if t["id"] == task_id)
    assert task["column_id"] == col2_id


def test_delete_task(auth_client):
    col_id = auth_client.get("/api/board").json()["columns"][0]["id"]
    task_id = auth_client.post("/api/tasks", json={"title": "למחוק", "column_id": col_id}).json()["id"]

    r = auth_client.delete(f"/api/tasks/{task_id}")
    assert r.status_code == 200

    board = auth_client.get("/api/board").json()
    ids = [t["id"] for t in board["tasks"]]
    assert task_id not in ids


def test_create_column(auth_client):
    r = auth_client.post("/api/columns", json={"name": "עמודה חדשה", "color": "#ff0000"})
    assert r.status_code == 200
    assert r.json()["name"] == "עמודה חדשה"


def test_delete_column_with_tasks_blocked(auth_client):
    col_id = auth_client.post("/api/columns", json={"name": "לא ריק", "color": "#aaa"}).json()["id"]
    auth_client.post("/api/tasks", json={"title": "תפוס", "column_id": col_id})

    r = auth_client.delete(f"/api/columns/{col_id}")
    assert r.status_code == 400


def test_property_def_crud(auth_client):
    r = auth_client.post(
        "/api/admin/property-defs",
        json={"name": "עדיפות", "field_type": "select", "options_json": '["גבוה","נמוך"]'},
    )
    assert r.status_code == 200
    prop_id = r.json()["id"]

    defs = auth_client.get("/api/admin/property-defs").json()
    assert any(d["id"] == prop_id for d in defs)

    auth_client.delete(f"/api/admin/property-defs/{prop_id}")
    defs = auth_client.get("/api/admin/property-defs").json()
    assert not any(d["id"] == prop_id for d in defs)


def test_user_management(auth_client):
    r = auth_client.post(
        "/api/admin/users",
        json={"username": "testuser", "display_name": "משתמש בדיקה", "password": "pass123"},
    )
    assert r.status_code == 200
    user_id = r.json()["id"]

    users = auth_client.get("/api/admin/users").json()
    assert any(u["id"] == user_id for u in users)

    auth_client.delete(f"/api/admin/users/{user_id}")
    users = auth_client.get("/api/admin/users").json()
    assert not any(u["id"] == user_id for u in users)
