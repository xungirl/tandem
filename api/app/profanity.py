import re

# Deliberately small list; enough to show the guardrail without being exhaustive.
_WORDS = [
    "fuck", "shit", "bitch", "cunt", "asshole", "dick", "bastard", "slut", "whore",
    "fag", "retard", "nigger", "nigga", "pussy", "cock",
]
# Allow common leetspeak/obfuscations like f*ck, sh1t, f.u.c.k
_SUBS = {"a": "[a@4*]", "i": "[i1!*]", "o": "[o0*]", "u": "[u*v]", "e": "[e3*]", "s": "[s$5]"}


def _pattern(word: str) -> str:
    return r"[^\w\s]*".join(_SUBS.get(c, re.escape(c)) for c in word)


_RE = re.compile(r"\b(" + "|".join(_pattern(w) for w in _WORDS) + r")(?:s|es|ed|ing|er|ers|y|ty)?\b", re.IGNORECASE)


def contains_profanity(text: str) -> bool:
    return bool(_RE.search(text))
