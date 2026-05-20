# Backend Modularization (Phase A) — Design Spec

**Date:** 2026-05-12
**Status:** Approved (pending user spec review)
**Origin:** Brainstorm conversation, 2026-05-12
**Purpose:** Convert `backend/` from a two-file monolith (`api.py` ~5k LOC + `services.py` ~2.6k LOC) into a domain-modular FastAPI app under `backend/app/`, preserving behavior exactly and using the existing characterization-test suite as the contract.

This is **phase A** of a multi-phase modularization series. Phase A is a pure structural split — no behavior changes, no cleanups, no dependency-injection rework. A separate **`modularization-plan-2.md`** will cover phase B (cleanups, dedupe, security hardening, DI).

---

## 1. Purpose & Framing

`backend/api.py` is 4,995 lines holding all 52 FastAPI routes inline (no `APIRouter` usage). `backend/services.py` is 2,632 lines of LLM-driven research, scoring, and document helpers. Both files are growing, and locating any given handler or helper requires text-search rather than navigation. This is the dominant maintainability problem in the backend right now.

The characterization-test suite (just landed in `backend/tests/` over the past few weeks) covers ~8 domain test files with snapshot assertions and fixture builders. That suite is the safety net for this refactor: behavior is "what the tests say it is."

**Goal of phase A:** end with code that is identical in observable behavior but organized into ~11 single-domain router + service module pairs under a clean `backend/app/` package, so subsequent refactors (phase B onward) operate on focused files instead of two monoliths.

---

## 2. Scope

### 2.1 In scope (phase A — this plan)

- Introduce `backend/app/` package with `routers/`, `services/`, `core/`, `models.py`.
- Move all 52 routes into 11 `APIRouter`-based modules under `app/routers/` (taxonomy in §4).
- Move corresponding business logic into matching `app/services/<domain>.py` files.
- Centralize external clients (`s3_client`, `pc` Pinecone) into `app/core/database.py`, joining `driver` (Neo4j), `graph` (Neo4j wrapper), `client` (Mongo).
- Switch test mocks to **source patches** at `app.core.database.*` and `app.core.llm_config.*` (per Q3 decision in §6).
- Adopt qualified-import convention in new modules (`from app.core import database`; reference as `database.driver`).
- Move FastAPI app construction (CORS, logging, middleware) from `api.py` into `app/main.py`.
- Update root `backend/main.py` to a thin shim importing `app` from `app.main`, so existing `uvicorn main:app` invocation keeps working.
- Update `conftest.py` mock paths to source patches; mechanically update any test files that import from `api`/`services` directly.

### 2.2 Out of scope (deferred to phase B — `modularization-plan-2.md`)

- Deduping `search_signals_scout` vs `search_signals_profiler` (~80% overlap).
- Removing `from X import *` patterns inside existing module files.
- Splitting `models.py` into `app/models/<domain>.py`.
- Renaming `app/core/database.py` → `app/core/clients.py` (database is a slight misnomer once it holds S3 + Pinecone).
- Extracting inline helpers beyond the two forced-shared modules (`_retrieval.py`, `_claude_budget.py`).
- Replacing globals (`driver`, `graph`, `client`) with FastAPI `Depends` dependency injection.
- Fixing `/leads` no-LIMIT footgun, Cypher injection sites in `/voice_graph`/`/text_graph`/`/query`, CORS `allow_origins=["*"]`.
- Pagination convention for list endpoints.
- Updating `backend/render.yaml` or any deployment infrastructure (deploy fixes batched after the full refactor series).

### 2.3 Non-goal

"Make the code better." Phase A moves code; it does not edit it. If we discover a real bug during the move, we file it as a phase-B candidate, not fix it inline. The one exception: import errors and obvious typos that surface during the move.

### 2.4 Success criteria

1. `backend/app/` directory exists with the taxonomy in §4.
2. `backend/api.py` and `backend/services.py` no longer exist after the final commit.
3. `pytest backend/tests/` passes with the same set of passing tests as before the refactor (snapshot count unchanged, snapshot content unchanged except for any deliberately approved drift).
4. Every commit on the feature branch is independently passing tests — the branch is bisectable.

Deploy/infra validation is **not** a success criterion. Render and uvicorn invocations are expected to work because the root `main.py` shim preserves the entrypoint, but they are not verified in this plan; infra fixes are batched for after the full refactor series completes.

---

## 3. Constraints & Assumptions

### 3.1 Constraints

