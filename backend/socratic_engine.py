"""
socratic_engine.py

Context-aware, multi-stage Socratic dialogue engine.
Works entirely offline — no API key needed.

Stages:
  0 Hook        — anchor to what the student already knows
  1 Decompose   — break the problem into components
  2 Challenge   — probe assumptions and edge cases
  3 Synthesize  — have them explain it back
  4 Extend      — apply to a novel scenario
"""

from __future__ import annotations
import re
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Topic-specific question banks
# Each topic has 5 lists of questions (one per stage).
# We pick from the most contextually relevant one based on student keywords.
# ---------------------------------------------------------------------------

TOPIC_BANKS: dict[str, list[list[str]]] = {

    # ── Computer Science ────────────────────────────────────────────────────

    "recursion": [
        # Stage 0 – Hook
        [
            "Before we dive in — can you describe in one sentence what recursion actually means to you right now?",
            "What happens if a recursive function never reaches its base case? Have you ever seen that error?",
            "Can you think of something in real life that works 'recursively'? Folder inside a folder, maybe?",
        ],
        # Stage 1 – Decompose
        [
            "Every recursive solution needs two parts. What are they, and why does each one matter?",
            "Walk me through the base case for this problem — what is the simplest input that needs no further recursion?",
            "If I trace the call stack for your function, what does the first call return? What about the second?",
            "How does the recursive call make the problem *smaller* each time?",
        ],
        # Stage 2 – Challenge
        [
            "What happens if the input is 0 or negative — does your function handle that correctly?",
            "Could this problem be solved iteratively instead? What would you trade off by doing so?",
            "Where exactly does the stack frame get popped? Can you trace that moment?",
            "What is the time complexity of your recursive solution? Is there a way to reduce redundant calls?",
        ],
        # Stage 3 – Synthesize
        [
            "Without looking at the code, explain the full algorithm to me like I'm a first-year student.",
            "Can you write out the recurrence relation that describes this function's complexity?",
            "In your own words — why does the recursion 'trust' the result of the smaller subproblem?",
        ],
        # Stage 4 – Extend
        [
            "Can you apply this same recursive pattern to a 2D grid problem?",
            "How would memoization change the performance here — and where exactly would you cache?",
            "Take your solution and now convert it to use an explicit stack instead of the call stack. What changes?",
        ],
    ],

    "loops": [
        ["What does the loop variable represent at each iteration — what is it tracking?",
         "Before we look at the code, what condition must be true for the loop to continue running?"],
        ["What is the loop's invariant — what stays true at the start of every iteration?",
         "Walk me through what happens on iteration 0, then iteration 1. Do the outputs match your expectation?",
         "If the loop runs N times, what is the total number of operations performed inside?"],
        ["What happens if the initial condition is already false — does the loop body execute at all?",
         "Could an off-by-one error occur here? Where would you check for that?",
         "Is there a risk of an infinite loop? What guard would prevent it?"],
        ["Explain the difference between a for-loop and a while-loop — when would you choose each?",
         "Can you rewrite this loop as a recursive function? What would the base case be?"],
        ["How would you modify this loop to work on a 2D array instead of a 1D array?",
         "Can you parallelize iterations of this loop? What constraint would prevent that?"],
    ],

    "big-o": [
        ["When we say an algorithm is O(n²), what does the 'n' represent — and why does it matter?",
         "Have you seen an O(log n) algorithm before? What made it faster than O(n)?"],
        ["Trace through the nested loops in this code. How many times does the innermost line execute?",
         "What changes if we double the input size? Does the runtime double, quadruple, or something else?",
         "Drop the constants and lower-order terms — what's the dominant term here?"],
        ["Is the best case, worst case, or average case more important here — and why?",
         "What is the space complexity of your solution? Does it use extra memory proportional to input size?",
         "Can you find an algorithm with better asymptotic complexity for this problem?"],
        ["Explain Big-O to someone who only knows basic algebra. What analogy would you use?",
         "Without looking it up — what is the time complexity of sorting with merge sort vs bubble sort?"],
        ["Design a solution to this problem that runs in O(n log n) instead of O(n²). Where would you start?",
         "If you had to cache results to improve runtime, what data structure would you use and why?"],
    ],

    "binary search trees": [
        ["What property must always hold true for every node in a valid BST?",
         "If I insert the values [5, 3, 7, 1, 4] in order, can you sketch the resulting tree?"],
        ["Walk me through a search for value X. At each node, which direction do you go — and why?",
         "What is the height of a balanced BST with N nodes? How does height affect search time?",
         "Explain the in-order traversal of a BST. What property does the output have?"],
        ["What happens to the BST property if you delete a node that has two children?",
         "What is the worst-case height of a BST — and what input causes it?",
         "How does an AVL tree or Red-Black tree prevent the worst case?"],
        ["Without running the code, what does an in-order traversal of a BST output — and why?",
         "Explain the difference between a BST and a binary heap. When would you use each?"],
        ["How would you find the kth smallest element in a BST efficiently?",
         "Can you modify BST insertion to also maintain a count of nodes in each subtree?"],
    ],

    "graph algorithms": [
        ["What is the difference between a directed and undirected graph — give me a real-world example of each.",
         "When would you choose an adjacency list over an adjacency matrix?"],
        ["Trace BFS starting from node A in your graph. What is the order nodes are visited?",
         "What data structure does BFS use internally — and why does that choice matter?",
         "In DFS, when do we mark a node as visited — before or after processing it, and why?"],
        ["Does Dijkstra's algorithm work with negative edge weights? Why or why not?",
         "What is a cycle in a directed graph, and how would you detect one?",
         "What is the difference between a spanning tree and a minimum spanning tree?"],
        ["Explain BFS vs DFS: when does each one find the shortest path?",
         "Can you derive the time complexity of BFS in terms of vertices V and edges E?"],
        ["Apply Dijkstra's algorithm to this graph by hand. Show me the priority queue state at each step.",
         "How would you modify BFS to find all nodes within K hops of a source node?"],
    ],

    # ── Mathematics ─────────────────────────────────────────────────────────

    "calculus": [
        ["What does a derivative represent geometrically — and what does it represent physically?",
         "Before computing, estimate: is this derivative positive, negative, or zero at this point?"],
        ["What rule applies first here — chain rule, product rule, or quotient rule — and how do you decide?",
         "Walk me through the chain rule step-by-step using the inside/outside function structure.",
         "What is the inner function u(x) and the outer function f(u) in this composite expression?"],
        ["What happens at a critical point where f'(x) = 0 — how do you distinguish a max from a min?",
         "Can you find where this function is concave up vs concave down, and explain what that means?",
         "If the derivative is undefined at a point, does that mean the function is not differentiable there?"],
        ["Explain the fundamental theorem of calculus in your own words — both parts.",
         "Without computing, what does the integral of this function represent geometrically?"],
        ["Apply implicit differentiation to find dy/dx for this equation — where does the chain rule appear?",
         "Set up a related rates problem from this scenario. What are your known and unknown rates?"],
    ],

    "integration": [
        ["What does the definite integral represent in terms of area — and when can it be negative?",
         "What's the difference between a definite and indefinite integral?"],
        ["Identify whether u-substitution or integration by parts applies here. What's your reasoning?",
         "For u-substitution: what is your choice of u, and what does du become?",
         "For integration by parts: which part do you choose as u and which as dv — and why?"],
        ["What happens at the limits of integration when you apply substitution — do they change?",
         "Can this integral be computed exactly, or do we need a numerical method?",
         "What is the antiderivative of 1/x — and why is the absolute value important?"],
        ["State the fundamental theorem of calculus that connects derivatives and integrals.",
         "Explain why integration by parts is essentially the product rule in reverse."],
        ["Set up the integral for the area between two curves. How do you determine which function is on top?",
         "Apply the disk/washer method to find the volume of revolution around the x-axis."],
    ],

    "limits": [
        ["What does it mean for a limit to exist at a point — in plain English?",
         "Can you evaluate this limit by direct substitution? If not, why not?"],
        ["What indeterminate form does this expression take — 0/0, ∞/∞, or something else?",
         "When is L'Hôpital's rule valid to apply? What are its conditions?",
         "Factor and cancel the common term — what does the limit simplify to?"],
        ["Does the limit exist if the left-hand and right-hand limits differ? Why?",
         "What does it mean for a function to be continuous at a point — in terms of limits?",
         "Apply the squeeze theorem here: what two bounding functions can you identify?"],
        ["Explain the epsilon-delta definition of a limit in simple terms.",
         "What's the difference between a limit and the actual value of the function at that point?"],
        ["Evaluate this limit at infinity — what dominates the numerator vs denominator?",
         "Identify all asymptotes of this function using limit analysis."],
    ],

    "linear algebra": [
        ["What does matrix multiplication actually represent geometrically — as a transformation?",
         "Can you multiply a 2×3 matrix by a 3×2 matrix? What are the dimensions of the result?"],
        ["Walk me through the process of row-reducing this matrix. What row operations are valid?",
         "When does a system Ax = b have no solution, exactly one solution, or infinitely many?",
         "What is the determinant of a 2×2 matrix, and what does it tell you geometrically?"],
        ["If the determinant is zero, what does that tell you about the matrix and the system it represents?",
         "What is the null space of a matrix, and how does it relate to the solutions of Ax = 0?",
         "Can a non-square matrix have an inverse? Why or why not?"],
        ["Explain what an eigenvalue and eigenvector represent — geometrically.",
         "What is the rank of a matrix, and how does it relate to solutions of a linear system?"],
        ["Diagonalize this matrix if possible. What condition must hold for diagonalization to exist?",
         "Apply the Gram-Schmidt process to find an orthonormal basis for this set of vectors."],
    ],

    # ── Physics ──────────────────────────────────────────────────────────────

    "physics": [
        ["Before setting up equations, draw a free-body diagram. What forces act on the object?",
         "What is the system boundary here — what is inside vs outside the system?"],
        ["Which of Newton's three laws applies directly to this situation — and why?",
         "Identify the known and unknown variables. Which kinematic equation connects them?",
         "What direction do you define as positive — and does that choice matter?"],
        ["Does friction act in the direction of motion or against it — and why?",
         "What assumptions are you making — no air resistance, point mass, massless string?",
         "At the maximum height, what is the vertical velocity? What is the horizontal velocity?"],
        ["State the law of conservation of energy for this system. Where does energy transform?",
         "Explain the work-energy theorem: how does net work relate to kinetic energy?"],
        ["Apply conservation of momentum to this collision. Is kinetic energy also conserved? Why or why not?",
         "Set up the differential equation of motion for this system. What is the general solution?"],
    ],

    # ── English & Writing ────────────────────────────────────────────────────

    "essay": [
        ["What is the central argument you're trying to make — can you state it in one sentence?",
         "Who is your intended audience, and how does that shape your tone and word choice?"],
        ["Does your thesis make a specific, arguable claim — or is it just a statement of fact?",
         "What is your strongest piece of evidence? Where does it appear in your essay?",
         "Is each body paragraph doing one job — one claim, supported by one piece of evidence?"],
        ["What is the counterargument to your thesis? How do you address it in the essay?",
         "Is your conclusion just restating the intro, or does it synthesize to a broader insight?",
         "Are your transitions logical — does each paragraph follow from the one before?"],
        ["Explain your thesis and why someone reasonable might disagree with it.",
         "Read your topic sentence aloud — does it clearly announce what the paragraph will prove?"],
        ["Rewrite your thesis to be more specific and arguable. What would you change?",
         "Apply your argument to a different text or case. Does it hold up?"],
    ],

    "citation": [
        ["Why do citations matter — academically and ethically?",
         "What's the difference between a works cited page and a bibliography?"],
        ["For this source, walk me through the MLA format: author, title, publication, date.",
         "When do you need an in-text citation — every sentence, or only for specific claims?",
         "What is the difference between a direct quote, a paraphrase, and a summary citation?"],
        ["If an author is unknown, how does the MLA citation change?",
         "What is a DOI and when should it appear in a citation?",
         "How does the APA format differ from MLA for journal articles?"],
        ["Explain the difference between APA and MLA — when would a professor require each?",
         "Without looking it up, what information do you always need to cite a website?"],
        ["Build an annotated bibliography entry for this source — what goes in the annotation?",
         "Check this citation for errors. What's missing or formatted incorrectly?"],
    ],
}

