"""Connector exception leaves must subclass the right status-family bases
so app/main.py's existing handlers route them by MRO."""
from app.core.exceptions import (
    NotFoundError,
    ServiceError,
    ValidationError,
    ConnectorNotConnectedError,
    ConnectorCredentialsInvalidError,
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorEnrichRunNotFoundError,
    ApolloConnectorHTTPError,
    ProfileIncompleteError,
    DiscoveryInProgressError,
    IcpUnderspecifiedError,
    MasterKeyRequiredError,
    ApolloSearchError,
)


def test_not_connected_is_404_family():
    assert issubclass(ConnectorNotConnectedError, NotFoundError)


def test_enrich_run_not_found_is_404_family():
    assert issubclass(ConnectorEnrichRunNotFoundError, NotFoundError)


def test_invalid_credentials_is_400_family():
    assert issubclass(ConnectorCredentialsInvalidError, ValidationError)


def test_apollo_api_error_is_500_family():
    assert issubclass(ApolloAPIError, ServiceError)


def test_credits_exhausted_is_500_family():
    assert issubclass(ApolloCreditsExhaustedError, ServiceError)


def test_profile_incomplete_carries_section_and_409():
    e = ProfileIncompleteError(missing_section="industry")
    assert isinstance(e, ApolloConnectorHTTPError)
    assert e.status_code == 409
    assert e.code == "profile_incomplete"
    assert e.missing_section == "industry"


def test_status_codes_and_codes():
    assert (DiscoveryInProgressError().status_code, DiscoveryInProgressError().code) == (409, "discovery_in_progress")
    assert (IcpUnderspecifiedError().status_code, IcpUnderspecifiedError().code) == (422, "icp_underspecified")
    assert (MasterKeyRequiredError().status_code, MasterKeyRequiredError().code) == (403, "master_key_required")
    assert (ApolloSearchError().status_code, ApolloSearchError().code) == (502, "apollo_search_error")
