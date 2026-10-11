"""Seed hobbies: (slug, name, emoji, category, color, popularity weight).

Popularity drives how many seeded users pick each hobby (power law), so IDF weighting
in the Friend Score has something to bite on.
"""

CATEGORY_COLORS = {
    "Games": "#B9A6FF",
    "Sports": "#FF6B4A",
    "Outdoors": "#1FA59A",
    "Arts & Crafts": "#FFC94A",
    "Music": "#FF8FB1",
    "Food & Drink": "#FF9F43",
    "Learning": "#5B8DEF",
    "Wellness": "#7BC67E",
    "Tech": "#8E8AA8",
    "Custom": "#C9B8A8",
}

HOBBIES = [
    # Games
    ("board-games", "Board games", "🎲", "Games", 10),
    ("chess", "Chess", "♟️", "Games", 5),
    ("go", "Go (baduk)", "⚫", "Games", 1),
    ("dnd", "D&D", "🐉", "Games", 4),
    ("trivia", "Pub trivia", "🧠", "Games", 7),
    ("video-games", "Video games", "🎮", "Games", 8),
    ("mtg", "Magic: The Gathering", "🃏", "Games", 3),
    ("poker", "Poker", "♠️", "Games", 3),
    ("mahjong", "Mahjong", "🀄", "Games", 2),
    ("puzzles", "Jigsaw puzzles", "🧩", "Games", 2),
    # Sports
    ("running", "Running", "🏃", "Sports", 9),
    ("trail-running", "Trail running", "⛰️", "Sports", 4),
    ("bouldering", "Bouldering", "🧗", "Sports", 7),
    ("pickleball", "Pickleball", "🏓", "Sports", 7),
    ("tennis", "Tennis", "🎾", "Sports", 5),
    ("soccer", "Soccer", "⚽", "Sports", 5),
    ("basketball", "Basketball", "🏀", "Sports", 4),
    ("volleyball", "Volleyball", "🏐", "Sports", 4),
    ("ultimate", "Ultimate frisbee", "🥏", "Sports", 3),
    ("cycling", "Cycling", "🚴", "Sports", 6),
    ("swimming", "Swimming", "🏊", "Sports", 4),
    ("bowling", "Bowling", "🎳", "Sports", 3),
    ("golf", "Golf", "⛳", "Sports", 3),
    ("skiing", "Skiing", "⛷️", "Sports", 5),
    ("snowboarding", "Snowboarding", "🏂", "Sports", 3),
    ("martial-arts", "Martial arts", "🥋", "Sports", 2),
    ("rowing", "Rowing", "🚣", "Sports", 1),
    ("weightlifting", "Weightlifting", "🏋️", "Sports", 5),
    ("disc-golf", "Disc golf", "🥏", "Sports", 2),
    ("surfing", "Surfing", "🏄", "Sports", 1),
    # Outdoors
    ("hiking", "Hiking", "🥾", "Outdoors", 10),
    ("camping", "Camping", "⛺", "Outdoors", 5),
    ("kayaking", "Kayaking", "🛶", "Outdoors", 4),
    ("birding", "Birdwatching", "🐦", "Outdoors", 2),
    ("foraging", "Mushroom foraging", "🍄", "Outdoors", 1),
    ("gardening", "Gardening", "🌱", "Outdoors", 4),
    ("beach-cleanup", "Beach cleanups", "🏖️", "Outdoors", 2),
    ("sailing", "Sailing", "⛵", "Outdoors", 1),
    ("stargazing", "Stargazing", "🔭", "Outdoors", 2),
    # Arts & Crafts
    ("pottery", "Pottery", "🏺", "Arts & Crafts", 4),
    ("painting", "Painting", "🎨", "Arts & Crafts", 5),
    ("knitting", "Knitting", "🧶", "Arts & Crafts", 3),
    ("photography", "Photography", "📷", "Arts & Crafts", 6),
    ("sketching", "Sketching", "✏️", "Arts & Crafts", 3),
    ("woodworking", "Woodworking", "🪚", "Arts & Crafts", 2),
    ("embroidery", "Embroidery", "🪡", "Arts & Crafts", 2),
    ("film-making", "Film making", "🎬", "Arts & Crafts", 2),
    ("writing", "Creative writing", "✍️", "Arts & Crafts", 3),
    ("improv", "Improv", "🎭", "Arts & Crafts", 2),
    # Music
    ("guitar", "Guitar", "🎸", "Music", 5),
    ("piano", "Piano", "🎹", "Music", 3),
    ("singing", "Singing", "🎤", "Music", 3),
    ("karaoke", "Karaoke", "🎙️", "Music", 5),
    ("concerts", "Live music", "🎶", "Music", 7),
    ("djing", "DJing", "🎧", "Music", 2),
    ("choir", "Choir", "🎼", "Music", 1),
    ("salsa", "Salsa dancing", "💃", "Music", 3),
    # Food & Drink
    ("cooking", "Cooking", "🍳", "Food & Drink", 8),
    ("baking", "Baking", "🥐", "Food & Drink", 5),
    ("coffee", "Specialty coffee", "☕", "Food & Drink", 6),
    ("wine", "Wine tasting", "🍷", "Food & Drink", 3),
    ("craft-beer", "Craft beer", "🍺", "Food & Drink", 4),
    ("brunch", "Brunch", "🥞", "Food & Drink", 5),
    ("fermentation", "Fermentation", "🫙", "Food & Drink", 1),
    # Learning
    ("book-club", "Book club", "📚", "Learning", 6),
    ("languages", "Language exchange", "🗣️", "Learning", 4),
    ("museums", "Museums", "🏛️", "Learning", 4),
    ("anime", "Anime & manga", "🍙", "Learning", 4),
    ("movies", "Movie nights", "🍿", "Learning", 7),
    ("history", "History walks", "🗺️", "Learning", 1),
    # Wellness
    ("yoga", "Yoga", "🧘", "Wellness", 7),
    ("meditation", "Meditation", "🕯️", "Wellness", 3),
    ("pilates", "Pilates", "🤸", "Wellness", 3),
    ("dog-walks", "Dog walks", "🐕", "Wellness", 5),
    ("sauna", "Sauna & cold plunge", "🧖", "Wellness", 2),
    # Tech
    ("coding", "Side projects (coding)", "💻", "Tech", 5),
    ("hackathons", "Hackathons", "⚡", "Tech", 2),
    ("3d-printing", "3D printing", "🖨️", "Tech", 1),
    ("electronics", "Electronics tinkering", "🔌", "Tech", 1),
    ("ai", "AI & ML meetups", "🤖", "Tech", 3),
]

