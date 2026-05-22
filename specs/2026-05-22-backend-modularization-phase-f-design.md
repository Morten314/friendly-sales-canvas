# Backend Modularization Phase F — Dependency Injection + Lifespan

**Date:** 2026-05-22
**Status:** Approved for plan-writing (pending user spec review)
**Branch (planned):** `refactor-backend-modularization-phase-f` off `master`
**Predecessors:** Phase A (`/specs/2026-05-12-backend-modularization-design.md`), Phase B (`/specs/2026-05-21-backend-modularization-phase-b-design.md`), Phase C (`/specs/2026-05-22-backend-modularization-phase-c-design.md`), Phase D (`/specs/2026-05-22-backend-modularization-phase-d-design.md`), Phase E (`/specs/2026-05-22-backend-test-improvements-phase-e-design.md`)
**Targets:** `docs/TECH_DEBT.md` TD-003 — closed by this phase.

---

## 1. Summary

Phase F closes the dependency-injection deferral chain that Phase A introduced and Phases B–D carried forward. Every module-level singleton in `app/core/clients.py` and `app/core/llm_config.py` becomes a FastAPI `Depends`-injected dependency, constructed once in a `lifespan` context manager and stashed on `app.state`. Services and background tasks become pure functions that take clients as explicit positional arguments. Tests substitute mocks via `app.dependency_overrides` (integration layer) or by passing mocks directly (unit layer) — the `mocker.patch("app.core.clients.…")` pattern is retired.

The work also retires TD-003: the deprecated `@app.on_event("startup")` hook and the module-import-time `clients.graph.refresh_schema()` call both move into `lifespan`. After Phase F, the backend has one construction site (lifespan), one substitution mechanism (dependency overrides), and one rule for services (clients in, results out).

The characterization test suite is again the safety net. Test count is unchanged from Phase E (~203). Every commit is independently green; the branch is bisectable.

---

## 2. Scope

### 2.1 In scope

1. **New `app/core/dependencies.py` with 13 providers** — one per injected resource:
   - **5 client providers:** `get_neo4j_driver`, `get_neo4j_graph`, `get_mongo`, `get_s3`, `get_pinecone`.
   - **8 LLM providers:** `get_llm`, `get_llm2`, `get_llm_transformer`, `get_vision`, `get_memory`, `get_agent_chain`, `get_cypher_chain` (today's `chain`), `get_cypher_chain2` (today's `chain2`).
2. **`lifespan` in `app/main.py`** — an `@asynccontextmanager` function that builds both bundles, stashes them on `app.state.clients` and `app.state.llm`, and runs the existing `_ensure_market_scoring_indexes` + `graph.refresh_schema()` setup. Passed to `FastAPI(lifespan=...)`. The deprecated `@app.on_event("startup")` is removed.
3. **Refactor `app/core/clients.py` and `app/core/llm_config.py` into factory-only modules.** Each exposes a `build_*` factory function and a `*Bundle` dataclass. No module-level state, no construction at import time. The `BREWRA_SKIP_DB_INIT` env var continues to gate connection attempts, but the check moves from module top to inside `build_clients()`.
4. **Convert all 12 service-layer files** (11 domain services — `pipeline`, `org_auth`, `profiles`, `customer_profile`, `documents`, `leads`, `graph_chat`, `market_research`, `icp`, `signals`, `market_scoring` — plus the `_retrieval` shared helper) to take clients/LLMs as explicit function arguments. ~84 service-side usage sites converted.
5. **Convert the one router with direct client access (`graph_chat.py`)** — 2 sites — to use `Depends()` providers. Where appropriate, the direct router-side data access is pushed into the corresponding service (matching the Phase B layer rule).
6. **Wire every router endpoint** that today reaches module globals (either directly or transitively through service calls) to use `Depends()` providers and pass the injected clients to its services.
7. **Background-task pattern:** routers acquire clients via `Depends()` and pass them positionally to the task function (`_run_market_scoring_for_org`, `process_file_to_embeddings`). Tasks become pure functions taking clients as args. The Phase D `except BrewraError: log+continue` outer wrappers remain.
8. **Rewrite test fixtures** in `tests/conftest.py` and `tests/unit/conftest.py`:
   - Integration fixtures switch from `mocker.patch("app.core.clients.X", ...)` to `app.dependency_overrides[get_X] = lambda: mock`. Cleanup via `yield … ; app.dependency_overrides.pop(get_X, None)`.
   - Unit fixtures stay as mock-builders; tests pass mocks directly as positional args to service functions.
   - One new session-scope autouse fixture asserts `app.dependency_overrides == {}` at session teardown (leak-detection).
