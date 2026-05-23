---
artifact: specs/2026-05-22-backend-modularization-phase-f-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-22
round: 3
---

## Context

Round 3 review after synthesis 2 incorporated all round 2 findings (backward-compat fallback pattern §3.7, `query(driver, …)` signature change, `_ensure_market_scoring_indexes` relocation, `vision` field dropped, import-location clarification, variable naming fix). This round audits the updated spec against the live codebase with a focus on accuracy of the new material, completeness of the cross-commit call-chain table, and any remaining gaps.

Verification method: grep/read of `backend/app/` source files, cross-referencing every factual claim in the spec against the actual code.

## Findings

### [High] `trigger_or_get_market_scores` and `get_market_scores_status` are not background tasks but access clients via `_get_market_score_collections` — spec omits them from the conversion narrative

**Location:** §4.2 commit 15 row, §3.6 worked example, §3.7 fallback table

The spec's §3.6 background-task pattern shows the router acquiring `driver`, `mongo`, `llm2` via `Depends()` and passing them to `_run_market_scoring_for_org`. That's correct for the background task. But the same router (`app/routers/market_scoring.py`) also calls three non-background service functions that each access `clients.*` via `_get_market_score_collections()`:

1. **`trigger_or_get_market_scores(request, background_tasks)`** — called directly from the router at line 25 (not a background task itself). Internally calls `_get_market_score_collections()` at line 273. This is a synchronous call on the request path.

2. **`get_market_scores_status(user_id, org_id, run_id, recent_items_limit)`** — called from the router at line 37. Calls `_get_market_score_collections()` at line 358 AND `get_leads_for_org()` at line 377 (inside a try/except fallback).

3. **`get_lead_market_score_descriptions(lead_id, user_id, org_id)`** — called from the router at line 46. Calls `_get_market_score_collections()` at line 443.

These three functions also transitively call functions that access `clients.*`:
- `_get_latest_market_score_rows()` (line 198) → `_get_market_score_collections()` → `_get_lead_identity_from_neo4j()` → `clients.driver` (line 155)
- `_get_latest_scoring_run()` (line 224) → `_get_market_score_collections()`

The router currently passes zero client args — it just calls the service functions directly. After Phase F, the router must inject `driver` and `mongo` via `Depends()` and pass them through. The spec's commit 15 row says "7 + internal helpers" but doesn't mention these three synchronous router-callable functions, their `_get_market_score_collections()` calls, or the transitive `_get_lead_identity_from_neo4j()` → `clients.driver` dependency.

The §3.6 worked example only shows `_run_market_scoring_for_org` and `_get_market_score_collections`. The other 5 functions that access clients in market_scoring.py are not mentioned:
- `_get_lead_identity_from_neo4j` (line 155: `clients.driver`)
- `get_company_profile_for_org` (line 467: `clients.driver`)
- `get_market_reports_for_org` (line 486: `clients.client`)
- `score_single_lead_against_market` (line 555: `llm_config.llm2`)
- `_persist_market_score_for_lead` (line 638: `clients.driver`)

**Recommendation:** Expand the commit 15 description to enumerate all client-accessing functions (not just `_run_market_scoring_for_org` and `_get_market_score_collections`). Add a brief note that `trigger_or_get_market_scores`, `get_market_scores_status`, and `get_lead_market_score_descriptions` are synchronous router-callable functions (not background tasks) that also need the `mongo`/`driver` parameters threaded through. The §3.6 worked example should either cover these cases or explicitly state it covers only the background-task case and the synchronous functions follow the §3.4 simple form.

### [High] `_get_market_score_collections` has 7 callers, not ~5 — spec undercounts

**Location:** §3.6 — "Every caller of `_get_market_score_collections` inside `market_scoring.py` (~5 sites)"

Actual call sites in `market_scoring.py`:
1. Line 198: `_get_latest_market_score_rows()` — `score_coll, _ = _get_market_score_collections()`
2. Line 224: `_get_latest_scoring_run()` — `_, run_coll = _get_market_score_collections()`
3. Line 273: `trigger_or_get_market_scores()` — `_, run_coll = _get_market_score_collections()`
4. Line 358: `get_market_scores_status()` — `score_coll, run_coll = _get_market_score_collections()`
5. Line 443: `get_lead_market_score_descriptions()` — `score_coll, _ = _get_market_score_collections()`
6. Line 605: `_persist_market_score_for_lead()` — `local_score_coll, _ = _get_market_score_collections()` (inside the `if local_score_coll is None` fallback)
7. Line 651: `_run_market_scoring_for_org()` — `score_coll, run_coll = _get_market_score_collections()`

Plus 1 external caller: `app/main.py:163` in `_ensure_market_scoring_indexes()`.

