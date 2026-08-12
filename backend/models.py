"""SQLAlchemy models. SQLite for the hackathon; swap the URL for Postgres later."""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime
import uuid

Base = declarative_base()


def gen_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    school_name = Column(String, nullable=True, default="University")
    avatar_seed = Column(String, default="bottts-1")
    course_id = Column(String, nullable=False, default="cs101")
    active = Column(Boolean, default=False)
    verification_pin = Column(String, nullable=True)
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Topic(Base):
    __tablename__ = "topics"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    canonical_name = Column(String, nullable=True)
    category = Column(String, nullable=False, default="cs")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    raw_text = Column(String, nullable=False)
    correct = Column(Boolean, nullable=False)
    proficiency_level = Column(Integer, default=5)  # 1-10 numerical scale
    pre_confidence = Column(Integer, default=3)  # 1-5 pre-session confidence score
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class MatchSession(Base):
    __tablename__ = "match_sessions"
    id = Column(String, primary_key=True, default=gen_id)
    user_a_id = Column(String, ForeignKey("users.id"), nullable=False)
    user_b_id = Column(String, ForeignKey("users.id"), nullable=False)
    shared_topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    explanation = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    scratchpad_content = Column(String, default="")
    canvas_content = Column(String, default="")
    ai_summary_log = Column(String, nullable=True)
    pre_confidence = Column(Integer, default=3)  # 1-5 scale before session
    post_confidence = Column(Integer, nullable=True)  # 1-5 scale after session
    ended_at = Column(DateTime, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=gen_id)
    # No FK constraint: session_id may be an in-memory AI session (sess-ai-*)
    # and sender_id may be 'ai-tutor-bot' (not a real User row)
    session_id = Column(String, nullable=False, index=True)
    sender_id = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    text = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class Friendship(Base):
    __tablename__ = "friendships"
    id = Column(String, primary_key=True, default=gen_id)
    user_id_a = Column(String, ForeignKey("users.id"), nullable=False)
    user_id_b = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="accepted")  # 'pending' | 'accepted'
    sender_id = Column(String, nullable=True)  # who sent the request
    sender_name = Column(String, nullable=True)
    sender_avatar = Column(String, nullable=True)
    receiver_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(String, primary_key=True, default=gen_id)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_name = Column(String, nullable=False)
    sender_avatar = Column(String, nullable=True, default="bottts-1")
    text = Column(String, nullable=False)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_study_request = Column(Boolean, default=False)
    study_request_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class UserStatus(Base):
    __tablename__ = "user_statuses"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    status = Column(String, default="online")  # 'online'|'dnd'|'away'|'invisible'
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class StudyRequest(Base):
    __tablename__ = "study_requests"
    id = Column(String, primary_key=True, default=gen_id)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_name = Column(String, nullable=False)
    sender_avatar = Column(String, nullable=True, default="bottts-1")
    receiver_id = Column(String, ForeignKey("users.id"), nullable=False)
    topic_name = Column(String, nullable=False)
    struggle_text = Column(String, nullable=True)
    proficiency_level = Column(Integer, default=5)
    pre_confidence = Column(Integer, default=3)
    status = Column(String, default="pending")  # 'pending'|'accept'|'decline'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_in_sec = Column(Integer, default=900)


class RecentPartner(Base):
    __tablename__ = "recent_partners"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    partner_id = Column(String, nullable=False)
    partner_name = Column(String, nullable=False)
    partner_avatar = Column(String, nullable=True)
    school = Column(String, nullable=True)
    matched_at = Column(DateTime, default=datetime.datetime.utcnow)


