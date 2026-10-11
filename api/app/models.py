from datetime import datetime, timezone

from pydantic import NaiveDatetime
from typing import Optional

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Hobby(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    emoji: str
    category: str
    color: str


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    first_name: str = ""
    last_name: str = ""
    birth_year: Optional[int] = None
    neighborhood: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    bio: str = ""
    languages: list = Field(default_factory=list, sa_column=Column(JSON))
    instagram: Optional[str] = None
    avatar: str = "🙂|#FFC94A"
    friend_code: str = Field(index=True, unique=True)
    open_to_plans: bool = True
    vibe: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    is_business: bool = False
    business_name: Optional[str] = None
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class UserHobby(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    hobby_id: str = Field(foreign_key="hobby.id", primary_key=True)
    level: int = 2
    years: Optional[float] = None
    open_to_plans: bool = True


class Availability(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    weekday: int = Field(primary_key=True)
    slot: str = Field(primary_key=True)


class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    host_id: int = Field(foreign_key="user.id", index=True)
    hobby_id: str = Field(foreign_key="hobby.id", index=True)
    title: str
    description: str = ""
    starts_at: NaiveDatetime = Field(index=True)
    ends_at: NaiveDatetime
    venue_name: str = ""
    neighborhood: str = ""
    lat: float
    lng: float
    location_privacy: str = "exact"
    capacity: Optional[int] = None
    cost_cents: int = 0
    level: str = "any"
    requires_approval: bool = False
    recurring_weekly: bool = False
    cancelled: bool = False
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class Participation(SQLModel, table=True):
    activity_id: int = Field(foreign_key="activity.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    status: str = "going"
    checked_in: bool = False
    rating: Optional[int] = None
    note: Optional[str] = None
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class Friendship(SQLModel, table=True):
    """Stored once per pair with user_a < user_b."""
    __table_args__ = (UniqueConstraint("user_a", "user_b"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_a: int = Field(foreign_key="user.id", index=True)
    user_b: int = Field(foreign_key="user.id", index=True)
    status: str = "pending"
    requested_by: int
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class Chat(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str  # activity | group | dm
    activity_id: Optional[int] = Field(default=None, foreign_key="activity.id", index=True)
    name: Optional[str] = None
    hobby_id: Optional[str] = None
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class ChatMember(SQLModel, table=True):
    chat_id: int = Field(foreign_key="chat.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    last_read_id: int = 0


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chat.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    body: str
    created_at: NaiveDatetime = Field(default_factory=utcnow)


class LoginCode(SQLModel, table=True):
    email: str = Field(primary_key=True)
    code: str
    expires_at: NaiveDatetime
