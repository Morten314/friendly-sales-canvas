"""icp service — package skeleton (Phase H commit 12/20).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.

§3.7 exceptions: _ensure_icp_indexes (lifespan), _reserve_unique_icp_id +
_release_icp_id (lazy-imported by customer_profile.py).
"""

from app.services.icp.orchestrator import (
    ICP_generator,
    icp_research_1,
    icp_research_2,
    icp_research_3,
    icp_research_4,
    run_icp_research,
    list_icps,
    delete_recommended_icp,
    _ensure_icp_indexes,
    _reserve_unique_icp_id,
    _release_icp_id,
)

__all__ = [
    "ICP_generator",
    "icp_research_1",
    "icp_research_2",
    "icp_research_3",
    "icp_research_4",
    "run_icp_research",
    "list_icps",
    "delete_recommended_icp",
    "_ensure_icp_indexes",
    "_reserve_unique_icp_id",
    "_release_icp_id",
]
