"""market_research service — package skeleton (Phase H commit 8/20).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.
"""

from app.services.market_research.orchestrator import (
    Research_Market_1,
    Research_Market_2,
    Research_Market_3,
    Research_Market_4,
    Research_Market_5,
    run_market_research,
)

__all__ = [
    "Research_Market_1",
    "Research_Market_2",
    "Research_Market_3",
    "Research_Market_4",
    "Research_Market_5",
    "run_market_research",
]
