from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from db import get_db
from models import TaskPropertyDef, User
from schemas import PropertyDefCreate, PropertyDefOut, PropertyDefUpdate, PropertyDefsReorder
from ws_manager import manager

router = APIRouter()


@router.get("", response_model=list[PropertyDefOut])
def list_property_defs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(TaskPropertyDef).order_by(TaskPropertyDef.position).all()


@router.post("", response_model=PropertyDefOut)
async def create_property_def(
    body: PropertyDefCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    VALID_TYPES = {"text", "select", "date", "user", "number"}
    if body.field_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"סוג שדה לא תקין: {body.field_type}")

    max_pos = db.query(TaskPropertyDef).count()
    prop = TaskPropertyDef(
        name=body.name,
        field_type=body.field_type,
        options_json=body.options_json,
        is_required=body.is_required,
        position=max_pos,
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)

    await manager.broadcast({
        "type": "property_def_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"action": "created", "id": prop.id},
    })
    return prop


@router.patch("/{prop_id}", response_model=PropertyDefOut)
async def update_property_def(
    prop_id: int,
    body: PropertyDefUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    prop = db.get(TaskPropertyDef, prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="הגדרת שדה לא נמצאה")
    if body.name is not None:
        prop.name = body.name
    if body.field_type is not None:
        prop.field_type = body.field_type
    if body.options_json is not None:
        prop.options_json = body.options_json
    if body.is_required is not None:
        prop.is_required = body.is_required
    prop.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prop)

    await manager.broadcast({
        "type": "property_def_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"action": "updated", "id": prop.id},
    })
    return prop


@router.delete("/{prop_id}")
async def delete_property_def(
    prop_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    prop = db.get(TaskPropertyDef, prop_id)
    if not prop:
        raise HTTPException(status_code=404, detail="הגדרת שדה לא נמצאה")
    db.delete(prop)
    db.commit()

    await manager.broadcast({
        "type": "property_def_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"action": "deleted", "id": prop_id},
    })
    return {"ok": True}


@router.post("/reorder")
async def reorder_property_defs(
    body: PropertyDefsReorder,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    for i, prop_id in enumerate(body.ids):
        prop = db.get(TaskPropertyDef, prop_id)
        if prop:
            prop.position = i
    db.commit()

    await manager.broadcast({
        "type": "property_def_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"action": "reordered"},
    })
    return {"ok": True}
