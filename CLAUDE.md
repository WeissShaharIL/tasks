# CLAUDE.md — tasks

Hebrew Jira-like kanban task manager. **Single global board**, real-time via WebSocket, all logged-in users can create/move/edit/delete tasks. Admin configures columns + custom task fields. Phone-first PWA. Deployed at **tasks.works-on-my-machine.net** (docker nginx on port **3083**).

> This file auto-loads each session. It is the source of truth for how this project is built and deployed — read it instead of re-exploring. Keep it updated when architecture changes.

---

## Stack

- **Backend** (`backend/`): Python 3.12, FastAPI, SQLAlchemy 2 (sync), psycopg2, `python-jose` JWT, `passlib[bcrypt]`. Single uvicorn worker. No Alembic.
- **Frontend** (`frontend/`): React 18 + Vite, React Router 6, RTL Hebrew, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` for drag-drop, `vite-plugin-pwa` for installability. **No state library** — `AuthContext` + `BoardContext` + a `useReducer`.
- **DB**: PostgreSQL on the shared `ubuntu-shared_default` Docker network (hostname `postgres:5432`, DB `tasks`, user `tasks`). Local dev falls back to SQLite.
- **Real-time**: in-process WebSocket broadcast at `/api/ws/board`.
- **Font**: Rubik (Google Fonts, loaded in `index.html`).

---

## Commands

All run from inside `tasks/`.

**Backend dev (local, SQLite — no postgres needed):**
```bash
cd backend && python -m venv venv && .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # DATABASE_URL defaults to sqlite:///./tasks.db
```

**Frontend dev:**
```bash
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api → :8000 (ws:true)
```

**Full stack via Docker (local, SQLite override):**
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -p tasks up --build -d
# http://localhost:3083   login admin/admin
```

**Tests** (integration — hit the running backend, see Testing below):
```bash
docker exec tasks-backend-1 python -m pytest tests/ -q
python smoke_test.py https://tasks.works-on-my-machine.net
```

**Deploy** (see Deployment section for the full flow):
```bash
ssh shahar@89.139.33.201 "cd ~/code/tasks && bash deploy.sh main"
```

---

## Deployment (IMPORTANT — read before deploying)

- **Server**: `shahar@89.139.33.201`, repo cloned at `~/code/tasks`. GitHub remote: `github.com/WeissShaharIL/tasks` (branch `main` only — no `dev` branch on this project).
- **Workflow after any code change**: `git add -A && git commit && git push` → then on the server `cd ~/code/tasks && bash deploy.sh main`.
- **`deploy-remote.ps1` is unreliable here** (TTY/`Pseudo-terminal` issue makes it exit 1 even when fine). **Prefer running `deploy.sh` directly over SSH**: `ssh shahar@89.139.33.201 "cd ~/code/tasks && bash deploy.sh main"`.
- `deploy.sh` does: `git fetch && reset --hard origin/$REF`, ensures the `tasks` postgres role+DB exist (idempotent — prints harmless `role "tasks" already exists`), then `docker compose build --no-cache && up -d --force-recreate`.
- **`.env` lives on the server only** (gitignored). Already populated. Postgres creds come from the shared stack (`POSTGRES_USER=admin`, `POSTGRES_DB=default`). App DB password `TasksDb2024!`. Admin login is `admin` / `heykaki`. `SECRET_KEY` is set.
- **`sudo` on the server is NOT passwordless** — any nginx/certbot/systemctl step must be run by the user manually; you cannot do it over SSH non-interactively.
- **Host nginx + TLS**: `nginx-host.conf` → `/etc/nginx/sites-available/tasks` (symlinked in sites-enabled). It contains a `map $http_upgrade $connection_upgrade` block (needed for WS) and is served over HTTPS via **certbot/Let's Encrypt** (NOT Cloudflare Origin cert like the `store` project — certbot manages `listen 443 ssl` + redirect). If you change `nginx-host.conf`, the user must run:
  ```bash
  sudo cp ~/code/tasks/nginx-host.conf /etc/nginx/sites-available/tasks
  sudo nginx -t && sudo systemctl reload nginx
  ```
- **Fast iteration without full rebuild**: to test backend-only changes (e.g. test files) you can `docker cp <file> tasks-backend-1:/app/...` then re-run, but a real deploy must go through `deploy.sh`.
- `gitme.ps1 "<msg>"` — convenience add/commit/push helper.

---

## Architecture

### Request flow
Host nginx (:443 TLS) → docker nginx (`nginx/default.conf`, :3083→80) routes:
- `/api/ws/` → backend with WS upgrade headers (`proxy_read_timeout 86400`)
- `/api/` → backend:8000
- `/uploads/` → served statically from the `uploads` Docker volume (`alias /uploads/`, 1-day cache)
- `/` → frontend SPA (nginx serving the Vite `dist`)