- **Tests are the contract for this exercise.** They are described as "guidelines" in normal operation, but during this modularization we treat any test failure as a refactor bug, not a test bug. This discipline is what makes the refactor safe.
- **Polyglot boundary holds.** No frontend changes. No shared utilities across `frontend/` and `backend/`. Phase A is backend-only.
- **CLAUDE.md commit cadence.** "A single plan task = a single commit." Per-domain extractions are individual commits.

### 3.2 Assumptions

1. **Backend subtree won't be syncing back.** Per CLAUDE.md, backend changes on monorepo `master` are not propagated to the original `backend@main` repo during temp week. Plan 06 cutover ends the subtree relationship. We can refactor freely without worrying about file-shape parity with the upstream backend repo.
2. **Pilot users are tolerant.** Some friendly pilots are using the system, but nothing they run is mission-critical. Brief breakage during the branch is acceptable; if a user-visible regression slips into `master`, we have 1-2 days to fix it. This is a license to skip feature flags and rollout ceremony, not a license to be careless.
3. **No CI gating yet.** The test suite is run locally (`pytest backend/tests/`). No GitHub Actions workflow runs backend tests on PR. We rely on the developer running tests at every commit.
4. **Characterization tests fully cover the routes we care about.** Snapshot-keyed responses lock in observable behavior. Test failure during the refactor = refactor bug.

---

## 4. Module Taxonomy

11 router modules + 11 matching service modules + 2 forced shared helper modules.

### 4.1 Routers (under `app/routers/`)

| Module | Routes | Service-side counterpart |
|---|---|---|
| `documents` | `POST /upload_file/`, `POST /upload`, `POST /upload-document`, `GET /document-status/{file_key:path}`, `GET /user-documents`, `DELETE /data-source/{file_id}`, `PUT /data-source/{file_id}` | `load_document`, `grapher`, `process_prospect_list` |
| `leads` | `GET/POST/PUT/DELETE /leads`, `POST /leads/batch-upload`, `GET /leads/by-file`, `GET /leads/stream/status`, `DELETE /leads/by-file/{file_id}` | `fetch_leads_for_org` |
| `market_scoring` | `POST /leads/market-scores`, `GET /leads/market-scores/status`, `GET /leads/{lead_id}/market-score-descriptions` | All `_*market_score*` / `_*scoring*` helpers from api.py:177-490; `score_single_lead_against_market`, `get_company_profile_for_org`, `get_market_reports_for_org` |
| `market_research` | `POST /market-research`, `POST /market-research_claude` | `Research_Market_1..5`, `_market_research_agent_output` |
| `icp` | `GET /icp`, `POST /icp-research`, `POST /icp-research_claude`, `DELETE /icp/recommended/{icp_id}` | `ICP_generator`, `icp_research_1..4`, `_icp_research_agent_output`, `_ensure_icp_id_registry_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` |
| `signals` | `POST /signals-research`, `POST /generate-signals-batch`, `POST /generate-signals-batch_claude`, `GET /fetch-signals`, `POST /signal_action`, `POST /signal_Ask`, `POST /signal_ask_claude` | `search_signals_scout`, `search_signals_profiler`, `_signals_agent_output`, `_generate_signals_batch_core` |
| `profiles` | `GET/POST /profile/{profile_type}`, `POST /cleanup-company-profiles`, `POST /edit` | (none today — handler logic inline) |
| `customer_profile` | `GET/POST /customer_profile`, `POST /customer_profile/from_suggested_icp`, `DELETE /customer_profile/icp/{icp_id}` | (none today — handler logic inline) |
| `org_auth` | `GET/POST /org`, `POST /connect_org`, `GET/POST /registration` | (none today — handler logic inline) |
| `graph_chat` | `POST /create-company`, `GET /ask`, `GET /chat`, `GET /query`, `POST /voice_graph`, `POST /text_graph` | `create_prospect_node`, `convert_audio_to_text`, `get_linkedin_followers`, `get_linkedin_recent_activity`, `extract_linkedin_username`, `calculate_prospect_score`, `get_ranked_prospects`, `extract_number`, `score_prospect` |
| `pipeline` | `GET /Sales_Pipeline`, `GET /test-llm` | (none — inline) |

