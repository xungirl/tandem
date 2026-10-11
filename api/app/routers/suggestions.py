from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..grouping import WEEKDAYS, suggest_groups
from ..models import Message, User, UserHobby, utcnow
from ..scoring import friend_score
from ..services import (friend_statuses, hobby_list, iso, load_corpus, load_profiles, user_card)
from .chats import create_group

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])
SLOT_HOUR = {"morning": 10, "afternoon": 14, "evening": 19}  # Seattle local
UTC_OFFSET = 7


def next_occurrence(weekday: int, slot: str):
    """Next local (weekday, slot) start as naive UTC, at least 12h out."""
    now = utcnow()
    local = now - timedelta(hours=UTC_OFFSET)
    day = local.replace(hour=SLOT_HOUR[slot], minute=0, second=0, microsecond=0)
    day += timedelta(days=(weekday - local.weekday()) % 7)
    if day - local < timedelta(hours=12):
        day += timedelta(days=7)
    return day + timedelta(hours=UTC_OFFSET)


@router.get("")
def suggestions(user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not user.open_to_plans:
        return []
    people = session.exec(select(User).where(User.is_business == False, User.open_to_plans == True)).all()  # noqa: E712
    if user.id not in {u.id for u in people}:
        people.append(user)
    by_id = {u.id: u for u in people}
    profiles = load_profiles(session, people)
    open_h: dict[int, set[str]] = {}
    for uh in session.exec(select(UserHobby).where(UserHobby.open_to_plans == True)):  # noqa: E712
        if uh.user_id in by_id:
            open_h.setdefault(uh.user_id, set()).add(uh.hobby_id)
    corpus = load_corpus(session)
    me = profiles[user.id]
    raw = suggest_groups(me, [p for uid, p in profiles.items() if uid != user.id], open_h, corpus)
    statuses = friend_statuses(session, user.id)
    out = []
    for r in raw:
        members = [user_card(by_id[m], hobby_list(profiles[m]), friend_score(me, profiles[m], corpus),
                             statuses.get(m, "none")) for m in r["member_ids"]]
        out.append({**r, "weekday_name": WEEKDAYS[r["weekday"]], "members": members,
                    "next_date": iso(next_occurrence(r["weekday"], r["slot"]))})
    return out


class AcceptIn(BaseModel):
    hobby_id: str
    weekday: int = Field(ge=0, le=6)
    slot: str
    member_ids: list[int] = Field(min_length=1, max_length=8)


@router.post("/accept")
def accept(body: AcceptIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if body.slot not in SLOT_HOUR:
        raise HTTPException(422, "Unknown time slot.")
    members = session.exec(select(User).where(User.id.in_(body.member_ids))).all()
    if len(members) != len(set(body.member_ids)):
        raise HTTPException(404, "Someone in that group no longer exists.")
    names = load_corpus(session).hobby_names
    hobby = names.get(body.hobby_id, body.hobby_id)
    chat = create_group(session, user, [m.id for m in members], f"{hobby} crew", hobby_id=body.hobby_id)
    when = f"{WEEKDAYS[body.weekday]} {body.slot}"
    session.add(Message(chat_id=chat.id, user_id=user.id,
                        body=f"Hi! Tandem matched us: we're all into {hobby} and free {when}. Want to do something?"))
    session.commit()
    return {"chat_id": chat.id, "suggested_start": iso(next_occurrence(body.weekday, body.slot))}
