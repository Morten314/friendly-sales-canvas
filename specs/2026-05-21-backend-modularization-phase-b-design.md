# Backend Modularization (Phase B) — Design Spec

**Date:** 2026-05-21
**Status:** Approved (pending user spec review)
**Origin:** Brainstorm conversation, 2026-05-21
**Purpose:** Make the layered architecture that Phase A *drew* actually *true*. Pull business logic out of routers and into services, dedupe the four-fold copies that Phase A preserved verbatim, split `models.py` per domain, annotate response models, rename `database.py` to reflect what it actually holds, and sweep the surviving language-hygiene papercuts. Security work and dependency injection are explicitly out of scope.

This is **phase B** of the multi-phase modularization series. Phase A (`/specs/2026-05-12-backend-modularization-design.md`) was a pure structural split — no behavior changes. The post-Phase-A code review (`/docs/code-review-backend-modularization-phase-a.md`) catalogued ~20 follow-ups that Phase A intentionally deferred; Phase B picks up the non-security subset of those. Security hardening and DI rework are deferred to a future phase.

---

## 1. Purpose & Framing

Phase A successfully split `api.py` (4,995 LOC) and `services.py` (2,633 LOC) into 11 domain-named router + service module pairs under `app/`. But the split was mechanical: code was moved, not improved. Four service modules ended up empty stubs (`pipeline`, `org_auth`, `profiles`, `customer_profile`) with all logic still in the router. Heavy routers (`documents` at 879 LOC, `signals` at 901, `icp` at 543, `leads` at 499) still contain inline Neo4j sessions, inline `MongoClient` constructions (26 across the tree), and copy-pasted Groq/Claude handler pairs. `search_signals_scout` and `search_signals_profiler` remain ~80% identical. `models.py` is still one 229-line file with 27 classes. Only `market_scoring` (the last domain Phase A extracted, and the cleanest of the Phase A modules) has `response_model` annotations.

**Goal of Phase B:** end with a codebase where the router → service boundary actually means something — routers do HTTP, services do work — and where each domain owns one canonical implementation, one set of models, and one set of HTTP response contracts.

Phase B is still a refactor: no API surface changes, no behavior changes that consumers can observe. The characterization test suite is again the safety net. The two material exceptions are:

1. **`response_model` enforcement may surface latent serialization bugs.** When FastAPI is told a response shape, it validates and filters. Handlers that currently return mismatched dicts will now be caught. Phase A's "no behavior change" rule yields to "make the contract explicit"; mismatches surfaced this way are pre-existing bugs whose fix is in-scope for the commit that introduces the annotation.
2. **`MongoClient` consolidation removes 26 per-request client constructions.** Today each inline `MongoClient(mongo_uri)` opens a fresh connection pool per handler invocation. The centralized singleton has *better* observable behavior (no connection storm under load); the change is conservatively safe but not strictly "no behavior change."

Beyond those two, behavior is preserved exactly.

---

## 2. Scope

### 2.1 In scope (Phase B — this plan)

Eight work categories, ~25 commits, single feature branch off `master`.

**A — Boundary & layering cleanup.**
- A1: Extract business logic from the 4 stub-service routers (`pipeline`, `org_auth`, `profiles`, `customer_profile`) into their `services/<domain>.py` files.
- A2: Reduce inline DB access from heavy routers (`documents`, `signals`, `icp`, `leads`) by extracting handler bodies into service functions.
- A3: Relocate `logger` from `app/main.py` to `app/core/logging.py` to eliminate the `from app.main import logger` partial-init path.
- A4: Replace `HTTPException` raises in service layer (`services/icp.py:689`, `services/_claude_budget.py:55-63`) with domain exceptions; routers convert at the HTTP boundary.
- A5: Promote `_tavily_context_and_urls` and `_claude_messages_text` (currently private in `services/market_research.py`, imported by `services/icp.py` and `services/signals.py`) to a shared `app/services/_llm_helpers.py`.

**B — Deduplication.**
- B1: Centralize the 26 inline `MongoClient(mongo_uri)` constructions to use `app.core.clients.client` (the primary cluster) and `app.core.clients.profiler_client` (the secondary "Profiler" cluster).
- B2: Collapse the Groq/Claude handler pairs in `market_research`, `icp`, `signals` routers — currently ~95% identical, differ only in a function-map selector and an API-key check.
- B3: Collapse `search_signals_scout` and `search_signals_profiler` in `services/signals.py` into a single `search_signals(...persona=...)` function.

