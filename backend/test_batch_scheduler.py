"""
Tests BatchScheduler in isolation using a stub run_batch_fn, so the
correctness of the windowing/batching logic can be verified without
torch or downloaded model weights.

Checks:
1. Concurrent requests within the same window get batched into ONE call.
2. No request is dropped or double-answered.
3. A request arriving after max_batch_size triggers an immediate flush
   instead of waiting out the full window.
4. Results are routed back to the correct caller (order isn't assumed).
"""

import asyncio
import time

from inference_engine import BatchScheduler


def stub_run_batch(texts: list[str]) -> list[str]:
    """Fake 'model': deterministic, traceable transform, plus a record of
    how many texts came in per call so we can assert batching happened."""
    stub_run_batch.calls.append(len(texts))
    return [f"echo:{t}" for t in texts]


stub_run_batch.calls = []


async def test_concurrent_requests_batch_together():
    stub_run_batch.calls.clear()
    scheduler = BatchScheduler(run_batch_fn=stub_run_batch, window_ms=100, max_batch_size=32)

    # Fire 10 requests "at once" (all within the same event loop tick window)
    tasks = [asyncio.create_task(scheduler.submit(f"req{i}")) for i in range(10)]
    results = await asyncio.gather(*tasks)

    assert len(results) == 10
    for i, r in enumerate(results):
        assert r == f"echo:req{i}", f"wrong result routed back: {r}"

    assert stub_run_batch.calls == [10], (
        f"expected exactly one batched call of size 10, got {stub_run_batch.calls}"
    )
    print("✅ test_concurrent_requests_batch_together passed "
          f"(1 model call served 10 requests, not 10 separate calls)")


async def test_max_batch_size_triggers_immediate_flush():
    stub_run_batch.calls.clear()
    scheduler = BatchScheduler(run_batch_fn=stub_run_batch, window_ms=5000, max_batch_size=4)
    # window is 5s (deliberately long) — if max_batch_size didn't force an
    # early flush, this test would need to wait 5s. It shouldn't.

    start = time.monotonic()
    tasks = [asyncio.create_task(scheduler.submit(f"req{i}")) for i in range(4)]
    results = await asyncio.wait_for(asyncio.gather(*tasks), timeout=1.0)
    elapsed = time.monotonic() - start

    assert len(results) == 4
    assert elapsed < 1.0, f"took {elapsed}s — max_batch_size flush didn't trigger early"
    print(f"✅ test_max_batch_size_triggers_immediate_flush passed (flushed in {elapsed:.3f}s, not 5s)")


async def test_two_separate_waves_are_two_batches():
    stub_run_batch.calls.clear()
    scheduler = BatchScheduler(run_batch_fn=stub_run_batch, window_ms=50, max_batch_size=32)

    wave1 = [asyncio.create_task(scheduler.submit(f"a{i}")) for i in range(3)]
    await asyncio.gather(*wave1)

    wave2 = [asyncio.create_task(scheduler.submit(f"b{i}")) for i in range(5)]
    await asyncio.gather(*wave2)

    assert stub_run_batch.calls == [3, 5], f"expected [3, 5], got {stub_run_batch.calls}"
    print("✅ test_two_separate_waves_are_two_batches passed "
          f"(batches: {stub_run_batch.calls})")


async def test_no_request_dropped_under_load():
    stub_run_batch.calls.clear()
    scheduler = BatchScheduler(run_batch_fn=stub_run_batch, window_ms=30, max_batch_size=8)

    n = 97  # deliberately not a clean multiple of max_batch_size
    tasks = [asyncio.create_task(scheduler.submit(f"r{i}")) for i in range(n)]
    results = await asyncio.gather(*tasks)

    assert len(results) == n
    assert len(set(results)) == n, "duplicate/misrouted results detected"
    assert sum(stub_run_batch.calls) == n
    print(f"✅ test_no_request_dropped_under_load passed "
          f"({n} requests, {len(stub_run_batch.calls)} batches, all accounted for)")


async def main():
    await test_concurrent_requests_batch_together()
    await test_max_batch_size_triggers_immediate_flush()
    await test_two_separate_waves_are_two_batches()
    await test_no_request_dropped_under_load()
    print("\n✅ All batch scheduler tests passed.")


if __name__ == "__main__":
    asyncio.run(main())