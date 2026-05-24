"""icp service — public API (Phase H Sequence D final form).

Service for generating ICPs from company profiles + persisting them.
Submodules:
  - orchestrator.py: ICP_generator, icp_research_1..4, run_icp_research,
    _run_icp_research_impl, ICP_FUNCTIONS dispatch
  - persistence.py: list_icps (cache-then-generate), delete_recommended_icp,
    _ensure_icp_indexes, _reserve_unique_icp_id, _release_icp_id
  - prompts.py: ICP_GENERATOR_TEMPLATE, ICP_RESEARCH_1..4_TEMPLATE
  - llm.py: _icp_research_agent_output (dispatch wrapper)
  - parsing.py: _extract_icp_json (consolidates per-worker JSON cleanups)

§3.7 _-prefix exceptions re-exported below: _ensure_icp_indexes (lifespan),
_reserve_unique_icp_id + _release_icp_id (lazy-imported by
customer_profile.py — patches on those must target the package path, not
the submodule path; see spec §3.8 lazy-import-through-__init__ exception).
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
