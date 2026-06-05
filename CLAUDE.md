# CLAUDE.md — tasks

Hebrew Jira-like kanban task manager. Single board, real-time via WebSocket. Deployed at tasks.works-on-my-machine.net (port 3083).

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2 (sync), psycopg2, JWT in httpOnly cookie `tasks_token`
- **Frontend**: React 18 + Vite, RTL Hebrew, `@dnd-kit/core` + `@dnd-kit/sortable` for drag-drop
- **DB**: PostgreSQL on `ubuntu-shared_default` Docker network (hostname `postgres:5432`, DB `tasks`)
- **Real-time**: WebSocket at `/api/ws/board` — all connected clients receive board mutations

## Commands

**Backend dev (local):**
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# DATABASE_URL=sqlite:///./tasks.db (default, no postgres needed)
uvicorn main:app --reload --port 8000
```

**Frontend dev:**
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api → :8000
```

**Full stack via Docker (local, no external postgres):**
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -p tasks up --build -d
# App at http://localhost:3083  login: admin/admin
```

**Deploy on server:**
```bash
./deploy.sh main   # or specific tag
```

**After deploy — if nginx-host.conf changed:**
```bash
sudo cp nginx-host.conf /etc/nginx/sites-available/tasks
sudo nginx -t && sudo systemctl reload nginx
```

## Architecture

### Data models

- `users` — username, display_name, password_hash, is_admin, deleted_at (soft-delete)
- `columns` — kanban columns: name, color (hex), position (int)
- `tasks` — title, description, column_id, position (float for cheap midpoint reorder), created_by, assigned_to
- `task_property_defs` — admin-defined custom fields: name, field_type (text|select|date|user|number), options_json, is_required
- `task_property_values` — per-task values for custom fields (UNIQUE task_id+prop_def_id, cascade-delete)

### WebSocket

Single room "board". All write operations (create/update/move/delete task or column, change property defs) broadcast an event to all connected clients. The WS endpoint is `/api/ws/board?token=<jwt>`.

Because the cookie is httpOnly, the frontend cannot read it directly for the WS URL. Instead, `GET /api/auth/ws-token` returns the raw JWT in JSON — fetch this once after login, store in a React ref (not state/localStorage), use it for the WS connection.

### Migrations

No Alembic. Add new columns in `bootstrap.py → run_migrations()` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Runs on every startup.

### Key constraint

`ConnectionManager` in `ws_manager.py` is in-process only — works because we run a single uvicorn worker. Do not scale to multiple workers without adding Redis pub/sub.