9. **Move pure-Cypher helpers** (`query`, `results_to_string`, `escape_property_name`, plus any companion Mongo-shaping helpers) out of `clients.py` into `app/services/_neo4j_helpers.py`. They are query utilities, not clients. Pattern matches existing underscore-prefixed shared helper modules (`_retrieval`, `_claude_budget`, `_llm_helpers`).
10. **Mark TD-003 closed** in `docs/TECH_DEBT.md` with a "Resolved by Phase F" line.

### 2.2 Out of scope (deferred)

**Phase G candidate (most likely next phase):**
- **Security hardening.** Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87,94,104`), `/leads` `LIMIT`, CORS off `*`, raw Cypher endpoint guard. Both Phase D §8 and Phase E §2.2 explicitly anchor this as "Phase F+".

**Other carry-forward items (future micro-phases or batched):**
- TD-004 (run real LLM captures with API keys). Owner CTO; not coupled to DI.
- Phase E review M1 (pytest-asyncio migration), M4 (pytest config + markers), L4 (CI staleness check for captured fixtures).
- B4 small-pattern dedup audit (JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3).
- `create_index`-on-hot-path audit (confirmed: `leads.py:255-256` in `batch_upload_leads`).
- Anthropic SDK migration (replace bare `requests.post` in Claude paths).
- `tiktoken` for budget estimation.
- Redis-backed Claude budget.
- Inline prompts → `app/prompts/`.
- Shared `memory` audit.
- Pagination convention.

### 2.3 Non-goals

- **No API contract changes.** No new endpoints, no removed endpoints, no response-shape changes. Routers' externally visible behavior is identical pre- and post-Phase F.
- **No service-class wrappers.** Services remain pure functions; only their inputs are injected. We considered and rejected the `LeadsService(driver, mongo, llm)` style in brainstorm.
- **No DI for service-function calls.** Routers `Depends()` their clients and pass them to services as plain args. Services do not `Depends()` themselves.
- **No new test coverage.** Phase F is a mechanism swap, not a coverage expansion. Test count stays at the Phase E baseline (~203).
- **No removal of `BREWRA_SKIP_DB_INIT`.** The env var stays; only its read location moves (module top → inside `build_clients`).

---

## 3. Architecture

### 3.1 Factory modules

`app/core/clients.py` (after Phase F):

```python
from dataclasses import dataclass
from typing import Any, Optional
from neo4j import GraphDatabase
from langchain_community.graphs.neo4j_graph import Neo4jGraph
from pymongo import MongoClient
from pinecone import Pinecone
import boto3
import logging
import os

from app.core.config import (
    neo4j_uri, neo4j_username, neo4j_password,
    mongo_uri, aws_access_key, aws_secret_key, aws_region,
    pinecone_api_key,
)

logger = logging.getLogger(__name__)


@dataclass
class ClientBundle:
    driver: Optional[Any]      # neo4j.GraphDatabase driver
    graph: Optional[Neo4jGraph]
    client: Optional[MongoClient]
    s3_client: Optional[Any]
    pc: Optional[Pinecone]


