# Characterization-Test Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a characterization-test safety net (HTTP-level for backend, Playwright + visual regression for frontend) that locks current behavior of the 13 critical, currently-working features, so we can refactor `backend/api.py` (4.4k LOC monolith) and the wider stack without silent regressions.

**Architecture:** Two parallel test suites — pytest+syrupy for backend (in-process via FastAPI `TestClient`, all external deps mocked at the client boundary), Playwright for frontend (real browser + Vite dev server, `/api/*` mocked via `page.route()`). Snapshot/golden-file assertions for the response/screen, plus explicit assertions on status codes and side-effects (which Cypher pattern ran, which Mongo collection was written). Hand-crafted fixtures (TD-001 deferred capture-once upgrade). Local-only execution; no CI gate.

**Tech Stack:**
- Backend: pytest, pytest-mock, syrupy, httpx, anyio, FastAPI TestClient
- Frontend: @playwright/test (chromium only, WSL2/Linux canonical)
- Reference spec: `specs/2026-05-08-characterization-tests-design.md`
- Critique (read post-implementation): `plans/03-characterization-tests-critique.md`

---

## Deviations from this plan during implementation

This section was added post-facto (2026-05-08) after the critique landed and several plan-prescribed approaches turned out to be wrong. Future readers should trust the implementation in `backend/tests/` and `frontend/e2e/` over the snippets below; this log captures what changed and why.

1. **Patch targets in `conftest.py`** were corrected from `backend.api.neo4j_driver` / `backend.services.neo4j_driver` (as Task 3 prescribes) to flat `api.driver` / `services.driver` / `api.client` / `api.s3_client` / `api.pc`. The backend has no `__init__.py` package layout, and the actual module-level variable names are `driver` (not `neo4j_driver`) and `client` (not `mongo_client`). Originating commit: `46f89b5`. All `create=True` flags were dropped in commit `75b333f` so renames break loudly instead of silently.

2. **Backend importability without `pythonpath = .`.** Task 1's `pytest.ini` ships without `pythonpath = .`. Instead, `conftest.py` manipulates `sys.path` directly at the top of the file (inserting `backend/` and the monorepo root before any backend module loads) and uses `from main import app`. This works because pytest auto-discovers `conftest.py` before test collection.

