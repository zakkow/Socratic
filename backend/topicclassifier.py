"""
topic_classifier.py

Fixes the bug where only "recursion" (and 3 other hardcoded CS keywords)
worked. The old DevKeywordClassifier required an exact substring match
against a list of ~4 keywords per topic — anything else fell through to
"unknown." That's not a bug in the sense of broken code; it's a fallback
that was only ever seeded with 4 topics. It doesn't scale to "free roam,
any subject."

This replaces it with TF-IDF similarity: every topic gets a short
description (not just a name), free text gets compared against every
topic's description vector, and the BEST match by cosine similarity wins
— instead of requiring an exact keyword hit. This means "inequalities,"
"graphing," etc. work as soon as a topic with a reasonable description
exists, without needing to enumerate every possible phrasing.

Honest limitation: this is bag-of-words similarity, not true semantic
understanding — it still needs real word overlap between the student's
text and the topic description (so a topic's description should include
likely synonyms/phrasings). The actual upgrade path is the self-hosted
LLM classifier already built in inference_engine.py, which generalizes
on meaning rather than word overlap — swap to that once model weights
are running locally (see NOTE at the bottom of this file).
"""

from __future__ import annotations

from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class TopicDefinition:
    id: str
    name: str
    # Multiple likely phrasings a student might actually type, not just
    # the formal name — this is what makes matching robust. Add more
    # phrasings over time as you see real student input miss.
    description: str


# Default seed set. Expand this per-subject — it's what previously
# capped the demo at 4 CS topics.
DEFAULT_TOPICS = [
    TopicDefinition("loops", "Loops", "for loop while loop iteration infinite loop looping"),
    TopicDefinition(
        "recursion", "Recursion",
        "recursion recursive function base case stack overflow calling itself",
    ),
    TopicDefinition("arrays", "Arrays", "array index indexing out of bounds list element"),
    TopicDefinition(
        "bigO", "Big-O",
        "big o notation complexity runtime efficiency time complexity algorithm speed",
    ),
    TopicDefinition(
        "inequalities", "Inequalities",
        "inequality inequalities greater than less than solving flipping the sign",
    ),
    TopicDefinition(
        "graphing", "Graphing",
        "graphing graph plotting points slope intercept x axis y axis coordinate plane",
    ),
    TopicDefinition(
        "derivatives", "Derivatives",
        "derivative differentiation chain rule product rule slope of tangent",
    ),
    TopicDefinition(
        "factoring", "Factoring",
        "factoring factor quadratic polynomial fully expand distribute",
    ),
    TopicDefinition(
        "linear_equations", "Linear equations",
        "linear equation solving for x slope intercept form y equals mx plus b",
    ),
    TopicDefinition(
        "probability", "Probability",
        "probability odds chance combinations permutations independent events",
    ),
]


class TfidfTopicClassifier:
    """Drop-in replacement for DevKeywordClassifier — same Classifier
    protocol shape (classify_struggle / generate_match_explanation) so
    main.py doesn't need to change how it calls this."""

    def __init__(self, topics: list[TopicDefinition] | None = None, min_similarity: float = 0.08):
        self.topics = topics or DEFAULT_TOPICS
        self.min_similarity = min_similarity
        self._vectorizer = TfidfVectorizer(stop_words="english")
        self._topic_vectors = self._vectorizer.fit_transform(
            [t.description for t in self.topics]
        )

    async def classify_struggle(self, free_text: str) -> str:
        query_vec = self._vectorizer.transform([free_text])
        sims = cosine_similarity(query_vec, self._topic_vectors)[0]
        best_idx = sims.argmax()
        if sims[best_idx] < self.min_similarity:
            return "unknown"
        return self.topics[best_idx].id

    async def generate_match_explanation(self, name_a: str, name_b: str, topic: str) -> str:
        topic_name = next((t.name for t in self.topics if t.id == topic), topic)
        return f"{name_a} and {name_b} are both working through {topic_name} right now."


# NOTE — upgrade path to real semantic understanding:
# inference_engine.py already has a self-hosted LLM classifier built and
# tested (batching + prefix-cache-reuse). Its STRUGGLE_CLASSIFIER_PROMPT
# is currently restricted to the same 4-topic list — widen it to an
# open-ended prompt ("respond with the single most likely topic name, in
# a few words, no explanation") once you're running it against real
# weights locally, and it will generalize far better than TF-IDF because
# it understands meaning, not just word overlap.


if __name__ == "__main__":
    import asyncio

    async def _test():
        clf = TfidfTopicClassifier()
        cases = [
            ("I don't get how the base case works in recursion", "recursion"),
            ("my recursive function just stack overflows", "recursion"),
            ("I keep flipping the sign wrong when solving inequalities", "inequalities"),
            ("I don't understand how to plot points on a graph", "graphing"),
            ("what does slope and y intercept even mean", "graphing"),  # linear_equations or graphing both plausible
            ("chain rule confuses me on derivatives", "derivatives"),
            ("asdkfjaslkdfj random gibberish", "unknown"),
        ]
        for text, expected in cases:
            result = await clf.classify_struggle(text)
            marker = "✅" if result == expected else f"⚠️  (got {result}, expected {expected} — check if it's a reasonable alternative)"
            print(f"{marker}  '{text}' -> {result}")

    asyncio.run(_test())