**Route count audit:** documents 7 + leads 8 + market_scoring 3 + market_research 2 + icp 4 + signals 7 + profiles 4 + customer_profile 4 + org_auth 5 + graph_chat 6 + pipeline 2 = **52 total**. (org_auth contributes 5: `GET /org`, `POST /org`, `POST /connect_org`, `GET /registration`, `POST /registration`. profiles' 4 includes `POST /cleanup-company-profiles`.)

### 4.2 Forced shared helper modules (under `app/services/`)

Two helpers are used by 2-3 domains. They are not "extracted helpers" (a phase-B move); they are forced by the split because their original parent file disappears. Leading underscore signals they are internal to the services layer.

- **`app/services/_retrieval.py`** — `_stringify_context_for_query`, `_build_market_context_queries`, `_build_signal_context_queries`, `_fetch_pinecone_supporting_context` (from api.py:66-160). Consumed by `market_research`, `signals`, `icp`.
- **`app/services/_claude_budget.py`** — `_estimate_token_count`, `_prune_claude_signal_window`, `_reserve_claude_signal_budget`, `_finalize_claude_signal_budget` plus the module-level `_claude_signal_usage_window`, `_claude_signal_usage_lock`, `_claude_signal_total_runs` globals (from api.py:687-758). Consumed by all `_claude` route variants across `signals`, `market_research`, `icp`.

### 4.3 Core (under `app/core/`)

- **`config.py`** — moved from `backend/config.py`, content unchanged.
- **`database.py`** — moved from `backend/database.py`, with `s3_client` and `pc` (Pinecone) added from current `api.py` module-level bindings. Inline `Pinecone(api_key=...).Index(...)` construction (currently in api.py:123, which redundantly creates a new client per call alongside the existing module-level `pc` singleton) becomes `database.pc.Index(...)`. Pinecone clients are stateless HTTP wrappers; consolidating to the singleton is observably equivalent to the current behavior.
- **`llm_config.py`** — moved from `backend/llm_config.py`, content unchanged.

### 4.4 Models

- **`app/models.py`** — moved from `backend/models.py`, content unchanged. (Split into `app/models/<domain>.py` is deferred to phase B.)

---

## 5. Directory Layout

```
backend/
├── main.py                       # 4-line shim: `from app.main import app`
├── render.yaml                   # NOT updated (deploy fix batched after refactor series)
├── requirements.txt              # unchanged
├── requirements-test.txt         # unchanged
├── pytest.ini                    # unchanged (verify on commit 1)
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI() construction, CORS, logging, include_router calls
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py           # adds s3_client + pc alongside existing driver/graph/client
│   │   └── llm_config.py
│   ├── models.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── documents.py
│   │   ├── leads.py
│   │   ├── market_scoring.py
│   │   ├── market_research.py
│   │   ├── icp.py
│   │   ├── signals.py
│   │   ├── profiles.py
│   │   ├── customer_profile.py
│   │   ├── org_auth.py
│   │   ├── graph_chat.py
│   │   └── pipeline.py
│   └── services/
│       ├── __init__.py
│       ├── _retrieval.py
│       ├── _claude_budget.py
│       ├── documents.py
│       ├── leads.py
│       ├── market_scoring.py
│       ├── market_research.py
│       ├── icp.py
│       ├── signals.py
│       ├── profiles.py
│       ├── customer_profile.py
│       ├── org_auth.py
│       ├── graph_chat.py
│       └── pipeline.py
├── scripts/                      # unchanged
├── tests/
│   ├── conftest.py               # patch targets switched to app.core.*
│   ├── fixtures/                 # unchanged
│   ├── __snapshots__/            # unchanged
│   └── test_*.py                 # bodies mostly unchanged; mechanical import updates only
├── admin_panel.html              # unchanged
├── registration_admin_panel.html # unchanged
└── *.md docs                     # unchanged
```

**Files removed at end of phase A:**
- `backend/api.py`
- `backend/services.py`
- `backend/config.py` (moved to `app/core/`)
- `backend/database.py` (moved to `app/core/`)
- `backend/llm_config.py` (moved to `app/core/`)
- `backend/models.py` (moved to `app/`)

**Files staying put:**
- `backend/main.py` — becomes a 4-line shim
- `backend/admin_panel.html`, `backend/registration_admin_panel.html`
- `backend/scripts/`, `backend/test_*.py` (live-prod smoke probes — out of scope), `backend/cleanup_company_profile.py`
- `backend/tests/` directory layout
- All `backend/*.md` documentation files

---

## 6. Test Mocking Strategy

### 6.1 Convention: qualified imports in new modules

Every new module references module-supplied globals via qualified imports:

```python
# app/routers/leads.py — RIGHT
from app.core import database

@router.get("/leads")
def get_all_leads(org_id: str = Query(...)):
    with database.driver.session() as session:
        ...

# WRONG — binds local reference at import time, defeats source-patching
from app.core.database import driver
```

This convention applies to both first-party modules (`database`, `llm_config`, `models`, `config`) and third-party libraries we want mockable at source (e.g., `pinecone`).

### 6.2 Patch table — before vs after

| Today (~15 patches across api.*, services.*, llm_config.*) | After (6 patch targets) |
|---|---|
| `api.driver`, `services.driver` | `app.core.database.driver` |
| `api.client`, `services.client` | `app.core.database.client` |
| `api.s3_client` | `app.core.database.s3_client` |
| `api.pc`, `api.Pinecone` | `app.core.database.pc` |
| `api.graph`, `services.graph`, `llm_config.graph` | `app.core.database.graph` |
| `services.agent_chain`, `llm_config.agent_chain` | `app.core.llm_config.agent_chain` |
| `llm_config.{chain, chain2, llm, llm2, llm_transformer}`, `api.{chain, chain2, llm2}`, `services.{llm, llm2, llm_transformer}` | `app.core.llm_config.{chain, chain2, llm, llm2, llm_transformer}` |

The `api.Pinecone` constructor patch becomes unnecessary: with `database.pc` as the singleton, the inline construction in `_fetch_pinecone_supporting_context` goes away.

### 6.3 conftest.py fixture rewrites (sketch)

```python
@pytest.fixture
def mock_neo4j(mocker):
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("app.core.database.driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}

@pytest.fixture
def mock_mongo(mocker):
    mongo = MagicMock()
    mocker.patch("app.core.database.client", mongo)
    return mongo

@pytest.fixture
def mock_llm_chain(mocker):
    chain = MagicMock()
    mocker.patch("app.core.llm_config.agent_chain", chain)
    return chain

@pytest.fixture
def mock_llm_config(mocker):
    mocks = {}
    for name in ("chain", "chain2", "llm", "llm2", "llm_transformer", "graph"):
        mocks[name] = MagicMock(name=f"llm_config.{name}")
        mocker.patch(f"app.core.llm_config.{name}", mocks[name])
    mocker.patch("app.core.database.graph", mocks["graph"])  # same Neo4jGraph object
    return mocks

@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("app.core.database.s3_client", s3)
    return s3

@pytest.fixture
def mock_pinecone(mocker):
    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    mocker.patch("app.core.database.pc", pc)
    return pc
```

The composite `client` fixture (combining all the above) stays unchanged in structure.

### 6.4 sys.path and pytest.ini

`backend/tests/conftest.py` currently inserts `backend/` and the monorepo root into `sys.path`. With `app` as a subpackage of `backend/`, that sys.path entry makes `import app.main` work as expected. No `pytest.ini` change required. Safety belt: verify on commit 1 that `import app.main` resolves under test.

### 6.5 Test file changes

Test bodies (`test_leads.py`, `test_signals.py`, etc.) don't change for the most part. They consume the `client` fixture and exercise routes by URL. The few that import directly from internal modules (e.g., `from api import app`, `from main import app`) become `from app.main import app` — a mechanical sed-replace across `tests/`.

---

## 7. Migration Sequencing

Single feature branch off `master`: `refactor/backend-modularization-phase-a`. Many small commits, no squash.

### Phase 1 — Prep (3 commits)

1. **Scaffold `app/` skeleton.** Empty `app/`, `app/core/`, `app/routers/`, `app/services/` dirs with `__init__.py` files. No behavior change.
2. **Move core files to `app/core/`.** Move `config.py`, `database.py`, `llm_config.py` → `app/core/`. Move `models.py` → `app/models.py`. Add `s3_client` + `pc` into `app/core/database.py`. Switch `api.py` and `services.py` to qualified imports (`from app.core import database`). Update `conftest.py` to source-patch new paths per §6. Critical commit; test suite must be fully green at end.
3. **Move FastAPI app construction to `app/main.py`.** Move `app = FastAPI(...)`, CORS, logging from `api.py` to `app/main.py`. Root `backend/main.py` becomes 4-line shim. `api.py` decorators now reference the imported `app`.

### Phase 2 — Extract no-service-dep domains (4 commits)

Warm-up: inline-only handlers, no services.py content to move.

4. **Extract `pipeline`** (2 routes — smallest first).
5. **Extract `org_auth`** (4 routes).
6. **Extract `profiles`** (4 routes).
7. **Extract `customer_profile`** (4 routes).

### Phase 3 — Extract domains with services (3 commits)

8. **Extract `documents`** (7 routes + 3 service functions).
9. **Extract `leads`** (8 routes + `fetch_leads_for_org`).
10. **Extract `graph_chat`** (6 routes + LinkedIn/prospect-scoring helpers).

### Phase 4 — Shared helpers + LLM-heavy domains (5 commits)

11. **Create shared helper modules.** Move `_retrieval` helpers → `app/services/_retrieval.py`. Move `_claude_budget` helpers + module-level globals → `app/services/_claude_budget.py`. No domain extraction in this commit — isolates the move so any breakage is unambiguous.
12. **Extract `icp`** (4 routes + `ICP_generator`, `icp_research_1..4`, ICP-id registry helpers).
13. **Extract `market_research`** (2 routes + `Research_Market_1..5`).
14. **Extract `signals`** (7 routes + Scout/Profiler search functions + `_generate_signals_batch_core`).
15. **Extract `market_scoring`** (3 routes + the entire scoring helper cluster — largest, most-stateful, last).

### Phase 5 — Finalize (1 commit)

16. **Delete `api.py` and `services.py`.** Both files should be empty at this point — investigate any residue, don't silently delete. Verify with `git grep "from api"`, `git grep "from services"` that no other file still imports from them. Run full test suite. Delete the files.

**Total: 16 commits.** Each commit independently green; branch is bisectable.

### Per-commit validation routine

1. Make the move.
2. `cd backend && pytest tests/ -x` — must be green.
3. `git diff --stat` — sanity-check the diff size matches expectation (no accidental scope creep).
4. Commit with message format: `refactor(be): extract <domain> router and service [phase A, commit N/16]`.

### Rollback strategy

Every commit is independently green and small. Rollback = `git revert <sha>`. No feature flags, no shims (per assumption 3.2.2).

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A patched symbol gets missed; a test silently no-ops and hits prod | Medium | Before commit 2, `git grep "mocker.patch"` across all test files; build a complete patch-target census; assert every target is mapped to a new location |
| `__snapshots__/` content drifts on response-key reordering | Low-Medium | Snapshots are dict-ordered; serialization order should be stable. `--snapshot-update` only if failure is unambiguously a reordering artifact |
| Module-level side effects don't fire after split (e.g. CORS middleware applied twice or zero times) | Medium | `app/main.py` is the single FastAPI() construction site. Verify in commit 3 by hitting `OPTIONS` on at least one route |
| Circular imports between `app/routers/X` and `app/services/X` | Low | Routers import services; services never import routers. Enforced by convention |
| Cypher `f`-string injection sites preserved verbatim | High (intentional) | Phase B scope. We move them as-is — "no behavior change" |
| Test files import from `api` or `services` directly | Low-Medium | `git grep "from api"`, `git grep "from services"` across `tests/`; mechanical sed-replace |
| `backend/render.yaml` start command path becomes wrong | Low | Root `backend/main.py` stays as a shim; existing `uvicorn main:app` keeps working |
| The `_claude_budget` module-level globals (`_claude_signal_usage_window`, `_claude_signal_usage_lock`) move correctly with their state semantics | Medium | These are intentionally shared mutable state across LLM calls. Move them together in one commit (§7 commit 11), verify by running signals tests immediately after |

### Open questions to resolve during execution (not blocking spec)

- Are there import sites OUTSIDE `backend/` that reach into `backend.config`, `backend.api`, etc.? Likely zero; `git grep "from backend"` and `git grep "import backend"` before starting.
- Does `pytest.ini`'s `testpaths` need adjustment? Probably not; verify on commit 1.
- `backend/__init__.py` is 66 bytes — inspect on commit 1 to confirm it's trivial.

---

## 9. Phase B Inventory (Deferred — `modularization-plan-2.md`)

Captured here so the inventory isn't lost; not in scope for phase A.

1. **Dedupe Scout/Profiler signal search** — `search_signals_scout` and `search_signals_profiler` are ~80% identical; collapse to one function parameterized by persona/prompt.
2. **Replace `from X import *` patterns** that survive across remaining files (e.g., the original `from config import *` style if any callers remain).
3. **Split `models.py`** into `app/models/<domain>.py` matching the router taxonomy.
4. **Rename `app/core/database.py` → `app/core/clients.py`** (now that it holds Neo4j + Mongo + S3 + Pinecone — "database" misleading).
5. **Audit and dedupe** the rest of `_*` helpers extracted in phase A; some may be near-duplicates across domains.
6. **Dependency injection for clients** — replace globals (`database.driver`, `database.client`) with FastAPI `Depends` providers; rework conftest accordingly.
7. **Security hardening pass** — parametrize Cypher `f`-strings in `/voice_graph`, `/text_graph`, `/query/`; add `LIMIT` to `/leads`; tighten CORS off `*`.
8. **Pagination convention** for `/leads` and other list endpoints.

---

## 10. Filename Conventions

- **Spec (this document):** `/specs/2026-05-12-backend-modularization-design.md`.
- **Plan (next, after spec approval):** `/plans/modularization-plan-1.md`.
- **Future phase B plan:** `/plans/modularization-plan-2.md`.
