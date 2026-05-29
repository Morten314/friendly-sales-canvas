"""Pydantic request/response models for the Apollo connector router."""
from typing import List, Optional

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
    progress_percent: float
    errors: List[str]
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
