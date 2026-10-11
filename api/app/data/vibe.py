"""Vibe Check: short scenarios. Each option nudges traits in [-1, 1].

Traits: competitive, chill, chatty, planner, night_owl.
"""

TRAITS = ["competitive", "chill", "chatty", "planner", "night_owl"]

VIBE_QUESTIONS = [
    {
        "id": "q1", "hobby_id": "board-games",
        "prompt": "Hour three of Twilight Imperium. Someone suggests 'just one more round'.",
        "options": [
            {"id": "a", "text": "Yes. I have a comeback plan.", "fx": {"competitive": 0.8, "night_owl": 0.5}},
            {"id": "b", "text": "Only if someone orders dumplings", "fx": {"chill": 0.6, "chatty": 0.3}},
            {"id": "c", "text": "I set a hard stop at 10 and I'm honoring it", "fx": {"planner": 0.9, "night_owl": -0.7}},
        ],
    },
    {
        "id": "q2", "hobby_id": "hiking",
        "prompt": "The trailhead lot is full at 7:40am. You:",
        "options": [
            {"id": "a", "text": "Saw this coming. Already have plan B on a map.", "fx": {"planner": 0.9}},
            {"id": "b", "text": "Park a mile away and make it a warm-up", "fx": {"chill": 0.5, "competitive": 0.3}},
            {"id": "c", "text": "7:40am?? I'm still asleep", "fx": {"night_owl": 0.9, "planner": -0.4}},
        ],
    },
    {
        "id": "q3", "hobby_id": "pottery",
        "prompt": "Your bowl comes out of the kiln looking like a sad ashtray.",
        "options": [
            {"id": "a", "text": "It's an ashtray now. It was always an ashtray.", "fx": {"chill": 0.9}},
            {"id": "b", "text": "Show the whole studio and ask for a critique", "fx": {"chatty": 0.8}},
            {"id": "c", "text": "Twelve more tries before the class ends", "fx": {"competitive": 0.7, "planner": 0.2}},
        ],
    },
    {
        "id": "q4", "hobby_id": "trivia",
        "prompt": "Your team is one point behind going into the final round.",
        "options": [
            {"id": "a", "text": "Go all in on the wager. Fortune favors the bold.", "fx": {"competitive": 0.9}},
            {"id": "b", "text": "We came for the nachos honestly", "fx": {"chill": 0.8, "competitive": -0.6}},
            {"id": "c", "text": "Make friends with the winning team at the bar", "fx": {"chatty": 0.9}},
        ],
    },
    {
        "id": "q5", "hobby_id": "running",
        "prompt": "Group run. Someone starts going way faster than the agreed pace.",
        "options": [
            {"id": "a", "text": "Match them. Every. Step.", "fx": {"competitive": 0.9}},
            {"id": "b", "text": "Stay back and chat with whoever's at the back", "fx": {"chatty": 0.7, "chill": 0.5}},
            {"id": "c", "text": "Remind everyone of the pace in the group chat after", "fx": {"planner": 0.8}},
        ],
    },
    {
        "id": "q6", "hobby_id": "karaoke",
        "prompt": "It's 1am and the karaoke host says 'last song'.",
        "options": [
            {"id": "a", "text": "Bohemian Rhapsody. Full six minutes.", "fx": {"night_owl": 0.9, "chatty": 0.4}},
            {"id": "b", "text": "I left at 11. Sleep is a hobby too.", "fx": {"night_owl": -0.9, "planner": 0.3}},
            {"id": "c", "text": "Hype-man whoever's singing", "fx": {"chatty": 0.6, "chill": 0.4}},
        ],
    },
    {
        "id": "q7", "hobby_id": "cooking",
        "prompt": "Potluck. Your dish is... not great.",
        "options": [
            {"id": "a", "text": "Bring it anyway and narrate the backstory", "fx": {"chatty": 0.8, "chill": 0.4}},
            {"id": "b", "text": "Pick up something fancy on the way and say nothing", "fx": {"planner": 0.5, "competitive": 0.4}},
            {"id": "c", "text": "Mine was a test run. Next month I'm winning.", "fx": {"competitive": 0.8}},
        ],
    },
    {
        "id": "q8", "hobby_id": "bouldering",
        "prompt": "A stranger at the gym offers beta on your project, unsolicited.",
        "options": [
            {"id": "a", "text": "Thanks! Want to work it together?", "fx": {"chatty": 0.8, "chill": 0.3}},
            {"id": "b", "text": "Nod politely and do it my way", "fx": {"competitive": 0.6}},
            {"id": "c", "text": "Write it down in my climbing journal", "fx": {"planner": 0.8}},
        ],
    },
    {
        "id": "q9", "hobby_id": "book-club",
        "prompt": "Book club tonight. You read 40% of the book.",
        "options": [
            {"id": "a", "text": "Confidently discuss the ending I made up", "fx": {"chatty": 0.7, "chill": 0.5}},
            {"id": "b", "text": "Speed-read the rest at lunch. No shortcuts.", "fx": {"planner": 0.7, "competitive": 0.4}},
            {"id": "c", "text": "Bring wine and listen", "fx": {"chill": 0.8, "chatty": -0.3}},
        ],
    },
    {
        "id": "q10", "hobby_id": "camping",
        "prompt": "It starts pouring rain right after you pitch the tent.",
        "options": [
            {"id": "a", "text": "Tarp was already up. I checked the radar.", "fx": {"planner": 0.9}},
            {"id": "b", "text": "Card games in the tent, best night ever", "fx": {"chill": 0.7, "chatty": 0.4}},
            {"id": "c", "text": "Rain hike. Who's in?", "fx": {"competitive": 0.5, "chill": 0.3}},
        ],
    },
    {
        "id": "q11", "hobby_id": "video-games",
        "prompt": "Your friend picks the strongest character every single match.",
        "options": [
            {"id": "a", "text": "Learn the counter and destroy them", "fx": {"competitive": 0.9}},
            {"id": "b", "text": "Pick the worst character for comedy", "fx": {"chill": 0.8}},
            {"id": "c", "text": "Propose a random-select rule for next time", "fx": {"planner": 0.6, "chatty": 0.3}},
        ],
    },
    {
        "id": "q12", "hobby_id": "coffee",
        "prompt": "New café opens. The line is 25 minutes long.",
        "options": [
            {"id": "a", "text": "Wait and chat with the people in line", "fx": {"chatty": 0.9}},
            {"id": "b", "text": "Come back Tuesday at 2pm when it's empty", "fx": {"planner": 0.8}},
            {"id": "c", "text": "My usual spot is right there", "fx": {"chill": 0.6}},
        ],
    },
    {
        "id": "q13", "hobby_id": "pickleball",
        "prompt": "Your doubles partner keeps poaching every ball.",
        "options": [
            {"id": "a", "text": "Let them. More time to wave at the next court.", "fx": {"chill": 0.7, "chatty": 0.4}},
            {"id": "b", "text": "Call 'mine!' louder than humanly possible", "fx": {"competitive": 0.8, "chatty": 0.3}},
            {"id": "c", "text": "Quick strategy chat between games", "fx": {"planner": 0.7}},
        ],
    },
    {
        "id": "q14", "hobby_id": "movies",
        "prompt": "Movie night. Nobody can agree on what to watch.",
        "options": [
            {"id": "a", "text": "I made a ranked-choice ballot", "fx": {"planner": 0.9}},
            {"id": "b", "text": "I'll watch anything. Pass the popcorn.", "fx": {"chill": 0.9}},
            {"id": "c", "text": "Pitch my pick like it's a Netflix sales meeting", "fx": {"chatty": 0.6, "competitive": 0.5}},
        ],
    },
    {
        "id": "q15", "hobby_id": "concerts",
        "prompt": "The band announces a surprise second encore at 11:45pm.",
        "options": [
            {"id": "a", "text": "Front row. Then the after-party.", "fx": {"night_owl": 0.9, "chatty": 0.3}},
            {"id": "b", "text": "Already in an Uber, beating the crowd", "fx": {"planner": 0.7, "night_owl": -0.5}},
            {"id": "c", "text": "Stay at the back and enjoy it", "fx": {"chill": 0.7}},
        ],
    },
]

TRAIT_LABELS = {
    "competitive": ("Competitive", "Easygoing about winning"),
    "chill": ("Laid-back", "Intense"),
    "chatty": ("Social butterfly", "Quiet company"),
    "planner": ("Planner", "Spontaneous"),
    "night_owl": ("Night owl", "Early bird"),
}
