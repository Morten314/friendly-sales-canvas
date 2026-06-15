"""signals service — public API.

Service for researching and persisting Scout/Profiler market signals
(single-shot, batch, and Claude-backed variants) + signal Q&A endpoints.

Submodules:
  - search.py: search_signals (persona-shared core), run_signals_research
  - batch.py: generate_signals_batch (+ _claude variant,
    + _generate_signals_batch_impl shared body)
  - ask.py: signal_ask (+ _claude variant)
  - persistence.py: fetch_signals, record_signal_action (public) + Mongo
    helpers — _get_latest_signal_for_user_agent, _get_existing_headlines,
    _get_user_icp_config, _save_signal_and_track_headline,
    _get_signal_ask_customer_profile
  - llm.py: _signals_agent_output (thin adapter over
    _llm_helpers._research_agent_output)

  Prompts moved to backend/prompts/signals/*.md.j2 in plan-13 Task 9 —
  rendered via app.core.prompts.render(name, **inputs).
  - parsing.py: _parse_search_signals_response, _normalize_search_signals_result,
    _validate_url

There is no orchestrator submodule — no multi-step cross-submodule composition
exists that needs an orchestrator tier. Each public function lives in its
defining submodule. Same structure as data_sources/.
"""

from app.services.signals.search import (
    search_signals,
    run_signals_research,
)
from app.services.signals.batch import (
    generate_signals_batch,
    generate_signals_batch_claude,
)
from app.services.signals.ask import (
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
    record_signal_action,
    fetch_signals,
)
from app.services.signals.lead_map import build_signal_lead_map_claude

__all__ = [
    "search_signals",
    "run_signals_research",
    "generate_signals_batch",
    "generate_signals_batch_claude",
    "signal_ask",
    "signal_ask_claude",
    "record_signal_action",
    "fetch_signals",
    "build_signal_lead_map_claude",
]
