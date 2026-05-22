# Backend Modularization — Phase C Design

**Date:** 2026-05-22
**Status:** Approved for plan-writing
**Branch:** `master` (per monorepo `CLAUDE.md` "master is the CTO's working branch"). Optional `refactor-backend-modularization-phase-c` branch if reviewer-isolation is wanted — matches Phase A/B precedent but isn't required.
**Plan file (next):** `/plans/modularization-plan-3.md`

---

## 1. Context

Phase A (`/specs/2026-05-12-backend-modularization-design.md`, `/plans/modularization-plan-1.md`) was a pure structural split. Phase B (`/specs/2026-05-21-backend-modularization-phase-b-design.md`, `/plans/modularization-plan-2.md`) consolidated MongoClients, extracted service-layer logic, collapsed Groq/Claude duplication, and added response_model annotations.

The post-Phase-B code review (`/docs/code-review-backend-modularization-phase-b.md`) catalogued ~20 follow-up items. Four were addressed immediately in a small cleanup commit series (singleton-close bug, duplicate handler name, print()→logger stragglers, Pydantic V1→V2 Config normalization).

This spec covers the remaining cleanup carry-forwards that Phase B explicitly deferred. Larger architectural items (dependency injection, broad test improvements, security hardening) are out of scope — each deserves its own dedicated phase.

## 2. Scope

### 2.1 In scope (5 items)

| # | Item | Source | Size |
|---|---|---|---|
| 1 | `extract_number` return-type fix | B spec §9.3 (E4) | Trivial |
| 2 | Delete `profiler_client` alias and `_get_profiler_mongo_client()` indirection | review M9 | Small |
| 3 | Consolidate `fetch_leads_for_org` and `get_all_leads` | carry-forward | Small |
| 4 | Delete `app/core/exceptions.py`; convert raises back to `HTTPException`; fix `BudgetExhaustedError` 429 body shape | review C1/H5 + carry-forward | Medium |
| 5 | Extract `market_scoring` router (216 LOC) into service; move `create_index` to startup | review C3/H2 | Medium |

**Goal:** close out everything Phase B explicitly deferred and the post-B-review cleanup carry-forwards, so the next phase can focus on a single architectural concern (DI, tests, or features) without trailing debt.

### 2.2 Out of scope (deferred)

**Phase D candidates (dedicated phases):**
- **Dependency injection** (B spec §9.1). Replace module-global clients (`clients.driver`, `clients.client`, `clients.s3_client`, `clients.pc`, `clients.graph`) and `llm_config.*` globals with FastAPI `Depends` providers. Rework `conftest.py` from `mocker.patch(...)` to `app.dependency_overrides[...]`. Touches every test file.
- **Test improvement track** (B spec §9.2 + `docs/TECH_DEBT.md` TD-001). Captured LLM fixtures, Claude-variant coverage, Cypher query content verification, background-task tests, dead-import cleanup, dead-assertion fixes.
- **Security hardening** (B spec §9 Phase D). Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87,94,104`), `/leads` `LIMIT` clause, CORS off `*`, raw Cypher endpoint guard.
- **Pagination convention** (B spec §9 Phase D).
- **B4 small-pattern dedup audit** (B spec §9 Phase D). JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.

**Phase E+ candidates:**
- Anthropic SDK migration, tiktoken for budget estimation, Redis-backed Claude budget, inline prompts → `app/prompts/`, shared `memory` audit.

### 2.3 Explicit non-goals

- No new features.
- No frontend changes (polyglot boundary holds).
- No new tests beyond what existing tests already cover for the affected endpoints. Test improvements are a separate phase.
- No security work. Brewra is MVP with 0 live users (per repo `CLAUDE.md` "Business State"); security hardening is gated to a security-focused phase before launch.

## 3. Per-item Design

### 3.1 Item 1 — `extract_number` return-type fix

**Where:** `app/services/graph_chat.py:152-154`.

**Current:** Annotated `-> str` but returns `None` when the regex doesn't match.

**Target:** Investigate callers first (`grep extract_number` in services and routers). Pick the option that preserves caller behavior:
- If callers tolerate `None`: change signature to `-> Optional[str]`.
- If callers do string operations on the result: return `""` and keep `-> str`.

**Commits:** 1.

**Tests:** Run full pytest suite to confirm no regression. No new tests required.

### 3.2 Item 2 — Delete `profiler_client` alias

**Where:**
- `app/core/clients.py:55`: `profiler_client = client` — delete.
- `app/core/clients.py:50-54`: surrounding comment about the alias — delete.
- `app/services/market_scoring.py:32-37`: `_get_profiler_mongo_client()` — delete.
- All callers of `_get_profiler_mongo_client()` (in `market_scoring.py`, `leads.py` × 3 imports, `customer_profile.py` × 4 imports) — change to import `client` from `app.core.clients` directly.

**Current:** Two names for the same `MongoClient` singleton plus a wrapper function that just returns it. Reviewer noted the "Profiler cluster" never existed as a separate cluster.

**Target:** One name (`client`). One import. The Phase B comment claiming a "separate Profiler cluster" is removed because it was always misleading.

**Commits:** 1-2. Either:
- (a) Single commit: update all callers and delete the alias/helper in one change.
- (b) Two commits: first update callers, then delete the dead names (safer for review/bisect).

Implementation picks (a) unless the diff is large enough to warrant splitting.

**Tests:** Existing tests cover all affected services. Run pytest to confirm.

### 3.3 Item 3 — Consolidate leads-read functions

**Where:** `app/services/leads.py:21-51` (`fetch_leads_for_org`) and `app/services/leads.py:81-99` (`get_all_leads`).

**Current divergence:**

| | `fetch_leads_for_org` | `get_all_leads` |
|---|---|---|
| Limit / order | `ORDER BY created_at DESC LIMIT $limit` (default 100) | none |
| JSON parsing | inlined (lines 38-46) | uses `_process_neo4j_lead_records` helper |
| Error handling | logs warning, returns `[]` | logs error, raises `HTTPException(500)` |
| Caller(s) | `market_scoring._run_market_scoring_for_org` (limit=5000) | `/leads` endpoint |

**Target:** Single function

```python
def get_leads_for_org(
    org_id: str,
    limit: Optional[int] = None,
    order_by_recent: bool = False,
    raise_on_error: bool = True,
) -> List[Dict[str, Any]]:
    ...
