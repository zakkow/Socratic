"""
inference_engine.py

Self-hosted, batched inference layer for StudyMatch's two LLM-backed jobs:
  1. classify_struggle(text) -> (topic_id, confidence)
  2. generate_match_explanation(name_a, name_b, topic) -> short string

Why this exists instead of "just call an API":
  Load is bursty by nature (a whole class submits struggle descriptions
  in the ~10 minutes before a study session). A free student tool can't
  eat per-request API costs at burst rate, and per-request latency stacks
  up badly if requests are handled one at a time. So: batch concurrent
  requests into one forward pass, and reuse the KV cache for the shared
  system-prompt prefix across every request instead of recomputing it.

Requires: torch, transformers (not installed in this sandbox — install
locally with `pip install torch transformers accelerate`).
Model: any small causal LM works. Defaults assume something like
Llama-3.2-1B-Instruct or Phi-3-mini, quantized if you're CPU-bound.

Scope, stated honestly: this batches within a short time window and
reuses ONE shared prefix cache. It does not implement continuous
batching, multi-GPU serving, or speculative decoding — those are listed
as roadmap items, not claimed as built.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Callable, Optional

# ---------------------------------------------------------------------------
# Model backend — real transformers code. Isolated behind a thin interface
# (ModelBackend) so the scheduler below can be tested without a GPU or
# network access to download weights.
# ---------------------------------------------------------------------------


class ModelBackend:
    """Wraps a HF causal LM + tokenizer and exposes the two primitives
    the scheduler needs: computing a reusable prefix cache, and running
    a batched generation step that starts from that cache."""

    def __init__(self, model_name: str, system_prompt: str, device: str = "cpu"):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(model_name).to(device)
        self.model.eval()

        self.system_prompt = system_prompt
        self._prefix_cache = None  # populated by build_prefix_cache()
        self._prefix_len = 0

    def build_prefix_cache(self) -> None:
        """Run the shared system prompt through the model ONCE and stash
        the resulting KV cache. Every batched request reuses this instead
        of recomputing attention over the system prompt from scratch."""
        torch = self.torch
        inputs = self.tokenizer(self.system_prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model(**inputs, use_cache=True)
        self._prefix_cache = out.past_key_values
        self._prefix_len = inputs["input_ids"].shape[1]

    def _expand_cache_for_batch(self, batch_size: int):
        """The cached KV tensors were computed for batch=1. Expand them
        along the batch dimension so a batch of N different suffixes can
        all attend back to the same shared prefix."""
        torch = self.torch
        expanded = []
        for layer_kv in self._prefix_cache:
            k, v = layer_kv
            k = k.expand(batch_size, -1, -1, -1).contiguous()
            v = v.expand(batch_size, -1, -1, -1).contiguous()
            expanded.append((k, v))
        return tuple(expanded)

    def generate_batch(self, suffixes: list[str], max_new_tokens: int = 24) -> list[str]:
        """Runs one batched forward/generate pass for N different suffixes,
        all continuing from the same cached prefix. Returns N decoded
        strings (just the newly generated portion, not the prompt)."""
        torch = self.torch
        if self._prefix_cache is None:
            self.build_prefix_cache()

        batch_size = len(suffixes)
        enc = self.tokenizer(
            suffixes, return_tensors="pt", padding=True, add_special_tokens=False
        ).to(self.device)

        past = self._expand_cache_for_batch(batch_size)

        with torch.no_grad():
            gen = self.model.generate(
                input_ids=enc["input_ids"],
                attention_mask=enc["attention_mask"],
                past_key_values=past,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                pad_token_id=self.tokenizer.pad_token_id,
            )

        # gen includes the suffix tokens; slice off everything up to and
        # including the suffix to get just the new generation.
        results = []
        for i in range(batch_size):
            new_tokens = gen[i][enc["input_ids"].shape[1]:]
            results.append(self.tokenizer.decode(new_tokens, skip_special_tokens=True))
        return results


# ---------------------------------------------------------------------------
# Batch scheduler — pure asyncio logic, no torch dependency. This is the
# part that actually needs to be correct (no dropped requests, no race
# conditions, respects the batching window), so it's built to be testable
# in isolation with a stub backend.
# ---------------------------------------------------------------------------


@dataclass
class _PendingRequest:
    text: str
    future: asyncio.Future


class BatchScheduler:
    """
    Collects incoming requests into windows of `window_ms` milliseconds
    (or until `max_batch_size` is reached, whichever comes first), then
    runs them through `run_batch_fn` as a single batch.

    `run_batch_fn` is injected so this class can be unit-tested with a
    cheap stub instead of a real model.
    """

    def __init__(
        self,
        run_batch_fn: Callable[[list[str]], list[str]],
        window_ms: int = 200,
        max_batch_size: int = 32,
    ):
        self.run_batch_fn = run_batch_fn
        self.window_s = window_ms / 1000.0
        self.max_batch_size = max_batch_size
        self._queue: list[_PendingRequest] = []
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None
        self.batches_run = 0
        self.requests_served = 0

    async def submit(self, text: str) -> str:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future = loop.create_future()
        req = _PendingRequest(text=text, future=fut)

        async with self._lock:
            self._queue.append(req)
            should_flush_now = len(self._queue) >= self.max_batch_size
            if self._flush_task is None and not should_flush_now:
                self._flush_task = asyncio.create_task(self._flush_after_delay())

        if should_flush_now:
            await self._flush()

        return await fut

    async def _flush_after_delay(self) -> None:
        await asyncio.sleep(self.window_s)
        await self._flush()

    async def _flush(self) -> None:
        async with self._lock:
            if not self._queue:
                self._flush_task = None
                return
            batch = self._queue
            self._queue = []
            # Only cancel the pending delayed-flush task if we're NOT
            # currently running inside it (an immediate flush triggered
            # by max_batch_size can race with the scheduled delayed
            # flush). Cancelling the task we're currently executing
            # inside would deliver CancelledError to ourselves at the
            # next await point below and silently drop this batch.
            current = asyncio.current_task()
            if self._flush_task is not None and self._flush_task is not current:
                if not self._flush_task.done():
                    self._flush_task.cancel()
            self._flush_task = None

        texts = [r.text for r in batch]
        # Run the (potentially blocking, CPU/GPU-bound) batch call off the
        # event loop so it doesn't block other coroutines from being
        # scheduled while the model runs.
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, self.run_batch_fn, texts)

        self.batches_run += 1
        self.requests_served += len(batch)

        for req, result in zip(batch, results):
            if not req.future.done():
                req.future.set_result(result)


# ---------------------------------------------------------------------------
# Public engine — ties model backend + scheduler together into the two
# product-facing calls.
# ---------------------------------------------------------------------------

STRUGGLE_CLASSIFIER_PROMPT = (
    "You are a topic classifier for a computer science tutoring app. "
    "Given a student's description of what they're stuck on, respond with "
    "ONLY the single topic name from this list: loops, recursion, arrays, bigO. "
    "Student: "
)

MATCH_EXPLANATION_PROMPT = (
    "You are writing a one-sentence, encouraging explanation for why two "
    "students were matched to study together. Be specific and warm, under "
    "20 words. "
)


class InferenceEngine:
    def __init__(self, model_name: str, device: str = "cpu"):
        self.classifier_backend = ModelBackend(
            model_name, STRUGGLE_CLASSIFIER_PROMPT, device
        )
        self.explainer_backend = ModelBackend(
            model_name, MATCH_EXPLANATION_PROMPT, device
        )
        self.classifier_backend.build_prefix_cache()
        self.explainer_backend.build_prefix_cache()

        self.classifier_scheduler = BatchScheduler(
            run_batch_fn=lambda texts: self.classifier_backend.generate_batch(
                texts, max_new_tokens=6
            )
        )
        self.explainer_scheduler = BatchScheduler(
            run_batch_fn=lambda texts: self.explainer_backend.generate_batch(
                texts, max_new_tokens=24
            )
        )

    async def classify_struggle(self, free_text: str) -> str:
        raw = await self.classifier_scheduler.submit(free_text)
        return raw.strip().split()[0].lower() if raw.strip() else "unknown"

    async def generate_match_explanation(self, name_a: str, name_b: str, topic: str) -> str:
        prompt = f"{name_a} and {name_b} both got stuck on {topic}."
        raw = await self.explainer_scheduler.submit(prompt)
        return raw.strip()