That's 7 internal + 1 external = 8 total. The spec says "~5 sites" which is significantly undercounting the blast radius. When `_get_market_score_collections(mongo)` gains a `mongo` parameter, all 7 internal callers and the external lifespan caller must be updated.

### [High] `trigger_or_get_market_scores` passes `background_tasks` to `_run_market_scoring_for_org` indirectly — spec §3.6 router pattern doesn't account for the current indirection

**Location:** §3.6 background-task pattern, §4.2 commit 15 row

The spec's §3.6 "After" code shows the router directly calling `bg.add_task(services.market_scoring._run_market_scoring_for_org, driver, mongo, llm2, org_id)`. But the current code doesn't call `_run_market_scoring_for_org` from the router — the router calls `trigger_or_get_market_scores(request, background_tasks)` (a synchronous service function), which then does `background_tasks.add_task(_run_market_scoring_for_org, request.user_id, request.org_id, run_id)` at line 318 of `market_scoring.py`.

So the pattern is:
```
Router → trigger_or_get_market_scores(request, bg) → bg.add_task(_run_market_scoring_for_org, user_id, org_id, run_id)
```

After Phase F, `trigger_or_get_market_scores` must receive `mongo` (for its `_get_market_score_collections` call) AND `driver` (for its `_get_latest_market_score_rows` → `_get_lead_identity_from_neo4j` transitive call) AND `llm2` (to pass through to the background task). The router pattern becomes:

```python
@router.post("/leads/market-scores")
async def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    llm2=Depends(get_llm2),
):
    return market_scoring_service.trigger_or_get_market_scores(
        request, background_tasks, driver, mongo, llm2,
    )
```

And `trigger_or_get_market_scores` must thread `driver`/`mongo`/`llm2` to the `background_tasks.add_task(...)` call. This is more complex than the spec's simplified "router calls bg.add_task directly" pattern suggests.

**Recommendation:** Update §3.6 to show the two-layer pattern (router → service function → background task) rather than the simplified router → background task form. The worked example should show `trigger_or_get_market_scores` receiving `mongo` and `driver` for its synchronous work and passing `driver`, `mongo`, `llm2` through to the background task.

### [Medium] `_persist_market_score_for_lead` already has an optional `score_coll=None` parameter — conflicting with the §3.7 fallback pattern

**Location:** §3.7 fallback pattern, commit 15 conversion

`_persist_market_score_for_lead` at line 585 already has `score_coll=None` as an optional parameter with a fallback to `_get_market_score_collections()` at line 605:

```python
def _persist_market_score_for_lead(
    ..., scoring_status="completed", score_coll=None,
) -> None:
    local_score_coll = score_coll
    if local_score_coll is None:
        local_score_coll, _ = _get_market_score_collections()
```

The §3.7 fallback pattern uses `=None` defaults with `if X is None: from app.core import clients` fallbacks. But `_persist_market_score_for_lead`'s existing `score_coll=None` is not a coexistence fallback — it's an optimization to avoid re-fetching the collection when the caller already has it (`_run_market_scoring_for_org` passes `score_coll` explicitly at lines 735, 754).

After Phase F, this function needs: `driver` (line 638), `mongo` (via `_get_market_score_collections` fallback at line 605), plus the existing `score_coll` parameter. The conversion is: `_persist_market_score_for_lead(driver, mongo, user_id, org_id, lead, scoring_payload, run_id, scoring_status="completed", score_coll=None)` — where `score_coll` remains an optimization parameter but the `if score_coll is None` fallback now calls `_get_market_score_collections(mongo)` instead of the global-reading version.

The spec doesn't mention this pre-existing optional parameter and its interaction with the §3.7 fallback pattern. This could cause confusion during implementation: should `driver` and `mongo` also be optional with fallbacks (per §3.7), or is `_persist_market_score_for_lead` a leaf function (called only from `_run_market_scoring_for_org`, which is in the same commit 15)?

**Recommendation:** Since `_persist_market_score_for_lead` is only called from within `market_scoring.py` (and commit 15 converts the entire file), no §3.7 fallback is needed for this function — it uses the simple §3.4 form. Add a brief note to commit 15 clarifying that internal-only functions (like `_persist_market_score_for_lead`, `_get_lead_identity_from_neo4j`, `get_company_profile_for_org`) use the simple form, while `trigger_or_get_market_scores`, `get_market_scores_status`, and `get_lead_market_score_descriptions` need the §3.7 fallback because they're called from the router which is wired in commit 15 but the fallback protects against any future cross-module callers.

### [Medium] §3.7 fallback table claims "7 sites" for customer_profile → icp helpers, but actual count is 14+ call sites

**Location:** §3.7 cross-commit call paths table

