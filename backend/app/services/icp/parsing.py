"""Response parsing for icp/ — JSON extraction shared across ICP_generator
and icp_research_1..4 workers.

The shared generic helper now lives in app.services._llm_helpers. This
module preserves the _extract_icp_json name as a 1-line alias so the
~8 existing in-package callsites don't need a cross-cutting sweep.
"""
from app.services._llm_helpers import _extract_research_json

# 1-line alias. See _extract_research_json in _llm_helpers for the
# per-service convention table (escape_keys, trim_braces, strip_final_answer
# variations used by ICP_generator and icp_research_1..4 workers).
_extract_icp_json = _extract_research_json
