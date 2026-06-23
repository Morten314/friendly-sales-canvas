# backend/tests/unit/test_market_research.py
"""Unit tests for app/services/market_research.py.

Covers run_market_research (async dispatcher) and the unified
_run_research_component dispatch (post-K3 collapse). LLM calls are mocked
using captured fixtures from tests/fixtures/captured/.
"""
import asyncio
import json
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
# Happy paths — Qwen backend
# ---------------------------------------------------------------------------

_COMPONENT_FIXTURE_SLUG = {
    "market size & opportunity": "market_size",
    "industry trends report": "industry_trends",
    "competitor landscape": "competitor_landscape",
    "regulatory & compliance highlights": "regulatory_compliance",
    "market entry & growth strategy": "market_entry",
}


@pytest.mark.parametrize("component_name", list(_COMPONENT_FIXTURE_SLUG))
def test_run_market_research_qwen_per_component(
    mocker, mock_session, mock_mongo_client, component_name,
):
    """Each of the 5 components dispatches via COMPONENT_FUNCTIONS.

    NOTE: COMPONENT_FUNCTIONS (in market_research.py) holds direct function
    references built at module load time. Patching the module-level
    Research_Market_N name does NOT update the dict entry — the dict still
    points at the original function object. Use mocker.patch.dict to
    surgically replace the entry being looked up.

    Post-Task-10, research functions return ``(parsed_json, prompt_meta)``;
    the orchestrator unpacks the tuple and merges prompt_meta into the
    inserted Mongo doc.
    """
    slug = _COMPONENT_FIXTURE_SLUG[component_name]
    captured = load_captured(f"market_research_{slug}_qwen")
    prompt_meta = {
        "name": f"research_market_{list(_COMPONENT_FIXTURE_SLUG).index(component_name) + 1}",
        "version": "1.0.0",
        "content_hash": "fake_hash",
        "render_inputs_hash": "fake_inputs_hash",
        "model": "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "rendered_at": "2026-05-26T00:00:00+00:00",
    }
    fake_fn = MagicMock(return_value=(captured, prompt_meta))
    mocker.patch.dict(
        "app.services.market_research.orchestrator.COMPONENT_FUNCTIONS",
        {component_name: fake_fn},
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    coll = _mock_market_collection(mock_mongo_client, find_one_return=None)
    # Stub Pinecone helper
    mocker.patch(
        "app.services.market_research.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name=component_name, data={}, refresh=True,
    )
    result = asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen"))

    assert result["status"] == "success"
    assert result["data"]["component_name"] == component_name
    assert result["data"]["user_id"] == TEST_USER_ID
    # prompt_meta threaded into both the response payload and the Mongo insert.
    assert result["data"]["prompt_meta"]["name"] == prompt_meta["name"]
    assert result["data"]["prompt_meta"]["version"] == "1.0.0"
    inserted = coll.insert_one.call_args[0][0]
    assert inserted["prompt_meta"]["name"] == prompt_meta["name"]
    assert inserted["prompt_meta"]["version"] == "1.0.0"
    assert inserted["prompt_meta"]["model"] == "Qwen/Qwen3-235B-A22B-Instruct-2507-tput"


def test_run_market_research_returns_cached_when_not_refreshing(
    mocker, mock_session, mock_mongo_client,
):
    """refresh=False should return the latest Mongo report and skip the LLM call."""
    captured = load_captured("market_research_market_size_qwen")
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
        "app.services.market_research.orchestrator.COMPONENT_FUNCTIONS",
        {"market size & opportunity": fake_fn},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=False,
    )
    result = asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen"))

    assert result["status"] == "success"
    fake_fn.assert_not_called()


# ---------------------------------------------------------------------------
# Happy path — Claude backend
# ---------------------------------------------------------------------------

