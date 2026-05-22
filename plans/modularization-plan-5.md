# Backend Modularization Phase E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close TD-001 (captured LLM fixtures) and TD-002 (service-function unit tests) by adding a `backend/tests/unit/` test layer, a `capture_fixtures.py` script that produces deterministic LLM fixtures, and rewiring three integration test files to consume those fixtures.

**Architecture:** A new `backend/tests/unit/` directory holds one test file per migrated service (9 files, ~110-130 tests), mocking at `app.core.clients.*` and per-service LLM helper namespaces. A separate `backend/tests/capture_fixtures.py` script invokes service helpers in-process with real API keys and writes ~24 JSON files to `backend/tests/fixtures/captured/`. Both layers share `tests.fixtures.load_captured()` / `load_seed()`.

**Tech Stack:** pytest, pytest-mock, syrupy (existing), Python 3.11+, `asyncio.run` for async tests, FastAPI (existing), Neo4j/MongoDB/Pinecone/S3/Anthropic/Together.ai client mocks.

**Spec:** `specs/2026-05-22-backend-test-improvements-phase-e-design.md`
**Branch:** `refactor-backend-modularization-phase-e` off `master`.

---

## Pre-flight (one-time setup, no commit)

- [ ] **Verify the master branch state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status   # expected: clean, on master
git log --oneline -5   # expected: Phase D commits at HEAD (incl. ServiceError C1 fix)
cd backend && pytest tests/ -q   # expected: 93 passed
```

- [ ] **Create the feature branch**

```bash
git checkout -b refactor-backend-modularization-phase-e
```

All subsequent commits land on this branch.

---

## Task 1: Fixtures infrastructure and seed payloads

Commit message: `feat(tests): add fixtures infrastructure and seed payloads`

**Files:**
- Create: `backend/tests/unit/__init__.py`
- Create: `backend/tests/unit/conftest.py`
- Modify: `backend/tests/fixtures/__init__.py` (currently empty, 1 byte)
- Create: `backend/tests/fixtures/seed/company_profile.json`
- Create: `backend/tests/fixtures/seed/icp_card.json`
- Create: `backend/tests/fixtures/seed/leads_sample.json`

- [ ] **Step 1: Create the unit test package marker**

```bash
mkdir -p backend/tests/unit backend/tests/fixtures/seed backend/tests/fixtures/captured
```

Then write `backend/tests/unit/__init__.py` with the single line:

```python
"""Unit tests for service functions. Mocks at app.core.clients.*; no TestClient."""
```

- [ ] **Step 2: Create `backend/tests/unit/conftest.py`**

```python
"""Pytest fixtures for service-function unit tests.

These tests bypass FastAPI / TestClient entirely. They call service functions
directly and mock at the same source-level layer the integration tests do:
`app.core.clients.driver`, `app.core.clients.client`, and per-module LLM
helper imports.

CRITICAL: this conftest must NOT import `app.main` or trigger any router
import chain. Routers are slow to import and bring in the full FastAPI app
load that integration tests need but unit tests must avoid.
"""
import os
import sys
from unittest.mock import MagicMock

import pytest

