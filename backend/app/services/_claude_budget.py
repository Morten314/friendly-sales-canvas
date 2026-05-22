"""Claude signal-budget windowing (shared across all _claude route variants).

Module-level globals are stateful — they track real wall-clock usage
across requests. Internal to the services layer.
"""
import math
import os
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.config import (
    claude_signal_window_seconds,
    claude_signal_token_limit_5m,
    claude_signal_max_output_tokens,
)
from app.core.exceptions import BudgetExhaustedError

CLAUDE_SIGNAL_WINDOW_SECONDS = claude_signal_window_seconds
CLAUDE_SIGNAL_TOKEN_LIMIT_5M = claude_signal_token_limit_5m
CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS = claude_signal_max_output_tokens
CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""

_claude_signal_usage_window = deque()
_claude_signal_usage_lock = threading.Lock()
_claude_signal_total_runs = 0


def _estimate_token_count(text: str) -> int:
    """Conservative local token estimate when provider usage metadata is unavailable."""
    if not text:
        return 0
    return max(1, int(math.ceil(len(text) / 4)))


def _prune_claude_signal_window(now_ts: float) -> None:
    while _claude_signal_usage_window and (now_ts - _claude_signal_usage_window[0]["timestamp"]) > CLAUDE_SIGNAL_WINDOW_SECONDS:
        _claude_signal_usage_window.popleft()


def _reserve_claude_signal_budget(input_tokens_estimate: int, max_output_tokens: int) -> Dict[str, Any]:
    global _claude_signal_total_runs

    now_ts = datetime.now(timezone.utc).timestamp()
    reserved_tokens = max(0, input_tokens_estimate) + max(0, max_output_tokens)
    run_id = str(uuid.uuid4())

    with _claude_signal_usage_lock:
        _prune_claude_signal_window(now_ts)
        current_tokens_5m = sum(int(x.get("tokens", 0)) for x in _claude_signal_usage_window)
        if current_tokens_5m + reserved_tokens > CLAUDE_SIGNAL_TOKEN_LIMIT_5M:
            raise BudgetExhaustedError(
                {
                    "error": "Token budget exceeded for signal_ask_claude",
                    "token_limit_5m": CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
                    "current_tokens_5m": current_tokens_5m,
                    "requested_tokens": reserved_tokens
                }
            )

        _claude_signal_usage_window.append(
            {
                "run_id": run_id,
                "timestamp": now_ts,
                "tokens": reserved_tokens
            }
        )
        _claude_signal_total_runs += 1
        reserved_tokens_5m = current_tokens_5m + reserved_tokens
        run_count_5m = len(_claude_signal_usage_window)
        run_count_total = _claude_signal_total_runs

    return {
        "run_id": run_id,
        "reserved_tokens": reserved_tokens,
        "window_tokens_5m": reserved_tokens_5m,
        "run_count_5m": run_count_5m,
        "run_count_total": run_count_total
    }


def _finalize_claude_signal_budget(run_id: str, actual_total_tokens: int) -> Dict[str, int]:
    now_ts = datetime.now(timezone.utc).timestamp()
    with _claude_signal_usage_lock:
        _prune_claude_signal_window(now_ts)
        for item in _claude_signal_usage_window:
            if item.get("run_id") == run_id:
                item["tokens"] = max(0, int(actual_total_tokens))
                break

        window_tokens_5m = sum(int(x.get("tokens", 0)) for x in _claude_signal_usage_window)
        run_count_5m = len(_claude_signal_usage_window)
        run_count_total = _claude_signal_total_runs

    return {
        "window_tokens_5m": window_tokens_5m,
        "run_count_5m": run_count_5m,
        "run_count_total": run_count_total
    }
