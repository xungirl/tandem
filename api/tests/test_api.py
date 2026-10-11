from app.hobby_parser import keyword_parse
from app.profanity import contains_profanity


def test_demo_people_ranked(client, demo):
    r = client.get("/api/people", headers=demo)
    assert r.status_code == 200
    people = r.json()
    scores = [p["score"] for p in people]
    assert scores == sorted(scores, reverse=True)
    assert people[0]["score"] >= 60
    assert all(not p["is_business"] for p in people)
    detail = client.get(f"/api/people/{people[0]['id']}", headers=demo).json()
    assert detail["breakdown"] and detail["shared_hobbies"]


def test_auth_required(client):
    assert client.get("/api/me").status_code == 401


def test_join_then_chat_flow(client, demo):
    acts = client.get("/api/activities?day=week", headers=demo).json()
    target = next(a for a in acts if a["my_status"] is None and a["host"]["id"] and not a["cancelled"]
                  and (a["capacity"] is None or a["going_count"] < a["capacity"]))
    detail = client.get(f"/api/activities/{target['id']}", headers=demo).json()
    r = client.post(f"/api/activities/{target['id']}/join", headers=demo, json={})
    assert r.status_code == 200
    joined = r.json()
    expected = "requested" if detail["requires_approval"] else "going"
    assert joined["my_status"] == expected
    if expected == "going":
        chat_id = joined["chat_id"]
        assert chat_id
        with client.websocket_connect(f"/ws?token={demo['Authorization'][7:]}") as ws:
            m = client.post(f"/api/chats/{chat_id}/messages", headers=demo, json={"body": "See you there!"})
            assert m.status_code == 200
            pushed = ws.receive_json()
            assert pushed["type"] == "message" and pushed["message"]["body"] == "See you there!"
        bad = client.post(f"/api/chats/{chat_id}/messages", headers=demo, json={"body": "this is sh1t"})
        assert bad.status_code == 422
        msgs = client.get(f"/api/chats/{chat_id}/messages", headers=demo).json()
        assert msgs[-1]["body"] == "See you there!"
    left = client.post(f"/api/activities/{target['id']}/leave", headers=demo).json()
    assert left["my_status"] is None


def test_signup_onboarding_and_hosting(client):
    email = "newbie@example.com"
    code = client.post("/api/auth/request-code", json={"email": email}).json()["dev_code"]
    assert client.post("/api/auth/verify", json={"email": email, "code": "000000" if code != "000000" else "111111"}).status_code == 400
    r = client.post("/api/auth/verify", json={"email": email, "code": code}).json()
    assert r["is_new"] and not r["user"]["onboarded"]
    h = {"Authorization": f"Bearer {r['token']}"}
    assert client.patch("/api/me", headers=h, json={"birth_year": 2015}).status_code == 422
    client.patch("/api/me", headers=h, json={"first_name": "Robin", "last_name": "Lee", "birth_year": 1998,
                                               "neighborhood": "Ballard"})
    client.put("/api/me/hobbies", headers=h, json=[{"hobby_id": "go", "level": 2}, {"hobby_id": "hiking", "level": 3}])
    me = client.put("/api/me/availability", headers=h, json=[{"weekday": 1, "slot": "evening"}]).json()
    assert me["onboarded"] and me["lat"] and me["display_name"] == "Robin L."
    qs = client.get("/api/vibe-questions").json()
    v = client.put("/api/me/vibe", headers=h, json={"answers": [{"question_id": q["id"], "option_id": "a"} for q in qs]}).json()
    assert v["summary"]
    act = client.post("/api/activities", headers=h, json={
        "hobby_id": "go", "title": "Go at the park", "starts_at": "2030-05-01T18:00:00-07:00",
        "ends_at": "2030-05-01T20:00:00-07:00", "venue_name": "Gas Works Park", "neighborhood": "Wallingford",
        "lat": 47.6456, "lng": -122.3344, "capacity": 4}).json()
    assert act["my_status"] == "host" and act["chat_id"] and act["starts_at"] == "2030-05-02T01:00:00Z"
    # Friend by code: Maya's code is fixed.
    card = client.post("/api/friends/code", headers=h, json={"code": "maya27"}).json()
    assert card["friend_status"] == "friends"


def test_area_privacy_hides_exact_spot(client, demo):
    email = "host2@example.com"
    code = client.post("/api/auth/request-code", json={"email": email}).json()["dev_code"]
    tok = client.post("/api/auth/verify", json={"email": email, "code": code}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    act = client.post("/api/activities", headers=h, json={
        "hobby_id": "board-games", "title": "Games at my place", "starts_at": "2030-05-01T18:00:00Z",
        "ends_at": "2030-05-01T20:00:00Z", "venue_name": "My apartment", "neighborhood": "Fremont",
        "lat": 47.6510, "lng": -122.3500, "location_privacy": "area"}).json()
    assert act["requires_approval"]
    seen = client.get(f"/api/activities/{act['id']}", headers=demo).json()
    assert (seen["lat"], seen["lng"]) != (47.6510, -122.3500) and seen["venue_name"] == ""
    assert client.post(f"/api/activities/{act['id']}/join", headers=demo, json={"note": "hi"}).json()["my_status"] == "requested"
    maya_id = client.get("/api/me", headers=demo).json()["id"]
    approved = client.post(f"/api/activities/{act['id']}/requests/{maya_id}", headers=h, json={"approve": True})
    assert approved.status_code == 200
    seen = client.get(f"/api/activities/{act['id']}", headers=demo).json()
    assert seen["my_status"] == "going" and seen["venue_name"] == "My apartment"


def test_suggestions_and_accept(client, demo):
    sug = client.get("/api/suggestions", headers=demo).json()
    assert sug and len(sug[0]["members"]) >= 2
    s = sug[0]
    r = client.post("/api/suggestions/accept", headers=demo, json={
        "hobby_id": s["hobby_id"], "weekday": s["weekday"], "slot": s["slot"],
        "member_ids": [m["id"] for m in s["members"]]}).json()
    chat = client.get(f"/api/chats/{r['chat_id']}", headers=demo).json()
    assert chat["kind"] == "group" and len(chat["members"]) == len(s["members"]) + 1


def test_badges_and_chats(client, demo):
    me = client.get("/api/me", headers=demo).json()
    tiers = {b["hobby_id"]: b["tier"] for b in me["badges"]}
    assert tiers["bouldering"] == "Silver"
    chats = client.get("/api/chats", headers=demo).json()
    assert any(c["kind"] == "dm" for c in chats) and any(c["unread"] for c in chats)


def test_keyword_parser_and_profanity():
    hobbies = {"bouldering": "Bouldering", "pottery": "Pottery", "go": "Go (baduk)", "running": "Running",
               "trail-running": "Trail running"}
    out = {h["hobby_id"]: h["level"] for h in keyword_parse("I climb a lot, new to pottery, trail running is my thing", hobbies)}
    assert out == {"bouldering": 3, "pottery": 1, "trail-running": 2}
    assert "go" not in {h["hobby_id"] for h in keyword_parse("let's go out", hobbies)}
    assert contains_profanity("what the f*ck") and not contains_profanity("Dickens and Scunthorpe are fine")