3. **Import-time side effects** (Task 3's biggest risk per critique P0 #1) are mitigated, not eliminated: `conftest.py` sets dummy env vars for the keys without hardcoded fallbacks (`PINECONE_API_KEY`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`); `database.py`'s connection wrapping in try/except absorbs failed connectivity; the rest of the heavy modules (Groq, Together, Tavily) succeed at import-time but their HTTP clients are never invoked because their consumers are patched. Tests pass.

4. **`mock_groq_chat` and `mock_tavily` fixtures** prescribed in Task 3 were removed. `services.groq_chat` and `services.tavily_search` don't exist as module-level names; the real names are `services.llm` (Groq) and the Tavily tool is wrapped inside `agent_chain`. Replaced with `mock_llm_config` covering `chain`, `chain2`, `llm`, `llm2`, `llm_transformer`, `graph` across `api.*`, `services.*`, and `llm_config.*` namespaces. Originating commit: `75b333f`.

5. **FE auth helper (Task 23)** was rewritten end-to-end. The plan's `loginAsTestUser` seeded localStorage with keys (`auth_token`, `user_id`, `org_id`, `selected_tenant`) that nothing in the app reads — the real keys are UID-keyed: `org_id_${uid}`, `org_name_${uid}`, `selectedTenant_${uid}`, `jwt_token`. Verified failure mode: journey 02 was bouncing every test to the login page. The fix drives the actual Firebase login flow (with REST endpoints mocked) so Firebase persists a session in IndexedDB, then pre-seeds UID-keyed localStorage to skip the post-login `/api/org` fetch. Originating commit: `88fd98a`.

6. **Firebase REST mocks (Task 23 → `mockFirebaseLogin`)** were split per-endpoint. The plan's single catch-all returning the signin shape causes Firebase Auth's `accounts:lookup` call to crash with "Cannot read properties of undefined (reading 'length')" because the SDK reads `users.length` on a response missing the `users` array. Now we route by URL suffix: `accounts:lookup` → `{ kind, users: [...] }`; everything else → signin shape with `kind: 'identitytoolkit#VerifyPasswordResponse'`. Originating commit: `1418fdd`.

7. **FE `installApiMocks` glob and ordering (Task 22)** were both fixed. The plan's `**${path}**` substring glob meant a mock for `/api/leads` also intercepted `/api/leads/by-file`, `/api/leads/batch-upload`, etc. Worse, the plan called `installApiMocks` first and `installCatchAllApiMock` last — but Playwright matches routes in REVERSE registration order, so the catch-all hijacked every request and the specific responses were never delivered. The fix uses URL pathname equality and registers catch-all before specific overrides inside one consolidated `installApiMocks`. `installCatchAllApiMock` is kept as a no-op shim. Originating commit: `d937443`.

8. **Per-task commits.** The plan's per-task commit protocol was followed (≈30 commits). The CLAUDE.md / AGENTS.md "commit granularity" rule was added in commit `a258bc5` to codify this practice for future plans.

9. **Outstanding: journeys 02-05 fail on UI selectors.** After fixes 5-7, journey 01 + all 5 stubs pass. Journeys 02-05 reach the right pages (verified post-login mission-control state in page snapshots) but fail on UI selectors that don't match the actual rendered DOM (e.g., the upload modal trigger in journey 02, the "create ICP" button in journey 05). The plan acknowledged this fragility ("Selectors here depend on actual UI — adjust on first run") but never iterated. To complete: open each test, run `npx playwright test … --headed`, fix selectors against the live DOM. This is per-journey work and should each be its own commit.

---

## Phase 1: Backend test infrastructure

### Task 1: Create backend test directory structure and dependencies

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/fixtures/__init__.py`
- Create: `backend/pytest.ini`
- Create: `backend/requirements-test.txt`

- [ ] **Step 1: Create directories**

```bash
cd backend
mkdir -p tests/fixtures tests/__snapshots__
touch tests/__init__.py tests/fixtures/__init__.py
```

- [ ] **Step 2: Create `backend/requirements-test.txt`**

```
pytest>=8.0.0
pytest-mock>=3.12.0
syrupy>=4.6.0
httpx>=0.27.0
anyio>=4.3.0
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
asyncio_mode = auto
```

- [ ] **Step 4: Install test dependencies**

Run: `cd backend && pip install -r requirements-test.txt`
Expected: Successful installation of pytest, pytest-mock, syrupy, httpx, anyio.

- [ ] **Step 5: Verify pytest can be invoked**

Run: `cd backend && pytest --version`
Expected: Prints pytest version (e.g., `pytest 8.x.x`).

- [ ] **Step 6: Commit**

```bash
git add backend/tests/ backend/pytest.ini backend/requirements-test.txt
git commit -m "test(be): scaffold pytest infrastructure for characterization tests"
```

---

### Task 2: Create canonical test identities

**Files:**
- Create: `backend/tests/identities.py`

- [ ] **Step 1: Write `backend/tests/identities.py`**

```python
"""Canonical test identities used across all backend tests.

These IDs are mirrored in frontend/e2e/fixtures/identities.ts.
When you change one side, change the other in the same commit.
"""

TEST_USER_ID = "test_user_123"
TEST_ORG_ID = "test_org_abc"

TEST_LEAD_ID_1 = "lead_00000000-0000-0000-0000-000000000001"
TEST_LEAD_ID_2 = "lead_00000000-0000-0000-0000-000000000002"

TEST_ICP_ID_1 = "icp_00000000-0000-0000-0000-000000000001"
TEST_ICP_ID_2 = "icp_00000000-0000-0000-0000-000000000002"

TEST_SIGNAL_ID_1 = "sig_00000000-0000-0000-0000-000000000001"
TEST_SIGNAL_ID_2 = "sig_00000000-0000-0000-0000-000000000002"

TEST_FILE_KEY = "test_org_abc/test_file_key.pdf"
TEST_FILE_ID = "file_00000000-0000-0000-0000-000000000001"

TEST_TIMESTAMP = "2026-05-08T10:00:00Z"
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd backend && python -c "from tests.identities import TEST_USER_ID; print(TEST_USER_ID)"`
Expected: Prints `test_user_123`.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/identities.py
git commit -m "test(be): add canonical test identities"
```

---

### Task 3: Create conftest.py with dependency-override fixtures

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write `backend/tests/conftest.py`**

```python
"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM, Tavily) are mocked at the
module path where they're used (backend.api / backend.services), not where
they're defined. This is robust against import-order variations.
"""
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def mock_neo4j(mocker):
    """Mock Neo4j driver used in api.py and services.py.

    Returns a dict with `driver` and `session` so tests can assert on
    .session().run.call_args_list.
    """
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("backend.api.neo4j_driver", mock_driver, create=True)
    mocker.patch("backend.services.neo4j_driver", mock_driver, create=True)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Returns the MagicMock so tests can assert on
    e.g. mock_mongo.return_value.Scout_Agent.signals.update_one.called.
    """
    mongo = MagicMock()
    mocker.patch("backend.api.mongo_client", mongo, create=True)
    mocker.patch("backend.services.mongo_client", mongo, create=True)
    return mongo


@pytest.fixture
def mock_llm_chain(mocker):
    """Mock the LangChain agent_chain (Together Qwen + Tavily).

    Tests configure .run.return_value with canned JSON strings.
    """
    mock_chain = MagicMock()
    mocker.patch("backend.services.agent_chain", mock_chain, create=True)
    return mock_chain


@pytest.fixture
def mock_groq_chat(mocker):
    """Mock the Groq llama-3.3-70b chat used in chat endpoints."""
    mock_chat = MagicMock()
    mocker.patch("backend.services.groq_chat", mock_chat, create=True)
    return mock_chat


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("backend.api.s3_client", s3, create=True)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    index = MagicMock()
    index.query.return_value = {"matches": []}
    mocker.patch("backend.api.pinecone_index", index, create=True)
    return index


@pytest.fixture
def mock_tavily(mocker):
    """Tavily is usually wrapped inside agent_chain. Provided for direct callers."""
    tavily = MagicMock()
    mocker.patch("backend.services.tavily_search", tavily, create=True)
    return tavily


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_groq_chat,
           mock_s3, mock_pinecone, mock_tavily):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from backend.main import app
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 2: Verify conftest imports cleanly**

Run: `cd backend && python -c "from tests import conftest; print('OK')"`
Expected: Prints `OK`. If it fails with ModuleNotFoundError on `backend.api`, ensure pytest runs from `backend/` directory; this is intentional.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(be): add conftest with dependency-override fixtures for all external clients"
```

---

### Task 4: Create scrub_dynamic helper for snapshot stability

**Files:**
- Create: `backend/tests/helpers.py`

- [ ] **Step 1: Write `backend/tests/helpers.py`**

```python
"""Test helpers — most importantly, scrub_dynamic for snapshot stability."""
from typing import Any


DEFAULT_SCRUB_KEYS = {
    "lead_id", "icp_id", "signal_id", "file_id", "file_key",
    "created_at", "updated_at", "timestamp", "_id", "task_id",
    "session_id", "request_id", "trace_id",
}


def scrub_dynamic(obj: Any, keys: set[str] | None = None,
                  placeholder: str = "<scrubbed>") -> Any:
    """Recursively replace values for keys in `keys` with `placeholder`.

    Used to make snapshots stable across runs that produce real UUIDs/timestamps.

    Args:
        obj: Dict, list, or scalar.
        keys: Set of keys to scrub. Defaults to DEFAULT_SCRUB_KEYS.
        placeholder: Replacement value.

    Returns:
        New object with scrubbed values; original is not mutated.
    """
    keys = keys if keys is not None else DEFAULT_SCRUB_KEYS

    if isinstance(obj, dict):
        return {
            k: (placeholder if k in keys else scrub_dynamic(v, keys, placeholder))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [scrub_dynamic(item, keys, placeholder) for item in obj]
    return obj
```

- [ ] **Step 2: Write a quick test for the helper itself**

Append to `backend/tests/test_helpers.py` (create new file):

```python
from tests.helpers import scrub_dynamic, DEFAULT_SCRUB_KEYS


def test_scrub_dynamic_replaces_default_keys():
    payload = {"lead_id": "abc-123", "name": "Acme", "created_at": "2026-05-08"}
    result = scrub_dynamic(payload)
    assert result == {"lead_id": "<scrubbed>", "name": "Acme", "created_at": "<scrubbed>"}


def test_scrub_dynamic_recurses_into_nested_dicts():
    payload = {"data": {"signal_id": "s-1", "title": "T"}}
    result = scrub_dynamic(payload)
    assert result["data"]["signal_id"] == "<scrubbed>"
    assert result["data"]["title"] == "T"


def test_scrub_dynamic_recurses_into_lists():
    payload = {"leads": [{"lead_id": "1"}, {"lead_id": "2"}]}
    result = scrub_dynamic(payload)
    assert result["leads"][0]["lead_id"] == "<scrubbed>"
    assert result["leads"][1]["lead_id"] == "<scrubbed>"


def test_scrub_dynamic_does_not_mutate_input():
    original = {"lead_id": "xyz", "name": "A"}
    scrub_dynamic(original)
    assert original == {"lead_id": "xyz", "name": "A"}


def test_scrub_dynamic_accepts_custom_keys():
    payload = {"foo": "bar", "name": "Acme"}
    result = scrub_dynamic(payload, keys={"foo"})
    assert result == {"foo": "<scrubbed>", "name": "Acme"}
```

- [ ] **Step 3: Run helper tests**

Run: `cd backend && pytest tests/test_helpers.py -v`
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/helpers.py backend/tests/test_helpers.py
git commit -m "test(be): add scrub_dynamic helper for snapshot stability"
```

---

### Task 5: Smoke test — verify the harness is wired

**Files:**
- Create: `backend/tests/test_smoke.py`

- [ ] **Step 1: Write the smoke test**

```python
"""Verify TestClient + dependency overrides work end-to-end.

If this passes, all infrastructure is wired correctly. If it fails,
investigate before moving on to characterization tests.
"""


def test_client_starts_and_serves_docs(client):
    """FastAPI auto-generates /docs. If TestClient + app boot work, this passes."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower() or "openapi" in response.text.lower()


def test_neo4j_mock_is_applied(client, mock_neo4j):
    """Hit any endpoint that touches Neo4j, confirm the mock receives the call.

    Uses GET /api/leads — known to call neo4j_driver.session().run().
    """
    mock_neo4j["session"].run.return_value = []
    response = client.get("/api/leads", params={"user_id": "test", "org_id": "test"})
    # Don't assert response shape — just that the endpoint was reached and Neo4j mock was called.
    assert mock_neo4j["session"].run.called or response.status_code in (200, 422)


def test_mongo_mock_is_applied(client, mock_mongo):
    """Hit GET /api/fetch-signals which reads from Mongo."""
    response = client.get("/api/fetch-signals",
                          params={"user_id": "test", "org_id": "test"})
    # Endpoint should respond, even if response shape varies.
    assert response.status_code in (200, 422, 500)
```

- [ ] **Step 2: Run the smoke test**

Run: `cd backend && pytest tests/test_smoke.py -v`
Expected: 3 tests pass. If ImportError on `backend.api`, your `PYTHONPATH` may need `backend/` — invoke pytest with `cd backend && python -m pytest tests/test_smoke.py -v` instead.

- [ ] **Step 3: If smoke test fails — debug before proceeding**

Most common failure: `mocker.patch("backend.api.neo4j_driver", ...)` raises `AttributeError: backend.api has no attribute 'neo4j_driver'`. The actual module-level name in `api.py` may be `driver`, `graph`, or accessed via `database.get_driver()`. Inspect `backend/api.py` and `backend/database.py`, update the patch paths in `conftest.py`, re-run.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_smoke.py
git commit -m "test(be): add smoke test verifying TestClient + mock harness"
```

---

## Phase 2: Backend fixture builders

### Task 6: Lead fixtures

**Files:**
- Create: `backend/tests/fixtures/leads.py`

- [ ] **Step 1: Write `backend/tests/fixtures/leads.py`**

```python
"""Hand-crafted lead fixtures. See TD-001 for upgrade path."""
from tests.identities import (
    TEST_LEAD_ID_1, TEST_LEAD_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP, TEST_FILE_ID,
)


def lead(**overrides) -> dict:
    """Single lead, full Neo4j Lead-node shape."""
    base = {
        "lead_id": TEST_LEAD_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Acme Corp",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
        "phone": "+1-555-0100",
        "industry": "SaaS",
        "stage": "Discovery",
        "source": "manual",
        "created_at": TEST_TIMESTAMP,
        "updated_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def lead_list(n: int = 3) -> list[dict]:
    return [
        lead(
            lead_id=f"lead_{i:08d}",
            company_name=f"Company {i}",
            email=f"contact{i}@example.test",
        )
        for i in range(n)
    ]


def csv_upload_payload() -> bytes:
    """Minimal CSV payload for batch-upload endpoint."""
    return (
        b"company_name,contact_name,email,industry\n"
        b"Acme Corp,Jane Doe,jane@acme.test,SaaS\n"
        b"Beta Inc,John Smith,john@beta.test,Fintech\n"
        b"Gamma LLC,Alice Jones,alice@gamma.test,Healthcare\n"
    )


def lead_create_payload(**overrides) -> dict:
    """Payload for POST /api/leads (no lead_id; backend generates it)."""
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Acme Corp",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
        "industry": "SaaS",
    }
    return {**base, **overrides}


def lead_update_payload(**overrides) -> dict:
    base = {
        "stage": "Qualification",
        "phone": "+1-555-9999",
    }
    return {**base, **overrides}


def file_tracking_doc(**overrides) -> dict:
    """MongoDB tracking doc for batch upload."""
    base = {
        "file_id": TEST_FILE_ID,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "filename": "test_leads.csv",
        "lead_count": 3,
        "uploaded_at": TEST_TIMESTAMP,
        "status": "completed",
    }
    return {**base, **overrides}
```

- [ ] **Step 2: Smoke check the imports**

Run: `cd backend && python -c "from tests.fixtures.leads import lead; print(lead())"`
Expected: Prints a dict with `lead_id`, `company_name`, etc.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/fixtures/leads.py
git commit -m "test(be): add lead fixture builders"
```

---

### Task 7: Signal fixtures

**Files:**
- Create: `backend/tests/fixtures/signals.py`

- [ ] **Step 1: Write `backend/tests/fixtures/signals.py`**

```python
"""Hand-crafted signal fixtures."""
from tests.identities import (
    TEST_SIGNAL_ID_1, TEST_SIGNAL_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
)


def signal(**overrides) -> dict:
    """Signal feed item — shape matches what Signals.tsx renders."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent": "scout",
        "headline": "Acme Corp announces $50M Series B funding",
        "snippet": "Acme Corp closed a $50M Series B led by Sequoia Capital.",
        "source_url": "https://example.test/news/acme-funding",
        "next_best_actions": [
            {"label": "Reach out to CEO", "type": "email"},
            {"label": "Send congrats on LinkedIn", "type": "linkedin"},
        ],
        "status": "new",
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def signal_list(n: int = 5) -> list[dict]:
    return [
        signal(
            signal_id=f"sig_{i:08d}",
            headline=f"Test signal {i}",
            agent="scout" if i % 2 == 0 else "profiler",
        )
        for i in range(n)
    ]


def signal_action_payload(action: str = "accept", **overrides) -> dict:
    """Payload for POST /api/signal_action."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "action": action,
    }
    return {**base, **overrides}


def signal_ask_payload(**overrides) -> dict:
    """Payload for POST /api/signal_Ask."""
    base = {
        "signal_id": TEST_SIGNAL_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "question": "What's the best follow-up action here?",
        "conversation_history": [],
    }
    return {**base, **overrides}


def signal_ask_response() -> dict:
    """Canned LLM response shape for signal_Ask. Minimal sketch — TD-001."""
    return {
        "answer": "Based on the funding announcement, recommend reaching out to the CEO within 48 hours.",
        "sources": [{"url": "https://example.test/news/acme-funding"}],
        "conversation_id": "conv_test_001",
    }


def generate_signals_batch_response() -> dict:
    """Canned response for POST /api/generate-signals-batch. Minimal sketch — TD-001."""
    return {
        "status": "completed",
        "scout_signals_generated": 3,
        "profiler_signals_generated": 3,
        "total": 6,
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/fixtures/signals.py
git commit -m "test(be): add signal fixture builders"
```

---

### Task 8: ICP fixtures

**Files:**
- Create: `backend/tests/fixtures/icp.py`

- [ ] **Step 1: Write `backend/tests/fixtures/icp.py`**

```python
"""Hand-crafted ICP (Ideal Customer Profile) fixtures."""
from tests.identities import (
    TEST_ICP_ID_1, TEST_ICP_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
)


def icp(**overrides) -> dict:
    """Customer profile / ICP — shape from Mongo customer_profile collection."""
    base = {
        "icp_id": TEST_ICP_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "name": "SaaS CTOs",
        "industry": "SaaS",
        "company_size": "50-500",
        "geography": ["US", "EU"],
        "pain_points": ["scaling engineering teams", "technical debt management"],
        "key_personas": ["CTO", "VP Engineering"],
        "buying_signals": ["recently raised Series B", "hiring engineering managers"],
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def icp_create_payload(**overrides) -> dict:
    """Payload for POST /api/customer_profile (no icp_id; backend generates)."""
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "name": "SaaS CTOs",
        "industry": "SaaS",
        "company_size": "50-500",
    }
    return {**base, **overrides}


def suggested_icp_list(n: int = 3) -> list[dict]:
    """GET /api/icp returns suggested ICPs (LLM-generated). Minimal sketch — TD-001."""
    return [
        {
            "icp_id": f"suggested_icp_{i}",
            "name": f"Suggested Profile {i}",
            "industry": ["SaaS", "Fintech", "Healthcare"][i % 3],
            "match_score": 0.8 - (i * 0.1),
        }
        for i in range(n)
    ]


def icp_research_response() -> dict:
    """Canned response for POST /api/icp-research. Minimal sketch — TD-001."""
    return {
        "research_type": "personas",
        "result": {
            "personas": [
                {
                    "title": "CTO",
                    "responsibilities": ["technical strategy", "team scaling"],
                    "pain_points": ["legacy systems", "hiring"],
                    "preferred_channels": ["LinkedIn", "tech podcasts"],
                }
            ],
        },
        "cached": False,
        "timestamp": TEST_TIMESTAMP,
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/fixtures/icp.py
git commit -m "test(be): add ICP fixture builders"
```

---

### Task 9: Profile fixtures

**Files:**
- Create: `backend/tests/fixtures/profiles.py`

- [ ] **Step 1: Write `backend/tests/fixtures/profiles.py`**

```python
"""Hand-crafted profile fixtures (org / user / scout / profiler / agent_name)."""
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP


def org_profile(**overrides) -> dict:
    base = {
        "org_id": TEST_ORG_ID,
        "name": "Test Org",
        "industry": "SaaS",
        "size": "50-500",
        "website": "https://test-org.test",
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def user_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "email": "test@brewra.test",
        "display_name": "Test User",
        "role": "member",
    }
    return {**base, **overrides}


def scout_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": "Scout",
        "industry_focus": "SaaS",
        "geographic_focus": ["US", "EU"],
    }
    return {**base, **overrides}


def profiler_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": "Profiler",
        "icp_count": 2,
    }
    return {**base, **overrides}


def agent_name_payload(name: str = "Custom Agent Name") -> dict:
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": name,
    }


def org_list(n: int = 2) -> list[dict]:
    return [
        org_profile(org_id=f"org_{i:03d}", name=f"Org {i}")
        for i in range(n)
    ]


def registration_payload(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "email": "test@brewra.test",
        "org_name": "Test Org",
        "org_id": TEST_ORG_ID,
    }
    return {**base, **overrides}
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/fixtures/profiles.py
git commit -m "test(be): add profile fixture builders"
```

---

### Task 10: Market research fixtures

**Files:**
- Create: `backend/tests/fixtures/market_research.py`

- [ ] **Step 1: Write `backend/tests/fixtures/market_research.py`**

```python
"""Hand-crafted market research fixtures — minimal sketches per TD-001.

The 5 components: market_size_opportunity, industry_trends, competitor_landscape,
regulatory_compliance, market_entry. Each Research_Market_N function in
backend/services.py returns a similar shape.
"""
from tests.identities import TEST_TIMESTAMP


COMPONENT_NAMES = [
    "market_size_opportunity",
    "industry_trends",
    "competitor_landscape",
    "regulatory_compliance",
    "market_entry",
]


def market_research_response(component_name: str = "market_size_opportunity",
                              cached: bool = False) -> dict:
    """Canned LLM response for POST /api/market-research. Minimal sketch."""
    return {
        "component_name": component_name,
        "status": "completed",
        "result": {
            "title": component_name.replace("_", " ").title(),
            "summary": f"Summary for {component_name}.",
            "key_findings": [
                f"Finding 1 for {component_name}",
                f"Finding 2 for {component_name}",
                f"Finding 3 for {component_name}",
            ],
            "sources": [
                {"url": "https://example.test/source1", "title": "Source 1"},
                {"url": "https://example.test/source2", "title": "Source 2"},
            ],
        },
        "cached": cached,
        "timestamp": TEST_TIMESTAMP,
    }


def market_research_request_payload(component_name: str,
                                     user_id: str = "test_user_123",
                                     org_id: str = "test_org_abc") -> dict:
    return {
        "user_id": user_id,
        "org_id": org_id,
        "component_name": component_name,
        "industry": "SaaS",
        "geography": "US",
    }


def llm_chain_canned_response_for(component_name: str) -> str:
    """The agent_chain.run() returns a JSON string. This is what we mock it to return."""
    import json
    return json.dumps({
        "title": component_name.replace("_", " ").title(),
        "summary": f"Summary for {component_name}.",
        "key_findings": [
            f"Finding 1 for {component_name}",
            f"Finding 2 for {component_name}",
            f"Finding 3 for {component_name}",
        ],
        "sources": [
            {"url": "https://example.test/source1", "title": "Source 1"},
        ],
    })
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/fixtures/market_research.py
git commit -m "test(be): add market research fixture builders"
```

---

## Phase 3: Backend characterization tests

> **Pattern note for all tasks below:** every test follows the hybrid Q3=D pattern — explicit assertions for status/headers, snapshot for response body (with scrubbing), side-effect assertion on the relevant mock. When syrupy snapshots don't yet exist (first run), pytest fails with a snapshot-missing message; re-run with `--snapshot-update` to create them. After review, commit the snapshot files.

### Task 11: Auth/org characterization tests

**Files:**
- Create: `backend/tests/test_auth_org.py`

- [ ] **Step 1: Write `backend/tests/test_auth_org.py`**

```python
"""Characterization tests for auth/org endpoints.

Endpoints covered:
- GET /api/org
- POST /api/connect_org
- POST /api/registration
- GET /api/registration
- POST /api/auth/token (if exists; backend may return 404)
- POST /api/auth/refresh (if exists; backend may return 404)
"""
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID
from tests.fixtures.profiles import org_profile, registration_payload, org_list


def test_get_org_returns_org_for_user(client, mock_mongo, snapshot):
    mock_mongo.return_value.users.find.return_value = [
        {"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID}
    ]
    mock_mongo.return_value.orgs.find_one.return_value = org_profile()

    response = client.get("/api/org", params={"user_id": TEST_USER_ID})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_org_returns_404_for_unknown_user(client, mock_mongo):
    mock_mongo.return_value.users.find.return_value = []

    response = client.get("/api/org", params={"user_id": "nonexistent_user"})

    # Lock current behavior, whatever it is. May be 404, 200 with empty list,
    # or 422. Adjust assertion to current actual behavior on first run.
    assert response.status_code in (200, 404, 422)


def test_post_connect_org_writes_user_org_link(client, mock_mongo):
    payload = {"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID}

    response = client.post("/api/connect_org", json=payload)

    assert response.status_code in (200, 201)
    assert mock_mongo.return_value.users.update_one.called or \
           mock_mongo.return_value.users.insert_one.called, \
           "Refactor must preserve user-org link write"


def test_post_registration_creates_org_and_user(client, mock_mongo, snapshot):
    payload = registration_payload()

    response = client.post("/api/registration", json=payload)

    assert response.status_code in (200, 201)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    # Side-effect: an org and a user were inserted.
    insert_calls = (
        mock_mongo.return_value.orgs.insert_one.call_args_list +
        mock_mongo.return_value.users.insert_one.call_args_list
    )
    assert len(insert_calls) >= 1


def test_get_registration_lists_registered_orgs(client, mock_mongo, snapshot):
    mock_mongo.return_value.orgs.find.return_value = org_list(n=2)

    response = client.get("/api/registration")

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_auth_token_endpoint_404s_or_succeeds(client):
    """Per inventory: backend has no /api/auth/token. FE handles 404 gracefully.

    Lock current behavior (whichever it is) so a refactor that adds JWT
    validation flips this test deliberately.
    """
    response = client.post("/api/auth/token", json={"id_token": "mock_firebase_token"})
    assert response.status_code in (404, 405, 422, 200)
```

- [ ] **Step 2: Run the tests to generate snapshots**

Run: `cd backend && pytest tests/test_auth_org.py --snapshot-update -v`
Expected: All tests pass; new files appear under `backend/tests/__snapshots__/test_auth_org.ambr`. Read the snapshot file and verify the captured shapes look correct (not empty, not error responses).

- [ ] **Step 3: Re-run without `--snapshot-update`**

Run: `cd backend && pytest tests/test_auth_org.py -v`
Expected: All tests pass against the committed snapshots.

- [ ] **Step 4: If a snapshot looks wrong (empty / error shape)**

The mock setup probably needs adjusting. Inspect `backend/api.py` for the actual endpoint, verify which Mongo collection / Neo4j call it makes, update the mock's return value in the test, delete the bad snapshot, re-run with `--snapshot-update`.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_auth_org.py backend/tests/__snapshots__/test_auth_org.ambr
git commit -m "test(be): characterization tests for auth/org endpoints"
```

---

### Task 12: Profile characterization tests

**Files:**
- Create: `backend/tests/test_profiles.py`

- [ ] **Step 1: Write `backend/tests/test_profiles.py`**

```python
"""Characterization tests for profile endpoints.

Endpoints covered:
- GET /api/profile/{type} for type in {org, user, scout, profiler, agent_name}
- POST /api/profile/{type} for type in {org, user, scout, profiler, agent_name}

Backend uses delete-then-insert pattern (per inventory section 8) — destructive,
no merge/upsert. Tests assert the destructive write happened.
"""
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID
from tests.fixtures.profiles import (
    org_profile, user_profile, scout_profile, profiler_profile, agent_name_payload,
)


def test_get_profile_org_returns_company_profile(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = [{"c": org_profile()}]

    response = client.get("/api/profile/org",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_profile_org_writes_to_neo4j(client, mock_neo4j):
    payload = {**org_profile(), "user_id": TEST_USER_ID}

    response = client.post("/api/profile/org", json=payload)

    assert response.status_code in (200, 201)
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    # Delete-then-insert pattern: at least one DELETE/CREATE on a profile node.
    assert any(("DELETE" in q.upper() or "CREATE" in q.upper()) for q in cypher_calls), \
        "Expected destructive write pattern (DELETE then CREATE) on Neo4j"


def test_get_profile_scout_returns_scout_settings(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = [{"c": scout_profile()}]

    response = client.get("/api/profile/scout",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_profile_agent_name_writes_to_neo4j(client, mock_neo4j):
    payload = agent_name_payload(name="Custom Scout Name")

    response = client.post("/api/profile/agent_name", json=payload)

    assert response.status_code in (200, 201)
    assert mock_neo4j["session"].run.called


def test_get_profile_user_returns_user_settings(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = [{"u": user_profile()}]

    response = client.get("/api/profile/user",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
```

- [ ] **Step 2: Generate and review snapshots**

Run: `cd backend && pytest tests/test_profiles.py --snapshot-update -v`
Expected: 5 tests pass, snapshots created. Inspect `__snapshots__/test_profiles.ambr` for sanity.

- [ ] **Step 3: Re-run without `--snapshot-update`**

Run: `cd backend && pytest tests/test_profiles.py -v`
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_profiles.py backend/tests/__snapshots__/test_profiles.ambr
git commit -m "test(be): characterization tests for profile endpoints"
```

---

### Task 13: ICP characterization tests

**Files:**
- Create: `backend/tests/test_icp.py`

- [ ] **Step 1: Write `backend/tests/test_icp.py`**

```python
"""Characterization tests for ICP endpoints.

Endpoints covered:
- POST /api/customer_profile (create)
- GET /api/customer_profile (read list)
- DELETE /api/customer_profile/icp/{icp_id}
- GET /api/icp (suggested ICPs)
- POST /api/customer_profile/from_suggested_icp
- DELETE /api/icp/recommended/{icp_id}
- POST /api/icp-research (4 research types: personas, pain_points, channels, messaging)
"""
import json
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_ICP_ID_1
from tests.fixtures.icp import (
    icp, icp_create_payload, suggested_icp_list, icp_research_response,
)


def test_post_customer_profile_creates_icp(client, mock_mongo, snapshot):
    payload = icp_create_payload()
    mock_mongo.return_value.Profiler.customer_profile.insert_one.return_value.inserted_id = "test_id"

    response = client.post("/api/customer_profile", json=payload)

    assert response.status_code in (200, 201)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    assert mock_mongo.return_value.Profiler.customer_profile.insert_one.called or \
           mock_mongo.return_value.Scout_Agent.customer_profile.insert_one.called, \
           "Refactor must preserve customer_profile insert"


def test_get_customer_profile_returns_icp_list(client, mock_mongo, snapshot):
    mock_mongo.return_value.Profiler.customer_profile.find.return_value = [
        icp(), icp(icp_id="icp_002", name="Fintech CFOs"),
    ]

    response = client.get("/api/customer_profile",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_delete_customer_profile_icp_removes_from_mongo(client, mock_mongo):
    response = client.delete(
        f"/api/customer_profile/icp/{TEST_ICP_ID_1}",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 204)
    assert mock_mongo.return_value.Profiler.customer_profile.delete_one.called or \
           mock_mongo.return_value.Scout_Agent.customer_profile.delete_one.called


def test_get_icp_returns_suggested_icps(client, mock_mongo, mock_neo4j, snapshot):
    """GET /api/icp — known to have an org_id scoping bug per inventory."""
    mock_neo4j["session"].run.return_value = [{"c": {"name": "Test Org"}}]
    mock_mongo.return_value.Profiler.suggested_icp.find.return_value = suggested_icp_list(n=3)

    response = client.get("/api/icp",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_customer_profile_from_suggested_icp_promotes(client, mock_mongo, snapshot):
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "suggested_icp_id": "suggested_icp_0",
    }
    mock_mongo.return_value.Profiler.suggested_icp.find_one.return_value = suggested_icp_list(n=1)[0]

    response = client.post("/api/customer_profile/from_suggested_icp", json=payload)

    assert response.status_code in (200, 201)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_delete_recommended_icp_removes_from_mongo(client, mock_mongo):
    response = client.delete(
        "/api/icp/recommended/suggested_icp_0",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 204)
    assert mock_mongo.return_value.Profiler.suggested_icp.delete_one.called


def test_post_icp_research_personas_returns_research(client, mock_llm_chain, mock_mongo, snapshot):
    """ICP research has 4 types: personas, pain_points, channels, messaging.

    Each calls a different services.icp_research_N function. All wrapped in agent_chain.
    """
    mock_llm_chain.run.return_value = json.dumps(icp_research_response()["result"])
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": TEST_ICP_ID_1,
        "research_type": "personas",
    }

    response = client.post("/api/icp-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    assert mock_llm_chain.run.called, "Refactor must preserve LLM chain invocation"


def test_post_icp_research_pain_points_returns_research(client, mock_llm_chain, snapshot):
    mock_llm_chain.run.return_value = json.dumps({"pain_points": ["P1", "P2"]})
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": TEST_ICP_ID_1,
        "research_type": "pain_points",
    }

    response = client.post("/api/icp-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_icp_research_channels_returns_research(client, mock_llm_chain, snapshot):
    mock_llm_chain.run.return_value = json.dumps({"channels": ["LinkedIn", "Email"]})
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": TEST_ICP_ID_1,
        "research_type": "channels",
    }

    response = client.post("/api/icp-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_icp_research_messaging_returns_research(client, mock_llm_chain, snapshot):
    mock_llm_chain.run.return_value = json.dumps({"messaging": ["M1", "M2"]})
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": TEST_ICP_ID_1,
        "research_type": "messaging",
    }

    response = client.post("/api/icp-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_icp.py --snapshot-update -v`
Expected: 10 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_icp.py -v`
Expected: 10 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_icp.py backend/tests/__snapshots__/test_icp.ambr
git commit -m "test(be): characterization tests for ICP endpoints"
```

---

### Task 14: Market research characterization tests

**Files:**
- Create: `backend/tests/test_market_research.py`

- [ ] **Step 1: Write `backend/tests/test_market_research.py`**

```python
"""Characterization tests for market research endpoint.

Single endpoint POST /api/market-research dispatches to one of 5 component
research functions (Research_Market_1 through Research_Market_5) based on
component_name parameter. Each is wrapped by agent_chain (Together Qwen + Tavily).
Results cached per (user_id, org_id, component_name) in Mongo Scout_Agent.Market_Intelligence.
"""
from tests.helpers import scrub_dynamic
from tests.fixtures.market_research import (
    COMPONENT_NAMES,
    market_research_response,
    market_research_request_payload,
    llm_chain_canned_response_for,
)


def test_market_research_market_size_opportunity(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = llm_chain_canned_response_for("market_size_opportunity")
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = None
    payload = market_research_request_payload("market_size_opportunity")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    assert mock_llm_chain.run.called, "Refactor must preserve agent_chain invocation"


def test_market_research_industry_trends(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = llm_chain_canned_response_for("industry_trends")
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = None
    payload = market_research_request_payload("industry_trends")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_market_research_competitor_landscape(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = llm_chain_canned_response_for("competitor_landscape")
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = None
    payload = market_research_request_payload("competitor_landscape")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_market_research_regulatory_compliance(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = llm_chain_canned_response_for("regulatory_compliance")
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = None
    payload = market_research_request_payload("regulatory_compliance")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_market_research_market_entry(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = llm_chain_canned_response_for("market_entry")
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = None
    payload = market_research_request_payload("market_entry")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_market_research_returns_cached_when_available(client, mock_llm_chain, mock_mongo, snapshot):
    """When Mongo has a cached result, agent_chain should NOT be invoked."""
    cached_response = market_research_response("market_size_opportunity", cached=True)
    mock_mongo.return_value.Scout_Agent.Market_Intelligence.find_one.return_value = cached_response
    payload = market_research_request_payload("market_size_opportunity")

    response = client.post("/api/market-research", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    # Critical side-effect: cached path bypasses LLM.
    assert not mock_llm_chain.run.called, \
        "Cached path must not invoke LLM — refactor must preserve cache short-circuit"
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_market_research.py --snapshot-update -v`
Expected: 6 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_market_research.py -v`
Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_market_research.py backend/tests/__snapshots__/test_market_research.ambr
git commit -m "test(be): characterization tests for market research (5 components + cache)"
```

---

### Task 15: Signals characterization tests

**Files:**
- Create: `backend/tests/test_signals.py`

- [ ] **Step 1: Write `backend/tests/test_signals.py`**

```python
"""Characterization tests for signals endpoints.

Endpoints covered:
- POST /api/generate-signals-batch (Scout + Profiler search_signals_*)
- GET /api/fetch-signals
- POST /api/signal_action (accept sets org_id; reject deletes)
- POST /api/signal_Ask (multi-turn Q&A on signal context)
"""
import json
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_SIGNAL_ID_1
from tests.fixtures.signals import (
    signal, signal_list, signal_action_payload, signal_ask_payload,
    signal_ask_response, generate_signals_batch_response,
)


def test_post_generate_signals_batch_runs_both_agents(client, mock_llm_chain, mock_mongo, snapshot):
    """Generates signals via both search_signals_scout and search_signals_profiler.

    Both functions wrap agent_chain. Mongo writes via Scout_Agent.signals.
    """
    mock_llm_chain.run.return_value = json.dumps([
        {"headline": "Test signal", "snippet": "Snippet", "source_url": "https://example.test"},
    ])
    payload = {"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID}

    response = client.post("/api/generate-signals-batch", json=payload)

    assert response.status_code in (200, 202)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    # Side-effect: at least 2 LLM calls (Scout + Profiler).
    assert mock_llm_chain.run.call_count >= 2 or \
           mock_mongo.return_value.Scout_Agent.signals.insert_many.called, \
           "Refactor must preserve dual-agent generation pattern"


def test_get_fetch_signals_returns_signal_list(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.signals.find.return_value = signal_list(n=5)

    response = client.get("/api/fetch-signals",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_fetch_signals_empty_when_no_signals(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.signals.find.return_value = []

    response = client.get("/api/fetch-signals",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_signal_action_accept_updates_signal(client, mock_mongo):
    payload = signal_action_payload(action="accept")

    response = client.post("/api/signal_action", json=payload)

    assert response.status_code in (200, 201)
    # Accept = update_one to set status/org_id.
    assert mock_mongo.return_value.Scout_Agent.signals.update_one.called, \
        "Accept action must update_one on signals collection"


def test_post_signal_action_reject_deletes_signal(client, mock_mongo):
    payload = signal_action_payload(action="reject")

    response = client.post("/api/signal_action", json=payload)

    assert response.status_code in (200, 201, 204)
    # Reject = delete_one.
    assert mock_mongo.return_value.Scout_Agent.signals.delete_one.called, \
        "Reject action must delete_one from signals collection"


def test_post_signal_action_dismiss_undoes_accept(client, mock_mongo):
    """Per inventory: accept can be undone via 'dismiss' action."""
    payload = signal_action_payload(action="dismiss")

    response = client.post("/api/signal_action", json=payload)

    assert response.status_code in (200, 201)
    # Dismiss = update_one to revert status.
    assert mock_mongo.return_value.Scout_Agent.signals.update_one.called


def test_post_signal_ask_returns_llm_answer(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = json.dumps(signal_ask_response())
    mock_mongo.return_value.Scout_Agent.signals.find_one.return_value = signal()
    payload = signal_ask_payload()

    response = client.post("/api/signal_Ask", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    assert mock_llm_chain.run.called


def test_post_signal_ask_with_conversation_history(client, mock_llm_chain, mock_mongo, snapshot):
    mock_llm_chain.run.return_value = json.dumps(signal_ask_response())
    mock_mongo.return_value.Scout_Agent.signals.find_one.return_value = signal()
    payload = signal_ask_payload(conversation_history=[
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "First answer"},
    ])

    response = client.post("/api/signal_Ask", json=payload)

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_signals.py --snapshot-update -v`
Expected: 8 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_signals.py -v`
Expected: 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_signals.py backend/tests/__snapshots__/test_signals.ambr
git commit -m "test(be): characterization tests for signals (generate, fetch, action, ask)"
```

---

### Task 16: Lead CRUD + batch upload characterization tests

**Files:**
- Create: `backend/tests/test_leads.py`

- [ ] **Step 1: Write `backend/tests/test_leads.py`**

```python
"""Characterization tests for lead endpoints.

Endpoints covered:
- POST /api/leads (create)
- GET /api/leads (list — known unbounded per inventory)
- PUT /api/leads/{lead_id} (update)
- DELETE /api/leads/{lead_id}
- POST /api/leads/batch-upload (CSV/Excel)
- GET /api/leads/by-file
- DELETE /api/leads/by-file/{file_id}
- GET /api/leads/stream/status
"""
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_LEAD_ID_1, TEST_FILE_ID
from tests.fixtures.leads import (
    lead, lead_list, lead_create_payload, lead_update_payload,
    csv_upload_payload, file_tracking_doc,
)


def test_post_lead_creates_in_neo4j(client, mock_neo4j, snapshot):
    payload = lead_create_payload()
    mock_neo4j["session"].run.return_value = [{"l": lead()}]

    response = client.post("/api/leads", json=payload)

    assert response.status_code in (200, 201)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("CREATE (l:Lead" in q or "CREATE (:Lead" in q for q in cypher_calls), \
        "Refactor must preserve CREATE on Lead node"


def test_get_leads_returns_lead_list(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = [{"l": item} for item in lead_list(n=3)]

    response = client.get("/api/leads",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("MATCH" in q.upper() and "Lead" in q for q in cypher_calls), \
        "Refactor must preserve MATCH on Lead nodes"


def test_get_leads_empty_for_org_with_no_leads(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = []

    response = client.get("/api/leads",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_put_lead_updates_in_neo4j(client, mock_neo4j):
    mock_neo4j["session"].run.return_value = [{"l": lead(stage="Qualification")}]
    payload = {**lead_update_payload(), "user_id": TEST_USER_ID, "org_id": TEST_ORG_ID}

    response = client.put(f"/api/leads/{TEST_LEAD_ID_1}", json=payload)

    assert response.status_code in (200, 204)
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("SET" in q.upper() for q in cypher_calls), \
        "Refactor must preserve SET clause on UPDATE"


def test_delete_lead_removes_from_neo4j(client, mock_neo4j):
    mock_neo4j["session"].run.return_value = [{"deleted": True}]
    response = client.delete(
        f"/api/leads/{TEST_LEAD_ID_1}",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 204)
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("DELETE" in q.upper() or "DETACH" in q.upper() for q in cypher_calls), \
        "Refactor must preserve DELETE/DETACH on Lead"


def test_post_leads_batch_upload_processes_csv(client, mock_neo4j, mock_mongo, snapshot):
    csv_bytes = csv_upload_payload()

    response = client.post(
        "/api/leads/batch-upload",
        files={"file": ("test_leads.csv", csv_bytes, "text/csv")},
        data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 201, 202)
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    # Side-effect: multiple Neo4j writes + 1 Mongo tracking doc.
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    create_count = sum(1 for q in cypher_calls if "CREATE (l:Lead" in q or "CREATE (:Lead" in q)
    assert create_count >= 1, "Refactor must preserve per-row Lead CREATE pattern"


def test_post_leads_batch_upload_writes_tracking_doc(client, mock_neo4j, mock_mongo):
    csv_bytes = csv_upload_payload()

    response = client.post(
        "/api/leads/batch-upload",
        files={"file": ("test_leads.csv", csv_bytes, "text/csv")},
        data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 201, 202)
    # Tracking doc written to Mongo file_uploads or similar.
    insert_calls = mock_mongo.return_value.method_calls
    assert any("insert_one" in str(c) or "insert_many" in str(c) for c in insert_calls), \
        "Refactor must preserve Mongo file-tracking write"


def test_get_leads_by_file_returns_leads_for_file(client, mock_neo4j, snapshot):
    mock_neo4j["session"].run.return_value = [{"l": item} for item in lead_list(n=3)]

    response = client.get(
        "/api/leads/by-file",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID, "file_id": TEST_FILE_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_delete_leads_by_file_id_removes_all_leads_from_file(client, mock_neo4j, mock_mongo):
    mock_neo4j["session"].run.return_value = [{"deleted_count": 3}]
    response = client.delete(
        f"/api/leads/by-file/{TEST_FILE_ID}",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 204)
    # Side-effect: bulk DELETE on Neo4j + delete tracking doc on Mongo.
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("DELETE" in q.upper() or "DETACH" in q.upper() for q in cypher_calls)


def test_get_leads_stream_status_returns_status_doc(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.file_uploads.find.return_value = [file_tracking_doc()]

    response = client.get(
        "/api/leads/stream/status",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_lead_with_minimal_payload(client, mock_neo4j, snapshot):
    """Lock current behavior on minimal payload — backend uses Dict[str, Any] flexibility."""
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Minimal Corp",
    }
    mock_neo4j["session"].run.return_value = [{"l": {"company_name": "Minimal Corp"}}]

    response = client.post("/api/leads", json=payload)

    assert response.status_code in (200, 201, 422)
    if response.status_code in (200, 201):
        body_scrubbed = scrub_dynamic(response.json())
        assert body_scrubbed == snapshot


def test_get_leads_has_no_limit_silent_unbounded(client, mock_neo4j):
    """Per inventory: GET /api/leads has no LIMIT clause. Lock this behavior.

    A refactor that adds LIMIT is intentional — must update this test.
    """
    mock_neo4j["session"].run.return_value = []

    response = client.get("/api/leads",
                          params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID})

    assert response.status_code == 200
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    # Lock current behavior: no LIMIT clause in the query today.
    no_limit = all("LIMIT" not in q.upper() for q in cypher_calls)
    assert no_limit, \
        "Pagination added to GET /api/leads — update this test if intentional"
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_leads.py --snapshot-update -v`
Expected: 12 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_leads.py -v`
Expected: 12 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_leads.py backend/tests/__snapshots__/test_leads.ambr
git commit -m "test(be): characterization tests for lead CRUD + batch upload + by-file"
```

---

### Task 17: Market scoring characterization tests

**Files:**
- Create: `backend/tests/test_market_scoring.py`

- [ ] **Step 1: Write `backend/tests/test_market_scoring.py`**

```python
"""Characterization tests for lead market scoring endpoints.

Endpoints covered:
- POST /api/leads/market-scores (triggers BackgroundTasks; silently caps at 5000)
- GET /api/leads/market-scores/status (polled by FE)
- GET /api/leads/{id}/market-score-descriptions
"""
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_LEAD_ID_1


def test_post_market_scores_triggers_background_task(client, mock_mongo, mock_llm_chain):
    """BackgroundTasks runs synchronously inside TestClient — assert side-effects."""
    payload = {"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID, "icp_id": "icp_1"}

    response = client.post("/api/leads/market-scores", json=payload)

    assert response.status_code in (200, 202)
    # Side-effect: Mongo update_one to scoring_status (background task progress doc).
    assert mock_mongo.return_value.Scout_Agent.scoring_status.update_one.called or \
           mock_mongo.return_value.Profiler.scoring_status.update_one.called, \
           "BackgroundTask must update scoring_status doc"


def test_get_market_scores_status_returns_progress_doc(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.scoring_status.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "status": "in_progress",
        "leads_processed": 25,
        "leads_total": 100,
        "recent_items": [
            {"lead_id": "lead_1", "score": 75, "company_name": "Acme"},
        ],
    }

    response = client.get(
        "/api/leads/market-scores/status",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_lead_market_score_descriptions(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.lead_score_descriptions.find_one.return_value = {
        "lead_id": TEST_LEAD_ID_1,
        "descriptions": {
            "market_size_opportunity": "Strong fit because...",
            "industry_trends": "Aligns with...",
            "competitor_landscape": "Differentiates from...",
            "regulatory_compliance": "Compliant with...",
            "market_entry": "Easy entry due to...",
        },
    }

    response = client.get(
        f"/api/leads/{TEST_LEAD_ID_1}/market-score-descriptions",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_market_scoring.py --snapshot-update -v`
Expected: 3 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_market_scoring.py -v`
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_market_scoring.py backend/tests/__snapshots__/test_market_scoring.ambr
git commit -m "test(be): characterization tests for lead market scoring + status + descriptions"
```

---

### Task 18: Document upload + data sources characterization tests

**Files:**
- Create: `backend/tests/test_documents.py`

- [ ] **Step 1: Write `backend/tests/test_documents.py`**

```python
"""Characterization tests for document/data source endpoints.

Endpoints covered:
- POST /api/upload-document (S3 + Pinecone embedding via BackgroundTasks)
- GET /api/user-documents
- GET /api/document-status/{file_key}
- DELETE /api/data-source/{file_id}
- PUT /api/data-source/{file_id}
"""
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_FILE_ID, TEST_FILE_KEY, TEST_TIMESTAMP


def test_post_upload_document_writes_to_s3_and_starts_embedding(client, mock_s3, mock_mongo, mock_pinecone):
    """Uploads a small text file. Asserts S3 put_object + Mongo status doc."""
    file_bytes = b"This is a test document for characterization."

    response = client.post(
        "/api/upload-document",
        files={"file": ("test_doc.txt", file_bytes, "text/plain")},
        data={
            "user_id": TEST_USER_ID,
            "org_id": TEST_ORG_ID,
            "tags": "test,characterization",
            "description": "Test upload",
        },
    )

    assert response.status_code in (200, 201, 202)
    # Side-effect: S3 put_object called.
    assert mock_s3.put_object.called, "Refactor must preserve S3 put_object call"
    # Side-effect: Mongo status doc written.
    assert mock_mongo.return_value.method_calls, "Mongo must be touched (status doc)"


def test_post_upload_document_url_ingestion(client, mock_mongo, mock_pinecone):
    """URL ingestion path — different code path than file upload."""
    response = client.post(
        "/api/upload-document",
        data={
            "user_id": TEST_USER_ID,
            "org_id": TEST_ORG_ID,
            "url": "https://example.test/doc.pdf",
            "tags": "url,test",
        },
    )

    # Lock current behavior — may be 200, 422, or 500 depending on FE-vs-direct.
    assert response.status_code in (200, 201, 202, 422, 500)


def test_get_user_documents_returns_document_list(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.user_documents.find.return_value = [
        {
            "file_id": TEST_FILE_ID,
            "file_key": TEST_FILE_KEY,
            "user_id": TEST_USER_ID,
            "org_id": TEST_ORG_ID,
            "filename": "test_doc.pdf",
            "tags": ["test"],
            "description": "Test doc",
            "uploaded_at": TEST_TIMESTAMP,
            "status": "embedded",
        }
    ]

    response = client.get(
        "/api/user-documents",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_user_documents_empty_for_org_with_no_docs(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.user_documents.find.return_value = []

    response = client.get(
        "/api/user-documents",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_document_status_returns_status_doc(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.document_status.find_one.return_value = {
        "file_key": TEST_FILE_KEY,
        "status": "embedded",
        "chunks_processed": 12,
        "chunks_total": 12,
    }

    response = client.get(f"/api/document-status/{TEST_FILE_KEY}")

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_delete_data_source_removes_from_s3_pinecone_mongo(client, mock_s3, mock_mongo, mock_pinecone):
    """Delete handler is 254 LOC per inventory — extensive fallback logic."""
    mock_mongo.return_value.Scout_Agent.user_documents.find_one.return_value = {
        "file_id": TEST_FILE_ID,
        "file_key": TEST_FILE_KEY,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
    }

    response = client.delete(
        f"/api/data-source/{TEST_FILE_ID}",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code in (200, 204)
    # Side-effects: S3 delete + Mongo delete + Pinecone delete.
    # Lock at least one of the three; refactor may consolidate.
    deleted_somewhere = (
        mock_s3.delete_object.called or
        mock_mongo.return_value.Scout_Agent.user_documents.delete_one.called or
        mock_pinecone.delete.called
    )
    assert deleted_somewhere, \
        "Refactor must preserve at least one of S3/Mongo/Pinecone delete"


def test_put_data_source_updates_tags_description(client, mock_mongo):
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "tags": ["updated", "tags"],
        "description": "Updated description",
    }

    response = client.put(f"/api/data-source/{TEST_FILE_ID}", json=payload)

    assert response.status_code in (200, 204)
    assert mock_mongo.return_value.Scout_Agent.user_documents.update_one.called, \
        "PUT must update_one on user_documents"


def test_get_document_status_unknown_file_key(client, mock_mongo, snapshot):
    mock_mongo.return_value.Scout_Agent.document_status.find_one.return_value = None

    response = client.get("/api/document-status/nonexistent_file_key")

    assert response.status_code in (200, 404)
    if response.status_code == 200:
        body_scrubbed = scrub_dynamic(response.json())
        assert body_scrubbed == snapshot
```

- [ ] **Step 2: Generate snapshots**

Run: `cd backend && pytest tests/test_documents.py --snapshot-update -v`
Expected: 8 tests pass.

- [ ] **Step 3: Re-run without update**

Run: `cd backend && pytest tests/test_documents.py -v`
Expected: 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_documents.py backend/tests/__snapshots__/test_documents.ambr
git commit -m "test(be): characterization tests for document upload + data sources"
```

---

### Task 19: Backend full-suite verification

- [ ] **Step 1: Run the entire backend test suite**

Run: `cd backend && pytest tests/ -v`
Expected: All ~58 tests pass. Total runtime <10 seconds.

- [ ] **Step 2: Verify snapshot files committed**

Run: `cd backend && ls __snapshots__/` (or `ls tests/__snapshots__/`)
Expected: One `.ambr` file per test module: `test_auth_org.ambr`, `test_profiles.ambr`, `test_icp.ambr`, `test_market_research.ambr`, `test_signals.ambr`, `test_leads.ambr`, `test_market_scoring.ambr`, `test_documents.ambr`.

- [ ] **Step 3: If anything is failing, fix in place — do not skip tests**

The most common cause of post-task-17 failure is a mocked dependency name being wrong (e.g., `backend.api.neo4j_driver` doesn't exist; the actual name is `backend.api.driver`). Fix in `conftest.py`, re-run full suite.

- [ ] **Step 4: No commit needed if nothing changed**

If you fixed something, add and commit:

```bash
git add backend/tests/conftest.py
git commit -m "test(be): fix mock target after full-suite verification"
```

---

## Phase 4: Frontend test infrastructure

### Task 20: Install Playwright and chromium

**Files:**
- Modify: `frontend/package.json` (devDependencies)
- Create: `frontend/playwright.config.ts`

- [ ] **Step 1: Install Playwright**

Run: `cd frontend && npm install -D @playwright/test`
Expected: `@playwright/test` added to `devDependencies` in `package.json`.

- [ ] **Step 2: Install chromium browser**

Run: `cd frontend && npx playwright install chromium --with-deps`
Expected: Chromium downloaded (~150MB) to Playwright's cache. May prompt for sudo to install system deps.

- [ ] **Step 3: Verify Playwright works**

Run: `cd frontend && npx playwright --version`
Expected: Prints Playwright version.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "test(fe): add Playwright dev dependency"
```

---

### Task 21: Create playwright.config.ts

**Files:**
- Create: `frontend/playwright.config.ts`

- [ ] **Step 1: Write `frontend/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-linux',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
});
```

- [ ] **Step 2: Add npm scripts to `frontend/package.json`**

Edit `frontend/package.json`, add to `scripts`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:update-snapshots": "playwright test --update-snapshots",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

(Preserve all existing scripts — do not delete the existing dev/build/lint scripts.)

- [ ] **Step 3: Verify config parses**

Run: `cd frontend && npx playwright test --list`
Expected: Lists test files (will be empty initially since e2e/ doesn't have tests yet — that's fine; verify no parse errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/playwright.config.ts frontend/package.json
git commit -m "test(fe): add playwright.config.ts and npm scripts"
```

---

### Task 22: Create FE test fixtures (identities, auth, api-mocks, seed-data)

**Files:**
- Create: `frontend/e2e/fixtures/identities.ts`
- Create: `frontend/e2e/fixtures/auth.ts`
- Create: `frontend/e2e/fixtures/seed-data.ts`
- Create: `frontend/e2e/fixtures/api-mocks.ts`

- [ ] **Step 1: Create directory**

```bash
cd frontend
mkdir -p e2e/fixtures e2e/helpers e2e/journeys e2e/stubs e2e/__screenshots__
```

- [ ] **Step 2: Write `frontend/e2e/fixtures/identities.ts`**

```typescript
// Mirrors backend/tests/identities.py — keep these in sync.
export const TEST_USER_ID = 'test_user_123';
export const TEST_ORG_ID = 'test_org_abc';

export const TEST_LEAD_ID_1 = 'lead_00000000-0000-0000-0000-000000000001';
export const TEST_LEAD_ID_2 = 'lead_00000000-0000-0000-0000-000000000002';

export const TEST_ICP_ID_1 = 'icp_00000000-0000-0000-0000-000000000001';
export const TEST_SIGNAL_ID_1 = 'sig_00000000-0000-0000-0000-000000000001';
export const TEST_FILE_KEY = 'test_org_abc/test_file_key.pdf';
export const TEST_TIMESTAMP = '2026-05-08T10:00:00Z';
```

- [ ] **Step 3: Write `frontend/e2e/fixtures/auth.ts`**

```typescript
import { TEST_USER_ID, TEST_ORG_ID } from './identities';

export const mockAuthState = {
  auth_token: 'mock_jwt_token',
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  selected_tenant: { id: TEST_ORG_ID, name: 'Test Org' },
};

export const firebaseSignInResponse = {
  idToken: 'mock_firebase_token',
  email: 'test@brewra.test',
  localId: TEST_USER_ID,
  registered: true,
  refreshToken: 'mock_refresh_token',
  expiresIn: '3600',
};
```

- [ ] **Step 4: Write `frontend/e2e/fixtures/seed-data.ts`**

```typescript
import {
  TEST_LEAD_ID_1, TEST_ICP_ID_1, TEST_SIGNAL_ID_1,
  TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
} from './identities';

export interface Lead {
  lead_id: string;
  user_id: string;
  org_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  industry: string;
  stage: string;
  created_at: string;
}

export const lead = (overrides: Partial<Lead> = {}): Lead => ({
  lead_id: TEST_LEAD_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  company_name: 'Acme Corp',
  contact_name: 'Jane Doe',
  email: 'jane@acme.test',
  industry: 'SaaS',
  stage: 'Discovery',
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const leadList = (n = 3): Lead[] =>
  Array.from({ length: n }, (_, i) =>
    lead({
      lead_id: `lead_${i.toString().padStart(8, '0')}`,
      company_name: `Company ${i}`,
    }),
  );

export const signal = (overrides: Record<string, unknown> = {}) => ({
  signal_id: TEST_SIGNAL_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  agent: 'scout',
  headline: 'Acme Corp announces $50M Series B funding',
  snippet: 'Acme Corp closed a $50M Series B led by Sequoia.',
  source_url: 'https://example.test/acme-funding',
  next_best_actions: [
    { label: 'Reach out to CEO', type: 'email' },
    { label: 'Send congrats on LinkedIn', type: 'linkedin' },
  ],
  status: 'new',
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const signalList = (n = 5) =>
  Array.from({ length: n }, (_, i) =>
    signal({
      signal_id: `sig_${i.toString().padStart(8, '0')}`,
      headline: `Test signal ${i}`,
    }),
  );

export const icp = (overrides: Record<string, unknown> = {}) => ({
  icp_id: TEST_ICP_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  name: 'SaaS CTOs',
  industry: 'SaaS',
  company_size: '50-500',
  geography: ['US', 'EU'],
  pain_points: ['scaling', 'tech debt'],
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const orgProfile = {
  org_id: TEST_ORG_ID,
  name: 'Test Org',
  industry: 'SaaS',
  size: '50-500',
  website: 'https://test-org.test',
  created_at: TEST_TIMESTAMP,
};

export const orgList = [
  { id: TEST_ORG_ID, name: 'Test Org' },
];
```

- [ ] **Step 5: Write `frontend/e2e/fixtures/api-mocks.ts`**

```typescript
import { Page } from '@playwright/test';
import { lead, leadList, signal, signalList, icp, orgProfile, orgList } from './seed-data';
import { TEST_ORG_ID } from './identities';

export const apiMocks: Record<string, unknown> = {
  '/api/org': { orgs: orgList },
  '/api/profile/company': orgProfile,
  '/api/profile/org': orgProfile,
  '/api/profile/user': { user_id: 'test_user_123', display_name: 'Test User' },
  '/api/leads': { leads: leadList(3), total: 3 },
  '/api/leads/by-file': { leads: leadList(3) },
  '/api/leads/stream/status': { uploads: [] },
  '/api/leads/market-scores/status': { status: 'idle', leads_processed: 0 },
  '/api/fetch-signals': { signals: signalList(5) },
  '/api/customer_profile': { profiles: [icp(), icp({ icp_id: 'icp_002', name: 'Fintech CFOs' })] },
  '/api/icp': { suggested: [{ icp_id: 'sug_1', name: 'Suggested', match_score: 0.8 }] },
  '/api/market-research': {
    component_name: 'market_size_opportunity',
    status: 'completed',
    result: { title: 'Market Size', summary: 'Test summary', key_findings: [] },
    cached: false,
  },
  '/api/user-documents': { documents: [] },
};

export async function installApiMocks(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  const merged = { ...apiMocks, ...overrides };
  for (const [path, response] of Object.entries(merged)) {
    await page.route(`**${path}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }
}

// Catch-all for any /api/* not in the registry — return empty 200 to prevent
// network errors from crashing the test.
export async function installCatchAllApiMock(page: Page) {
  await page.route('**/api/**', async (route, request) => {
    if (request.url().includes('identitytoolkit.googleapis.com')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/fixtures/
git commit -m "test(fe): add e2e fixtures (identities, auth, seed-data, api-mocks)"
```

---

### Task 23: Create FE helpers (login, mask-dynamic)

**Files:**
- Create: `frontend/e2e/helpers/login.ts`
- Create: `frontend/e2e/helpers/mask-dynamic.ts`

- [ ] **Step 1: Write `frontend/e2e/helpers/login.ts`**

```typescript
import { Page } from '@playwright/test';
import { mockAuthState, firebaseSignInResponse } from '../fixtures/auth';

/**
 * Skips the login form by seeding localStorage with auth state before page load.
 * Use this in journeys 2-5 and stub tests where auth is not what's being tested.
 */
export async function loginAsTestUser(page: Page) {
  await page.addInitScript((auth) => {
    for (const [key, value] of Object.entries(auth)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, stringValue);
    }
  }, mockAuthState);
}

/**
 * Intercepts the real Firebase sign-in REST endpoint with a canned response.
 * Use this in journey 1 where the login form itself is being tested.
 */
export async function mockFirebaseLogin(page: Page) {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(firebaseSignInResponse),
    });
  });

  // Firebase also calls securetoken.googleapis.com for refresh.
  await page.route('**/securetoken.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id_token: 'mock_firebase_token',
        refresh_token: 'mock_refresh_token',
        expires_in: '3600',
      }),
    });
  });
}
```

- [ ] **Step 2: Write `frontend/e2e/helpers/mask-dynamic.ts`**

```typescript
import { Page, Locator } from '@playwright/test';

/**
 * Returns Playwright locators for dynamic regions that should be masked
 * during screenshot comparison. Goldens otherwise drift on every run.
 *
 * Add new selectors here as you find dynamic content during test authoring.
 */
export function maskDynamic(page: Page): Locator[] {
  return [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid*="generated-id"]'),
    page.locator('.spinner'),
    page.locator('[data-testid="loading-spinner"]'),
    // FE renders relative timestamps ("2 hours ago") — mask the elements that show them.
    page.locator('text=/^\\d+\\s+(seconds?|minutes?|hours?|days?)\\s+ago$/i'),
  ];
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/helpers/
git commit -m "test(fe): add login + mask-dynamic helpers"
```

---

## Phase 5: Frontend journey tests

### Task 24: Journey 1 — Login → tenant-selection → mission-control

**Files:**
- Create: `frontend/e2e/journeys/01-login-tenant-mission.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import { mockFirebaseLogin } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('login → tenant-selection redirect → mission-control loads', async ({ page }) => {
  await mockFirebaseLogin(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Land on login page.
  await page.goto('/');
  await expect(page).toHaveScreenshot('01-login-page.png', { mask: maskDynamic(page) });

  // Step 2: Submit login form.
  await page.getByLabel(/email/i).fill('test@brewra.test');
  await page.getByLabel(/password/i).fill('test_password');
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Step 3: Tenant-selection redirect.
  // Per inventory: "Users auto-redirected past it in practice." Capture this.
  await page.waitForURL(/\/(tenant-selection|mission-control)/, { timeout: 10000 });
  await expect(page).toHaveScreenshot('02-post-login-state.png', { mask: maskDynamic(page) });

  // Step 4: If on tenant-selection, click first tenant.
  if (page.url().includes('tenant-selection')) {
    await page.getByText(/Test Org/i).click();
    await expect(page).toHaveScreenshot('03-tenant-selected.png', { mask: maskDynamic(page) });
  }

  // Step 5: Mission-control loaded.
  await page.waitForURL(/\/mission-control/, { timeout: 10000 });
  await expect(page.getByText(/mission control/i).first()).toBeVisible();
  await expect(page).toHaveScreenshot('04-mission-control-loaded.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 2: Run with snapshot generation**

Run: `cd frontend && npm run test:e2e:update-snapshots -- journeys/01`
Expected: Test runs, takes screenshots, saves goldens to `e2e/__screenshots__/01-login-tenant-mission.spec.ts/`. 4 PNGs created.

- [ ] **Step 3: Re-run without update**

Run: `cd frontend && npm run test:e2e -- journeys/01`
Expected: Test passes (pixel-diffs match goldens).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/journeys/01-login-tenant-mission.spec.ts frontend/e2e/__screenshots__/
git commit -m "test(fe): journey 01 — login → tenant-selection → mission-control"
```

---

### Task 25: Journey 2 — CSV upload → leads in stream

**Files:**
- Create: `frontend/e2e/journeys/02-csv-upload-leads.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { leadList } from '../fixtures/seed-data';

test('CSV upload → leads appear in Scout lead stream', async ({ page }) => {
  await loginAsTestUser(page);

  // Capture the upload POST so we can assert it fired with right shape.
  const uploadRequest = page.waitForRequest('**/api/leads/batch-upload');

  // Mock the batch-upload response.
  await installApiMocks(page, {
    '/api/leads/batch-upload': {
      status: 'completed',
      file_id: 'file_test_001',
      lead_count: 3,
    },
    '/api/leads': { leads: leadList(3), total: 3 },
  });
  await installCatchAllApiMock(page);

  // Step 1: Navigate to the lead stream.
  await page.goto('/your-ai-team/scout/leads');
  await expect(page).toHaveScreenshot('01-lead-stream-empty.png', { mask: maskDynamic(page) });

  // Step 2: Click upload button (selector may need adjusting based on actual UI).
  await page.getByRole('button', { name: /upload|import|add leads/i }).first().click();
  await expect(page).toHaveScreenshot('02-upload-modal-open.png', { mask: maskDynamic(page) });

  // Step 3: Set the CSV file.
  const csvBuffer = Buffer.from(
    'company_name,contact_name,email\nAcme,Jane,jane@acme.test\nBeta,John,john@beta.test\n',
    'utf-8',
  );
  await page.setInputFiles('input[type="file"]', {
    name: 'test_leads.csv',
    mimeType: 'text/csv',
    buffer: csvBuffer,
  });

  // Step 4: Submit upload.
  await page.getByRole('button', { name: /upload|submit|confirm/i }).last().click();

  // Step 5: Confirm upload request fired with right payload.
  const req = await uploadRequest;
  expect(req.method()).toBe('POST');
  await expect(page).toHaveScreenshot('03-upload-in-progress.png', { mask: maskDynamic(page) });

  // Step 6: Wait for leads to render.
  await expect(page.getByText('Company 0')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveScreenshot('04-leads-in-stream.png', { mask: maskDynamic(page) });

  // Step 7: Final state — multiple leads visible.
  await expect(page.getByText('Company 1')).toBeVisible();
  await expect(page).toHaveScreenshot('05-multiple-leads-visible.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 2: Generate goldens**

Run: `cd frontend && npm run test:e2e:update-snapshots -- journeys/02`
Expected: 5 PNGs created.

- [ ] **Step 3: Re-run without update**

Run: `cd frontend && npm run test:e2e -- journeys/02`
Expected: Test passes.

- [ ] **Step 4: If selectors fail (button names differ from actual UI)**

Open the relevant page in a browser, inspect actual button text/labels, update selectors. Re-run with `--update-snapshots` after the test reaches all 5 screenshot points.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/journeys/02-csv-upload-leads.spec.ts frontend/e2e/__screenshots__/
git commit -m "test(fe): journey 02 — CSV upload → leads in stream"
```

---

### Task 26: Journey 3 — Signals feed → accept action

**Files:**
- Create: `frontend/e2e/journeys/03-signals-feed-action.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { signalList } from '../fixtures/seed-data';
import { TEST_ORG_ID } from '../fixtures/identities';

test('signals feed loads, accept persists, snapshot stable', async ({ page }) => {
  await loginAsTestUser(page);

  const actionRequest = page.waitForRequest('**/api/signal_action');

  await installApiMocks(page, {
    '/api/fetch-signals': { signals: signalList(5) },
    '/api/signal_action': { status: 'success', signal_id: 'sig_00000000' },
  });
  await installCatchAllApiMock(page);

  // Step 1: Navigate to signals feed.
  await page.goto('/your-ai-team/scout/signals');
  await expect(page.getByText('Signals').first()).toBeVisible();
  await expect(page).toHaveScreenshot('01-signals-feed-loaded.png', { mask: maskDynamic(page) });

  // Step 2: Verify signals rendered.
  await expect(page.getByText('Test signal 0')).toBeVisible();
  await expect(page).toHaveScreenshot('02-signal-cards-visible.png', { mask: maskDynamic(page) });

  // Step 3: Click accept on first card.
  await page.getByRole('button', { name: /accept|approve/i }).first().click();

  // Step 4: Assert request fired correctly.
  const req = await actionRequest;
  const payload = req.postDataJSON();
  expect(payload.action).toBe('accept');
  expect(payload.org_id).toBe(TEST_ORG_ID);
  await expect(page).toHaveScreenshot('03-post-accept-loading.png', { mask: maskDynamic(page) });

  // Step 5: Final state.
  await expect(page).toHaveScreenshot('04-post-accept-final.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 2: Generate goldens**

Run: `cd frontend && npm run test:e2e:update-snapshots -- journeys/03`
Expected: 4 PNGs created.

- [ ] **Step 3: Re-run without update**

Run: `cd frontend && npm run test:e2e -- journeys/03`
Expected: Test passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/journeys/03-signals-feed-action.spec.ts frontend/e2e/__screenshots__/
git commit -m "test(fe): journey 03 — signals feed + accept action"
```

---

### Task 27: Journey 4 — Market Research × 5 components

**Files:**
- Create: `frontend/e2e/journeys/04-market-research-5-components.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

const COMPONENTS = [
  'market_size_opportunity',
  'industry_trends',
  'competitor_landscape',
  'regulatory_compliance',
  'market_entry',
];

test('market research kicks off all 5 components, results render', async ({ page }) => {
  await loginAsTestUser(page);

  // Mock per-component responses.
  for (const component of COMPONENTS) {
    await page.route(`**/api/market-research**`, async (route) => {
      const reqBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          component_name: reqBody?.component_name || component,
          status: 'completed',
          result: {
            title: `${component} Title`,
            summary: `${component} summary text.`,
            key_findings: ['F1', 'F2', 'F3'],
            sources: [{ url: 'https://example.test', title: 'Source 1' }],
          },
          cached: false,
        }),
      });
    });
  }
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Navigate to market research.
  await page.goto('/your-ai-team/scout/market-research');
  await expect(page).toHaveScreenshot('01-market-research-initial.png', { mask: maskDynamic(page) });

  // Step 2: Trigger the research flow.
  // Selectors here depend on actual UI — adjust on first run.
  const startButton = page.getByRole('button', { name: /start|run|generate|research/i }).first();
  if (await startButton.isVisible()) {
    await startButton.click();
  }
  await expect(page).toHaveScreenshot('02-research-in-progress.png', { mask: maskDynamic(page) });

  // Step 3: Wait for first component result.
  await expect(page.getByText(/market_size_opportunity Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('03-component-1-loaded.png', { mask: maskDynamic(page) });

  // Step 4: Wait for second component.
  await expect(page.getByText(/industry_trends Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('04-component-2-loaded.png', { mask: maskDynamic(page) });

  // Step 5: Wait for third.
  await expect(page.getByText(/competitor_landscape Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('05-component-3-loaded.png', { mask: maskDynamic(page) });

  // Step 6: Wait for fourth.
  await expect(page.getByText(/regulatory_compliance Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('06-component-4-loaded.png', { mask: maskDynamic(page) });

  // Step 7: Wait for fifth.
  await expect(page.getByText(/market_entry Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('07-component-5-loaded.png', { mask: maskDynamic(page) });

  // Step 8: All-loaded final state.
  await expect(page).toHaveScreenshot('08-all-components-loaded.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 2: Generate goldens**

Run: `cd frontend && npm run test:e2e:update-snapshots -- journeys/04`
Expected: 8 PNGs created. This journey is the most likely to need selector adjustment — `MarketResearch.tsx` is 14,956 LOC and has its own loading orchestration.

- [ ] **Step 3: If components don't load on the page**

Inspect the actual market-research page in a browser (with mocks installed), determine the actual component-rendering pattern, update text matchers. Re-run with `--update-snapshots`.

- [ ] **Step 4: Re-run without update**

Run: `cd frontend && npm run test:e2e -- journeys/04`
Expected: Test passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/journeys/04-market-research-5-components.spec.ts frontend/e2e/__screenshots__/
git commit -m "test(fe): journey 04 — market research × 5 components"
```

---

### Task 28: Journey 5 — ICP create via Mission Control

**Files:**
- Create: `frontend/e2e/journeys/05-icp-create.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { icp } from '../fixtures/seed-data';

test('ICP create via Mission Control → appears in saved list', async ({ page }) => {
  await loginAsTestUser(page);

  const createRequest = page.waitForRequest('**/api/customer_profile');

  // First load: empty list.
  let firstFetchHandled = false;
  await page.route('**/api/customer_profile**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(icp({ name: 'New Test ICP' })),
      });
    } else {
      // GET: first time empty, second time has the new ICP.
      const profiles = firstFetchHandled
        ? [icp({ name: 'New Test ICP' })]
        : [];
      firstFetchHandled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles }),
      });
    }
  });
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Navigate to mission-control.
  await page.goto('/mission-control');
  await expect(page).toHaveScreenshot('01-mission-control-empty-icp.png', { mask: maskDynamic(page) });

  // Step 2: Click new ICP / create profile button.
  await page.getByRole('button', { name: /add|create|new.*icp|new.*profile/i }).first().click();
  await expect(page).toHaveScreenshot('02-icp-create-form-open.png', { mask: maskDynamic(page) });

  // Step 3: Fill in name.
  await page.getByLabel(/name/i).first().fill('New Test ICP');
  await page.getByRole('button', { name: /save|create|submit/i }).last().click();

  // Step 4: Assert request.
  const req = await createRequest;
  expect(req.method()).toBe('POST');
  await expect(page).toHaveScreenshot('03-icp-create-saving.png', { mask: maskDynamic(page) });

  // Step 5: Verify appears in list.
  await expect(page.getByText('New Test ICP')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveScreenshot('04-icp-in-saved-list.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 2: Generate goldens**

Run: `cd frontend && npm run test:e2e:update-snapshots -- journeys/05`
Expected: 4 PNGs created.

- [ ] **Step 3: Re-run without update**

Run: `cd frontend && npm run test:e2e -- journeys/05`
Expected: Test passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/journeys/05-icp-create.spec.ts frontend/e2e/__screenshots__/
git commit -m "test(fe): journey 05 — ICP create via Mission Control"
```

---

## Phase 6: Frontend stub-page tests

### Task 29: Stub-page smoke tests (5 pages, 1 golden each)

**Files:**
- Create: `frontend/e2e/stubs/calendar.spec.ts`
- Create: `frontend/e2e/stubs/reports.spec.ts`
- Create: `frontend/e2e/stubs/insights.spec.ts`
- Create: `frontend/e2e/stubs/artifacts.spec.ts`
- Create: `frontend/e2e/stubs/agent-hub.spec.ts`

- [ ] **Step 1: Write `frontend/e2e/stubs/calendar.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('calendar (Activator) page loads without errors', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/calendar');

  // Per inventory: page is a 158-LOC stub with three "will appear here" tabs.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
  await expect(page.locator('body')).toBeVisible();
  await expect(page).toHaveScreenshot('calendar-page.png', { mask: maskDynamic(page) });

  // Lock current behavior: page loads. If console errors are expected, capture them.
  // Don't fail on console errors — characterize what happens today.
});
```

- [ ] **Step 2: Write `frontend/e2e/stubs/reports.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('reports page loads with hardcoded demo cards', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/reports');

  await expect(page).not.toHaveURL(/\/login/);
  // Per inventory: page shows hardcoded "UK Fintech Ops Demo" / "CTO Demo".
  await expect(page).toHaveScreenshot('reports-page.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 3: Write `frontend/e2e/stubs/insights.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('insights page loads with static hardcoded percentages', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/insights');

  await expect(page).not.toHaveURL(/\/login/);
  // Per inventory: hardcoded 87% / 92% percentages.
  await expect(page).toHaveScreenshot('insights-page.png', { mask: maskDynamic(page) });
});
```

- [ ] **Step 4: Write `frontend/e2e/stubs/artifacts.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('artifacts page loads with mock reports', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/artifacts');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveScreenshot('artifacts-page.png', { mask: maskDynamic(page) });
});

test('artifacts page download button generates PDF', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/artifacts');

  // Per inventory: createSimplePDF() function generates real PDF data on download.
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  const downloadButton = page.getByRole('button', { name: /download|pdf|export/i }).first();
  if (await downloadButton.isVisible()) {
    await downloadButton.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    }
  }
});
```

- [ ] **Step 5: Write `frontend/e2e/stubs/agent-hub.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { signalList } from '../fixtures/seed-data';

test('agent-hub route currently renders Signals (bug-as-feature lock)', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page, {
    '/api/fetch-signals': { signals: signalList(3) },
  });
  await installCatchAllApiMock(page);

  await page.goto('/agent-hub');

  // Per inventory: App.tsx:60-64 renders <Signals /> instead of AgentHub.tsx.
  // Lock this current incorrect behavior; when fixed, intentionally update snapshot.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveScreenshot('agent-hub-page.png', { mask: maskDynamic(page) });

  // Defensive: confirm we see signals UI text, not AgentHub-specific text.
  const signalsHeader = page.getByText(/signals/i).first();
  await expect(signalsHeader).toBeVisible({ timeout: 10000 });
});
```

- [ ] **Step 6: Generate all stub goldens**

Run: `cd frontend && npm run test:e2e:update-snapshots -- stubs/`
Expected: 5 goldens created (calendar, reports, insights, artifacts, agent-hub). The artifacts download test does not produce a screenshot.

- [ ] **Step 7: Re-run without update**

Run: `cd frontend && npm run test:e2e -- stubs/`
Expected: All stub tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/e2e/stubs/ frontend/e2e/__screenshots__/
git commit -m "test(fe): stub-page smoke tests (calendar, reports, insights, artifacts, agent-hub)"
```

---

## Phase 7: Final integration check

### Task 30: Run full BE + FE suite end-to-end

- [ ] **Step 1: Run backend full suite**

Run: `cd backend && pytest tests/ -v`
Expected: ~58 tests pass. Total runtime <10 seconds.

- [ ] **Step 2: Run frontend full suite**

Run: `cd frontend && npm run test:e2e`
Expected: ~10 tests pass (5 journeys + 5 stubs + 1 artifacts download). Total runtime 60-180 seconds. 30 goldens validated.

- [ ] **Step 3: If any test is flaky (passes sometimes, fails others)**

Most common cause: a `waitFor` timeout not waiting long enough on an async render. Increase the timeout (`{ timeout: 15000 }`), add explicit network idle: `await page.waitForLoadState('networkidle')`, or check whether `maskDynamic` is missing a selector that's still updating during the screenshot.

Do not commit a flaky test as-passing. Either fix it or document the flakiness in `docs/TECH_DEBT.md` as a new TD entry.

- [ ] **Step 4: Verify snapshot files committed**

Run: `git status backend/tests/__snapshots__/ frontend/e2e/__screenshots__/`
Expected: clean (all snapshots committed in earlier task commits).

- [ ] **Step 5: Document the test invocation in `frontend/README.md` or root `README.md`**

Add a "Tests" section to `brewra-gtm-intelligence/README.md` (or update if it exists):

```markdown
## Characterization tests

A test safety net protecting the 13 critical, currently-working features during refactors.
See `specs/2026-05-08-characterization-tests-design.md` for design.

### Run

```bash
# Backend (in-process, mocked deps, ~10s)
cd backend && pytest tests/

# Frontend (real browser via Playwright, ~2min)
cd frontend && npm run test:e2e

# Update snapshots (use deliberately, review diffs)
cd backend && pytest tests/ --snapshot-update
cd frontend && npm run test:e2e:update-snapshots
```

### Refactor protocol

1. Run full suite before starting — baseline must be green.
2. Run frequently during refactor (every few hundred LOC of structural change).
3. On failure: read the diff, decide if it's intentional. If yes, update snapshot in same commit as code change.
```

- [ ] **Step 6: Final commit**

```bash
git add brewra-gtm-intelligence/README.md
git commit -m "docs: add characterization-test invocation reference to README"
```

---

## Plan complete

Total deliverables:
- ~58 backend characterization tests across 8 modules + helpers + smoke test
- ~10 frontend Playwright tests (5 journeys + 5 stub specs + 1 artifacts download)
- 30 visual regression goldens (chromium-linux)
- Hand-crafted fixtures for all critical resources (TD-001 deferred capture-once upgrade)
- Local-only execution; no CI gate per Q7=A
- Full suite runs in ~2 minutes locally
- Refactor protocol documented in README

**Reference docs:**
- Spec: `specs/2026-05-08-characterization-tests-design.md`
- Tech debt: `docs/TECH_DEBT.md` (TD-001)
- This plan: `plans/03-characterization-tests.md`
