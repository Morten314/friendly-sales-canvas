# Backend Modularization — Phase C Design

**Date:** 2026-05-22
**Status:** Approved for plan-writing
**Branch:** `refactor-backend-modularization-phase-c`, branched from `master`. Matches Phase A/B precedent (reviewer-isolation), merges back to master when complete.
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
| 4 | Delete unused `BrewraError` base class; fix `BudgetExhaustedError` 429 body shape (Python-repr string → JSON object). Keep both working exception classes. | review C1/H5 + carry-forward | Small |
| 5 | Extract `market_scoring` router (201 LOC) into service; move `create_index` to startup | review C3/H2 | Medium |

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

**Where (production code):**
- `app/core/clients.py:60`: `profiler_client = client` — delete.
- `app/core/clients.py:55-59`: surrounding comment about the alias — delete.
- `app/services/market_scoring.py:32-37`: `_get_profiler_mongo_client()` — delete.
- All callers of `_get_profiler_mongo_client()` (in `market_scoring.py`, `leads.py` × 3 imports, `customer_profile.py` × 4 imports) — change to import `client` from `app.core.clients` directly.

**Where (tests):**
- `tests/conftest.py:100`: remove the `mocker.patch("app.core.clients.profiler_client", mongo)` call. The patch on `client` (same fixture) remains.
- `tests/test_icp.py:148, 167, 194, 333` — 4 sites patching `app.core.clients.profiler_client` directly. Change to patch `app.core.clients.client`.
- `tests/test_market_scoring.py:110, 141, 164` — 3 sites patching the same. Same change.
- File-header docstrings in `conftest.py:6-7,94,99` and `test_market_scoring.py:9` reference `profiler_client` — update or delete to match new state.

**Current:** Two names for the same `MongoClient` singleton plus a wrapper function that just returns it. Reviewer noted the "Profiler cluster" never existed as a separate cluster.

**Target:** One name (`client`). One import. The Phase B comment claiming a "separate Profiler cluster" is removed because it was always misleading.

**Architectural benefit (noted, not the primary motivation):** Removing `_get_profiler_mongo_client()` also breaks a real cross-service import cycle. Today `leads.py` and `customer_profile.py` import the helper from `market_scoring.py`, while `market_scoring.py` imports `fetch_leads_for_org` from `leads.py`. Python resolves this via deferred function-body imports, but the cycle is fragile. After Item 2, all those imports point to `app.core.clients` instead, breaking the cycle cleanly.

**Commits:** 1-2. Either:
- (a) Single commit: update all callers (production + tests) and delete the alias/helper in one change.
- (b) Two commits: first update callers, then delete the dead names (safer for review/bisect).

Implementation picks (a) unless the diff is large enough to warrant splitting.

**Tests:** Existing test suite covers all affected services. After patching changes, run pytest to confirm.

### 3.3 Item 3 — Consolidate leads-read functions

**Where:** `app/services/leads.py:21-51` (`fetch_leads_for_org`) and `app/services/leads.py:81-99` (`get_all_leads`).

**Current divergence:**

| | `fetch_leads_for_org` | `get_all_leads` |
|---|---|---|
| Limit / order | `ORDER BY created_at DESC LIMIT $limit` (default 100) | none |
| JSON parsing | inlined (lines 38-46) | uses `_process_neo4j_lead_records` helper |
| Error handling | logs warning, returns `[]` | logs error, raises `HTTPException(500)` |
| Caller(s) | `market_scoring._run_market_scoring_for_org` (limit=5000), `routers/market_scoring.py` (fallback when `total_leads` is 0) | `routers/leads.py:21` (`GET /leads` endpoint) |

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

### 3.4 Item 4 — Delete unused `BrewraError` base; fix 429 body shape

**Where:**
- `app/core/exceptions.py`: delete the `BrewraError` base class. Change `BudgetExhaustedError` and `ICPIdRegistryError` to inherit directly from `Exception`.
- `app/routers/signals.py:40,71`: change `raise HTTPException(status_code=429, detail=str(e))` → `raise HTTPException(status_code=429, detail=e.args[0])`. (`e.args[0]` is the dict that `_claude_budget.py:54-61` passes to the exception constructor.)
- `app/routers/market_research.py:24`: same change.

**Where (not changing):**
- `app/services/_claude_budget.py:54-61`: continues to raise `BudgetExhaustedError(<dict>)`. The pattern is correct.
- `app/services/icp.py:1137`: continues to raise `ICPIdRegistryError(...)`. The pattern is correct.
- `app/routers/icp.py:16,24,36`: 3 catch sites for `ICPIdRegistryError`. The current behavior (`raise HTTPException(status_code=500, detail=str(e))`) is already correct — `ICPIdRegistryError` carries a single string message, not a dict, so stringification is appropriate. No change needed unless implementation finds otherwise.
- `app/services/market_research.py:997`: internal `except BudgetExhaustedError: ...` used for flow control inside the Claude variant. Not a router catch; remains as-is.

