from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from db import get_db
from models import KanbanColumn, Task, User
from schemas import ColumnCreate, ColumnOut, ColumnUpdate, ColumnsReorder
from ws_manager import manager

router = APIRouter()


def _col_out(col: KanbanColumn) -> dict:
    return {"id": col.id, "name": col.name, "color": col.color, "position": col.position}


@router.get("", response_model=list[ColumnOut])
def list_columns(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(KanbanColumn).order_by(KanbanColumn.position).all()


@router.post("", response_model=ColumnOut)
async def create_column(
    body: ColumnCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    max_pos = db.query(KanbanColumn).count()
    col = KanbanColumn(name=body.name, color=body.color, position=max_pos)
    db.add(col)
    db.commit()
    db.refresh(col)
    await manager.broadcast({
        "type": "column_created",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": _col_out(col),
    })
    return col


@router.patch("/{col_id}", response_model=ColumnOut)
async def update_column(
    col_id: int,
    body: ColumnUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    col = db.get(KanbanColumn, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="עמודה לא נמצאה")
    if body.name is not None:
        col.name = body.name
    if body.color is not None:
        col.color = body.color
    col.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(col)
    await manager.broadcast({
        "type": "column_updated",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": _col_out(col),
    })
    return col


@router.delete("/{col_id}")
async def delete_column(
    col_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    col = db.get(KanbanColumn, col_id)
    if not col:
        raise HTTPException(status_code=404, detail="עמודה לא נמצאה")
    task_count = db.query(Task).filter(Task.column_id == col_id).count()
    if task_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"העמודה מכילה {task_count} משימות — העבר אותן לפני מחיקה",
        )
    db.delete(col)
    db.commit()
    await manager.broadcast({
        "type": "column_deleted",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"id": col_id},
    })
    return {"ok": True}


@router.post("/reorder")
async def reorder_columns(
    body: ColumnsReorder,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    for i, col_id in enumerate(body.ids):
        col = db.get(KanbanColumn, col_id)
        if col:
            col.position = i
            col.updated_at = datetime.now(timezone.utc)
    db.commit()
    await manager.broadcast({
        "type": "columns_reordered",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"ordered_ids": body.ids},
    })
    return {"ok": True}
