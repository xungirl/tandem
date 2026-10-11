"""Friend Score: an explainable 0-100 compatibility score between two people.

Pure functions over plain data so it is easy to unit-test and reason about.

    shared hobbies  55  rarity-weighted (IDF) and level-aware
    free time       15  Jaccard overlap of weekly slots
    proximity       15  exponential decay on km between neighborhoods
    vibe            10  cosine similarity of Vibe Check traits
    age              5  exponential decay on age gap
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

MAX_SHARED, MAX_TIME, MAX_NEAR, MAX_VIBE, MAX_AGE = 55, 15, 15, 10, 5
SHARED_K = 1.2      # how fast shared-hobby points saturate
NEAR_KM = 6.0       # distance scale for proximity decay
AGE_SCALE = 8.0     # years
LEVEL_NAMES = {1: "beginner", 2: "casual", 3: "intermediate", 4: "expert"}


@dataclass
class Profile:
    id: int
    hobbies: dict[str, int] = field(default_factory=dict)   # hobby_id -> level 1..4
    slots: set[tuple[int, str]] = field(default_factory=set)
    lat: float | None = None
    lng: float | None = None
    age: int | None = None
    vibe: dict[str, float] | None = None


@dataclass
class Corpus:
    """Population statistics needed for IDF."""
    n_users: int
    hobby_counts: dict[str, int]
    hobby_names: dict[str, str] = field(default_factory=dict)

    def idf(self, hobby_id: str) -> float:
        """Rarity weight normalized to roughly [0.05, 1]."""
        n = max(self.n_users, 2)
        c = self.hobby_counts.get(hobby_id, 0)
        raw = math.log(n / (1 + c))
        return max(0.05, min(1.0, raw / math.log(n)))

    def name(self, hobby_id: str) -> str:
        return self.hobby_names.get(hobby_id, hobby_id.replace("-", " ").title())


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def level_closeness(a: int, b: int) -> float:
    return 1 - abs(a - b) / 3


def cosine(u: dict[str, float], v: dict[str, float]) -> float:
    keys = set(u) | set(v)
    dot = sum(u.get(k, 0) * v.get(k, 0) for k in keys)
    nu = math.sqrt(sum(x * x for x in u.values()))
    nv = math.sqrt(sum(x * x for x in v.values()))
    if nu == 0 or nv == 0:
        return 0.0
    return dot / (nu * nv)


def shared_hobbies(a: Profile, b: Profile, corpus: Corpus) -> list[dict]:
    """Shared hobbies, rarest first, with each one's contribution weight."""
    out = []
    for h in set(a.hobbies) & set(b.hobbies):
        idf = corpus.idf(h)
        close = level_closeness(a.hobbies[h], b.hobbies[h])
        out.append({
            "hobby_id": h,
            "name": corpus.name(h),
            "my_level": a.hobbies[h],
            "their_level": b.hobbies[h],
            "rarity": round(idf, 3),
            "weight": round(idf * close, 3),
        })
    out.sort(key=lambda s: (-s["weight"], s["hobby_id"]))
    return out


def friend_score(a: Profile, b: Profile, corpus: Corpus) -> dict:
    """Return {score, breakdown[], shared_hobbies[], top_reason}."""
    shared = shared_hobbies(a, b, corpus)
    x = sum(s["weight"] for s in shared)
    p_shared = MAX_SHARED * (1 - math.exp(-x / SHARED_K))
    if shared:
        names = ", ".join(s["name"] for s in shared[:3])
        extra = f" +{len(shared) - 3} more" if len(shared) > 3 else ""
        rare = [s for s in shared if s["rarity"] >= 0.6]
        d_shared = f"{len(shared)} in common: {names}{extra}"
        if rare:
            d_shared += f". {rare[0]['name']} is rare, so it counts extra"
    else:
        d_shared = "No hobbies in common yet"

    if a.slots and b.slots:
        overlap = a.slots & b.slots
        jac = len(overlap) / len(a.slots | b.slots)
        p_time = MAX_TIME * jac
        d_time = f"Free at the same time {len(overlap)} slot{'s' if len(overlap) != 1 else ''} a week"
    else:
        p_time, d_time = MAX_TIME * 0.3, "Free times not set"

    if None not in (a.lat, a.lng, b.lat, b.lng):
        km = haversine_km(a.lat, a.lng, b.lat, b.lng)
        p_near = MAX_NEAR * math.exp(-km / NEAR_KM)
        d_near = "Same neighborhood" if km < 0.5 else f"About {km * 0.621:.1f} mi apart"
    else:
        km, p_near, d_near = None, MAX_NEAR * 0.3, "Neighborhood not set"

    if a.vibe and b.vibe:
        cos = cosine(a.vibe, b.vibe)
        p_vibe = MAX_VIBE * (cos + 1) / 2
        d_vibe = "Very similar vibe" if cos > 0.6 else "Similar vibe" if cos > 0.2 else \
            "Different vibes, could balance out" if cos > -0.2 else "Opposite vibes"
    else:
        p_vibe, d_vibe = MAX_VIBE / 2, "Take the Vibe Check to compare"

    if a.age and b.age:
        gap = abs(a.age - b.age)
        p_age = MAX_AGE * math.exp(-gap / AGE_SCALE)
        d_age = "Same age" if gap == 0 else f"{gap} year{'s' if gap != 1 else ''} apart"
    else:
        p_age, d_age = MAX_AGE / 2, "Age not set"

    breakdown = [
        {"key": "hobbies", "label": "Shared hobbies", "points": round(p_shared, 1), "max": MAX_SHARED, "detail": d_shared},
        {"key": "time", "label": "Free at the same time", "points": round(p_time, 1), "max": MAX_TIME, "detail": d_time},
        {"key": "near", "label": "Lives nearby", "points": round(p_near, 1), "max": MAX_NEAR, "detail": d_near},
        {"key": "vibe", "label": "Vibe", "points": round(p_vibe, 1), "max": MAX_VIBE, "detail": d_vibe},
        {"key": "age", "label": "Age", "points": round(p_age, 1), "max": MAX_AGE, "detail": d_age},
    ]
    score = round(p_shared + p_time + p_near + p_vibe + p_age)
    return {
        "score": max(0, min(100, score)),
        "breakdown": breakdown,
        "shared_hobbies": shared,
        "top_reason": top_reason(shared, breakdown, km),
    }


def top_reason(shared: list[dict], breakdown: list[dict], km: float | None) -> str:
    if shared:
        best = shared[0]
        if len(shared) == 1:
            if best["rarity"] >= 0.6:
                return f"Both into {best['name']}, which few people do"
            return f"Both into {best['name']}"
        rare = " (rare!)" if best["rarity"] >= 0.6 else ""
        return f"Both into {best['name']}{rare} and {len(shared) - 1} more"
    best = max(breakdown[1:], key=lambda r: r["points"] / r["max"])
    return best["detail"]


def age_from_birth_year(birth_year: int | None, this_year: int) -> int | None:
    return this_year - birth_year if birth_year else None