**Current state:**
- `BrewraError` is an unused base class with zero references outside the file that defines it.
- The domain-exception pattern at the 5 service raise sites + 6 router catch sites is **working correctly as designed** — service raises domain exception, router maps to HTTP. These are the *only* sites in the codebase doing the pattern right.
- The 429 response body is a Python-repr string (`detail=str(e)` produces `"{'error': '...', 'token_limit_5m': ...}"`) — unparseable on the frontend without regex hacks. This is a latent bug.

**Target:**
- One less class. The `BrewraError` base existed to declare a common parent but no code catches `BrewraError` directly, so it adds no value.
- 429 response body becomes a proper JSON object: `{"detail": {"error": "Token budget exceeded...", "token_limit_5m": ..., "current_tokens_5m": ..., "requested_tokens": ...}}`. This is FastAPI's canonical shape (`detail` can be any JSON-serializable value, not just strings).

**Rationale (revised from earlier draft):**
The earlier draft proposed deleting all three exception classes and converting raises back to `HTTPException`. The critique pointed out that this would remove the 2 sites that implement the service/router exception boundary correctly. Reversing those would codify the broken HTTPException-everywhere convention as the project standard.

Instead, this item now does the minimum to close the genuine bug (429 body shape) and the genuine dead code (`BrewraError`). The broader question of whether to migrate the other ~30 service `HTTPException` raises to domain exceptions is deferred to a later phase. **No architectural decision is being made here** — only a bug fix and a dead-code deletion.

**Frontend impact (MC-4 / explicit):**
The 429 response body's `detail` field changes type from `string` (Python repr) to `object` (JSON dict). If the frontend currently parses `detail` as a string (e.g., displays it as toast text), it will see `[object Object]` instead. If the frontend doesn't parse `detail` at all (only checks status 429), there's no impact.

Implementation must verify the frontend's current handling. If it parses `detail` as a string, ship the FE update in the same commit (the monorepo enables atomic cross-stack commits). If unsure, default to the dict body — the current Python-repr string is functionally broken anyway, so making it cleanly broken (`[object Object]`) is no worse than leaving it ugly.

**Commits:** 1 (small scope: 1 file deletion-of-line, 1 file class-change, 3 router catch updates, optional FE update).

**Tests:** Existing tests in `test_signals.py` may assert on the 429 response shape. Run pytest after the change; if a snapshot test catches the body-shape change, that's expected — update the snapshot to reflect the new (correct) JSON shape.

### 3.5 Item 5 — Extract `market_scoring` router

**Where:** `app/routers/market_scoring.py` (201 LOC, 3 endpoints).

**Current state:** Router contains stale-run detection, run-document construction, progress calculation, count queries, recent-items shaping, and direct calls to private helpers (`_get_market_score_collections`, `_is_stale_queued_run`, `_extract_description_preview`). The cleanup commit `b837d44` already removed the singleton-close bug, but the business logic remains in the router.

**Target:** Three new public service functions in `app/services/market_scoring.py`. Return plain dicts matching Phase B's established service convention (see `leads.py`, `icp.py`, `signals.py`, `documents.py`):

```python
def trigger_or_get_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]: ...

def get_market_scores_status(
    user_id: str,
    org_id: str,
    run_id: Optional[str],
    recent_items_limit: int,
) -> Dict[str, Any]: ...

def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str,
    org_id: str,
) -> Dict[str, Any]: ...
```

**Router shape after extraction:**
```python
@router.post("/leads/market-scores", response_model=LeadMarketScoresResponse)
async def get_or_refresh_lead_market_scores(request, background_tasks):
    return market_scoring_service.trigger_or_get_market_scores(request, background_tasks)
```

The router returns the service's dict; FastAPI validates against `response_model` and serializes. This matches the convention in `routers/leads.py`, `routers/icp.py`, etc.

**Why services don't return Pydantic response models:** Phase B's pattern decouples service-layer logic from HTTP response schema. A future non-HTTP caller (CLI command, background task, different endpoint) can call the same service function and shape the result differently. The earlier draft of this spec proposed returning Pydantic models from services — that was inconsistent with the established convention.

Router shrinks to ~30 LOC (HTTP wiring only).