```

Uses `_process_neo4j_lead_records` for parsing. `limit=None` means no `LIMIT` clause; `order_by_recent=True` adds the `ORDER BY l.created_at DESC`. `raise_on_error=False` switches to the silent-fallback path used by the market-scoring background task.

Both call sites updated. The market_scoring caller passes `limit=5000, order_by_recent=True, raise_on_error=False`. The `/leads` endpoint caller passes the defaults.

**Commits:** 1.

**Tests:** `test_leads.py::test_get_all_leads_*` and `test_market_scoring.py::test_trigger_market_scoring_*` cover both call paths.

### 3.4 Item 4 — Delete domain exceptions; convert raises back; fix 429 body

**Where:**
- `app/core/exceptions.py` (3 classes: `BrewraError`, `BudgetExhaustedError`, `ICPIdRegistryError`) — delete entire file.
- `app/services/_claude_budget.py` — `raise BudgetExhaustedError(...)` → `raise HTTPException(status_code=429, detail={...})` with a proper dict body (FastAPI serializes dict→JSON correctly; the stringified-dict body was a latent bug).
- `app/services/icp.py:1137` (or wherever `ICPIdRegistryError` is raised — verify line during implementation) → `raise HTTPException(status_code=500, detail=...)`.
- Any router exception handlers for these classes — remove.

**Current state:** Three domain-exception classes used at 2 raise sites total. The reviewer's "two competing conventions" critique is correct: services still import and raise `HTTPException` directly in ~30 other sites, so the domain-exception layer adds confusion without delivering decoupling.

**Target:** Single convention — services raise `HTTPException` directly. No domain-exception layer. The 429 budget-exhausted response body becomes a proper JSON object with `status`, `message`, `details` fields (concrete shape determined when the conversion is implemented; preserve any fields the current stringified body already carries so the frontend isn't broken).

**Rationale for reversal:** Phase B Task 14 introduced the abstraction with a narrow scope (2 conversions) intending Phase C would complete the migration. The cost/benefit doesn't pencil out for a 0-user MVP: services are unit-tested with `TestClient` which already requires FastAPI as a test dep, so "services testable without FastAPI" isn't a real constraint. Closing the abstraction is simpler than completing it.

**Commits:** 1-2.
1. Convert `BudgetExhaustedError` and `ICPIdRegistryError` raises back to `HTTPException`; fix 429 body shape inline.
2. Delete `app/core/exceptions.py` and remove any remaining imports.

(May collapse to single commit if total diff is small.)

**Tests:** Existing tests in `test_signals.py` and `test_icp.py` cover the affected paths. Verify the 429 response shape change doesn't break any existing assertions; update characterization snapshots if a test asserts on the old stringified-dict body.

### 3.5 Item 5 — Extract `market_scoring` router

**Where:** `app/routers/market_scoring.py` (216 LOC, 3 endpoints).

**Current state:** Router contains stale-run detection, run-document construction, progress calculation, count queries, recent-items shaping, and direct calls to private helpers (`_get_market_score_collections`, `_is_stale_queued_run`, `_extract_description_preview`). The cleanup commit `b837d44` already removed the singleton-close bug, but the business logic remains in the router.

**Target:** Three new public service functions in `app/services/market_scoring.py`:

```python
def trigger_or_get_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
) -> LeadMarketScoresResponse: ...

