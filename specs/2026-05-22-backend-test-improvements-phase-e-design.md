# Backend Modularization Phase E — Test Improvements Design

**Date:** 2026-05-22
**Phase:** E (test quality)
**Predecessors:** Phase A (structural split, `2026-05-12-backend-modularization-design.md`), Phase B (`2026-05-21-backend-modularization-phase-b-design.md`), Phase C (`2026-05-22-backend-modularization-phase-c-design.md`), Phase D (`2026-05-22-backend-modularization-phase-d-design.md`)
**Targets:** `docs/TECH_DEBT.md` TD-001 + TD-002 — both closed by this phase.
**Branch:** `refactor-backend-modularization-phase-e` off `master`.

---

## 1. Summary

Phase E delivers the test-quality improvements that Phase D unblocked. It has two halves:

- **TD-002 — Service-function unit tests.** A new `backend/tests/unit/` directory adds direct unit tests for every public function in the 9 service files Phase D migrated. Tests call services without going through `TestClient`, mock at the same `app.core.clients.*` layer the integration tests do, and assert on returns and typed exceptions (`pytest.raises(LeadNotFoundError)` style). This is the test layer Phase D's typed-exception hierarchy was the precondition for.

- **TD-001 — Captured LLM fixtures.** A new `backend/tests/capture_fixtures.py` script invokes the LLM-using service helpers (`Research_Market_*`, `search_signals`, `agent_chain.invoke`, etc.) in-process with real API keys, captures their outputs, and writes them to `tests/fixtures/captured/*.json`. Integration tests and the new unit tests use these captures as their LLM mock return values.

The two halves compose: a captured fixture from TD-001 becomes the deterministic LLM mock for a TD-002 unit test. The same JSON file feeds both layers.

After Phase E, the test count grows from 93 to ~210+, all green, with `pytest tests/unit/` running in under two seconds.

---

## 2. Scope

### 2.1 In scope

**TD-002 (Service-function unit tests):**
- A new `backend/tests/unit/` directory with one test file per migrated service: `test_customer_profile.py`, `test_documents.py`, `test_icp.py`, `test_leads.py`, `test_market_research.py`, `test_market_scoring.py`, `test_org_auth.py`, `test_profiles.py`, `test_signals.py`.
- ~110–130 new tests total: every public function gets a happy-path test plus at least one error/typed-exception path test.
- Coverage of all typed-exception raise sites in Phase D's inventory — each `raise <FooNotFoundError>` site is asserted somewhere via `pytest.raises(...)`.
- Coverage of the two background-task BrewraError catch paths (`_run_market_scoring_for_org`, `process_file_to_embeddings`) — the Phase D Task 15 "structural-only" gap.
- A `tests/unit/conftest.py` providing two shared fixtures (`mock_session`, `mock_mongo_client`) that patch `app.core.clients.driver` and `app.core.clients.client`. LLM-call mocking happens per-test via `mocker.patch(...)`; no shared LLM fixture (each test mocks the specific helper it exercises).

**TD-001 (Captured LLM fixtures):**
- A `backend/tests/capture_fixtures.py` script that imports service helpers and invokes them in-process to capture LLM outputs.
- `backend/tests/fixtures/captured/` populated with ~24 JSON files covering market_research (5 components × 2 backends = 10), icp_research (~4 components × 2 backends ≈ 8), signals (scout/profiler × 2 backends = 4), signal_ask (2 backends).
- `backend/tests/fixtures/seed/` populated with the test payloads the capture script feeds into the helpers: `company_profile.json`, `icp_card.json`, `leads_sample.json`.
- A `backend/tests/fixtures/__init__.py` helper module exposing `load_captured(name)` and `load_seed(name)`.
- Existing integration tests (`test_market_research.py`, `test_icp.py`, `test_signals.py`) rewired to use `load_captured(...)` instead of hand-crafted dicts. Of the three, only `test_icp.py` uses syrupy snapshots; its `.ambr` file is re-baselined against the captured data in the same commit.

