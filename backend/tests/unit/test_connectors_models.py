"""Connector request/response model contracts."""
import pytest
from pydantic import ValidationError as PydanticValidationError

from app.models.connectors import (
    ApolloConnectRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
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