**`create_index` migration:** Today `_get_market_score_collections` calls `create_index` four times per request. Move these to a FastAPI startup event in `app/main.py`. One-time cost at boot. The function then returns only the collections (no index side-effects).

**Startup-event test guard (MC-3):** The startup event must be guarded by `os.getenv("BREWRA_SKIP_DB_INIT")` (or equivalently `clients.client is None`), matching the existing pattern at `app/main.py:81-82` for `clients.graph.refresh_schema()`. Without this guard, pytest sessions in sandboxes with restricted outbound would fail at startup trying to reach the real Mongo cluster.

**Internal-helper note (FE-4):** After extraction, `_get_market_score_collections` is called only from within `app/services/market_scoring.py` (no more router calls). It can either remain as a private helper or be inlined into each service function — implementation chooses based on whether the helper still earns its keep.

**Commits:** 3-5.
1. Add `trigger_or_get_market_scores` service function (returns Dict); router calls it.
2. Add `get_market_scores_status` service function; router calls it.
3. Add `get_lead_market_score_descriptions` service function; router calls it.
4. Move `create_index` calls to a guarded startup event in `app/main.py`; remove from `_get_market_score_collections`.
5. Optional: simplify or inline `_get_market_score_collections` if its remaining callers don't justify it.

**Tests:** `test_market_scoring.py` has 4 tests covering the 3 endpoints. Pass-through verification only — no new tests required.

## 4. Branch & Commit Strategy

**Branch:** `refactor-backend-modularization-phase-c`, branched from `master`. Phase B was merged into master before this phase began; the stale `refactor-backend-modularization-phase-b` branch was deleted. Phase C merges back to master when complete, following the Phase A/B pattern.

**Commit policy:** Follows monorepo `CLAUDE.md` "commit granularity: prefer small, frequent commits." Each plan task = 1 commit. Items 1, 3, 4 are 1 commit each; item 2 may be 1 or 2; item 5 is 3-5 commits. Expected total: 7-10 commits.

**Message format:** `refactor(be):` for structural moves, `fix(be):` for bug fixes (like the 429 body shape), `chore(be):` for trivial hygiene. No `[phase C, commit N/M]` suffix — the denominator is too volatile and Phase B's numbering churn made the suffix unhelpful.

**No `Co-Authored-By: Claude` footer** (project convention).

## 5. Testing

**Existing test suite is the contract.** 93 tests passing after the post-B-review cleanup commits (re-verify at plan-writing time; count may have drifted). The Phase C changes are refactors and a small bug fix — none change observable behavior beyond the 429 body shape (Item 4).

**Pre-flight check:** `pytest` at the start of each task. Must pass.

**Per-task check:** `pytest` after every commit. Must pass. If a snapshot test fails because the response shape genuinely changed (only expected for Item 4's 429 body), update the snapshot with `--snapshot-update` and verify the new shape is correct.

**No new tests in this phase.** Test improvement is a separate phase.

## 6. Acceptance Criteria

Phase C is complete when:

1. All 5 items shipped as listed in §3.
2. `pytest` reports 93 passing (or more, if Item 4's 429 fix triggers a snapshot update — but only that test).
3. Branch metrics:
   - `app/routers/market_scoring.py` LOC drops from 201 to ~30.
   - `app/core/exceptions.py` retained but `BrewraError` removed; `BudgetExhaustedError` and `ICPIdRegistryError` inherit directly from `Exception`.
   - `profiler_client` and `_get_profiler_mongo_client()` references zero across both `app/` AND `tests/` (`grep -rn 'profiler_client\|_get_profiler_mongo_client' app/ tests/` returns nothing).
   - `fetch_leads_for_org` removed; single `get_leads_for_org` callable by both sites.
   - 429 budget-exhausted response body is a JSON object, not a Python-repr string. Verify with `curl` or test assertion.
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
6. **HTTPException → domain-exception migration (broader question).** Phase C's Item 4 deliberately scopes down to a bug fix + dead-code deletion. The broader question — should the ~30 service `HTTPException` raises be converted to domain exceptions caught at the router boundary? — is left open. Two coherent positions exist: (a) complete the migration so services are FastAPI-agnostic, or (b) reverse the 2 working domain-exception sites to make HTTPException-everywhere the formal convention. Pick a side in a dedicated phase. Related: the `except HTTPException: raise` re-raise pattern (Phase B review H5) appears 20 times in services and would either be cleaned up or codified by whichever direction is chosen.

### Phase E+ candidates

6. Anthropic SDK migration.
7. `tiktoken` for budget estimation.
8. Redis-backed Claude budget.
9. Inline prompts → `app/prompts/`.
10. Shared `memory` audit.
