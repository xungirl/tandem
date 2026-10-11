import os
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..auth import current_user
from ..db import get_session
from ..models import Activity, Chat, Hobby, Participation, User, utcnow
from ..scoring import friend_score
from ..services import (activity_cards, activity_chat, age_of, day_window, ensure_member, load_corpus,
                        load_profiles, mini, remove_member)

router = APIRouter(prefix="/api/activities", tags=["activities"])
DEV = os.environ.get("TANDEM_ENV", "dev") != "prod"
CHECKIN_BEFORE = timedelta(minutes=30)
CHECKIN_AFTER = timedelta(hours=2)


def naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        dt = (dt - dt.utcoffset()).replace(tzinfo=None)
    return dt


def get_activity(session: Session, activity_id: int) -> Activity:
    a = session.get(Activity, activity_id)
    if not a:
        raise HTTPException(404, "That activity doesn't exist.")
    return a


def my_part(session: Session, activity_id: int, user_id: int) -> Participation | None:
    return session.get(Participation, (activity_id, user_id))


def going_count(session: Session, a: Activity) -> int:
    rows = session.exec(select(Participation).where(Participation.activity_id == a.id,
                                                    Participation.status == "going")).all()
    return len(rows) + 1


@router.get("")
def list_activities(
    hobby: Optional[str] = None,
    day: Optional[Literal["today", "week", "weekend"]] = None,
    q: Optional[str] = None,
    mine: Optional[Literal["hosting", "going", "past"]] = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    now = utcnow()
    stmt = select(Activity)
    if mine == "past":
        attended = select(Participation.activity_id).where(Participation.user_id == user.id,
                                                           Participation.status == "going")
        stmt = stmt.where(Activity.ends_at < now, Activity.cancelled == False,  # noqa: E712
                          (Activity.host_id == user.id) | Activity.id.in_(attended)) \
            .order_by(Activity.starts_at.desc())
    else:
        start, end = day_window(day, now)
        # Include activities happening right now.
        stmt = stmt.where(Activity.ends_at > now, Activity.starts_at < end,
                          Activity.starts_at >= start - timedelta(hours=6)).order_by(Activity.starts_at)
        if mine == "hosting":
            stmt = stmt.where(Activity.host_id == user.id)
        elif mine == "going":
            mine_ids = select(Participation.activity_id).where(
                Participation.user_id == user.id, Participation.status.in_(["going", "requested", "waitlist"]))
            stmt = stmt.where(Activity.id.in_(mine_ids) | (Activity.host_id == user.id))
        else:
            stmt = stmt.where(Activity.cancelled == False)  # noqa: E712
    if hobby:
        stmt = stmt.where(Activity.hobby_id == hobby)
    acts = session.exec(stmt).all()
    if q:
        ql = q.lower()
        names = {h.id: h.name.lower() for h in session.exec(select(Hobby))}
        acts = [a for a in acts if ql in a.title.lower() or ql in a.neighborhood.lower()
                or ql in names.get(a.hobby_id, "") or ql in a.venue_name.lower()]
    return activity_cards(session, user, acts)


def detail(session: Session, user: User, a: Activity) -> dict:
    card = activity_cards(session, user, [a])[0]
    parts = session.exec(select(Participation).where(Participation.activity_id == a.id)).all()
    ids = [p.user_id for p in parts] + [a.host_id]
    users = {u.id: u for u in session.exec(select(User).where(User.id.in_(ids)))}
    profiles = load_profiles(session, [user, *users.values()])
    corpus = load_corpus(session)
    is_host = a.host_id == user.id

    def lite(u: User) -> dict:
        s = friend_score(profiles[user.id], profiles[u.id], corpus)["score"] if u.id != user.id and not u.is_business else None
        return {**mini(u), "age": age_of(u), "neighborhood": u.neighborhood, "score": s, "is_business": u.is_business}

    going = [p for p in parts if p.status == "going"]
    attendees = [{**lite(users[a.host_id]), "is_host": True}] + \
        sorted(({**lite(users[p.user_id]), "is_host": False, "checked_in": p.checked_in} for p in going),
               key=lambda x: -(x["score"] or 0))
    mine = next((p for p in parts if p.user_id == user.id), None)
    ratings = [p.rating for p in parts if p.rating]
    chat = activity_chat(session, a.id)
    can_chat = is_host or (mine is not None and mine.status == "going")
    now = utcnow()
    return {
        **card,
        "description": a.description,
        "location_privacy": a.location_privacy,
        "requires_approval": a.requires_approval,
        "attendees": attendees,
        "waitlist_count": sum(1 for p in parts if p.status == "waitlist"),
        "requests": [{**lite(users[p.user_id]), "note": p.note} for p in parts if p.status == "requested"] if is_host else [],
        "chat_id": chat.id if chat and can_chat else None,
        "is_past": a.ends_at < now,
        "can_check_in": bool(mine and mine.status == "going" and not mine.checked_in and checkin_open(a, now)),
        "checked_in": bool(mine and mine.checked_in),
        "my_rating": mine.rating if mine else None,
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "rating_count": len(ratings),
    }


def checkin_open(a: Activity, now: datetime) -> bool:
    if now < a.starts_at - CHECKIN_BEFORE:
        return False
    return DEV or now <= a.ends_at + CHECKIN_AFTER


@router.get("/{activity_id:int}")
def get_one(activity_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return detail(session, user, get_activity(session, activity_id))


class ActivityIn(BaseModel):
    hobby_id: str
    title: str = Field(min_length=3, max_length=80)
    description: str = Field("", max_length=1500)
    starts_at: datetime
    ends_at: datetime
    venue_name: str = Field("", max_length=80)
    neighborhood: str = Field("", max_length=60)
    lat: float = Field(ge=47.3, le=47.9)
    lng: float = Field(ge=-122.6, le=-122.0)
    location_privacy: Literal["exact", "area"] = "exact"
    capacity: Optional[int] = Field(None, ge=2, le=500)
    cost_cents: int = Field(0, ge=0, le=100_000)
    level: Literal["any", "beginner", "intermediate", "advanced"] = "any"
    requires_approval: bool = False
    recurring_weekly: bool = False


def validate_times(starts: datetime, ends: datetime):
    if ends <= starts:
        raise HTTPException(422, "End time must be after the start.")
    if ends - starts > timedelta(hours=24):
        raise HTTPException(422, "Activities can be at most 24 hours long.")


@router.post("")
def create(body: ActivityIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not session.get(Hobby, body.hobby_id):
        raise HTTPException(422, "Pick a hobby for the activity.")
    data = body.model_dump()
    data["starts_at"], data["ends_at"] = naive_utc(body.starts_at), naive_utc(body.ends_at)
    validate_times(data["starts_at"], data["ends_at"])
    if data["starts_at"] < utcnow() - timedelta(minutes=5):
        raise HTTPException(422, "Pick a time in the future.")
    if data["location_privacy"] == "area":
        data["requires_approval"] = True  # address is only shared with approved people
    a = Activity(host_id=user.id, **data)
    session.add(a)
    session.flush()
    chat = Chat(kind="activity", activity_id=a.id, name=a.title, hobby_id=a.hobby_id)
    session.add(chat)
    session.flush()
    ensure_member(session, chat.id, user.id)
    session.commit()
    session.refresh(a)
    return detail(session, user, a)


class ActivityPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=80)
    description: Optional[str] = Field(None, max_length=1500)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    venue_name: Optional[str] = None
    neighborhood: Optional[str] = None
    lat: Optional[float] = Field(None, ge=47.3, le=47.9)
    lng: Optional[float] = Field(None, ge=-122.6, le=-122.0)
    capacity: Optional[int] = Field(None, ge=2, le=500)
    cost_cents: Optional[int] = Field(None, ge=0)
    level: Optional[Literal["any", "beginner", "intermediate", "advanced"]] = None


@router.patch("/{activity_id:int}")
def update(activity_id: int, body: ActivityPatch, user: User = Depends(current_user),
           session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    if a.host_id != user.id:
        raise HTTPException(403, "Only the host can edit this.")
    for k, v in body.model_dump(exclude_unset=True).items():
        if k in ("starts_at", "ends_at") and v is not None:
            v = naive_utc(v)
        setattr(a, k, v)
    validate_times(a.starts_at, a.ends_at)
    session.add(a)
    chat = activity_chat(session, a.id)
    if chat and body.title:
        chat.name = body.title
        session.add(chat)
    session.commit()
    return detail(session, user, a)


@router.post("/{activity_id:int}/cancel")
def cancel(activity_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    if a.host_id != user.id:
        raise HTTPException(403, "Only the host can cancel this.")
    a.cancelled = True
    session.add(a)
    session.commit()
    return detail(session, user, a)


class JoinIn(BaseModel):
    note: Optional[str] = Field(None, max_length=300)


@router.post("/{activity_id:int}/join")
def join(activity_id: int, body: JoinIn | None = None, user: User = Depends(current_user),
         session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    if a.host_id == user.id:
        raise HTTPException(422, "You're hosting this one.")
    if a.cancelled:
        raise HTTPException(422, "The host cancelled this activity.")
    if a.ends_at < utcnow():
        raise HTTPException(422, "This activity is over.")
    p = my_part(session, a.id, user.id)
    if p and p.status in ("going", "requested", "waitlist"):
        return detail(session, user, a)
    if p and p.status == "declined":
        raise HTTPException(403, "The host didn't approve this request.")
    full = a.capacity is not None and going_count(session, a) >= a.capacity
    status = "waitlist" if full else ("requested" if a.requires_approval else "going")
    p = Participation(activity_id=a.id, user_id=user.id, status=status, note=body.note if body else None)
    session.add(p)
    if status == "going":
        chat = activity_chat(session, a.id)
        if chat:
            ensure_member(session, chat.id, user.id)
    session.commit()
    return detail(session, user, a)


@router.post("/{activity_id:int}/leave")
def leave(activity_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    p = my_part(session, a.id, user.id)
    if not p:
        return detail(session, user, a)
    was_going = p.status == "going"
    session.delete(p)
    chat = activity_chat(session, a.id)
    if chat:
        remove_member(session, chat.id, user.id)
    session.flush()
    if was_going:
        nxt = session.exec(select(Participation).where(
            Participation.activity_id == a.id, Participation.status == "waitlist")
            .order_by(Participation.created_at)).first()
        if nxt:
            nxt.status = "requested" if a.requires_approval else "going"
            session.add(nxt)
            if chat and nxt.status == "going":
                ensure_member(session, chat.id, nxt.user_id)
    session.commit()
    return detail(session, user, a)


class DecisionIn(BaseModel):
    approve: bool


@router.post("/{activity_id:int}/requests/{user_id:int}")
def decide(activity_id: int, user_id: int, body: DecisionIn, user: User = Depends(current_user),
           session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    if a.host_id != user.id:
        raise HTTPException(403, "Only the host can approve requests.")
    p = my_part(session, a.id, user_id)
    if not p or p.status not in ("requested", "waitlist"):
        raise HTTPException(404, "No request from that person.")
    if body.approve:
        full = a.capacity is not None and going_count(session, a) >= a.capacity
        p.status = "waitlist" if full else "going"
        if p.status == "going":
            chat = activity_chat(session, a.id)
            if chat:
                ensure_member(session, chat.id, user_id)
    else:
        p.status = "declined"
    session.add(p)
    session.commit()
    return detail(session, user, a)


@router.post("/{activity_id:int}/checkin")
def checkin(activity_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    p = my_part(session, a.id, user.id)
    if not p or p.status != "going":
        raise HTTPException(422, "Join the activity first.")
    if not checkin_open(a, utcnow()):
        raise HTTPException(422, "Check-in opens 30 minutes before it starts.")
    p.checked_in = True
    session.add(p)
    session.commit()
    return detail(session, user, a)


class RateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    note: Optional[str] = Field(None, max_length=500)


@router.post("/{activity_id:int}/rate")
def rate(activity_id: int, body: RateIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    a = get_activity(session, activity_id)
    p = my_part(session, a.id, user.id)
    if not p or not p.checked_in:
        raise HTTPException(422, "Rate only activities you actually went to.")
    if a.ends_at > utcnow():
        raise HTTPException(422, "You can rate it once it's over.")
    p.rating, p.note = body.rating, body.note
    session.add(p)
    session.commit()
    return detail(session, user, a)
