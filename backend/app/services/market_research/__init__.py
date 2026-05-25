"""market_research service — public API (Phase H Sequence C final form).

Service for assembling the 5-component market-intelligence report.
Submodules:
  - orchestrator.py: _run_research_component (per-component worker dispatch),
    run_market_research (the compose-all-components entry point)
  - persistence.py: Mongo I/O — _find_latest_market_research_report,
    _insert_market_research_report
  - prompts.py: RESEARCH_MARKET_1..5_TEMPLATE (one per component)
  - llm.py: _market_research_agent_output (dispatch wrapper)
  - parsing.py: _extract_research_json (consolidates 5 inline cleanups)
"""

from app.services.market_research.orchestrator import (
    _run_research_component,
    run_market_research,
)

__all__ = [
    "_run_research_component",
    "run_market_research",
]
