"""
ai_tutor.py

Real generative AI Socratic tutor for StudyMatch.

Uses the Groq API (free tier, Llama-3.3-70b-versatile) by default.
Free at console.groq.com. Falls back to OpenAI if OPENAI_API_KEY is set.
If neither key is present, falls back to the rule-based SocraticEngine.
"""

from __future__ import annotations

import os
import httpx

# Load .env file automatically
try:
    _env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_env_path):
        with open(_env_path, encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip().lstrip("\ufeff")
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip())
except Exception:
    pass

# ---------------------------------------------------------------------------
# Configuration -- resolved dynamically
# ---------------------------------------------------------------------------

def _get_api_config():
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if groq_key:
        return (
            "https://api.groq.com/openai/v1",
            "llama-3.3-70b-versatile",
            {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        )
    elif openai_key:
        return (
            "https://api.openai.com/v1",
            "gpt-4o-mini",
            {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
        )
    return None, None, {}

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_TUTOR_SYSTEM = (
    "You are a Socratic AI tutor at a university study platform. "
    "A student is working through a problem on the topic: {topic}.\\n\\n"
    "Your STRICT rules:\\n"
    "1. NEVER give the student the direct answer or complete solution.\\n"
    "2. Ask exactly ONE focused question per response -- never two.\\n"
    "3. In 1 short sentence, acknowledge what the student just said, then ask your question.\\n"
    "4. Keep your entire response under 3 sentences total.\\n"
    "5. Follow this stage progression based on how many messages have been exchanged:\\n"
    "   - Stage 1 (first 2 student messages): Hook -- connect to prior knowledge they already have.\\n"
    "   - Stage 2 (messages 3-5): Decompose -- guide them to break the problem into smaller parts.\\n"
    "   - Stage 3 (messages 6-8): Challenge -- probe assumptions, edge cases, complexity.\\n"
    "   - Stage 4 (messages 9+): Synthesize -- ask them to explain the concept back or apply it somewhere new.\\n"
    "6. Be warm, specific, and reference the student actual words -- do not be generic.\\n"
    "7. If the student is clearly lost or frustrated, simplify your question before asking it.\\n"
    "8. Never lecture. Never explain for more than one clause before asking your question."
)

_HINT_SYSTEM = (
    "You are a Socratic AI tutor. A student working on {topic} needs a hint.\\n"
    "Give exactly ONE hint in 1-2 sentences. Start with: Hint:\\n"
    "Do NOT reveal the full answer. Focus on the most useful next step or concept.\\n"
    "Make it specific to the topic, not generic."
)

_SUMMARY_SYSTEM = (
    "You are summarizing a Socratic tutoring session. "
    "Write a concise markdown summary (under 150 words) covering: "
    "(1) the topic and what the student was working on, "
    "(2) key concepts explored, "
    "(3) how well the student progressed, "
    "(4) one recommended next step. "
    "Be specific and encouraging."
)


# ---------------------------------------------------------------------------
# Core class
# ---------------------------------------------------------------------------

class AISocraticTutor:
    """
    Generative AI Socratic tutor.

    Uses Groq (Llama 3.3-70B) or OpenAI API to produce novel, contextual
    Socratic questions grounded in the full conversation history.
    Falls back to the rule-based SocraticEngine transparently.
    """

    @property
    def is_ai_enabled(self) -> bool:
        base_url, _, _ = _get_api_config()
        return bool(base_url)

    def _build_chat_messages(
        self,
        system_prompt: str,
        history: list[dict],
        student_text: str,
        max_history: int = 20,
    ) -> list[dict]:
        """Convert StudyMatch history format to OpenAI messages format."""
        messages: list[dict] = [{"role": "system", "content": system_prompt}]
        recent = history[-max_history:] if len(history) > max_history else history
        for msg in recent:
            if msg.get("sender_id") == "ai-tutor-bot":
                messages.append({"role": "assistant", "content": msg.get("text", "")})
            elif msg.get("sender_id") and msg.get("text"):
                messages.append({"role": "user", "content": msg["text"]})
        messages.append({"role": "user", "content": student_text})
        return messages

    async def _call_api(self, messages: list[dict], max_tokens: int = 150, temperature: float = 0.75) -> str | None:
        """Call the configured API. Returns the response text or None on failure."""
        base_url, model, headers = _get_api_config()
        if not base_url:
            return None
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            print(f"[AISocraticTutor] API error ({type(exc).__name__}): {exc}")
            return None

    async def get_response(self, topic: str, history: list[dict], student_text: str) -> str:
        """
        Generate a novel Socratic question in response to the student message.
        Falls back to the rule-based engine if the API is unavailable.
        """
        if self.is_ai_enabled:
            system = _TUTOR_SYSTEM.format(topic=topic or "the problem at hand")
            messages = self._build_chat_messages(system, history, student_text)
            result = await self._call_api(messages, max_tokens=160, temperature=0.75)
            if result:
                return result
        from socratic_engine import engine as _rule_engine
        return _rule_engine.get_response(topic, history, student_text)

    async def get_hint(self, topic: str, history: list[dict]) -> str:
        """Generate a targeted hint. Falls back to rule-based engine."""
        if self.is_ai_enabled:
            student_count = len([m for m in history if m.get("sender_id") != "ai-tutor-bot"])
            system = _HINT_SYSTEM.format(topic=topic or "this topic")
            ctx_messages: list[dict] = [{"role": "system", "content": system}]
            for msg in history[-6:]:
                role = "assistant" if msg.get("sender_id") == "ai-tutor-bot" else "user"
                if msg.get("text"):
                    ctx_messages.append({"role": role, "content": msg["text"]})
            ctx_messages.append({
                "role": "user",
                "content": f"I am stuck on {topic or 'this topic'}. Can I get a hint? ({student_count} messages sent so far.)",
            })
            result = await self._call_api(ctx_messages, max_tokens=90, temperature=0.65)
            if result:
                hint = result if result.lower().startswith("hint") else f"Hint: {result}"
                return hint if hint.startswith("Hint:") else hint
        from socratic_engine import engine as _rule_engine
        return _rule_engine.get_hint(topic, history)

    async def generate_session_summary(self, topic: str, history: list[dict]) -> str:
        """Generate a concise AI-written summary of the study session."""
        if not self.is_ai_enabled or not history:
            msgs = len(history)
            return (
                f"# Socratic Session AI Summary\\n\\n"
                f"**Topic:** {topic or 'General Study'}\\n"
                f"**Messages exchanged:** {msgs}\\n\\n"
                "No AI summary available -- set GROQ_API_KEY or OPENAI_API_KEY to enable."
            )
        transcript = "\\n".join(
            ("Tutor" if m.get("sender_id") == "ai-tutor-bot" else "Student") + ": " + m.get("text", "")
            for m in history[-40:]
        )
        messages = [
            {"role": "system", "content": _SUMMARY_SYSTEM},
            {"role": "user", "content": f"Topic: {topic}\\n\\nTranscript:\\n{transcript}"},
        ]
        result = await self._call_api(messages, max_tokens=200, temperature=0.5)
        return result if result else f"# Session Summary\\n\\n**Topic:** {topic}\\n**Messages:** {len(history)}"


    async def vet_and_tag_solution(self, topic: str, scratchpad: str, canvas: str, history: list[dict]) -> dict:
        """
        Multimodal AI quality & safety vetting + tag indexing for public community solutions.
        Checks for non-empty academic work and extracts 3-5 search tags.
        """
        combined_text = (scratchpad or "") + "\n" + "\n".join(m.get("text", "") for m in (history or []))
        if len(combined_text.strip()) < 15 and not canvas:
            return {
                "is_valid": False,
                "reason": "Workspace contains insufficient academic work to publish as a community solution.",
                "tags": [],
            }

        if self.is_ai_enabled:
            system = (
                "You are an AI Education Quality Inspector. Analyze the study workspace transcript.\n"
                "1. Verify that the work contains legitimate academic problem-solving (not blank, profanity, or spam).\n"
                "2. Extract 3 to 5 short search tags (e.g., 'Chain Rule', 'Derivatives', 'Power Rule').\n"
                "Format response as strictly JSON: {\"is_valid\": true, \"tags\": [\"Tag1\", \"Tag2\"]}"
            )
            messages = [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Topic: {topic}\nContent: {combined_text[:1200]}"},
            ]
            raw = await self._call_api(messages, max_tokens=100, temperature=0.3)
            if raw:
                try:
                    import json as _json
                    data = _json.loads(raw)
                    return {
                        "is_valid": data.get("is_valid", True),
                        "tags": data.get("tags", [topic, "Step-by-Step", "Problem Solving"]),
                    }
                except Exception:
                    pass

        # Rule-based fallback tagging
        default_tags = [topic] if topic else ["General"]
        if "recursion" in topic.lower():
            default_tags.extend(["Base Case", "Call Stack", "Divide & Conquer"])
        elif "calculus" in topic.lower() or "derivative" in topic.lower():
            default_tags.extend(["Derivatives", "Step-by-Step", "Formulas"])
        else:
            default_tags.extend(["Step-by-Step Walkthrough", "Verified Solution"])

        return {
            "is_valid": True,
            "tags": list(set(default_tags))[:4],
        }


# Module-level singleton
ai_tutor = AISocraticTutor()
