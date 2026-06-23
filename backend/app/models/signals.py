"""Signal request and response models."""
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SignalActionRequest(BaseModel):
    org_id: str
    signal_id: str
    action: Literal["accept", "reject"]


class SignalAskRequest(BaseModel):
    org_id: str
    user_id: str
    question: str
    history: Optional[List[Dict[str, Any]]] = None  # Open-ended history format


class SignalLeadMapRequest(BaseModel):
    user_id: str
    org_id: str
    refresh: bool = False


class MatchedLead(BaseModel):
    company: str = ""
    relevance: str = ""  # high|medium|low — kept str (degrade-tolerant; only feeds the prompt)
    why: str = ""


class RecommendationArtefactRequest(BaseModel):
    """POST /generate-recommendation-artefact_claude — all inputs the LLM needs
    are supplied by the FE (no server-side profile/leads fetch). user_id/org_id
    are for logging/scoping only; no auth is enforced (§3)."""
    signal_headline: str
    signal_description: str = ""
    signal_sources: List[str] = []
    matched_leads: List[MatchedLead] = []
    recommendation: str
    recommendation_answer: str
    user_id: str
    org_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class SignalsResearchResponse(BaseModel):
    """Response for POST /signals-research.

    run_signals_research() returns {"status": "success", "data": {...}} where
    ``data`` is the LLM-generated signal document (agent-specific shape from
    search_signals()).  Typed as Dict[str, Any] to avoid key-mismatch errors
    across scout/profiler variants.
    """

    status: str
    data: Dict[str, Any]


class GenerateSignalsBatchResponse(BaseModel):
    """Response for POST /generate-signals-batch and POST /generate-signals-batch_claude."""

    status: str
    message: str
    data: List[Dict[str, Any]]


class SignalActionResponse(BaseModel):
    """Response for POST /signal_action (accept or reject).

    ``org_id`` is present on accept but absent on reject, so it is Optional.
    """

    status: str
    message: str
    signal_id: str
    action: str
    org_id: Optional[str] = None


class SignalAskResponse(BaseModel):
    """Response for POST /signal_Ask and POST /signal_ask_claude."""

    status: str
    answer: str
    org_id: str
    user_id: str
    question: str
    prompt_meta: Optional[Dict[str, Any]] = None


class RecommendationArtefactResponse(BaseModel):
    """Response for POST /generate-recommendation-artefact_claude — the five
    LLM-generated playbook sections. All default "" so a malformed/partial LLM
    response still yields a valid body (degrade-never-throw, §7.3)."""
    what_to_do: str = ""
    strategy: str = ""
    how_to_communicate: str = ""
    communication_channel: str = ""
    communication_template: str = ""