**Cleanup:**
- `docs/TECH_DEBT.md` updated to mark TD-001 and TD-002 as closed (with a "resolved by Phase E" marker line in each).

### 2.2 Out of scope (deferred)

**Underscore-prefixed helper modules** (`_claude_budget.py`, `_llm_helpers.py`, `_retrieval.py`): tested indirectly through the services that use them. Direct tests are a future candidate; not blocking.

**`graph_chat.py` and `pipeline.py`:** not in the Phase D migration set (no typed-exception raises), so they're not in scope for the TD-002 unit-test pass. Integration tests cover them. `graph_chat.py` does contain the Cypher-injection risk sites (`voice_graph`/`text_graph`) flagged in CLAUDE.md "Gotchas" — those belong to the Phase F+ security-hardening phase, not Phase E.

**Router-direct unit tests:** integration tests already exercise router code via `TestClient`. Adding a router unit layer offers no new signal.

**Testcontainers / real DB images:** mock-based unit tests suffice at MVP velocity. Future Phase F+ candidate when a real bug demonstrates mock divergence.

**100% branch coverage:** target is happy + at least one sad/branch path per public function. Full branch coverage is out of scope; PRs adding tests opportunistically are welcomed.

**Frontend tests:** out of scope.

**CI integration of `capture_fixtures.py`:** stays a developer-run script. Re-runs are intentional events (prompt changed, model swapped, "fixtures lied" incident), not scheduled.

**Other Phase D §8 candidates** (DI, security hardening, pagination, dedup audit, lifespan migration, create_index audit) carry forward to Phase F+ — see §8 below.

### 2.3 Why this isn't bigger

A textbook test phase would also include:
- 100% branch coverage with hypothesis-style property tests.
- Real DB integration testing via testcontainers.
- A frontend test layer.
- Coverage-gating in CI.

These are deferred because each is its own phase. Phase E's job is to close TD-001 and TD-002 — the two debt items Phase D's narrative explicitly named.

---

## 3. Architecture

### 3.1 Directory layout

```
backend/tests/
├── __init__.py                            # existing
├── conftest.py                            # existing (integration-test fixtures)
├── helpers.py                             # existing
├── identities.py                          # existing
├── test_smoke.py, test_auth_org.py, ...   # existing integration test files (89 def-test functions, 93 pytest-collected)
├── __snapshots__/                         # existing syrupy snapshots (only test_auth_org.ambr, test_icp.ambr, test_profiles.ambr)
├── unit/                                  # NEW (TD-002)
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_customer_profile.py
│   ├── test_documents.py
│   ├── test_icp.py
│   ├── test_leads.py
│   ├── test_market_research.py
│   ├── test_market_scoring.py
│   ├── test_org_auth.py
│   ├── test_profiles.py
│   └── test_signals.py
├── fixtures/                              # existing — flat layout, kept
│   ├── __init__.py                        # MODIFIED: add load_captured(), load_seed()
│   ├── icp.py                             # existing hand-crafted builder
│   ├── leads.py                           # existing hand-crafted builder
│   ├── market_research.py                 # existing hand-crafted builder
│   ├── profiles.py                        # existing hand-crafted builder
│   ├── signals.py                         # existing hand-crafted builder
│   ├── captured/                          # NEW (TD-001 output, committed)
│   │   ├── market_research_market_size_groq.json
│   │   ├── market_research_market_size_claude.json
│   │   ├── ... (10 files for market_research)
│   │   ├── icp_research_<component>_<backend>.json   # ~10 files
│   │   ├── search_signals_scout_groq.json
│   │   ├── search_signals_scout_claude.json
│   │   ├── search_signals_profiler_groq.json
│   │   ├── search_signals_profiler_claude.json
│   │   ├── signal_ask_groq.json
│   │   └── signal_ask_claude.json
│   └── seed/                              # NEW (capture-script inputs, committed)
│       ├── company_profile.json
│       ├── icp_card.json
│       └── leads_sample.json
└── capture_fixtures.py                    # NEW (TD-001 script)
```

### 3.2 TD-002 — Unit test layer

