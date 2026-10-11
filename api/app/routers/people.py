from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..models import Activity, Participation, User, utcnow
from ..scoring import friend_score, haversine_km
from ..services import (activity_cards, badges_for, friend_statuses, hobby_list, load_corpus,
                        load_profiles, user_card)

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("")
def list_people(
    hobby: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    max_km: Optional[float] = None,
    q: Optional[str] = None,
    limit: int = 100,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    people = session.exec(select(User).where(User.is_business == False)).all()  # noqa: E712
    profiles = load_profiles(session, people)
    corpus = load_corpus(session)
    me = profiles.get(user.id) or load_profiles(session, [user])[user.id]
    statuses = friend_statuses(session, user.id)
    out = []
    for u in people:
        if u.id == user.id or not u.first_name:
            continue
        p = profiles[u.id]
        if hobby and hobby not in p.hobbies:
            continue
        if age_min and (p.age is None or p.age < age_min):
            continue
        if age_max and (p.age is None or p.age > age_max):
            continue
        if q and q.lower() not in u.first_name.lower():
            continue
        if max_km and None not in (me.lat, me.lng, p.lat, p.lng) and \
                haversine_km(me.lat, me.lng, p.lat, p.lng) > max_km:
            continue
        s = friend_score(me, p, corpus)
        out.append(user_card(u, hobby_list(p), s, statuses.get(u.id, "none")))
    out.sort(key=lambda c: (-c["score"], c["id"]))
    return out[:limit]


@router.get("/{user_id:int}")
def person(user_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    other = session.get(User, user_id)
    if not other:
        raise HTTPException(404, "Nobody by that id.")
    profiles = load_profiles(session, [user, other])
    status = "self" if other.id == user.id else friend_statuses(session, user.id).get(other.id, "none")
    s = friend_score(profiles[user.id], profiles[other.id], load_corpus(session)) if other.id != user.id else None
    now = utcnow()
    hosting = session.exec(select(Activity).where(Activity.host_id == other.id, Activity.starts_at > now,
                                                  Activity.cancelled == False)).all()  # noqa: E712
    going = session.exec(select(Activity).where(
        Participation.activity_id == Activity.id, Participation.user_id == other.id,
        Participation.status == "going", Activity.starts_at > now, Activity.cancelled == False)).all()  # noqa: E712
    acts = sorted({a.id: a for a in [*hosting, *going]}.values(), key=lambda a: a.starts_at)[:10]
    card = user_card(other, hobby_list(profiles[other.id]), s, status)
    return {
        **card,
        "languages": other.languages or [],
        "instagram": other.instagram if status in ("friends", "self") else None,
        "badges": badges_for(session, other.id),
        "breakdown": s["breakdown"] if s else [],
        "shared_hobbies": s["shared_hobbies"] if s else [],
        "vibe": other.vibe,
        "upcoming_activities": activity_cards(session, user, acts),
    }
