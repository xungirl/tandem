import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from .db import get_session
from .models import User

SECRET = os.environ.get("JWT_SECRET", "tandem-dev-secret-change-me-in-production-please")
ALGO = "HS256"
TTL = timedelta(days=30)


def make_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + TTL
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET, algorithm=ALGO)


def decode_token(token: str) -> int | None:
    try:
        return int(jwt.decode(token, SECRET, algorithms=[ALGO])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(request: Request, session: Session = Depends(get_session)) -> User:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401, "Not signed in")
    uid = decode_token(header[7:])
    user = session.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Session expired, sign in again")
    return user