**C — Structural / API surface.**
- C1: Split `app/models.py` (229 LOC, 27 classes) into `app/models/<domain>.py` files matching the router taxonomy.
- C2: Rename `app/core/database.py` → `app/core/clients.py`. The file holds Neo4j driver + Mongo client + S3 + Pinecone; "database" was misleading.
- C3: Add `prefix` and `tags` to every `APIRouter()` construction. Today every router declares paths in full (`@router.get("/leads")`) and Swagger lists everything untagged.
- C4: Add `response_model` to all 10 routers currently missing it. (`market_scoring` already has it; it's the pattern exemplar.)

**E — Code/language hygiene.**
- E1: Replace bare `except:` with `except Exception:` across `routers/documents.py`, `routers/signals.py`, `services/market_research.py`, `services/signals.py`.
- E2: Replace `print()` diagnostic output with `logger` in `routers/icp.py` (13 sites) and `routers/signals.py` (6 sites).
- E3: Replace `datetime.utcnow()` (deprecated in Python 3.12+) with `datetime.now(timezone.utc)` across 10+ sites.
- E4 — `extract_number` return-type lie (`services/graph_chat.py:152-154`, annotated `-> str` but returns `None`). **Deferred to Phase C.** A2 doesn't touch `graph_chat`; a one-line type fix doesn't justify a dedicated Phase B commit. Tracked here for completeness.

### 2.2 Out of scope (deferred to Phase C / D)

- **Dependency injection (D1, D2 from inventory).** Replacing `database.driver` / `database.client` / `database.s3_client` / `database.pc` / `database.graph` and the `llm_config.*` globals with FastAPI `Depends` providers, and reworking `conftest.py` from source-patching to dependency overrides. This is the heaviest single bet in the refactor series and reshapes every test file. It deserves its own phase, and it depends on services owning DB access — which Phase B delivers.
- **Security hardening (explicit user decision):** Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87, 94, 104`), `/leads` `LIMIT` clause, CORS off `*`, raw Cypher endpoint guarding. Skipped because Brewra is MVP with 0 live users (per `CLAUDE.md` "Business State"); deferred to a security-focused phase before launch.
- **Pagination convention (F1 in inventory).** List endpoints other than `/leads` may also lack `LIMIT`; introducing a per-endpoint pagination contract is its own phase, paired with FE consumption.
- **B4 — small-pattern dedup audit** (JSON string detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3). Opportunistic during A2 if the duplication is obvious; not a coherent commit set by itself.
- **G — test improvements** (Claude-variant coverage, Cypher query content verification, background-task tests, dead-imports / dead-assertions / overly-permissive assertions). Several G items become moot after Phase B reshapes routers; the rest belongs in a dedicated test-improvement phase. Phase B will keep tests *passing*; making tests *better* is its own track.
- **H — deeper concerns** (Anthropic SDK migration, `tiktoken` for budget estimation, shared `memory` cross-conversation audit, per-process token budget Redis migration, inline LLM prompts → `app/prompts/`). Phase D+ material; some require infrastructure decisions (Redis) we're not making now.

### 2.3 Non-goal

"Make the code better in ways the user didn't ask for." Phase B has a finite scope: the categories listed in §2.1. If we discover a real bug during the move, file it as a Phase C candidate, not fix it inline. The exception is mismatched-response-shape bugs surfaced by C4 — those *are* the work of the commit that introduces the annotation.

### 2.4 Success criteria

1. The 4 stub service modules (`pipeline`, `org_auth`, `profiles`, `customer_profile`) each have real business logic; their routers are HTTP wiring only.
2. The 4 heavy routers (`documents`, `signals`, `icp`, `leads`) drop substantially in LOC, with the moved logic landing in their `services/<domain>.py` counterparts.
3. Zero inline `MongoClient(mongo_uri)` constructions remain in the tree. All Mongo access goes through `app.core.clients.client` or `app.core.clients.profiler_client`.
4. `search_signals_scout` and `search_signals_profiler` no longer exist as distinct functions; `search_signals(persona=...)` replaces both.
5. Groq/Claude router pairs collapsed: one implementation per domain, parameterized by `llm_backend`.
6. `app/models.py` no longer exists. `app/models/` is a package with per-domain submodules.
7. `app/core/database.py` no longer exists. `app/core/clients.py` is the canonical location.
8. Every `APIRouter()` declaration includes `prefix` and `tags`.
9. Every endpoint has a `response_model` annotation (or an explicit comment justifying omission, for endpoints returning genuinely heterogeneous shapes).
10. No bare `except:` clauses, no `print()` for diagnostic output, no `datetime.utcnow()` calls remain in `app/`.
11. `pytest backend/tests/` passes with the same set of passing tests (snapshot count unchanged; snapshot content unchanged except for deliberately approved drift from C4-surfaced bug fixes).
12. Every commit on the feature branch is independently green — the branch is bisectable.

---

## 3. Constraints & Assumptions

### 3.1 Constraints

- **Tests are the contract.** Same discipline as Phase A: during this refactor, any test failure is a refactor bug, not a test bug. The few exceptions are C4-surfaced bugs (handler returns shape that doesn't match the model — fix in the same commit).
- **Single plan task = single commit** (per `CLAUDE.md`). 25 commits, each atomic.
- **Polyglot boundary holds.** No frontend changes. C4's `response_model` annotations will eventually give the frontend inferred types, but that's a Phase C+ deliverable; Phase B just *publishes* the contract.
- **No API surface changes.** Route paths, HTTP methods, status codes, response keys: all unchanged. (Response shapes may become *stricter* if C4 surfaces bugs — fields that were extraneous get dropped, missing required fields cause 500s during testing and get fixed.)

### 3.2 Assumptions

1. **Phase A's test suite still adequately characterizes behavior.** 9 test files cover the major routes with snapshot assertions. New tests aren't required for Phase B's correctness; if a Phase B commit's diff exceeds what the existing tests cover, that's an opportunity (Phase C test phase) not a blocker.
2. **Brewra remains at 0 live users / MVP.** Operationally safe to ship aggressive refactors on `master`. Per `CLAUDE.md` "Business State," velocity is preferred over rollout ceremony.
3. **Backend subtree won't be syncing back.** Same as Phase A assumption 3.2.1. Backend changes on monorepo `master` are not propagated to upstream during the temp-week period; that period is now essentially over (cutover targeted ~2026-05-22). Phase B will likely run partially during cutover and partially after; neither half presents a sync issue.
4. **Existing in-process patterns stay.** `BackgroundTasks` (no queue), in-process `_claude_signal_usage_window` (no Redis), shared `memory` in `llm_config` (no fresh-per-request) all remain. These are Phase D+ concerns; Phase B doesn't touch them.

---

## 4. Work Categories — Detail

### 4.1 A — Boundary & layering

#### A1 — Extract stub services

The 4 routers with empty service counterparts hold all their logic inline. For each, the move pattern is:

1. Identify business logic blocks in the router (anything beyond request parsing and response construction).
2. Move those blocks to functions in `services/<domain>.py`.
3. Router calls service functions; passes through user-supplied parameters; wraps service results in HTTP responses.

Per-domain notes:

- **`pipeline`** (2 routes, 81 LOC router, 5 LOC service). Smallest. Likely 1 commit. The `/Sales_Pipeline` handler computes stage stats; service function: `compute_sales_pipeline(org_id) -> SalesPipelineResponse`. `/test-llm` is a diagnostic and may stay in the router (no business logic).
- **`org_auth`** (5 routes, 269 LOC router, 5 LOC service). 3 inline `MongoClient` blocks. After B1 these become `clients.client`; A1 then moves the registration/connect/list logic into service functions.
- **`profiles`** (4 routes, 288 LOC router, 5 LOC service). 2 inline `MongoClient` blocks plus inline Neo4j Cypher. Service functions: `get_profile`, `upsert_profile`, `cleanup_company_profiles`, `edit_profile_field`.
- **`customer_profile`** (4 routes, 451 LOC router, 1 LOC service). The biggest stub-counterpart router. Pure router → service refactor.

Each A1 sub-commit moves one domain's logic. 4 commits total.

#### A2 — Reduce heavy routers

The 4 heavy routers in ascending LOC order:

- **`leads`** (499 LOC). Service today is 41 LOC. After A2 the router shrinks to ~150-200 LOC; service grows correspondingly.
- **`icp`** (543 LOC). 2 inline Mongo blocks. Already imports private helpers from `market_research`; A5 cleans those up.
- **`signals`** (901 LOC, 8 inline Mongo). Largest. Service has 645 LOC already; A2 + B3 reshape it substantially.
- **`documents`** (879 LOC, 10 inline Mongo). The worst offender. Service today is 113 LOC.

The order is deliberately *smallest-first* (matching Phase A's philosophy and warming up on cleaner targets). 4 commits.

**Extraction rule:** anything that touches a database (Neo4j session, Mongo client, S3, Pinecone) belongs in the service. Anything that parses an HTTP body or constructs an HTTP response belongs in the router. Anything in between (validation, transformation, business rules) goes in the service unless it's pure request/response shape work.

#### A3 — Logger relocation

Today:

```python
# app/main.py
logger = logging.getLogger("brewra")

# app/routers/{org_auth,documents,leads}.py
from app.main import logger
```

This works because `logger` is defined at `app/main.py:25` *before* the router imports at line 45. Move it:

```python
# app/core/logging.py
import logging
logger = logging.getLogger("brewra")

# app/main.py, app/routers/*, app/services/*
from app.core.logging import logger
```

1 commit. Mechanical sed across `app/`. Tests should be unaffected.

#### A4 — Domain exceptions

Create `app/core/exceptions.py`:

```python
class BrewraError(Exception):
    """Base for domain exceptions raised from the services layer."""

class BudgetExhaustedError(BrewraError):
    """Claude per-window token budget exhausted."""

class ICPIdRegistryError(BrewraError):
    """ICP id reservation could not be acquired."""
```

In services, replace:

```python
# services/_claude_budget.py
raise HTTPException(status_code=429, detail="Claude budget exhausted")

# services/icp.py:689
raise HTTPException(...)
```

with the domain exception. Routers catch:

```python
try:
    result = signals_service.run_signals_ask_claude(...)
except BudgetExhaustedError as e:
    raise HTTPException(status_code=429, detail=str(e))
```

1 commit. Touches 2 service files, 3-4 router files.

#### A5 — Shared LLM helpers

Create `app/services/_llm_helpers.py`. Move:

- `_tavily_context_and_urls` (currently `services/market_research.py`)
- `_claude_messages_text` (currently `services/market_research.py`)

Update imports in `services/icp.py` and `services/signals.py` (the current consumers). `services/market_research.py` also imports them from the new location. 1 commit.

### 4.2 B — Deduplication

#### B1 — Centralize MongoClient

The 26 inline constructions all do the same 4 lines:

```python
username = urllib.parse.quote_plus("techbrewra")
password = urllib.parse.quote_plus("Brewra@Best09")
mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/..."
client = MongoClient(mongo_uri)
```

After Phase B:

```python
from app.core.clients import client  # (post-C2 rename)
```

Distribution today:
- `routers/documents.py`: 10
- `routers/signals.py`: 8
- `routers/org_auth.py`: 3
- `routers/icp.py`: 2
- `routers/profiles.py`: 2
- `services/market_scoring.py`: 1 (the legitimate Profiler-cluster helper; this one stays, since it points at a *different* cluster)

`market_scoring._get_profiler_mongo_client()` already encapsulates the Profiler-cluster client. Promote it to `app.core.clients.profiler_client` as a module-level singleton (mirroring how `client` works for the primary cluster). The 1 inline construction in `services/market_scoring.py` then imports `from app.core.clients import profiler_client`.

**Sequencing:** B1 lands *before* A1 and A2, in one sweep across all 6 files. The subsequent A1/A2 extractions then move code that already uses centralized clients. 1 commit, large diff (~70 lines changed across 6 files).

**Operational note:** removing 26 per-request `MongoClient(...)` constructions reduces connection-pool churn under load. PyMongo's `MongoClient` is thread-safe and pools connections; the singleton pattern is the recommended use.

#### B2 — Groq/Claude collapse

Each of `market_research`, `icp`, `signals` has two router endpoints that differ only in the function map and an API-key check:

```python
@router.post("/market-research")
def market_research(request): ...  # uses COMPONENT_FUNCTIONS

@router.post("/market-research_claude")
def market_research_claude(request): ...  # uses COMPONENT_FUNCTIONS_CLAUDE
```

Collapse pattern: one private worker, two thin wrappers.

```python
def _run_market_research(request: MarketRequest, llm_backend: str) -> dict:
    components = COMPONENT_FUNCTIONS_CLAUDE if llm_backend == "claude" else COMPONENT_FUNCTIONS
    # ... unified body ...

@router.post("/market-research")
def market_research(request: MarketRequest):
    return _run_market_research(request, llm_backend="groq")

@router.post("/market-research_claude")
def market_research_claude(request: MarketRequest):
    return _run_market_research(request, llm_backend="claude")
```

(C4 adds `response_model` separately in Phase B-7.)

Endpoints remain. Code base shrinks ~400 LOC per pair. 3 commits (one per domain pair).

#### B3 — Scout/Profiler collapse

Today in `services/signals.py`:

```python
def search_signals_scout(pre_data, llm_backend="default") -> dict: ...  # ~290 LOC
def search_signals_profiler(pre_data, llm_backend="default") -> dict: ...  # ~290 LOC, ~80% identical
```

After B3:

```python
from typing import Literal

def search_signals(
    pre_data,
    persona: Literal["scout", "profiler"] = "scout",
    llm_backend: str = "default",
) -> dict: ...
```

The persona switch parameterizes:
- Prompt template (scout-style vs profiler-style language)
- Mongo collection target (different DBs)
- Output field naming (where they differ)

Router callsites in `routers/signals.py`:

```python
# Before
signals_result = await asyncio.to_thread(signals_service.search_signals_scout, pre_data, llm_backend)
signals_result = await asyncio.to_thread(signals_service.search_signals_profiler, profiler_pre_data, llm_backend)

# After
signals_result = await asyncio.to_thread(signals_service.search_signals, pre_data, persona="scout", llm_backend=llm_backend)
signals_result = await asyncio.to_thread(signals_service.search_signals, profiler_pre_data, persona="profiler", llm_backend=llm_backend)
```

The `PERSONA_SEARCH_FUNCTIONS` dispatch dict at `services/signals.py:642-645` is dropped (it pointed to the two functions; one function with a parameter doesn't need a dispatch table).

1 commit. ~600 LOC removed, ~300 LOC added — net negative.

### 4.3 C — Structural / API surface

#### C1 — Split `models.py`

Current `app/models.py`: 229 LOC, 27 classes. Cleanly maps to domain per the table below.

| Domain | Classes |
|---|---|
| `leads` | `Contact`, `Lead`, `LeadCreateRequest`, `LeadUpdateRequest` |
| `market_scoring` | `LeadMarketScoresRequest`, `LeadMarketScoreRow`, `LeadMarketScoresResponse`, `LeadMarketScoreDescriptionsResponse`, `LeadMarketScoreStatusItem`, `LeadMarketScoringStatusResponse` |
| `profiles` | `SocialMedia`, `CompanyProfile`, `UserProfile`, `ScoutProfile`, `EditRequest`* |
| `customer_profile` | `CustomerProfileICP`, `CustomerProfileRequest`, `SuggestedICPToCustomerProfileRequest` |
| `pipeline` | `StageStats`, `TimeframeResponse`, `SalesPipelineResponse` |
| `signals` | `SignalActionRequest`, `SignalAskRequest` |
| `org_auth` | `RegistrationRequest`, `RegistrationResponse` |
| `graph_chat` | `ProspectData` |
| `market_research` | `MarketRequest` |
| `documents`, `icp` | (none today — handlers use ad-hoc dicts; C4 will add models here) |

*\* `EditRequest` is currently used by the `/edit` route under `profiles`. If A1's `profiles` extraction reveals cross-domain consumers (e.g., customer_profile edit flows), it moves to `app/models/_shared.py`. Verify during execution.*

`Contact` is referenced inside `Lead` — both go to `leads.py`. `SocialMedia` is referenced inside `CompanyProfile` — both go to `profiles.py`.

Layout after C1:

```
app/models/
├── __init__.py          # empty (no convenience re-exports — explicit imports preferred)
├── leads.py
├── market_scoring.py
├── profiles.py
├── customer_profile.py
├── pipeline.py
├── signals.py
├── org_auth.py
├── graph_chat.py
├── market_research.py
└── _shared.py           # if cross-domain models surface (likely just EditRequest, possibly empty)
```

Import updates across `app/routers/*`, `app/services/*`: `from app.models import X` → `from app.models.<domain> import X`. ~15-20 file diff.

1 commit. Tests need their import paths updated (mechanical sed across `tests/`).

#### C2 — Rename `database.py` → `clients.py`

The file holds `driver` (Neo4j), `client` (Mongo primary), `s3_client`, `pc` (Pinecone), `graph` (Neo4j LangChain wrapper) — plus after B1 it also holds `profiler_client`. None of those are "the database"; the file describes external service *clients*.

1 commit. Mechanical sed: `from app.core.database` → `from app.core.clients`. Touches every file that imports any client (routers, services, tests/conftest.py).

#### C3 — Router prefix/tags

Today every router:

```python
router = APIRouter()

@router.get("/leads")
def get_leads(...): ...
```

After C3:

```python
router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("")
def get_leads(...): ...
```

However, most routers don't have a clean URL prefix. Routes like `/voice_graph`, `/text_graph`, `/query`, `/ask`, `/chat`, `/create-company` all live in `graph_chat` with no common prefix. Same for `org_auth` (`/org`, `/connect_org`, `/registration`). Forcing a common prefix would change URLs.

**Resolution:** add `tags` to every router (cosmetic — improves Swagger grouping). Add `prefix` only where ALL routes in the router share a common prefix segment (`leads`, `market_research`, `customer_profile`, `market_scoring`, `documents`). Leave others with `prefix=""` and explicit per-route paths.

1 commit. Touches all 11 router files. Tests use URLs; no change.

#### C4 — Response models

For each of the 10 routers missing `response_model`, annotate every endpoint. Approach per endpoint:

1. **If a matching model exists** (post-C1) in `app/models/<domain>.py`: use it. Example: `GET /leads` → `response_model=List[Lead]`.
2. **If no model exists** but the handler returns a stable shape: define a minimal `BaseModel` in the domain's `app/models/<domain>.py` (e.g., `class DocumentStatusResponse(BaseModel)`). This is the time when `documents` and `icp` get their first models.
3. **If the handler returns a heterogeneous shape** that genuinely varies per branch: either define a `Union[A, B]` model, or skip annotation with a one-line comment explaining why. Don't shoehorn.

C4 is naturally bisectable by domain cluster:

- **C4.1 — Data domains:** `leads`, `documents`, `customer_profile`, `profiles`. ~12 endpoints.
- **C4.2 — Research/intelligence domains:** `market_research`, `icp`, `signals`. ~13 endpoints.
- **C4.3 — Meta domains:** `org_auth`, `graph_chat`, `pipeline`. ~10 endpoints (excluding `pipeline.test-llm` which stays a diagnostic).

3 commits.

**Bug-surfacing risk (and resolution):** when FastAPI sees `response_model=X`, it filters and validates. A handler that returns `{"foo": 1, "extra": "stuff"}` against a model `X(foo: int)` will quietly drop `extra`. A handler that returns `{}` against `X(foo: int)` (where `foo` is required) raises 500. The C4 commits should expect to surface 1-3 such bugs; each bug fix lands in the same commit that introduces the annotation, with a clear note in the commit message.

### 4.4 E — Code/language hygiene

Four small sweeps. Each is mechanical and independently safe.

- **E1 — Bare except.** Find sites: `grep -rn "^[[:space:]]*except:" app/`. Replace with `except Exception:`. 1 commit.
- **E2 — print → logger.** ~13 sites in `routers/icp.py`, ~6 in `routers/signals.py`. Most are diagnostic `print(f"...")` calls; convert to `logger.info(...)` or `logger.debug(...)` based on the content. 1 commit.
- **E3 — datetime.utcnow.** ~10+ sites. `datetime.utcnow()` → `datetime.now(timezone.utc)`. Add `from datetime import timezone` where needed. 1 commit.
- **E4 — extract_number return type. DEFERRED to Phase C.** `services/graph_chat.py:152-154` is annotated `-> str` but returns `None` in one branch. A2 doesn't touch `graph_chat`, so this one-line type fix is parked in the Phase C inventory rather than padding Phase B's commit count.

---

## 5. Target Architecture After Phase B

```
backend/
├── main.py                              # unchanged 4-line shim
├── render.yaml                          # unchanged (deploy fixes still batched for post-refactor-series)
├── requirements.txt                     # unchanged
├── requirements-test.txt                # unchanged
├── pytest.ini                           # unchanged
├── app/
│   ├── __init__.py
│   ├── main.py                          # logger declaration removed (moved to core/logging.py)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    # unchanged
│   │   ├── clients.py                   # RENAMED from database.py; now also holds profiler_client
│   │   ├── llm_config.py                # unchanged
│   │   ├── logging.py                   # NEW — logger lives here
│   │   └── exceptions.py                # NEW — BudgetExhaustedError, ICPIdRegistryError, …
│   ├── models/                          # NEW package (was models.py)
│   │   ├── __init__.py
│   │   ├── leads.py
│   │   ├── market_scoring.py
│   │   ├── profiles.py
│   │   ├── customer_profile.py
│   │   ├── pipeline.py
│   │   ├── signals.py
│   │   ├── org_auth.py
│   │   ├── graph_chat.py
│   │   ├── market_research.py
│   │   ├── documents.py                 # NEW — minimal models added by C4
│   │   ├── icp.py                       # NEW — minimal models added by C4
│   │   └── _shared.py                   # if EditRequest or other cross-domain models surface
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── *.py                         # all have prefix+tags; all have response_model on every endpoint;
│   │   │                                # heavy ones substantially smaller (logic moved to services)
│   │   └── …
│   └── services/
│       ├── __init__.py
│       ├── _retrieval.py                # unchanged
│       ├── _claude_budget.py            # HTTPException → BudgetExhaustedError
│       ├── _llm_helpers.py              # NEW — holds _tavily_context_and_urls, _claude_messages_text
│       ├── pipeline.py                  # real logic now (was 5 LOC stub)
│       ├── org_auth.py                  # real logic now (was 5 LOC stub)
│       ├── profiles.py                  # real logic now (was 5 LOC stub)
│       ├── customer_profile.py          # real logic now (was 1 LOC stub)
│       ├── documents.py                 # grown (logic from router)
│       ├── leads.py                     # grown (logic from router)
│       ├── icp.py                       # cleaned up; HTTPException replaced; helper imports updated
│       ├── signals.py                   # search_signals (was scout+profiler); grown from router extraction
│       ├── market_research.py           # _tavily_context_and_urls / _claude_messages_text moved out
│       ├── market_scoring.py            # _get_profiler_mongo_client removed (now in core/clients.py)
│       └── graph_chat.py                # grown if A2 touches it
└── tests/
    ├── conftest.py                      # patch targets updated:
    │                                    #   app.core.database.*    → app.core.clients.*
    │                                    #   app.main.logger        → app.core.logging.logger
    │                                    #   inline MongoClient mocks at routers/* (now via clients.client)
    ├── fixtures/                        # unchanged
    ├── __snapshots__/                   # unchanged (modulo C4-surfaced fixes)
    └── test_*.py                        # mechanical import-path updates only
```

**Files removed:**
- `app/models.py` (replaced by `app/models/` package)
- `app/core/database.py` (renamed to `app/core/clients.py`)

**Files added:**
- `app/core/logging.py`
- `app/core/exceptions.py`
- `app/services/_llm_helpers.py`
- `app/models/__init__.py` and `app/models/<domain>.py` (one per domain)

---

## 6. Test Impact & Mocking Strategy

Phase B keeps Phase A's source-patching convention (no DI yet). The conftest changes are mostly path updates, plus a small reduction as B1 removes the need to patch `MongoClient` at inline construction sites.

### 6.1 conftest.py patch table — before vs after

| Today | After Phase B |
|---|---|
| `mocker.patch("app.core.database.driver", …)` | `mocker.patch("app.core.clients.driver", …)` |
| `mocker.patch("app.core.database.client", …)` | `mocker.patch("app.core.clients.client", …)` |
| `mocker.patch("app.core.database.s3_client", …)` | `mocker.patch("app.core.clients.s3_client", …)` |
| `mocker.patch("app.core.database.pc", …)` | `mocker.patch("app.core.clients.pc", …)` |
| `mocker.patch("app.core.database.graph", …)` | `mocker.patch("app.core.clients.graph", …)` |
| `mocker.patch("app.routers.documents.MongoClient", …)` (× 6 router files) | (REMOVED — inline MongoClient constructions are gone; B1 makes these patches unnecessary) |
| `mocker.patch("app.routers.signals.MongoClient", …)` | (REMOVED) |
| `mocker.patch("app.routers.org_auth.MongoClient", …)` | (REMOVED) |
| `mocker.patch("app.routers.icp.MongoClient", …)` | (REMOVED) |
| `mocker.patch("app.routers.profiles.MongoClient", …)` | (REMOVED) |
| (new) | `mocker.patch("app.core.clients.profiler_client", …)` for tests that hit market_scoring's secondary cluster |

The composite `client` fixture (combining Neo4j + Mongo + S3 + Pinecone + LLM mocks) becomes shorter — the per-router `MongoClient` patches drop out.

*Patch target names above are indicative; verify the exact strings in the current `conftest.py` before B1 lands. The conftest file moved during Phase A; some entries may use slightly different module paths.*

### 6.2 Test changes by category

- **A1, A2 (extraction):** tests run against HTTP endpoints; route paths unchanged; tests should pass without body changes. The mocks for `database.driver` (Neo4j) and `clients.client` (Mongo) catch the operations regardless of which layer issues them.
- **A3 (logger):** any test that patches `app.main.logger` (if any) needs to switch to `app.core.logging.logger`. Verify with `grep`.
- **A4 (domain exceptions):** existing tests that expect HTTP 429 from `_claude_budget` still expect HTTP 429 — the router converts `BudgetExhaustedError` to `HTTPException(429)`. Tests pass.
- **A5 (LLM helpers):** import-path change in `services/icp.py` and `services/signals.py`. No test impact unless tests patch `app.services.market_research._tavily_context_and_urls` directly (unlikely; check during execution).
- **B1 (MongoClient):** conftest patches simplify (above). Tests that mock the per-router `MongoClient` attribute don't break — those mocks just become no-ops (no inline binding to mock). Verify each test still passes after the conftest reduction.
- **B2 (Groq/Claude collapse):** **opportunity for test coverage win.** Today only the Groq variants are tested; the Claude variants have zero coverage (per code review §6.2). After B2 collapses both endpoints to one private worker, a single test parameterized by `llm_backend` covers both. *In Phase B, we keep existing tests passing; we don't add new Claude tests. That's Phase C test-improvement work.*
- **B3 (Scout/Profiler):** routers now call `search_signals(persona=...)`. Tests that target the routes are unchanged; tests that patch `search_signals_scout` directly become tests that patch `search_signals`. Mechanical sed.
- **C1 (models split):** tests import models in a few places. `grep -rln "from app.models import" tests/` to find them; update paths.
- **C2 (rename):** conftest patch targets change (above). One mechanical sed.
- **C3 (prefix/tags):** tests use URLs. No impact.
- **C4 (response_model):** **this is the risky one.** A handler that today returns `{"foo": 1, "extra": "stuff"}` will, after annotation, return `{"foo": 1}` — the extra key is silently filtered by FastAPI. Snapshots may drift. Plan: if a snapshot drift is unambiguously the model filtering an extra key, `--snapshot-update` after manual confirmation. If a snapshot drift is a *missing* field, that's a real bug to fix in the same commit.
- **E1-E4:** tests should be unaffected; these are internal language updates.

### 6.3 New tests

None required for Phase B's correctness. The existing test suite is the contract. Phase B doesn't add features; it consolidates implementations. New test coverage (Claude variant tests, Cypher content verification, etc.) is Phase C work.

---

## 7. Migration Sequencing

Single feature branch off `master`: `refactor/backend-modularization-phase-b`. 25 commits, no squash, fully bisectable.

### Phase B-1 — Setup (4 commits)

1. **A3 — Move `logger` to `app/core/logging.py`.** Mechanical sed; smallest change to verify the bisectability discipline early.
2. **C2 — Rename `app/core/database.py` → `app/core/clients.py`.** Mechanical sed across all imports. Conftest patch paths updated in same commit.
3. **C1 — Split `app/models.py` into `app/models/<domain>.py`.** Mechanical move of 27 classes into 10 domain files (plus `_shared.py` if needed); update imports across `app/routers/`, `app/services/`, `tests/`. Largest setup commit but still pure mechanical refactor.
4. **C3 — Add `prefix` and `tags` to every `APIRouter()`.** Cosmetic; verify Swagger UI looks right at `/docs`.

### Phase B-2 — Mongo dedup (1 commit)

5. **B1 — Centralize MongoClient.** Replace 26 inline constructions with `app.core.clients.client` (primary) and `app.core.clients.profiler_client` (secondary). Conftest patches for per-router `MongoClient` removed. Verify mongo-touching tests still pass.

### Phase B-3 — Stub extractions (4 commits)

6. **A1.1 — Extract `pipeline` service.** Smallest stub; warmup.
7. **A1.2 — Extract `org_auth` service.**
8. **A1.3 — Extract `profiles` service.**
9. **A1.4 — Extract `customer_profile` service.**

### Phase B-4 — Heavy extractions (4 commits, smallest first)

10. **A2.1 — Extract `leads` router logic to service.**
11. **A2.2 — Extract `icp` router logic to service.**
12. **A2.3 — Extract `signals` router logic to service.**
13. **A2.4 — Extract `documents` router logic to service.**

### Phase B-5 — Layering polish (2 commits)

14. **A4 — Domain exceptions; HTTPException out of services.** Create `app/core/exceptions.py`; convert 2 service-layer sites; router-side catches added.
15. **A5 — Promote LLM helpers to `_llm_helpers.py`.** Move `_tavily_context_and_urls` and `_claude_messages_text`; update imports in `services/icp.py`, `services/signals.py`, `services/market_research.py`.

### Phase B-6 — Domain dedup (4 commits)

16. **B2.1 — Collapse `market_research` Groq/Claude pair.**
17. **B2.2 — Collapse `icp` Groq/Claude pair.**
18. **B2.3 — Collapse `signals` Groq/Claude pair.**
19. **B3 — Collapse `search_signals_scout` and `search_signals_profiler` into `search_signals(persona=...)`.**

### Phase B-7 — Response models (3 commits)

20. **C4.1 — Annotate data domains.** `leads`, `documents`, `customer_profile`, `profiles`. Create missing models for `documents`.
21. **C4.2 — Annotate research/intelligence domains.** `market_research`, `icp`, `signals`. Create missing models for `icp`.
22. **C4.3 — Annotate meta domains.** `org_auth`, `graph_chat`, `pipeline`.

### Phase B-8 — Hygiene sweep (3 commits)

23. **E1 — Bare except → `except Exception:`.**
24. **E2 — `print()` → `logger` in `routers/icp.py` and `routers/signals.py`.**
25. **E3 — `datetime.utcnow()` → `datetime.now(timezone.utc)`.**

### Per-commit validation routine

(Same as Phase A.)

1. Make the move.
2. `cd backend && pytest tests/ -x` — must be green.
3. `git diff --stat` — sanity-check diff size matches expectation.
4. Commit with message format: `refactor(be): <short description> [phase B, commit N/25]`.

### Rollback strategy

Every commit independently green and small. Rollback = `git revert <sha>`. No feature flags, no compat shims.

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| C4's `response_model` filters drop a field the FE actually consumes | Medium | When a C4 commit lands, manually hit the affected endpoints with `curl` and compare against the frontend's `apiFetch` shape expectations. The FE has no auto-generated types (per `CLAUDE.md`); responsibility for verification is manual. |
| A snapshot drift caused by C4 looks like a reordering artifact but is actually a real shape change | Low-Medium | `--snapshot-update` only after manual diff inspection. Same discipline as Phase A. |
| B1's MongoClient consolidation breaks a test that depends on a fresh `MongoClient` mock per call | Low | Conftest's `mock_mongo` already patches `app.core.database.client` (the singleton). Tests that mock per-router `MongoClient` are likely no-ops today — verify with `git grep "patch.*MongoClient"` before B1 lands. |
| A2 extractions create a tangle of helper functions that don't fit anywhere | Medium | Convention: leading underscore for service-internal helpers. If a helper is needed by 2+ services, promote to `_llm_helpers.py` or a domain-specific shared module — but defer that decision to the moment it's needed; don't pre-engineer. |
| B2's Groq/Claude collapse hides a subtle difference between the two implementations that wasn't ~95% identical after all | Medium | Diff the two handlers side-by-side before collapsing. Document any non-trivial divergence in the commit message. If the divergence is real, keep both implementations (drop B2 for that domain). |
| B3's Scout/Profiler collapse mis-parameterizes a persona-specific quirk | Medium | Same — diff scout vs profiler implementations before merging. Treat persona as an enum, not a free string. Add an assertion for `persona in {"scout", "profiler"}` at the function head. |
| C1's `EditRequest` turns out to be cross-domain in ways A1's `profiles` extraction reveals | Low | Build `_shared.py` placeholder during C1; only populate if execution shows it's needed. |
| Re-importing `logger` from `app.core.logging` in dozens of files surfaces a circular import we didn't anticipate | Low | `app.core.logging` has no other dependencies — it's `import logging; logger = logging.getLogger("brewra")`. No way for this to form a cycle. Verify at commit 1. |
| Tests that source-patched `app.routers.X.MongoClient` silently break (the patch was load-bearing for a test scenario we forgot about) | Low-Medium | Before B1, `git grep "MongoClient" tests/` to inventory all patches. After B1, run tests with `-v`; investigate any new no-op-patch warnings from `pytest-mock`. |
| Conftest reduction during B1 + C2 removes patches that another test silently depended on | Low | All conftest changes land in the same commit as the corresponding code change. If a test breaks at that commit, it's localized. |

---

## 9. Phase C+ Inventory (Deferred)

Captured here so nothing is lost; not in scope for Phase B.

### Phase C candidates

1. **Dependency injection.** Replace module-global clients (`clients.driver`, `clients.client`, `clients.profiler_client`, `clients.s3_client`, `clients.pc`, `clients.graph`) and `llm_config.*` globals with FastAPI `Depends` providers. Rework `conftest.py` from `mocker.patch(...)` to `app.dependency_overrides[...] = ...`. Touches every test file.
2. **Test improvement track.** Claude-variant test coverage (B2 made this trivial), Cypher query content verification, background-task tests, dead-import cleanup, dead-assertion fixes, overly-permissive assertion tightening, redundant-patch removal.
3. **E4 — `extract_number` return type.** One-line fix in `services/graph_chat.py:152-154`; deferred from Phase B for the reason given in §2.1.

### Phase D candidates (security & infrastructure)

3. **Security hardening pass.** Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py` if not addressed by A1), `/leads` `LIMIT` clause, CORS off `*`, raw Cypher endpoint guard / removal.
4. **Pagination convention.** `/leads` (post-LIMIT) and other list endpoints; coordinated with FE consumption.
5. **B4 — small-pattern dedup audit.** JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.

### Phase E+ candidates (deeper structural)

6. **Anthropic SDK migration.** Replace raw `requests.post` in `services/market_research.py` with official `anthropic` SDK.
7. **`tiktoken` for budget estimation.** Replace `_estimate_token_count` heuristic (`len(text)/4`).
8. **Shared `memory` audit.** `app/core/llm_config.py:26` — risk of cross-conversation bleed.
9. **Per-process Claude token budget → Redis.** Lost on restart today; needs persistence for a real fix.
10. **Inline prompts → `app/prompts/`.** ~800 LOC of prompt text across `market_research`, `icp`, `signals` services.

---

## 10. Filename Conventions

- **Spec (this document):** `/specs/2026-05-21-backend-modularization-phase-b-design.md`.
- **Plan (next, after spec approval):** `/plans/modularization-plan-2.md`.
- **Future phase C plan:** `/plans/modularization-plan-3.md`.
