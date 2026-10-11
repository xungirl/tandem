"""Deterministic demo data: ~120 Seattle people, local businesses, activities, friends, chats."""

from __future__ import annotations

import random
from datetime import timedelta

from sqlmodel import Session, select

from .data.hobbies import CATEGORY_COLORS, HOBBIES
from .data.neighborhoods import NEIGHBORHOODS
from .data.vibe import TRAITS
from .models import (Activity, Availability, Chat, ChatMember, Friendship, Hobby, Message, Participation,
                     User, UserHobby, utcnow)

DEMO_EMAIL = "maya@demo.tandem.app"
UTC_OFFSET = 7  # Seattle PDT

FIRST = ["Ava", "Liam", "Noah", "Emma", "Olivia", "Ethan", "Mia", "Lucas", "Sofia", "Mateo", "Priya", "Arjun",
         "Hana", "Kenji", "Yuna", "Min-jun", "Wei", "Mei", "Chloe", "Diego", "Camila", "Omar", "Layla", "Zoe",
         "Isaac", "Nora", "Theo", "Ruby", "Jonah", "Iris", "Felix", "Maren", "Kai", "Leah", "Sam", "Jordan",
         "Riley", "Quinn", "Aisha", "Tariq", "Fatima", "Bao", "Linh", "Tuan", "Grace", "Henry", "Elena",
         "Marco", "Ingrid", "Soren", "Astrid", "Malia", "Keoni", "Nia", "Jamal", "Andre", "Tessa", "Owen",
         "Clara", "Dev", "Rohan", "Anika", "Sana", "Yusuf", "Lena", "Max", "Ella", "Ben", "Hugo", "Lucia",
         "Ana", "Pablo", "Ines", "Tomás", "Jae", "Sora", "Haruto", "Aiko", "Rin", "Eli", "Maya", "Nate",
         "Cora", "Juno", "Rafael", "Gabi", "Vera", "Mila", "Leo", "Ari"]
LAST = "ABCDEFGHJKLMNOPRSTVWYZ"
LANGS = ["Spanish", "Mandarin", "Korean", "Japanese", "Vietnamese", "Hindi", "French", "German", "Portuguese",
         "Tagalog", "Arabic", "Cantonese", "Russian"]
AVATAR_EMOJI = ["🦊", "🐻", "🐼", "🐸", "🐙", "🦉", "🐧", "🦄", "🐝", "🦦", "🐢", "🦁", "🐨", "🐯", "🐰",
                "🦔", "🐳", "🦩", "🌻", "🍄", "🌵", "⭐", "🌈", "🍉"]
AVATAR_BG = ["#FFC94A", "#FF6B4A", "#1FA59A", "#B9A6FF", "#FF8FB1", "#5B8DEF", "#7BC67E", "#FF9F43"]
BIOS = [
    "New to Seattle and looking for people to {h} with.",
    "Weekday engineer, weekend {h} enthusiast.",
    "Will trade snacks for {h} buddies.",
    "Trying to say yes to more things. {H} is my current obsession.",
    "Moved here from {city} last year. Into {h} and good coffee.",
    "Always down for {h}. Bad at it, enthusiastic anyway.",
    "Looking for a regular {h} crew. Low-key, friendly, punctual-ish.",
    "Grad student by day. {H} keeps me sane.",
    "",
]
CITIES = ["Chicago", "Austin", "Seoul", "Toronto", "Denver", "the Bay Area", "London", "Taipei", "Boston"]

PUBLIC_SPOTS = [
    ("Gas Works Park", "Wallingford", 47.6456, -122.3344),
    ("Green Lake Park", "Green Lake", 47.6806, -122.3290),
    ("Discovery Park", "Magnolia", 47.6573, -122.4057),
    ("Volunteer Park", "Capitol Hill", 47.6305, -122.3149),
    ("Golden Gardens", "Ballard", 47.6920, -122.4031),
    ("Cal Anderson Park", "Capitol Hill", 47.6170, -122.3195),
    ("Seward Park", "Columbia City", 47.5500, -122.2550),
    ("Magnuson Park", "Sand Point", 47.6810, -122.2530),
    ("Alki Beach", "Alki", 47.5795, -122.4100),
    ("Ballard Library", "Ballard", 47.6693, -122.3846),
    ("Fremont Troll", "Fremont", 47.6510, -122.3473),
    ("Westlake Park", "Downtown", 47.6113, -122.3370),
    ("Jefferson Park", "Beacon Hill", 47.5700, -122.3100),
    ("Woodland Park", "Phinney Ridge", 47.6680, -122.3460),
]

