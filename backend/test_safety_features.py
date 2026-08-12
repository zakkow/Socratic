"""
Tests block/report/unmatch against the real API — same pattern as
test_integration.py. Confirms:
  1. A blocked user is never matched again, in either direction.
  2. Blocking mid-session immediately ends that session.
  3. Unmatch ends a session without requiring a block.
  4. Reporting doesn't silently auto-block.
"""

import os
import itertools

os.environ.setdefault("STUDYMATCH_USE_REAL_MODEL", "0")

if os.path.exists("./studymatch_safety_test.db"):
    os.remove("./studymatch_safety_test.db")

import models
from fastapi.testclient import TestClient
import main as main_module

main_module.SessionLocal = models.make_session_factory("sqlite:///./studymatch_safety_test.db")
client = TestClient(main_module.app)

_course_counter = itertools.count()


def fresh_course() -> str:
    return f"test-course-{next(_course_counter)}"


def setup_two_matched_users(course: str):
    for name in ["recursion", "loops"]:
        client.post("/topics", json={"course_id": course, "name": name})

    alice = client.post("/users", json={"name": "Alice", "course_id": course}).json()
    bob = client.post("/users", json={"name": "Bob", "course_id": course}).json()

    for uid in (alice["id"], bob["id"]):
        client.post(
            "/quiz/attempt",
            json={"user_id": uid, "free_text": "recursion base case confuses me", "correct": False},
        )

    client.post("/match/request", json={"user_id": bob["id"]})
    r = client.post("/match/request", json={"user_id": alice["id"]})
    result = r.json()
    assert result["matched"] is True, result
    return alice, bob, result["session_id"]


def test_block_prevents_future_matching():
    course = fresh_course()
    alice, bob, _ = setup_two_matched_users(course)

    client.post("/users/block", json={"blocker_id": alice["id"], "blocked_id": bob["id"]})

    client.post(
        "/quiz/attempt",
        json={"user_id": alice["id"], "free_text": "loops are confusing", "correct": False},
    )
    client.post(
        "/quiz/attempt",
        json={"user_id": bob["id"], "free_text": "loops are confusing", "correct": False},
    )

    client.post("/match/request", json={"user_id": bob["id"]})
    r = client.post("/match/request", json={"user_id": alice["id"]})
    result = r.json()

    assert result["matched"] is False, f"blocked user was matched anyway: {result}"
    print("✅ test_block_prevents_future_matching passed")


def test_block_is_bidirectional():
    course = fresh_course()
    alice, bob, _ = setup_two_matched_users(course)
    client.post("/users/block", json={"blocker_id": alice["id"], "blocked_id": bob["id"]})

    client.post(
        "/quiz/attempt",
        json={"user_id": alice["id"], "free_text": "loops are confusing", "correct": False},
    )
    client.post(
        "/quiz/attempt",
        json={"user_id": bob["id"], "free_text": "loops are confusing", "correct": False},
    )

    client.post("/match/request", json={"user_id": alice["id"]})
    r = client.post("/match/request", json={"user_id": bob["id"]})
    result = r.json()

    assert result["matched"] is False, f"block wasn't bidirectional: {result}"
    print("✅ test_block_is_bidirectional passed")


def test_blocking_ends_active_session():
    course = fresh_course()
    alice, bob, session_id = setup_two_matched_users(course)

    r = client.get(f"/match/{session_id}/scratchpad")
    assert r.status_code == 200

    block_result = client.post(
        "/users/block", json={"blocker_id": bob["id"], "blocked_id": alice["id"]}
    ).json()
    assert block_result["ended_sessions"] == 1, block_result

    print("✅ test_blocking_ends_active_session passed "
          f"(block response confirms {block_result['ended_sessions']} session(s) ended)")


def test_unmatch_without_block():
    course = fresh_course()
    alice, bob, session_id = setup_two_matched_users(course)

    r = client.post(f"/match/{session_id}/unmatch", json={"user_id": alice["id"]})
    assert r.json() == {"ok": True}

    carol = client.post("/users", json={"name": "Carol", "course_id": course}).json()
    r = client.post(f"/match/{session_id}/unmatch", json={"user_id": carol["id"]})
    assert r.status_code == 403

    print("✅ test_unmatch_without_block passed (ended session, rejected non-participant)")


def test_report_does_not_auto_block():
    course = fresh_course()
    alice, bob, session_id = setup_two_matched_users(course)

    r = client.post(
        "/users/report",
        json={
            "reporter_id": alice["id"],
            "reported_id": bob["id"],
            "session_id": session_id,
            "reason": "inappropriate_messages",
        },
    )
    assert r.json() == {"ok": True}

    client.post(
        "/quiz/attempt",
        json={"user_id": alice["id"], "free_text": "loops are confusing", "correct": False},
    )
    client.post(
        "/quiz/attempt",
        json={"user_id": bob["id"], "free_text": "loops are confusing", "correct": False},
    )
    client.post("/match/request", json={"user_id": bob["id"]})
    r = client.post("/match/request", json={"user_id": alice["id"]})
    assert r.json()["matched"] is True, (
        "report should not silently block — the UI should ask explicitly"
    )
    print("✅ test_report_does_not_auto_block passed")


def test_blocked_user_cannot_send_friend_request():
    course = fresh_course()
    alice, bob, _ = setup_two_matched_users(course)
    client.post("/users/block", json={"blocker_id": alice["id"], "blocked_id": bob["id"]})

    res = client.post("/friends/request", json={"user_id": bob["id"], "friend_email_or_name": alice["id"]})
    assert res.status_code == 403, f"blocked user was able to send friend request: {res.text}"
    print("✅ test_blocked_user_cannot_send_friend_request passed")


if __name__ == "__main__":
    test_block_prevents_future_matching()
    test_block_is_bidirectional()
    test_blocking_ends_active_session()
    test_unmatch_without_block()
    test_report_does_not_auto_block()
    test_blocked_user_cannot_send_friend_request()
    print("\n✅ All safety-feature tests passed.")
