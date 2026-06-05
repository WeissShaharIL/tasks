from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import KanbanColumn, Task, TaskPropertyValue, User
from schemas import (
    PropertyValueIn, PropertyValueOut, TaskCreate, TaskMove, TaskOut, TaskUpdate,
)
from ws_manager import manager

router = APIRouter()


def _task_out(task: Task, db: Session) -> dict:
    props = (
        db.query(TaskPropertyValue)
        .filter(TaskPropertyValue.task_id == task.id)
        .all()
    )
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "column_id": task.column_id,
        "position": task.position,
        "created_by": task.created_by,
        "assigned_to": task.assigned_to,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "properties": [{"prop_def_id": p.prop_def_id, "value_text": p.value_text} for p in props],
    }


def _renumber_column(db: Session, column_id: int, exclude_id: int | None = None):
    tasks = (
        db.query(Task)
        .filter(Task.column_id == column_id, Task.id != exclude_id)
        .order_by(Task.position)
        .all()
    )
    for i, t in enumerate(tasks):
        t.position = float(i + 1)


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    tasks = db.query(Task).order_by(Task.column_id, Task.position).all()
    result = []
    for t in tasks:
        props = db.query(TaskPropertyValue).filter(TaskPropertyValue.task_id == t.id).all()
        out = TaskOut(
            id=t.id,
            title=t.title,
            description=t.description,
            column_id=t.column_id,
            position=t.position,
            created_by=t.created_by,
            assigned_to=t.assigned_to,
            created_at=t.created_at,
            updated_at=t.updated_at,
            properties=[PropertyValueOut(prop_def_id=p.prop_def_id, value_text=p.value_text) for p in props],
        )
        result.append(out)
    return result


@router.post("", response_model=TaskOut)
async def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    col = db.get(KanbanColumn, body.column_id)
    if not col:
        raise HTTPException(status_code=404, detail="עמודה לא נמצאה")

    last = (
        db.query(Task)
        .filter(Task.column_id == body.column_id)
        .order_by(Task.position.desc())
        .first()
    )
    position = (last.position + 1.0) if last else 1.0

    task = Task(
        title=body.title,
        description=body.description,
        column_id=body.column_id,
        position=position,
        created_by=actor.id,
        assigned_to=body.assigned_to,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    await manager.broadcast({
        "type": "task_created",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": _task_out(task, db),
    })
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        column_id=task.column_id,
        position=task.position,
        created_by=task.created_by,
        assigned_to=task.assigned_to,
        created_at=task.created_at,
        updated_at=task.updated_at,
        properties=[],
    )


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    props = db.query(TaskPropertyValue).filter(TaskPropertyValue.task_id == task_id).all()
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        column_id=task.column_id,
        position=task.position,
        created_by=task.created_by,
        assigned_to=task.assigned_to,
        created_at=task.created_at,
        updated_at=task.updated_at,
        properties=[PropertyValueOut(prop_def_id=p.prop_def_id, value_text=p.value_text) for p in props],
    )


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.assigned_to is not None:
        task.assigned_to = body.assigned_to
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)

    await manager.broadcast({
        "type": "task_updated",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": _task_out(task, db),
    })

    props = db.query(TaskPropertyValue).filter(TaskPropertyValue.task_id == task_id).all()
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        column_id=task.column_id,
        position=task.position,
        created_by=task.created_by,
        assigned_to=task.assigned_to,
        created_at=task.created_at,
        updated_at=task.updated_at,
        properties=[PropertyValueOut(prop_def_id=p.prop_def_id, value_text=p.value_text) for p in props],
    )


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    db.delete(task)
    db.commit()
    await manager.broadcast({
        "type": "task_deleted",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"id": task_id},
    })
    return {"ok": True}


@router.post("/{task_id}/move")
async def move_task(
    task_id: int,
    body: TaskMove,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    col = db.get(KanbanColumn, body.column_id)
    if not col:
        raise HTTPException(status_code=404, detail="עמודה לא נמצאה")

    task.column_id = body.column_id
    task.position = body.position
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)

    await manager.broadcast({
        "type": "task_moved",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"id": task.id, "column_id": task.column_id, "position": task.position},
    })
    return {"ok": True}


@router.put("/{task_id}/properties")
async def upsert_properties(
    task_id: int,
    body: list[PropertyValueIn],
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")

    for item in body:
        existing = (
            db.query(TaskPropertyValue)
            .filter(
                TaskPropertyValue.task_id == task_id,
                TaskPropertyValue.prop_def_id == item.prop_def_id,
            )
            .one_or_none()
        )
        if existing:
            existing.value_text = item.value_text
        else:
            db.add(TaskPropertyValue(
                task_id=task_id,
                prop_def_id=item.prop_def_id,
                value_text=item.value_text,
            ))

    task.updated_at = datetime.now(timezone.utc)
    db.commit()

    await manager.broadcast({
        "type": "task_updated",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": _task_out(task, db),
    })
    return {"ok": True}
