import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..auth import current_user
from ..data.hobbies import CATEGORY_COLORS
from ..data.neighborhoods import NEIGHBORHOODS
from ..data.vibe import VIBE_QUESTIONS
from ..db import get_session
from ..models import Hobby, User

router = APIRouter(prefix="/api", tags=["reference"])


@router.get("/hobbies")
def list_hobbies(q: Optional[str] = None, session: Session = Depends(get_session)):
    rows = session.exec(select(Hobby).order_by(Hobby.category, Hobby.name)).all()
    if q:
        ql = q.lower().strip()
        rows = [h for h in rows if ql in h.name.lower() or ql in h.id]
        rows.sort(key=lambda h: (not h.name.lower().startswith(ql), h.name))
    return rows


class HobbyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    emoji: Optional[str] = Field(None, max_length=8)


@router.post("/hobbies")
def create_hobby(body: HobbyCreate, user: User = Depends(current_user), session: Session = Depends(get_session)):
    name = body.name.strip()
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise HTTPException(422, "Give the hobby a name with letters in it.")
    existing = session.get(Hobby, slug) or session.exec(select(Hobby).where(Hobby.name == name)).first()
    if existing:
        return existing
    hobby = Hobby(id=slug, name=name[:1].upper() + name[1:], emoji=body.emoji or "✨",
                  category="Custom", color=CATEGORY_COLORS["Custom"])
    session.add(hobby)
    session.commit()
    session.refresh(hobby)
    return hobby


@router.get("/neighborhoods")
def neighborhoods():
    return [{"name": n, "lat": lat, "lng": lng} for n, lat, lng in sorted(NEIGHBORHOODS)]


@router.get("/vibe-questions")
def vibe_questions():
    return [
        {"id": q["id"], "hobby_id": q["hobby_id"], "prompt": q["prompt"],
         "options": [{"id": o["id"], "text": o["text"]} for o in q["options"]]}
        for q in VIBE_QUESTIONS
    ]
