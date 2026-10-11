from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, delete, select

from ..auth import current_user
from ..data.neighborhoods import NEIGHBORHOODS
from ..data.vibe import TRAIT_LABELS, TRAITS, VIBE_QUESTIONS
from ..db import get_session
from ..hobby_parser import parse_hobbies
from ..models import Activity, Availability, Hobby, Participation, User, UserHobby, utcnow
from ..services import age_of, badges_for, display_name, friend_ids, hobby_names, slots_of

router = APIRouter(prefix="/api", tags=["me"])
SLOTS = {"morning", "afternoon", "evening"}
NBHD = {n: (lat, lng) for n, lat, lng in NEIGHBORHOODS}


def me_payload(session: Session, u: User) -> dict:
    hobbies = session.exec(select(UserHobby).where(UserHobby.user_id == u.id)).all()
    now = utcnow()
    attended = session.exec(select(Participation, Activity).where(
        Participation.activity_id == Activity.id, Participation.user_id == u.id,
        Participation.checked_in == True)).all()  # noqa: E712
    hosted = session.exec(select(Activity).where(Activity.host_id == u.id, Activity.ends_at < now,
                                                 Activity.cancelled == False)).all()  # noqa: E712
    return {
        "id": u.id,
        "email": u.email,
        "display_name": display_name(u),
        "first_name": u.first_name,
        "last_name": u.last_name,
        "birth_year": u.birth_year,
        "age": age_of(u),
        "neighborhood": u.neighborhood,
        "lat": u.lat,
        "lng": u.lng,
        "bio": u.bio,
        "languages": u.languages or [],
        "instagram": u.instagram,
        "avatar": u.avatar,
        "friend_code": u.friend_code,
        "open_to_plans": u.open_to_plans,
        "vibe": u.vibe,
        "vibe_summary": vibe_summary(u.vibe),
        "is_business": u.is_business,
        "business_name": u.business_name,
        "hobbies": [{"hobby_id": h.hobby_id, "level": h.level, "years": h.years,
                     "open_to_plans": h.open_to_plans} for h in sorted(hobbies, key=lambda h: -h.level)],
        "availability": [{"weekday": w, "slot": s} for w, s in sorted(slots_of(session, u.id))],
        "badges": badges_for(session, u.id),
        "stats": {"attended": len(attended), "hosted": len(hosted), "friends": len(friend_ids(session, u.id))},
        "onboarded": bool(u.first_name and u.birth_year and u.neighborhood and hobbies),
    }


def vibe_summary(vibe: dict | None) -> list[str]:
    if not vibe:
        return []
    top = sorted(vibe.items(), key=lambda kv: -abs(kv[1]))[:3]
    return [TRAIT_LABELS[k][0 if v >= 0 else 1] for k, v in top if abs(v) >= 0.15 and k in TRAIT_LABELS]


@router.get("/me")
def get_me(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return me_payload(session, user)


class MePatch(BaseModel):
    first_name: Optional[str] = Field(None, max_length=40)
    last_name: Optional[str] = Field(None, max_length=40)
    birth_year: Optional[int] = None
    neighborhood: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=300)
    languages: Optional[list[str]] = None
    instagram: Optional[str] = Field(None, max_length=40)
    avatar: Optional[str] = Field(None, max_length=500)
    open_to_plans: Optional[bool] = None


@router.patch("/me")
def patch_me(body: MePatch, user: User = Depends(current_user), session: Session = Depends(get_session)):
    data = body.model_dump(exclude_unset=True)
    if "birth_year" in data and data["birth_year"] is not None:
        age = utcnow().year - data["birth_year"]
        if age < 18:
            raise HTTPException(422, "Tandem is for people 18 and over.")
        if age > 110:
            raise HTTPException(422, "Check your birth year.")
    if "neighborhood" in data and data["neighborhood"] is not None:
        if data["neighborhood"] not in NBHD:
            raise HTTPException(422, "Pick a Seattle neighborhood from the list.")
        user.lat, user.lng = NBHD[data["neighborhood"]]
    if data.get("instagram"):
        data["instagram"] = data["instagram"].lstrip("@")
    for k, v in data.items():
        setattr(user, k, v)
    session.add(user)
    session.commit()
    session.refresh(user)
    return me_payload(session, user)


class HobbyIn(BaseModel):
    hobby_id: str
    level: int = Field(2, ge=1, le=4)
    years: Optional[float] = None
    open_to_plans: bool = True


@router.put("/me/hobbies")
def put_hobbies(body: list[HobbyIn], user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not body:
        raise HTTPException(422, "Keep at least one hobby.")
    known = {h.id for h in session.exec(select(Hobby))}
    seen = set()
    session.exec(delete(UserHobby).where(UserHobby.user_id == user.id))
    for h in body:
        if h.hobby_id not in known:
            raise HTTPException(422, f"Unknown hobby {h.hobby_id}")
        if h.hobby_id in seen:
            continue
        seen.add(h.hobby_id)
        session.add(UserHobby(user_id=user.id, **h.model_dump()))
    session.commit()
    return me_payload(session, user)


class SlotIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    slot: str


@router.put("/me/availability")
def put_availability(body: list[SlotIn], user: User = Depends(current_user), session: Session = Depends(get_session)):
    session.exec(delete(Availability).where(Availability.user_id == user.id))
    for s in {(x.weekday, x.slot) for x in body}:
        if s[1] not in SLOTS:
            raise HTTPException(422, f"Slot must be one of {sorted(SLOTS)}")
        session.add(Availability(user_id=user.id, weekday=s[0], slot=s[1]))
    session.commit()
    return me_payload(session, user)


class Answer(BaseModel):
    question_id: str
    option_id: str


class VibeIn(BaseModel):
    answers: list[Answer]


def compute_vibe(answers: list[tuple[str, str]]) -> dict[str, float]:
    by_id = {q["id"]: q for q in VIBE_QUESTIONS}
    totals = {t: 0.0 for t in TRAITS}
    counts = {t: 0 for t in TRAITS}
    for qid, oid in answers:
        q = by_id.get(qid)
        opt = next((o for o in q["options"] if o["id"] == oid), None) if q else None
        if not opt:
            continue
        # Each answered question counts for every trait, so unmentioned traits pull toward 0.
        for t in TRAITS:
            totals[t] += opt["fx"].get(t, 0.0)
            counts[t] += 1
    return {t: round(max(-1.0, min(1.0, totals[t] / counts[t] * 2)), 3) if counts[t] else 0.0 for t in TRAITS}


@router.put("/me/vibe")
def put_vibe(body: VibeIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not body.answers:
        raise HTTPException(422, "Answer at least one question.")
    vibe = compute_vibe([(a.question_id, a.option_id) for a in body.answers])
    user.vibe = vibe
    session.add(user)
    session.commit()
    return {"vibe": vibe, "summary": vibe_summary(vibe)}


class ParseIn(BaseModel):
    text: str = Field(max_length=2000)


@router.post("/me/parse-hobbies")
def parse(body: ParseIn, user: User = Depends(current_user), session: Session = Depends(get_session)):
    hobbies, used_ai = parse_hobbies(body.text, hobby_names(session))
    return {"hobbies": hobbies, "used_ai": used_ai}


@router.get("/badges")
def badges(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return badges_for(session, user.id)