The table says:
> `icp._reserve_unique_icp_id`, `_ensure_icp_id_registry_indexes`, `_release_icp_id` → `services/customer_profile.py` (7 sites at lines 21, 25, 77, 86, 104, 143, 147, 183, 193, 224, 229, 292, 365, 368, 392)

The parenthetical lists **15 line numbers**, not 7. Counting the actual call sites in `customer_profile.py`:
- `_ensure_icp_id_registry_indexes`: lines 25, 147, 229, 368 = **4 call sites**
- `_reserve_unique_icp_id`: lines 77, 86, 104, 183, 193, 292 = **6 call sites**
- `_release_icp_id`: line 392 = **1 call site**
- **Import lines** (not call sites): 21, 143, 224, 365 = **4 import lines**

Total call sites: **11** (not 7). The "7" in the table header is wrong; the parenthetical line numbers list 15 entries (mixing imports and calls). This should be corrected to avoid confusion during implementation.

### [Medium] `get_market_scores_status` calls `get_leads_for_org` — another cross-commit caller not in the §3.7 table

**Location:** §3.7 cross-commit call paths table

`market_scoring.py:377` calls `get_leads_for_org(org_id, limit=5000, order_by_recent=True)` inside `get_market_scores_status()`. This is a cross-module call from `market_scoring` (commit 15) to `leads` (commit 10). The §3.7 table lists `get_leads_for_org` callers as `services/signals.py (2 sites), services/market_scoring.py (1 site)`. But market_scoring.py actually has **2** call sites for `get_leads_for_org`:
1. Line 377: inside `get_market_scores_status` — `total_leads = len(get_leads_for_org(org_id, limit=5000, order_by_recent=True))`
2. Line 658: inside `_run_market_scoring_for_org` — `leads = get_leads_for_org(org_id, limit=5000, order_by_recent=True)`

The table says "(1 site)" for market_scoring.py — it should be "(2 sites)".

### [Medium] `_get_lead_identity_from_neo4j` and `_get_latest_market_score_rows` have transitive `clients.driver` dependency — not mentioned anywhere in spec

**Location:** §3.6 worked example, §4.2 commit 15

`_get_lead_identity_from_neo4j(org_id, lead_id)` at line 149 accesses `clients.driver.session()` at line 155. This function is called by `_get_latest_market_score_rows()` at line 206, which is called by `trigger_or_get_market_scores()` at line 330 and `_run_market_scoring_for_org()` (implicitly via `_get_latest_market_score_rows`).

The chain is:
```
trigger_or_get_market_scores() → _get_latest_market_score_rows() → _get_market_score_collections() [clients.client]
                                                            └→ _get_lead_identity_from_neo4j() [clients.driver]
```

So `trigger_or_get_market_scores` needs both `mongo` (for `_get_market_score_collections`) and `driver` (for `_get_lead_identity_from_neo4j`) — even though it doesn't directly access `clients.driver`. The spec's §3.6 worked example doesn't show this transitive dependency.

### [Medium] §3.6 worked example parameter list for `_run_market_scoring_for_org` is incomplete

**Location:** §3.6 worked example code block

The worked example shows:
```python
def _run_market_scoring_for_org(driver, mongo, llm2, user_id: str, org_id: str, run_id: str) -> None:
```

But `_run_market_scoring_for_org` also calls:
- `get_company_profile_for_org(org_id)` at line 673 — this function uses `clients.driver` at line 467
- `get_market_reports_for_org(user_id, org_id)` at line 687 — this function uses `clients.client` at line 486

Both are internal functions in the same file. After Phase F, they need their clients passed through. But `_run_market_scoring_for_org` doesn't need `driver` twice — it needs to pass `driver` to `get_company_profile_for_org` and `mongo` to `get_market_reports_for_org`. The worked example is correct in listing `driver` and `mongo` in the signature, but it should note that these are threaded through to the internal helpers, not just used directly.

### [Low] Commit table row for `market_scoring` says "7 usages" but actual count differs depending on counting method

**Location:** §4.2 commit table — commit 15 row

The commit table says "7 + internal helpers". The `grep -c` of `clients.*|llm_config.*` in `market_scoring.py` returns **7**. That's the count of dotted-access sites. But the conversion also needs to handle:
- 8 `_get_market_score_collections()` call sites (7 internal + 1 in `main.py`)
- 2 `get_leads_for_org()` call sites
- 6 `upsert_node` usage (1 import + 1 execute_write call at line 640)

The total function-signature changes in market_scoring.py are far larger than "7" suggests. The "internal helpers" caveat partially covers this, but the real scope of commit 15 is: 7 dotted-access sites + 8 `_get_market_score_collections` call sites + 2 `get_leads_for_org` call sites + 1 `upsert_node` usage site + 3 router-callable synchronous functions that need `mongo`/`driver` parameters + the `_ensure_market_scoring_indexes` relocation.

