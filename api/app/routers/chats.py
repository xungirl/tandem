from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..models import Activity, Chat, ChatMember, Message, User
from ..profanity import contains_profanity
from ..services import display_name, ensure_member, friend_ids, iso, mini
from ..ws import hub

router = APIRouter(prefix="/api/chats", tags=["chats"])


def require_member(session: Session, chat_id: int, user_id: int) -> Chat:
    chat = session.get(Chat, chat_id)
    if not chat or not session.get(ChatMember, (chat_id, user_id)):
        raise HTTPException(404, "Chat not found.")
    return chat


def message_out(m: Message, author: User | None) -> dict:
    return {
        "id": m.id,
        "chat_id": m.chat_id,
        "user": mini(author) if author else {"id": None, "display_name": "Someone who left", "avatar": "👋|#C9B8A8"},
        "body": m.body,
        "created_at": iso(m.created_at),
    }


def chat_summary(session: Session, chat: Chat, me: User) -> dict:
    members = session.exec(select(User).where(
        User.id.in_(select(ChatMember.user_id).where(ChatMember.chat_id == chat.id)))).all()
    membership = session.get(ChatMember, (chat.id, me.id))
    last = session.exec(select(Message).where(Message.chat_id == chat.id).order_by(Message.id.desc())).first()
    unread = session.exec(select(func.count()).select_from(Message).where(
        Message.chat_id == chat.id, Message.id > (membership.last_read_id if membership else 0),
        Message.user_id != me.id)).one()
    activity = session.get(Activity, chat.activity_id) if chat.activity_id else None
    others = [u for u in members if u.id != me.id]
    if chat.kind == "dm":
        name = display_name(others[0]) if others else "Just you"
    elif chat.kind == "activity" and activity:
        name = activity.title
    else:
        name = chat.name or ", ".join(display_name(u).split(" ")[0] for u in others[:4])
    author = session.get(User, last.user_id) if last else None
    return {
        "id": chat.id,
        "kind": chat.kind,
        "name": name,
        "activity_id": chat.activity_id,
        "activity_starts_at": iso(activity.starts_at) if activity else None,
        "activity_cancelled": activity.cancelled if activity else False,
        "avatar_hobby_id": chat.hobby_id or (activity.hobby_id if activity else None),
        "last_message": message_out(last, author) if last else None,
        "unread": unread,
        "members": [mini(u) for u in members],
    }


@router.get("")
def list_chats(user: User = Depends(current_user), session: Session = Depends(get_session)):
    chats = session.exec(select(Chat).where(
        Chat.id.in_(select(ChatMember.chat_id).where(ChatMember.user_id == user.id)))).all()
    out = [chat_summary(session, c, user) for c in chats]
    out.sort(key=lambda c: (c["last_message"] or {}).get("created_at") or "", reverse=True)
    return out


@router.get("/{chat_id:int}")
def get_chat(chat_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return chat_summary(session, require_member(session, chat_id, user.id), user)


@router.get("/{chat_id:int}/messages")
def messages(chat_id: int, before: Optional[int] = None, limit: int = 50,
             user: User = Depends(current_user), session: Session = Depends(get_session)):
    require_member(session, chat_id, user.id)
    stmt = select(Message).where(Message.chat_id == chat_id)
    if before:
        stmt = stmt.where(Message.id < before)
    rows = list(reversed(session.exec(stmt.order_by(Message.id.desc()).limit(min(limit, 200))).all()))
    authors = {u.id: u for u in session.exec(select(User).where(User.id.in_({m.user_id for m in rows})))} if rows else {}
    if rows and not before:
        membership = session.get(ChatMember, (chat_id, user.id))
        membership.last_read_id = max(membership.last_read_id, rows[-1].id)
        session.add(membership)
        session.commit()
    return [message_out(m, authors.get(m.user_id)) for m in rows]


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/{chat_id:int}/messages")
async def post_message(chat_id: int, body: MessageIn, user: User = Depends(current_user),
                       session: Session = Depends(get_session)):
    chat = require_member(session, chat_id, user.id)
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Say something first.")
    if contains_profanity(text):
        raise HTTPException(422, "Let's keep it friendly. That message has words our filter blocks.")
    if chat.activity_id:
        a = session.get(Activity, chat.activity_id)
        if a and a.cancelled:
            raise HTTPException(422, "This activity was cancelled. You can still read the chat.")
    m = Message(chat_id=chat_id, user_id=user.id, body=text)
    session.add(m)
    membership = session.get(ChatMember, (chat_id, user.id))
    session.commit()
    session.refresh(m)
    membership.last_read_id = m.id
    session.add(membership)
    session.commit()
    out = message_out(m, user)
    members = [cm.user_id for cm in session.exec(select(ChatMember).where(ChatMember.chat_id == chat_id))]
    await hub.send_to(members, {"type": "message", "message": out})
    return out


@router.post("/{chat_id:int}/read")
def mark_read(chat_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    require_member(session, chat_id, user.id)
    last = session.exec(select(Message.id).where(Message.chat_id == chat_id).order_by(Message.id.desc())).first()
    membership = session.get(ChatMember, (chat_id, user.id))
    membership.last_read_id = last or 0
    session.add(membership)
    session.commit()
    return {"ok": True}


class GroupIn(BaseModel):
    member_ids: list[int]
    name: Optional[str] = Field(None, max_length=60)


def create_group(session: Session, me: User, member_ids: list[int], name: str | None,
                 hobby_id: str | None = None) -> Chat:
    chat = Chat(kind="group", name=name, hobby_id=hobby_id)
    session.add(chat)
    session.flush()
    for uid in {me.id, *member_ids}:
        ensure_member(session, chat.id, uid)
    session.commit()
    session.refresh(chat)
    return chat


@router.post("")
def new_group(body: GroupIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    others = set(body.member_ids) - {user.id}
    if len(others) < 2:
        raise HTTPException(422, "Pick at least two friends.")
    if not others <= friend_ids(session, user.id):
        raise HTTPException(403, "Add friends first: group chats are for friends.")
    chat = create_group(session, user, list(others), body.name)
    return chat_summary(session, chat, user)


@router.post("/dm/{user_id:int}")
def dm(user_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    other = session.get(User, user_id)
    if not other or other.id == user.id:
        raise HTTPException(404, "Nobody by that id.")
    mine = select(ChatMember.chat_id).where(ChatMember.user_id == user.id)
    theirs = select(ChatMember.chat_id).where(ChatMember.user_id == other.id)
    chat = session.exec(select(Chat).where(Chat.kind == "dm", Chat.id.in_(mine), Chat.id.in_(theirs))).first()
    if not chat:
        chat = Chat(kind="dm")
        session.add(chat)
        session.flush()
        ensure_member(session, chat.id, user.id)
        ensure_member(session, chat.id, other.id)
        session.commit()
        session.refresh(chat)
    return chat_summary(session, chat, user)