# Extra words that map to a hobby for the keyword parser.
ALIASES = {
    "climbing": "bouldering", "climb": "bouldering", "rock climbing": "bouldering",
    "boardgames": "board-games", "catan": "board-games", "board game": "board-games",
    "baduk": "go", "play go": "go", "go game": "go", "go club": "go", "try go": "go", "learning go": "go", "weiqi": "go", "dungeons": "dnd", "tabletop rpg": "dnd",
    "magic the gathering": "mtg", "jog": "running", "run": "running", "5k": "running",
    "marathon": "running", "hike": "hiking", "bike": "cycling",
    "biking": "cycling", "ceramics": "pottery", "wheel throwing": "pottery",
    "photo": "photography", "camera": "photography", "draw": "sketching", "drawing": "sketching",
    "sing": "singing", "gig": "concerts", "concert": "concerts", "bake": "baking",
    "cook": "cooking", "espresso": "coffee", "latte": "coffee", "beer": "craft-beer",
    "books": "book-club", "reading": "book-club", "read": "book-club", "film": "movies",
    "cinema": "movies", "manga": "anime", "program": "coding", "programming": "coding",
    "code": "coding", "gym": "weightlifting", "lifting": "weightlifting", "dog": "dog-walks",
    "frisbee": "ultimate", "ski": "skiing", "snowboard": "snowboarding", "kayak": "kayaking",
    "paddle": "kayaking", "birds": "birding", "mushrooms": "foraging", "jiu jitsu": "martial-arts",
    "bjj": "martial-arts", "karate": "martial-arts", "boxing": "martial-arts",
    "dance": "salsa", "dancing": "salsa", "spanish": "languages", "japanese": "languages",
    "machine learning": "ai", "llm": "ai", "games": "video-games", "gaming": "video-games",
    "knit": "knitting", "crochet": "knitting", "paint": "painting", "watercolor": "painting",
}

LEVEL_WORDS = {
    1: ["new to", "beginner", "learning", "want to try", "never", "just started", "newbie", "curious"],
    3: ["pretty good", "intermediate", "years of", "regularly", "every week", "decent", "a lot", "all the time", "most weekends"],
    4: ["expert", "advanced", "competitive", "pro", "coach", "teach", "instructor", "obsessed"],
}