def build_clients(skip_db_init: Optional[bool] = None) -> ClientBundle:
    """Construct all external clients. Call once at app startup."""
    if skip_db_init is None:
        skip_db_init = bool(os.getenv("BREWRA_SKIP_DB_INIT"))

    if skip_db_init:
        return ClientBundle(driver=None, graph=None, client=None, s3_client=None, pc=None)

    driver = None
    try:
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
        driver.verify_connectivity()
        logger.info("Connected to Neo4j successfully!")
    except Exception as e:
        logger.error("Neo4j Connection failed: %s", e)

    graph = None
    try:
        graph = Neo4jGraph(url=neo4j_uri, username=neo4j_username, password=neo4j_password)
    except Exception as e:
        logger.error("Neo4jGraph init failed: %s", e)

    client = None
    try:
        client = MongoClient(mongo_uri)
    except Exception as e:
        logger.error("MongoDB Connection failed: %s", e)

    s3_client = None
    try:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region,
        )
    except Exception as e:
        logger.error("S3 client init failed: %s", e)

    pc = None
    try:
        pc = Pinecone(api_key=pinecone_api_key)
    except Exception as e:
        logger.error("Pinecone init failed: %s", e)

    return ClientBundle(driver=driver, graph=graph, client=client, s3_client=s3_client, pc=pc)
```

No module-level state. Pure-Cypher helpers (`query`, `results_to_string`, `escape_property_name`) have been moved out to `app/services/_neo4j_helpers.py` (Task 10 above).

`app/core/llm_config.py` follows the same shape: `LLMBundle` dataclass + `build_llm_config()` factory that constructs all chains/LLMs and returns the bundle.

### 3.2 Lifespan + `app.state`

`app/main.py`:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.clients import build_clients
from app.core.llm_config import build_llm_config
from app.services.market_scoring import _ensure_market_scoring_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.clients = build_clients()
    app.state.llm = build_llm_config()

    # Post-construction setup that needs live clients
    if app.state.clients.graph is not None:
        try:
            app.state.clients.graph.refresh_schema()
        except Exception as e:
            logger.error("Neo4j refresh_schema failed: %s", e)
    if app.state.clients.client is not None:
        _ensure_market_scoring_indexes(app.state.clients.client)

    yield
    # No teardown; clients are process-lifetime singletons.


app = FastAPI(lifespan=lifespan)
# … CORS, logging, include_router(...) calls unchanged …
```

The deprecated `@app.on_event("startup")` is gone. TD-003 retires.

### 3.3 Dependencies module

`app/core/dependencies.py` (new file):

```python
from fastapi import Request


# ── Client providers ────────────────────────────────────────────────────
def get_neo4j_driver(request: Request):
    return request.app.state.clients.driver

def get_neo4j_graph(request: Request):
    return request.app.state.clients.graph

def get_mongo(request: Request):
    return request.app.state.clients.client

def get_s3(request: Request):
    return request.app.state.clients.s3_client

def get_pinecone(request: Request):
    return request.app.state.clients.pc


# ── LLM providers ───────────────────────────────────────────────────────
def get_llm(request: Request):                  return request.app.state.llm.llm
def get_llm2(request: Request):                 return request.app.state.llm.llm2
def get_llm_transformer(request: Request):      return request.app.state.llm.llm_transformer
def get_vision(request: Request):               return request.app.state.llm.vision
def get_memory(request: Request):               return request.app.state.llm.memory
def get_agent_chain(request: Request):          return request.app.state.llm.agent_chain
def get_cypher_chain(request: Request):         return request.app.state.llm.chain
def get_cypher_chain2(request: Request):        return request.app.state.llm.chain2
```

Providers use the `Request`-bound form (`request.app.state.…`) rather than reading a module global. This works in both request and background-task contexts.

### 3.4 Service signature pattern

**Before** (Phase E baseline):

```python
# app/services/leads.py
from app.core import clients

def fetch_leads_for_org(org_id: str):
    with clients.driver.session() as s:
        return list(s.run("MATCH (l:Lead {org_id: $org_id}) RETURN l", org_id=org_id))
```

