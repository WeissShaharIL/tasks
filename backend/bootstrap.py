import os

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from auth import hash_password
from db import engine
from models import KanbanColumn, User


DEFAULT_COLUMNS = [
    {"name": "לביצוע", "color": "#6b7280", "position": 0},
    {"name": "בתהליך", "color": "#3b82f6", "position": 1},
    {"name": "הושלם",  "color": "#22c55e", "position": 2},
]


def run_migrations(_db: Session) -> None:
    """Idempotent ALTER TABLE migrations for columns added after initial deploy."""
    insp = inspect(engine)
    is_pg = engine.dialect.name == "postgresql"

    def _has_col(table: str, col: str) -> bool:
        try:
            return any(c["name"] == col for c in insp.get_columns(table))
        except Exception:
            return False

    def _add_col(table: str, col: str, col_type: str, default: str) -> None:
        if _has_col(table, col):
            return
        with engine.begin() as conn:
            if is_pg:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type} DEFAULT {default}"
                ))
            else:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN {col} {col_type} DEFAULT {default}"
                ))

    # Future migrations go here


def seed_admin(db: Session) -> None:
    username = os.environ.get("ADMIN_USERNAME", "admin").strip()
    password = os.environ.get("ADMIN_PASSWORD", "").strip()
    display_name = os.environ.get("ADMIN_DISPLAY_NAME", "מנהל מערכת").strip()

    if not password:
        raise RuntimeError("ADMIN_PASSWORD must be set in .env")

    existing = db.query(User).filter(User.username == username).one_or_none()
    new_hash = hash_password(password)
    if existing:
        existing.password_hash = new_hash
        existing.is_admin = True
        if display_name:
            existing.display_name = display_name
        db.commit()
        return

    db.add(User(
        username=username,
        display_name=display_name or username,
        password_hash=new_hash,
        is_admin=True,
    ))
    db.commit()


def seed_default_columns(db: Session) -> None:
    if db.query(KanbanColumn).first():
        return
    for col in DEFAULT_COLUMNS:
        db.add(KanbanColumn(name=col["name"], color=col["color"], position=col["position"]))
    db.commit()