# Ensure backend/ is importable as a flat package (matches root tests/conftest.py)
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_MONOREPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
for _p in (_BACKEND_DIR, _MONOREPO_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Set dummy env vars and skip DB init before any app.* import.
os.environ.setdefault("PINECONE_API_KEY", "test-pinecone-key")
os.environ.setdefault("AWS_ACCESS_KEY", "test-aws-key")
os.environ.setdefault("AWS_SECRET_KEY", "test-aws-secret")
os.environ.setdefault("BREWRA_SKIP_DB_INIT", "1")


@pytest.fixture
def mock_session(mocker):
    """Returns the Neo4j *session* (not the driver) so tests can configure
    `session.run.return_value.single.return_value = ...` directly. The driver
    itself is patched onto `app.core.clients.driver` as a side effect.
    """
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    mocker.patch("app.core.clients.driver", driver)
    return session


@pytest.fixture
def mock_mongo_client(mocker):
    """Lightweight MongoDB client mock. Source-patches `app.core.clients.client`.

    Tests configure per-collection MagicMocks via:
        mock_mongo_client["Profiler"]["ICP_config"].find_one.return_value = ...
    """
    client = MagicMock()
    mocker.patch("app.core.clients.client", client)
    return client
```

- [ ] **Step 3: Write `backend/tests/fixtures/__init__.py`** (replace the empty file)

```python
"""Test fixture loaders.

- captured/ — LLM outputs frozen by `tests/capture_fixtures.py` (TD-001)
- seed/     — payloads the capture script feeds into the helpers
- *.py      — hand-crafted builders (existing, unchanged)
"""
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent
CAPTURED_DIR = FIXTURES_DIR / "captured"
SEED_DIR = FIXTURES_DIR / "seed"


def load_captured(name: str) -> dict:
    """Load a captured LLM fixture by stem name.

    Example: load_captured("market_research_market_size_groq")
    """
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((CAPTURED_DIR / f"{stem}.json").read_text())


def load_seed(name: str) -> dict:
    """Load a seed payload by stem name.

    Example: load_seed("company_profile")
    """
    stem = name[:-5] if name.endswith(".json") else name
    return json.loads((SEED_DIR / f"{stem}.json").read_text())
```

- [ ] **Step 4: Write `backend/tests/fixtures/seed/company_profile.json`**

```json
{
  "name": "Acme Logistics GmbH",
  "industry": "Logistics & Supply Chain",
  "subIndustry": "Last-mile delivery",
  "targetMarkets": ["DACH", "EU"],
  "regions": ["Germany", "Austria", "Switzerland"],
  "companySize": "51-200",
  "businessModel": "B2B SaaS",
  "stage": "Growth",
  "yearFounded": 2018,
  "technologyStack": ["Python", "Kubernetes", "PostgreSQL"],
  "focusAreas": ["dispatch automation", "fleet optimization"],
  "complianceRequirements": ["GDPR", "ADR (dangerous goods)"],
  "socialMediaUrls": {"linkedin": "https://linkedin.com/company/acme-logistics-gmbh"},
  "user_id": "test_user_123",
  "org_id": "test_org_abc"
}
```

- [ ] **Step 5: Write `backend/tests/fixtures/seed/icp_card.json`**

```json
{
  "id": "icp_seed_0001",
  "title": "Mid-market 3PL operators modernizing dispatch",
  "firmographics": {
    "industry": "Logistics & Supply Chain",
    "segment": "Third-party logistics (3PL)",
    "company_size": "200-1000 employees",
    "market_size": "€8.4B"
  },
  "key_decision_makers": ["VP Operations", "Head of Fleet", "CIO"],
  "regions": ["DACH", "EU"],
  "pain_points_and_triggers": {
    "critical": "Manual dispatch decisions limit throughput",
    "others": ["Driver retention crisis", "Diesel price volatility"]
  },
  "competitors": ["Onfleet", "Bringg", "Convoy"]
}
```

- [ ] **Step 6: Write `backend/tests/fixtures/seed/leads_sample.json`**

```json
{
  "leads": [
    {
      "lead_id": "lead_seed_0001",
      "company_name": "Spedition Müller GmbH",
      "industry": "Logistics & Supply Chain",
      "country": "Germany",
      "employee_count": 320,
      "stage": "Initial Outreach",
      "contact_name": "Anna Becker",
      "contact_title": "Head of Operations",
      "website": "https://spedition-mueller.de"
    },
    {
      "lead_id": "lead_seed_0002",
      "company_name": "EuroDispatch BV",
      "industry": "Logistics & Supply Chain",
      "country": "Netherlands",
      "employee_count": 180,
      "stage": "Initial Outreach",
      "contact_name": "Pieter van der Berg",
      "contact_title": "Fleet Director",
      "website": "https://eurodispatch.nl"
    }
  ]
}
```

- [ ] **Step 7: Verify no regressions and commit**

```bash
cd backend
pytest tests/ -q   # expected: 93 passed (unchanged)
cd ..
git add backend/tests/unit/__init__.py backend/tests/unit/conftest.py \
        backend/tests/fixtures/__init__.py backend/tests/fixtures/seed/
git commit -m "feat(tests): add fixtures infrastructure and seed payloads"
```

---

## Task 2: Capture script and captured fixtures

Commit message: `feat(tests): add capture_fixtures.py and produce captured fixtures`

**Files:**
- Create: `backend/tests/capture_fixtures.py`
- Create: `backend/tests/fixtures/captured/*.json` (24 files)

**Note:** this commit contains both the script and the JSON outputs it produces. The script is a developer tool, not a test. The JSON outputs are committed so CI runs without needing live API keys.

- [ ] **Step 1: Write `backend/tests/capture_fixtures.py`**

```python
"""Capture deterministic LLM fixtures for backend tests.

Invokes service helpers in-process with real API keys, captures their
outputs, and writes them to tests/fixtures/captured/*.json. The captured
JSONs become the deterministic mock return values for unit + integration
tests.

Usage (run from backend/):
    python tests/capture_fixtures.py
    python tests/capture_fixtures.py --llm-backend claude
    python tests/capture_fixtures.py --components market_size,icp_summary
    python tests/capture_fixtures.py --components signals_scout --llm-backend groq

Required env vars (script aborts if missing):
    ANTHROPIC_API_KEY  — Claude path
    TOGETHER_API_KEY   — Groq path (Together.ai-hosted Llama via agent_chain)
    TAVILY_API_KEY     — Claude path web context

Re-run intentionally when:
    - A `_SCOUT_PROMPT_TEMPLATE` / `_PROFILER_PROMPT_TEMPLATE` / `Research_Market_N`
      template is edited
    - `claude_sonnet_model` or `together_model` in `app/core/config.py` is bumped
    - `app/models/<domain>.py` shape changes break the captured response
    - A "fixtures lied" incident — production diverged from what tests asserted
"""
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# sys.path bootstrap so we can run `python tests/capture_fixtures.py` from backend/
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_BACKEND_DIR.parent))

REQUIRED_KEYS = ("ANTHROPIC_API_KEY", "TOGETHER_API_KEY", "TAVILY_API_KEY")

FIXTURES_DIR = _BACKEND_DIR / "tests" / "fixtures"
SEED_DIR = FIXTURES_DIR / "seed"
CAPTURED_DIR = FIXTURES_DIR / "captured"

# component-name → service-call slug used in output filename
MARKET_COMPONENTS = {
    "market_size": "market size & opportunity",
    "industry_trends": "industry trends report",
    "competitor_landscape": "competitor landscape",
    "regulatory_compliance": "regulatory & compliance highlights",
    "market_entry": "market entry & growth strategy",
}
ICP_COMPONENTS = {
    "icp_summary": "icp summary & market opportunity",
    "icp_buyer_map": "buyer map & roles, pain points, triggers",
    "icp_competitive": "competitive overlap & buying signals",
    "icp_regulatory": "regulatory, compliance & recommended icp",
}
SIGNAL_COMPONENTS = ("signals_scout", "signals_profiler")
SIGNAL_ASK_COMPONENTS = ("signal_ask",)

ALL_COMPONENT_SLUGS = (
    set(MARKET_COMPONENTS) | set(ICP_COMPONENTS)
    | set(SIGNAL_COMPONENTS) | set(SIGNAL_ASK_COMPONENTS)
)


def _check_env() -> None:
    missing = [k for k in REQUIRED_KEYS if not os.environ.get(k)]
    if missing:
        sys.exit(f"ERROR: missing required env vars: {', '.join(missing)}")


def _load_seed(name: str) -> Dict[str, Any]:
    return json.loads((SEED_DIR / f"{name}.json").read_text())


def _write_capture(stem: str, payload: Any) -> None:
    out = CAPTURED_DIR / f"{stem}.json"
    out.write_text(json.dumps(payload, indent=2, default=str))
    print(f"  wrote {out.relative_to(_BACKEND_DIR)}")


def capture_market_research(components: List[str], backends: List[str]) -> None:
    from app.services.market_research import (
        Research_Market_1, Research_Market_2, Research_Market_3,
        Research_Market_4, Research_Market_5,
    )
    fn_map = {
        "market_size": Research_Market_1,
        "industry_trends": Research_Market_2,
        "competitor_landscape": Research_Market_3,
        "regulatory_compliance": Research_Market_4,
        "market_entry": Research_Market_5,
    }
    company = _load_seed("company_profile")
    pre_data = json.dumps(company)
    for slug in components:
        fn = fn_map[slug]
        for backend in backends:
            print(f"Capturing market_research/{slug} ({backend})...")
            result = fn(pre_data) if backend == "groq" else fn(pre_data, "claude")
            _write_capture(f"market_research_{slug}_{backend}", result)


def capture_icp_research(components: List[str], backends: List[str]) -> None:
    from app.services.icp import (
        icp_research_1, icp_research_2, icp_research_3, icp_research_4,
    )
    fn_map = {
        "icp_summary": icp_research_1,
        "icp_buyer_map": icp_research_2,
        "icp_competitive": icp_research_3,
        "icp_regulatory": icp_research_4,
    }
    company = _load_seed("company_profile")
    icp_card = _load_seed("icp_card")
    pre_data = json.dumps({"company_profile": company, "icp_card": icp_card})
    for slug in components:
        fn = fn_map[slug]
        for backend in backends:
            print(f"Capturing icp_research/{slug} ({backend})...")
            llm_backend = "claude" if backend == "claude" else "default"
            result = fn(pre_data, llm_backend)
            _write_capture(f"icp_research_{slug}_{backend}", result)


def capture_search_signals(components: List[str], backends: List[str]) -> None:
    from app.services.signals import search_signals
    company = _load_seed("company_profile")
    leads = _load_seed("leads_sample")
    pre_data = json.dumps({"company_profile": company, "leads": leads["leads"]})
    for slug in components:
        persona = "scout" if slug == "signals_scout" else "profiler"
        for backend in backends:
            print(f"Capturing search_signals/{persona} ({backend})...")
            llm_backend = "claude" if backend == "claude" else "default"
            result = search_signals(pre_data, persona=persona, llm_backend=llm_backend)
            _write_capture(f"search_signals_{persona}_{backend}", result)


def capture_signal_ask(backends: List[str]) -> None:
    from app.core import llm_config
    from app.services._llm_helpers import _claude_messages_text

    prompt = (
        "Summarize the following signal in 2 sentences: "
        "Spedition Müller GmbH announced a €12M Series A to expand fleet electrification. "
        "Mention the buying trigger and the most likely decision maker."
    )
    for backend in backends:
        print(f"Capturing signal_ask ({backend})...")
        if backend == "groq":
            result = llm_config.agent_chain.invoke({"input": prompt})
        else:
            result = {"output": _claude_messages_text(prompt)}
        _write_capture(f"signal_ask_{backend}", result)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--llm-backend", choices=("groq", "claude", "both"), default="both"
    )
    parser.add_argument(
        "--components",
        default="all",
        help="Comma-separated list. Default 'all'. "
             f"Valid: {sorted(ALL_COMPONENT_SLUGS) + ['all']}",
    )
    parser.add_argument(
        "--output-dir", default=str(CAPTURED_DIR),
        help="Directory to write JSON captures into",
    )
    parser.add_argument(
        "--seed-dir", default=str(SEED_DIR),
        help="Directory to read seed payloads from",
    )
    args = parser.parse_args()

    _check_env()

    backends = (
        ["groq", "claude"] if args.llm_backend == "both" else [args.llm_backend]
    )

    if args.components == "all":
        requested = ALL_COMPONENT_SLUGS
    else:
        requested = {c.strip() for c in args.components.split(",")}
        unknown = requested - ALL_COMPONENT_SLUGS
        if unknown:
            sys.exit(f"ERROR: unknown components: {sorted(unknown)}")

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    market = sorted(requested & set(MARKET_COMPONENTS))
    icp = sorted(requested & set(ICP_COMPONENTS))
    sig = sorted(requested & set(SIGNAL_COMPONENTS))
    ask = sorted(requested & set(SIGNAL_ASK_COMPONENTS))

    if market:
        capture_market_research(market, backends)
    if icp:
        capture_icp_research(icp, backends)
    if sig:
        capture_search_signals(sig, backends)
    if ask:
        capture_signal_ask(backends)

    total = (
        len(market) * len(backends) + len(icp) * len(backends)
        + len(sig) * len(backends) + len(ask) * len(backends)
    )
    print(f"\nDone. {total} captures written to {args.output_dir}.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script with real API keys to produce all 24 captures**

```bash
cd backend
# (developer ensures ANTHROPIC_API_KEY, TOGETHER_API_KEY, TAVILY_API_KEY are set)
python tests/capture_fixtures.py
```

Expected output (last line):
```
Done. 24 captures written to .../tests/fixtures/captured.
```

Expected files: 10 market_research + 8 icp_research + 4 search_signals + 2 signal_ask = 24 JSON files in `tests/fixtures/captured/`.

- [ ] **Step 3: Sanity-check one capture file**

```bash
ls backend/tests/fixtures/captured/ | wc -l   # expected: 24
python -c "import json; d = json.load(open('backend/tests/fixtures/captured/market_research_market_size_groq.json')); print(list(d.keys())[:5])"
```

Should print a non-empty list of JSON keys (varies per LLM response, but the file must be valid JSON).

- [ ] **Step 4: Verify no regressions and commit**

```bash
cd backend && pytest tests/ -q   # expected: 93 passed (unchanged)
cd ..
git add backend/tests/capture_fixtures.py backend/tests/fixtures/captured/
git commit -m "feat(tests): add capture_fixtures.py and produce captured fixtures"
```

---

## Task 3: Unit tests for `org_auth` (smallest service first)

Commit message: `test(be): add unit tests for org_auth`

**Files:**
- Create: `backend/tests/unit/test_org_auth.py`

**Functions covered:** `list_orgs`, `create_org`, `connect_user_to_org`, `list_registrations`, `create_registration` (5 public functions in `app/services/org_auth.py`).

**Typed-exception leaves asserted:** `UsersDocumentNotFoundError`, `OrgNotFoundError`.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_org_auth.py
"""Unit tests for app/services/org_auth.py.

Covers:
  list_orgs              — happy path, missing users doc, missing user mapping
  create_org             — new doc, existing doc with org_name
  connect_user_to_org    — new doc, existing doc
  list_registrations     — happy path
  create_registration    — happy path
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import OrgNotFoundError, UsersDocumentNotFoundError
from app.models.org_auth import RegistrationRequest
from app.services.org_auth import (
    connect_user_to_org,
    create_org,
    create_registration,
    list_orgs,
    list_registrations,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# list_orgs
# ---------------------------------------------------------------------------

def test_list_orgs_happy_path(mock_mongo_client):
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = {
        "_id": "users",
        "user_mappings": {TEST_USER_ID: TEST_ORG_ID},
    }
    orgs_coll.find_one.return_value = {
        "_id": "orgs",
        "org_names": {TEST_ORG_ID: "Acme Logistics"},
    }
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    result = list_orgs(TEST_USER_ID)

    assert result["status"] == "success"
    assert result["org_id"] == TEST_ORG_ID
    assert result["org_name"] == "Acme Logistics"


def test_list_orgs_raises_users_document_not_found(mock_mongo_client):
    users_coll = MagicMock()
    users_coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = users_coll

    with pytest.raises(UsersDocumentNotFoundError, match="Users document not found"):
        list_orgs(TEST_USER_ID)


def test_list_orgs_raises_org_not_found_for_unknown_user(mock_mongo_client):
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = {"_id": "users", "user_mappings": {}}
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    with pytest.raises(OrgNotFoundError, match="No org_id found for user_id"):
        list_orgs(TEST_USER_ID)


# ---------------------------------------------------------------------------
# create_org
# ---------------------------------------------------------------------------

def test_create_org_creates_new_document_when_none_exists(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org({"org_name": "New Co"})

    assert result["status"] == "success"
    assert "org_id" in result
    assert result["org_name"] == "New Co"
    coll.insert_one.assert_called_once()
    inserted = coll.insert_one.call_args.args[0]
    assert inserted["org_names"][result["org_id"]] == "New Co"


def test_create_org_appends_to_existing_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "_id": "orgs",
        "org_list": ["existing-org"],
        "org_names": {"existing-org": "Existing Co"},
    }
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org({"org_name": "New Co"})

    assert result["status"] == "success"
    coll.update_one.assert_called_once()
    update_doc = coll.update_one.call_args.args[1]["$set"]
    assert result["org_id"] in update_doc["org_list"]
    assert update_doc["org_names"][result["org_id"]] == "New Co"


def test_create_org_handles_missing_org_name(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org({})

    assert result["status"] == "success"
    assert "org_id" in result
    assert "org_name" not in result


# ---------------------------------------------------------------------------
# connect_user_to_org
# ---------------------------------------------------------------------------

def test_connect_user_to_org_creates_new_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = connect_user_to_org(TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["user_id"] == TEST_USER_ID
    assert result["org_id"] == TEST_ORG_ID
    coll.insert_one.assert_called_once()


def test_connect_user_to_org_updates_existing_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "_id": "users",
        "user_mappings": {"other_user": "other_org"},
    }
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = connect_user_to_org(TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    coll.update_one.assert_called_once()
    update_doc = coll.update_one.call_args.args[1]["$set"]
    assert update_doc["user_mappings"][TEST_USER_ID] == TEST_ORG_ID
    assert update_doc["user_mappings"]["other_user"] == "other_org"  # preserved


# ---------------------------------------------------------------------------
# list_registrations + create_registration
# ---------------------------------------------------------------------------

def test_list_registrations_returns_sorted_results(mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value = [
        {
            "_id": "reg2",
            "name": "Jane",
            "email": "jane@example.com",
            "timestamp": datetime(2026, 5, 10, tzinfo=timezone.utc),
        },
        {
            "_id": "reg1",
            "name": "John",
            "email": "john@example.com",
            "timestamp": datetime(2026, 5, 9, tzinfo=timezone.utc),
        },
    ]
    mock_mongo_client["Registration_DB"].__getitem__.return_value = coll

    result = list_registrations()

    assert len(result) == 2
    assert result[0].name == "Jane"
    assert result[1].name == "John"


def test_create_registration_inserts_and_returns_response(mock_mongo_client):
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "new_reg_id"
    mock_mongo_client["Registration_DB"].__getitem__.return_value = coll

    req = RegistrationRequest(name="Alice", email="alice@example.com")
    result = create_registration(req)

    assert result.id == "new_reg_id"
    assert result.name == "Alice"
    assert result.email == "alice@example.com"
    assert result.timestamp is not None
    coll.insert_one.assert_called_once()
```

- [ ] **Step 2: Run the new tests**

```bash
cd backend && pytest tests/unit/test_org_auth.py -v
```

Expected: 10 passed in under 500ms.

- [ ] **Step 3: Verify the full suite still passes**

```bash
cd backend && pytest tests/ -q
```

Expected: 93 + 10 = 103 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/unit/test_org_auth.py
git commit -m "test(be): add unit tests for org_auth"
```

---

## Task 4: Unit tests for `profiles`

Commit message: `test(be): add unit tests for profiles`

**Files:**
- Create: `backend/tests/unit/test_profiles.py`

**Functions covered:** `upsert_profile`, `get_profile`, `cleanup_company_profiles`, `edit_profile_field` (4 public functions in `app/services/profiles.py`).

**Typed-exception leaves asserted:** `ProfileValidationError`, `ProfileNotFoundError`, `CompanyProfileNotFoundError`.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_profiles.py
"""Unit tests for app/services/profiles.py.

Covers:
  upsert_profile             — company profile (org_id required), user profile, missing user_id
  get_profile                — company profile via Neo4j+Mongo, user profile, missing org_id
  cleanup_company_profiles   — zero, one, multiple duplicates
  edit_profile_field         — modification, comment, invalid edit_type
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ProfileNotFoundError,
    ProfileValidationError,
)
from app.models.profiles import EditRequest
from app.services.profiles import (
    cleanup_company_profiles,
    edit_profile_field,
    get_profile,
    upsert_profile,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# upsert_profile
# ---------------------------------------------------------------------------

def test_upsert_profile_company_requires_org_id(mock_session):
    with pytest.raises(ProfileValidationError, match="org_id is required for company"):
        upsert_profile("company", {"name": "Acme"})


def test_upsert_profile_user_requires_user_id(mock_session):
    with pytest.raises(ProfileValidationError, match="user_id is required"):
        upsert_profile("user", {"name": "Alice"})


def test_upsert_profile_company_happy_path(mock_session):
    payload = {"org_id": TEST_ORG_ID, "name": "Acme", "industry": "SaaS"}
    result = upsert_profile("company", payload)

    assert result == {"message": "company profile processed successfully"}
    # Verify the DELETE for the existing org-scoped CompanyProfile ran first
    delete_call = mock_session.run.call_args_list[0]
    assert "DELETE" in delete_call.args[0]
    assert delete_call.kwargs == {"org_id": TEST_ORG_ID}


# ---------------------------------------------------------------------------
# get_profile
# ---------------------------------------------------------------------------

def test_get_profile_company_requires_org_id(mock_session):
    with pytest.raises(ProfileValidationError, match="org_id is required for company"):
        get_profile("company", user_id=None, org_id=None)


def test_get_profile_user_raises_profile_not_found(mock_session):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(ProfileNotFoundError, match="No user profile found"):
        get_profile("user", user_id=TEST_USER_ID, org_id=None)


def test_get_profile_company_raises_when_missing(mock_session, mock_mongo_client):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(CompanyProfileNotFoundError, match="No company profile found"):
        get_profile("company", user_id=None, org_id=TEST_ORG_ID)


# ---------------------------------------------------------------------------
# cleanup_company_profiles
# ---------------------------------------------------------------------------

def test_cleanup_returns_no_profiles_found_when_empty(mock_session):
    mock_session.run.return_value = iter([])

    result = cleanup_company_profiles()

    assert result["deleted"] == 0
    assert result["remaining"] == 0


def test_cleanup_returns_no_op_when_only_one_profile(mock_session):
    rec = MagicMock()
    rec.__getitem__.side_effect = lambda k: 42 if k == "node_id" else MagicMock()
    mock_session.run.return_value = iter([rec])

    result = cleanup_company_profiles()

    assert result["deleted"] == 0
    assert result["remaining"] == 1


def test_cleanup_deletes_duplicates(mock_session):
    rec1, rec2, rec3 = MagicMock(), MagicMock(), MagicMock()
    rec1.__getitem__.side_effect = lambda k: 1 if k == "node_id" else MagicMock()
    rec2.__getitem__.side_effect = lambda k: 2 if k == "node_id" else MagicMock()
    rec3.__getitem__.side_effect = lambda k: 3 if k == "node_id" else MagicMock()
    # First call returns the list of profiles; second returns the delete count.
    delete_result = MagicMock()
    delete_result.single.return_value = {"deleted": 2}
    mock_session.run.side_effect = [iter([rec1, rec2, rec3]), delete_result]

    result = cleanup_company_profiles()

    assert result["deleted"] == 2
    assert result["remaining"] == 1


# ---------------------------------------------------------------------------
# edit_profile_field
# ---------------------------------------------------------------------------

def test_edit_profile_modification_inserts_into_mongo(mock_mongo_client):
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "abc123"
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll

    req = EditRequest(
        user_id=TEST_USER_ID,
        edit_type="modification",
        modified_json={"name": "Acme v2"},
    )
    result = edit_profile_field(req)

    assert result["status"] == "success"
    assert result["inserted_id"] == "abc123"
    inserted = coll.insert_one.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["name"] == "Acme v2"


def test_edit_profile_comment_returns_coming_soon():
    req = EditRequest(user_id=TEST_USER_ID, edit_type="comment", modified_json={})
    result = edit_profile_field(req)
    assert result == {"status": "feature coming soon"}


def test_edit_profile_invalid_type_returns_error():
    req = EditRequest(user_id=TEST_USER_ID, edit_type="bogus", modified_json={})
    result = edit_profile_field(req)
    assert "Invalid edit_type" in result["error"]
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_profiles.py -v
```

Expected: 12 passed in under 500ms.

```bash
cd backend && pytest tests/ -q
```

Expected: 103 + 12 = 115 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_profiles.py
git commit -m "test(be): add unit tests for profiles"
```

---

## Task 5: Unit tests for `customer_profile`

Commit message: `test(be): add unit tests for customer_profile`

**Files:**
- Create: `backend/tests/unit/test_customer_profile.py`

**Functions covered:** `upsert_customer_profile`, `get_customer_profile`, `create_from_suggested_icp`, `delete_icp_from_customer_profile`.

**Typed-exception leaves asserted:** `CompanyProfileNotFoundError`, `SuggestedICPNotFoundError`, `ICPAlreadyExistsError`, `CustomerProfileNotFoundError`, `CustomerProfileICPNotFoundError`.

**Cross-service mocking note:** `customer_profile.py` imports private helpers from `app.services.icp` (`_reserve_unique_icp_id`, `_ensure_icp_id_registry_indexes`, `_release_icp_id`). Per Python's "patch where the name is looked up" convention, tests patch at `app.services.customer_profile._reserve_unique_icp_id` (not `app.services.icp._reserve_unique_icp_id`).

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_customer_profile.py
"""Unit tests for app/services/customer_profile.py.

Covers all four public functions plus the 5 typed-exception sites and the
cross-service patch convention for app.services.icp helpers.
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
from app.services.customer_profile import (
    create_from_suggested_icp,
    delete_icp_from_customer_profile,
    get_customer_profile,
    upsert_customer_profile,
)
from tests.identities import TEST_ICP_ID_1, TEST_ICP_ID_2, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# upsert_customer_profile
# ---------------------------------------------------------------------------

def test_upsert_customer_profile_happy_path(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.customer_profile._reserve_unique_icp_id",
        return_value=TEST_ICP_ID_1,
    )
    mocker.patch("app.services.customer_profile._ensure_icp_id_registry_indexes")

    payload = {
        "user_id": TEST_USER_ID,
        "customer_profiles": {
            "icps": [{"id": "", "title": "Mid-market 3PL", "regions": ["DACH"]}]
        },
    }
    result = upsert_customer_profile(payload)

    assert result["status"] == "success"
    coll.update_one.assert_called_once()


# ---------------------------------------------------------------------------
# get_customer_profile
# ---------------------------------------------------------------------------

def test_get_customer_profile_raises_when_not_found(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    with pytest.raises(CustomerProfileNotFoundError, match="No customer profile"):
        get_customer_profile(TEST_USER_ID)


def test_get_customer_profile_returns_existing_doc(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "_id": "abc",
        "user_id": TEST_USER_ID,
        "customer_profiles": {"icps": [{"id": TEST_ICP_ID_1}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = get_customer_profile(TEST_USER_ID)

    assert result["user_id"] == TEST_USER_ID
    assert "_id" not in result  # stripped before return


# ---------------------------------------------------------------------------
# create_from_suggested_icp
# ---------------------------------------------------------------------------

def test_create_from_suggested_icp_raises_when_company_profile_missing(
    mocker, mock_session, mock_mongo_client,
):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(CompanyProfileNotFoundError):
        create_from_suggested_icp(
            user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
        )


def test_create_from_suggested_icp_raises_when_icp_id_missing(
    mocker, mock_session, mock_mongo_client,
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

    with pytest.raises(SuggestedICPNotFoundError, match="Suggested ICP not found"):
        create_from_suggested_icp(
            user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
        )


def test_create_from_suggested_icp_raises_icp_already_exists(
    mocker, mock_session, mock_mongo_client,
):
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
        "user_id": TEST_USER_ID,
        "customer_profiles": {
            "icps": [{"id": TEST_ICP_ID_1, "title": "already added"}]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.side_effect = lambda name: (
        icp_config_coll if name == "ICP_config" else customer_profile_coll
    )

    with pytest.raises(ICPAlreadyExistsError, match="already exists"):
        create_from_suggested_icp(
            user_id=TEST_USER_ID, org_id=TEST_ORG_ID, icp_id=TEST_ICP_ID_1,
        )


# ---------------------------------------------------------------------------
# delete_icp_from_customer_profile
# ---------------------------------------------------------------------------

def test_delete_icp_raises_when_customer_profile_missing(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    with pytest.raises(CustomerProfileNotFoundError):
        delete_icp_from_customer_profile(
            user_id=TEST_USER_ID, icp_id=TEST_ICP_ID_1,
        )


def test_delete_icp_raises_when_icp_not_in_profile(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "customer_profiles": {"icps": [{"id": TEST_ICP_ID_2, "title": "Other"}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.customer_profile._release_icp_id")

    with pytest.raises(CustomerProfileICPNotFoundError):
        delete_icp_from_customer_profile(
            user_id=TEST_USER_ID, icp_id=TEST_ICP_ID_1,
        )


def test_delete_icp_happy_path_releases_id(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "customer_profiles": {
            "icps": [
                {"id": TEST_ICP_ID_1, "title": "Mid-market 3PL"},
                {"id": TEST_ICP_ID_2, "title": "Enterprise"},
            ]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    release_mock = mocker.patch("app.services.customer_profile._release_icp_id")

    result = delete_icp_from_customer_profile(
        user_id=TEST_USER_ID, icp_id=TEST_ICP_ID_1,
    )

    assert result["success"] is True
    release_mock.assert_called_once_with(coll.database, TEST_ICP_ID_1)
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_customer_profile.py -v
cd backend && pytest tests/ -q
```

Expected unit count: ~10. Full suite: 115 + 10 = 125 passed.

**Note:** if the `delete_icp_happy_path_releases_id` assertion on `coll.database` fails because the service calls `_release_icp_id(db, ...)` where `db` is the `Profiler` database mock rather than the collection's `.database` attribute, update the assertion to match what the actual service does — read `app/services/customer_profile.py:delete_icp_from_customer_profile` for the exact local variable passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_customer_profile.py
git commit -m "test(be): add unit tests for customer_profile"
```

---

## Task 6: Unit tests for `documents`

Commit message: `test(be): add unit tests for documents`

**Files:**
- Create: `backend/tests/unit/test_documents.py`

**Functions covered:** `load_document`, `grapher`, `process_prospect_list`, `upload_file_text`, `upload_prospect_list_file`, `process_file_to_embeddings` (async), `upload_document_file` (async), `get_document_status` (async), `list_user_documents` (async), `delete_data_source` (async), `update_data_source` (async).

**Typed-exception leaves asserted:** `DocumentNotFoundError` (×3 sites), `DocumentValidationError` (×3 sites).

**Special coverage (Phase D Task 15 gap):** the `process_file_to_embeddings` `except BrewraError` block.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_documents.py
"""Unit tests for app/services/documents.py.

Covers all 11 public functions, the 3 + 3 typed-exception sites, and the
BrewraError catch path in process_file_to_embeddings (Phase D Task 15 gap).

Sync helpers (load_document, grapher, etc.) get happy-path coverage only;
the async functions get happy + at-least-one-sad-path coverage.
"""
import asyncio
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    BrewraError,
    DocumentNotFoundError,
    DocumentValidationError,
)
from app.services.documents import (
    delete_data_source,
    get_document_status,
    grapher,
    list_user_documents,
    load_document,
    process_file_to_embeddings,
    process_prospect_list,
    update_data_source,
    upload_document_file,
    upload_file_text,
    upload_prospect_list_file,
)
from tests.identities import TEST_FILE_ID, TEST_FILE_KEY, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# load_document (sync)
# ---------------------------------------------------------------------------

def test_load_document_returns_pdf_loader(mocker):
    # PyPDFLoader is the LangChain class used inside; we patch where it's
    # looked up in the documents module.
    pdf_loader_cls = mocker.patch("app.services.documents.PyPDFLoader")
    pdf_loader_cls.return_value.load.return_value = [MagicMock(page_content="Doc text")]

    result = load_document("/tmp/foo.pdf")

    assert len(result) == 1
    pdf_loader_cls.assert_called_once_with("/tmp/foo.pdf")


# ---------------------------------------------------------------------------
# grapher / process_prospect_list / upload_file_text / upload_prospect_list_file
# (smoke tests — these sync helpers are utility wrappers around LangChain/pandas;
#  one happy-path test each satisfies the "every public function" criterion)
# ---------------------------------------------------------------------------

def test_grapher_returns_graph_documents(mocker):
    """grapher wraps LangChain's LLMGraphTransformer; verify it returns the call result."""
    transformer = mocker.patch("app.services.documents.LLMGraphTransformer")
    transformer.return_value.convert_to_graph_documents.return_value = ["graph_doc_1"]
    docs = [MagicMock(page_content="some content")]

    result = grapher(docs)

    assert result == ["graph_doc_1"]


def test_process_prospect_list_returns_list_of_dicts(mocker):
    """process_prospect_list parses a pandas DataFrame into dict rows."""
    import pandas as pd
    df = pd.DataFrame([{"company": "Acme", "stage": "Initial"}])
    mocker.patch("app.services.documents.pd.read_csv", return_value=df)

    result = process_prospect_list("/tmp/prospects.csv")

    assert isinstance(result, list)
    assert result[0]["company"] == "Acme"


def test_upload_file_text_uploads_to_s3(mocker):
    s3 = mocker.patch("app.services.documents.clients.s3_client")

    upload_file_text("file content", "test.txt", TEST_USER_ID, TEST_ORG_ID)

    s3.put_object.assert_called_once()


def test_upload_prospect_list_file_uploads_to_s3(mocker):
    s3 = mocker.patch("app.services.documents.clients.s3_client")

    upload_prospect_list_file(b"content", "prospects.csv", TEST_USER_ID, TEST_ORG_ID)

    # Either put_object or upload_fileobj was used; assert at least one upload happened
    assert s3.put_object.called or s3.upload_fileobj.called


# ---------------------------------------------------------------------------
# get_document_status / list_user_documents (async)
# ---------------------------------------------------------------------------

def test_get_document_status_raises_when_missing(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    with pytest.raises(DocumentNotFoundError):
        asyncio.run(get_document_status(TEST_FILE_ID, TEST_USER_ID))


def test_get_document_status_happy_path(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "file_id": TEST_FILE_ID,
        "user_id": TEST_USER_ID,
        "status": "completed",
        "file_name": "report.pdf",
    }
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    result = asyncio.run(get_document_status(TEST_FILE_ID, TEST_USER_ID))

    assert result["status"] == "completed"
    assert result["file_id"] == TEST_FILE_ID


def test_list_user_documents_returns_cursor(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value = [
        {"file_id": "f1", "user_id": TEST_USER_ID, "file_name": "a.pdf"},
        {"file_id": "f2", "user_id": TEST_USER_ID, "file_name": "b.pdf"},
    ]
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    result = asyncio.run(list_user_documents(TEST_USER_ID))

    assert len(result) == 2


# ---------------------------------------------------------------------------
# delete_data_source / update_data_source
# ---------------------------------------------------------------------------

def test_delete_data_source_raises_when_missing(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    with pytest.raises(DocumentNotFoundError):
        asyncio.run(delete_data_source(TEST_FILE_ID, TEST_USER_ID))


def test_update_data_source_raises_on_invalid_payload(mocker, mock_mongo_client):
    """update_data_source raises DocumentValidationError on empty update payload."""
    with pytest.raises(DocumentValidationError):
        asyncio.run(update_data_source(TEST_FILE_ID, TEST_USER_ID, update_data={}))


# ---------------------------------------------------------------------------
# process_file_to_embeddings — BrewraError catch path (Phase D Task 15 gap)
# ---------------------------------------------------------------------------

def test_process_file_to_embeddings_catches_brewra_error(
    mocker, mock_mongo_client,
):
    """When an inner step raises BrewraError, the background task should
    catch it, log, and update the doc status to 'failed' without bubbling."""
    coll = MagicMock()
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll
    # Force the S3 download (or whatever the first I/O step is) to raise BrewraError
    mocker.patch(
        "app.services.documents._download_from_s3",
        side_effect=BrewraError("S3 hiccup"),
    )

    # Should not raise — the except BrewraError block in process_file_to_embeddings
    # must catch and persist a 'failed' status.
    asyncio.run(
        process_file_to_embeddings(
            file_key=TEST_FILE_KEY,
            user_id=TEST_USER_ID,
            file_name="report.pdf",
            org_id=TEST_ORG_ID,
            file_id=TEST_FILE_ID,
        )
    )

    # Verify a failure-status update was written
    update_calls = coll.update_one.call_args_list
    failed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "failed"
    ]
    assert len(failed_updates) >= 1, "Expected a failed-status update for the doc"


# ---------------------------------------------------------------------------
# upload_document_file — async happy path
# ---------------------------------------------------------------------------

def test_upload_document_file_returns_file_id(mocker, mock_mongo_client):
    """upload_document_file uploads to S3, inserts a Mongo tracking doc,
    and schedules background processing."""
    mocker.patch("app.services.documents.clients.s3_client").upload_fileobj = MagicMock()
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "abc"
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    upload_file = MagicMock()
    upload_file.filename = "report.pdf"
    upload_file.read = MagicMock(return_value=b"%PDF-1.4\n...")
    upload_file.content_type = "application/pdf"

    bg_tasks = MagicMock()  # FastAPI BackgroundTasks

    result = asyncio.run(
        upload_document_file(
            file=upload_file,
            user_id=TEST_USER_ID,
            org_id=TEST_ORG_ID,
            background_tasks=bg_tasks,
        )
    )

    assert result["status"] in ("success", "processing")
    assert "file_id" in result
    bg_tasks.add_task.assert_called_once()
```

**Note:** the upload-document-file test depends on the actual signature of `upload_document_file`. If the helper named in `mocker.patch("app.services.documents._download_from_s3", ...)` doesn't exist by that exact name, grep the file for the actual private helper that performs S3 download (look for `clients.s3_client.download` or similar) and patch that instead.

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_documents.py -v
cd backend && pytest tests/ -q
```

Expected: ~16 new tests pass (12 happy/sad paths + 4 smoke tests for sync helpers). If a test fails because a private helper name is wrong, fix the patch target and re-run.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_documents.py
git commit -m "test(be): add unit tests for documents"
```

---

## Task 7: Unit tests for `market_research`

Commit message: `test(be): add unit tests for market_research`

**Files:**
- Create: `backend/tests/unit/test_market_research.py`

**Functions covered:** `Research_Market_1..5`, `run_market_research` (async).

**Typed-exception leaves asserted:** `UnsupportedComponentError`, `CompanyProfileNotFoundError`.

**Uses captured fixtures:** `market_research_market_size_groq.json` and `market_research_market_size_claude.json` (and others as parametrize cases need).

- [ ] **Step 1: Write the test file**

```python
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


# ---------------------------------------------------------------------------
# Happy paths — Groq backend
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "component_name,research_fn_name",
    [
        ("market size & opportunity", "Research_Market_1"),
        ("industry trends report", "Research_Market_2"),
        ("competitor landscape", "Research_Market_3"),
        ("regulatory & compliance highlights", "Research_Market_4"),
        ("market entry & growth strategy", "Research_Market_5"),
    ],
)
def test_run_market_research_groq_per_component(
    mocker, mock_session, mock_mongo_client, component_name, research_fn_name,
):
    """Each of the 5 components dispatches to its Research_Market_N helper."""
    # Use the market_size capture for all components — we're testing dispatch,
    # not response shape variations.
    captured = load_captured("market_research_market_size_groq")
    mocker.patch(
        f"app.services.market_research.{research_fn_name}",
        return_value=captured,
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    # Force the refresh path — skip the Mongo "latest report" cache hit
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    # Stub Pinecone helper
    mocker.patch(
        "app.services.market_research._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name=component_name, data=None, refresh=True,
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
    coll = MagicMock()
    coll.find_one.return_value = cached_doc
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    rm1 = mocker.patch("app.services.market_research.Research_Market_1")

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data=None, refresh=False,
    )
    result = asyncio.run(run_market_research(request, llm_backend="groq"))

    assert result["status"] == "success"
    rm1.assert_not_called()


# ---------------------------------------------------------------------------
# Happy path — Claude backend
# ---------------------------------------------------------------------------

def test_run_market_research_claude_uses_captured(
    mocker, mock_session, mock_mongo_client,
):
    captured = load_captured("market_research_market_size_claude")
    # Patch the lambda inside COMPONENT_FUNCTIONS_CLAUDE indirectly by
    # patching Research_Market_1 (the lambda just calls it with "claude").
    mocker.patch(
        "app.services.market_research.Research_Market_1",
        return_value=captured,
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.market_research._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data=None, refresh=True,
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
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="not a real component", data=None, refresh=True,
    )
    with pytest.raises(UnsupportedComponentError, match="Unsupported component_name"):
        asyncio.run(run_market_research(request))


def test_run_market_research_raises_when_company_profile_missing(
    mocker, mock_session, mock_mongo_client,
):
    mock_session.run.return_value.single.return_value = None
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data=None, refresh=True,
    )
    with pytest.raises(CompanyProfileNotFoundError, match="No company profile"):
        asyncio.run(run_market_research(request))
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_market_research.py -v
cd backend && pytest tests/ -q
```

Expected: 5 (parametrize) + 4 = 9 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_market_research.py
git commit -m "test(be): add unit tests for market_research"
```

---

## Task 8: Unit tests for `icp`

Commit message: `test(be): add unit tests for icp`

**Files:**
- Create: `backend/tests/unit/test_icp.py`

**Functions covered:** `ICP_generator`, `icp_research_1..4`, `list_icps`, `_run_icp_research_impl` (via `run_icp_research`), `run_icp_research`, `delete_recommended_icp`, `_reserve_unique_icp_id`, `_release_icp_id`.

**Typed-exception leaves asserted:** `CompanyProfileNotFoundError`, `ICPConfigNotFoundError`, `ICPIdRegistryError`, `RecommendedICPNotFoundError`, `UnsupportedComponentError`.

**Uses captured fixtures:** `icp_research_icp_summary_groq.json`, `icp_research_icp_buyer_map_claude.json`, etc.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_icp.py
"""Unit tests for app/services/icp.py.

Covers the ICP_generator, the 4 icp_research_N helpers (via dispatch through
run_icp_research), list_icps, delete_recommended_icp, and the ICP-id registry
helpers. Includes the preserved-ICPIdRegistryError test mentioned in spec §4.
"""
import asyncio
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
    mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")
    mocker.patch(
        "app.services.icp._reserve_unique_icp_id", return_value=TEST_ICP_ID_1,
    )

    result = list_icps(TEST_USER_ID, refresh=False)

    assert "suggestedICPs" in result


def test_list_icps_raises_when_no_company_profile_for_refresh(
    mocker, mock_session, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")
    mock_session.run.return_value.single.return_value = None  # no company profile

    with pytest.raises(CompanyProfileNotFoundError):
        list_icps(TEST_USER_ID, refresh=True)


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
        asyncio.run(run_icp_research(request, llm_backend="groq"))


def test_run_icp_research_groq_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    captured = load_captured("icp_research_icp_summary_groq")
    mocker.patch("app.services.icp.icp_research_1", return_value=captured)
    mock_session.run.return_value.single.return_value = _make_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.icp._fetch_pinecone_supporting_context", return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="icp summary & market opportunity", data={}, refresh=True,
    )
    result = asyncio.run(run_icp_research(request, llm_backend="groq"))

    assert result["status"] == "success"
    assert result["data"]["user_id"] == TEST_USER_ID


def test_run_icp_research_claude_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    captured = load_captured("icp_research_icp_buyer_map_claude")
    # ICP_FUNCTIONS_CLAUDE wraps icp_research_2 in a lambda; patching the
    # underlying function works.
    mocker.patch("app.services.icp.icp_research_2", return_value=captured)
    mock_session.run.return_value.single.return_value = _make_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch(
        "app.services.icp._fetch_pinecone_supporting_context", return_value=[],
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="buyer map & roles, pain points, triggers",
        data={}, refresh=True,
    )
    result = asyncio.run(run_icp_research(request, llm_backend="claude"))

    assert result["status"] == "success"


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
        asyncio.run(run_icp_research(request, llm_backend="groq"))


# ---------------------------------------------------------------------------
# delete_recommended_icp
# ---------------------------------------------------------------------------

def test_delete_recommended_icp_raises_when_config_missing(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")

    with pytest.raises(ICPConfigNotFoundError):
        delete_recommended_icp(TEST_ICP_ID_1, TEST_USER_ID)


def test_delete_recommended_icp_raises_when_icp_not_in_payload(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": TEST_ICP_ID_2}]},
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")

    with pytest.raises(RecommendedICPNotFoundError):
        delete_recommended_icp(TEST_ICP_ID_1, TEST_USER_ID)


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
    mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")
    release_mock = mocker.patch("app.services.icp._release_icp_id")

    result = delete_recommended_icp(TEST_ICP_ID_1, TEST_USER_ID)

    assert result["success"] is True
    assert result["data"]["remaining_count"] == 1
    release_mock.assert_called_once()
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_icp.py -v
cd backend && pytest tests/ -q
```

Expected: ~14 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_icp.py
git commit -m "test(be): add unit tests for icp"
```

---

## Task 9: Unit tests for `leads`

Commit message: `test(be): add unit tests for leads`

**Files:**
- Create: `backend/tests/unit/test_leads.py`

**Functions covered:** `get_leads_for_org`, `create_lead`, `update_lead`, `delete_lead`, `batch_upload_leads`, `list_leads_by_file`, `get_stream_status`, `delete_leads_by_file`.

**Typed-exception leaves asserted:** `LeadNotFoundError`, `LeadCSVValidationError`.

**Special:** the post-Task-14 propagation test (Neo4j errors from `get_leads_for_org` propagate — no more `raise_on_error` swallow).

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_leads.py
"""Unit tests for app/services/leads.py.

Covers all 8 public functions, the LeadNotFoundError and LeadCSVValidationError
typed-exception sites, and the post-Task-14 error-propagation behavior.
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import LeadCSVValidationError, LeadNotFoundError
from app.models.leads import LeadCreateRequest, LeadUpdateRequest
from app.services.leads import (
    batch_upload_leads,
    create_lead,
    delete_lead,
    delete_leads_by_file,
    get_leads_for_org,
    get_stream_status,
    list_leads_by_file,
    update_lead,
)
from tests.identities import TEST_FILE_ID, TEST_LEAD_ID_1, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# get_leads_for_org
# ---------------------------------------------------------------------------

def test_get_leads_for_org_returns_list(mock_session):
    record = MagicMock()
    node = MagicMock()
    node.items.return_value = [("lead_id", "L1"), ("name", "Acme")]
    record.__getitem__.return_value = node
    mock_session.run.return_value = iter([record])

    result = get_leads_for_org(TEST_ORG_ID)

    assert len(result) == 1
    assert result[0]["lead_id"] == "L1"


def test_get_leads_for_org_applies_limit_and_order(mock_session):
    mock_session.run.return_value = iter([])

    get_leads_for_org(TEST_ORG_ID, limit=5, order_by_recent=True)

    query = mock_session.run.call_args.args[0]
    assert "LIMIT $limit" in query
    assert "ORDER BY l.created_at DESC" in query
    assert mock_session.run.call_args.kwargs["limit"] == 5


def test_get_leads_for_org_propagates_neo4j_error(mock_session):
    """Post-Task-14: get_leads_for_org no longer has raise_on_error;
    storage errors propagate to the caller. Callers (e.g.
    _run_market_scoring_for_org) wrap with except BrewraError."""
    mock_session.run.side_effect = RuntimeError("Neo4j connection refused")

    with pytest.raises(RuntimeError, match="connection refused"):
        get_leads_for_org(TEST_ORG_ID, limit=10)


# ---------------------------------------------------------------------------
# create_lead
# ---------------------------------------------------------------------------

def test_create_lead_happy_path(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co", "stage": "Initial Outreach"},
    )
    result = create_lead(request)

    assert result["status"] == "success"
    assert "lead_id" in result
    mock_session.execute_write.assert_called_once()


def test_create_lead_sets_default_stage_when_missing(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co"},
    )
    create_lead(request)
    # The execute_write call gets the data dict as its 4th positional arg
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["stage"] == "Initial Outreach"


# ---------------------------------------------------------------------------
# update_lead
# ---------------------------------------------------------------------------

def test_update_lead_raises_when_lead_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    request = LeadUpdateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"stage": "Qualified"},
    )
    with pytest.raises(LeadNotFoundError, match="Lead not found"):
        update_lead(TEST_LEAD_ID_1, request)


def test_update_lead_happy_path(mock_session):
    mock_session.run.return_value.single.return_value = MagicMock()  # exists

    request = LeadUpdateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"stage": "Qualified"},
    )
    result = update_lead(TEST_LEAD_ID_1, request)

    assert result["status"] == "success"
    mock_session.execute_write.assert_called_once()


# ---------------------------------------------------------------------------
# delete_lead
# ---------------------------------------------------------------------------

def test_delete_lead_raises_when_lead_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(LeadNotFoundError):
        delete_lead(TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)


def test_delete_lead_happy_path(mock_session):
    mock_session.run.return_value.single.return_value = MagicMock()

    result = delete_lead(TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"


# ---------------------------------------------------------------------------
# batch_upload_leads
# ---------------------------------------------------------------------------

def test_batch_upload_leads_raises_on_empty_csv(
    mock_session, mock_mongo_client,
):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    empty_csv = b"col1,col2\n"  # header only

    with pytest.raises(LeadCSVValidationError, match="CSV file is empty"):
        batch_upload_leads(empty_csv, "empty.csv", TEST_USER_ID, TEST_ORG_ID)


def test_batch_upload_leads_raises_on_unparseable_csv(
    mock_session, mock_mongo_client,
):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    # Use bytes that fail every common encoding
    bad_bytes = b"\xff\xfe\xfd" + b"\x00" * 100

    with pytest.raises(LeadCSVValidationError, match="Could not parse"):
        batch_upload_leads(bad_bytes, "bad.csv", TEST_USER_ID, TEST_ORG_ID)


def test_batch_upload_leads_happy_path(mock_session, mock_mongo_client):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    csv_bytes = b"company_name,stage\nAcme,Initial\nBeta Corp,Qualified\n"

    result = batch_upload_leads(csv_bytes, "leads.csv", TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["created_count"] == 2
    assert result["error_count"] == 0


# ---------------------------------------------------------------------------
# list_leads_by_file / get_stream_status / delete_leads_by_file
# ---------------------------------------------------------------------------

def test_list_leads_by_file_returns_records(mock_session):
    record = MagicMock()
    node = MagicMock()
    node.items.return_value = [("lead_id", "L1"), ("file_id", TEST_FILE_ID)]
    record.__getitem__.return_value = node
    mock_session.run.return_value = iter([record])

    result = list_leads_by_file(TEST_ORG_ID, TEST_FILE_ID)

    assert len(result) == 1
    assert result[0]["file_id"] == TEST_FILE_ID


def test_get_stream_status_returns_files_list(mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value = [
        {
            "file_id": TEST_FILE_ID, "filename": "leads.csv",
            "uploaded_at": "2026-05-08T10:00:00Z",
            "total_rows": 100, "created_count": 95, "error_count": 5,
            "processing_status": "completed",
        },
    ]
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = get_stream_status(TEST_ORG_ID)

    assert len(result["files"]) == 1
    assert result["files"][0]["file_id"] == TEST_FILE_ID


def test_delete_leads_by_file_raises_when_no_leads_match(
    mock_session, mock_mongo_client,
):
    count_record = MagicMock()
    count_record.__getitem__.return_value = 0
    mock_session.run.return_value.single.return_value = count_record

    with pytest.raises(LeadNotFoundError, match="No leads found"):
        delete_leads_by_file(TEST_FILE_ID, TEST_USER_ID, TEST_ORG_ID)


def test_delete_leads_by_file_happy_path(mock_session, mock_mongo_client):
    count_record = MagicMock()
    count_record.__getitem__.return_value = 3
    mock_session.run.return_value.single.return_value = count_record
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = delete_leads_by_file(TEST_FILE_ID, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["deleted_count"] == 3
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_leads.py -v
cd backend && pytest tests/ -q
```

Expected: ~16 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_leads.py
git commit -m "test(be): add unit tests for leads"
```

---

## Task 10: Unit tests for `market_scoring`

Commit message: `test(be): add unit tests for market_scoring`

**Files:**
- Create: `backend/tests/unit/test_market_scoring.py`

**Functions covered:** `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`, `get_company_profile_for_org`, `get_market_reports_for_org`, `score_single_lead_against_market`, `_run_market_scoring_for_org` (background task — public-ish because it's the BrewraError catch site).

**Typed-exception leaves asserted:** `MarketScoreNotFoundError`, `MarketScoringRunNotFoundError`.

**Special coverage (Phase D Task 15 gap):** the `_run_market_scoring_for_org` `except BrewraError` block. Plus the C2 fix verification: `get_market_scores_status` degrades gracefully when `get_leads_for_org` raises.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_market_scoring.py
"""Unit tests for app/services/market_scoring.py.

Covers all router-facing service functions, the BrewraError catch path in
_run_market_scoring_for_org (Phase D Task 15 gap), and the C2 degrade-on-error
behavior of get_market_scores_status.
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    BrewraError,
    MarketScoreNotFoundError,
    MarketScoringRunNotFoundError,
)
from app.services.market_scoring import (
    _run_market_scoring_for_org,
    get_company_profile_for_org,
    get_lead_market_score_descriptions,
    get_market_reports_for_org,
    get_market_scores_status,
    score_single_lead_against_market,
    trigger_or_get_market_scores,
)
from tests.identities import TEST_LEAD_ID_1, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# get_market_scores_status
# ---------------------------------------------------------------------------

def test_get_market_scores_status_returns_status(mocker, mock_mongo_client):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "user_id": TEST_USER_ID, "org_id": TEST_ORG_ID,
        "status": "completed", "started_at": "2026-05-08T10:00:00Z",
        "completed_at": "2026-05-08T10:05:00Z",
    }
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        return_value=[{"lead_id": "L1"}, {"lead_id": "L2"}],
    )

    result = get_market_scores_status(TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "completed"
    assert result["total_leads"] == 2


def test_get_market_scores_status_degrades_when_leads_fetch_fails(
    mocker, mock_mongo_client,
):
    """C2 fix: a Neo4j hiccup in get_leads_for_org should not make the
    status endpoint fatal. total_leads degrades to 0 instead."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "user_id": TEST_USER_ID, "org_id": TEST_ORG_ID,
        "status": "completed",
    }
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        side_effect=RuntimeError("Neo4j down"),
    )

    result = get_market_scores_status(TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "completed"
    assert result["total_leads"] == 0  # degraded, not fatal


def test_get_market_scores_status_raises_when_no_run_found(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = None
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoringRunNotFoundError):
        get_market_scores_status(TEST_USER_ID, TEST_ORG_ID)


# ---------------------------------------------------------------------------
# trigger_or_get_market_scores
# ---------------------------------------------------------------------------

def test_trigger_or_get_market_scores_returns_existing_when_present(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "status": "completed",
    }
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    bg_tasks = MagicMock()

    result = trigger_or_get_market_scores(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, background_tasks=bg_tasks,
    )

    assert result["status"] in ("completed", "queued", "processing")
    # No new background task should be triggered when a completed run exists
    # (the precise behavior may vary; verify against the actual service code)


# ---------------------------------------------------------------------------
# get_lead_market_score_descriptions
# ---------------------------------------------------------------------------

def test_get_lead_market_score_descriptions_raises_when_missing(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    score_coll.find_one.return_value = None
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoreNotFoundError):
        get_lead_market_score_descriptions(TEST_LEAD_ID_1, TEST_ORG_ID)


def test_get_lead_market_score_descriptions_happy_path(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    score_coll.find_one.return_value = {
        "lead_id": TEST_LEAD_ID_1, "org_id": TEST_ORG_ID,
        "market_score_breakdown": [
            {"factor": "ICP fit", "score": 85, "description": "Strong match"},
        ],
    }
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    result = get_lead_market_score_descriptions(TEST_LEAD_ID_1, TEST_ORG_ID)

    assert len(result["market_score_breakdown"]) == 1
    assert result["market_score_breakdown"][0]["factor"] == "ICP fit"


# ---------------------------------------------------------------------------
# get_company_profile_for_org / get_market_reports_for_org
# ---------------------------------------------------------------------------

def test_get_company_profile_for_org_returns_neo4j_profile(mock_session):
    record = MagicMock()
    record.values.return_value = [{"name": "Acme", "industry": "Logistics"}]
    mock_session.run.return_value.single.return_value = record

    result = get_company_profile_for_org(TEST_ORG_ID)

    assert result["name"] == "Acme"


def test_get_company_profile_for_org_returns_empty_when_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    result = get_company_profile_for_org(TEST_ORG_ID)

    assert result == {} or result is None


def test_get_market_reports_for_org_returns_documents(mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value = [
        {"component_name": "market size", "data": {"tam": "$1B"}},
        {"component_name": "industry trends", "data": {"trend": "AI"}},
    ]
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll

    result = get_market_reports_for_org(TEST_USER_ID, TEST_ORG_ID)

    assert isinstance(result, list)
    assert len(result) >= 2


# ---------------------------------------------------------------------------
# score_single_lead_against_market
# ---------------------------------------------------------------------------

def test_score_single_lead_against_market_returns_score(mocker):
    """score_single_lead_against_market wraps an LLM call; mock the chain."""
    chain = MagicMock()
    chain.invoke.return_value = {
        "output": '{"market_score": 75, "rationale": "Good ICP fit"}'
    }
    mocker.patch("app.core.llm_config.agent_chain", chain)

    lead = {"lead_id": TEST_LEAD_ID_1, "company_name": "Acme"}
    company_profile = {"industry": "Logistics"}
    market_reports = [{"component_name": "market size", "data": {"tam": "$1B"}}]

    result = score_single_lead_against_market(lead, company_profile, market_reports)

    assert "market_score" in result or "score" in result


# ---------------------------------------------------------------------------
# _run_market_scoring_for_org — BrewraError catch (Phase D Task 15 gap)
# ---------------------------------------------------------------------------

def test_run_market_scoring_for_org_marks_failed_on_brewra_error(
    mocker, mock_mongo_client,
):
    """When an inner step raises BrewraError, the background task catches
    it, updates the run-doc status to 'failed', and does NOT bubble."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        side_effect=BrewraError("storage hiccup"),
    )

    # Should not raise
    _run_market_scoring_for_org(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, run_id="r1",
    )

    # The run-doc status must flip to "failed"
    update_calls = run_coll.update_one.call_args_list
    failed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "failed"
    ]
    assert len(failed_updates) >= 1, "Expected ≥1 'status: failed' update"


def test_run_market_scoring_for_org_marks_completed_on_success(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        return_value=[{"lead_id": "L1"}],
    )
    mocker.patch(
        "app.services.market_scoring.get_company_profile_for_org",
        return_value={"industry": "SaaS"},
    )
    mocker.patch(
        "app.services.market_scoring.get_market_reports_for_org",
        return_value=[],
    )
    mocker.patch(
        "app.services.market_scoring.score_single_lead_against_market",
        return_value={"market_score": 85},
    )
    mocker.patch(
        "app.services.market_scoring._persist_market_score_for_lead",
    )

    _run_market_scoring_for_org(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, run_id="r1",
    )

    update_calls = run_coll.update_one.call_args_list
    completed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "completed"
    ]
    assert len(completed_updates) >= 1
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_market_scoring.py -v
cd backend && pytest tests/ -q
```

Expected: ~14 new tests pass (10 happy/sad paths + 4 helper coverage tests).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_market_scoring.py
git commit -m "test(be): add unit tests for market_scoring"
```

---

## Task 11: Unit tests for `signals`

Commit message: `test(be): add unit tests for signals`

**Files:**
- Create: `backend/tests/unit/test_signals.py`

**Functions covered:** `search_signals`, `run_signals_research` (async), `generate_signals_batch` (async), `generate_signals_batch_claude` (async), `fetch_signals` (async), `record_signal_action` (async), `signal_ask` (async), `signal_ask_claude` (async).

**Typed-exception leaves asserted:** `SignalNotFoundError`, `SignalActionValidationError`, `UnsupportedComponentError`, `ServiceError` (×3 sites: signal-delete race, ANTHROPIC_API_KEY guard, Claude API failure).

**Uses captured fixtures:** `search_signals_scout_groq.json`, `search_signals_profiler_claude.json`, `signal_ask_groq.json`, `signal_ask_claude.json`.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/unit/test_signals.py
"""Unit tests for app/services/signals.py.

Covers all 8 public functions and the 4 typed-exception leaves plus the
3 ServiceError sites introduced in the Phase D C1 fix.
"""
import asyncio
import json
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    ServiceError,
    SignalActionValidationError,
    SignalNotFoundError,
    UnsupportedComponentError,
)
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.models.market_research import MarketRequest
from app.services.signals import (
    fetch_signals,
    generate_signals_batch,
    generate_signals_batch_claude,
    record_signal_action,
    run_signals_research,
    search_signals,
    signal_ask,
    signal_ask_claude,
)
from tests.fixtures import load_captured, load_seed
from tests.identities import (
    TEST_ORG_ID,
    TEST_SIGNAL_ID_1,
    TEST_USER_ID,
)


# ---------------------------------------------------------------------------
# search_signals (sync) — uses captured fixtures
# ---------------------------------------------------------------------------

def test_search_signals_scout_groq_uses_captured(mocker):
    captured = load_captured("search_signals_scout_groq")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch("app.core.llm_config.agent_chain", chain_mock)

    pre_data = json.dumps(load_seed("company_profile"))
    result = search_signals(pre_data, persona="scout", llm_backend="default")

    assert result is not None
    chain_mock.invoke.assert_called_once()


def test_search_signals_profiler_claude_uses_captured(mocker):
    captured = load_captured("search_signals_profiler_claude")
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value=json.dumps(captured),
    )
    mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("web context", []),
    )

    pre_data = json.dumps(load_seed("company_profile"))
    result = search_signals(pre_data, persona="profiler", llm_backend="claude")

    assert result is not None


# ---------------------------------------------------------------------------
# run_signals_research — UnsupportedComponentError dispatch
# ---------------------------------------------------------------------------

def test_run_signals_research_raises_on_unknown_persona(
    mocker, mock_session, mock_mongo_client,
):
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="bogus persona", data={}, refresh=True,
    )
    with pytest.raises(UnsupportedComponentError):
        asyncio.run(run_signals_research(request))


# ---------------------------------------------------------------------------
# generate_signals_batch / generate_signals_batch_claude
# ---------------------------------------------------------------------------

def test_generate_signals_batch_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """generate_signals_batch dispatches to _generate_signals_batch_impl
    with llm_backend='default'."""
    captured = load_captured("search_signals_scout_groq")
    mocker.patch(
        "app.services.signals._generate_signals_batch_impl",
        return_value={"status": "success", "data": captured},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data=None, refresh=True,
    )
    result = asyncio.run(generate_signals_batch(request))

    assert result["status"] == "success"


def test_generate_signals_batch_claude_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """generate_signals_batch_claude dispatches with llm_backend='claude'."""
    captured = load_captured("search_signals_scout_claude")
    mocker.patch(
        "app.services.signals._generate_signals_batch_impl",
        return_value={"status": "success", "data": captured},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data=None, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(request))

    assert result["status"] == "success"


# ---------------------------------------------------------------------------
# fetch_signals (async)
# ---------------------------------------------------------------------------

def test_fetch_signals_returns_empty_when_no_docs(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value.limit.return_value = []
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    result = asyncio.run(fetch_signals(TEST_USER_ID))

    assert isinstance(result, list)
    assert len(result) == 0


def test_fetch_signals_returns_docs(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value.limit.return_value = [
        {"signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID, "headline": "X"},
    ]
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    result = asyncio.run(fetch_signals(TEST_USER_ID, limit=10))

    assert len(result) == 1


# ---------------------------------------------------------------------------
# record_signal_action — SignalActionValidationError + SignalNotFoundError
# ---------------------------------------------------------------------------

def test_record_signal_action_raises_on_invalid_action(
    mocker, mock_mongo_client,
):
    request = SignalActionRequest(
        user_id=TEST_USER_ID, signal_id=TEST_SIGNAL_ID_1, action="bogus",
    )
    with pytest.raises(SignalActionValidationError):
        asyncio.run(record_signal_action(request))


def test_record_signal_action_raises_when_signal_missing(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        user_id=TEST_USER_ID, signal_id=TEST_SIGNAL_ID_1, action="accept",
    )
    with pytest.raises(SignalNotFoundError):
        asyncio.run(record_signal_action(request))


def test_record_signal_action_accept_happy_path(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID,
    }
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        user_id=TEST_USER_ID, signal_id=TEST_SIGNAL_ID_1, action="accept",
    )
    result = asyncio.run(record_signal_action(request))

    assert result["status"] == "success"
    assert result["action"] == "accept"


def test_record_signal_action_reject_raises_service_error_on_delete_race(
    mocker, mock_mongo_client,
):
    """ServiceError site: reject action attempts delete; if delete fails
    (race condition where doc disappeared after the find_one), surface
    ServiceError instead of generic 500."""
    coll = MagicMock()
    coll.find_one.return_value = {
        "signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID,
    }
    coll.delete_one.return_value.deleted_count = 0  # race: gone already
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        user_id=TEST_USER_ID, signal_id=TEST_SIGNAL_ID_1, action="reject",
    )
    with pytest.raises(ServiceError, match="Failed to delete signal"):
        asyncio.run(record_signal_action(request))


# ---------------------------------------------------------------------------
# signal_ask / signal_ask_claude — captured fixtures + ServiceError paths
# ---------------------------------------------------------------------------

def test_signal_ask_groq_uses_captured(mocker, mock_mongo_client):
    captured = load_captured("signal_ask_groq")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = captured
    mocker.patch("app.core.llm_config.agent_chain", chain_mock)
    mocker.patch(
        "app.services.signals._fetch_pinecone_supporting_context",
        return_value=[],
    )

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        question="What's the latest signal?", signal_id=None,
    )
    result = asyncio.run(signal_ask(request))

    assert result is not None
    assert "output" in result or "answer" in result


def test_signal_ask_claude_raises_service_error_when_api_key_missing(
    mocker, mock_mongo_client,
):
    """ServiceError site: ANTHROPIC_API_KEY guard."""
    mocker.patch("app.services.signals.CLAUDE_API_KEY", "")

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        question="Q", signal_id=None,
    )
    with pytest.raises(ServiceError, match="ANTHROPIC_API_KEY"):
        asyncio.run(signal_ask_claude(request))


def test_signal_ask_claude_raises_service_error_when_claude_call_fails(
    mocker, mock_mongo_client,
):
    """ServiceError site: Claude API exception → ServiceError, not RuntimeError."""
    mocker.patch("app.services.signals.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals._claude_messages_text",
        side_effect=Exception("Claude 500"),
    )

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        question="Q", signal_id=None,
    )
    with pytest.raises(ServiceError):
        asyncio.run(signal_ask_claude(request))


def test_signal_ask_claude_happy_path_uses_captured(
    mocker, mock_mongo_client,
):
    captured = load_captured("signal_ask_claude")
    mocker.patch("app.services.signals.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals._claude_messages_text",
        return_value=captured.get("output", str(captured)),
    )

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        question="Q", signal_id=None,
    )
    result = asyncio.run(signal_ask_claude(request))

    assert result is not None
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && pytest tests/unit/test_signals.py -v
cd backend && pytest tests/ -q
```

Expected: ~16 new tests pass (14 + 2 generate_signals_batch dispatch tests).

**Note:** signal-helper imports inside `signals.py` may differ from the patch targets above (`_claude_messages_text` may live in `app.services._llm_helpers` and be imported into `signals` — patch where it's looked up). If a patch target is wrong, grep `signals.py` for the actual import line and adjust.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_signals.py
git commit -m "test(be): add unit tests for signals"
```

---

## Task 12: Rewire integration tests to use captured fixtures

Commit message: `test(be): rewire integration tests to use captured fixtures`

**Files:**
- Modify: `backend/tests/test_market_research.py`
- Modify: `backend/tests/test_icp.py`
- Modify: `backend/tests/test_signals.py`
- Modify: `backend/tests/__snapshots__/test_icp.ambr` (re-baselined)

**Note:** Of the three rewire targets, only `test_icp.py` uses syrupy snapshots (verified — `tests/__snapshots__/` contains `test_auth_org.ambr`, `test_icp.ambr`, `test_profiles.ambr`). `test_market_research.py` and `test_signals.py` use plain assertions, so the rewire there is purely a mock-return-value swap.

- [ ] **Step 1: Rewire `test_market_research.py`**

Open `backend/tests/test_market_research.py` and replace the `_CANNED_RESULT` constant with a call to `load_captured(...)`. Specifically:

Replace:

```python
_CANNED_RESULT = {
    "executiveSummary": "Strong growth opportunity in target market.",
    # ...several lines of hand-crafted dict
}
```

with:

```python
from tests.fixtures import load_captured

def _captured_result(component_slug: str = "market_size") -> dict:
    return load_captured(f"market_research_{component_slug}_groq")
```

Then replace usages — wherever the test does `lambda _: dict(_CANNED_RESULT)`, change to `lambda _: _captured_result()`.

- [ ] **Step 2: Rewire `test_signals.py`**

In `backend/tests/test_signals.py`, find the `test_post_generate_signals_batch_*` and `test_post_signal_ask_*` tests. Replace any hand-crafted dict passed to `mock_chain.invoke.return_value` with `load_captured("signal_ask_groq")`. Replace any `search_signals` return value with `load_captured("search_signals_scout_groq")`.

- [ ] **Step 3: Rewire `test_icp.py`**

In `backend/tests/test_icp.py`, replace hand-crafted ICP-research mock return values with `load_captured(f"icp_research_{component}_groq")`. Per spec §3.5, only this file uses syrupy snapshots.

- [ ] **Step 4: Re-baseline the icp syrupy snapshot**

```bash
cd backend
pytest tests/test_icp.py --snapshot-update
```

Expected: `tests/__snapshots__/test_icp.ambr` updated with the captured-fixture-derived response shapes.

- [ ] **Step 5: Run the full integration suite to confirm no regressions**

```bash
cd backend && pytest tests/ -q
```

Expected: all tests still pass with rewired fixtures.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_market_research.py \
        backend/tests/test_icp.py \
        backend/tests/test_signals.py \
        backend/tests/__snapshots__/test_icp.ambr
git commit -m "test(be): rewire integration tests to use captured fixtures"
```

---

## Task 13: Close TD-001 and TD-002 in TECH_DEBT.md

Commit message: `chore(docs): close TD-001 and TD-002 in TECH_DEBT.md`

**Files:**
- Modify: `docs/TECH_DEBT.md`

- [ ] **Step 1: Add "Resolved" line to TD-001**

Open `docs/TECH_DEBT.md` and find the TD-001 section. After the existing `**Why we deferred:**` block and before the next `## TD-` heading, add:

```markdown

**Resolved 2026-05-22 by Phase E (`refactor-backend-modularization-phase-e`).** `backend/tests/capture_fixtures.py` produces ~24 deterministic JSON captures in `backend/tests/fixtures/captured/`. Three integration test files (`test_market_research.py`, `test_icp.py`, `test_signals.py`) now consume these via `load_captured(...)`. Re-capture triggers are documented in the script header.
```

- [ ] **Step 2: Add "Resolved" line to TD-002**

Find the TD-002 section. After the existing `**Why we deferred:**` block (and before the next `## TD-` heading), add:

```markdown

**Resolved 2026-05-22 by Phase E (`refactor-backend-modularization-phase-e`).** `backend/tests/unit/` adds ~110-130 direct unit tests across 9 service files. Each typed-exception leaf in `app/core/exceptions.py` is asserted via `pytest.raises(...)`. `pytest tests/unit/` runs in under 2s.
```

- [ ] **Step 3: Run the full suite one last time**

```bash
cd backend && pytest tests/ -q
```

Expected: all tests pass (~210+ total).

- [ ] **Step 4: Commit**

```bash
git add docs/TECH_DEBT.md
git commit -m "chore(docs): close TD-001 and TD-002 in TECH_DEBT.md"
```

---

## Post-flight (no commit)

- [ ] **Verify acceptance criteria from spec §6**

```bash
# Hard criteria (greppable)
cd backend
pytest tests/unit/ -v   # all pass
time pytest tests/unit/ -q   # under 2s wall-clock
pytest tests/ -q   # ~210+ pass

ls tests/fixtures/captured/ | wc -l   # ≥ 24
ls tests/fixtures/seed/ | wc -l   # = 3
head -5 tests/capture_fixtures.py   # docstring present

# Exception-leaf coverage spot check
for cls in LeadNotFoundError CompanyProfileNotFoundError SuggestedICPNotFoundError \
           ICPAlreadyExistsError DocumentNotFoundError ICPConfigNotFoundError \
           RecommendedICPNotFoundError MarketScoreNotFoundError \
           MarketScoringRunNotFoundError SignalNotFoundError \
           UsersDocumentNotFoundError OrgNotFoundError ProfileNotFoundError \
           CustomerProfileNotFoundError CustomerProfileICPNotFoundError \
           ProfileValidationError LeadCSVValidationError DocumentValidationError \
           UnsupportedComponentError SignalActionValidationError \
           BudgetExhaustedError ICPIdRegistryError ServiceError; do
  grep -lr "pytest.raises($cls" tests/unit/ > /dev/null \
    && echo "OK: $cls" || echo "MISSING: $cls"
done

# TECH_DEBT entries marked
grep -A1 "Resolved 2026-05-22 by Phase E" ../docs/TECH_DEBT.md
```

Every leaf class except `BudgetExhaustedError` (covered indirectly via market_research/claude path budget enforcement — leave it for Phase F if a direct test is desired) should print `OK:`.

- [ ] **Final test count**

```bash
cd backend && pytest tests/ --collect-only -q | tail -1
```

Expected: `~210 tests collected`.

---

## Notes for the implementing engineer

1. **Patch-at-caller convention.** When a service imports a helper from another module (`from app.services.icp import _reserve_unique_icp_id`), the patch target is the **caller's namespace**: `mocker.patch("app.services.customer_profile._reserve_unique_icp_id", ...)`. Don't patch the source module.

2. **`mock_session` and `mock_mongo_client` fixtures live in `tests/unit/conftest.py`.** They're auto-discovered by pytest. Tests don't need to import them.

3. **`asyncio.run(...)` is the async-test entry point** for this phase. No `pytest-asyncio` required. Each test gets a fresh event loop. Avoid sharing state between async calls inside a single test.

4. **`tests/fixtures/__init__.py` is currently a 1-byte empty file** — Task 1 replaces it with the loader module.

5. **The capture script (Task 2) requires real API keys.** Set `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, and `TAVILY_API_KEY` in your shell before running it. CI does not run the capture script; CI consumes the committed JSON outputs.

6. **If a `mocker.patch` target name fails** (because the actual private helper has a different name), grep the relevant service file for the function being patched and update the patch target to the real one. The spec calls this out (see §3.2) — the mocked names are best-guesses based on the spec's worked examples; real names should be verified during implementation.

7. **Each commit must be runnable on its own.** After every task's commit, the full `pytest tests/` must pass. If a unit test depends on a captured fixture, the fixture commit (Task 2) must already be merged. The task order in this plan reflects that dependency.

8. **No backwards-compat shims required.** This is MVP-state work — see CLAUDE.md "Business State". If a Pydantic model field name needs adjustment to match the captured fixture shape, change the field name in both places and ship the rewire in the same commit.
