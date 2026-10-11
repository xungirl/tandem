import os
import random
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ..auth import make_token
from ..db import get_session
from ..models import LoginCode, User, utcnow
from .me import me_payload

router = APIRouter(prefix="/api/auth", tags=["auth"])
DEV = os.environ.get("TANDEM_ENV", "dev") != "prod"
DEMO_EMAIL = "maya@demo.tandem.app"
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class EmailIn(BaseModel):
    email: EmailStr


class VerifyIn(BaseModel):
    email: EmailStr
    code: str


def new_friend_code(session: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not session.exec(select(User).where(User.friend_code == code)).first():
            return code


@router.post("/request-code")
def request_code(body: EmailIn, session: Session = Depends(get_session)):
    email = body.email.lower()
    code = f"{random.randint(0, 999999):06d}"
    row = session.get(LoginCode, email) or LoginCode(email=email, code=code, expires_at=utcnow())
    row.code, row.expires_at = code, utcnow() + timedelta(minutes=10)
    session.add(row)
    session.commit()
    # Real deployment would email the code; in dev/demo we hand it back.
    return {"sent": True, "dev_code": code if DEV else None}


@router.post("/verify")
def verify(body: VerifyIn, session: Session = Depends(get_session)):
    email = body.email.lower()
    row = session.get(LoginCode, email)
    if not row or row.code != body.code.strip() or row.expires_at < utcnow():
        raise HTTPException(400, "That code didn't work. Check it and try again.")
    session.delete(row)
    user = session.exec(select(User).where(User.email == email)).first()
    is_new = user is None
    if is_new:
        user = User(email=email, friend_code=new_friend_code(session))
        session.add(user)
    session.commit()
    session.refresh(user)
    return {"token": make_token(user.id), "user": me_payload(session, user), "is_new": is_new}


@router.post("/demo")
def demo(session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == DEMO_EMAIL)).first()
    if not user:
        raise HTTPException(503, "Demo account not seeded")
    return {"token": make_token(user.id), "user": me_payload(session, user)}
