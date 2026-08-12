"""
content_filter.py

Content moderation engine for live chat messaging:
1. Filters racial slurs, derogatory terms, hate speech, and profanity.
2. Enforces anti-spam rate limits (max 5 messages per 5 seconds per user).
"""

from __future__ import annotations

import re
import time
from collections import defaultdict


# Common profanity, racial slurs, and derogatory terms patterns for content moderation
FORBIDDEN_TERMS = [
    # Racial slurs and hate speech
    r"\bn[i1l]gg[ea1r]s?\b",
    r"\bfag[g0o]ts?\b",
    r"\bkyke\b",
    r"\bch[i1]nk\b",
    r"\bsp[i1]c\b",
    r"\bwetback\b",
    r"\braghead\b",
    r"\bcoon\b",
    r"\btrann[yi]\b",
    # Excessive profanity / harassment
    r"\bfuck\b",
    r"\bshit\b",
    r"\bwhore\b",
    r"\bslut\b",
    r"\bcunt\b",
    r"\bbitch\b",
    r"\basshole\b",
    r"\bretard\b",
]

FORBIDDEN_REGEX = re.compile("|".join(FORBIDDEN_TERMS), re.IGNORECASE)


class ContentFilter:
    def __init__(self, max_messages_per_window: int = 5, window_seconds: float = 5.0):
        self.max_messages_per_window = max_messages_per_window
        self.window_seconds = window_seconds
        self._user_timestamps: dict[str, list[float]] = defaultdict(list)

    def contains_forbidden_terms(self, text: str) -> bool:
        if not text:
            return False
        return bool(FORBIDDEN_REGEX.search(text))

    def censor_text(self, text: str) -> str:
        if not text:
            return text
        return FORBIDDEN_REGEX.sub("***", text)

    def check_rate_limit(self, user_id: str) -> bool:
        """Returns True if user is allowed to send, False if rate limited for spamming."""
        now = time.time()
        timestamps = self._user_timestamps[user_id]
        
        # Remove timestamps older than window
        valid_timestamps = [t for t in timestamps if now - t <= self.window_seconds]
        self._user_timestamps[user_id] = valid_timestamps

        if len(valid_timestamps) >= self.max_messages_per_window:
            return False

        self._user_timestamps[user_id].append(now)
        return True


content_filter = ContentFilter()
