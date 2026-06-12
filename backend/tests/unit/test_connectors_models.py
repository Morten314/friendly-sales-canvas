"""Connector request/response model contracts."""
import pytest
from pydantic import ValidationError as PydanticValidationError

from app.models.connectors import (
    ApolloConnectRequest,
    ApolloDiscoverRequest,
    ApolloDiscoverResponse,
    ApolloEnrichRequest,
    ApolloImportRequest,
    ApolloStatusResponse,
    ApolloWarmupResponse,
)


def test_connect_request_requires_api_key():
    req = ApolloConnectRequest(org_id="o", user_id="u", api_key="k")
    assert req.api_key == "k"
    with pytest.raises(PydanticValidationError):
        ApolloConnectRequest(org_id="o", user_id="u")  # missing api_key


def test_import_request_optional_filters_default_none():
    req = ApolloImportRequest(org_id="o", user_id="u")
    assert req.list_id is None
    assert req.label is None


def test_enrich_request_reveal_defaults():
    req = ApolloEnrichRequest(org_id="o", user_id="u", lead_ids=["l1", "l2"])
    assert req.reveal_personal_emails is True
    assert req.reveal_phone_number is False
    assert req.lead_ids == ["l1", "l2"]


def test_discover_request_defaults():
    r = ApolloDiscoverRequest(org_id="o", user_id="u")
    assert r.mode == "keep" and r.icp_id is None and r.max_leads is None


def test_status_response_has_new_fields():
    s = ApolloStatusResponse(connected=True, status="connected", credits_consumed_total=0,
                             last_run_credits=0, low_credit=False, icp_changed_since_last_discovery=False)
    assert s.low_credit is False


def test_warmup_response_shape():
    w = ApolloWarmupResponse(icp_configured=True, signals_generated=False, scout_completed=True,
                             profiler_analyzed=True, ready_count=3, unlocked=False,
                             missing=[{"step": "signals_generated", "label": "Signals", "deep_link_hint": "signals"}])
    assert w.ready_count == 3
