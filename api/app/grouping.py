"""Small-group suggestions.

For a user who is open to plans: for each hobby they're open to, gather nearby people open to
that hobby, then for every weekly slot the user is free, greedily grow a group of 3-5 that
maximizes the average pairwise Friend Score among people free in that slot.
"""

from __future__ import annotations

from itertools import combinations

from .scoring import Corpus, Profile, friend_score, haversine_km

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MIN_SIZE, MAX_SIZE = 3, 5
MAX_KM = 10.0
SLACK = 6.0  # accept a new member if the average drops by at most this much


class PairScorer:
    def __init__(self, corpus: Corpus):
        self.corpus = corpus
        self.cache: dict[tuple[int, int], int] = {}

    def __call__(self, a: Profile, b: Profile) -> int:
        key = (min(a.id, b.id), max(a.id, b.id))
        if key not in self.cache:
            self.cache[key] = friend_score(a, b, self.corpus)["score"]
        return self.cache[key]


def avg_pairwise(group: list[Profile], score: PairScorer) -> float:
    pairs = list(combinations(group, 2))
    return sum(score(a, b) for a, b in pairs) / len(pairs) if pairs else 0.0


def grow_group(me: Profile, pool: list[Profile], score: PairScorer) -> list[Profile] | None:
    group = [me]
    remaining = list(pool)
    current = 0.0
    while remaining and len(group) < MAX_SIZE:
        best, best_avg = None, -1.0
        for cand in remaining:
            avg = avg_pairwise(group + [cand], score)
            if avg > best_avg or (avg == best_avg and best is not None and cand.id < best.id):
                best, best_avg = cand, avg
        if len(group) >= MIN_SIZE and best_avg < current - SLACK:
            break
        group.append(best)
        remaining.remove(best)
        current = best_avg
    return group if len(group) >= MIN_SIZE else None


def suggest_groups(
    me: Profile,
    others: list[Profile],
    open_hobbies: dict[int, set[str]],
    corpus: Corpus,
    limit: int = 6,
    max_km: float = MAX_KM,
) -> list[dict]:
    """Return suggestions sorted by quality.

    open_hobbies maps user id -> hobbies they're open to plans for (including me.id).
    """
    score = PairScorer(corpus)
    mine = open_hobbies.get(me.id, set())
    results = []
    for h in sorted(mine):
        pool = []
        for o in others:
            if o.id == me.id or h not in open_hobbies.get(o.id, set()):
                continue
            if None not in (me.lat, me.lng, o.lat, o.lng) and \
                    haversine_km(me.lat, me.lng, o.lat, o.lng) > max_km:
                continue
            pool.append(o)
        for wd, slot in sorted(me.slots):
            free = [o for o in pool if (wd, slot) in o.slots]
            if len(free) < MIN_SIZE - 1:
                continue
            group = grow_group(me, free, score)
            if not group:
                continue
            quality = avg_pairwise(group, score) + 2 * (len(group) - MIN_SIZE)
            results.append({
                "hobby_id": h,
                "weekday": wd,
                "slot": slot,
                "member_ids": [p.id for p in group[1:]],
                "score": round(quality, 1),
                "reason": f"{len(group) - 1} people near you into {corpus.name(h)}, "
                          f"all free {WEEKDAYS[wd]} {slot}",
            })
    results.sort(key=lambda r: (-r["score"], r["hobby_id"], r["weekday"]))
    # Diversity: at most 2 suggestions per hobby, never the same member set twice.
    picked, per_hobby, seen = [], {}, set()
    for r in results:
        key = frozenset(r["member_ids"])
        if key in seen or per_hobby.get(r["hobby_id"], 0) >= 2:
            continue
        seen.add(key)
        per_hobby[r["hobby_id"]] = per_hobby.get(r["hobby_id"], 0) + 1
        picked.append(r)
        if len(picked) >= limit:
            break
    return picked