# ---------------------------------------------------------------------------
# Keyword → topic routing
# ---------------------------------------------------------------------------

KEYWORD_TO_TOPIC: dict[str, str] = {
    "recursion": "recursion", "recursive": "recursion", "base case": "recursion", "call stack": "recursion",
    "loop": "loops", "for loop": "loops", "while loop": "loops", "iterate": "loops", "iteration": "loops",
    "big o": "big-o", "complexity": "big-o", "time complexity": "big-o", "asymptotic": "big-o",
    "bst": "binary search trees", "binary search tree": "binary search trees", "traversal": "binary search trees",
    "graph": "graph algorithms", "bfs": "graph algorithms", "dfs": "graph algorithms",
        "dijkstra": "graph algorithms", "shortest path": "graph algorithms",
    "derivative": "calculus", "differentiat": "calculus", "chain rule": "calculus",
        "product rule": "calculus", "quotient rule": "calculus", "implicit": "calculus",
    "integral": "integration", "integration": "integration", "antiderivative": "integration",
        "substitution": "integration", "by parts": "integration",
    "limit": "limits", "l'hopital": "limits", "continuity": "limits", "continuous": "limits",
    "matrix": "linear algebra", "vector": "linear algebra", "eigenvalue": "linear algebra",
        "determinant": "linear algebra", "linear": "linear algebra",
    "force": "physics", "velocity": "physics", "acceleration": "physics",
        "newton": "physics", "momentum": "physics", "friction": "physics", "energy": "physics",
    "thesis": "essay", "essay": "essay", "argument": "essay", "paragraph": "essay",
    "citation": "citation", "mla": "citation", "apa": "citation", "bibliography": "citation",
}

