"""Market research request and response models."""
from typing import Any, Dict, Optional
from pydantic import BaseModel


# Market Request model
class MarketRequest(BaseModel):
    user_id: str
    org_id: Optional[str] = None
    component_name: str
    data: dict
    refresh: bool = False


class MarketResponse(BaseModel):
    """Response for POST /market-research and POST /market-research_claude.

    run_market_research() returns {"status": "success", "data": {...}} where
    ``data`` is a heterogeneous LLM-generated report document whose shape
    varies per component_name.  The ``data`` field is therefore typed as
    Dict[str, Any] to avoid spurious validation errors for any component.
    """

    status: str
    data: Dict[str, Any]
