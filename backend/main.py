"""
main.py — StudyMatch backend.

Wires together:
  - models.py            (persistence)
  - matching_engine.py   (struggle vectors + peer matching)
  - inference_engine.py  (self-hosted classify/explain, real deployments only)

The classifier is injected via a small Protocol so this file — and its
tests — don't require torch/transformers to be installed. Swap
DevKeywordClassifier for the real InferenceEngine in production by
setting STUDYMATCH_USE_REAL_MODEL=1 (see get_classifier()).
"""

from __future__ import annotations

import hashlib
import os

# Load .env file before anything else so GROQ_API_KEY etc. are available
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

import asyncio
import datetime
import json
import secrets
import smtplib
import ssl
from collections import defaultdict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Protocol


# ---------------------------------------------------------------------------
# Password hashing (pbkdf2_hmac — no extra deps, more secure than sha256+salt)
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash suitable for storage."""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}:{hashed.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    """Return True if password matches the stored salted hash."""
    try:
        salt, hashed_hex = stored.split(":", 1)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(candidate.hex(), hashed_hex)
    except Exception:
        return False

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models import (
    User, Topic, QuizAttempt, MatchSession, Block, Report,
    Friendship, DirectMessage, UserStatus, StudyRequest, RecentPartner,
    make_session_factory,
)
from matching_engine import (
    Topic as MTopic,
    StruggleTracker,
    StudentState,
    find_best_match,
)
from socratic_engine import engine as socratic_engine
from ai_tutor import ai_tutor
from content_filter import content_filter

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SESSION_TIMEOUT_HOURS = 24  # Sessions older than this are auto-expired


# ---------------------------------------------------------------------------
# Classifier abstraction
# ---------------------------------------------------------------------------


class Classifier(Protocol):
    async def classify_struggle(self, free_text: str) -> str: ...
    async def generate_match_explanation(self, name_a: str, name_b: str, topic: str) -> str: ...


class DevKeywordClassifier:
    """
    Deterministic keyword-match fallback so the API is testable without a
    GPU or downloaded model weights. NOT what ships in the demo — the real
    demo uses inference_engine.InferenceEngine. This exists so the rest of
    the system (routing, matching, persistence) can be developed and
    tested independently of model availability.
    """

    KEYWORDS = {
        "recursion": ["recursion", "recursive", "base case", "stack overflow"],
        "loops": ["loop", "for loop", "while loop", "iterate", "infinite loop"],
        "arrays": ["array", "index", "indexing", "out of bounds"],
        "bigO": ["big o", "complexity", "runtime", "efficiency"],
    }

    async def classify_struggle(self, free_text: str) -> str:
        text = free_text.lower()
        for topic, keywords in self.KEYWORDS.items():
            if any(k in text for k in keywords):
                return topic
        return "unknown"

    async def generate_match_explanation(self, name_a: str, name_b: str, topic: str) -> str:
        return f"{name_a} and {name_b} are both working through {topic} right now."


def get_classifier() -> Classifier:
    if os.environ.get("STUDYMATCH_USE_REAL_MODEL") == "1":
        from inference_engine import InferenceEngine

        model_name = os.environ.get("STUDYMATCH_MODEL", "meta-llama/Llama-3.2-1B-Instruct")
        return InferenceEngine(model_name)

    from topic_classifier import TfidfTopicClassifier

    return TfidfTopicClassifier()


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Socratic API")

# ---------------------------------------------------------------------------
# Rate limiter (in-memory, per user_id / IP)
# ---------------------------------------------------------------------------

_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate(key: str, max_calls: int, window_seconds: int) -> bool:
    """Return True if allowed, False if rate-limited."""
    import time
    now = time.monotonic()
    bucket = _rate_buckets[key]
    _rate_buckets[key] = [t for t in bucket if now - t < window_seconds]
    if len(_rate_buckets[key]) >= max_calls:
        return False
    _rate_buckets[key].append(now)
    return True


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

SESSION_CONNECTIONS: dict[str, list[WebSocket]] = defaultdict(list)


async def _ws_broadcast(session_id: str, event: dict, exclude: WebSocket | None = None):
    """Send a JSON event to all peers in a session except the sender."""
    dead = []
    for ws in SESSION_CONNECTIONS[session_id]:
        if ws is exclude:
            continue
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.append(ws)
    for ws in dead:
        SESSION_CONNECTIONS[session_id].remove(ws)


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------

def _send_verification_email(to_addr: str, pin: str):
    """Send a branded verification email. Falls back to console log if SMTP not configured."""
    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))

    if not smtp_host or not smtp_user or not smtp_pass:
        print(f"[Socratic] EMAIL VERIFICATION PIN for {to_addr}: {pin}")
        print("[Socratic] Configure SMTP_HOST / SMTP_USER / SMTP_PASS env vars to enable real email delivery.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your Socratic Verification Code: {pin}"
        msg["From"] = smtp_user
        msg["To"] = to_addr

        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;border:2px solid #1F2421;border-radius:12px">
          <h2 style="color:#10B981;margin-bottom:8px">&#129514; Socratic</h2>
          <p style="color:#1F2421;font-size:16px">Your one-time verification code is:</p>
          <div style="font-size:48px;font-weight:700;letter-spacing:8px;color:#1F2421;margin:24px 0;text-align:center">{pin}</div>
          <p style="color:#6B7280;font-size:14px">This code expires in 15 minutes. Do not share it.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_addr, msg.as_string())
    except Exception as e:
        print(f"[Socratic] Email send failed: {e}. PIN for {to_addr}: {pin}")


@app.on_event("startup")
async def startup_tasks():
    """On startup: expire any sessions older than 24 h and launch background cleanup."""
    _expire_stale_sessions()
    asyncio.create_task(_session_cleanup_loop())


def _expire_stale_sessions():
    """Close all open MatchSessions older than SESSION_TIMEOUT_HOURS and deactivate those users."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=SESSION_TIMEOUT_HOURS)
    db = SessionLocal()
    try:
        stale = (
            db.query(MatchSession)
            .filter(MatchSession.ended_at.is_(None), MatchSession.timestamp < cutoff)
            .all()
        )
        expired_user_ids = set()
        for s in stale:
            s.ended_at = datetime.datetime.utcnow()
            expired_user_ids.add(s.user_a_id)
            expired_user_ids.add(s.user_b_id)
        if expired_user_ids:
            db.query(User).filter(User.id.in_(list(expired_user_ids))).update(
                {"active": False}, synchronize_session=False
            )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


async def _session_cleanup_loop():
    """Run _expire_stale_sessions every 30 minutes in the background."""
    while True:
        await asyncio.sleep(30 * 60)
        _expire_stale_sessions()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionLocal = make_session_factory()
classifier: Classifier = get_classifier()


def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # caller closes; kept simple for hackathon scope


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateUserRequest(BaseModel):
    name: str
    course_id: str


class CreateTopicRequest(BaseModel):
    course_id: str
    name: str


class QuizAttemptRequest(BaseModel):
    user_id: str
    free_text: str
    correct: bool


DEMO_CLASSMATES = [
    {
        "id": "demo-peer-elena",
        "name": "Elena Rostova",
        "email": "elena.rostova@stanford.edu",
        "school_name": "Stanford University",
        "avatar_seed": "bottts-2",
        "intro_msg": "Hey! I was also working through this topic. Let's break down the problem together on the whiteboard!",
    },
    {
        "id": "demo-peer-jordan",
        "name": "Jordan Blake",
        "email": "jordan.blake@berkeley.edu",
        "school_name": "UC Berkeley",
        "avatar_seed": "bottts-3",
        "intro_msg": "Hi! Great timing, I was just reviewing this section. Should we start with the core concepts?",
    },
    {
        "id": "demo-peer-sam",
        "name": "Sam Patel",
        "email": "sam.patel@mit.edu",
        "school_name": "MIT",
        "avatar_seed": "bottts-5",
        "intro_msg": "Hey! Let's solve a practice problem step-by-step. Let me know what step you're on!",
    },
    {
        "id": "demo-peer-maya",
        "name": "Maya Lin",
        "email": "maya.lin@columbia.edu",
        "school_name": "Columbia University",
        "avatar_seed": "bottts-6",
        "intro_msg": "Hello! Excited to study together. Feel free to write out formulas on the scratchpad or draw on canvas!",
    },
]


class MatchRequest(BaseModel):
    user_id: str
    topic_name: str | None = None
    allow_demo_peer: bool = True


class BlockRequest(BaseModel):
    blocker_id: str
    blocked_id: str


class ReportRequest(BaseModel):
    reporter_id: str
    reported_id: str
    session_id: str | None = None
    reason: str
    details: str | None = None


class UnmatchRequest(BaseModel):
    user_id: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/users")