`client_max_body_size 20M` (for attachment uploads).

### Auth
JWT in **httpOnly cookie `tasks_token`** (7-day TTL, HS256). `is_admin` in the payload. `get_current_user` / `require_admin` deps in `backend/auth.py`. Cookie name is unique per project to avoid clashes with sibling apps on localhost.

**WS auth quirk**: browsers can't set headers on `new WebSocket()`, and the cookie is httpOnly so JS can't read it. Flow: after login the frontend calls `GET /api/auth/ws-token` which returns the raw JWT in JSON; it's passed as `?token=` on the WS URL. Backend `routers/ws.py` decodes it from `query_params`.

### Data models (`backend/models.py`)
- `users` — username (unique), display_name, password_hash, is_admin, `deleted_at` (soft-delete; unique constraint persists so deleted usernames can't be reused).
- `columns` (class `KanbanColumn`) — name, color (hex), position (int).
- `tasks` — title, description, column_id (FK RESTRICT), `position` (**FLOAT** for cheap midpoint reorder), created_by, assigned_to.
- `task_property_defs` — admin custom field defs: name, field_type (`text|select|date|user|number`), options_json (JSON array string for selects), is_required, position.
- `task_property_values` — per-task field values, `UNIQUE(task_id, prop_def_id)`, cascade-delete with task.
- `task_attachments` — task_id (FK CASCADE), file_name, file_path (`/uploads/tasks/{id}/{uuid}.ext`), file_type, file_size, uploaded_by.

### Position / reorder logic (`routers/tasks.py`)
Tasks use float positions. `POST /tasks/{id}/move` sets position to a value computed client-side (midpoint of neighbors, or last+1). The frontend `KanbanBoard.jsx` computes the midpoint; backend just stores it. `_renumber_column` exists as a helper if positions ever collapse.

### WebSocket (`backend/ws_manager.py`, `routers/ws.py`)
Single room "board". Every mutating endpoint calls `manager.broadcast(...)`. Event envelope: `{ type, actor_id, actor_name, ts, data }`. Event types: `task_created`, `task_updated`, `task_moved`, `task_deleted`, `column_created/updated/deleted`, `columns_reordered`, `property_def_changed`, `task_attachment_changed`. Clients send nothing (receive-only).

**`ConnectionManager` is in-process only** — works because of the single uvicorn worker. Do NOT scale to multiple workers without Redis pub/sub.

### Migrations
No Alembic. `bootstrap.py` runs on every startup: `Base.metadata.create_all`, then `run_migrations()` (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), `seed_admin()` (from `ADMIN_*` env), `seed_default_columns()` (לביצוע/בתהליך/הושלם if columns table empty). Add new columns in `run_migrations()`.

### REST API surface (prefix `/api`)
- `auth`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/ws-token`, `POST /auth/change-password`
- `board`: `GET /board` — aggregate { columns, tasks(+properties), property_defs, users } for initial load
- `columns`: `GET/POST /columns`, `PATCH/DELETE /columns/{id}` (admin; delete blocked if tasks exist → 400), `POST /columns/reorder`
- `tasks`: `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/{id}`, `POST /tasks/{id}/move`, `PUT /tasks/{id}/properties`
- `attachments`: `GET /tasks/{id}/attachments`, `POST /tasks/{id}/attachments` (multipart, ≤20MB, images/pdf/doc/txt), `DELETE /attachments/{id}`
- `property-defs` (admin write, all-users read): `GET/POST /admin/property-defs`, `PATCH/DELETE /admin/property-defs/{id}`, `POST /admin/property-defs/reorder`
- `users` (admin): `GET/POST /admin/users`, `PATCH/DELETE /admin/users/{id}` (soft-delete, can't delete self)
- `GET /api/health` → `{"ok": true}`

---

## Frontend structure (`frontend/src/`)

- `main.jsx` — boots React; **captures `beforeinstallprompt` at module scope** into `window.__pwaPrompt` before React mounts (it fires early), dispatches `pwa-prompt-ready`.
- `contexts/AuthContext.jsx` — `useAuth()`, login/logout, `user` (undefined=loading, null=logged out).
- `contexts/BoardContext.jsx` — single source of truth via `useReducer`. Holds columns/tasks/property_defs/users. On mount loads `GET /board`, opens WS, dispatches reducer actions on WS events. **WS reconnect uses a per-effect `active` flag** so old onclose timers don't open duplicate connections (this was the duplicate-task bug). Reducer `TASK_CREATED` also dedupes by id.
- `hooks/useInstallPrompt.js` — reads `window.__pwaPrompt`; exposes `canShow` (mobile + not standalone + not dismissed), `ios` (Safari iOS needs manual "share→add to home"), `triggerInstall`, `dismiss`.
- `pages/`: `LoginPage`, `BoardPage` (toolbar with "המשימות שלי" filter + install button, then `KanbanBoard`, `TaskModal`, `InstallPrompt`), `AdminPage` (ColumnsManager + PropertyDefsManager + UsersManager).
- `components/board/`: `KanbanBoard` (DndContext, computes move positions, **PointerSensor distance:5**), `KanbanColumn`, `TaskCard` (has a **drag handle** with `touch-action:none` — the rest of the card is tappable/scrollable; this is what makes mobile drag work), `AddTaskButton`.
- `components/task/`: `TaskModal` (edit title/desc/assignee, "העבר לעמודה" pills as drag alternative, custom property fields, attachments), `TaskAttachments` (file picker + `capture="environment"` camera button, thumbnails/doc pills), `PropertyField`, `AssigneeSelect`.
- `components/`: `AppHeader` (logo, admin "הגדרות" link, "סיסמה" → ChangePasswordModal, "התנתק"), `ProtectedRoute`, `AdminRoute`, `ConfirmDialog` (in-app confirm — NOT browser `confirm()`), `ChangePasswordModal`, `InstallPrompt`.
- `api.js` — `request()` wrapper (credentials:include, throws `Error(detail)`); `createBoardWebSocket()`. Attachment upload uses raw `fetch` + `FormData`.
- `styles/`: `index.css` (tokens/vars + buttons/forms + header + install banner + mobile overrides), `board.css` (kanban + toolbar + drag handle + mobile stacking), `task-modal.css` (modal + column-picker + attachments + confirm dialog), `admin.css`. Mobile breakpoint is `@media (max-width: 600px)`; each file owns its own mobile block.

### Design tokens (CSS vars in `index.css`)
Indigo primary `#6366f1`, dark header `#16182a`, surface `#fff`, bg `#eef0f8`. Columns get a colored top border + cards a colored left accent (`--col-color` set inline from the column's color). Glassmorphism on columns (disabled on mobile for perf).

### PWA
`vite-plugin-pwa` (`vite.config.js`). Manifest: name משימות, standalone, theme `#16182a`, SVG icon (`public/icon.svg`). **`navigateFallbackDenylist: [/^\/uploads\//]`** — critical: without it the service worker served index.html for image URLs, breaking attachment viewing. `/api/` is NetworkOnly, `/uploads/` is NetworkFirst.

---

## Hebrew UI
All user-facing strings (UI + FastAPI `HTTPException` detail) are in **Hebrew**. `api.js` throws `new Error(data.detail || "שגיאה")`. Keep new errors in Hebrew. No emojis in the UI (removed by request — use Hebrew text for actions like ערוך/מחק).

---

## Testing
`backend/tests/` are **integration tests** that hit the running backend at `http://localhost:8000` (not a separate test DB — the earlier SQLite/in-memory approach failed due to module import ordering). They create + clean up their own data (`[TEST]` prefixes, uuid usernames). 16 tests covering health, auth, change-password, board, task/column/property/user CRUD + move + delete-blocked.

**httpx gotcha**: httpx doesn't forward cookies to `localhost` reliably, so `conftest.py` extracts the `tasks_token` from the login response and re-injects it as a `Cookie:` header via the `AuthClient` wrapper.

Run after deploy: `docker exec tasks-backend-1 python -m pytest tests/ -q` (all 16 should pass). `smoke_test.py <url>` does black-box HTTP checks (health, 401s, manifest, SPA).

---

## Gotchas / history (don't re-discover these)
- **Duplicate tasks on create** → fixed via per-effect `active` flag in BoardContext (WS reconnect race) + reducer dedup.
- **Clicking uploaded images did nothing** → PWA SW intercepted `/uploads/` nav; fixed with `navigateFallbackDenylist`.
- **Mobile drag impossible** → columns stack vertically and page scroll fought dnd-kit; fixed with a dedicated drag handle (`touch-action:none`) + "העבר לעמודה" pills in the modal.
- **"My tasks" filter showed everything** → was matching `created_by` too; now filters only `assigned_to`.
- **WS 502 / `connection_upgrade` unknown variable** → host nginx needed the `map` block (now in `nginx-host.conf`).
- **`deploy-remote.ps1` exits 1** → TTY issue; run `deploy.sh` directly over SSH instead.
