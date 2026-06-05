import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bootstrap import run_migrations, seed_admin, seed_default_columns
from db import Base, SessionLocal, engine

from routers import auth as auth_router
from routers import board as board_router
from routers import columns as columns_router
from routers import tasks as tasks_router
from routers import properties as properties_router
from routers import users as users_router
from routers import ws as ws_router

app = FastAPI(title="Tasks")

_cors_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
_cors_origins = (
    [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    if _cors_origins_env
    else []
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
def on_startup():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_migrations(db)
        seed_admin(db)
        seed_default_columns(db)
    finally:
        db.close()


app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(board_router.router, prefix="/api/board", tags=["board"])
app.include_router(columns_router.router, prefix="/api/columns", tags=["columns"])
app.include_router(tasks_router.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(properties_router.router, prefix="/api/admin/property-defs", tags=["property-defs"])
app.include_router(users_router.router, prefix="/api/admin/users", tags=["admin-users"])
app.include_router(ws_router.router, prefix="/api", tags=["ws"])


@app.get("/api/health")
def health():
    return {"ok": True}
