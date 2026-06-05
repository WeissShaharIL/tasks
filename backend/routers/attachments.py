import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import Task, TaskAttachment, User
from ws_manager import manager
from datetime import datetime, timezone

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads")).resolve()

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_SIZE = 20 * 1024 * 1024  # 20 MB

router = APIRouter()


def _att_out(a: TaskAttachment) -> dict:
    return {
        "id": a.id,
        "task_id": a.task_id,
        "file_name": a.file_name,
        "file_path": a.file_path,
        "file_type": a.file_type,
        "file_size": a.file_size,
        "uploaded_by": a.uploaded_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/tasks/{task_id}/attachments")
def list_attachments(task_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    attachments = (
        db.query(TaskAttachment)
        .filter(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at)
        .all()
    )
    return [_att_out(a) for a in attachments]


@router.post("/tasks/{task_id}/attachments")
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="סוג קובץ לא נתמך")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="הקובץ גדול מדי (מקסימום 20MB)")

    ext = Path(file.filename or "file").suffix.lower() or ".bin"
    safe_name = f"{uuid4().hex}{ext}"
    dest_dir = UPLOAD_DIR / "tasks" / str(task_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe_name

    with open(dest, "wb") as f:
        f.write(data)

    attachment = TaskAttachment(
        task_id=task_id,
        file_name=file.filename or safe_name,
        file_path=f"/uploads/tasks/{task_id}/{safe_name}",
        file_type=content_type,
        file_size=len(data),
        uploaded_by=actor.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    await manager.broadcast({
        "type": "task_attachment_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"task_id": task_id, "action": "added"},
    })

    return _att_out(attachment)


@router.delete("/attachments/{attachment_id}")
async def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    att = db.get(TaskAttachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="קובץ מצורף לא נמצא")

    task_id = att.task_id
    # Delete physical file
    file_path = UPLOAD_DIR / Path(att.file_path.lstrip("/uploads/"))
    try:
        file_path.unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(att)
    db.commit()

    await manager.broadcast({
        "type": "task_attachment_changed",
        "actor_id": actor.id,
        "actor_name": actor.display_name,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {"task_id": task_id, "action": "deleted"},
    })

    return {"ok": True}
