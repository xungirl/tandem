from app.grouping import MAX_SIZE, MIN_SIZE, suggest_groups
from app.scoring import Corpus, Profile

CORPUS = Corpus(n_users=50, hobby_counts={"go": 5, "hiking": 30})
TUE = (1, "evening")
SAT = (5, "morning")


def p(id, hobbies, slots, lat=47.65, lng=-122.35):
    return Profile(id=id, hobbies=hobbies, slots=set(slots), lat=lat, lng=lng, age=28)


def test_groups_only_people_free_at_the_same_time():
    me = p(1, {"go": 2}, [TUE])
    others = [p(2, {"go": 2}, [TUE]), p(3, {"go": 2}, [TUE]), p(4, {"go": 2}, [SAT])]
    open_h = {i: {"go"} for i in range(1, 5)}
    out = suggest_groups(me, others, open_h, CORPUS)
    assert out and out[0]["weekday"] == 1 and out[0]["slot"] == "evening"
    assert set(out[0]["member_ids"]) == {2, 3}


def test_respects_open_to_plans_and_distance():
    me = p(1, {"go": 2}, [TUE])
    others = [
        p(2, {"go": 2}, [TUE]),
        p(3, {"go": 2}, [TUE]),                      # not open for go
        p(4, {"go": 2}, [TUE], lat=47.30, lng=-122.0),  # ~45 km away
    ]
    open_h = {1: {"go"}, 2: {"go"}, 3: set(), 4: {"go"}}
    assert suggest_groups(me, others, open_h, CORPUS) == []


def test_group_size_bounds_and_best_members_first():
    me = p(1, {"go": 2, "hiking": 2}, [TUE])
    others = [p(i, {"go": 2, "hiking": 2}, [TUE]) for i in range(2, 12)]
    others.append(p(99, {"go": 4}, [TUE], lat=47.55, lng=-122.40))  # weak match
    open_h = {o.id: {"go"} for o in others} | {1: {"go"}}
    out = suggest_groups(me, others, open_h, CORPUS)
    g = out[0]
    assert MIN_SIZE - 1 <= len(g["member_ids"]) <= MAX_SIZE - 1
    assert 99 not in g["member_ids"]


def test_diversity_no_duplicate_member_sets():
    me = p(1, {"go": 2}, [TUE, SAT])
    others = [p(2, {"go": 2}, [TUE, SAT]), p(3, {"go": 2}, [TUE, SAT])]
    open_h = {i: {"go"} for i in range(1, 4)}
    out = suggest_groups(me, others, open_h, CORPUS)
    assert len(out) == 1
