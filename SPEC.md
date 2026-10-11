# Tandem — spec & API contract

Tandem is a Seattle-first app for making friends through hobbies: real activities on a map
(hosted by people and local spots), people ranked by an explainable Friend Score, group chats,
badges, a Vibe Check quiz, and automatic small-group suggestions from overlapping free time.
Inspired by hobbyful.app; own name, own branding, own code.

## Stack
- `api/` — FastAPI + SQLModel + SQLite (file `api/tandem.db`, Postgres-ready via `DATABASE_URL`),
  JWT auth, WebSockets for chat, pytest. Python 3.12+ via `uv`. Run: `cd api && uv run uvicorn app.main:app --reload --port 8000`
- `web/` — React 19 + TypeScript + Vite + Tailwind v4 (`@tailwindcss/vite`), react-router v7,
  Leaflet (`react-leaflet`) with OSM/Carto tiles, mobile-first (max-w ~480px centered on desktop),
  PWA later. Dev server proxies `/api` and `/ws` to `localhost:8000`.
- Single Dockerfile later: build web, serve `web/dist` from FastAPI for Cloud Run.

## Design
- Warm, playful, friendly. Cream background `#FFF8EF`, ink `#1F1A17`, primary coral `#FF6B4A`,
  secondary teal `#1FA59A`, sunshine `#FFC94A`, lilac `#B9A6FF`. Rounded-2xl cards, soft shadows.
- Fonts (Google Fonts): headings "Bricolage Grotesque" (700/800), body "Figtree".
- Every hobby has an emoji + color. Bottom tab bar: Activities · People · Chats · Me.

## Domain
- **Hobby**: id (slug), name, emoji, category. ~80 seeded across categories
  (Games, Sports, Outdoors, Arts & Crafts, Music, Food & Drink, Learning, Wellness, Tech).
  Users may add custom hobbies (category "Custom").
- **User**: id, email, first_name, last_name (only initial shown), birth_year, neighborhood,
  lat, lng (neighborhood centroid, never exact), bio, languages (list), instagram,
  avatar (emoji+color string like `"🦊|#FFC94A"` or photo url), friend_code (6 chars),
  open_to_plans (bool), vibe (dict trait->float in [-1,1]: competitive, chill, chatty, planner, night_owl),
  created_at, is_business (bool), business_name.
- **UserHobby**: user_id, hobby_id, level (1 beginner … 4 expert), years, open_to_plans (bool).
- **Availability**: user_id, weekday (0=Mon..6), slot ("morning"|"afternoon"|"evening").
- **Activity**: id, host_id, hobby_id, title, description, starts_at, ends_at (ISO UTC),
  venue_name, neighborhood, lat, lng, location_privacy ("exact"|"area"), capacity (nullable),
  cost_cents (0 = free), level ("any"|"beginner"|"intermediate"|"advanced"),
  requires_approval (bool), recurring_weekly (bool), cancelled (bool), created_at.
- **Participation**: activity_id, user_id, status ("going"|"requested"|"waitlist"|"declined"),
  checked_in (bool), rating (1-5 nullable), note.
- **Friendship**: user_a, user_b, status ("pending"|"accepted"), requested_by, created_at.
- **Chat**: id, kind ("activity"|"group"|"dm"), activity_id nullable, name nullable. **ChatMember**. **Message**: id, chat_id, user_id, body, created_at.
- **Badge**: computed, not stored: per hobby, count of checked-in activities →
  Bronze (1), Silver (3), Gold (10), Platinum (25), Legendary (50). Plus "Host" badges by hosted count.

## Friend Score (the core differentiator — `api/app/scoring.py`, pure functions, unit-tested)
Score 0–100 between viewer A and candidate B, returned with an explanation breakdown:
- **Shared hobbies (max 55)**: sum over shared hobbies of `idf(h) * level_closeness`, where
  `idf(h) = ln(N / (1 + users_with_h)) ` normalized, `level_closeness = 1 - |la-lb|/3`. Rare shared
  hobbies weigh more ("you're both into bouldering AND go"). Squashed with `1 - exp(-x/k)`.