**Mock convention:** unit tests patch at the same source-level layer the integration tests do — `app.core.clients.driver`, `app.core.clients.client`, `app.core.llm_config.agent_chain`, and the per-module imports of LLM helpers (`app.services.market_research.Research_Market_1`, etc.). No `TestClient`; tests call service functions directly.

**Cross-service mocking:** several services import private helpers from other services — e.g. `customer_profile.py` imports `_reserve_unique_icp_id` from `app.services.icp` at 4 sites. Unit tests mock at the *caller's* namespace, not the source module: `mocker.patch("app.services.customer_profile._reserve_unique_icp_id")`. This is standard Python mocking practice (patch where the name is looked up, not where it's defined) and matches the convention the existing integration tests use.

**Unit conftest constraint:** `tests/unit/conftest.py` MUST NOT `import app.main` or trigger any router-import chain. The full FastAPI app load is the slow path that integration tests need but unit tests must avoid. Import only `app.services.<X>` and `app.core.*` modules directly.

**`tests/unit/conftest.py` provides two shared fixtures:**

```python
import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_session(mocker):
    """Returns the *session* (not the driver) so tests can configure
    session.run.return_value.single.return_value as needed. The driver
    itself is patched onto app.core.clients.driver as a side effect."""
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    mocker.patch("app.core.clients.driver", driver)
    return session


@pytest.fixture
def mock_mongo_client(mocker):
    """Lightweight MongoDB client mock returning per-collection MagicMocks."""
    client = MagicMock()
    mocker.patch("app.core.clients.client", client)
    return client
```

For fixture loading, tests import `load_captured`/`load_seed` directly: `from tests.fixtures import load_captured`. No `captured` pytest-fixture indirection — the function is already module-level.

**Naming convention:** `test_<function_name>_<scenario>`. Each test file's module docstring lists which public functions are covered and which paths each test exercises.

**Async tests:** services include `async def` functions. Unit tests use `asyncio.run(my_service_function(...))` to invoke them. This is safe because unit tests have no running event loop and don't share state across calls. The pattern works on Python 3.10+ (`asyncio.run` creates and tears down a fresh loop per call). If async testing grows cumbersome — more than ~30% of tests need it, or a future fixture starts a loop — add `pytest-asyncio` in a follow-up commit.

### 3.3 TD-001 — Capture script

**Path:** `backend/tests/capture_fixtures.py`.

**Layer:** service-level (not HTTP). The script imports service helpers (`from app.services.market_research import Research_Market_1`) and invokes them with seed payloads. It does **not** make HTTP requests; the previous `--base-url` framing is replaced by `--llm-backend` and `--components` flags.

**Required env vars:** `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, `TAVILY_API_KEY`. Script reads from `os.environ` directly. Script aborts with a clear error if any required key is missing.

**Usage:**

```
python tests/capture_fixtures.py [--llm-backend {groq,claude,both}] \
                                 [--components <comma-list>] \
                                 [--output-dir tests/fixtures/captured/] \
                                 [--seed-dir tests/fixtures/seed/]
