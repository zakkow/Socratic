"""
topic_classifier.py

TF-IDF based topic classifier used during dev and testing when STUDYMATCH_USE_REAL_MODEL != "1".
"""

from __future__ import annotations

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Catalog of subjects and detailed topic taxonomy
DEFAULT_TOPIC_DESCRIPTIONS = {
    # Computer Science
    "For & While Loops": "for while loops iteration condition break continue nested loop range repeat count array loop control flow iteration index",
    "Recursion": "recursion base case recursive function call stack overflow return condition divide conquer tree recursive function",
    "Big-O Analysis": "big o notation time complexity space complexity worst case average case asymptotic algorithm performance",
    "Pointers & Memory": "pointers memory allocation malloc free reference dereference stack heap segmentation fault dangling",
    "Binary Search Trees": "binary search tree bst node left right child insert delete traversal in-order pre-order balance",
    "Hash Tables": "hash table map hashing collision resolution chaining open addressing load factor key value lookup",
    "Graph Algorithms": "graph bfs dfs breadth depth first search shortest path dijkstra adjacency list matrix cycle topological",

    # Mathematics & Arithmetic
    "Arithmetic & Order of Operations": "arithmetic order operations division fraction addition subtraction PEMDAS solve expression 9 - 3 / 1/3 + 1 evaluate math equation math problem numbers calculate order of operations",
    "Algebraic Equations": "algebra linear equation variables solve x y polynomial quadratic factoring roots formula parabola discriminant square",
    "Quadratic Factoring": "quadratic factoring polynomial roots formula parabola discriminant square solve equation zero",
    "Systems of Inequalities": "systems inequalities linear substitution elimination graph shaded region constraint boundary line slope",
    "Matrix Multiplication": "matrix multiplication linear algebra dot product rows columns determinant rank vector transformation",
    "Probability & Combinatorics": "probability combinations permutations counting Bayes theorem expected value discrete event sample space",
    "Trigonometric Identities": "trigonometry sin cos tan pythagorean identity unit circle angle identity double angle secant cotangent",
    
    # Calculus 1 (Differential)
    "Calculus 1: Limits & Continuity": "calculus 1 limits continuity epsilon delta indeterminate form L'Hopital asymptotes continuous infinity",
    "Calculus 1: Power & Chain Rule Derivatives": "calculus 1 derivative differentiation power rule product rule quotient rule chain rule tangent line velocity rate",
    "Calculus 1: Related Rates & Optimization": "calculus 1 related rates implicit differentiation optimization maximum minimum critical points concavity curve sketching",
    
    # Calculus 2 (Integral & Series)
    "Calculus 2: Integration Techniques": "calculus 2 integration antiderivative substitution u-substitution integration by parts trig substitution partial fractions area under curve",
    "Calculus 2: Infinite Series & Taylor Polynomials": "calculus 2 series convergence divergence ratio test integral test p-series Taylor series Maclaurin series power series",
    
    # Calculus 3 (Multivariable)
    "Calculus 3: Partial Derivatives & Gradients": "calculus 3 multivariable partial derivatives gradient vector directional derivative tangent plane saddle point Lagrange multipliers",
    "Calculus 3: Multiple Integrals & Vector Calculus": "calculus 3 double integrals triple integrals polar cylindrical spherical coordinates vector field line integral Green's theorem Stokes theorem",
    
    # Humanities & Social Sciences
    "Thesis Statement Development": "thesis statement argument essay topic claim evidence rhetorical analysis outline draft",
    "MLA & APA Citation Formats": "mla apa citation format bibliography works cited in-text reference quote footnote style guide",
    "US Constitution & Bill of Rights": "constitution bill of rights amendments congress supreme court federalism executive judicial legislative branch",
}

BROAD_TERMS = {
    "calculus": ["Calculus 1: Power & Chain Rule Derivatives", "Calculus 2: Integration Techniques", "Calculus 3: Partial Derivatives & Gradients"],
    "math": ["Arithmetic & Order of Operations", "Calculus 1: Limits & Continuity", "Quadratic Factoring"],
    "computer science": ["For & While Loops", "Recursion", "Big-O Analysis", "Pointers & Memory"],
    "cs": ["For & While Loops", "Recursion", "Big-O Analysis", "Binary Search Trees"],
}


