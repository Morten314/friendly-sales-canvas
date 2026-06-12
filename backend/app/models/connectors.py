"""Pydantic request/response models for the Apollo connector router."""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


# ─── Connection ───

class ApolloConnectRequest(BaseModel):
    org_id: str
    user_id: str
    api_key: str


class ApolloConnectResponse(BaseModel):
    connected: bool
    status: str


class ApolloStatusResponse(BaseModel):
    connected: bool
    status: str
    connected_at: Optional[str] = None
    credits_consumed_total: int = 0
    last_run_credits: int = 0
    low_credit: bool = False
    last_discovery_at: Optional[str] = None
    last_discovery_icp_fingerprint: Optional[str] = None
    icp_changed_since_last_discovery: bool = False


class DisconnectResponse(BaseModel):
    status: str
    message: str


# ─── Lists ───

class ApolloListEntry(BaseModel):
    id: str
    name: str


class ApolloListsResponse(BaseModel):
    lists: List[ApolloListEntry]


# ─── Import ───

class ApolloImportRequest(BaseModel):
    org_id: str
    user_id: str
    list_id: Optional[str] = None   # Apollo list/label ID that FILTERS the search
    label: Optional[str] = None     # Brewra batch DISPLAY NAME (Lead_Stream_Files.filename)


class ApolloImportResponse(BaseModel):
    file_id: str
    status: str


# ─── Enrichment ───

class ApolloEnrichRequest(BaseModel):
    org_id: str
    user_id: str
    lead_ids: List[str]
    reveal_personal_emails: bool = True
    reveal_phone_number: bool = False


class ApolloEnrichResponse(BaseModel):
    run_id: str
    status: str


class ApolloEnrichStatusResponse(BaseModel):
    run_id: str
    org_id: str
    status: str
    total: int
    processed: int
    updated: int
    unmatched: int
    failed: int
    skipped: int = 0
    progress_percent: float
    errors: List[str]
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


# ─── Discovery ───

class ApolloDiscoverRequest(BaseModel):
    org_id: str
    user_id: str
    icp_id: Optional[str] = None
    mode: Literal["keep", "replace"] = "keep"
    max_leads: Optional[int] = None


class ApolloDiscoverResponse(BaseModel):
    run_id: str
    status: str


class DiscoveryCounts(BaseModel):
    searched: int = 0
    qualified: int = 0
    selected: int = 0
    revealed: int = 0
    verified: int = 0
    unverified: int = 0
    created: int = 0
    matched: int = 0
    skipped_duplicates: int = 0
    errors: List[Dict[str, Any]] = []   # [{stage, message}] per spec §5.3


class ApolloDiscoverStatusResponse(BaseModel):
    run_id: str
    org_id: str
    status: str
    mode: str
    counts: DiscoveryCounts
    credits_consumed: int = 0
    progress_percent: float = 0.0
    icp_fingerprint: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None


# ─── Warmup ───

class WarmupMissing(BaseModel):
    step: str
    label: str
    deep_link_hint: str


class ApolloWarmupResponse(BaseModel):
    icp_configured: bool
    signals_generated: bool
    scout_completed: bool
    profiler_analyzed: bool
    ready_count: int
    unlocked: bool
    missing: List[WarmupMissing] = []
