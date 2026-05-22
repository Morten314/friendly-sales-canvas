# backend/tests/unit/test_market_research.py
"""Unit tests for app/services/market_research.py.

Covers run_market_research (async dispatcher) and the 5 Research_Market_N
helpers. LLM calls are mocked using captured fixtures from
tests/fixtures/captured/.
"""
import asyncio
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.services.market_research import run_market_research
from tests.fixtures import load_captured, load_seed
from tests.identities import TEST_ORG_ID, TEST_USER_ID


VALID_COMPONENTS = [
    "market size & opportunity",
    "industry trends report",
    "competitor landscape",
    "regulatory & compliance highlights",
    "market entry & growth strategy",
]


def _make_neo4j_company_record():
    """Mock Neo4j record whose values()[0] yields the seed company profile dict."""
    record = MagicMock()
    record.values.return_value = [load_seed("company_profile")]
    return record


def _mock_market_collection(mock_mongo_client, find_one_return=None):
    """Wire mock_mongo_client so client["Scout_Agent"]["Market_Intelligence"]
    returns a collection mock with the given find_one return value.
    """
    coll = MagicMock()
    coll.find_one.return_value = find_one_return
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    return coll


# ---------------------------------------------------------------------------
# Happy paths — Groq backend
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "component_name",
    [
        "market size & opportunity",
        "industry trends report",
        "competitor landscape",
        "regulatory & compliance highlights",
        "market entry & growth strategy",
    ],
)
def test_run_market_research_groq_per_component(
    mocker, mock_session, mock_mongo_client, component_name,
):
    """Each of the 5 components dispatches via COMPONENT_FUNCTIONS.

    NOTE: COMPONENT_FUNCTIONS (in market_research.py) holds direct function
    references built at module load time. Patching the module-level
    Research_Market_N name does NOT update the dict entry — the dict still
    points at the original function object. Use mocker.patch.dict to
    surgically replace the entry being looked up.
    """
    captured = load_captured("market_research_market_size_groq")
    fake_fn = MagicMock(return_value=captured)
    mocker.patch.dict(
        "app.services.market_research.COMPONENT_FUNCTIONS",
        {component_name: fake_fn},
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    # Stub Pinecone helper
    mocker.patch(
        "app.services.market_research._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name=component_name, data={}, refresh=True,
    )
    result = asyncio.run(run_market_research(request, llm_backend="groq"))

    assert result["status"] == "success"
    assert result["data"]["component_name"] == component_name
    assert result["data"]["user_id"] == TEST_USER_ID


def test_run_market_research_returns_cached_when_not_refreshing(
    mocker, mock_session, mock_mongo_client,
):
    """refresh=False should return the latest Mongo report and skip the LLM call."""
    captured = load_captured("market_research_market_size_groq")
    cached_doc = dict(captured)
    cached_doc.update({
        "user_id": TEST_USER_ID,
        "component_name": "market size & opportunity",
    })
    _mock_market_collection(mock_mongo_client, find_one_return=cached_doc)
    # Patch the dispatch dict entry so we can verify the cached-return path
    # never reaches it.
    fake_fn = MagicMock()
    mocker.patch.dict(
        "app.services.market_research.COMPONENT_FUNCTIONS",
        {"market size & opportunity": fake_fn},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=False,
    )
    result = asyncio.run(run_market_research(request, llm_backend="groq"))

    assert result["status"] == "success"
    fake_fn.assert_not_called()


# ---------------------------------------------------------------------------
# Happy path — Claude backend
# ---------------------------------------------------------------------------

def test_run_market_research_claude_uses_captured(
    mocker, mock_session, mock_mongo_client,
):
    """Claude path: COMPONENT_FUNCTIONS_CLAUDE wraps each Research_Market_N
    in a lambda (`lambda d: Research_Market_1(d, "claude")`). The lambda
    resolves the name at call time, so patching the module-level
    Research_Market_1 DOES reach the call. (Contrast with the Groq path
    above, where the dict holds direct refs and patch.dict is required.)
    """
    captured = load_captured("market_research_market_size_claude")
    mocker.patch(
        "app.services.market_research.Research_Market_1",
        return_value=captured,
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    mocker.patch(
        "app.services.market_research._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    result = asyncio.run(run_market_research(request, llm_backend="claude"))

    assert result["status"] == "success"
    assert result["data"]["user_id"] == TEST_USER_ID


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------

def test_run_market_research_raises_on_unsupported_component(
    mocker, mock_session, mock_mongo_client,
):
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="not a real component", data={}, refresh=True,
    )
    with pytest.raises(UnsupportedComponentError, match="Unsupported component_name"):
        asyncio.run(run_market_research(request))


def test_run_market_research_raises_when_company_profile_missing(
    mocker, mock_session, mock_mongo_client,
):
    mock_session.run.return_value.single.return_value = None
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    with pytest.raises(CompanyProfileNotFoundError, match="No company profile"):
        asyncio.run(run_market_research(request))


def test_run_market_research_propagates_budget_exhausted_error(
    mocker, mock_session, mock_mongo_client,
):
    """BudgetExhaustedError raised inside the research function propagates
    out of run_market_research (the catch at L998 re-raises immediately;
    the router maps it to HTTP 429). Acceptance criterion: every typed
    exception leaf class has at least one pytest.raises assertion."""
    from app.core.exceptions import BudgetExhaustedError
    fake_fn = MagicMock(side_effect=BudgetExhaustedError("Claude budget exhausted"))
    mocker.patch.dict(
        "app.services.market_research.COMPONENT_FUNCTIONS_CLAUDE",
        {"market size & opportunity": fake_fn},
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    mocker.patch(
        "app.services.market_research._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    with pytest.raises(BudgetExhaustedError, match="budget exhausted"):
        asyncio.run(run_market_research(request, llm_backend="claude"))
