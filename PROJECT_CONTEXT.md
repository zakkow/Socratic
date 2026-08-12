# StudyMatch — Project Context

## What this is
A peer study-matching web app for a hackathon (ML Empowerment Build Challenge 2.0). Students describe what they're stuck on in free text; a self-hosted model classifies the topic; students who are stuck on the *same* topic right now get matched together with a shared scratchpad.

## What already exists (do not rebuild — read and integrate with it)
The backend is complete, tested, and working. It lives in `backend/`:
- `main.py` — FastAPI app, all routes
- `matching_engine.py` — struggle-vector matching logic (tested, self-contained)
- `inference_engine.py` — self-hosted batched inference layer (real transformers code)
- `models.py` — SQLAlchemy models
- `test_batch_scheduler.py`, `test_integration.py` — passing tests
- `benchmark.py` — batching speedup benchmark

Run `python3 backend/test_integration.py` first to confirm the backend works in your environment before building against it.

## Your job
Build the React frontend only. Do not modify backend files unless you find and fix an actual bug (if you do, explain the bug clearly before changing anything).

## Product flow — free-roam, not forced screens
No wizard sequence. Students can search/browse topics, submit a struggle, and request a match in any order — see UI_UX_SPEC.md for the layout. The underlying actions are the same three operations (classify a struggle, request a match, use the scratchpad), just not gated behind a linear flow.

## Exact API contract — do not deviate from these shapes

Base URL: `http://localhost:8000`

**POST /users**
Request: `{ "name": string, "course_id": string }` — hardcode `course_id` to `"cs101"`, there's no course picker in this version.
Response: `{ "id": string, "name": string, "course_id": string }`

**POST /quiz/attempt**
Request: `{ "user_id": string, "free_text": string, "correct": boolean }`
Success: `{ "classified_topic": string, "topic_id": string }`
Failure (422): `{ "detail": string }` — show as "couldn't figure out the topic, try rephrasing," not a raw error dump.
Note: topics are created automatically the first time the classifier identifies them for a course — there's no separate "seed the topics first" step anymore.

**POST /match/request**
Request: `{ "user_id": string }`
Matched: `{ "matched": true, "session_id": string, "partner_name": string, "shared_topic": string, "match_score": number, "explanation": string }`
Not matched: `{ "matched": false, "message": string }`

**GET /match/{session_id}/scratchpad** → `{ "content": string }`
**PUT /match/{session_id}/scratchpad** — body `{ "content": string }` → `{ "ok": true }`

**POST /match/{session_id}/unmatch** — body `{ "user_id": string }` → `{ "ok": true }`. Ends the session. Rejects (403) if the user isn't a participant.

**POST /users/block** — body `{ "blocker_id": string, "blocked_id": string }` → `{ "ok": true, "already_blocked": boolean, "ended_sessions": number }`. Blocking is bidirectional in effect (neither side is ever matched to the other again) and immediately ends any live session between them.

**POST /users/report** — body `{ "reporter_id": string, "reported_id": string, "session_id": string | null, "reason": string, "details": string | null }` → `{ "ok": true }`. Does NOT auto-block — surface a separate "also block this person?" confirmation in the UI after a report is submitted, don't assume it.

## Tech constraints
- Plain React (Vite), fetch or axios. No Next.js — single-session demo app, not a production deployment.
- No localStorage/sessionStorage — React state only for this version.
- No auth — there isn't any in this version.

## Why the backend is self-hosted (context, not something to change)
Load is bursty — a whole class submits struggle-descriptions in the ~10 minutes before a study session, so per-request API costs and latency don't work. The backend batches concurrent requests and reuses a shared prefix KV-cache instead of recomputing it per request. This matters for the demo narrative but doesn't change anything about what you're building on the frontend.