def get_market_scores_status(
    user_id: str,
    org_id: str,
    run_id: Optional[str],
    recent_items_limit: int,
) -> LeadMarketScoringStatusResponse: ...

def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str,
    org_id: str,
) -> LeadMarketScoreDescriptionsResponse: ...
```

Router shrinks to ~30 LOC (HTTP wiring only) matching the pattern established for `leads`, `icp`, `signals`, `documents` in Phase B.

**`create_index` migration:** Today `_get_market_score_collections` calls `create_index` four times per request. Move these to a FastAPI startup event in `app/main.py`. One-time cost at boot. The function then returns only the collections (no index side-effects).

**Commits:** 3-5.
1. Add `trigger_or_get_market_scores` service function; router calls it.
2. Add `get_market_scores_status` service function; router calls it.
3. Add `get_lead_market_score_descriptions` service function; router calls it.
4. Move `create_index` calls to startup event in `app/main.py`.
5. Optional: simplify `_get_market_score_collections` (or inline if it's only one caller).

**Tests:** `test_market_scoring.py` has 4 tests covering the 3 endpoints. Pass-through verification only — no new tests required.

## 4. Branch & Commit Strategy

**Branch:** Defaults to `master` per monorepo `CLAUDE.md` policy. A dedicated `refactor-backend-modularization-phase-c` branch is optional and only worth it if a human reviewer wants to see the phase as one isolated unit (Phase A and B used branches for this). Phase B's branch has already been merged forward; phase C builds on top.

**Commit policy:** Follows monorepo `CLAUDE.md` "commit granularity: prefer small, frequent commits." Each plan task = 1 commit. Items 1-3 are 1 commit each (item 2 may be 2); items 4-5 are 1-5 commits each. Expected total: 7-12 commits.

**Message format:** `refactor(be):` for structural moves, `fix(be):` for bug fixes (like the 429 body shape), `chore(be):` for trivial hygiene. No `[phase C, commit N/M]` suffix — the denominator is too volatile and Phase B's numbering churn made the suffix unhelpful.

**No `Co-Authored-By: Claude` footer** (project convention).

## 5. Testing

**Existing test suite is the contract.** 93 tests passing after the post-B-review cleanup commits. The Phase C changes are refactors and a small bug fix — none change observable behavior beyond the 429 body shape (Item 4).

**Pre-flight check:** `pytest` at the start of each task. Must pass.

**Per-task check:** `pytest` after every commit. Must pass. If a snapshot test fails because the response shape genuinely changed (only expected for Item 4's 429 body), update the snapshot with `--snapshot-update` and verify the new shape is correct.

**No new tests in this phase.** Test improvement is a separate phase.

## 6. Acceptance Criteria

Phase C is complete when:

1. All 5 items shipped as listed in §3.
2. `pytest` reports 93 passing (or more, if Item 4's 429 fix triggers a test update — but only that test).
3. Branch metrics:
   - `app/routers/market_scoring.py` LOC drops from 216 to ~30.
   - `app/core/exceptions.py` removed.
   - `profiler_client` and `_get_profiler_mongo_client()` references both zero (`grep -rn 'profiler_client\|_get_profiler_mongo_client' app/` returns nothing).
   - `fetch_leads_for_org` removed; single `get_leads_for_org` callable by both sites.
4. No new items added to the Phase D inventory beyond what's already in §2.2 (i.e., the phase doesn't accidentally surface new debt).
5. `git log master..HEAD --oneline` shows a clean commit series matching the granularity policy in §4.

## 7. Filename Conventions

- **Spec (this document):** `/specs/2026-05-22-backend-modularization-phase-c-design.md`.
- **Plan (next, after spec approval):** `/plans/modularization-plan-3.md`.
- **Code review (after branch is shipped):** `/docs/code-review-backend-modularization-phase-c.md`.

## 8. Phase D+ Inventory (Carry-forward)

Documented here so it isn't lost. Not in scope for Phase C.

### Phase D candidates (dedicated phases each)

1. **Dependency injection.** See §2.2.
2. **Test improvements.** See §2.2 and `docs/TECH_DEBT.md` TD-001.
3. **Security hardening.** See §2.2.
4. **Pagination convention.** See §2.2.
5. **B4 small-pattern dedup audit.** See §2.2.

### Phase E+ candidates

6. Anthropic SDK migration.
7. `tiktoken` for budget estimation.
8. Redis-backed Claude budget.
9. Inline prompts → `app/prompts/`.
10. Shared `memory` audit.
