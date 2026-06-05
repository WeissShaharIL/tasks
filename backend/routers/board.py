from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import KanbanColumn, Task, TaskPropertyDef, TaskPropertyValue, User
from schemas import BoardOut, ColumnOut, PropertyDefOut, PropertyValueOut, TaskOut, UserOut

router = APIRouter()


@router.get("", response_model=BoardOut)
def get_board(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    columns = db.query(KanbanColumn).order_by(KanbanColumn.position).all()
    tasks_raw = db.query(Task).order_by(Task.column_id, Task.position).all()
    prop_defs = db.query(TaskPropertyDef).order_by(TaskPropertyDef.position).all()
    users = db.query(User).filter(User.deleted_at.is_(None)).order_by(User.id).all()

    task_ids = [t.id for t in tasks_raw]
    props_raw = (
        db.query(TaskPropertyValue)
        .filter(TaskPropertyValue.task_id.in_(task_ids))
        .all()
        if task_ids else []
    )
    props_by_task: dict[int, list] = {}
    for p in props_raw:
        props_by_task.setdefault(p.task_id, []).append(p)

    tasks = [
        TaskOut(
            id=t.id,
            title=t.title,
            description=t.description,
            column_id=t.column_id,
            position=t.position,
            created_by=t.created_by,
            assigned_to=t.assigned_to,
            created_at=t.created_at,
            updated_at=t.updated_at,
            properties=[
                PropertyValueOut(prop_def_id=p.prop_def_id, value_text=p.value_text)
                for p in props_by_task.get(t.id, [])
            ],
        )
        for t in tasks_raw
    ]

    return BoardOut(
        columns=[ColumnOut.model_validate(c) for c in columns],
        tasks=tasks,
        property_defs=[PropertyDefOut.model_validate(p) for p in prop_defs],
        users=[UserOut.model_validate(u) for u in users],
    )