class TfidfTopicClassifier:

    def __init__(self, topic_map: dict[str, str] | None = None):
        self.topic_map = topic_map or DEFAULT_TOPIC_DESCRIPTIONS
        self.topic_names = list(self.topic_map.keys())
        self.descriptions = list(self.topic_map.values())

        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
        )
        self.doc_vectors = self.vectorizer.fit_transform(self.descriptions)

    def is_broad_term(self, text: str) -> bool:
        clean = text.strip().lower()
        return clean in BROAD_TERMS

    def get_broad_options(self, text: str) -> list[str]:
        clean = text.strip().lower()
        return BROAD_TERMS.get(clean, [])

    async def classify_struggle(self, free_text: str) -> str:
        if not free_text or not free_text.strip():
            return "unknown"

        clean_text = free_text.strip()
        lower_text = clean_text.lower()

        # Direct Loop keyword detection
        if any(kw in lower_text for kw in ["loop", "for loop", "while loop", "nested loop", "iteration", "infinite loop"]):
            return "For & While Loops"

        # Direct arithmetic expression detection
        if re.search(r'^\s*[\d\s\+\-\*/\(\)\.\,]+\s*$', clean_text) or ("/" in clean_text and re.search(r'\d+', clean_text)):
            if not any(w in lower_text for w in ["recursion", "matrix", "derivative", "integral", "graph", "tree", "thesis"]):
                return "Arithmetic & Order of Operations"

        query_vector = self.vectorizer.transform([clean_text])
        similarities = cosine_similarity(query_vector, self.doc_vectors)[0]

        best_idx = int(np.argmax(similarities))
        highest_score = float(similarities[best_idx])

    def is_gibberish_or_vague(self, text: str) -> bool:
        clean = text.strip()
        if len(clean) < 3:
            return True
        # Repeated character pattern (e.g., "helpppp", "hhhhhh", "aaaaaa")
        if re.search(r'(.)\1{3,}', clean.lower()):
            return True
        # Random keyboard mashing or non-alphanumeric noise
        clean_alpha = re.sub(r'[^a-zA-Z0-9\s]', '', clean)
        if len(clean_alpha.strip()) < 3:
            return True
        # Single vague non-academic terms
        vague_terms = {"help", "helpp", "helppp", "helpppp", "pls", "please", "idk", "stuff", "test", "asdf", "asdfg", "qwerty", "aaa", "bbb", "xxx", "no", "yes", "dunno"}
        if clean.lower() in vague_terms:
            return True
        return False

    async def validate_and_canonicalize_topic(self, free_text: str) -> dict:
        clean_text = free_text.strip() if free_text else ""

        if self.is_gibberish_or_vague(clean_text):
            return {
                "valid": False,
                "reason": f"Your input ('{clean_text}') is too broad or non-academic. Please specify the course topic or problem (e.g. Calc 1 Chain Rule, Python Recursion, Physics Motion).",
                "suggested_topics": ["Recursion & Base Cases", "Chain Rule & Implicit Differentiation", "Big-O Algorithmic Complexity", "Newtonian Motion & Friction Dynamics"],
            }

        # Check if broad term
        if self.is_broad_term(clean_text):
            options = self.get_broad_options(clean_text)
            return {
                "valid": False,
                "reason": f"'{clean_text}' covers multiple sub-disciplines. Please select a specific area below:",
                "suggested_topics": options,
            }

        # Run TF-IDF classification
        query_vector = self.vectorizer.transform([clean_text])
        similarities = cosine_similarity(query_vector, self.doc_vectors)[0]

        best_idx = int(np.argmax(similarities))
        highest_score = float(similarities[best_idx])

        if highest_score >= 0.12:
            return {
                "valid": True,
                "canonical_title": self.topic_names[best_idx],
                "matched_existing": True,
            }

        # Check if it contains numbers/math operators
        if re.search(r'[\d\+\-\*/=]', clean_text):
            return {
                "valid": True,
                "canonical_title": "Arithmetic & Order of Operations",
                "matched_existing": True,
            }

        # Escalation Tier: Low local TF-IDF confidence -> Escalate to LLM reasoning model for academic judgment
        try:
            from ai_tutor import ai_tutor
            if ai_tutor.is_ai_enabled:
                system_prompt = (
                    "You are an Academic Topic Classification Judge. Determine if the student input is a legitimate academic concept, or unclassifiable noise/spam.\n"
                    "Format response as strictly JSON: {\"is_academic\": true, \"canonical_title\": \"Clean Title\", \"reason\": \"Explanation\"}"
                )
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Student Input: {clean_text}"}
                ]
                raw = await ai_tutor._call_api(messages, max_tokens=90, temperature=0.2)
                if raw:
                    import json as _json
                    data = _json.loads(raw)
                    if data.get("is_academic"):
                        return {
                            "valid": True,
                            "canonical_title": data.get("canonical_title", clean_text.title()),
                            "matched_existing": False,
                        }
                    else:
                        return {
                            "valid": False,
                            "reason": data.get("reason", f"'{clean_text}' does not appear to be a standard course topic. Please describe the specific subject."),
                            "suggested_topics": ["Recursion & Base Cases", "Chain Rule & Implicit Differentiation", "Thesis Statement Development"],
                        }
        except Exception:
            pass

        # Local Fallback check if it has enough words to be a valid custom academic topic
        words = [w for w in clean_text.split() if len(w) >= 3]
        if len(words) >= 2:
            canonical_title = " ".join(words[:4]).title()
            return {
                "valid": True,
                "canonical_title": canonical_title,
                "matched_existing": False,
            }

        return {
            "valid": False,
            "reason": f"'{clean_text}' needs a bit more context. Please describe the specific concept or subject you are working on.",
            "suggested_topics": ["Recursion & Base Cases", "Chain Rule & Implicit Differentiation", "Thesis Statement Development"],
        }

    async def classify_struggle(self, free_text: str) -> str:
        res = await self.validate_and_canonicalize_topic(free_text)
        if res["valid"]:
            return res["canonical_title"]
        return "Recursion & Base Cases"

    async def generate_match_explanation(
        self, name_a: str, name_b: str, topic: str
    ) -> str:
        return f"{name_a} and {name_b} are both working through {topic} right now."
