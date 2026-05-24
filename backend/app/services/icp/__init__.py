"""icp service — package (Phase H commits 12-13/20).

Submodules:
- orchestrator.py: ICP_generator, icp_research_1..4, run_icp_research,
  _run_icp_research_impl, _icp_research_agent_output, ICP_FUNCTIONS dispatch
- persistence.py: list_icps, delete_recommended_icp, _ensure_icp_indexes,
  _reserve_unique_icp_id, _release_icp_id

Subsequent commits extract prompts.py, llm.py, parsing.py.

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
)
from app.services.icp.persistence import (
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