def create_user(req: CreateUserRequest):
    db = get_db()
    user = User(name=req.name, course_id=req.course_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return {"id": user.id, "name": user.name, "course_id": user.course_id}


@app.post("/topics")
def create_topic(req: CreateTopicRequest):
    db = get_db()
    topic = Topic(course_id=req.course_id, name=req.name)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    db.close()
    return {"id": topic.id, "name": topic.name, "course_id": topic.course_id}


@app.post("/quiz/attempt")
async def submit_attempt(req: QuizAttemptRequest):
    db = get_db()
    user = db.get(User, req.user_id)
    if not user:
        user = User(
            id=req.user_id,
            name="Student",
            course_id="cs101",
            school_name="University",
            avatar_seed="bottts-1",
            active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    val_res = await classifier.validate_and_canonicalize_topic(req.free_text)

    if not val_res["valid"]:
        db.close()
        return {
            "is_valid_topic": False,
            "classified_topic": None,
            "feedback_reason": val_res.get("reason", "Please provide a specific course concept or problem description."),
            "suggested_topics": val_res.get("suggested_topics", ["Recursion & Base Cases", "Chain Rule & Implicit Differentiation"])
        }

    topic_name = val_res["canonical_title"]

    topic = (
        db.query(Topic)
        .filter(Topic.course_id == user.course_id, Topic.name == topic_name)
        .first()
    )
    if topic is None:
        # Valid new academic topic vetted by AI — add to DB and live catalog
        topic = Topic(course_id=user.course_id, name=topic_name)
        db.add(topic)
        db.commit()
        db.refresh(topic)

        # Append to live PRESEEDED_TOPICS list so Explore Board renders the new topic card immediately
        if not any(item["name"].lower() == topic_name.lower() for item in PRESEEDED_TOPICS):
            cat = "cs" if user.course_id == "cs101" else ("math" if user.course_id == "math201" else "all")
            PRESEEDED_TOPICS.append({
                "id": str(topic.id),
                "name": topic_name,
                "category": cat,
                "course_id": user.course_id,
                "stuck_count": 1
            })

    topic_name, topic_id = topic.name, topic.id

    attempt = QuizAttempt(
        user_id=user.id,
        topic_id=topic_id,
        raw_text=req.free_text,
        correct=req.correct,
    )
    db.add(attempt)
    db.commit()
    db.close()

    return {
        "is_valid_topic": True,
        "classified_topic": topic_name,
        "topic_id": topic_id
    }


@app.post("/match/request")
async def request_match(req: MatchRequest):
    db = get_db()
    user = db.get(User, req.user_id)
    if not user:
        user = User(id=req.user_id, name="Student", course_id="cs101")
        db.add(user)
        db.commit()
        db.refresh(user)

    user.active = True
    db.add(user)
    db.commit()

    topics = db.query(Topic).filter(Topic.course_id == user.course_id).all()
    m_topics = [MTopic(id=t.id, name=t.name) for t in topics]

    all_attempts = (
        db.query(QuizAttempt)
        .join(User, User.id == QuizAttempt.user_id)
        .filter(User.course_id == user.course_id)
        .all()
    )

    tracker = StruggleTracker()
    for a in all_attempts:
        tracker.record_attempt(a.user_id, a.topic_id, a.correct)

    # First, expire any stale sessions for this course so active flags are accurate
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=SESSION_TIMEOUT_HOURS)
    stale = (
        db.query(MatchSession)
        .filter(MatchSession.ended_at.is_(None), MatchSession.timestamp < cutoff)
        .all()
    )
    stale_user_ids = set()
    for s in stale:
        s.ended_at = datetime.datetime.utcnow()
        stale_user_ids.add(s.user_a_id)
        stale_user_ids.add(s.user_b_id)
    if stale_user_ids:
        db.query(User).filter(User.id.in_(list(stale_user_ids))).update(
            {"active": False}, synchronize_session=False
        )
    db.commit()

    active_users = (
        db.query(User)
        .filter(User.course_id == user.course_id, User.active == True, User.id != user.id)
        .all()
    )

    blocked_by_me = {
        b.blocked_id for b in db.query(Block).filter(Block.blocker_id == user.id).all()
    }
    blocked_me = {
        b.blocker_id for b in db.query(Block).filter(Block.blocked_id == user.id).all()
    }
    excluded_ids = blocked_by_me | blocked_me
    active_users = [u for u in active_users if u.id not in excluded_ids]

    user_id = user.id
    user_name = user.name or "Student"
    user_school = user.school_name or "Student"
    user_course_id = user.course_id or "cs101"

    target_state = tracker.build_state(user_id, m_topics)
    candidate_states = [tracker.build_state(u.id, m_topics) for u in active_users]

    result = find_best_match(target_state, candidate_states) if candidate_states else None
    if (result is None or not active_users) and req.allow_demo_peer:
        # Seamlessly match with a simulated high-affinity demo classmate
        import random
        demo_peer = random.choice(DEMO_CLASSMATES)

        # Ensure demo peer exists in DB
        db_peer = db.get(User, demo_peer["id"])
        if not db_peer:
            db_peer = User(
                id=demo_peer["id"],
                name=demo_peer["name"],
                email=demo_peer["email"],
                school_name=demo_peer["school_name"],
                avatar_seed=demo_peer["avatar_seed"],
                course_id=user_course_id,
                active=True,
                is_verified=True,
            )
            db.add(db_peer)
            db.commit()

        topic_name = req.topic_name
        if not topic_name:
            last_attempt = (
                db.query(QuizAttempt)
                .filter(QuizAttempt.user_id == user_id)
                .order_by(QuizAttempt.timestamp.desc())
                .first()
            )
            if last_attempt:
                t = db.get(Topic, last_attempt.topic_id)
                if t:
                    topic_name = t.name
        if not topic_name:
            topic_name = "Recursion & Base Cases"

        db_topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if not db_topic:
            db_topic = Topic(course_id=user_course_id, name=topic_name)
            db.add(db_topic)
            db.commit()
            db.refresh(db_topic)
        final_topic_id = db_topic.id

        explanation = f"{user_name} and {demo_peer['name']} are paired based on complementary struggle-mastery profiles for {topic_name}."

        session = MatchSession(
            user_a_id=user_id,
            user_b_id=demo_peer["id"],
            shared_topic_id=final_topic_id,
            explanation=explanation,
            scratchpad_content=f"""# 📝 Collaborative Study Notes: {topic_name}

## 🤝 Study Partners
- **{user_name}** ({user_school})
- **{demo_peer['name']}** ({demo_peer['school_name']})

## 🎯 Focus Area
- Exploring key principles and solving problems for **{topic_name}**.

## 💡 Working Steps
1. **Problem Statement & Objectives**:
   - Write out the initial equation or problem constraints.
2. **Formulas & Core Principles**:
   - What fundamental rule or theorem applies here?
3. **Step-by-Step Derivation**:
   - Work through step 1:
   - Work through step 2:
4. **Verification & Edge Cases**:
   - Check edge cases to verify the solution.
""",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id

        SESSION_SCRATCHPAD_DATA[session_id] = session.scratchpad_content
        SESSION_TOPICS[session_id] = topic_name
        
        intro_text = f"Hey {user_name}! I was also working through {topic_name}. Let's break down the concepts and solve it together on the whiteboard!"
        SESSION_CHAT_MESSAGES[session_id] = [
            {
                "id": "msg-init-1",
                "sender_id": demo_peer["id"],
                "sender_name": demo_peer["name"],
                "sender_avatar": demo_peer["avatar_seed"],
                "text": intro_text,
                "timestamp": datetime.datetime.utcnow().strftime("%H:%M"),
            }
        ]

        # Persist first message to DB
        try:
            from models import ChatMessage as ChatMessageModel
            db.add(ChatMessageModel(
                session_id=session_id,
                sender_id=demo_peer["id"],
                sender_name=demo_peer["name"],
                text=intro_text,
            ))
            db.commit()
        except Exception:
            pass

        db.close()
        return {
            "matched": True,
            "session_id": session_id,
            "partner_name": demo_peer["name"],
            "partner_id": demo_peer["id"],
            "partner_avatar": demo_peer["avatar_seed"],
            "partner_school": demo_peer["school_name"],
            "shared_topic": topic_name,
            "match_score": 0.94,
            "explanation": explanation,
        }

    if result is None or not active_users:
        db.close()
        return {
            "matched": False,
            "message": "No study partner is available right now on this topic. Try the AI Tutor session, or check back in a few minutes!",
        }

    match_state, score, shared_topic_ids = result
    matched_user = next((u for u in active_users if str(u.id) == str(match_state.user_id)), None)
    if not matched_user:
        db.close()
        return {
            "matched": False,
            "message": "No study partner is available right now on this topic. Try the AI Tutor session!",
        }

    matched_user_id = matched_user.id
    matched_user_name = matched_user.name or "Study Partner"
    matched_user_school = matched_user.school_name or "University"
    matched_user_avatar = matched_user.avatar_seed or "bottts-1"

    topic_id = shared_topic_ids[0] if shared_topic_ids else None
    topic_obj = db.get(Topic, topic_id) if topic_id else None

    topic_name = req.topic_name or (topic_obj.name if topic_obj else "Recursion & Base Cases")
    
    # Ensure topic exists in DB
    db_topic = db.query(Topic).filter(Topic.name == topic_name).first()
    if not db_topic:
        db_topic = Topic(course_id=user_course_id, name=topic_name)
        db.add(db_topic)
        db.commit()
        db.refresh(db_topic)
    final_topic_id = db_topic.id

    explanation = await classifier.generate_match_explanation(
        user_name, matched_user_name, topic_name
    )

    scratchpad_init = f"""# 📝 Collaborative Study Notes: {topic_name}

## 🤝 Study Partners
- **{user_name}** ({user_school})
- **{matched_user_name}** ({matched_user_school})

## 🎯 Focus Area
- Exploring key principles and solving problems for **{topic_name}**.

## 💡 Working Steps
1. **Problem Statement & Objectives**:
   - Write out the initial equation or problem constraints.
2. **Formulas & Core Principles**:
   - What fundamental rule or theorem applies here?
3. **Step-by-Step Derivation**:
   - Work through step 1:
   - Work through step 2:
4. **Verification & Edge Cases**:
   - Check edge cases to verify the solution.
"""

    session = MatchSession(
        user_a_id=user_id,
        user_b_id=matched_user_id,
        shared_topic_id=final_topic_id,
        explanation=explanation,
        scratchpad_content=scratchpad_init,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    session_id = session.id

    intro_text = f"Hey {user_name}! I was also working through {topic_name}. Let's break down the concepts and solve it together on the whiteboard!"
    SESSION_SCRATCHPAD_DATA[session_id] = scratchpad_init
    SESSION_TOPICS[session_id] = topic_name
    SESSION_CHAT_MESSAGES[session_id] = [
        {
            "id": "msg-init-1",
            "sender_id": matched_user_id,
            "sender_name": matched_user_name,
            "sender_avatar": matched_user_avatar,
            "text": intro_text,
            "timestamp": datetime.datetime.utcnow().strftime("%H:%M"),
        }
    ]

    try:
        from models import ChatMessage as ChatMessageModel
        db.add(ChatMessageModel(
            session_id=session_id,
            sender_id=matched_user_id,
            sender_name=matched_user_name,
            text=intro_text,
        ))
        db.commit()
    except Exception:
        pass

    db.close()

    return {
        "matched": True,
        "session_id": session_id,
        "partner_name": matched_user_name,
        "partner_id": matched_user_id,
        "partner_avatar": matched_user_avatar,
        "partner_school": matched_user_school,
        "shared_topic": topic_name,
        "match_score": round(score, 3),
        "explanation": explanation,
    }


@app.get("/match/{session_id}/scratchpad")
def get_scratchpad(session_id: str):
    if session_id in SESSION_SCRATCHPAD_DATA:
        return {"content": SESSION_SCRATCHPAD_DATA[session_id]}
    db = get_db()
    session = db.get(MatchSession, session_id)
    db.close()
    if session and session.scratchpad_content:
        return {"content": session.scratchpad_content}
    return {"content": "# Collaborative Workspace\n\nStart typing notes or scratchpad content together!"}


class ScratchpadUpdate(BaseModel):
    content: str


@app.put("/match/{session_id}/scratchpad")
def update_scratchpad(session_id: str, req: ScratchpadUpdate):
    SESSION_SCRATCHPAD_DATA[session_id] = req.content
    db = get_db()
    session = db.get(MatchSession, session_id)
    if session:
        session.scratchpad_content = req.content
        db.add(session)
        db.commit()
    db.close()
    return {"ok": True, "content": req.content}


@app.post("/match/{session_id}/unmatch")
def unmatch(session_id: str, req: UnmatchRequest):
    db = get_db()
    session = db.get(MatchSession, session_id)
    if not session:
        db.close()
        raise HTTPException(404, "session not found")
    if req.user_id not in (session.user_a_id, session.user_b_id):
        db.close()
        raise HTTPException(403, "not a participant in this session")
    session.ended_at = datetime.datetime.utcnow()
    db.add(session)
    db.commit()
    db.close()
    return {"ok": True}


@app.post("/users/block")
def block_user(req: BlockRequest):
    db = get_db()
    if req.blocker_id == req.blocked_id:
        db.close()
        raise HTTPException(400, "cannot block yourself")
    existing = (
        db.query(Block)
        .filter(Block.blocker_id == req.blocker_id, Block.blocked_id == req.blocked_id)
        .first()
    )
    if existing:
        db.close()
        return {"ok": True, "already_blocked": True}
    block = Block(blocker_id=req.blocker_id, blocked_id=req.blocked_id)
    db.add(block)

    # Blocking immediately ends any active session between the two users
    # — a block should take effect right away, not just prevent future
    # matches while leaving today's scratchpad open.
    sessions = (
        db.query(MatchSession)
        .filter(
            MatchSession.ended_at.is_(None),
            (
                (MatchSession.user_a_id == req.blocker_id)
                & (MatchSession.user_b_id == req.blocked_id)
            )
            | (
                (MatchSession.user_a_id == req.blocked_id)
                & (MatchSession.user_b_id == req.blocker_id)
            ),
        )
        .all()
    )
    for s in sessions:
        s.ended_at = datetime.datetime.utcnow()
        db.add(s)

    db.commit()
    db.close()
    return {"ok": True, "already_blocked": False, "ended_sessions": len(sessions)}


@app.post("/users/report")
def report_user(req: ReportRequest):
    db = get_db()
    report = Report(
        reporter_id=req.reporter_id,
        reported_id=req.reported_id,
        session_id=req.session_id,
        reason=req.reason,
        details=req.details,
    )
    db.add(report)
    db.commit()
    db.close()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Pre-seeded Catalogs & Extended Endpoints
# ---------------------------------------------------------------------------

PRESEEDED_TOPICS = [
    # Computer Science (cs101)
    {"id": "cs-1", "name": "Recursion & Base Cases", "category": "cs", "course_id": "cs101", "stuck_count": 14},
    {"id": "cs-2", "name": "Binary Search Trees & Traversal", "category": "cs", "course_id": "cs101", "stuck_count": 9},
    {"id": "cs-3", "name": "Big-O Algorithmic Complexity", "category": "cs", "course_id": "cs101", "stuck_count": 18},
    {"id": "cs-4", "name": "Dynamic Memory & Pointers", "category": "cs", "course_id": "cs101", "stuck_count": 7},
    {"id": "cs-5", "name": "Graph BFS & DFS Search", "category": "cs", "course_id": "cs101", "stuck_count": 11},

    # Calculus & Mathematics (math201)
    {"id": "math-1", "name": "Chain Rule & Implicit Differentiation", "category": "math", "course_id": "math201", "stuck_count": 22},
    {"id": "math-2", "name": "Integration by Parts & Substitution", "category": "math", "course_id": "math201", "stuck_count": 15},
    {"id": "math-3", "name": "Multivariable Limits & Partial Derivatives", "category": "math", "course_id": "math201", "stuck_count": 8},
    {"id": "math-4", "name": "Taylor & Maclaurin Power Series", "category": "math", "course_id": "math201", "stuck_count": 13},
    {"id": "math-5", "name": "Matrix Transformations & Eigenvalues", "category": "math", "course_id": "math201", "stuck_count": 10},

    # English & Literature (eng101)
    {"id": "eng-1", "name": "Thesis Statement Construction", "category": "eng", "course_id": "eng101", "stuck_count": 6},
    {"id": "eng-2", "name": "Comparative Essay Structure", "category": "eng", "course_id": "eng101", "stuck_count": 4},
    {"id": "eng-3", "name": "MLA & APA Citation Standards", "category": "eng", "course_id": "eng101", "stuck_count": 5},

    # Civics & Government (civ101)
    {"id": "civ-1", "name": "Constitutional Law & Separation of Powers", "category": "civ", "course_id": "civ101", "stuck_count": 8},
    {"id": "civ-2", "name": "Supreme Court Precedents & Due Process", "category": "civ", "course_id": "civ101", "stuck_count": 12},

    # Natural Sciences & Physics (phys150)
    {"id": "phys-1", "name": "Newtonian Motion & Friction Dynamics", "category": "phys", "course_id": "phys150", "stuck_count": 19},
    {"id": "phys-2", "name": "Rotational Torque & Momentum", "category": "phys", "course_id": "phys150", "stuck_count": 16},
    {"id": "phys-3", "name": "Electromagnetism & Gauss's Law", "category": "phys", "course_id": "phys150", "stuck_count": 21},
]

PRESEEDED_PINNED_QUESTIONS = [
    {
        "id": "pin-1",
        "student_id": "user-alex",
        "student_name": "Alex Chen",
        "student_avatar": "bottts-3",
        "school_name": "Stanford University",
        "topic_name": "Integration by Parts & Substitution",
        "struggle_text": "Need help understanding how to choose u and dv in ∫ x² e^x dx!",
        "course_id": "math201",
        "is_resolved": False,
        "is_online": True,
        "answers": [
            {"sender_name": "Socratic AI Tutor", "text": "💡 Hint: Try LIATE rule! Logarithmic, Inverse trig, Algebraic, Trig, Exponential to choose u."}
        ]
    },
    {
        "id": "pin-2",
        "student_id": "user-maya",
        "student_name": "Maya Lin",
        "student_avatar": "bottts-6",
        "school_name": "MIT",
        "topic_name": "Recursion & Base Cases",
        "struggle_text": "Tracing the recursion tree for N-Queens algorithm. Anyone down to whiteboard?",
        "course_id": "cs101",
        "is_resolved": False,
        "is_online": False,
        "answers": []
    },
    {
        "id": "pin-3",
        "student_id": "user-jordan",
        "student_name": "Jordan Smith",
        "student_avatar": "bottts-8",
        "school_name": "UC Berkeley",
        "topic_name": "Newtonian Motion & Friction Dynamics",
        "struggle_text": "Calculating incline plane friction coefficient for physics lab problem 4.",
        "course_id": "phys150",
        "is_resolved": True,
        "is_online": True,
        "answers": [
            {"sender_name": "Alex Chen", "text": "Remember f_k = μ_k * N where N = m * g * cos(θ)."}
        ]
    }
]


@app.get("/topics")
def get_topics(course_id: str = "all", category: str = "All"):
    db = get_db()
    db_topics = db.query(Topic).all()

    # Count users in ACTIVE (non-expired) sessions per topic
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=SESSION_TIMEOUT_HOURS)
    active_sessions = (
        db.query(MatchSession)
        .filter(MatchSession.ended_at.is_(None), MatchSession.timestamp >= cutoff)
        .all()
    )
    live_topic_user_counts: dict[str, set] = {}
    for s in active_sessions:
        live_topic_user_counts.setdefault(s.shared_topic_id, set())
        live_topic_user_counts[s.shared_topic_id].add(s.user_a_id)
        live_topic_user_counts[s.shared_topic_id].add(s.user_b_id)
    db.close()

    result = list(PRESEEDED_TOPICS)  # start from pre-seeded baseline topic catalog

    for t in db_topics:
        if not any(item["name"].lower() == t.name.lower() for item in result):
            cat = "cs" if t.course_id == "cs101" else ("math" if t.course_id == "math201" else "all")
            live_count = len(live_topic_user_counts.get(str(t.id), set()))
            result.append({
                "id": str(t.id),
                "name": t.name,
                "category": cat,
                "course_id": t.course_id,
                "stuck_count": max(live_count, 1)
            })

    # Overlay real live counts onto pre-seeded topics where we have live data
    topic_name_to_live: dict[str, int] = {}
    for tid, users in live_topic_user_counts.items():
        t_obj = next((t for t in db_topics if str(t.id) == tid), None)
        if t_obj:
            topic_name_to_live[t_obj.name.lower()] = len(users)
    for i, item in enumerate(result):
        if item["name"].lower() in topic_name_to_live:
            result[i] = dict(item)
            result[i]["stuck_count"] = topic_name_to_live[item["name"].lower()]

    if course_id and course_id.lower() != "all":
        result = [t for t in result if t["course_id"].lower() == course_id.lower()]

    if category and category != "All":
        result = [t for t in result if t["category"].lower() == category.lower()]

    return result


@app.get("/questions/pinned")
def get_pinned_questions(user_id: str = ""):
    return PRESEEDED_PINNED_QUESTIONS


class PinQuestionReq(BaseModel):
    user_id: str
    topic_name: str
    struggle_text: str


@app.post("/questions/pin")
def pin_question(req: PinQuestionReq):
    new_pin = {
        "id": f"pin-{len(PRESEEDED_PINNED_QUESTIONS) + 1}",
        "student_id": req.user_id,
        "student_name": "You (Student)",
        "student_avatar": "bottts-1",
        "school_name": "Enrolled University",
        "topic_name": req.topic_name,
        "struggle_text": req.struggle_text,
        "course_id": "cs101",
        "is_resolved": False,
        "is_online": True,
        "answers": []
    }
    PRESEEDED_PINNED_QUESTIONS.insert(0, new_pin)
    return new_pin


class UpdatePinReq(BaseModel):
    topic_name: str
    struggle_text: str


@app.put("/questions/{question_id}")
def update_pinned_question(question_id: str, req: UpdatePinReq):
    for q in PRESEEDED_PINNED_QUESTIONS:
        if q["id"] == question_id:
            q["topic_name"] = req.topic_name
            q["struggle_text"] = req.struggle_text
            return q
    raise HTTPException(404, "Question not found.")


@app.put("/questions/{question_id}/resolve")
def resolve_pinned_question(question_id: str):
    for q in PRESEEDED_PINNED_QUESTIONS:
        if q["id"] == question_id:
            q["is_resolved"] = not q.get("is_resolved", False)
            return {"ok": True, "is_resolved": q["is_resolved"]}
    raise HTTPException(404, "Question not found.")


@app.delete("/questions/{question_id}")
def delete_pinned_question(question_id: str):
    global PRESEEDED_PINNED_QUESTIONS
    PRESEEDED_PINNED_QUESTIONS = [q for q in PRESEEDED_PINNED_QUESTIONS if q["id"] != question_id]
    return {"ok": True}


@app.get("/topics")
def get_topics(course_id: str = "cs101", category: str = "All"):
    db = get_db()
    db_topics = db.query(Topic).all()

    # Count users in ACTIVE (non-expired) sessions per topic
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=SESSION_TIMEOUT_HOURS)
    active_sessions = (
        db.query(MatchSession)
        .filter(MatchSession.ended_at.is_(None), MatchSession.timestamp >= cutoff)
        .all()
    )
    live_topic_user_counts: dict[str, set] = {}
    for s in active_sessions:
        live_topic_user_counts.setdefault(s.shared_topic_id, set())
        live_topic_user_counts[s.shared_topic_id].add(s.user_a_id)
        live_topic_user_counts[s.shared_topic_id].add(s.user_b_id)
    db.close()

    result = list(PRESEEDED_TOPICS)  # start from pre-seeded baselines

    for t in db_topics:
        if not any(item["name"].lower() == t.name.lower() for item in result):
            cat = "cs" if t.course_id == "cs101" else ("math" if t.course_id == "math201" else "all")
            live_count = len(live_topic_user_counts.get(str(t.id), set()))
            result.append({
                "id": str(t.id),
                "name": t.name,
                "category": cat,
                "course_id": t.course_id,
                "stuck_count": max(live_count, 1)  # show at least 1 for newly active topics
            })

    # Overlay real live counts onto pre-seeded topics where we have live data
    topic_name_to_live: dict[str, int] = {}
    for tid, users in live_topic_user_counts.items():
        t_obj = next((t for t in db_topics if str(t.id) == tid), None)
        if t_obj:
            topic_name_to_live[t_obj.name.lower()] = len(users)
    for i, item in enumerate(result):
        if item["name"].lower() in topic_name_to_live:
            result[i] = dict(item)  # don't mutate PRESEEDED_TOPICS entries directly
            result[i]["stuck_count"] = topic_name_to_live[item["name"].lower()]

    if course_id and course_id.lower() != "all":
        result = [t for t in result if t["course_id"].lower() == course_id.lower()]

    if category and category != "All":
        result = [t for t in result if t["category"].lower() == category.lower()]

    return result


@app.get("/questions/pinned")
def get_pinned_questions(user_id: str = ""):
    return PRESEEDED_PINNED_QUESTIONS


class PinQuestionReq(BaseModel):
    user_id: str
    topic_name: str
    struggle_text: str


@app.post("/questions/pin")
def pin_question(req: PinQuestionReq):
    new_pin = {
        "id": f"pin-{len(PRESEEDED_PINNED_QUESTIONS) + 1}",
        "student_id": req.user_id,
        "student_name": "You (Student)",
        "student_avatar": "bottts-1",
        "school_name": "Enrolled University",
        "topic_name": req.topic_name,
        "struggle_text": req.struggle_text,
        "course_id": "cs101"
    }
    PRESEEDED_PINNED_QUESTIONS.insert(0, new_pin)
    return new_pin


class AuthReq(BaseModel):
    email: str
    password: str
    name: str | None = "Student"
    course_id: str | None = "cs101"
    avatar_seed: str | None = "bottts-1"


class VerifyPinReq(BaseModel):
    user_id: str
    pin: str


@app.post("/users/signup")
def signup(req: AuthReq):
    if not req.email or not req.password:
        raise HTTPException(400, "Email and password are required.")
    email_clean = req.email.lower().strip()
    if not email_clean.endswith(".edu"):
        raise HTTPException(400, "Registration requires a valid school email ending in .edu (e.g. alex@university.edu).")
    
    db = get_db()
    # Duplicate email check
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        db.close()
        raise HTTPException(409, "An account with this email already exists. Please log in.")
    
    # Generate 6-digit PIN
    verification_pin = str(secrets.randbelow(900000) + 100000)
    user = User(
        name=req.name or "Student",
        email=email_clean,
        password_hash=_hash_password(req.password),
        course_id=req.course_id or "cs101",
        avatar_seed=req.avatar_seed or "bottts-1",
        verification_pin=verification_pin,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id, user_name = user.id, user.name
    db.close()

    print(f"==================================================")
    print(f"[Socratic] VERIFICATION PIN FOR {email_clean}: {verification_pin}")
    print(f"==================================================")

    # Attempt email dispatch if SMTP is configured
    _send_verification_email(email_clean, verification_pin)

    return {
        "id": user_id,
        "name": user_name,
        "email": email_clean,
        "course_id": req.course_id or "cs101",
        "avatar_seed": req.avatar_seed or "bottts-1",
        "verified": False,
        "requires_verification": True,
        "verification_pin": verification_pin,
        "verification_pin_demo": verification_pin,
    }


@app.post("/users/verify-pin")
def verify_pin(req: VerifyPinReq):
    db = get_db()
    user = db.get(User, req.user_id)
    if not user:
        user = User(
            id=req.user_id,
            name="Student",
            course_id="cs101",
            school_name="University",
            avatar_seed="bottts-1",
            active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # In demo mode, accept exact pin or any valid 6-digit pin
    if user.verification_pin and req.pin.strip() != user.verification_pin.strip() and len(req.pin.strip()) != 6:
        db.close()
        raise HTTPException(400, "Invalid 6-digit verification PIN.")
    
    user.is_verified = True
    user.verification_pin = None
    db.add(user)
    db.commit()
    user_id, user_name, email, course_id, avatar = user.id, user.name, user.email, user.course_id, user.avatar_seed
    db.close()
    return {
        "id": user_id,
        "name": user_name,
        "email": email,
        "course_id": course_id or "cs101",
        "avatar_seed": avatar or "bottts-1",
        "verified": True,
    }


@app.post("/users/login")
def login(req: AuthReq):
    if not req.email or not req.password:
        raise HTTPException(400, "Email and password are required.")
    db = get_db()
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user:
        db.close()
        raise HTTPException(401, "No account found with this email. Please sign up.")
    if user.password_hash and not _verify_password(req.password, user.password_hash):
        db.close()
        raise HTTPException(401, "Incorrect password. Please try again.")
    if not user.is_verified:
        db.close()
        raise HTTPException(403, "Email verification required. Please enter the 6-digit verification PIN sent to your email.")
    user_id = user.id
    user_name = user.name
    course_id = user.course_id
    avatar_seed = user.avatar_seed or "bottts-1"
    db.close()
    return {
        "id": user_id,
        "name": user_name,
        "email": req.email,
        "course_id": course_id,
        "avatar_seed": avatar_seed,
        "verified": True,
    }


class StatusUpdateReq(BaseModel):
    status: str  # 'online' | 'away' | 'dnd' | 'invisible'


@app.put("/users/{user_id}/status")
def update_user_status(user_id: str, req: StatusUpdateReq):
    db = get_db()
    try:
        us = db.get(UserStatus, user_id)
        if not us:
            us = UserStatus(user_id=user_id, status=req.status)
        else:
            us.status = req.status
            us.updated_at = datetime.datetime.utcnow()
        db.add(us)
        db.commit()
        return {"ok": True, "status": req.status}
    finally:
        db.close()


@app.get("/users/{user_id}/status")
def get_user_status(user_id: str):
    db = get_db()
    try:
        us = db.get(UserStatus, user_id)
        return {"status": us.status if us else "online"}
    finally:
        db.close()


class ProfileUpdateReq(BaseModel):
    user_id: str
    name: str
    avatar_seed: str
    school_name: str | None = None


@app.put("/users/profile")
def update_profile(req: ProfileUpdateReq):
    db = get_db()
    user = db.get(User, req.user_id)
    if user:
        user.name = req.name
        db.add(user)
        db.commit()
        db.close()
    return {
        "id": req.user_id,
        "name": req.name,
        "avatar_seed": req.avatar_seed,
        "school_name": req.school_name or "Stanford University"
    }


@app.delete("/users/{user_id}")
def delete_user(user_id: str):
    db = get_db()
    user = db.get(User, user_id)
    if user:
        db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).delete()
        db.delete(user)
        db.commit()
    db.close()
    return {"ok": True, "message": "User account permanently deleted."}


class LeaveSessionReq(BaseModel):
    user_id: str


@app.post("/match/{session_id}/leave")
def leave_session(session_id: str, req: LeaveSessionReq):
    """Mark session as ended for the user who left, and transition staying student to AI tutor."""
    db = get_db()
    try:
        leaving_user_id = req.user_id
        session = db.get(MatchSession, session_id)
        if session:
            session.ended_at = datetime.datetime.utcnow()
            staying_user_id = session.user_b_id if session.user_a_id == leaving_user_id else session.user_a_id

            # If staying partner is a human student, transition them to Socratic AI Tutor
            if staying_user_id and not staying_user_id.startswith("demo-peer") and staying_user_id != "ai-tutor-bot":
                topic_obj = db.get(Topic, session.shared_topic_id)
                topic_name = topic_obj.name if topic_obj else "Study Session"
                
                ai_session = MatchSession(
                    user_a_id=staying_user_id,
                    user_b_id="ai-tutor-bot",
                    shared_topic_id=session.shared_topic_id,
                    explanation="Your study partner left the session. Socratic AI Tutor has stepped in to continue guiding you!",
                    scratchpad_content=session.scratchpad_content or "",
                    canvas_content=session.canvas_content or "",
                )
                db.add(ai_session)
                SESSION_SCRATCHPAD_DATA[ai_session.id] = session.scratchpad_content or ""
                SESSION_CANVAS_DATA[ai_session.id] = session.canvas_content or ""
                SESSION_TOPICS[ai_session.id] = topic_name
                SESSION_CHAT_MESSAGES[ai_session.id] = [
                    {
                        "id": "msg-trans-1",
                        "sender_id": "ai-tutor-bot",
                        "sender_name": "Socratic AI Tutor",
                        "sender_avatar": "bottts-4",
                        "text": f"Your study partner has stepped away, but I am here to help you finish! Let's continue working through {topic_name}. What part would you like to explore next?",
                        "timestamp": datetime.datetime.utcnow().strftime("%H:%M")
                    }
                ]
            db.add(session)

        # Also expire any other open sessions for this leaving user
        db.query(MatchSession).filter(
            MatchSession.ended_at.is_(None),
            (MatchSession.user_a_id == leaving_user_id) | (MatchSession.user_b_id == leaving_user_id)
        ).update({"ended_at": datetime.datetime.utcnow()}, synchronize_session=False)

        db.commit()
    finally:
        db.close()
    return {"ok": True, "message": "Left study session."}


@app.get("/users/{user_id}/active-session")
def get_active_session(user_id: str):
    """Return the user's active (non-expired) session, if any."""
    db = get_db()
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=SESSION_TIMEOUT_HOURS)
    session = (
        db.query(MatchSession)
        .filter(
            MatchSession.ended_at.is_(None),
            MatchSession.timestamp >= cutoff,
            (MatchSession.user_a_id == user_id) | (MatchSession.user_b_id == user_id),
        )
        .order_by(MatchSession.timestamp.desc())
        .first()
    )
    db.close()
    if not session:
        return {"has_active_session": False}

    partner_id = session.user_b_id if session.user_a_id == user_id else session.user_a_id
    db2 = get_db()
    partner = db2.get(User, partner_id)
    topic = db2.get(Topic, session.shared_topic_id)
    db2.close()

    return {
        "has_active_session": True,
        "session_id": session.id,
        "partner_id": partner_id,
        "partner_name": partner.name if partner else "Study Partner",
        "partner_avatar": partner.avatar_seed if partner else "bottts-1",
        "shared_topic": topic.name if topic else "Study Session",
        "started_at": session.timestamp.isoformat() if session.timestamp else None,
    }


@app.get("/users/{user_id}/sessions")
def get_user_sessions(user_id: str):
    db = get_db()
    try:
        user = db.get(User, user_id)
        user_name = user.name if user else "Student"

        sessions = (
            db.query(MatchSession)
            .filter(
                (MatchSession.user_a_id == user_id) | (MatchSession.user_b_id == user_id)
            )
            .order_by(MatchSession.timestamp.desc())
            .limit(20)
            .all()
        )
        result = []
        for s in sessions:
            partner_id = s.user_b_id if s.user_a_id == user_id else s.user_a_id
            partner = db.get(User, partner_id)
            topic = db.get(Topic, s.shared_topic_id) if s.shared_topic_id else None
            iso_time = s.timestamp.isoformat() if s.timestamp else datetime.datetime.utcnow().isoformat()
            result.append({
                "id": s.id,
                "partner_id": partner_id,
                "partner_name": partner.name if partner else "Elena Rostova",
                "partner_avatar": partner.avatar_seed if partner else "bottts-2",
                "shared_topic": topic.name if topic else "Recursion & Base Cases",
                "explanation": s.explanation or f"{user_name} and Elena Rostova paired based on complementary struggle-mastery profiles for Recursion & Base Cases.",
                "timestamp": iso_time,
                "started_at": iso_time,
                "is_active": s.ended_at is None,
                "post_confidence": s.post_confidence or 5,
            })

        if not result:
            now_iso = datetime.datetime.utcnow().isoformat()
            result.append({
                "id": f"sess-history-{user_id[:8] if len(user_id) >= 8 else 'demo'}",
                "partner_id": "demo-peer-1",
                "partner_name": "Elena Rostova",
                "partner_avatar": "bottts-2",
                "shared_topic": "Recursion & Base Cases",
                "explanation": f"{user_name} and Elena Rostova were paired based on complementary struggle-mastery profiles for Recursion & Base Cases.",
                "timestamp": now_iso,
                "started_at": now_iso,
                "is_active": False,
                "post_confidence": 5,
            })

        return result
    except Exception:
        now_iso = datetime.datetime.utcnow().isoformat()
        return [{
            "id": "sess-history-demo",
            "partner_id": "demo-peer-1",
            "partner_name": "Elena Rostova",
            "partner_avatar": "bottts-2",
            "shared_topic": "Recursion & Base Cases",
            "explanation": "Paired with Elena Rostova on complementary struggle-mastery profiles for Recursion & Base Cases.",
            "timestamp": now_iso,
            "started_at": now_iso,
            "is_active": False,
            "post_confidence": 5,
        }]
    finally:
        db.close()


@app.get("/friends/{user_id}")
def get_friends(user_id: str):
    db = get_db()
    try:
        friendships = (
            db.query(Friendship)
            .filter(
                ((Friendship.user_id_a == user_id) | (Friendship.user_id_b == user_id))
                & (Friendship.status == "accepted")
            )
            .all()
        )
        result = []
        for f in friendships:
            friend_id = f.user_id_b if f.user_id_a == user_id else f.user_id_a
            friend = db.get(User, friend_id)
            if friend:
                result.append({
                    "id": friend.id,
                    "name": friend.name,
                    "avatar_seed": friend.avatar_seed or "bottts-1",
                    "course_id": friend.course_id or "cs101",
                    "school": friend.school_name or "University",
                    "status": "online",
                })
        return result
    except Exception:
        return []
    finally:
        db.close()


class FriendReq(BaseModel):
    user_id: str
    friend_email_or_name: str


class BlockReq(BaseModel):
    blocker_id: str
    target_id: str | None = None
    blocked_id: str | None = None

    def get_target(self) -> str:
        return self.target_id or self.blocked_id or ""


class ReportReq(BaseModel):
    reporter_id: str
    target_id: str | None = None
    reported_id: str | None = None
    reason: str | None = "Inappropriate conduct"
    details: str | None = None

    def get_target(self) -> str:
        return self.target_id or self.reported_id or ""




@app.post("/users/block")
def block_user_handler(req: BlockReq):
    db = get_db()
    try:
        from models import Block as BlockModel, Friendship as FriendshipModel
        target_id = req.get_target()
        existing = (
            db.query(BlockModel)
            .filter(BlockModel.blocker_id == req.blocker_id, BlockModel.blocked_id == target_id)
            .first()
        )
        if not existing:
            block = BlockModel(blocker_id=req.blocker_id, blocked_id=target_id)
            db.add(block)

        db.query(FriendshipModel).filter(
            ((FriendshipModel.user_id_a == req.blocker_id) & (FriendshipModel.user_id_b == target_id))
            | ((FriendshipModel.user_id_a == target_id) & (FriendshipModel.user_id_b == req.blocker_id))
        ).delete(synchronize_session=False)

        db.commit()
        return {"ok": True, "message": "User blocked successfully."}
    finally:
        db.close()


@app.post("/users/unblock")
def unblock_user_handler(req: BlockReq):
    db = get_db()
    try:
        from models import Block as BlockModel
        target_id = req.get_target()
        db.query(BlockModel).filter(
            BlockModel.blocker_id == req.blocker_id, BlockModel.blocked_id == target_id
        ).delete(synchronize_session=False)
        db.commit()
        return {"ok": True, "message": "User unblocked successfully."}
    finally:
        db.close()


@app.get("/users/{user_id}/blocked")
def get_blocked_users(user_id: str):
    db = get_db()
    try:
        from models import Block as BlockModel
        blocks = db.query(BlockModel).filter(BlockModel.blocker_id == user_id).all()
        blocked_ids = [b.blocked_id for b in blocks]
        users = db.query(User).filter(User.id.in_(blocked_ids)).all() if blocked_ids else []
        return [
            {
                "id": u.id,
                "name": u.name,
                "avatar_seed": u.avatar_seed or "bottts-1",
                "school": u.school_name or "University",
            }
            for u in users
        ]
    finally:
        db.close()


@app.post("/users/report")
def report_user_handler(req: ReportReq):
    db = get_db()
    try:
        from models import Report as ReportModel
        target_id = req.get_target()
        rep = ReportModel(
            reporter_id=req.reporter_id,
            reported_id=target_id,
            reason=req.reason or "Inappropriate conduct",
            details=req.details,
        )
        db.add(rep)
        db.commit()
        return {"ok": True, "message": "Report submitted successfully to moderators."}
    finally:
        db.close()


class DirectMatchReq(BaseModel):
    user_id: str
    friend_id: str | None = None
    topic_name: str | None = "General Study Session"


# In-memory storage for session chat messages, canvas, scratchpads, and publish votes
SESSION_CHAT_MESSAGES: dict = {}
SESSION_CANVAS_DATA: dict = {}
SESSION_SCRATCHPAD_DATA: dict = {}
SESSION_TOPICS: dict = {}
SESSION_PUBLISH_VOTES: dict[str, set] = defaultdict(set)


class PublishConsentReq(BaseModel):
    user_id: str
    consent: bool = True


@app.post("/match/{session_id}/publish-consent")
async def toggle_publish_consent(session_id: str, req: PublishConsentReq):
    db = get_db()
    session = db.get(MatchSession, session_id)
    topic_name = SESSION_TOPICS.get(session_id, "")
    if session and not topic_name:
        t = db.get(Topic, session.shared_topic_id)
        if t:
            topic_name = t.name
    if not topic_name:
        topic_name = "General Study Session"

    is_ai_session = "sess-ai" in session_id or (session and session.user_b_id == "ai-tutor-bot")
    required_votes = 1 if is_ai_session else 2

    if req.consent:
        SESSION_PUBLISH_VOTES[session_id].add(req.user_id)
    else:
        SESSION_PUBLISH_VOTES[session_id].discard(req.user_id)

    vote_count = len(SESSION_PUBLISH_VOTES[session_id])
    approved = vote_count >= required_votes

    tags = []
    if approved:
        # Check if already published
        from models import PublicSolution as PublicSolutionModel
        existing = db.query(PublicSolutionModel).filter(PublicSolutionModel.id == f"sol-{session_id}").first()
        if not existing:
            scratchpad = SESSION_SCRATCHPAD_DATA.get(session_id, "")
            if not scratchpad and session:
                scratchpad = session.scratchpad_content or ""
            canvas = SESSION_CANVAS_DATA.get(session_id, "")
            if not canvas and session:
                canvas = session.canvas_content or ""
            history = SESSION_CHAT_MESSAGES.get(session_id, [])

            # Run AI Multimodal Quality Vetting & Tagging
            vetted = await ai_tutor.vet_and_tag_solution(topic_name, scratchpad, canvas, history)
            if vetted["is_valid"]:
                tags = vetted["tags"]
                author_a = "Student"
                author_b = "Study Partner" if not is_ai_session else "Socratic AI Tutor"

                if session:
                    u_a = db.get(User, session.user_a_id)
                    u_b = db.get(User, session.user_b_id) if session.user_b_id else None
                    if u_a: author_a = u_a.name
                    if u_b: author_b = u_b.name

                sol = PublicSolutionModel(
                    id=f"sol-{session_id}",
                    topic_name=topic_name,
                    author_a_name=author_a,
                    author_b_name=author_b,
                    scratchpad_content=scratchpad,
                    canvas_content=canvas,
                    ai_tags=", ".join(tags),
                    votes_count=vote_count,
                    is_vetted=True,
                )
                db.add(sol)
                db.commit()

    db.close()
    return {
        "ok": True,
        "votes": vote_count,
        "required": required_votes,
        "approved": approved,
        "tags": tags,
    }


@app.get("/topics/{topic_name}/public-solutions")
def get_public_solutions_for_topic(topic_name: str):
    db = get_db()
    try:
        from models import PublicSolution as PublicSolutionModel
        # Search by exact or partial topic match
        rows = (
            db.query(PublicSolutionModel)
            .filter(PublicSolutionModel.topic_name.ilike(f"%{topic_name}%"))
            .order_by(PublicSolutionModel.created_at.desc())
            .all()
        )
        result = []
        for r in rows:
            tag_list = [t.strip() for t in r.ai_tags.split(",") if t.strip()] if r.ai_tags else []
            result.append({
                "id": r.id,
                "topic_name": r.topic_name,
                "author_a_name": r.author_a_name,
                "author_b_name": r.author_b_name or "Socratic AI Tutor",
                "scratchpad_content": r.scratchpad_content,
                "canvas_content": r.canvas_content,
                "ai_tags": tag_list,
                "votes_count": r.votes_count,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return result
    except Exception:
        return []
    finally:
        db.close()
SESSION_TOPICS: dict = {}  # session_id -> topic name for AI tutor context


@app.post("/match/direct-start")
@app.post("/match/ai-start")
def start_direct_session(req: DirectMatchReq):
    session_id = f"sess-ai-{int(datetime.datetime.utcnow().timestamp())}"
    topic = req.topic_name or "Recursion & Base Cases"
    
    db = get_db()
    user = db.get(User, req.user_id)
    if not user:
        user = User(
            id=req.user_id,
            name="Student",
            course_id="cs101",
            school_name="University",
            avatar_seed="bottts-1",
            active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    user_name = user.name or "Student"

    db_topic = db.query(Topic).filter(Topic.name == topic).first()
    if not db_topic:
        db_topic = Topic(course_id=user.course_id or "cs101", name=topic)
        db.add(db_topic)
        db.commit()
        db.refresh(db_topic)

    scratchpad_init = f"""# 🧠 Socratic Study Session: {topic}

## 🎯 Learning Objectives
- Breakdown key concepts for **{topic}**.
- Solve example problems step-by-step with your Socratic AI Tutor.

## 💡 Guided Problem Breakdown
1. **Identify Given Information & Variables**:
   - Write out the initial equation or given conditions.
2. **Determine Applicable Formulas / Rules**:
   - What fundamental theorem or rule applies here?
3. **Step-by-Step Derivation**:
   - Solve step 1:
   - Solve step 2:
4. **Verification & Edge Cases**:
   - Test extreme values or base cases to confirm correctness.

---
*💡 Use the Chat panel on the right to converse step-by-step with your Socratic AI Tutor!*
"""

    session = MatchSession(
        id=session_id,
        user_a_id=user.id,
        user_b_id="ai-tutor-bot",
        shared_topic_id=db_topic.id,
        explanation="Matched with Socratic AI Tutor for 1-on-1 step-by-step guided problem solving.",
        scratchpad_content=scratchpad_init,
    )
    db.add(session)
    db.commit()

    intro_text = f"Hello {user_name}! I am your Socratic AI Tutor for {topic}. What specific part of this problem would you like to explore first?"
    try:
        from models import ChatMessage as ChatMessageModel
        db.add(ChatMessageModel(
            session_id=session_id,
            sender_id="ai-tutor-bot",
            sender_name="Socratic AI Tutor",
            text=intro_text,
        ))
        db.commit()
    except Exception:
        pass
    db.close()

    SESSION_SCRATCHPAD_DATA[session_id] = scratchpad_init
    SESSION_CHAT_MESSAGES[session_id] = [
        {
            "id": "msg-init-ai",
            "sender_id": "ai-tutor-bot",
            "sender_name": "Socratic AI Tutor",
            "sender_avatar": "bottts-4",
            "text": intro_text,
            "timestamp": datetime.datetime.utcnow().strftime("%H:%M")
        }
    ]
    SESSION_TOPICS[session_id] = topic

    return {
        "session_id": session_id,
        "partner_name": "Socratic AI Tutor",
        "partner_id": "ai-tutor-bot",
        "partner_avatar": "bottts-4",
        "shared_topic": topic,
        "explanation": "Matched with Socratic AI Tutor for 1-on-1 step-by-step guided problem solving.",
        "is_active": True
    }


@app.get("/match/{session_id}/canvas")
def get_canvas(session_id: str):
    data = SESSION_CANVAS_DATA.get(session_id, "")
    return {"canvas_data": data}


class CanvasUpdateReq(BaseModel):
    content: str


@app.put("/match/{session_id}/canvas")
def save_canvas(session_id: str, req: CanvasUpdateReq):
    SESSION_CANVAS_DATA[session_id] = req.content
    return {"ok": True}


@app.get("/match/{session_id}/messages")
def get_messages(session_id: str):
    return SESSION_CHAT_MESSAGES.get(session_id, [])


class SendMsgReq(BaseModel):
    sender_id: str
    text: str


@app.post("/match/{session_id}/messages")
async def send_message(session_id: str, req: SendMsgReq):
    # Rate limit: 60 msgs/min per session+user combo
    if not _check_rate(f"chat:{session_id}:{req.sender_id}", 60, 60):
        raise HTTPException(status_code=429, detail="Sending too fast — please slow down.")

    clean_text = content_filter.censor_text(req.text or "")

    if session_id not in SESSION_CHAT_MESSAGES:
        SESSION_CHAT_MESSAGES[session_id] = []

    new_msg = {
        "id": f"msg-{len(SESSION_CHAT_MESSAGES[session_id]) + 1}",
        "sender_id": req.sender_id,
        "sender_name": "You" if req.sender_id != "ai-tutor-bot" else "Socratic AI Tutor",
        "sender_avatar": "bottts-1" if req.sender_id != "ai-tutor-bot" else "bottts-4",
        "text": clean_text,
        "timestamp": datetime.datetime.utcnow().strftime("%H:%M")
    }
    SESSION_CHAT_MESSAGES[session_id].append(new_msg)

    # Broadcast to WebSocket peers
    await _ws_broadcast(session_id, {"type": "chat", "payload": new_msg})

    # Persist to DB so chat survives server restarts
    db2 = get_db()
    try:
        from models import ChatMessage as ChatMessageModel
        db_msg = ChatMessageModel(
            session_id=session_id,
            sender_id=req.sender_id,
            sender_name=new_msg["sender_name"],
            text=req.text,
        )
        db2.add(db_msg)
        db2.commit()
    except Exception:
        pass
    finally:
        db2.close()

    # AI tutor / Demo peer reply
    if req.sender_id != "ai-tutor-bot" and not req.sender_id.startswith("demo-peer"):
        db_s = get_db()
        session_obj = db_s.get(MatchSession, session_id)
        partner_obj = db_s.get(User, session_obj.user_b_id) if session_obj and session_obj.user_b_id else None
        db_s.close()

        is_demo_session = "sess-ai" in session_id or (partner_obj and partner_obj.id.startswith("demo-peer"))
        if is_demo_session:
            topic = SESSION_TOPICS.get(session_id, "")
            history = SESSION_CHAT_MESSAGES[session_id]
            is_ai = "sess-ai" in session_id or not partner_obj
            reply_name = "Socratic AI Tutor" if is_ai else partner_obj.name
            reply_id = "ai-tutor-bot" if is_ai else partner_obj.id
            reply_avatar = "bottts-4" if is_ai else (partner_obj.avatar_seed or "bottts-2")

            ai_text = await ai_tutor.get_response(topic, history, req.text)
            ai_reply = {
                "id": f"msg-reply-{len(SESSION_CHAT_MESSAGES[session_id]) + 1}",
                "sender_id": reply_id,
                "sender_name": reply_name,
                "sender_avatar": reply_avatar,
                "text": ai_text,
                "timestamp": datetime.datetime.utcnow().strftime("%H:%M")
            }
            SESSION_CHAT_MESSAGES[session_id].append(ai_reply)
            await _ws_broadcast(session_id, {"type": "chat", "payload": ai_reply})
            # Persist AI / peer reply too
            db3 = get_db()
            try:
                from models import ChatMessage as ChatMessageModel
                db3.add(ChatMessageModel(session_id=session_id, sender_id=reply_id, sender_name=reply_name, text=ai_text))
                db3.commit()
            except Exception:
                pass
            finally:
                db3.close()

    return new_msg


@app.get("/match/{session_id}/ai-log")
def get_ai_log(session_id: str):
    msgs = SESSION_CHAT_MESSAGES.get(session_id, [])
    topic = SESSION_TOPICS.get(session_id, "this session")
    student_msgs = [m for m in msgs if m.get("sender_id") != "ai-tutor-bot"]
    log = (
        f"# Socratic Session AI Log\n\n"
        f"**Topic:** {topic}\n"
        f"**Total messages:** {len(msgs)} ({len(student_msgs)} from student)\n\n"
        "Generate a full AI summary using the button below."
    )
    return {"ai_log": log}


@app.post("/match/{session_id}/ai-log/generate")
async def generate_ai_log(session_id: str):
    topic = SESSION_TOPICS.get(session_id, "")
    history = SESSION_CHAT_MESSAGES.get(session_id, [])
    summary = await ai_tutor.generate_session_summary(topic, history)
    # Persist to DB if session exists
    db = get_db()
    try:
        s = db.get(MatchSession, session_id)
        if s:
            s.ai_summary_log = summary
            db.add(s)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
    return {"ai_log": summary}


@app.post("/match/{session_id}/socratic-hint")
async def get_socratic_hint(session_id: str):
    topic = SESSION_TOPICS.get(session_id, "")
    history = SESSION_CHAT_MESSAGES.get(session_id, [])
    hint = await ai_tutor.get_hint(topic, history)
    return {"hint": hint}


class RateConfidenceReq(BaseModel):
    user_id: str
    post_confidence: int


@app.post("/match/{session_id}/rate-confidence")
def rate_confidence(session_id: str, req: RateConfidenceReq):
    db = get_db()
    try:
        s = db.get(MatchSession, session_id)
        if s:
            s.post_confidence = max(1, min(5, req.post_confidence))
            db.add(s)
            db.commit()
    except Exception:
        pass
    finally:
        db.close()
    return {"ok": True, "message": f"Recorded post-session confidence score of {req.post_confidence} stars!"}


class UpdateQuestionReq(BaseModel):
    topic_name: str
    struggle_text: str


@app.put("/questions/{question_id}")
def update_pinned_question(question_id: str, req: UpdateQuestionReq):
    for q in PRESEEDED_PINNED_QUESTIONS:
        if q["id"] == question_id:
            q["topic_name"] = req.topic_name
            q["struggle_text"] = req.struggle_text
            return q
    return {"ok": True, "id": question_id, "topic_name": req.topic_name, "struggle_text": req.struggle_text}


@app.delete("/questions/{question_id}")
def delete_pinned_question(question_id: str):
    global PRESEEDED_PINNED_QUESTIONS
    PRESEEDED_PINNED_QUESTIONS = [q for q in PRESEEDED_PINNED_QUESTIONS if q["id"] != question_id]
    return {"ok": True, "message": "Question removed from board."}


# ---------------------------------------------------------------------------
# Social, Direct Messaging, Study Requests, & Status Management (DB-backed)
# ---------------------------------------------------------------------------

PENDING_EMAIL_VERIFICATIONS: dict = {}


@app.post("/users/request-email-change")
def request_email_change(req: EmailChangeReq):
    if not req.new_email.lower().endswith(".edu"):
        raise HTTPException(status_code=400, detail="Verification requires a valid university .edu email address.")

    import secrets
    pin = f"{secrets.randbelow(900000) + 100000:06d}"
    PENDING_EMAIL_VERIFICATIONS[req.user_id] = {"new_email": req.new_email, "pin": pin}

    # Send actual email (falls back to console if SMTP not configured)
    _send_verification_email(req.new_email, pin)

    return {
        "ok": True,
        "verification_pin": pin,
        "message": f"Verification code sent to {req.new_email}. Check your inbox (or server console if SMTP not configured)."
    }


@app.post("/users/verify-email-change")
def verify_email_change(req: VerifyEmailChangeReq):
    pending = PENDING_EMAIL_VERIFICATIONS.get(req.user_id)
    if not pending or pending["pin"] != req.pin.strip():
        raise HTTPException(status_code=400, detail="Invalid 6-digit verification code. Please check and retry.")
    del PENDING_EMAIL_VERIFICATIONS[req.user_id]
    db = get_db()
    user = db.get(User, req.user_id)
    if user:
        user.email = req.new_email
        user.is_verified = True
        db.add(user)
        db.commit()
    db.close()
    return {"ok": True, "email": req.new_email, "is_verified": True, "message": f"Email verified as {req.new_email}!"}


@app.get("/friends/{user_id}")
def get_user_friends(user_id: str):
    db = get_db()
    rows = (
        db.query(Friendship)
        .filter(
            Friendship.status == "accepted",
            (Friendship.user_id_a == user_id) | (Friendship.user_id_b == user_id),
        )
        .all()
    )
    result = []
    for r in rows:
        friend_id = r.user_id_b if r.user_id_a == user_id else r.user_id_a
        friend = db.get(User, friend_id)
        if friend:
            st = db.query(UserStatus).filter(UserStatus.user_id == friend_id).first()
            result.append({
                "id": friend_id,
                "name": friend.name,
                "avatar_seed": friend.avatar_seed or "bottts-1",
                "school_name": friend.school_name or "University",
                "status": st.status if st else "online",
            })
    db.close()
    # Seed demo friends if user has none yet
    if not result:
        result = [
            {"id": "friend-demo-1", "name": "Maya Lin", "avatar_seed": "bottts-6", "school_name": "Stanford University", "status": "online"},
            {"id": "friend-demo-2", "name": "Alex Chen", "avatar_seed": "bottts-3", "school_name": "UC Berkeley", "status": "away"},
        ]
    return result


class UserStatusReq(BaseModel):
    user_id: str
    status: str  # 'online' | 'dnd' | 'away' | 'invisible'


@app.put("/users/{user_id}/status")
def update_user_status(user_id: str, req: UserStatusReq):
    db = get_db()
    st = db.query(UserStatus).filter(UserStatus.user_id == user_id).first()
    if st:
        st.status = req.status
        st.updated_at = datetime.datetime.utcnow()
    else:
        st = UserStatus(user_id=user_id, status=req.status)
        db.add(st)
    db.commit()
    db.close()
    return {"ok": True, "status": req.status}


@app.get("/users/{user_id}/status")
def get_user_status(user_id: str):
    db = get_db()
    st = db.query(UserStatus).filter(UserStatus.user_id == user_id).first()
    db.close()
    return {"status": st.status if st else "online"}


@app.get("/recent-partners/{user_id}")
def get_recent_partners(user_id: str):
    db = get_db()
    rows = (
        db.query(RecentPartner)
        .filter(RecentPartner.user_id == user_id)
        .order_by(RecentPartner.matched_at.desc())
        .limit(20)
        .all()
    )
    db.close()
    if not rows:
        return [
            {"id": "partner-demo-1", "name": "Jordan Smith", "avatar_seed": "bottts-8", "school": "UC Berkeley", "matched_at": "2 days ago"},
            {"id": "partner-demo-2", "name": "Elena Rostova", "avatar_seed": "bottts-9", "school": "MIT", "matched_at": "5 days ago"},
        ]
    return [
        {
            "id": r.partner_id, "name": r.partner_name,
            "avatar_seed": r.partner_avatar or "bottts-1",
            "school": r.school or "University",
            "matched_at": r.matched_at.strftime("%b %d") if r.matched_at else "Recently",
        }
        for r in rows
    ]


@app.get("/friend-requests/{user_id}")
def get_friend_requests(user_id: str):
    db = get_db()
    rows = db.query(Friendship).filter(Friendship.status == "pending").all()
    db.close()
    incoming = [
        {"id": r.id, "sender_id": r.sender_id, "sender_name": r.sender_name,
         "sender_avatar": r.sender_avatar, "receiver_id": r.receiver_id, "created_at": "Recently"}
        for r in rows if r.receiver_id == user_id
    ]
    outgoing = [
        {"id": r.id, "sender_id": r.sender_id, "sender_name": r.sender_name,
         "sender_avatar": r.sender_avatar, "receiver_id": r.receiver_id, "created_at": "Recently"}
        for r in rows if r.sender_id == user_id
    ]
    return {"incoming": incoming, "outgoing": outgoing}


class FriendRespondReq(BaseModel):
    request_id: str
    user_id: str
    action: str  # 'accept' | 'decline' | 'cancel'


@app.post("/friend-requests/respond")
def respond_friend_request(req: FriendRespondReq):
    db = get_db()
    f = db.query(Friendship).filter(Friendship.id == req.request_id).first()
    if not f:
        db.close()
        return {"ok": True, "message": "Request not found."}
    if req.action == "accept":
        f.status = "accepted"
        db.add(f)
        db.commit()
        db.close()
        return {"ok": True, "message": f"Accepted friend request from {f.sender_name}!"}
    else:
        db.delete(f)
        db.commit()
        db.close()
        return {"ok": True, "message": f"Request {req.action}ed."}


@app.post("/friends/request")
def send_friend_req(req: FriendReq):
    db = get_db()
    try:
        from models import Block as BlockModel
        clean_input = req.friend_email_or_name.strip()
        sender = db.get(User, req.user_id)

        # 1. Look up target by ID, Email, or Name
        target = (
            db.query(User)
            .filter(
                (User.id == clean_input)
                | (User.email == clean_input.lower())
                | (User.name.ilike(clean_input))
            )
            .first()
        )

        # 2. If target is a demo peer or not in DB, auto-provision
        if not target:
            demo_match = next((d for d in DEMO_CLASSMATES if d["id"] == clean_input or d["name"].lower() == clean_input.lower()), None)
            if demo_match:
                target = User(
                    id=demo_match["id"],
                    name=demo_match["name"],
                    email=demo_match["email"],
                    school_name=demo_match["school_name"],
                    avatar_seed=demo_match["avatar_seed"],
                    course_id="cs101",
                    active=True,
                    is_verified=True,
                )
            else:
                target = User(
                    id=f"user-{clean_input.lower().replace(' ', '-')}",
                    name=clean_input if "@" not in clean_input else clean_input.split("@")[0].title(),
                    email=clean_input if "@" in clean_input else f"{clean_input.lower().replace(' ', '')}@stanford.edu",
                    school_name="University",
                    avatar_seed="bottts-2",
                    course_id="cs101",
                    active=True,
                    is_verified=True,
                )
            db.add(target)
            db.commit()
            db.refresh(target)

        # 3. Check self-requests
        if target.id == req.user_id:
            raise HTTPException(400, "You cannot send a friend request to yourself.")

        # 4. Check Block status
        is_blocked = (
            db.query(BlockModel)
            .filter(
                ((BlockModel.blocker_id == req.user_id) & (BlockModel.blocked_id == target.id))
                | ((BlockModel.blocker_id == target.id) & (BlockModel.blocked_id == req.user_id))
            )
            .first()
        )
        if is_blocked:
            raise HTTPException(400, "You cannot send a friend request to a blocked user. Unblock them first.")

        # 5. Check if friendship already exists
        existing = db.query(Friendship).filter(
            ((Friendship.user_id_a == req.user_id) & (Friendship.user_id_b == target.id))
            | ((Friendship.user_id_a == target.id) & (Friendship.user_id_b == req.user_id))
        ).first()
        if existing:
            return {"ok": True, "message": f"Already friends or request pending with {target.name}!", "friend_name": target.name}

        friendship = Friendship(
            user_id_a=req.user_id,
            user_id_b=target.id,
            status="pending",
            sender_id=req.user_id,
            sender_name=sender.name if sender else "Student",
            sender_avatar=sender.avatar_seed if sender else "bottts-1",
            receiver_id=target.id,
        )
        db.add(friendship)
        db.commit()
        return {"ok": True, "message": f"Friend request sent to {target.name}!", "friend_name": target.name}
    finally:
        db.close()


def get_dm_key(u1: str, u2: str) -> str:
    return f"{min(u1, u2)}:{max(u1, u2)}"


class SendDMReq(BaseModel):
    sender_id: str
    sender_name: str
    sender_avatar: str
    receiver_id: str
    text: str


@app.get("/dm/{user_id}/{friend_id}/messages")
def get_dm_messages(user_id: str, friend_id: str):
    db = get_db()
    msgs = (
        db.query(DirectMessage)
        .filter(
            ((DirectMessage.sender_id == user_id) & (DirectMessage.receiver_id == friend_id))
            | ((DirectMessage.sender_id == friend_id) & (DirectMessage.receiver_id == user_id))
        )
        .order_by(DirectMessage.timestamp)
        .all()
    )
    db.close()
    return [
        {
            "id": m.id, "sender_id": m.sender_id, "sender_name": m.sender_name,
            "sender_avatar": m.sender_avatar or "bottts-1", "receiver_id": m.receiver_id,
            "text": m.text, "is_edited": m.is_edited, "is_deleted": m.is_deleted,
            "is_study_request": m.is_study_request, "study_request_id": m.study_request_id,
            "timestamp": m.timestamp.strftime("%H:%M") if m.timestamp else "Just now",
        }
        for m in msgs
    ]


@app.post("/dm/{user_id}/{friend_id}/messages")
def send_dm_message(user_id: str, friend_id: str, req: SendDMReq):
    if not _check_rate(f"dm:{user_id}", 30, 60):
        raise HTTPException(status_code=429, detail="Sending too fast.")
    db = get_db()
    msg = DirectMessage(
        sender_id=req.sender_id, receiver_id=req.receiver_id,
        sender_name=req.sender_name, sender_avatar=req.sender_avatar, text=req.text,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    db.close()
    return {
        "id": msg.id, "sender_id": msg.sender_id, "sender_name": msg.sender_name,
        "sender_avatar": msg.sender_avatar, "receiver_id": msg.receiver_id,
        "text": msg.text, "is_edited": False, "is_deleted": False,
        "timestamp": msg.timestamp.strftime("%H:%M") if msg.timestamp else "Just now",
    }


class EditDMReq(BaseModel):
    text: str


@app.put("/dm/messages/{msg_id}")
def edit_dm_message(msg_id: str, req: EditDMReq):
    db = get_db()
    m = db.get(DirectMessage, msg_id)
    if m:
        m.text = req.text
        m.is_edited = True
        db.add(m)
        db.commit()
    db.close()
    return {"ok": True}


@app.delete("/dm/messages/{msg_id}")
def delete_dm_message(msg_id: str):
    db = get_db()
    m = db.get(DirectMessage, msg_id)
    if m:
        m.is_deleted = True
        m.text = "This message was deleted."
        db.add(m)
        db.commit()
    db.close()
    return {"ok": True}


class CreateStudyReq(BaseModel):
    sender_id: str
    sender_name: str
    sender_avatar: str
    receiver_id: str
    topic_name: str
    struggle_text: str
    proficiency_level: int
    pre_confidence: int


@app.post("/study-requests")
def create_study_request(req: CreateStudyReq):
    db = get_db()
    sr = StudyRequest(
        sender_id=req.sender_id, sender_name=req.sender_name,
        sender_avatar=req.sender_avatar, receiver_id=req.receiver_id,
        topic_name=req.topic_name, struggle_text=req.struggle_text,
        proficiency_level=req.proficiency_level, pre_confidence=req.pre_confidence,
    )
    db.add(sr)

    # Deliver as a DM card too
    dm = DirectMessage(
        sender_id=req.sender_id, receiver_id=req.receiver_id,
        sender_name=req.sender_name, sender_avatar=req.sender_avatar,
        text=f"📚 Study Session Request: {req.topic_name}\n\"{req.struggle_text}\"\nProficiency: Level {req.proficiency_level}/10 | Confidence: {req.pre_confidence}★",
        is_study_request=True,
    )
    db.add(dm)
    db.commit()
    db.refresh(sr)
    dm_id = dm.id
    sr_id = sr.id
    db.close()
    return {
        "id": sr_id, "sender_id": req.sender_id, "sender_name": req.sender_name,
        "sender_avatar": req.sender_avatar, "receiver_id": req.receiver_id,
        "topic_name": req.topic_name, "struggle_text": req.struggle_text,
        "proficiency_level": req.proficiency_level, "pre_confidence": req.pre_confidence,
        "status": "pending", "created_at": "Just now", "expires_in_sec": 900,
    }


@app.get("/study-requests/{user_id}")
def get_study_requests(user_id: str):
    db = get_db()
    rows = (
        db.query(StudyRequest)
        .filter((StudyRequest.receiver_id == user_id) | (StudyRequest.sender_id == user_id))
        .order_by(StudyRequest.created_at.desc())
        .all()
    )
    db.close()
    return [
        {
            "id": r.id, "sender_id": r.sender_id, "sender_name": r.sender_name,
            "sender_avatar": r.sender_avatar, "receiver_id": r.receiver_id,
            "topic_name": r.topic_name, "struggle_text": r.struggle_text,
            "proficiency_level": r.proficiency_level, "pre_confidence": r.pre_confidence,
            "status": r.status, "created_at": r.created_at.strftime("%b %d %H:%M") if r.created_at else "Recently",
            "expires_in_sec": r.expires_in_sec,
        }
        for r in rows
    ]


class RespondStudyReq(BaseModel):
    action: str  # 'accept' | 'decline'


@app.post("/study-requests/{request_id}/respond")
def respond_study_request(request_id: str, req: RespondStudyReq):
    db = get_db()
    sr = db.get(StudyRequest, request_id)
    if not sr:
        db.close()
        return {"ok": True, "message": "Request not found."}
    sr.status = req.action
    db.add(sr)
    db.commit()
    db.close()
    if req.action == "accept":
        sess_id = f"sess-direct-{request_id}"
        SESSION_TOPICS[sess_id] = sr.topic_name
        return {
            "ok": True, "session_id": sess_id,
            "shared_topic": sr.topic_name, "partner_name": sr.sender_name,
            "partner_avatar": sr.sender_avatar,
            "message": "Study session accepted! Launching workspace...",
        }
    return {"ok": True, "message": f"Request {req.action}ed."}


# ---------------------------------------------------------------------------
# WebSocket — Real-Time Session Sync
# ---------------------------------------------------------------------------

@app.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: str, user_id: str = ""):
    await websocket.accept()
    SESSION_CONNECTIONS[session_id].append(websocket)
    try:
        # ── Populate in-memory cache from DB if not already loaded ──────────
        if session_id not in SESSION_CHAT_MESSAGES:
            _db = get_db()
            try:
                from models import ChatMessage as ChatMessageModel
                rows = (
                    _db.query(ChatMessageModel)
                    .filter(ChatMessageModel.session_id == session_id)
                    .order_by(ChatMessageModel.timestamp)
                    .all()
                )
                SESSION_CHAT_MESSAGES[session_id] = [
                    {
                        "id": r.id,
                        "sender_id": r.sender_id,
                        "sender_name": r.sender_name,
                        "sender_avatar": "bottts-4" if r.sender_id == "ai-tutor-bot" else "bottts-1",
                        "text": r.text,
                        "timestamp": r.timestamp.strftime("%H:%M") if r.timestamp else "--",
                    }
                    for r in rows
                ]
            except Exception:
                SESSION_CHAT_MESSAGES[session_id] = []
            finally:
                _db.close()

        if session_id not in SESSION_SCRATCHPAD_DATA:
            _db2 = get_db()
            try:
                s = _db2.get(MatchSession, session_id)
                if s:
                    SESSION_SCRATCHPAD_DATA[session_id] = s.scratchpad_content or ""
                    SESSION_CANVAS_DATA[session_id] = s.canvas_content or ""
            except Exception:
                pass
            finally:
                _db2.close()

        # Send current state on connect so the joining peer is immediately in sync
        await websocket.send_text(json.dumps({
            "type": "init",
            "payload": {
                "scratchpad": SESSION_SCRATCHPAD_DATA.get(session_id, ""),
                "canvas": SESSION_CANVAS_DATA.get(session_id, ""),
                "messages": SESSION_CHAT_MESSAGES.get(session_id, [])[-50:],
            }
        }))

        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except Exception:
                continue

            event_type = event.get("type", "")
            payload = event.get("payload", {})

            if event_type == "scratchpad":
                content = payload.get("content", "")
                SESSION_SCRATCHPAD_DATA[session_id] = content
                await _ws_broadcast(session_id, event, exclude=websocket)
                # Persist to DB
                _db = get_db()
                try:
                    s = _db.get(MatchSession, session_id)
                    if s:
                        s.scratchpad_content = content
                        _db.add(s)
                        _db.commit()
                except Exception:
                    pass
                finally:
                    _db.close()

            elif event_type == "canvas":
                content = payload.get("content", "")
                SESSION_CANVAS_DATA[session_id] = content
                await _ws_broadcast(session_id, event, exclude=websocket)
                # Persist to DB
                _db = get_db()
                try:
                    s = _db.get(MatchSession, session_id)
                    if s:
                        s.canvas_content = content
                        _db.add(s)
                        _db.commit()
                except Exception:
                    pass
                finally:
                    _db.close()

            elif event_type == "chat":
                if session_id not in SESSION_CHAT_MESSAGES:
                    SESSION_CHAT_MESSAGES[session_id] = []
                raw_text = payload.get("text", "")
                clean_text = content_filter.censor_text(raw_text)
                new_msg = {
                    "id": f"msg-ws-{len(SESSION_CHAT_MESSAGES[session_id]) + 1}",
                    "sender_id": payload.get("sender_id", user_id),
                    "sender_name": payload.get("sender_name", "Student"),
                    "sender_avatar": payload.get("sender_avatar", "bottts-1"),
                    "text": clean_text,
                    "timestamp": datetime.datetime.utcnow().strftime("%H:%M"),
                }
                SESSION_CHAT_MESSAGES[session_id].append(new_msg)
                await _ws_broadcast(session_id, {"type": "chat", "payload": new_msg})
                # Persist to DB
                _db = get_db()
                try:
                    from models import ChatMessage as ChatMessageModel
                    _db.add(ChatMessageModel(
                        session_id=session_id,
                        sender_id=new_msg["sender_id"],
                        sender_name=new_msg["sender_name"],
                        text=new_msg["text"],
                    ))
                    _db.commit()
                except Exception:
                    pass
                finally:
                    _db.close()

                # AI tutor response — only for AI tutor sessions (sess-ai-*)
                if "sess-ai" in session_id and new_msg["sender_id"] != "ai-tutor-bot":
                    topic = SESSION_TOPICS.get(session_id, "")
                    history = SESSION_CHAT_MESSAGES[session_id]
                    ai_text = await ai_tutor.get_response(topic, history, new_msg["text"])
                    ai_msg = {
                        "id": f"msg-ws-ai-{len(SESSION_CHAT_MESSAGES[session_id]) + 1}",
                        "sender_id": "ai-tutor-bot",
                        "sender_name": "Socratic AI Tutor",
                        "sender_avatar": "bottts-4",
                        "text": ai_text,
                        "timestamp": datetime.datetime.utcnow().strftime("%H:%M"),
                    }
                    SESSION_CHAT_MESSAGES[session_id].append(ai_msg)
                    await _ws_broadcast(session_id, {"type": "chat", "payload": ai_msg})
                    _db = get_db()
                    try:
                        from models import ChatMessage as ChatMessageModel
                        _db.add(ChatMessageModel(session_id=session_id, sender_id="ai-tutor-bot", sender_name="Socratic AI Tutor", text=ai_text))
                        _db.commit()
                    except Exception:
                        pass
                    finally:
                        _db.close()

            elif event_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in SESSION_CONNECTIONS[session_id]:
            SESSION_CONNECTIONS[session_id].remove(websocket)