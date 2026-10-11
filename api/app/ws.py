"""WebSocket hub: one socket per tab, fan-out to chat members."""

from __future__ import annotations

import json
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from . import db
from .auth import decode_token
from .models import ChatMember, User
from .services import display_name


class Hub:
    def __init__(self):
        self.sockets: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.sockets[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        self.sockets[user_id].discard(ws)
        if not self.sockets[user_id]:
            self.sockets.pop(user_id, None)

    def online(self, user_id: int) -> bool:
        return user_id in self.sockets

    async def send_to(self, user_ids, payload: dict, skip: WebSocket | None = None):
        text = json.dumps(payload)
        for uid in set(user_ids):
            for ws in list(self.sockets.get(uid, ())):
                if ws is skip:
                    continue
                try:
                    await ws.send_text(text)
                except Exception:
                    self.disconnect(uid, ws)


hub = Hub()
router = APIRouter()


def chat_member_ids(session: Session, chat_id: int) -> list[int]:
    return [m.user_id for m in session.exec(select(ChatMember).where(ChatMember.chat_id == chat_id))]


@router.websocket("/ws")
async def websocket(ws: WebSocket, token: str = ""):
    uid = decode_token(token)
    if not uid:
        await ws.close(code=4401)
        return
    await hub.connect(uid, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if data.get("type") == "typing" and isinstance(data.get("chat_id"), int):
                with Session(db.engine) as session:
                    members = chat_member_ids(session, data["chat_id"])
                    if uid not in members:
                        continue
                    user = session.get(User, uid)
                    payload = {"type": "typing", "chat_id": data["chat_id"],
                               "user": {"id": uid, "display_name": display_name(user)}}
                await hub.send_to([m for m in members if m != uid], payload)
            elif data.get("type") == "ping":
                await ws.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(uid, ws)