**After**:

```python
# app/services/leads.py
def fetch_leads_for_org(driver, org_id: str):
    with driver.session() as s:
        return list(s.run("MATCH (l:Lead {org_id: $org_id}) RETURN l", org_id=org_id))
```

Each function takes only the clients it actually uses. Type annotations are omitted in the function signature where the concrete client type would require an import (`neo4j.GraphDatabase`, `pymongo.MongoClient`); using `Any` adds no value and a real annotation pulls heavyweight imports into pure-Python service files. (This matches the existing project style of light type annotations in services.)

### 3.5 Router pattern

**Before:**

```python
# app/routers/leads.py
@router.get("/leads")
def get_all_leads(org_id: str = Query(...)):
    return services.leads.fetch_leads_for_org(org_id)
```

**After:**

```python
# app/routers/leads.py
from app.core.dependencies import get_neo4j_driver

@router.get("/leads")
def get_all_leads(
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    return services.leads.fetch_leads_for_org(driver, org_id)
```

### 3.6 Background-task pattern

**Before:**

```python
# app/routers/market_scoring.py
@router.post("/leads/market-scores")
def trigger_market_scores(org_id: str, bg: BackgroundTasks):
    bg.add_task(services.market_scoring._run_market_scoring_for_org, org_id)
```

**After:**

```python
@router.post("/leads/market-scores")
def trigger_market_scores(
    org_id: str,
    bg: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    llm=Depends(get_llm),
):
    bg.add_task(
        services.market_scoring._run_market_scoring_for_org,
        driver, mongo, llm, org_id,
    )
```

Background-task functions become pure functions taking clients as args. The Phase D `except BrewraError: log+continue` outer wrapper stays.

---

## 4. Migration sequencing

Single feature branch off `master`: `refactor-backend-modularization-phase-f`. ~16 commits, each independently green; bisectable.

### 4.1 Prep (3 commits)

1. **Introduce `ClientBundle`, `LLMBundle` dataclasses + `build_clients()`, `build_llm_config()` factories.** Module-level construction stays — the factories are also called at module import to populate the existing module globals (`clients.driver`, `llm_config.llm`, etc.). No test changes. Behavior identical. This commit introduces the new shape without changing anything yet.

2. **Add `app/core/dependencies.py` (all 13 providers) + lifespan in `app/main.py`.** Lifespan constructs bundles and stores on `app.state`. Module-level construction in `clients.py`/`llm_config.py` is still alive (factories called both in lifespan AND in module body). `BREWRA_SKIP_DB_INIT` is now honored in two places — both honor the same flag, no behavior drift. Verify in this commit that triggering a TestClient request actually invokes lifespan and populates `app.state` (FastAPI runs lifespan on first request).

3. **Add `app.dependency_overrides`-based fixtures to `tests/conftest.py` and `tests/unit/conftest.py` alongside existing `mocker.patch` fixtures.** Both fixture sets work simultaneously. Add the session-scope autouse leak-detection fixture. No service or test-body rewrites yet.

### 4.2 Service conversions (12 commits, easy → hard, mirroring Phase A order)

Per-commit blast radius reflects the count from `grep -rn "clients\.…|llm_config\.…" backend/app/services/X.py`.

| # | Commit | Usages | Notes |
|---|---|---|---|
| 4 | `pipeline` | 2 | Warm-up. No LLM. |
| 5 | `org_auth` | 5 | No LLM. |
| 6 | `profiles` | 5 | No LLM. |
| 7 | `customer_profile` | 7 | No LLM. |
| 8 | `_retrieval` | 1 | Pinecone-only shared helper. Consumed by `market_research`, `signals`, `icp` — those services pass `pc` through. |
| 9 | `documents` | 18 | LLM (`llm_transformer`) + Mongo + S3. Largest non-LLM-heavy file. |
| 10 | `leads` | 10 | Includes background-task wiring through `_run_market_scoring_for_org` call from the router. |
| 11 | `graph_chat` | 2 + 2 (router) | Router-side direct access (`graph_chat.py:routers/graph_chat.py`) pushed into `services/graph_chat.py` first, then converted. |
| 12 | `market_research` | 3 | LLM. |
| 13 | `icp` | 7 | LLM. |
| 14 | `signals` | 17 | LLM, largest LLM file. |
| 15 | `market_scoring` | 7 | Stateful, background-task heavy. Last per Phase A precedent. |