def test_run_market_research_claude_uses_captured(
    mocker, mock_session, mock_mongo_client,
):
    """Claude path: COMPONENT_FUNCTIONS_CLAUDE wraps the unified dispatch
    in a lambda (`lambda agent_chain, d: _run_research_component(N, agent_chain, d, "claude")`).
    The lambda resolves the name at call time, so patching the module-level
    _run_research_component DOES reach the call. (Contrast with the Qwen path
    above, where patch.dict is used for parity.)

    Post-Task-10, _run_research_component returns ``(parsed_json, prompt_meta)``.
    """
    captured = load_captured("market_research_market_size_claude")
    prompt_meta = {
        "name": "research_market_1",
        "version": "1.0.0",
        "content_hash": "fake_hash",
        "render_inputs_hash": "fake_inputs_hash",
        "model": "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "rendered_at": "2026-05-26T00:00:00+00:00",
    }
    mocker.patch(
        "app.services.market_research.orchestrator._run_research_component",
        return_value=(captured, prompt_meta),
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    coll = _mock_market_collection(mock_mongo_client, find_one_return=None)
    mocker.patch(
        "app.services.market_research.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    result = asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="claude"))

    assert result["status"] == "success"
    assert result["data"]["user_id"] == TEST_USER_ID
    inserted = coll.insert_one.call_args[0][0]
    assert inserted["prompt_meta"]["name"] == "research_market_1"
    assert inserted["prompt_meta"]["version"] == "1.0.0"


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
        asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request))


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
        asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request))


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
        "app.services.market_research.orchestrator.COMPONENT_FUNCTIONS_CLAUDE",
        {"market size & opportunity": fake_fn},
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)
    mocker.patch(
        "app.services.market_research.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    with pytest.raises(BudgetExhaustedError, match="budget exhausted"):
        asyncio.run(run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="claude"))


SUPPORTING_DOC_ROWS = [
    {
        "query": "market size",
        "id": "doc-chunk-1",
        "score": 0.91,
        "content": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
        "metadata": {
            "source": "acme_q3.pdf",
            "text": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
            "page": 2,
        },
    },
]


@pytest.mark.parametrize("llm_backend", ["qwen", "claude"])
def test_run_market_research_labels_supporting_documents(
    mocker, mock_session, mock_mongo_client, llm_backend,
):
    """The market-research prompt carries a labeled SUPPORTING DOCUMENTS
    section (threaded through the real dispatch lambda + _run_research_component
    + prompts.render), the pinecone keys no longer ride inside the
    company_profile JSON blob (D1), and — on the `claude` param, which runs the
    real COMPONENT_FUNCTIONS_CLAUDE lambda — the positional `"claude"` survives
    the threading (the exact keyword/positional hazard the plan warns about)."""
    captured = {}

    def _capture(agent_chain, body, profile_json, backend):
        captured["body"] = body
        captured["backend"] = backend
        return 'Final Answer: {"executiveSummary": "ok", "tamValue": "$1B"}'

    mocker.patch(
        "app.services.market_research.orchestrator._market_research_agent_output",
        side_effect=_capture,
    )
    mocker.patch(
        "app.services.market_research.orchestrator._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    result = asyncio.run(
        run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend=llm_backend)
    )

    assert result["status"] == "success"
    # claude path: the positional "claude" reached the leaf un-clobbered by docs
    assert captured["backend"] == llm_backend
    body = captured["body"]
    assert "SUPPORTING DOCUMENTS" in body
    assert "ACME Corp announced 30% revenue growth" in body
    assert "pinecone_supporting_context" not in body
    assert "pinecone_context_queries" not in body


# ---------------------------------------------------------------------------
# Regression — Claude path must parse the prompt-mandated "Final Answer:" framing
# ---------------------------------------------------------------------------

def test_run_research_component_claude_parses_final_answer_wrapped_output(mocker):
    """Regression for the production /market-research_claude 500s (all 5 components).

    Every research_market_* prompt ends with the shared
    final_answer_json_directive, which instructs the model to reply
    ``Final Answer: <JSON>``. The Claude path returns that text verbatim, so the
    parser must strip the 'Final Answer:' framing (and code fences) before
    json.loads. market_research previously parsed with the default settings
    (strip_final_answer=False, trim_braces=False) and raised JSONDecodeError on
    every component, surfacing as HTTP 500. Mirrors the robust signals path.
    """
    payload = {"executiveSummary": "Large and growing", "tamValue": "$4.2B"}
    wrapped = f"Final Answer:\n```json\n{json.dumps(payload)}\n```"
    mocker.patch(
        "app.services.market_research.orchestrator._market_research_agent_output",
        return_value=wrapped,
    )

    from app.services.market_research.orchestrator import _run_research_component

    parsed_json, prompt_meta = _run_research_component(1, MagicMock(), "{}", "claude")

    assert parsed_json["tamValue"] == "$4.2B"
    assert parsed_json["executiveSummary"] == "Large and growing"
    assert prompt_meta["name"] == "research_market_1"