BUSINESSES = [
    ("Fremont Boulder Lab", "bouldering", "Fremont", "Bouldering gym with weekly meetups and a beginner night."),
    ("Ballard Block Co.", "bouldering", "Ballard", "Climbing gym, yoga room and a sauna."),
    ("Cap Hill Board Game Café", "board-games", "Capitol Hill", "800+ games, good coffee, better nachos."),
    ("Meeple & Mead", "board-games", "Ballard", "Board game bar. Thursday is game-teach night."),
    ("Lakeside Loop Runners", "running", "Green Lake", "Free social run club. All paces, coffee after."),
    ("Rainier Trail Collective", "trail-running", "Columbia City", "Trail runs around Seattle and the Cascades."),
    ("Mudbird Pottery Studio", "pottery", "Ballard", "Wheel classes and open studio hours."),
    ("Fremont Clay House", "pottery", "Fremont", "Hand-building and wheel drop-ins."),
    ("Puget Picklers", "pickleball", "Sand Point", "Pickleball club with drop-in play for every level."),
    ("Seattle Go Club", "go", "University District", "Weekly go (baduk) nights. Free lessons for beginners."),
    ("Queen Anne Chess House", "chess", "Queen Anne", "Casual and rated chess, coffee on tap."),
    ("The Trivia Hour", "trivia", "Wallingford", "Pub trivia every Tuesday and Thursday."),
    ("Belltown Karaoke Box", "karaoke", "Belltown", "Private rooms and a public stage on Fridays."),
    ("Salt & Smoke Kitchen", "cooking", "Capitol Hill", "Hands-on cooking classes, BYOB."),
    ("Little Oven Bakery School", "baking", "Phinney Ridge", "Weekend baking workshops."),
    ("Beacon Book Society", "book-club", "Beacon Hill", "Monthly book club in a cozy bookshop."),
    ("Westside Yoga Collective", "yoga", "West Seattle", "Donation-based community yoga."),
    ("Emerald City Ultimate", "ultimate", "Magnolia", "Pickup ultimate, all levels welcome."),
    ("Ravenna Cycle Club", "cycling", "Ravenna", "No-drop group rides on weekends."),
    ("SoDo Bowl & Brew", "bowling", "SoDo", "Bowling lanes, craft beer, league nights."),
    ("Interbay Disc Golf Crew", "disc-golf", "Interbay", "Casual rounds and doubles nights."),
    ("Ballard Language Café", "languages", "Ballard", "Language exchange tables: Spanish, Japanese, Korean."),
    ("Pioneer Sketch Club", "sketching", "Pioneer Square", "Urban sketching walks downtown."),
    ("U-District Hack Night", "coding", "University District", "Bring a side project, leave with friends."),
    ("Georgetown Woodshop", "woodworking", "Georgetown", "Shared woodshop with intro classes."),
    ("Alki Beach Keepers", "beach-cleanup", "Alki", "Monthly beach cleanups and picnics."),
    ("Green Lake Paddle Club", "kayaking", "Green Lake", "Kayak and SUP meetups on Green Lake."),
]

