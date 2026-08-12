# StudyMatch backend

## Quick start (no model download needed — uses DevKeywordClassifier)
```
pip install -r requirements.txt
python3 test_batch_scheduler.py   # scheduler concurrency correctness
python3 test_integration.py       # full end-to-end flow
python3 benchmark.py              # batching speedup number
uvicorn main:app --reload         # run the API
```

## Switching to the real self-hosted model
```
export STUDYMATCH_USE_REAL_MODEL=1
export STUDYMATCH_MODEL=meta-llama/Llama-3.2-1B-Instruct  # or any small causal LM
uvicorn main:app --reload
```
Requires torch + transformers + a downloaded model (needs GPU or patience on CPU).

## What's real vs. what's a dev fallback
- `matching_engine.py` — fully real, tested, no fallback.
- `inference_engine.py` — real transformers-based batching + prefix-cache-reuse code. Untested against real weights in this environment (no model download here) — test locally once you have `torch`/`transformers` installed.
- `test_batch_scheduler.py` — tests the scheduler's concurrency logic in isolation with a stub, so it doesn't need model weights. This is what caught the self-cancellation bug.
- `main.py` — real FastAPI app. Uses `DevKeywordClassifier` by default so the full stack is testable without a GPU; flip `STUDYMATCH_USE_REAL_MODEL=1` for the real thing.
- `benchmark.py` — uses the real `BatchScheduler` class with a simulated model latency, so the speedup number reflects real scheduler behavior, not a fabricated claim. Re-run with real weights for the number to cite in your Devpost writeup.