"""Shared query + serialization helpers used across routers."""

from __future__ import annotations

import math
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlmodel import Session, select

from .models import (Activity, Availability, Chat, ChatMember, Friendship, Hobby, Participation,
                     User, UserHobby, utcnow)
from .scoring import Corpus, Profile, age_from_birth_year

TIERS = [("Bronze", 1), ("Silver", 3), ("Gold", 10), ("Platinum", 25), ("Legendary", 50)]


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def this_year() -> int:
    return utcnow().year


def age_of(u: User) -> int | None:
    return age_from_birth_year(u.birth_year, this_year())


def display_name(u: User) -> str:
    if u.is_business and u.business_name:
        return u.business_name
    initial = f" {u.last_name[0].upper()}." if u.last_name else ""
    return f"{u.first_name}{initial}".strip() or "New member"


def mini(u: User) -> dict:
    return {"id": u.id, "display_name": display_name(u), "avatar": u.avatar}


# ---------- hobbies / profiles ----------

def hobbies_of(session: Session, user_id: int) -> list[UserHobby]:
    return list(session.exec(select(UserHobby).where(UserHobby.user_id == user_id)))


def slots_of(session: Session, user_id: int) -> set[tuple[int, str]]:
    rows = session.exec(select(Availability).where(Availability.user_id == user_id))
    return {(r.weekday, r.slot) for r in rows}


def hobby_names(session: Session) -> dict[str, str]:
    return {h.id: h.name for h in session.exec(select(Hobby))}


def load_corpus(session: Session) -> Corpus:
    people_ids = {u.id for u in session.exec(select(User).where(User.is_business == False))}  # noqa: E712
    counts = Counter(uh.hobby_id for uh in session.exec(select(UserHobby)) if uh.user_id in people_ids)
    return Corpus(n_users=len(people_ids), hobby_counts=dict(counts), hobby_names=hobby_names(session))


def load_profiles(session: Session, users: list[User]) -> dict[int, Profile]:
    ids = {u.id for u in users}
    hobbies: dict[int, dict[str, int]] = defaultdict(dict)
    for uh in session.exec(select(UserHobby)):
        if uh.user_id in ids:
            hobbies[uh.user_id][uh.hobby_id] = uh.level
    slots: dict[int, set] = defaultdict(set)
    for a in session.exec(select(Availability)):
        if a.user_id in ids:
            slots[a.user_id].add((a.weekday, a.slot))
    return {
        u.id: Profile(id=u.id, hobbies=hobbies[u.id], slots=slots[u.id], lat=u.lat, lng=u.lng,
                      age=age_of(u), vibe=u.vibe)
        for u in users
    }


def profile_of(session: Session, u: User) -> Profile:
    return load_profiles(session, [u])[u.id]


# ---------- friends ----------

def pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def get_friendship(session: Session, a: int, b: int) -> Friendship | None:
    x, y = pair(a, b)
    return session.exec(select(Friendship).where(Friendship.user_a == x, Friendship.user_b == y)).first()


def friend_statuses(session: Session, me_id: int) -> dict[int, str]:
    out = {}
    rows = session.exec(select(Friendship).where((Friendship.user_a == me_id) | (Friendship.user_b == me_id)))
    for f in rows:
        other = f.user_b if f.user_a == me_id else f.user_a
        if f.status == "accepted":
            out[other] = "friends"
        else:
            out[other] = "pending_out" if f.requested_by == me_id else "pending_in"
    return out


def friend_ids(session: Session, me_id: int) -> set[int]:
    return {k for k, v in friend_statuses(session, me_id).items() if v == "friends"}


# ---------- user cards ----------

def user_card(u: User, hobbies: list[dict], score: dict | None, fstatus: str) -> dict:
    return {
        "id": u.id,
        "display_name": display_name(u),
        "age": age_of(u),
        "neighborhood": u.neighborhood,
        "avatar": u.avatar,
        "bio": u.bio,
        "is_business": u.is_business,
        "hobbies": hobbies,
        "score": score["score"] if score else None,
        "top_reason": score["top_reason"] if score else None,
        "friend_status": fstatus,
    }


def hobby_list(p: Profile) -> list[dict]:
    return [{"hobby_id": h, "level": lvl} for h, lvl in sorted(p.hobbies.items(), key=lambda kv: -kv[1])]


# ---------- badges ----------

def tier_for(count: int) -> tuple[str | None, str | None, int | None]:
    tier = None
    for name, at in TIERS:
        if count >= at:
            tier = name
    nxt = next(((n, at) for n, at in TIERS if count < at), (None, None))
    return tier, nxt[0], nxt[1]