TITLES = {
    "bouldering": ["Beginner bouldering night", "Project session + beta swap", "Board climbing hangout"],
    "board-games": ["Board game night", "Heavy Euro afternoon", "Party games & pizza", "Learn Wingspan"],
    "running": ["Social 5K + coffee", "Easy-pace loop run", "Sunrise tempo run"],
    "trail-running": ["Cougar Mountain trail run", "Discovery Park trail loop", "Easy trail 10K"],
    "pottery": ["Open studio wheel night", "Hand-building drop-in", "Glazing party"],
    "pickleball": ["Drop-in pickleball", "Beginner pickleball clinic", "Doubles round robin"],
    "go": ["Go night: lessons + games", "Casual go games", "Go for total beginners"],
    "chess": ["Casual chess night", "Blitz & bagels", "Chess for beginners"],
    "trivia": ["Pub trivia team-up", "Trivia night, need teammates"],
    "karaoke": ["Karaoke night", "Duets only karaoke"],
    "cooking": ["Dumpling-making class", "Pasta from scratch", "Potluck dinner"],
    "baking": ["Sourdough basics", "Croissant workshop"],
    "book-club": ["Book club: sci-fi month", "Silent reading party"],
    "yoga": ["Community flow yoga", "Sunset yoga in the park"],
    "ultimate": ["Pickup ultimate", "Ultimate for beginners"],
    "cycling": ["No-drop Burke-Gilman ride", "Coffee ride to Kirkland"],
    "bowling": ["Bowling + burgers", "Cosmic bowling night"],
    "hiking": ["Rattlesnake Ledge hike", "Mt. Si sunrise hike", "Easy forest walk at Discovery Park"],
    "photography": ["Golden-hour photo walk", "Film photography meetup"],
    "coffee": ["Café crawl in Capitol Hill", "Pour-over tasting"],
    "video-games": ["Smash Bros. night", "Co-op game night"],
    "dnd": ["One-shot D&D for newcomers", "D&D campaign kickoff"],
    "coding": ["Hack night: bring a side project", "Build something with AI"],
    "languages": ["Spanish/English exchange", "Japanese conversation table"],
    "kayaking": ["Sunset paddle on Green Lake", "Lake Union kayak loop"],
    "movies": ["Movie night in the park", "Studio Ghibli marathon"],
    "dog-walks": ["Pack walk at Magnuson", "Dog park meetup"],
    "concerts": ["Live jazz at the Royal Room", "Indie show night"],
    "beach-cleanup": ["Alki beach cleanup + picnic"],
    "sketching": ["Urban sketching walk"],
    "woodworking": ["Intro to woodworking"],
    "disc-golf": ["Doubles disc golf"],
    "salsa": ["Salsa social for beginners"],
    "brunch": ["Sunday brunch club"],
}
DESCRIPTIONS = [
    "All levels welcome. Come solo, leave with friends.",
    "Low-key and friendly. We'll do quick intros at the start.",
    "First time? Tell the host in the chat and we'll pair you up.",
    "Bring water and good vibes. We usually grab food after.",
    "We keep it small so everyone actually gets to talk.",
]
CHAT_LINES = [
    "Hi all! Excited for this 👋", "Is anyone coming from Ballard? Happy to carpool.",
    "First time here, be nice 😅", "I'll bring snacks!", "Running 5 min late, save me a spot",
    "Can't wait", "What should we bring?", "Weather looks good for it ☀️",
    "Anyone want to grab food after?", "I'm in the green jacket if you're looking for me",
]


def _local_to_utc(day, hour, minute=0):
    return day.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(hours=UTC_OFFSET)


