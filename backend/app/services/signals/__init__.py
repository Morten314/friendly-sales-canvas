"""signals service — public API (Phase H Sequence E final form).

Service for researching and persisting Scout/Profiler market signals
(single-shot, batch, and Claude-backed variants) + signal Q&A endpoints.
Submodules:
  - orchestrator.py: search_signals (persona-shared core),
    run_signals_research, generate_signals_batch (+ _claude variant,
    + _generate_signals_batch_impl shared body), signal_ask
    (+ _claude variant)
  - persistence.py: fetch_signals, record_signal_action (public) + Mongo
    helpers — _get_latest_signal_for_user_agent, _get_existing_headlines,
    _get_user_icp_config, _save_signal_and_track_headline (consolidates 3
    copy-pasted save+track blocks), _get_signal_ask_customer_profile
  - prompts.py: _SCOUT_PROMPT_TEMPLATE, _PROFILER_PROMPT_TEMPLATE,
    _LEADS_SECTION_TEMPLATE (+ fallback), _EXISTING_HEADLINES_SECTION_TEMPLATE,
    _SIGNAL_ASK_PROMPT_TEMPLATE (+ Claude variant)
  - llm.py: _signals_agent_output (dispatches Groq agent chain or
    Claude messages API)
  - parsing.py: _parse_search_signals_response,
    _normalize_search_signals_result, _validate_url
"""

from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
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