- **Free-time overlap (max 15)**: Jaccard of availability slots.
- **Proximity (max 15)**: haversine km between neighborhood centroids, `15 * exp(-km/6)`.
- **Vibe (max 10)**: cosine similarity of vibe vectors mapped to [0,10]; 5 if either missing.
- **Age (max 5)**: `5 * exp(-|ageA-ageB|/8)`.
Response `breakdown`: list of `{key, label, points, max, detail}` plus `shared_hobbies` list.

## Group suggestions (`api/app/grouping.py`, unit-tested)
For a user U who is open_to_plans: for each of U's open hobbies h, candidates = open-to-plans users
with h within 10 km. For each (weekday, slot) U is free, take candidates free then; greedily build a
group of 3–5 maximizing the average pairwise Friend Score (seed with U, add best marginal member).
Return top suggestions sorted by quality: `{hobby, weekday, slot, members:[UserCard], score, reason}`.
Accepting a suggestion creates a group chat with those members and a draft activity.

## API (all JSON, prefix `/api`; auth via `Authorization: Bearer <jwt>`)
Auth (dev-friendly passwordless):
- `POST /api/auth/request-code {email}` → `{sent: true, dev_code: "123456"}` (dev_code always returned in dev)
- `POST /api/auth/verify {email, code}` → `{token, user: Me, is_new: bool}`
- `POST /api/auth/demo` → `{token, user: Me}` signs in as seeded demo user "Maya K." (for recruiters)

Me / profile:
- `GET /api/me` → Me (User + hobbies + availability + badges + stats)
- `PATCH /api/me {first_name?, last_name?, birth_year?, neighborhood?, bio?, languages?, instagram?, avatar?, open_to_plans?}`
- `PUT /api/me/hobbies [{hobby_id, level, years?, open_to_plans?}]`
- `PUT /api/me/availability [{weekday, slot}]`
- `PUT /api/me/vibe {answers: [{question_id, option_id}]}` → `{vibe, summary}`
- `POST /api/me/parse-hobbies {text}` → `{hobbies:[{hobby_id, level}], used_ai: bool}` (Gemini if `GEMINI_API_KEY`, else keyword/fuzzy match)

Reference:
- `GET /api/hobbies?q=` → `[Hobby]`; `POST /api/hobbies {name, emoji?}` → Hobby (custom)
- `GET /api/neighborhoods` → `[{name, lat, lng}]` (~40 Seattle neighborhoods)
- `GET /api/vibe-questions` → `[{id, hobby_id, prompt, options:[{id, text}]}]`

People:
- `GET /api/people?hobby=&age_min=&age_max=&max_km=` → `[UserCard]` sorted by score desc,
  where `UserCard = {id, display_name ("Maya K."), age, neighborhood, avatar, bio, hobbies:[{hobby_id, level}], score, top_reason, friend_status ("none"|"pending_out"|"pending_in"|"friends")}`
- `GET /api/people/{id}` → `{...UserCard, languages, instagram (if friends), badges, breakdown, shared_hobbies, upcoming_activities:[ActivityCard]}`

Friends:
- `GET /api/friends` → `{friends:[UserCard], incoming:[UserCard], outgoing:[UserCard]}`
- `POST /api/friends/{user_id}` (request or accept) · `DELETE /api/friends/{user_id}`
- `POST /api/friends/code {code}` → adds by friend code (auto-accepted)

Activities:
- `GET /api/activities?hobby=&day=today|week|weekend&q=&mine=hosting|going` →
  `[ActivityCard]` upcoming, sorted by starts_at. `ActivityCard = {id, title, hobby_id, host:{id, display_name, avatar, is_business}, starts_at, ends_at, venue_name, neighborhood, lat, lng (jittered ~400m if privacy=area and viewer not going), cost_cents, level, capacity, going_count, my_status, friends_going:[{id, display_name, avatar}], recurring_weekly}`
