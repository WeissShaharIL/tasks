"""
Web Push sending. VAPID keys come from env (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY,
base64url raw keys; VAPID_SUBJECT a mailto:). If keys are absent, push is a no-op
so the app runs fine before keys are configured.

Generate keys (run once, then put the printed values in .env):
    docker exec tasks-backend-1 python -c "import push_service; push_service.print_new_keys()"
"""
import json
import os

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@works-on-my-machine.net").strip()


def push_enabled() -> bool:
    return bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


def _send_one(sub, payload: dict) -> bool:
    """Returns True to keep the subscription, False if it's dead (404/410)."""
    from pywebpush import webpush, WebPushException
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            timeout=10,
        )
        return True
    except WebPushException as e:
        resp = getattr(e, "response", None)
        if resp is not None and resp.status_code in (404, 410):
            return False  # subscription expired/gone — prune it
        return True
    except Exception:
        return True


def send_to_user(user_id: int, payload: dict) -> None:
    """Send a push to every device of a user. Creates its own DB session so it's
    safe to call from a worker thread (SQLAlchemy sessions aren't thread-shared)."""
    if not push_enabled():
        return
    from db import SessionLocal
    from models import PushSubscription

    db = SessionLocal()
    try:
        subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
        dead = []
        for sub in subs:
            if not _send_one(sub, payload):
                dead.append(sub)
        for sub in dead:
            db.delete(sub)
        if dead:
            db.commit()
    finally:
        db.close()


def print_new_keys() -> None:
    """Generate a VAPID keypair and print the env lines."""
    import base64
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization

    pk = ec.generate_private_key(ec.SECP256R1())
    priv_bytes = pk.private_numbers().private_value.to_bytes(32, "big")
    pub_bytes = pk.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    print("VAPID_PRIVATE_KEY=" + b64(priv_bytes))
    print("VAPID_PUBLIC_KEY=" + b64(pub_bytes))
