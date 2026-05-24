"""signals service — package skeleton (Phase H commit 16/20).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.

Hardest service of Phase H — done last with the pattern validated.
"""

from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
    record_signal_action,
    fetch_signals,
)

__all__ = [
    "search_signals",
    "run_signals_research",
    "generate_signals_batch",
    "generate_signals_batch_claude",
    "signal_ask",
    "signal_ask_claude",
    "record_signal_action",
    "fetch_signals",
]
