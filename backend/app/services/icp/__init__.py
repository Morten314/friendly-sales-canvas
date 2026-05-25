"""icp service — public API.

Service for generating ICPs from company profiles + persisting them.
Submodules:
  - orchestrator.py: ICP_generator, icp_research_1..4, run_icp_research,
    _run_icp_research_impl, ICP_FUNCTIONS dispatch
  - persistence.py: list_icps (cache-then-generate), delete_recommended_icp,
    _ensure_icp_indexes, _reserve_unique_icp_id, _release_icp_id
  - prompts.py: ICP_GENERATOR_TEMPLATE, ICP_RESEARCH_1..4_TEMPLATE
  - llm.py: _icp_research_agent_output (dispatch wrapper)
  - parsing.py: _extract_icp_json (consolidates per-worker JSON cleanups)

_-prefix helpers re-exported below for external callers that import via the
package path: _ensure_icp_indexes (app/main.py lifespan),
_reserve_unique_icp_id + _release_icp_id (customer_profile.py). Tests
patching these for those callers target the caller's namespace (e.g.,
app.services.customer_profile._reserve_unique_icp_id), per patch-where-used.
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