Each conversion commit:
- Rewrites service function signatures to take clients/LLMs as explicit args.
- Updates the router(s) that call those services to use `Depends()` providers.
- Updates the matching unit-test file (`tests/unit/test_<service>.py`) to pass mocks directly.
- Updates the matching integration-test file to use `app.dependency_overrides` instead of `mocker.patch("app.core.clients.…")` *for that domain only*.
- Removes the now-stale `mocker.patch` lines from the relevant conftest fixture if no other test still needs them; otherwise leave them (they coexist with overrides).
- Tests must be green before commit.

### 4.3 Cleanup (1 commit)

16. **Remove module-level state from `clients.py` and `llm_config.py`.** Factories are no longer called at module import. Module globals (`clients.driver`, `llm_config.llm`, etc.) deleted. Lifespan is now the only construction site. Pure-Cypher helpers move to `app/services/_neo4j_helpers.py`. Any straggler `mocker.patch("app.core.clients.…")` calls in tests are deleted. Final grep proves nothing in `app/` reaches into module globals (see §7.1 hard criteria).

### 4.4 Per-commit validation

```bash
cd backend && pytest tests/        # green
git diff --stat                    # sanity-check the diff size
git commit -m "refactor(be): inject <domain> [phase F, commit N/16]"
```

### 4.5 Rollback

Every commit is `git revert`-safe. Commits 1–15 leave the module globals alive, so a revert of any of them just undoes the partial conversion. Commit 16 deletes the globals; if reverted, the factories are still in place and the module-import-time construction returns. The branch is bisectable end-to-end.

---

## 5. Test patterns

### 5.1 Integration tests (TestClient)

```python
# tests/conftest.py
@pytest.fixture
def mock_neo4j():
    from app.main import app
    from app.core.dependencies import get_neo4j_driver

    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False

    app.dependency_overrides[get_neo4j_driver] = lambda: mock_driver
    yield {"driver": mock_driver, "session": mock_session}
    app.dependency_overrides.pop(get_neo4j_driver, None)
```

Same shape for `mock_mongo`, `mock_s3`, `mock_pinecone`, `mock_llm_chain`, `mock_llm_config`. The composite `client` fixture stays — it just composes the new override fixtures instead of patch fixtures.

### 5.2 Unit tests

```python
# tests/unit/conftest.py — no source-patches, just mock builders
@pytest.fixture
def mock_session():
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session
    driver.session.return_value.__exit__.return_value = False
    return driver, session


@pytest.fixture
def mock_mongo_client():
    return MagicMock()
```

Tests then pass mocks positionally:

```python
def test_fetch_leads_for_org_happy(mock_session):
    driver, session = mock_session
    session.run.return_value = [{"name": "X"}]

    result = services.leads.fetch_leads_for_org(driver, "org_1")

    assert result[0]["name"] == "X"
```

### 5.3 Coexistence-phase fixture behavior

During commits 4–15, some services are converted and some aren't. Tests for unconverted services still use `mocker.patch("app.core.clients.X", ...)` against module globals (which are still alive). Tests for converted services use override fixtures. The two styles work side-by-side because they patch different layers:

- `mocker.patch("app.core.clients.driver", …)` mutates the module global. Unconverted services still read this global.
- `app.dependency_overrides[get_neo4j_driver] = …` overrides the provider. Converted services receive the mock via their function argument.

A test should not need both styles in the same test function. Commit 16 deletes the old style entirely.

### 5.4 Leak-detection autouse fixture

