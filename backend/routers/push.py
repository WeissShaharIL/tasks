from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from models import PushSubscription, User
import push_service

router = APIRouter()


class SubscribeBody(BaseModel):
    endpoint: str
    keys: dict  # { p256dh, auth }


class UnsubscribeBody(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
def vapid_public_key(_: User = Depends(get_current_user)):
    # Empty string when push isn't configured on the server — frontend handles it.
    return {"key": push_service.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == body.endpoint)
        .one_or_none()
    )
    if existing:
        existing.user_id = user.id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        db.add(PushSubscription(
            user_id=user.id,
            endpoint=body.endpoint,
            p256dh=p256dh,
            auth=auth,
        ))
    db.commit()
    return {"ok": True}


@router.post("/unsubscribe")
def unsubscribe(
    body: UnsubscribeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == body.endpoint
    ).delete()
    db.commit()
    return {"ok": True}