# Generic fallback questions (topic-agnostic)
GENERIC_STAGES: list[list[str]] = [
    ["What do you already know about this topic that we can build on?",
     "In your own words, what is the core idea of what you're trying to solve?"],
    ["Can you break this down into smaller sub-problems? What's the first one?",
     "What information do you have, and what are you trying to find?",
     "What formula or concept would you normally reach for first here?"],
    ["What assumptions are you making — are they valid in all cases?",
     "Can you think of a counterexample that might break your approach?",
     "What would change if one of the input values was zero, negative, or very large?"],
    ["Explain your solution to me as if I know nothing about this topic.",
     "Without the formula — why does your method actually work?"],
    ["How would your solution change if the problem had one extra constraint?",
     "Apply this concept to a new example you haven't seen before."],
]


class SocraticEngine:
    """
    Stateless per-call Socratic response generator.
    State is inferred from the conversation history passed in.
    """

    def _detect_topic(self, topic_name: str, messages: list[dict]) -> str:
        """Map a session topic name + conversation content to an internal topic key."""
        combined = (topic_name + " " + " ".join(m.get("text", "") for m in messages)).lower()
        best_topic = None
        best_len = 0
        for keyword, topic_key in KEYWORD_TO_TOPIC.items():
            if keyword in combined and len(keyword) > best_len:
                best_topic = topic_key
                best_len = len(keyword)
        return best_topic or "generic"

    def _get_stage(self, student_message_count: int) -> int:
        """Advance stage based on how many student messages have been exchanged."""
        if student_message_count <= 1:
            return 0
        elif student_message_count <= 3:
            return 1
        elif student_message_count <= 6:
            return 2
        elif student_message_count <= 9:
            return 3
        else:
            return 4

    def _pick_question(self, bank: list[list[str]], stage: int, used_texts: set[str]) -> str:
        """Pick the first unused question in the current stage, then fall back to other stages."""
        for s in [stage, (stage + 1) % 5, (stage - 1) % 5, (stage + 2) % 5, (stage - 2) % 5]:
            for q in bank[s]:
                if q not in used_texts:
                    return q
        # All exhausted — pick any
        return bank[stage % len(bank)][0]

    def _build_preamble(self, student_text: str) -> str:
        """Generate a brief, varied acknowledgement based on keywords in student response."""
        text = student_text.lower().strip()
        if any(w in text for w in ["i don't know", "not sure", "confused", "lost", "help"]):
            return "That's okay — uncertainty is the beginning of understanding. "
        if any(w in text for w in ["i think", "maybe", "perhaps", "probably"]):
            return "Good instinct! Let's sharpen that intuition. "
        if any(w in text for w in ["yes", "correct", "right", "exactly", "got it"]):
            return "Great — let's go one level deeper. "
        if any(w in text for w in ["no", "wrong", "incorrect", "doesn't"]):
            return "Interesting — let's explore why that might be. "
        if len(text) > 80:
            return "Nice detailed thinking. "
        return ""

    def get_response(self, topic_name: str, history: list[dict], student_text: str) -> str:
        """
        Given the session topic, full conversation history, and the student's latest message,
        return the next Socratic question.
        """
        topic_key = self._detect_topic(topic_name, history)
        bank = TOPIC_BANKS.get(topic_key, GENERIC_STAGES)

        # Count how many student (non-AI) messages have been sent
        student_msgs = [m for m in history if m.get("sender_id") != "ai-tutor-bot"]
        stage = self._get_stage(len(student_msgs))

        # Collect already-used AI questions to avoid repetition
        used = {m["text"] for m in history if m.get("sender_id") == "ai-tutor-bot"}

        question = self._pick_question(bank, stage, used)
        preamble = self._build_preamble(student_text)
        return preamble + question

    def get_hint(self, topic_name: str, history: list[dict]) -> str:
        """Return a targeted hint based on the current topic and stage."""
        topic_key = self._detect_topic(topic_name, history)
        student_msgs = [m for m in history if m.get("sender_id") != "ai-tutor-bot"]
        stage = self._get_stage(len(student_msgs))

        hints: dict[str, list[str]] = {
            "recursion": [
                "💡 Hint: Every recursive function needs a base case. Without one, it recurses forever.",
                "💡 Hint: Draw the call tree — each branch is a recursive call, each leaf is a base case return.",
                "💡 Hint: Trust the recursion — assume the smaller subproblem is already solved correctly.",
            ],
            "calculus": [
                "💡 Hint: For chain rule — differentiate the outside, keep the inside, then multiply by the inside's derivative.",
                "💡 Hint: Set f'(x) = 0 to find critical points. Then use the second derivative to classify them.",
                "💡 Hint: For implicit differentiation, treat y as a function of x and apply the chain rule every time y appears.",
            ],
            "integration": [
                "💡 Hint: For u-substitution, look for a function and its derivative both present in the integrand.",
                "💡 Hint: Integration by parts: ∫u dv = uv - ∫v du. Choose u to simplify when differentiated.",
                "💡 Hint: Check if the integrand matches a known form: ∫1/x = ln|x|, ∫eˣ = eˣ, ∫sin = -cos.",
            ],
            "big-o": [
                "💡 Hint: Count how many times the innermost operation runs relative to input size n.",
                "💡 Hint: Nested loops → multiply. Sequential blocks → add. Then drop constants and lower-order terms.",
                "💡 Hint: O(log n) usually means you're halving the problem at each step — like binary search.",
            ],
            "graph algorithms": [
                "💡 Hint: BFS uses a queue (FIFO) — guarantees shortest path in unweighted graphs.",
                "💡 Hint: DFS uses a stack (or recursion) — useful for cycle detection and topological sort.",
                "💡 Hint: Dijkstra needs a priority queue — always expand the node with the minimum known distance.",
            ],
        }

        topic_hints = hints.get(topic_key, [
            "💡 Hint: Try working through a simple concrete example before tackling the general case.",
            "💡 Hint: Break the problem into what you know and what you need to find.",
            "💡 Hint: Check edge cases: what happens when the input is 0, empty, or at its maximum?",
        ])

        return topic_hints[min(stage, len(topic_hints) - 1)]


# Module-level singleton
engine = SocraticEngine()
