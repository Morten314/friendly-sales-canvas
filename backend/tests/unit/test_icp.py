# backend/tests/unit/test_icp.py
"""Unit tests for app/services/icp.py.

Covers the ICP_generator, the 4 icp_research_N helpers (via dispatch through
run_icp_research), list_icps, delete_recommended_icp, and the ICP-id registry
helpers. Includes the preserved-ICPIdRegistryError test mentioned in spec §4.
"""
import asyncio
import json
from unittest.mock import MagicMock

import pytest
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ICPConfigNotFoundError,
    ICPIdRegistryError,
    RecommendedICPNotFoundError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.services.icp import (
    _release_icp_id,
    _reserve_unique_icp_id,
    delete_recommended_icp,
    list_icps,
    run_icp_research,
)
from tests.fixtures import load_captured, load_seed
from tests.identities import TEST_ICP_ID_1, TEST_ICP_ID_2, TEST_ORG_ID, TEST_USER_ID


def _make_company_record():
    record = MagicMock()
    record.values.return_value = [load_seed("company_profile")]
    return record


# ---------------------------------------------------------------------------
# _reserve_unique_icp_id  /  _release_icp_id
# ---------------------------------------------------------------------------

def test_reserve_unique_icp_id_returns_preferred_when_available():
    db = MagicMock()
    registry = MagicMock()
    db.__getitem__.return_value = registry
    registry.insert_one.return_value = None  # success

    result = _reserve_unique_icp_id(db, "recommended_icp", "user_1", "preferred_id")

    assert result == "preferred_id"


def test_reserve_unique_icp_id_returns_preferred_on_owner_duplicate():
    """If the same owner already reserved this id, return it stable."""
    db = MagicMock()
    registry = MagicMock()
    db.__getitem__.return_value = registry
    registry.insert_one.side_effect = DuplicateKeyError("dup")
    registry.find_one.return_value = {
        "id": "preferred_id",
        "id_type": "recommended_icp",
        "owner_key": "user_1",
    }

    result = _reserve_unique_icp_id(db, "recommended_icp", "user_1", "preferred_id")

    assert result == "preferred_id"


def test_reserve_unique_icp_id_raises_when_exhausted():
    db = MagicMock()
    registry = MagicMock()
    db.__getitem__.return_value = registry
    registry.insert_one.side_effect = DuplicateKeyError("always dup")
    registry.find_one.return_value = None  # not owned by us

    with pytest.raises(ICPIdRegistryError, match="Failed to generate"):
        _reserve_unique_icp_id(db, "recommended_icp", "user_1", "preferred_id")


def test_release_icp_id_deletes_registry_entry():
    db = MagicMock()
    registry = MagicMock()
    db.__getitem__.return_value = registry

    _release_icp_id(db, TEST_ICP_ID_1)

    registry.delete_one.assert_called_once_with({"id": TEST_ICP_ID_1})


def test_release_icp_id_no_op_on_empty():
    db = MagicMock()
    _release_icp_id(db, "")
    db.__getitem__.assert_not_called()


# ---------------------------------------------------------------------------
# list_icps
# ---------------------------------------------------------------------------

def test_list_icps_returns_cached_when_no_refresh(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": TEST_ICP_ID_1, "title": "Cached"}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")
    mocker.patch(
        "app.services.icp.persistence._reserve_unique_icp_id", return_value=TEST_ICP_ID_1,
    )

    items, total = list_icps(MagicMock(), mock_mongo_client, MagicMock(), TEST_USER_ID, refresh=False)

    assert isinstance(items, list)
    assert total == 1
    assert items[0]["id"] == TEST_ICP_ID_1