def badges_for(session: Session, user_id: int) -> list[dict]:
    now = utcnow()
    counts: Counter = Counter()
    rows = session.exec(
        select(Participation, Activity).where(
            Participation.activity_id == Activity.id,
            Participation.user_id == user_id,
            Participation.checked_in == True,  # noqa: E712
            Activity.cancelled == False,  # noqa: E712
        )
    )
    for _, a in rows:
        counts[a.hobby_id] += 1
    hosted = session.exec(select(Activity).where(
        Activity.host_id == user_id, Activity.cancelled == False, Activity.ends_at < now)).all()  # noqa: E712
    if hosted:
        counts["_host"] = len(hosted)
    out = []
    for hobby_id, c in counts.most_common():
        tier, next_tier, next_at = tier_for(c)
        out.append({"hobby_id": hobby_id, "tier": tier, "count": c, "next_tier": next_tier, "next_at": next_at})
    return out


# ---------- activities ----------

def jitter(activity_id: int, lat: float, lng: float, meters: float = 400) -> tuple[float, float]:
    rng = random.Random(activity_id * 7919)
    ang = rng.uniform(0, 2 * math.pi)
    d = rng.uniform(0.5, 1.0) * meters
    dlat = d * math.cos(ang) / 111_320
    dlng = d * math.sin(ang) / (111_320 * math.cos(math.radians(lat)))
    return round(lat + dlat, 5), round(lng + dlng, 5)


def participations(session: Session, activity_ids: list[int]) -> dict[int, list[Participation]]:
    out: dict[int, list[Participation]] = defaultdict(list)
    if not activity_ids:
        return out
    for p in session.exec(select(Participation).where(Participation.activity_id.in_(activity_ids))):
        out[p.activity_id].append(p)
    return out


def activity_cards(session: Session, viewer: User, acts: list[Activity]) -> list[dict]:
    parts = participations(session, [a.id for a in acts])
    friends = friend_ids(session, viewer.id)
    user_ids = {a.host_id for a in acts} | {p.user_id for ps in parts.values() for p in ps}
    users = {u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids)))} if user_ids else {}
    out = []
    for a in acts:
        ps = parts.get(a.id, [])
        going = [p for p in ps if p.status == "going"]
        mine = next((p for p in ps if p.user_id == viewer.id), None)
        is_host = a.host_id == viewer.id
        my_status = "host" if is_host else (mine.status if mine else None)
        lat, lng = a.lat, a.lng
        if a.location_privacy == "area" and not is_host and my_status != "going":
            lat, lng = jitter(a.id, a.lat, a.lng)
        host = users.get(a.host_id)
        out.append({
            "id": a.id,
            "title": a.title,
            "hobby_id": a.hobby_id,
            "host": {**mini(host), "is_business": host.is_business} if host else None,
            "starts_at": iso(a.starts_at),
            "ends_at": iso(a.ends_at),
            "venue_name": a.venue_name if (a.location_privacy == "exact" or is_host or my_status == "going") else "",
            "neighborhood": a.neighborhood,
            "lat": lat,
            "lng": lng,
            "cost_cents": a.cost_cents,
            "level": a.level,
            "capacity": a.capacity,
            "going_count": len(going) + 1,  # host counts as going
            "my_status": my_status,
            "friends_going": [mini(users[p.user_id]) for p in going if p.user_id in friends and p.user_id in users][:5],
            "recurring_weekly": a.recurring_weekly,
            "cancelled": a.cancelled,
        })
    return out


def activity_chat(session: Session, activity_id: int) -> Chat | None:
    return session.exec(select(Chat).where(Chat.kind == "activity", Chat.activity_id == activity_id)).first()


def ensure_member(session: Session, chat_id: int, user_id: int):
    if not session.get(ChatMember, (chat_id, user_id)):
        session.add(ChatMember(chat_id=chat_id, user_id=user_id))


def remove_member(session: Session, chat_id: int, user_id: int):
    m = session.get(ChatMember, (chat_id, user_id))
    if m:
        session.delete(m)


def day_window(day: str | None, now: datetime) -> tuple[datetime, datetime]:
    """Return [start, end) window in UTC. Seattle is UTC-7/8; we use -7 for simplicity."""
    local_now = now - timedelta(hours=7)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    if day == "today":
        return now, local_midnight + timedelta(days=1, hours=7)
    if day == "weekend":
        wd = local_midnight.weekday()
        sat = local_midnight - timedelta(days=1) if wd == 6 else local_midnight + timedelta(days=(5 - wd) % 7)
        start = max(now, sat + timedelta(hours=7))
        return start, sat + timedelta(days=2, hours=7)
    if day == "week":
        return now, now + timedelta(days=7)
    return now, now + timedelta(days=60)
