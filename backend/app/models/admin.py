"""Models for the internal ops-console endpoints (spec 44)."""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AdminOrgSummary(BaseModel):
    # The orgs document is loosely structured; allow extras (spec §6 item 1).
    model_config = ConfigDict(extra="allow")
    org_id: str
    org_name: Optional[str] = None
    user_count: int = 0
    user_ids: List[str] = []


class HealthProbe(BaseModel):
    name: str
    status: str  # "ok" | "error" | "timeout"
    detail: Optional[str] = None
    latency_ms: Optional[float] = None


class AdminHealthResponse(BaseModel):
    probes: List[HealthProbe]