class Block(Base):
    __tablename__ = "blocks"
    id = Column(String, primary_key=True, default=gen_id)
    blocker_id = Column(String, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(String, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True, default=gen_id)
    reporter_id = Column(String, ForeignKey("users.id"), nullable=False)
    reported_id = Column(String, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, nullable=True)
    reason = Column(String, nullable=False)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class PublicSolution(Base):
    __tablename__ = "public_solutions"
    id = Column(String, primary_key=True, default=gen_id)
    topic_name = Column(String, nullable=False, index=True)
    author_a_name = Column(String, nullable=False)
    author_b_name = Column(String, nullable=True, default="Socratic AI Tutor")
    scratchpad_content = Column(String, default="")
    canvas_content = Column(String, default="")
    ai_tags = Column(String, default="")  # comma-separated AI tags
    votes_count = Column(Integer, default=2)
    is_vetted = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def make_session_factory(db_url: str = "sqlite:///./studymatch.db"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)

    # Dynamic auto-migration for existing SQLite database files
    try:
        with engine.connect() as conn:
            cursor = conn.connection.cursor()

            # Users table
            cursor.execute("PRAGMA table_info(users);")
            user_cols = {col[1] for col in cursor.fetchall()}
            if "email" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR;")
            if "password_hash" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR;")
            if "school_name" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN school_name VARCHAR DEFAULT 'University';")
            if "avatar_seed" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN avatar_seed VARCHAR DEFAULT 'bottts-1';")
            if "verification_pin" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN verification_pin VARCHAR;")
            if "is_verified" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 1;")
            if "created_at" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN created_at DATETIME;")

            # Topics table
            cursor.execute("PRAGMA table_info(topics);")
            topic_cols = {col[1] for col in cursor.fetchall()}
            if "canonical_name" not in topic_cols:
                cursor.execute("ALTER TABLE topics ADD COLUMN canonical_name VARCHAR;")
            if "category" not in topic_cols:
                cursor.execute("ALTER TABLE topics ADD COLUMN category VARCHAR DEFAULT 'cs';")

            # Quiz attempts table
            cursor.execute("PRAGMA table_info(quiz_attempts);")
            quiz_cols = {col[1] for col in cursor.fetchall()}
            if "proficiency_level" not in quiz_cols:
                cursor.execute("ALTER TABLE quiz_attempts ADD COLUMN proficiency_level INTEGER DEFAULT 5;")
            if "pre_confidence" not in quiz_cols:
                cursor.execute("ALTER TABLE quiz_attempts ADD COLUMN pre_confidence INTEGER DEFAULT 3;")

            # Match sessions table
            cursor.execute("PRAGMA table_info(match_sessions);")
            session_cols = {col[1] for col in cursor.fetchall()}
            if "ended_at" not in session_cols:
                cursor.execute("ALTER TABLE match_sessions ADD COLUMN ended_at DATETIME;")
            if "canvas_content" not in session_cols:
                cursor.execute("ALTER TABLE match_sessions ADD COLUMN canvas_content VARCHAR DEFAULT '';")
            if "ai_summary_log" not in session_cols:
                cursor.execute("ALTER TABLE match_sessions ADD COLUMN ai_summary_log VARCHAR;")
            if "pre_confidence" not in session_cols:
                cursor.execute("ALTER TABLE match_sessions ADD COLUMN pre_confidence INTEGER DEFAULT 3;")
            if "post_confidence" not in session_cols:
                cursor.execute("ALTER TABLE match_sessions ADD COLUMN post_confidence INTEGER;")

            # Friendships table — add new columns if missing
            cursor.execute("PRAGMA table_info(friendships);")
            friend_cols = {col[1] for col in cursor.fetchall()}
            if "sender_id" not in friend_cols:
                cursor.execute("ALTER TABLE friendships ADD COLUMN sender_id VARCHAR;")
            if "sender_name" not in friend_cols:
                cursor.execute("ALTER TABLE friendships ADD COLUMN sender_name VARCHAR;")
            if "sender_avatar" not in friend_cols:
                cursor.execute("ALTER TABLE friendships ADD COLUMN sender_avatar VARCHAR;")
            if "receiver_id" not in friend_cols:
                cursor.execute("ALTER TABLE friendships ADD COLUMN receiver_id VARCHAR;")

            # Auto-close stale sessions older than 24 hours
            cursor.execute("UPDATE match_sessions SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL AND timestamp < datetime('now', '-24 hours');")
            conn.connection.commit()
    except Exception:
        pass

    return sessionmaker(bind=engine)