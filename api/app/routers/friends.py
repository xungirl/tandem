from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..models import Friendship, User
from ..scoring import friend_score
from ..services import (friend_statuses, get_friendship, hobby_list, load_corpus, load_profiles, pair,
                        user_card)

router = APIRouter(prefix="/api/friends", tags=["friends"])


@router.get("")
def list_friends(user: User = Depends(current_user), session: Session = Depends(get_session)):
    statuses = friend_statuses(session, user.id)
    others = session.exec(select(User).where(User.id.in_(list(statuses)))).all() if statuses else []
    profiles = load_profiles(session, [user, *others])
    corpus = load_corpus(session)
    buckets = {"friends": [], "incoming": [], "outgoing": []}
    key = {"friends": "friends", "pending_in": "incoming", "pending_out": "outgoing"}
    for o in others:
        st = statuses[o.id]
        s = friend_score(profiles[user.id], profiles[o.id], corpus)
        buckets[key[st]].append(user_card(o, hobby_list(profiles[o.id]), s, st))
    for v in buckets.values():
        v.sort(key=lambda c: -c["score"])
    return buckets


def _add(session: Session, me: User, other: User, auto_accept: bool = False) -> str:
    if other.id == me.id:
        raise HTTPException(422, "That's you!")
    f = get_friendship(session, me.id, other.id)
    if f is None:
        a, b = pair(me.id, other.id)
        f = Friendship(user_a=a, user_b=b, requested_by=me.id, status="accepted" if auto_accept else "pending")
    elif f.status == "pending" and (f.requested_by != me.id or auto_accept):
        f.status = "accepted"
    session.add(f)
    session.commit()
    return friend_statuses(session, me.id).get(other.id, "none")


@router.post("/{user_id:int}")
def add_friend(user_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    other = session.get(User, user_id)
    if not other:
        raise HTTPException(404, "Nobody by that id.")
    return {"friend_status": _add(session, user, other)}


@router.delete("/{user_id:int}")
def remove_friend(user_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    f = get_friendship(session, user.id, user_id)
    if f:
        session.delete(f)
        session.commit()
    return {"friend_status": "none"}


class CodeIn(BaseModel):
    code: str


@router.post("/code")
def add_by_code(body: CodeIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    other = session.exec(select(User).where(User.friend_code == body.code.strip().upper())).first()
    if not other:
        raise HTTPException(404, "No one has that code.")
    status = _add(session, user, other, auto_accept=True)
    profiles = load_profiles(session, [user, other])
    s = friend_score(profiles[user.id], profiles[other.id], load_corpus(session))
    return user_card(other, hobby_list(profiles[other.id]), s, status)