### [Low] §3.7 fallback pattern code example uses `from app.core import clients` inside function body — circular import risk

**Location:** §3.7 fallback code blocks

The fallback pattern shows:
```python
if pc is None:
    from app.core import clients
    pc = clients.pc
```

This is a deferred import inside a function body, which Python handles fine. But during commits 4–15, the service file also has `from app.core import clients` at module top level (the old import isn't removed until commit 16). The deferred import is redundant — the module-level import is still alive. This isn't a bug, but it's unnecessary: the fallback can just read `clients.pc` from the module-level import that's already there. The `from app.core import clients` inside the function body only matters if the module-level import was already removed — which it isn't during the coexistence period.

**Recommendation:** Simplify the fallback to:
```python
if pc is None:
    pc = clients.pc
```
since `clients` is already imported at module top. The deferred import is defensive (handles a case that can't happen during commits 4–15) but adds noise to every function.

### [Nit] §3.1 `build_clients` docstring says "S3 + Pinecone constructed UNCONDITIONALLY and NOT wrapped in try/except" but uses `Optional[Any]` type hints for both

**Location:** §3.1 `ClientBundle` dataclass and `build_clients` docstring

The `ClientBundle` dataclass declares `s3_client: Optional[Any]` and `pc: Optional[Pinecone]`. Since they're constructed unconditionally and never `None`, these should be non-optional: `s3_client: Any` and `pc: Pinecone`. Making them `Optional` implies they can be `None`, which contradicts the docstring's "UNCONDITIONALLY" assertion.

### [Nit] §3.3 dependencies module uses one-liner formatting for LLM providers but multi-line for client providers

**Location:** §3.3 `dependencies.py` code block

Client providers use multi-line formatting with docstring-like spacing:
```python
def get_neo4j_driver(request: Request):
    return request.app.state.clients.driver
```

LLM providers use single-line:
```python
def get_llm(request: Request):                  return request.app.state.llm.llm
```

This is cosmetic but the spec is supposed to show the committed code. The implementation should pick one style.

## Verified Claims (no issues found)

- **§2.1 item 1: 12 providers (5 client + 7 LLM).** Verified: 5 client (`driver`, `graph`, `client`, `s3_client`, `pc`) + 7 LLM (`llm`, `llm2`, `llm_transformer`, `memory`, `agent_chain`, `chain`, `chain2`). `vision` has zero consumers — correctly excluded.
- **§2.1 item 4: ~94 usage sites.** Verified: 75 `clients.*` + 11 `llm_config.*` = 86 dotted accesses. Direct-import sites: `upsert_node` (3 imports in services), `query` (2 imports in services + 3 in router) = 8. Total distinct access points: 86 + 8 = 94. Accurate.
- **§2.1 item 5: graph_chat router has 5 sites.** Verified: 2 `llm_config.chain*.run()` (lines 34, 39) + 3 `from app.core.clients import query` (lines 45, 71, 103) = 5. Accurate.
- **§2.1 item 9: `query()` closure over `driver`.** Verified at `clients.py:56-59`. The function reads `driver` from module scope. Move requires `driver` parameter.
- **§2.1 item 10: `_ensure_market_scoring_indexes` at `main.py:158`.** Verified. It imports `_get_market_score_collections` from market_scoring.py at line 161 and calls it at line 163.
- **§3.1: S3/Pinecone unconditional construction at `clients.py:148-155`.** Verified: `boto3.client(...)` at line 148, `Pinecone(...)` at line 155. No try/except, not gated by `_SKIP_DB_INIT`.
- **§4.2 usage counts per service file.** Verified via `grep -c`: pipeline=2, org_auth=5, profiles=5, customer_profile=7, _retrieval=1, documents=18, leads=10, graph_chat(service)=2, market_research=3, icp=7, signals=17, market_scoring=7. All match.
- **§3.7: `_fetch_pinecone_supporting_context` callers.** Verified: icp.py (3 sites: 686, 919, 994), signals.py (3 sites: 580, 717, 779), market_research.py (1 site: 984) = 7 total. Accurate.
- **§3.7: `get_leads_for_org` callers in signals.py.** Verified: 2 sites (lines 593-594, 730-731). Accurate.
- **Test count: 195 `def test_` definitions.** Verified.
- **No router besides `graph_chat.py` imports clients/llm_config.** Verified.
- **`_llm_helpers.py` and `_claude_budget.py` have no `clients.*`/`llm_config.*` references.** Previously verified in round 2; still accurate.
- **Chain/chain2 conditional on `clients.graph is not None` in `llm_config.py`.** Verified at lines 162, 290.
