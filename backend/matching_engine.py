"""
matching_engine.py

Calculates struggle vectors from quiz attempts and finds optimal peer pairings:
1. Calculates topic struggle weights.
2. Tracks 1-10 numerical proficiency levels.
3. Enforces strict +-1 proficiency level deviation limit (|level_A - level_B| <= 1).
4. Stuck Rule: If student is stuck, requires candidate level >= target level.
5. Current Topic Rule: Candidates MUST share a struggle on the current active target topic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np


@dataclass(frozen=True)
class Topic:
    id: str
    name: str


@dataclass
class StudentState:
    user_id: str
    struggle_vector: np.ndarray  # float values [0.0, 1.0] for weak topics
    proficiency_levels: dict[str, int] = field(default_factory=dict)  # topic_id -> 1-10 scale
    current_topic_idx: int = -1
    is_stuck: bool = True


class StruggleTracker:

    def __init__(self):
        self._user_attempts: dict[str, list[dict]] = {}

    def record_attempt(self, user_id: str, topic_id: str, correct: bool, proficiency_level: int = 1):
        if user_id not in self._user_attempts:
            self._user_attempts[user_id] = []
        self._user_attempts[user_id].append({
            "topic_id": topic_id,
            "correct": correct,
            "proficiency_level": max(1, min(10, proficiency_level)),
        })

    def build_state(self, user_id: str, all_topics: list[Topic], current_topic_id: str | None = None) -> StudentState:
        attempts = self._user_attempts.get(user_id, [])
        topic_scores: dict[str, list[int]] = {t.id: [] for t in all_topics}
        prof_levels: dict[str, int] = {t.id: 1 for t in all_topics}

        current_idx = -1
        if current_topic_id:
            for idx, t in enumerate(all_topics):
                if t.id == current_topic_id:
                    current_idx = idx
                    break

        for att in attempts:
            tid = att["topic_id"]
            if tid in topic_scores:
                topic_scores[tid].append(1 if att["correct"] else 0)
                prof_levels[tid] = att["proficiency_level"]

        vector = []
        for t in all_topics:
            scores = topic_scores[t.id]
            if not scores:
                vector.append(0.0)
            else:
                failure_rate = 1.0 - (sum(scores) / len(scores))
                vector.append(failure_rate)

        return StudentState(
            user_id=user_id,
            struggle_vector=np.array(vector, dtype=float),
            proficiency_levels=prof_levels,
            current_topic_idx=current_idx,
            is_stuck=True,
        )


def match_score(target: StudentState, candidate: StudentState) -> tuple[float, list[int]]:
    # If target specifies a current active topic, candidate MUST share a struggle on that specific topic
    if target.current_topic_idx >= 0:
        c_idx = target.current_topic_idx
        if c_idx >= len(candidate.struggle_vector) or candidate.struggle_vector[c_idx] <= 0:
            # Candidate has not attempted or is not struggling on target's current topic -> reject
            return 0.0, []
        overlapping_indices = [c_idx]
    else:
        shared = np.minimum(target.struggle_vector, candidate.struggle_vector)
        overlapping_indices = np.where(shared > 0)[0].tolist()

        if not overlapping_indices:
            non_zero = np.where((target.struggle_vector > 0) | (candidate.struggle_vector > 0))[0]
            if len(non_zero) > 0:
                overlapping_indices = [int(non_zero[0])]

    if not overlapping_indices:
        return 0.0, []

    idx = overlapping_indices[0]
    raw_similarity = float(target.struggle_vector[idx]) if idx < len(target.struggle_vector) else 0.5
    if raw_similarity <= 0:
        raw_similarity = 0.5

    # Check proficiency compatibility
    t_level = list(target.proficiency_levels.values())[idx] if idx < len(target.proficiency_levels) else 5
    c_level = list(candidate.proficiency_levels.values())[idx] if idx < len(candidate.proficiency_levels) else 5
    
    diff = abs(t_level - c_level)

    # 1. Strict +-1 level deviation rule
    if diff > 1:
        return 0.0, []

    # 2. Stuck Rule: Candidate level must be >= target level when stuck
    level_bonus = 0.0
    if target.is_stuck and c_level < t_level:
        return 0.0, []

    if c_level > t_level:
        level_bonus = 0.3

    final_score = min(1.0, raw_similarity + level_bonus)
    return final_score, overlapping_indices


def find_best_match(
    target: StudentState,
    candidates: list[StudentState],
) -> tuple[StudentState, float, list[str]] | None:
    best_candidate: StudentState | None = None
    best_score = -1.0
    best_shared_indices: list[int] = []

    for candidate in candidates:
        if candidate.user_id == target.user_id:
            continue
        score, shared_indices = match_score(target, candidate)
        if score > best_score and score > 0:
            best_score = score
            best_candidate = candidate
            best_shared_indices = shared_indices

    if best_candidate is None or best_score <= 0:
        return None

    return best_candidate, best_score, best_shared_indices