```python
# tests/conftest.py — added in prep commit 3
@pytest.fixture(autouse=True, scope="session")
def _verify_no_dependency_override_leak(request):
    from app.main import app
    yield
    assert app.dependency_overrides == {}, (
        f"Test session leaked overrides: {list(app.dependency_overrides.keys())}"
    )
```

---

## 6. Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Lifespan tries to construct real clients during tests (network hit, sandbox timeout) | Medium | `BREWRA_SKIP_DB_INIT=1` stays set in `tests/conftest.py`; `build_clients()` honors it and returns a Bundle of `None`s. Override fixtures ensure tests never reach `app.state.clients.*` for real values. |
| 2 | `app.dependency_overrides` leaks across tests | Medium | Every override fixture uses `yield … ; app.dependency_overrides.pop(...)`. Session-scope autouse fixture (§5.4) asserts the dict is empty at teardown. |
| 3 | A `backend/scripts/*.py` script imports module globals (`from app.core.clients import driver`) | Low-Medium | Grep before commit 16: `git grep -E "from app\.core\.(clients\|llm_config) import"`. Update any callsite to construct clients via `build_clients()` directly. |
| 4 | `graph_chat.py` router-side direct usage missed during conversion | Low | Commit 11 explicitly moves the router-side access into the service first, then converts. Final grep on `clients.` / `llm_config.` inside `app/routers/` catches strays. |
| 5 | Coexistence-phase tests fail because old and new fixtures conflict | Low | Old `mocker.patch` and new `dependency_overrides` target different layers (module global vs provider). They can coexist. Verify in commit 2 that both work in the same test session. |
| 6 | Commit 16 (delete module globals) is the only irreversible-feeling step; a hidden consumer breaks | Medium | Final grep + run full test suite *before* deleting. If anything in `backend/scripts/` or admin tools (`admin_panel.html` server-side handler chain) reaches into globals, refactor those alongside commit 16. |
| 7 | `BackgroundTasks` functions close over stale module-globals | Low | Test the two background-task entry points (`_run_market_scoring_for_org`, `process_file_to_embeddings`) explicitly in commits 10 and 15. Their unit tests already exist from Phase E. |
| 8 | Lifespan failure (e.g., Neo4j unreachable in prod) prevents the app from starting | Low | Existing module-level construction already swallows exceptions with `try/except`; `build_clients()` preserves that semantics. Lifespan does not raise. A missing client surfaces as `None` and the first request relying on it fails with a clear `AttributeError` — same observable behavior as today. |

---

## 7. Acceptance criteria

### 7.1 Hard (greppable / measurable)

```bash
# 1. No whole-module import of clients/llm_config across app code
#    (Imports of specific factory functions or dataclasses — e.g.,
#     `from app.core.clients import build_clients, ClientBundle` in main.py — are fine.)
git grep -E "^from app\.core import (clients|llm_config)( |,|$)" backend/app/   # empty
git grep -E "^import app\.core\.(clients|llm_config)( |$)" backend/app/         # empty

# 2. No qualified module-access in services or routers
git grep -E "(^|[ (])clients\.(driver|client|s3_client|pc|graph)" backend/app/services backend/app/routers   # empty
git grep -E "(^|[ (])llm_config\.(llm|llm2|llm_transformer|vision|memory|agent_chain|chain|chain2)" backend/app/services backend/app/routers   # empty

# 3. TD-003 retired
git grep "@app.on_event" backend/app/   # empty
git grep "lifespan" backend/app/main.py   # 1+ hits

# 4. No source-patches at the old module targets
git grep -E "mocker\.patch.*app\.core\.(clients|llm_config)" backend/tests/   # empty

# 5. Tests pass
cd backend && pytest tests/        # green; same test count as Phase E baseline
```

### 7.2 Soft (verifiable manually)