def test_list_icps_raises_when_no_company_profile_for_refresh(
    mocker, mock_session, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")
    mock_session.run.return_value.single.return_value = None  # no company profile

    with pytest.raises(CompanyProfileNotFoundError):
        list_icps(mock_session._driver, mock_mongo_client, MagicMock(), TEST_USER_ID, refresh=True)


# ---------------------------------------------------------------------------
# run_icp_research
# ---------------------------------------------------------------------------

def test_run_icp_research_raises_unsupported_component(
    mocker, mock_session, mock_mongo_client,
):
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="totally bogus", data={}, refresh=True,
    )
    with pytest.raises(UnsupportedComponentError):
        asyncio.run(run_icp_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen"))


def test_run_icp_research_qwen_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """ICP_FUNCTIONS holds direct refs to icp_research_N — same dispatch-dict
    gotcha as market_research. Patch the dict entry, not the module attr.

    Post-Task-8, research functions return ``(parsed_json, prompt_meta)``; the
    orchestrator unpacks the tuple and merges prompt_meta into the inserted
    Mongo doc — assert both pieces propagate.
    """
    captured = load_captured("icp_research_icp_summary_qwen")
    prompt_meta = {
        "name": "icp_research_1",
        "version": "1.0.0",
        "content_hash": "fake_hash",
        "render_inputs_hash": "fake_inputs_hash",
        "model": "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "rendered_at": "2026-05-26T00:00:00+00:00",
    }
    fake_fn = MagicMock(return_value=(captured, prompt_meta))
    mocker.patch.dict(
        "app.services.icp.orchestrator.ICP_FUNCTIONS",
        {"icp summary & market opportunity": fake_fn},
    )
    mock_session.run.return_value.single.return_value = _make_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.icp.orchestrator._fetch_pinecone_supporting_context", return_value=[],
    )
    mocker.patch(
        "app.services.icp.orchestrator._build_market_context_queries", return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="icp summary & market opportunity", data={}, refresh=True,
    )
    result = asyncio.run(run_icp_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen"))

    assert result["status"] == "success"
    assert result["data"]["user_id"] == TEST_USER_ID
    # prompt_meta threaded into both the response payload and the Mongo insert
    assert result["data"]["prompt_meta"]["name"] == "icp_research_1"
    assert result["data"]["prompt_meta"]["version"] == "1.0.0"
    inserted = coll.insert_one.call_args[0][0]
    assert inserted["prompt_meta"]["name"] == "icp_research_1"
    assert inserted["prompt_meta"]["version"] == "1.0.0"
    assert inserted["prompt_meta"]["model"] == "Qwen/Qwen3-235B-A22B-Instruct-2507-tput"


def test_run_icp_research_claude_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """Claude path: ICP_FUNCTIONS_CLAUDE entries are lambdas that resolve
    the underlying icp_research_N at call time, so patching the module
    attr works here (unlike the direct-ref Qwen dict above).

    Post-Task-8, research functions return ``(parsed_json, prompt_meta)``.
    """
    captured = load_captured("icp_research_icp_buyer_map_claude")
    prompt_meta = {
        "name": "icp_research_2",
        "version": "1.0.0",
        "content_hash": "fake_hash",
        "render_inputs_hash": "fake_inputs_hash",
        "model": "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "rendered_at": "2026-05-26T00:00:00+00:00",
    }
    mocker.patch(
        "app.services.icp.orchestrator.icp_research_2",
        return_value=(captured, prompt_meta),
    )
    mock_session.run.return_value.single.return_value = _make_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.icp.orchestrator._fetch_pinecone_supporting_context", return_value=[],
    )
    mocker.patch(
        "app.services.icp.orchestrator._build_market_context_queries", return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="buyer map & roles, pain points, triggers",
        data={}, refresh=True,
    )
    result = asyncio.run(run_icp_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="claude"))

    assert result["status"] == "success"
    inserted = coll.insert_one.call_args[0][0]
    assert inserted["prompt_meta"]["name"] == "icp_research_2"
    assert inserted["prompt_meta"]["version"] == "1.0.0"


def test_run_icp_research_raises_when_company_profile_missing(
    mocker, mock_session, mock_mongo_client,
):
    mock_session.run.return_value.single.return_value = None
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="icp summary & market opportunity",
        data={}, refresh=True,
    )
    with pytest.raises(CompanyProfileNotFoundError):
        asyncio.run(run_icp_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen"))


# ---------------------------------------------------------------------------
# delete_recommended_icp
# ---------------------------------------------------------------------------

def test_delete_recommended_icp_raises_when_config_missing(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")

    with pytest.raises(ICPConfigNotFoundError):
        delete_recommended_icp(mock_mongo_client, TEST_ICP_ID_1, TEST_USER_ID)


def test_delete_recommended_icp_raises_when_icp_not_in_payload(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": TEST_ICP_ID_2}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")

    with pytest.raises(RecommendedICPNotFoundError):
        delete_recommended_icp(mock_mongo_client, TEST_ICP_ID_1, TEST_USER_ID)


def test_delete_recommended_icp_happy_path(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {
            "suggestedICPs": [
                {"id": TEST_ICP_ID_1, "title": "Mid-market 3PL"},
                {"id": TEST_ICP_ID_2, "title": "Enterprise"},
            ]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")
    release_mock = mocker.patch("app.services.icp.persistence._release_icp_id")

    result = delete_recommended_icp(mock_mongo_client, TEST_ICP_ID_1, TEST_USER_ID)

    assert result["success"] is True
    assert result["data"]["remaining_count"] == 1
    release_mock.assert_called_once()


# ---------------------------------------------------------------------------
# Regression — icp_research_1 Claude path must parse wrapped output
# ---------------------------------------------------------------------------

def test_icp_research_1_claude_parses_wrapped_output(mocker):
    """Regression for the production /icp-research_claude 500 on the
    'icp summary & market opportunity' component.

    icp_research_1 parsed the raw Claude response with the default parser
    (trim_braces=False, strip_final_answer=False), so prose/fence-wrapped JSON
    raised JSONDecodeError -> HTTP 500. Its siblings icp_research_2..4 already
    pass trim_braces=True / strip_final_answer=True and were unaffected.
    """
    payload = {"title": "ICP Summary", "currentData": {"segments": ["mid-market"]}}
    wrapped = f"Here is the ICP summary you requested:\n```json\n{json.dumps(payload)}\n```"
    mocker.patch(
        "app.services.icp.orchestrator._icp_research_agent_output",
        return_value=wrapped,
    )

    from app.services.icp.orchestrator import icp_research_1

    parsed_json, prompt_meta = icp_research_1(MagicMock(), "{}", "claude")

    assert parsed_json["title"] == "ICP Summary"
    assert prompt_meta["name"] == "icp_research_1"
