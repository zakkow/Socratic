"""
test_integration.py — End-to-end integration test for StudyMatch.

Validates the full loop:
  1. Create two users (Alice and Bob) in a test course
  2. Alice submits free-text struggle entries -> classified into topics
  3. Bob submits free-text struggle entries -> classified into topics
  4. Both users request a match -> matching_engine computes struggle vectors
  5. API returns match result with shared topic, explanation, and session_id
  6. Both users write to and read from the shared scratchpad
"""

import sys
import os

from fastapi.testclient import TestClient
from main import app
import uuid


def test_full_match_flow():
    client = TestClient(app)
    course_id = f"test_course_{uuid.uuid4().hex[:6]}"

    # 1. Create Alice
    r = client.post("/users", json={"name": "Alice", "course_id": course_id})
    assert r.status_code == 200, r.text
    alice = r.json()
    assert alice["name"] == "Alice"
    assert "id" in alice

    # 2. Create Bob
    r = client.post("/users", json={"name": "Bob", "course_id": course_id})
    assert r.status_code == 200, r.text
    bob = r.json()
    assert bob["name"] == "Bob"

    # 3. Pre-seed topics so classifier has canonical targets
    client.post("/topics", json={"course_id": course_id, "name": "recursion"})
    client.post("/topics", json={"course_id": course_id, "name": "loops"})

    # 4. Alice submits struggle entries about recursion
    for text, correct in [
        ("I don't understand how base cases work in recursion", False),
        ("why does the function call itself over and over", False),
    ]:
        r = client.post(
            "/quiz/attempt",
            json={"user_id": alice["id"], "free_text": text, "correct": correct, "proficiency_level": 5},
        )
        assert r.status_code == 200, r.text
        assert r.json()["classified_topic"] == "recursion"

    # 5. Bob submits struggle entries about recursion
    for text, correct in [
        ("recursive calls confuse me, when does it stop", False),
        ("I keep getting stack overflow on the recursive version", False),
    ]:
        r = client.post(
            "/quiz/attempt",
            json={"user_id": bob["id"], "free_text": text, "correct": correct, "proficiency_level": 5},
        )
        assert r.status_code == 200, r.text
        assert r.json()["classified_topic"] == "recursion"

    # Bob is strong on loops
    for text, correct in [("for loops make sense to me", True)]:
        client.post(
            "/quiz/attempt",
            json={"user_id": bob["id"], "free_text": text, "correct": correct, "proficiency_level": 8},
        )

    # Both opt in to matching
    r = client.post("/match/request", json={"user_id": bob["id"]})
    assert r.json() == {"matched": False, "message": "No active peer shares a compatible topic and proficiency level yet."}

    r = client.post("/match/request", json={"user_id": alice["id"]})
    result = r.json()
    print("Match result:", result)

    assert result["matched"] is True
    assert result["partner_name"] == "Bob"
    assert result["shared_topic"] == "recursion"
    assert "recursion" in result["explanation"].lower() or "Bob" in result["explanation"]

    # 6. Test shared scratchpad
    session_id = result["session_id"]

    # Alice writes to scratchpad
    r = client.put(
        f"/match/{session_id}/scratchpad",
        json={"content": "def factorial(n):\n    if n == 1: return 1\n    return n * factorial(n-1)"},
    )
    assert r.status_code == 200

    # Bob reads scratchpad -> sees Alice's code
    r = client.get(f"/match/{session_id}/scratchpad")
    assert r.status_code == 200
    assert "factorial" in r.json()["content"]

    print(
        "\n✅ Full integration test passed: Alice and Bob correctly matched on 'recursion' via free-text classification, with a working scratchpad."
    )


if __name__ == "__main__":
    test_full_match_flow()