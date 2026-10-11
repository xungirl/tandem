"""Turn free text ("I climb a lot, new to pottery") into hobbies + levels.

Uses Gemini when GEMINI_API_KEY is set, otherwise a keyword matcher with level cues.
"""

from __future__ import annotations

import json
import logging
import os
import re

from .data.hobbies import ALIASES, LEVEL_WORDS

log = logging.getLogger(__name__)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9& ]+", " ", s.lower()).strip()


def _terms(hobbies: dict[str, str]) -> dict[str, str]:
    terms: dict[str, str] = {}
    for hid, name in hobbies.items():
        terms[_norm(name)] = hid
        terms[_norm(hid.replace("-", " "))] = hid
        base = _norm(re.sub(r"\(.*?\)", "", name))
        if base:
            terms[base] = hid
    for alias, hid in ALIASES.items():
        if hid in hobbies:
            terms[_norm(alias)] = hid
    # "go" and "trail" are too common as plain words; aliases like "play go" cover them.
    return {t: h for t, h in terms.items() if len(t) >= 2 and t not in AMBIGUOUS}


AMBIGUOUS = {"go", "trail"}


CLAUSE_SPLIT = re.compile(r"[,.;!?\n]+|\b(?:and|but|also|plus|though)\b", re.IGNORECASE)


def keyword_parse(text: str, hobbies: dict[str, str]) -> list[dict]:
    """hobbies: id -> display name. Level cues are read from the clause a hobby appears in."""
    terms = _terms(hobbies)
    ordered = sorted(terms, key=len, reverse=True)  # "trail running" beats "running"
    found: dict[str, int] = {}
    for clause in CLAUSE_SPLIT.split(text):
        c = " " + _norm(clause) + " "
        if not c.strip():
            continue
        level = _clause_level(c)
        taken: list[tuple[int, int]] = []
        for term in ordered:
            for m in re.finditer(r"(?<=\s)" + re.escape(term) + r"(?:s|es|ing)?(?=\s)", c):
                s, e = m.span()
                if any(s < te and e > ts for ts, te in taken):
                    continue
                taken.append((s, e))
                found.setdefault(terms[term], level)
    return [{"hobby_id": h, "level": lvl} for h, lvl in found.items()]


def _clause_level(c: str) -> int:
    for level in (4, 1, 3):
        if any(re.search(r"\b" + re.escape(w) + r"\b", c) for w in LEVEL_WORDS[level]):
            return level
    return 2


def ai_parse(text: str, hobbies: dict[str, str]) -> list[dict] | None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from google import genai  # lazy, optional dependency
        client = genai.Client(api_key=key)
        catalog = "\n".join(f"{hid}: {name}" for hid, name in hobbies.items())
        prompt = (
            "Map the person's description to hobby ids from this catalog. Level: 1 beginner, "
            "2 casual, 3 intermediate, 4 expert. Only use ids from the catalog. Reply with JSON "
            'only: [{"hobby_id": "...", "level": 2}]\n\nCatalog:\n'
            f"{catalog}\n\nDescription: {text}"
        )
        resp = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        data = json.loads(resp.text)
        out, seen = [], set()
        for item in data:
            hid, lvl = item.get("hobby_id"), int(item.get("level", 2))
            if hid in hobbies and hid not in seen:
                seen.add(hid)
                out.append({"hobby_id": hid, "level": min(4, max(1, lvl))})
        return out
    except Exception as exc:  # network, quota, bad JSON: fall back quietly
        log.warning("Gemini hobby parse failed: %s", exc)
        return None


def parse_hobbies(text: str, hobbies: dict[str, str]) -> tuple[list[dict], bool]:
    result = ai_parse(text, hobbies)
    if result is not None:
        return result, True
    return keyword_parse(text, hobbies), False
