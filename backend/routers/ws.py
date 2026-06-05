from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from auth import SECRET_KEY, ALGORITHM
from db import SessionLocal
from models import User
from ws_manager import manager

router = APIRouter()


@router.websocket("/ws/board")
async def board_ws(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=4001)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user or user.deleted_at:
            await websocket.close(code=4001)
            return
        user_info = {"id": user.id, "display_name": user.display_name}
    finally:
        db.close()

    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "connected",
            "user_id": user_info["id"],
            "display_name": user_info["display_name"],
        })
        while True:
            # receive_text keeps the connection alive; clients send nothing meaningful
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