- `GET /api/activities/{id}` → ActivityCard + `{description, location_privacy, requires_approval, attendees:[UserCard-lite], requests (host only), chat_id (if going/host), cancelled, is_past}`
- `POST /api/activities {hobby_id, title, description, starts_at, ends_at, venue_name, neighborhood, lat, lng, location_privacy, capacity?, cost_cents, level, requires_approval, recurring_weekly}` → detail
- `PATCH /api/activities/{id}` (host) · `POST /api/activities/{id}/cancel` (host)
- `POST /api/activities/{id}/join {note?}` → status going / requested / waitlist (full)
- `POST /api/activities/{id}/leave` (promotes first waitlist)
- `POST /api/activities/{id}/requests/{user_id} {approve: bool}` (host)
- `POST /api/activities/{id}/checkin` (within start-30min .. end+2h; demo mode allows any past)
- `POST /api/activities/{id}/rate {rating, note?}` (after it ended, checked in)

Suggestions:
- `GET /api/suggestions` → `[GroupSuggestion]`; `POST /api/suggestions/accept {hobby_id, weekday, slot, member_ids}` → `{chat_id}`

Chats:
- `GET /api/chats` → `[{id, kind, name, activity_id, avatar_hobby_id, last_message, unread, members:[{id, display_name, avatar}]}]`
- `GET /api/chats/{id}/messages?before=` → `[Message {id, chat_id, user:{id, display_name, avatar}, body, created_at}]`
- `POST /api/chats/{id}/messages {body}` → Message (also broadcast over WS)
- `POST /api/chats {member_ids, name?}` → group chat (friends only); DMs: `POST /api/chats/dm/{user_id}`
- `WS /ws?token=<jwt>` → server pushes `{type:"message", message}`; client may send `{type:"typing", chat_id}`
- Profanity filter on message bodies (small word list) → 422 with friendly error.

Stats / misc:
- `GET /api/badges` → my badge list `[{hobby_id, tier, count, next_tier, next_at}]`
- `GET /api/health`

## Seed (`api/app/seed.py`, runs on startup if DB empty)
Deterministic (random.Random(42)): ~120 users across Seattle neighborhoods with realistic first
names, 3–6 hobbies each (power-law popularity so IDF matters), availability, vibe; ~25 local
businesses/clubs ("Lakeside Loop Runners", "Cap Hill Board Game Café", ...); ~80 activities over
the next 14 days + some past ones with attendance/check-ins so badges show; friendships and some
chat history. Demo user: Maya K., 27, Fremont, hobbies bouldering(3), board games(2), pottery(1),
trail running(2), go(2); with a few friends, upcoming joined activities, Bronze/Silver badges.

## Frontend pages (`web/src/pages`)
- `/welcome` — hero + "Try the demo" (POST /auth/demo) + "Sign up with email".
- `/onboarding` — steps: name & age → neighborhood → hobbies (search chips + "speak your hobbies" textbox) + levels → free times grid → optional Vibe Check → done (animated logo of hobby emojis).
- `/` Activities — toggle Map / List; filter chips (Today/This week/Weekend, hobby); cards; FAB "Host".
- `/activities/:id` — detail, map, attendees, join/leave/request, chat link, check-in, rate.
- `/host` — create activity form with map pin picker.
- `/people` — "Suggested groups" carousel on top, then people list with score ring + top reason; filters.
- `/people/:id` — profile, Friend Score ring with breakdown bars ("See how it adds up"), shared hobbies, badges, upcoming activities, add friend / message.
- `/chats`, `/chats/:id` — real-time chat over WS.
- `/me` — profile, hobbies, badges grid, friend code + add by code, settings (open to plans, sign out).
- `/vibe` — the Vibe Check quiz (one scenario per screen).