```

**Backend flag values:** `groq` = the Together.ai-hosted Llama path (the default `agent_chain` route in `llm_config`); `claude` = the Anthropic Claude Sonnet path via `_claude_messages_text`. The "groq" name follows the codebase convention even though no Groq model is actually used.

**Valid `--components` values** (capture script validates against this set, errors on unknown):
- For market_research: `market_size`, `industry_trends`, `competitor_landscape`, `regulatory_compliance`, `market_entry` (one per `Research_Market_1..5`)
- For icp_research: `icp_summary`, `icp_buyer_map`, `icp_competitive`, `icp_regulatory` (matching the 4 keys in `app.services.icp.ICP_FUNCTIONS`: "icp summary & market opportunity", "buyer map & roles, pain points, triggers", "competitive overlap & buying signals", "regulatory, compliance & recommended icp" → `icp_research_1..4`)
- For signals: `signals_scout`, `signals_profiler`
- For signal_ask: `signal_ask`
- Special: `all` (default if `--components` omitted), or any comma-list.

**Captures produced:**

| Source helper | Inputs | Output filename pattern |
|---|---|---|
| `Research_Market_1..5(seed)` | `seed/company_profile.json` | `market_research_<component>_groq.json` |
| `lambda d: Research_Market_<n>(d, "claude")` | same | `market_research_<component>_claude.json` |
| `icp_research_<n>(seed, llm_backend)` (4 components × 2 backends) | `seed/company_profile.json` + `seed/icp_card.json` | `icp_research_<component>_<backend>.json` |
| `search_signals(seed, "scout", llm_backend)` and `search_signals(seed, "profiler", llm_backend)` (×2 backends each) | `seed/company_profile.json` + `seed/leads_sample.json` | `search_signals_<agent>_<backend>.json` (4 files: scout/profiler × groq/claude) |
| `agent_chain.invoke({"input": prompt})` (signal_ask Groq path) | hand-built prompt | `signal_ask_groq.json` |
| `_claude_messages_text(prompt)` (signal_ask Claude path) | same prompt | `signal_ask_claude.json` |

**Re-capture triggers (documented in script header):**
- Prompt template edited (any `_SCOUT_PROMPT_TEMPLATE`, `_PROFILER_PROMPT_TEMPLATE`, `Research_Market_<n>` template change)
- LLM model swapped (`claude_sonnet_model` or `together_model` bumped in `app/core/config.py`)
- Schema change in `app/models/<domain>.py` that affects LLM response shape
- "Fixtures lied" incident — production diverged from what tests asserted

**Output format:** plain JSON files, no metadata header. The captured dict gets written via `json.dump(obj, file, indent=2, default=str)`. The `default=str` handles `datetime` objects (timestamps in some responses).

### 3.4 Fixture helpers — `tests/fixtures/__init__.py`

```python
"""Test fixture loaders. captured/ = TD-001 LLM outputs; seed/ = capture inputs."""
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent
CAPTURED_DIR = FIXTURES_DIR / "captured"
SEED_DIR = FIXTURES_DIR / "seed"


def load_captured(name: str) -> dict:
    """Load a captured LLM fixture by stem name (e.g. 'market_research_market_size_groq')."""
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((CAPTURED_DIR / f"{stem}.json").read_text())


def load_seed(name: str) -> dict:
    """Load a seed payload by stem name (e.g. 'company_profile')."""
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((SEED_DIR / f"{stem}.json").read_text())
```

### 3.5 Integration test rewire

The current integration tests for the 4 LLM-driven endpoints already mock the LLM call. They use hand-crafted dicts as the mock return value. Rewire replaces those hand-crafted dicts with `load_captured(...)` calls. The mock setup pattern stays identical:

```python
# Before:
mock_chain = mocker.patch("app.services.signals.llm_config.agent_chain")
mock_chain.invoke.return_value = {"output": "hand-crafted answer"}

