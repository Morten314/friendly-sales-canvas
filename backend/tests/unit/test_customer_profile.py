# backend/tests/unit/test_customer_profile.py
"""Unit tests for app/services/customer_profile.py.

Covers all four public functions plus the 5 typed-exception sites.

Cross-service mocking note: customer_profile.py imports icp helpers inside
each function body via `from app.services.icp import ...`. Because these are
local (not module-level) imports, the names are resolved from app.services.icp
at call time rather than being bound in customer_profile's namespace. The
correct patch target is therefore app.services.icp.<helper>, not
app.services.customer_profile.<helper>.
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    CustomerProfileICPNotFoundError,
    CustomerProfileNotFoundError,
    ICPAlreadyExistsError,
    SuggestedICPNotFoundError,
)
from app.models.customer_profile import (
    CustomerProfileRequest,
    SuggestedICPToCustomerProfileRequest,
)
from app.services.customer_profile import (
    create_from_suggested_icp,
    delete_icp_from_customer_profile,
    get_customer_profile,
    upsert_customer_profile,
)
from tests.identities import TEST_ICP_ID_1, TEST_ICP_ID_2, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# upsert_customer_profile — takes a CustomerProfileRequest (not a raw dict)
# ---------------------------------------------------------------------------

def test_upsert_customer_profile_happy_path(mocker, mock_session, mock_mongo_client):
    # Neo4j company profile lookup succeeds
    record = MagicMock()
    record.values.return_value = [{"name": "Acme Corp"}]
    mock_session.run.return_value.single.return_value = record

    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.icp._reserve_unique_icp_id",
        return_value=TEST_ICP_ID_1,
    )

    request = CustomerProfileRequest(
        profile_type="customer",
        org_id=TEST_ORG_ID,
        icps=[{
            "id": "",
            "primary_region": "DACH",
            "industry": ["Logistics"],
            "company_size": ["Mid-market"],
            "buyer_role": ["VP Ops"],
            "fit_confidence": "high",
        }],
    )
    result = upsert_customer_profile(mock_session._driver, mock_mongo_client, request)

    assert result.get("success") is True
    coll.update_one.assert_called_once()


# ---------------------------------------------------------------------------
# get_customer_profile — takes org_id; raises CompanyProfileNotFoundError when
# neither MongoDB doc nor Neo4j node exists.
# ---------------------------------------------------------------------------

def test_get_customer_profile_raises_when_not_found(mock_session, mock_mongo_client, mocker):

    # MongoDB has no document
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    # Neo4j also has no company profile
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(CompanyProfileNotFoundError, match="No company profile found"):
        get_customer_profile(mock_session._driver, mock_mongo_client, TEST_ORG_ID)


def test_get_customer_profile_returns_existing_doc(mock_session, mock_mongo_client, mocker):
    mocker.patch(
        "app.services.icp._reserve_unique_icp_id",
        side_effect=lambda db, id_type, owner_key, preferred_id=None: preferred_id or TEST_ICP_ID_1,
    )

    coll = MagicMock()
    coll.find_one.return_value = {
        "profile_type": "company",
        "org_id": TEST_ORG_ID,
        "customer_profiles": {"icps": [{"id": TEST_ICP_ID_1, "primary_region": "DACH"}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = get_customer_profile(mock_session._driver, mock_mongo_client, TEST_ORG_ID)

    # Service returns {"success": True, "data": {"icps": [...]}}
    assert result.get("success") is True
    icps = result["data"]["icps"]
    assert len(icps) == 1
    assert icps[0]["id"] == TEST_ICP_ID_1
    # Top-level _id is not part of the return contract; icps are stripped
    assert "_id" not in icps[0]


# ---------------------------------------------------------------------------
# create_from_suggested_icp — takes SuggestedICPToCustomerProfileRequest
# ---------------------------------------------------------------------------

def test_create_from_suggested_icp_happy_path(
    mock_session, mock_mongo_client, mocker,
):
    """create_from_suggested_icp succeeds when the suggested ICP exists and has
    not already been saved for this org. Note: CompanyProfileNotFoundError is
    NOT raised from this function — Neo4j is consulted only for enrichment and
    its absence is non-fatal. CompanyProfileNotFoundError is raised by
    get_customer_profile (covered in test_get_customer_profile_raises_when_not_found).
    """
    mocker.patch(
        "app.services.icp._reserve_unique_icp_id",
        return_value=TEST_ICP_ID_1,
    )

    # Neo4j returns nothing — that is non-fatal for this function
    mock_session.run.return_value.single.return_value = None

    icp_config_coll = MagicMock()
    icp_config_coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": TEST_ICP_ID_1, "title": "Mid-market 3PL", "regions": ["DACH"]}]},
    }
    company_profile_coll = MagicMock()
    company_profile_coll.find_one.return_value = {
        "org_id": TEST_ORG_ID,
        "customer_profiles": {"icps": []},
    }
    mock_mongo_client["Profiler"].__getitem__.side_effect = lambda name: (
        icp_config_coll if name == "ICP_config" else company_profile_coll
    )

    request = SuggestedICPToCustomerProfileRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
    )
    result = create_from_suggested_icp(mock_session._driver, mock_mongo_client, request)

    assert result.get("success") is True
    assert "icp" in result["data"]
    company_profile_coll.update_one.assert_called_once()


def test_create_from_suggested_icp_raises_when_icp_id_missing(
    mock_session, mock_mongo_client, mocker,
):

    # Neo4j has the company profile
    record = MagicMock()
    record.values.return_value = [{"name": "Acme"}]
    mock_session.run.return_value.single.return_value = record

    # ICP_config exists but with no matching icp_id
    icp_config_coll = MagicMock()
    icp_config_coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": "other_id", "title": "Other"}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = icp_config_coll

    request = SuggestedICPToCustomerProfileRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
    )
    with pytest.raises(SuggestedICPNotFoundError, match="Suggested ICP not found"):
        create_from_suggested_icp(mock_session._driver, mock_mongo_client, request)


def test_create_from_suggested_icp_raises_icp_already_exists(
    mock_session, mock_mongo_client, mocker,
):
    mocker.patch(
        "app.services.icp._reserve_unique_icp_id",
        return_value=TEST_ICP_ID_1,
    )

    # Neo4j has the company profile
    record = MagicMock()
    record.values.return_value = [{"name": "Acme"}]
    mock_session.run.return_value.single.return_value = record

    icp_config_coll = MagicMock()
    icp_config_coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": TEST_ICP_ID_1, "title": "Mid-market 3PL"}]},
    }
    customer_profile_coll = MagicMock()
    customer_profile_coll.find_one.return_value = {
        "org_id": TEST_ORG_ID,
        "customer_profiles": {
            "icps": [{"id": "some_id", "source_suggested_icp_id": TEST_ICP_ID_1, "title": "already added"}]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.side_effect = lambda name: (
        icp_config_coll if name == "ICP_config" else customer_profile_coll
    )

    request = SuggestedICPToCustomerProfileRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
    )
    with pytest.raises(ICPAlreadyExistsError, match="already"):
        create_from_suggested_icp(mock_session._driver, mock_mongo_client, request)


# ---------------------------------------------------------------------------
# delete_icp_from_customer_profile — signature is (icp_id, org_id)
# ---------------------------------------------------------------------------

def test_delete_icp_raises_when_customer_profile_missing(
    mock_mongo_client, mocker,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    with pytest.raises(CustomerProfileNotFoundError):
        delete_icp_from_customer_profile(mock_mongo_client, TEST_ICP_ID_1, TEST_ORG_ID)


def test_delete_icp_raises_when_icp_not_in_profile(
    mock_mongo_client, mocker,
):
    coll = MagicMock()
    coll.find_one.return_value = {
        "org_id": TEST_ORG_ID,
        "customer_profiles": {"icps": [{"id": TEST_ICP_ID_2, "primary_region": "North America"}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp._release_icp_id")

    with pytest.raises(CustomerProfileICPNotFoundError):
        delete_icp_from_customer_profile(mock_mongo_client, TEST_ICP_ID_1, TEST_ORG_ID)


def test_delete_icp_happy_path_releases_id(mock_mongo_client, mocker):
    coll = MagicMock()
    coll.find_one.return_value = {
        "org_id": TEST_ORG_ID,
        "customer_profiles": {
            "icps": [
                {"id": TEST_ICP_ID_1, "primary_region": "DACH"},
                {"id": TEST_ICP_ID_2, "primary_region": "North America"},
            ]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    release_mock = mocker.patch("app.services.icp._release_icp_id")

    result = delete_icp_from_customer_profile(mock_mongo_client, TEST_ICP_ID_1, TEST_ORG_ID)

    assert result.get("success") is True
    release_mock.assert_called_once()