def seed(session: Session):
    if session.exec(select(Hobby)).first():
        return
    rng = random.Random(42)
    now = utcnow()
    local_today = (now - timedelta(hours=UTC_OFFSET)).replace(hour=0, minute=0, second=0, microsecond=0)
    nb = {n: (lat, lng) for n, lat, lng in NEIGHBORHOODS}
    nb_names = [n for n, _, _ in NEIGHBORHOODS]
    nb_weights = [3 if n in ("Capitol Hill", "Fremont", "Ballard", "Wallingford", "University District",
                             "Queen Anne", "Green Lake", "South Lake Union", "Beacon Hill") else 1 for n in nb_names]

    hobbies = [Hobby(id=s, name=n, emoji=e, category=c, color=CATEGORY_COLORS[c]) for s, n, e, c, _ in HOBBIES]
    session.add_all(hobbies)
    hobby_ids = [h[0] for h in HOBBIES]
    hobby_w = [h[4] ** 1.4 for h in HOBBIES]  # sharpen popularity curve
    hobby_name = {h[0]: h[1] for h in HOBBIES}
    codes = set()

    def code():
        while True:
            c = "".join(rng.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(6))
            if c not in codes:
                codes.add(c)
                return c

    def pick_hobbies(k):
        chosen = set()
        while len(chosen) < k:
            chosen.add(rng.choices(hobby_ids, weights=hobby_w)[0])
        return list(chosen)

    def random_slots():
        slots = set()
        for wd in range(7):
            for slot, p in (("morning", 0.12), ("afternoon", 0.12), ("evening", 0.35)):
                weekend = wd >= 5
                prob = p * (2.4 if weekend and slot != "evening" else 1.0)
                if rng.random() < prob:
                    slots.add((wd, slot))
        if len(slots) < 3:
            slots |= {(rng.randrange(7), "evening"), (5, rng.choice(["morning", "afternoon"]))}
        return slots

    def vibe():
        return {t: round(rng.uniform(-1, 1), 2) for t in TRAITS}

    # ---------- demo user ----------
    maya = User(email=DEMO_EMAIL, first_name="Maya", last_name="Kim", birth_year=now.year - 27,
                neighborhood="Fremont", lat=nb["Fremont"][0], lng=nb["Fremont"][1],
                bio="Product designer, recovering perfectionist. I climb V4s badly and lose at Catan graciously.",
                languages=["English", "Korean"], instagram="maya.makes.things", avatar="🦦|#1FA59A",
                friend_code="MAYA27", open_to_plans=True,
                vibe={"competitive": 0.3, "chill": 0.5, "chatty": 0.6, "planner": 0.4, "night_owl": -0.2})
    codes.add("MAYA27")
    session.add(maya)
    session.flush()
    maya_hobbies = {"bouldering": 3, "board-games": 2, "pottery": 1, "trail-running": 2, "go": 2}
    for h, lvl in maya_hobbies.items():
        session.add(UserHobby(user_id=maya.id, hobby_id=h, level=lvl, years=rng.choice([0.5, 1, 2, 3]),
                              open_to_plans=True))
    maya_slots = {(1, "evening"), (2, "evening"), (3, "evening"), (5, "morning"), (5, "afternoon"), (6, "morning")}
    for wd, s in maya_slots:
        session.add(Availability(user_id=maya.id, weekday=wd, slot=s))

    # ---------- people ----------
    people: list[User] = []
    used_names = set()
    for i in range(120):
        first = rng.choice(FIRST)
        last = rng.choice(LAST)
        while (first, last) in used_names or first == "Maya" and last == "K":
            first, last = rng.choice(FIRST), rng.choice(LAST)
        used_names.add((first, last))
        hood = rng.choices(nb_names, weights=nb_weights)[0]
        lat, lng = nb[hood]
        hs = pick_hobbies(rng.choice([3, 3, 4, 4, 5, 6]))
        h_fmt = hobby_name[hs[0]].lower()
        bio = rng.choice(BIOS).format(h=h_fmt, H=hobby_name[hs[0]], city=rng.choice(CITIES))
        langs = ["English"] + ([rng.choice(LANGS)] if rng.random() < 0.4 else [])
        u = User(email=f"user{i}@seed.tandem.app", first_name=first, last_name=last + "x",
                 birth_year=now.year - int(min(58, max(21, rng.gauss(30, 6)))),
                 neighborhood=hood, lat=lat, lng=lng, bio=bio, languages=langs,
                 instagram=f"{first.lower()}.{last.lower()}{rng.randint(1, 99)}" if rng.random() < 0.5 else None,
                 avatar=f"{rng.choice(AVATAR_EMOJI)}|{rng.choice(AVATAR_BG)}", friend_code=code(),
                 open_to_plans=rng.random() < 0.8, vibe=vibe() if rng.random() < 0.75 else None,
                 created_at=now - timedelta(days=rng.randint(1, 200)))
        session.add(u)
        session.flush()
        for h in hs:
            session.add(UserHobby(user_id=u.id, hobby_id=h, level=rng.choices([1, 2, 3, 4], [25, 35, 28, 12])[0],
                                  years=rng.choice([None, 0.5, 1, 2, 3, 5, 8]), open_to_plans=rng.random() < 0.85))
        for wd, s in random_slots():
            session.add(Availability(user_id=u.id, weekday=wd, slot=s))
        people.append(u)

    # A few hand-made strong matches for Maya near Fremont so the demo shines.
    matches = [
        ("Jun", "Park", "Wallingford", {"go": 3, "bouldering": 3, "board-games": 2, "coffee": 2}, "🐼|#B9A6FF",
         "Go 3-dan, V5 on a good day. Looking for a regular Tuesday crew."),
        ("Sophie", "Lind", "Fremont", {"bouldering": 3, "trail-running": 3, "pottery": 2, "hiking": 3}, "🦊|#FF6B4A",
         "Trail runner and wannabe potter. Usually at the gym on Tuesday nights."),
        ("Tomás", "Reyes", "Ballard", {"board-games": 3, "go": 1, "bouldering": 2, "cooking": 3}, "🐻|#FFC94A",
         "I own too many board games. Help me play them."),
        ("Nadia", "Haddad", "Phinney Ridge", {"pottery": 2, "bouldering": 2, "board-games": 2, "yoga": 3}, "🌻|#FF8FB1",
         "Clay under my nails most weekends."),
    ]
    for first, last, hood, hs, avatar, bio in matches:
        u = User(email=f"{first.lower()}@seed.tandem.app", first_name=first, last_name=last,
                 birth_year=now.year - rng.randint(25, 31), neighborhood=hood, lat=nb[hood][0], lng=nb[hood][1],
                 bio=bio, languages=["English"], avatar=avatar, friend_code=code(), open_to_plans=True,
                 vibe={t: round(maya.vibe[t] + rng.uniform(-0.3, 0.3), 2) for t in TRAITS},
                 instagram=f"{first.lower()}.{last.lower()}")
        session.add(u)
        session.flush()
        for h, lvl in hs.items():
            session.add(UserHobby(user_id=u.id, hobby_id=h, level=lvl, years=2, open_to_plans=True))
        for wd, s in maya_slots | {(rng.randrange(7), "evening")}:
            if rng.random() < 0.8:
                session.add(Availability(user_id=u.id, weekday=wd, slot=s))
        people.append(u)
    session.flush()
    stars = people[-4:]

    # ---------- businesses ----------
    businesses: list[tuple[User, str]] = []
    for name, hobby, hood, about in BUSINESSES:
        lat, lng = nb[hood]
        b = User(email=f"{hobby}-{hood.lower().replace(' ', '')}@biz.tandem.app", first_name=name.split()[0],
                 business_name=name, is_business=True, neighborhood=hood,
                 lat=lat + rng.uniform(-0.004, 0.004), lng=lng + rng.uniform(-0.004, 0.004), bio=about,
                 avatar=f"{next(h[2] for h in HOBBIES if h[0] == hobby)}|{CATEGORY_COLORS[next(h[3] for h in HOBBIES if h[0] == hobby)]}",
                 friend_code=code(), open_to_plans=False)
        session.add(b)
        businesses.append((b, hobby))
    session.flush()

    hobby_people: dict[str, list[User]] = {}
    for uh in session.exec(select(UserHobby)):
        hobby_people.setdefault(uh.hobby_id, []).append(uh.user_id)
    by_id = {u.id: u for u in people + [maya]}

    activities: list[Activity] = []

    def make_activity(host: User, hobby: str, day, hour, minutes, venue, hood, lat, lng, **kw):
        start = _local_to_utc(day, hour, rng.choice([0, 0, 30]))
        a = Activity(host_id=host.id, hobby_id=hobby, title=rng.choice(TITLES.get(hobby, [f"{hobby_name[hobby]} meetup"])),
                     description=rng.choice(DESCRIPTIONS), starts_at=start,
                     ends_at=start + timedelta(minutes=minutes), venue_name=venue, neighborhood=hood,
                     lat=lat, lng=lng, created_at=start - timedelta(days=rng.randint(3, 14)), **kw)
        session.add(a)
        activities.append(a)
        return a

    # Business activities: recurring-ish, past and upcoming.
    for b, hobby in businesses:
        for offset in range(-42, 15):
            day = local_today + timedelta(days=offset)
            if rng.random() > (0.2 if offset < 0 else 0.22):
                continue
            hour = rng.choice([10, 18, 19]) if day.weekday() >= 5 else rng.choice([18, 18, 19, 19, 20])
            make_activity(b, hobby, day, hour, rng.choice([90, 120, 120, 150]), b.business_name, b.neighborhood,
                          b.lat, b.lng, capacity=rng.choice([None, 12, 16, 20, 30]),
                          cost_cents=rng.choice([0, 0, 0, 1000, 1500, 2500]),
                          level=rng.choice(["any", "any", "beginner", "intermediate"]),
                          recurring_weekly=rng.random() < 0.5)

    # People-hosted activities at public spots.
    hosts = [u for u in people if u.open_to_plans]
    for _ in range(70):
        host = rng.choice(hosts)
        hs = [uh.hobby_id for uh in session.exec(select(UserHobby).where(UserHobby.user_id == host.id))]
        hobby = rng.choice(hs)
        spot = rng.choice(PUBLIC_SPOTS)
        day = local_today + timedelta(days=rng.randint(-40, 13))
        hour = rng.choice([9, 10, 13, 15]) if day.weekday() >= 5 else rng.choice([17, 18, 19])
        at_home = rng.random() < 0.15
        make_activity(host, hobby, day, hour, rng.choice([60, 90, 120, 180]), spot[0] if not at_home else "My place",
                      spot[1], spot[2], spot[3], capacity=rng.choice([4, 6, 8, 10, None]),
                      location_privacy="area" if at_home else "exact", requires_approval=at_home or rng.random() < 0.15,
                      level=rng.choice(["any", "any", "beginner"]))
    session.flush()

    # Demo user's own hosted activity (upcoming) and a past one.
    maya_host = make_activity(maya, "board-games", local_today + timedelta(days=4), 19, 150, "Fremont Troll",
                              "Fremont", *PUBLIC_SPOTS[10][2:], capacity=6)
    maya_host.title, maya_host.description = "Catan & chill at Maya's", "Casual board games. I'll bring Catan and Codenames."
    maya_past = make_activity(maya, "bouldering", local_today - timedelta(days=9), 18, 120, "Fremont Boulder Lab",
                              "Fremont", 47.6512, -122.3480)
    maya_past.title = "V-easy bouldering crew"
    session.flush()

    # ---------- participation ----------
    seen_parts: set[tuple[int, int]] = set()

    def add_part(p: Participation):
        key = (p.activity_id, p.user_id)
        if key in seen_parts:
            return
        seen_parts.add(key)
        session.add(p)

    for a in activities:
        if a.host_id == maya.id:
            continue  # hand-crafted below
        pool = [uid for uid in hobby_people.get(a.hobby_id, []) if uid != a.host_id and uid in by_id and uid != maya.id]
        rng.shuffle(pool)
        cap = (a.capacity - 1) if a.capacity else 14
        n = min(len(pool), cap, rng.randint(1, 9))
        past = a.ends_at < now
        for uid in pool[:n]:
            p = Participation(activity_id=a.id, user_id=uid, status="going",
                              checked_in=past and rng.random() < 0.85, created_at=a.created_at + timedelta(days=1))
            if p.checked_in and rng.random() < 0.6:
                p.rating = rng.choices([3, 4, 5], [1, 3, 6])[0]
            add_part(p)
        if a.requires_approval and not past and len(pool) > n:
            add_part(Participation(activity_id=a.id, user_id=pool[n], status="requested",
                                      note="Hi! First time, would love to join."))

    # Maya's history: Silver in bouldering, Bronze in board games/pottery/trail running.
    def maya_join(a, checked):
        add_part(Participation(activity_id=a.id, user_id=maya.id, status="going", checked_in=checked,
                                  rating=rng.choice([4, 5]) if checked else None))

    past_by_hobby: dict[str, list[Activity]] = {}
    future_by_hobby: dict[str, list[Activity]] = {}
    for a in activities:
        if a.host_id == maya.id:
            continue
        (past_by_hobby if a.ends_at < now else future_by_hobby).setdefault(a.hobby_id, []).append(a)
    for hobby, k in (("bouldering", 4), ("board-games", 2), ("pottery", 1), ("trail-running", 1), ("go", 1)):
        for a in sorted(past_by_hobby.get(hobby, []), key=lambda a: a.starts_at)[-k:]:
            maya_join(a, True)
    for hobby in ("bouldering", "go", "pottery"):
        fut = sorted((a for a in future_by_hobby.get(hobby, []) if not a.requires_approval), key=lambda a: a.starts_at)
        if fut:
            maya_join(fut[0], False)
    # Stars attend Maya's upcoming game night.
    for s in stars[:3]:
        add_part(Participation(activity_id=maya_host.id, user_id=s.id, status="going"))
    add_part(Participation(activity_id=maya_host.id, user_id=stars[3].id, status="requested",
                              note="Can I bring my partner's copy of Cascadia?"))
    for s in stars[:2]:
        add_part(Participation(activity_id=maya_past.id, user_id=s.id, status="going", checked_in=True, rating=5))
    session.flush()

    # ---------- friendships ----------
    fpairs: set[tuple[int, int]] = set()

    def befriend(a: User, b: User, status="accepted", by=None):
        x, y = sorted((a.id, b.id))
        if (x, y) in fpairs:
            return
        fpairs.add((x, y))
        session.add(Friendship(user_a=x, user_b=y, status=status, requested_by=(by or a).id))

    friends = stars[:2] + rng.sample(people[:120], 4)
    for f in friends:
        befriend(maya, f)
    others = [p for p in people[:120] if p not in friends]
    for f in rng.sample(others, 2):
        befriend(f, maya, "pending", by=f)
    befriend(maya, stars[2], "pending", by=maya)
    for _ in range(220):
        a, b = rng.sample(people, 2)
        befriend(a, b, "accepted" if rng.random() < 0.85 else "pending")
    session.flush()

    # ---------- chats ----------
    parts_by_act: dict[int, list[int]] = {}
    for p in session.exec(select(Participation).where(Participation.status == "going")):
        parts_by_act.setdefault(p.activity_id, []).append(p.user_id)
    for a in activities:
        chat = Chat(kind="activity", activity_id=a.id, name=a.title, hobby_id=a.hobby_id, created_at=a.created_at)
        session.add(chat)
        session.flush()
        members = list(dict.fromkeys([a.host_id] + parts_by_act.get(a.id, [])))
        for uid in members:
            session.add(ChatMember(chat_id=chat.id, user_id=uid))
        if maya.id in members or rng.random() < 0.25:
            t = a.created_at + timedelta(hours=2)
            for _ in range(rng.randint(2, 6)):
                uid = rng.choice(members)
                if uid == maya.id and a.ends_at > now:
                    continue
                t += timedelta(minutes=rng.randint(10, 600))
                if t > now:
                    break
                session.add(Message(chat_id=chat.id, user_id=uid, body=rng.choice(CHAT_LINES), created_at=t))
    # Maya's game-night chat gets real banter.
    game_chat = session.exec(select(Chat).where(Chat.activity_id == maya_host.id)).first()
    lines = [(stars[2], "Legend. I've got Codenames covered, bring Catan?"), (maya, "Yes! And snacks 🍿"),
             (stars[0], "Can we do Wingspan after? I'll teach"), (stars[1], "In. Running from the gym, might be 10 min late")]
    t = now - timedelta(hours=20)
    for u, body in lines:
        t += timedelta(minutes=rng.randint(20, 180))
        session.add(Message(chat_id=game_chat.id, user_id=u.id, body=body, created_at=t))
    # A DM and a friend group chat.
    dm = Chat(kind="dm")
    session.add(dm)
    session.flush()
    for u in (maya, stars[0]):
        session.add(ChatMember(chat_id=dm.id, user_id=u.id))
    t = now - timedelta(days=1, hours=3)
    for u, body in [(stars[0], "Hey! Fun climbing last week. You were so close on that pink V4"),
                    (maya, "Haha thanks, next time for sure"), (stars[0], "Want to play go Tuesday? The club has free boards"),
                    (maya, "Yes!! I'm still a 20 kyu though"), (stars[0], "Perfect, I'll go easy 😄")]:
        t += timedelta(minutes=rng.randint(5, 90))
        session.add(Message(chat_id=dm.id, user_id=u.id, body=body, created_at=t))
    grp = Chat(kind="group", name="Climbing crew 🧗", hobby_id="bouldering")
    session.add(grp)
    session.flush()
    for u in [maya, stars[1], *friends[2:4]]:
        session.add(ChatMember(chat_id=grp.id, user_id=u.id))
    t = now - timedelta(days=2)
    for u, body in [(stars[1], "Anyone want to try the new set at Ballard Block on Saturday?"),
                    (friends[2], "I'm in after 11"), (maya, "Same! Let's do 11:30")]:
        t += timedelta(minutes=rng.randint(10, 120))
        session.add(Message(chat_id=grp.id, user_id=u.id, body=body, created_at=t))
    session.commit()

    # Mark Maya's chats as mostly read, leaving a couple unread.
    for cm in session.exec(select(ChatMember).where(ChatMember.user_id == maya.id)):
        msgs = session.exec(select(Message).where(Message.chat_id == cm.chat_id).order_by(Message.id)).all()
        if msgs:
            cm.last_read_id = msgs[-1].id if cm.chat_id not in (dm.id, game_chat.id) else msgs[-3].id
            session.add(cm)
    session.commit()
