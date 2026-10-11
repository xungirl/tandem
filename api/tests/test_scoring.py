from app.scoring import Corpus, Profile, cosine, friend_score, haversine_km, level_closeness

FREMONT = (47.6510, -122.3500)
WALLINGFORD = (47.6615, -122.3343)
WEST_SEATTLE = (47.5700, -122.3870)
CORPUS = Corpus(n_users=100, hobby_counts={"go": 2, "hiking": 60, "board-games": 40, "chess": 10})


def p(id, hobbies, slots=(), loc=FREMONT, age=28, vibe=None):
    return Profile(id=id, hobbies=hobbies, slots=set(slots), lat=loc[0], lng=loc[1], age=age, vibe=vibe)


def test_score_bounds_and_breakdown_sums():
    a = p(1, {"go": 2, "hiking": 3}, [(1, "evening")])
    b = p(2, {"go": 2, "hiking": 3}, [(1, "evening")])
    r = friend_score(a, b, CORPUS)
    assert 0 <= r["score"] <= 100
    assert abs(sum(x["points"] for x in r["breakdown"]) - r["score"]) <= 1
    assert {x["key"] for x in r["breakdown"]} == {"hobbies", "time", "near", "vibe", "age"}


def test_rare_shared_hobby_beats_common_one():
    me = p(1, {"go": 2, "hiking": 2})
    rare = p(2, {"go": 2})
    common = p(3, {"hiking": 2})
    assert friend_score(me, rare, CORPUS)["score"] > friend_score(me, common, CORPUS)["score"]
    assert "Go" in friend_score(me, rare, CORPUS)["top_reason"]


def test_level_closeness_matters():
    me = p(1, {"chess": 1})
    same = p(2, {"chess": 1})
    expert = p(3, {"chess": 4})
    assert friend_score(me, same, CORPUS)["score"] > friend_score(me, expert, CORPUS)["score"]
    assert level_closeness(1, 4) == 0


def test_nearby_scores_higher_than_far():
    me = p(1, {"hiking": 2})
    near = p(2, {"hiking": 2}, loc=WALLINGFORD)
    far = p(3, {"hiking": 2}, loc=WEST_SEATTLE)
    assert friend_score(me, near, CORPUS)["score"] > friend_score(me, far, CORPUS)["score"]
    assert 1 < haversine_km(*FREMONT, *WALLINGFORD) < 2.5


def test_more_shared_hobbies_saturates_but_increases():
    me = p(1, {"go": 2, "chess": 2, "board-games": 2, "hiking": 2})
    one = p(2, {"go": 2})
    four = p(3, {"go": 2, "chess": 2, "board-games": 2, "hiking": 2})
    s1 = friend_score(me, one, CORPUS)["breakdown"][0]["points"]
    s4 = friend_score(me, four, CORPUS)["breakdown"][0]["points"]
    assert s1 < s4 <= 55


def test_vibe_and_missing_data_defaults():
    v = {"competitive": 0.8, "chill": -0.2}
    assert abs(cosine(v, v) - 1) < 1e-9
    a, b = Profile(id=1), Profile(id=2)
    r = friend_score(a, b, CORPUS)
    assert r["shared_hobbies"] == []
    assert r["score"] > 0  # neutral defaults, not zero


def test_symmetric():
    a = p(1, {"go": 2, "hiking": 3}, [(1, "evening"), (5, "morning")], age=25, vibe={"chill": 0.5})
    b = p(2, {"go": 3, "chess": 1}, [(1, "evening")], loc=WALLINGFORD, age=31, vibe={"chill": -0.1})
    assert friend_score(a, b, CORPUS)["score"] == friend_score(b, a, CORPUS)["score"]
