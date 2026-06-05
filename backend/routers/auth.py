import os
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from auth import (
    COOKIE_NAME, SECRET_KEY, ALGORITHM,
    create_token, verify_password, get_current_user,
)
from db import get_db
from models import User
from schemas import LoginRequest, UserOut

router = APIRouter()

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).one_or_none()
    if not user or user.deleted_at or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")
    token = create_token(user)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=7 * 24 * 3600,
    )
    return UserOut.model_validate(user)


@router.post("/logout")
def logout(response: Response, _: User = Depends(get_current_user)):
    response.delete_cookie(key=COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/ws-token")
def ws_token(user: User = Depends(get_current_user)):
    """Return the raw JWT so the frontend can pass it as a WS query param."""
    token = create_token(user)
    return {"token": token}
