"""
benchmark.py

Proves the batching claim with a real number, using the SAME BatchScheduler
class that ships in inference_engine.py — not a separate toy.

Uses a stub model function with an artificial fixed per-call latency (to
simulate a forward pass) so this runs anywhere, no GPU needed. Swap
`SIMULATED_MODEL_LATENCY_S` logic for a real ModelBackend.generate_batch
call once you have the actual model downloaded — the scheduler code
under test doesn't change either way, which is the point: this benchmark
is measuring the scheduler's real behavior, not a mocked-up number.

Run: python3 benchmark.py
"""

import asyncio
import time

from inference_engine import BatchScheduler

# Simulates a forward pass: fixed cost per call regardless of batch size
# (roughly true for small batches on a GPU — the dominant cost is the
# forward pass itself, not the per-item work). This is the property that
# makes batching a win: N calls of latency L each vs 1 call of latency L
# serving N items.
SIMULATED_MODEL_LATENCY_S = 0.15


def simulated_model_call(texts: list[str]) -> list[str]:
    time.sleep(SIMULATED_MODEL_LATENCY_S)
    return [f"result:{t}" for t in texts]


async def naive_baseline(n_requests: int) -> float:
    """One request at a time, no batching — the naive approach."""
    start = time.monotonic()
    for i in range(n_requests):
        await asyncio.get_event_loop().run_in_executor(
            None, simulated_model_call, [f"req{i}"]
        )
    return time.monotonic() - start


async def batched(n_requests: int) -> float:
    """All requests fired concurrently through the real BatchScheduler."""
    scheduler = BatchScheduler(
        run_batch_fn=simulated_model_call, window_ms=50, max_batch_size=32
    )
    start = time.monotonic()
    tasks = [asyncio.create_task(scheduler.submit(f"req{i}")) for i in range(n_requests)]
    await asyncio.gather(*tasks)
    elapsed = time.monotonic() - start
    print(f"  (ran as {scheduler.batches_run} batch(es) for {n_requests} requests)")
    return elapsed


async def main():
    n = 20
    print(f"Simulating a burst of {n} concurrent struggle-classification requests")
    print(f"(simulated forward-pass latency: {SIMULATED_MODEL_LATENCY_S}s per call)\n")

    naive_time = await naive_baseline(n)
    print(f"Naive (one at a time):  {naive_time:.2f}s total")

    batched_time = await batched(n)
    print(f"Batched (this project): {batched_time:.2f}s total")

    speedup = naive_time / batched_time
    print(f"\n>>> {speedup:.1f}x faster under burst load <<<")
    print("\nNote: replace `simulated_model_call` with a real ModelBackend call")
    print("and re-run once you have model weights loaded, to get the real-world")
    print("number for the Devpost writeup. The scheduler code being measured")
    print("here is identical to what ships in inference_engine.py.")


if __name__ == "__main__":
    asyncio.run(main())