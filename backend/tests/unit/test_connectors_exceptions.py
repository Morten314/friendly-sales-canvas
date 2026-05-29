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