- `app/core/clients.py` contains only `ClientBundle`, `build_clients`, and imports. No module-level construction.
- `app/core/llm_config.py` contains only `LLMBundle`, `build_llm_config`, and imports. No module-level construction.
- `app/core/dependencies.py` exists with all 13 providers (5 client + 8 LLM).
- `app/main.py` defines `lifespan` and passes it to `FastAPI(lifespan=...)`.
- `_ensure_market_scoring_indexes` runs inside `lifespan`, not via `@app.on_event`.
- `app/services/_neo4j_helpers.py` holds the moved Cypher utility functions.
- Session-scope autouse leak-detection fixture is in `tests/conftest.py`.
- `docs/TECH_DEBT.md` TD-003 has a "Resolved 2026-05-22 by Phase F" line.

### 7.3 Phase complete when

- All ~16 commits land on `master`.
- TD-003 closed in `docs/TECH_DEBT.md`.
- This spec's Phase G inventory section (§8 below) captures remaining items the next phase will consider.
- `pytest backend/tests/` green; test count matches Phase E baseline.

### 7.4 Open questions (resolvable during execution, not blocking spec)

1. **Are there `backend/scripts/*.py` callers that import `app.core.clients` or `app.core.llm_config`?** Grep on commit 1. Likely zero (Phase A's analogous audit found none) but worth confirming. If found, refactor those callsites to invoke factories directly.
2. **Does any admin tool (`admin_panel.html`, `registration_admin_panel.html` server-side request paths) reach into module globals?** Same audit. Admin panels are static HTML served by FastAPI; if their backing endpoints touch globals, they're caught by the service conversion commits.
3. **Final naming of the moved helper module:** `app/services/_neo4j_helpers.py` matches the `_retrieval`/`_claude_budget`/`_llm_helpers` precedent. Alternative `app/core/neo4j_helpers.py` is also defensible. Pick during execution based on import-call-graph cleanliness.
4. **Position of the leak-detection autouse fixture:** root `tests/conftest.py` (applies to both layers) vs unit-only. Default to root.

---

## 8. Phase G+ Inventory (carry-forward)

Phase D's §8 listed twelve Phase E+ candidates. Phase E consumed #2 (test improvements). Phase F consumes #1 (dependency injection) and #6 (lifespan migration / TD-003). The rest carry forward.

### Phase G candidates (most likely next phase)

1. **Security hardening.** Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87,94,104`), missing `LIMIT` on `/leads`, CORS off `*`, raw Cypher endpoint guard. Both Phase D §8 and Phase E §2.2 anchored this as Phase F+. Aligns with "before launch" gate per repo CLAUDE.md "Business State".
2. **Pagination convention.** Project-wide bounded-query approach for list endpoints.
3. **`create_index`-on-hot-path audit.** Confirmed site: `leads.py:255-256` in `batch_upload_leads`. Likely more in `customer_profile.py`. Move each to lifespan or to a migration script.
4. **B4 small-pattern dedup audit.** JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.

### Phase H+ candidates

5. **TD-004 — real LLM captures.** Run `capture_fixtures.py` with full API keys; replace 24 stubs in `tests/fixtures/captured/*.json`. CTO owns. Independent of Phase F.
6. **Phase E review follow-ups:** M1 (pytest-asyncio migration), M4 (pytest config + markers + `make test-unit` / `make test-integration`), L4 (CI staleness check for captured fixtures).
7. **Anthropic SDK migration.** Replace bare `requests.post` in Claude paths.
8. **`tiktoken` for budget estimation.**
9. **Redis-backed Claude budget.**
10. **Inline prompts → `app/prompts/`.**
11. **Shared `memory` audit.**

---

## 9. Filename conventions

- **Spec (this document):** `/specs/2026-05-22-backend-modularization-phase-f-design.md`.
- **Plan (next, after spec approval):** `/plans/modularization-plan-6.md`.
- **Branch:** `refactor-backend-modularization-phase-f`.
- **Commit-message format:** `refactor(be): <description> [phase F, commit N/16]` (matches Phase A–E precedent).