# After:
mock_chain = mocker.patch("app.services.signals.llm_config.agent_chain")
mock_chain.invoke.return_value = load_captured("signal_ask_groq")
```

**Snapshot scope:** of the rewire targets, only `test_icp.py` uses syrupy snapshots (verified — `tests/__snapshots__/` contains `test_auth_org.ambr`, `test_icp.ambr`, `test_profiles.ambr`). `test_market_research.py` and `test_signals.py` use plain assertions, so the rewire there is purely a mock-return-value swap. For `test_icp.py`, snapshots get re-baselined with `pytest --snapshot-update` and committed in the same commit.

**Syrupy dependency note:** syrupy is used by three integration test files but is **not** declared in `backend/requirements.txt` (works today via implicit install). Adding it to the manifest is a Phase F+ housekeeping item; Phase E doesn't take it on.

---

## 4. Execution plan

The rollout mirrors Phase D's per-service cadence — one commit per service for the unit test files, bookended by infrastructure and cleanup commits.

| # | Commit | What lands |
|---|---|---|
| 1 | `feat(tests): add fixtures infrastructure and seed payloads` | `tests/fixtures/__init__.py`, `tests/fixtures/seed/*.json`, `tests/unit/conftest.py`, `tests/unit/__init__.py`. No new tests yet; existing 93 still pass. |
| 2 | `feat(tests): add capture_fixtures.py and produce captured fixtures` | `tests/capture_fixtures.py` + all ~24 files in `tests/fixtures/captured/` (10 market_research + ~8 icp_research + 4 search_signals + 2 signal_ask). Developer runs the script locally with real keys, commits the JSON outputs. Existing 93 still pass. |
| 3 | `test(be): add unit tests for org_auth (smallest)` | `tests/unit/test_org_auth.py`. ~10-12 tests. |
| 4 | `test(be): add unit tests for profiles` | `tests/unit/test_profiles.py`. ~8-10 tests. |
| 5 | `test(be): add unit tests for customer_profile` | `tests/unit/test_customer_profile.py`. ~12-15 tests, includes the ICPAlreadyExistsError 409 test. |
| 6 | `test(be): add unit tests for documents` | `tests/unit/test_documents.py`. ~18-22 tests, includes `process_file_to_embeddings` BrewraError catch test. |
| 7 | `test(be): add unit tests for market_research` | `tests/unit/test_market_research.py`. ~10-12 tests, uses captured fixtures. |
| 8 | `test(be): add unit tests for icp` | `tests/unit/test_icp.py`. ~12-15 tests, includes preserved-`ICPIdRegistryError` test. |
| 9 | `test(be): add unit tests for leads` | `tests/unit/test_leads.py`. ~16-20 tests, includes post-`raise_on_error` propagation test. |
| 10 | `test(be): add unit tests for market_scoring` | `tests/unit/test_market_scoring.py`. ~10-13 tests, includes `_run_market_scoring_for_org` BrewraError catch test. |
| 11 | `test(be): add unit tests for signals` | `tests/unit/test_signals.py`. ~14-18 tests, includes ServiceError paths (signal-delete race, ANTHROPIC_API_KEY guard, Claude API failure). |
| 12 | `test(be): rewire integration tests to use captured fixtures` | Replace hand-crafted dicts with `load_captured(...)` in `test_market_research.py`, `test_icp.py`, `test_signals.py`. Re-baseline `test_icp.ambr` only (the other two files use plain assertions, not snapshots — see §3.5). |
| 13 | `chore(docs): close TD-001 and TD-002 in TECH_DEBT.md` | Add "Resolved 2026-05-22 by Phase E (`refactor-backend-modularization-phase-e`)" line to both entries. |

**Migration order rationale:** smallest services first (`org_auth`, `profiles`) to validate the unit-test pattern; LLM-using services after captured fixtures land (commit 2 must precede commits 7, 8, 11, **and 12** — the integration rewire also consumes `load_captured(...)`); the rewire (commit 12) needs both captured fixtures and the unit test layer in place because some integration tests will be replaced by unit tests where appropriate.

**Estimated total:** 13 commits.

---

## 5. Worked examples

### 5.1 CRUD service — `test_create_lead_happy_path`

```python
# backend/tests/unit/test_leads.py

import asyncio
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import LeadCSVValidationError, LeadNotFoundError
from app.models.leads import LeadCreateRequest, LeadUpdateRequest
from app.services.leads import (
    create_lead, update_lead, delete_lead, get_leads_for_org, batch_upload_leads
)
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_LEAD_ID_1


def test_create_lead_happy_path(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"name": "Acme Co"}
    )
    result = create_lead(request)
    assert result["status"] == "success"
    assert "lead_id" in result
    assert mock_session.execute_write.called


def test_update_lead_raises_lead_not_found(mock_session):
    mock_session.run.return_value.single.return_value = None  # lead does not exist
    request = LeadUpdateRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"stage": "X"})
    with pytest.raises(LeadNotFoundError, match="Lead not found or access denied"):
        update_lead(TEST_LEAD_ID_1, request)


def test_get_leads_for_org_propagates_neo4j_error(mock_session):
    """Post-Task-14: get_leads_for_org no longer has raise_on_error; Neo4j errors propagate."""
    mock_session.run.side_effect = RuntimeError("connection refused")
    with pytest.raises(RuntimeError, match="connection refused"):
        get_leads_for_org(TEST_ORG_ID, limit=10)


def test_batch_upload_leads_raises_on_empty_csv(mock_session, mock_mongo_client):
    empty_csv = b"col1,col2\n"  # header only
    with pytest.raises(LeadCSVValidationError, match="CSV file is empty"):
        batch_upload_leads(empty_csv, "empty.csv", TEST_USER_ID, TEST_ORG_ID)
```

### 5.2 LLM-using service — `test_run_market_research_uses_captured`

```python
# backend/tests/unit/test_market_research.py

import asyncio
import pytest

from app.core.exceptions import CompanyProfileNotFoundError, UnsupportedComponentError
from app.models.market_research import MarketRequest
from app.services.market_research import run_market_research
from tests.fixtures import load_captured, load_seed
from tests.identities import TEST_USER_ID, TEST_ORG_ID


def test_run_market_research_groq_happy_path(mocker, mock_session, mock_mongo_client):
    captured = load_captured("market_research_market_size_groq")
    mocker.patch("app.services.market_research.Research_Market_1", return_value=captured)
    # Mock Neo4j returns a company profile record
    record = mocker.MagicMock()
    record.values.return_value = [load_seed("company_profile")]
    mock_session.run.return_value.single.return_value = record

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data=None, refresh=True
    )
    result = asyncio.run(run_market_research(request, llm_backend="groq"))

    assert result["status"] == "success"
    assert result["data"]["component_name"] == "market size & opportunity"
    assert result["data"]["user_id"] == TEST_USER_ID


def test_run_market_research_raises_on_unsupported_component():
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="not a real component", data=None, refresh=True
    )
    with pytest.raises(UnsupportedComponentError, match="Unsupported component_name"):
        asyncio.run(run_market_research(request))


def test_run_market_research_raises_when_no_company_profile(mock_session, mock_mongo_client):
    mock_session.run.return_value.single.return_value = None  # no profile in Neo4j
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data=None, refresh=True
    )
    with pytest.raises(CompanyProfileNotFoundError, match="No company profile found"):
        asyncio.run(run_market_research(request))
```

### 5.3 Background task — `test_run_market_scoring_for_org_marks_failed`

```python
# backend/tests/unit/test_market_scoring.py

from app.core.exceptions import BrewraError
from app.services.market_scoring import _run_market_scoring_for_org


def test_run_market_scoring_for_org_marks_failed_on_brewra_error(mocker, mock_mongo_client):
    """Task 15 coverage gap: assert run-doc status flips to 'failed' on BrewraError."""
    # Make get_leads_for_org raise BrewraError
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        side_effect=BrewraError("storage hiccup")
    )

    # Spy on the run-doc collection's update_one
    run_coll = mocker.MagicMock()
    score_coll = mocker.MagicMock()
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll)
    )

    _run_market_scoring_for_org(user_id="u1", org_id="o1", run_id="r1")

    # Find the failure update among run_coll.update_one calls
    update_calls = run_coll.update_one.call_args_list
    failed_status_calls = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "failed"
    ]
    assert len(failed_status_calls) >= 1, "Expected at least one 'status: failed' update"
    assert "storage hiccup" in str(failed_status_calls[-1])
```

---

## 6. Acceptance criteria

### Hard (greppable / observable)

- `pytest tests/unit/` runs and passes with all ~110-130 new tests green.
- `pytest tests/unit/` completes in under 2 seconds wall-clock.
- `pytest tests/` (full suite) passes — 93 existing + ~110-130 new = ~210+ tests, no regressions.
- `tests/fixtures/captured/` exists with at least 24 JSON files (10 market_research + ~8 icp_research + 4 search_signals + 2 signal_ask).
- `tests/fixtures/seed/` exists with `company_profile.json`, `icp_card.json`, `leads_sample.json`.
- `tests/capture_fixtures.py` exists and has a module-level docstring documenting the re-capture triggers.
- Every public function in `app/services/{customer_profile,documents,icp,leads,market_research,market_scoring,org_auth,profiles,signals}.py` has at least one unit test referencing it by name.
- Every typed-exception leaf class defined in `app/core/exceptions.py` (the 20 Phase D leaves + ServiceError + the 2 retained classes) is asserted in at least one `pytest.raises(...)` call somewhere in `tests/unit/`.
- `docs/TECH_DEBT.md` shows TD-001 and TD-002 with a "Resolved YYYY-MM-DD by Phase E" line.

### Soft (manual)

- A developer can run `pytest tests/unit/test_leads.py -v` and see all leads unit tests in under 500ms.
- Re-running `capture_fixtures.py` produces stable JSON files (modulo LLM nondeterminism on the content — keys and structure stay consistent).
- The rewired integration tests still pass with their re-baselined syrupy snapshots.
- The integration-test rewire (commit 12) reduces test-file LOC where hand-crafted dicts collapse to single `load_captured(...)` lines.

---

## 7. Architectural rationale

**Why a separate `tests/unit/` directory instead of mixing into existing files?**

Three reasons:

1. **Speed signal.** A flat `pytest tests/unit/` should run in under two seconds — a dev-loop pace. Mixing unit and integration tests in the same file forces every dev-loop run through the slower integration setup. A directory boundary gives developers a tight feedback path; CI runs everything.

2. **Mock layering clarity.** Integration tests bring up the full FastAPI app via `TestClient` (slow, monkey-patches `app.main`). Unit tests stand up a service function with two MagicMock fixtures. Same patch points (`app.core.clients.*`), different scaffolding. Keeping them in separate files keeps the scaffolding boundary visible.

3. **Discoverability for the codebase pattern.** A future contributor lands on `tests/unit/test_leads.py` and immediately knows the file's scope from the docstring. Mixed files require classes or naming conventions to communicate the same thing.

**Why captured fixtures at the service layer, not the HTTP layer?**

The integration tests already mock the LLM at the service layer (`agent_chain` patched in `app.services.market_research`, etc.). For captures to drop in as replacements for hand-crafted dicts, they must be at the same layer. HTTP-layer captures document response shape but cannot serve as mock return values — the mock fires before HTTP, so it needs intermediate output.

**Why one capture script run produces all fixtures?**

LLM API costs and Tavily API calls are non-trivial. A single script run with `--llm-backend both` exercises every helper once and writes ~24 JSON files. Re-running on a per-endpoint basis is supported via `--components`, but the default mode captures everything.

**Why no testcontainers / real DBs?**

Mock-based tests at MVP velocity are cheaper to write, faster to run, and reliable enough that the next bug-class to chase is "service logic is wrong" not "the mock diverged from real DB behavior." When the latter becomes a real-world incident (a "fixtures lied" event), Phase F+ can add testcontainers selectively. Today the cost/benefit favors mocks.

---

## 8. Phase F+ Inventory (carry-forward)

Phase E consumes TD-001 + TD-002. The other Phase E candidates from Phase D §8 carry forward:

1. **Dependency injection.** Replace module-level singletons with injected deps. Architectural, ~2-3 sub-phases.
2. **Security hardening.** Cypher parameterization, `/leads` LIMIT, CORS off `*`, raw Cypher endpoint guard.
3. **Pagination convention.** Project-wide.
4. **B4 small-pattern dedup audit.** JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.
5. **Startup → FastAPI `lifespan`** (TD-003). Small, isolated.
6. **`create_index`-on-hot-path audit** (Phase C N3 / Q4).

Plus the Phase F+ items previously listed:
- Anthropic SDK migration.
- `tiktoken` for budget estimation.
- Redis-backed Claude budget.
- Inline prompts → `app/prompts/`.
- Shared `memory` audit.

**New items surfaced during Phase E (to revisit when Phase E ships):**
- Captured-fixture refresh policy — if the LLM provider/model swap becomes routine, a CI step that re-captures + diffs may be worth adding.
- Direct tests for underscore-prefixed helpers (`_claude_budget` reservation logic is non-trivial and worth unit-testing if it grows).
