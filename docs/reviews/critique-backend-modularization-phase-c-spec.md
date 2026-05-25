# Critique: Backend Modularization — Phase C Design Spec

**Spec reviewed:** `/specs/2026-05-22-backend-modularization-phase-c-design.md`
**Date:** 2026-05-22
**Reviewer:** CTO (AI-assisted)

---

## Overall Assessment

The spec is well-structured, appropriately scoped, and honestly motivated. It correctly identifies the Phase B carry-forward debt, traces items to their review findings, and resists scope creep into DI/tests/security. The commit strategy is pragmatic. The acceptance criteria are verifiable.

That said, the spec contains several factual inaccuracies relative to the current codebase, one significant design disagreement (Item 4), and a handful of missing considerations that would bite during implementation. Addressing these before plan-writing will avoid mid-task surprises.

---

## Strengths

1. **Scope discipline.** Five items, each traced to a specific review finding or carry-forward. No scope creep into DI, tests, or security. Each item is bounded with a clear definition of done.

2. **Honest rationale on the domain-exception reversal (§3.4).** The spec openly acknowledges the reversal and explains why: "services are unit-tested with TestClient which already requires FastAPI as a test dep, so 'services testable without FastAPI' isn't a real constraint." Whether one agrees with the conclusion, the reasoning is transparent.

3. **Good traceability.** Every item links to its source (review M9, B spec §9.3, carry-forward, etc.). The Phase D+ inventory in §8 preserves institutional memory.

4. **Measurable acceptance criteria (§6).** The grep-based verification for `profiler_client` removal, the LOC target for the router, and the `git log` shape check are all concrete and automatable.

5. **Commit strategy (§4).** Dropping the `[phase C, commit N/M]` suffix is a good call — Phase B's numbering churn was indeed unhelpful.

---

## Factual Errors

### FE-1. Item 4 undercounts the blast radius of domain exceptions

The spec (§3.4) states: "Three domain-exception classes used at **2 raise sites** total." This is correct for *raises*, but the sentence continues: "services still import and raise HTTPException directly in ~30 other sites, so the domain-exception layer adds confusion without delivering decoupling." This characterization is incomplete.

Actual usage surface:

| Exception | Raise sites | Router catch sites | Total files touched |
|---|---|---|---|
| `BudgetExhaustedError` | 1 (`_claude_budget.py:54`) | 3 (`signals.py:40,71`, `market_research.py:24`) | 4 |
| `ICPIdRegistryError` | 1 (`icp.py:1137`) | 3 (`icp.py:16,24,36`) | 2 |
| `BrewraError` (base) | 0 | 0 | 0 |

**6 catch sites** must be updated in addition to the 2 raise sites. The spec's conversion plan only describes the raise-side changes and mentions removing "any router exception handlers" in passing. The router catch blocks in `signals.py` (lines 40, 71), `market_research.py` (line 24), and `icp.py` (lines 16, 24, 36) must all be removed or rewritten. This isn't a "1-2 commit" trivial change — it touches 4 router files.

**Recommendation:** Add explicit line references for every catch site. Expand the commit plan to acknowledge the router-side cleanup. This is the highest-risk item in the phase because it changes observable API behavior (the 429 response body).

### FE-2. Router LOC is 201, not 216

The spec (§3.5, §6) states the router is "216 LOC." The actual file `app/routers/market_scoring.py` is 201 lines. The 216 figure likely comes from the Phase B code review, which reviewed the branch at a different state. The acceptance criterion should use the current count.

### FE-3. Item 5 says "three" `create_index` calls in one place, "four" in another

§3.5 says: "_get_market_score_collections calls create_index four times per request." The code at `app/services/market_scoring.py:46-49` shows exactly 4 calls. This is correct. However, the Phase B review (H2) says "three times" — the spec is right and the review was wrong, but the spec should note the discrepancy rather than silently correcting it.

### FE-4. `_get_market_score_collections` return count

The router at line 31 destructures as `_, run_coll = market_scoring_service._get_market_score_collections()` — two values. The function returns `(score_coll, run_coll)`. This is consistent. But the spec's proposed service functions (§3.5) will need to call `_get_market_score_collections` internally, and the spec doesn't note that this private helper must remain in the service module. Currently it's called from both the router and the service; after extraction, all callers are within the service.

---

## Design Disagreements

### DD-1. Reversing domain exceptions is the wrong call for `BudgetExhaustedError`

The spec argues that the domain-exception layer should be removed because "services still import and raise HTTPException directly in ~30 other sites." The reasoning is that two competing conventions are worse than one.

I disagree. The `BudgetExhaustedError` / router-catch pattern is actually **working correctly as designed**:

- **Service layer** (`_claude_budget.py`) raises a domain-specific exception with a structured dict payload.
- **Router layer** (`signals.py:40-41`, `market_research.py:24`) catches it and maps to HTTP 429.
- This is exactly the separation the Phase B commit intended.

The problem isn't that the pattern is wrong — it's that it was only applied to 2 of ~32 exception sites. Removing the 2 correct instances to match the 30 incorrect ones is solving the wrong problem.

**Alternative:** Keep `BudgetExhaustedError` and `ICPIdRegistryError`. Delete only `BrewraError` (unused base class). This eliminates the "unused abstraction" complaint while preserving the working pattern. The 429 body fix (the actual bug) can be done independently by fixing the router catch to pass `detail=e.args[0]` (the dict) instead of `detail=str(e)` (the stringified dict).

If the team still wants to remove the exceptions entirely, the spec must be more explicit about the 429 body shape change — see FE-1.

### DD-2. Item 3's `order_by_recent: bool` parameter is a poor abstraction

The proposed `get_leads_for_org` signature uses `order_by_recent: bool`. This hard-codes one sort order behind a boolean flag. If a future caller needs `ORDER BY l.updated_at DESC` or a different sort, a new boolean parameter is needed.

**Alternative:** Use `order_by: Optional[str] = None` and validate against a small allowlist (`None` = no sort, `"created_at_desc"` = current behavior). Or simply accept that this function has exactly 2 callers with known behavior and use `sort_desc: bool = False` with a comment that the sort field is `created_at`.

This is minor — the function has 2 callers and the boolean is fine for MVP. Flag it for the record.

### DD-3. Item 5's service functions should not return Pydantic response models

The spec proposes:

```python
def trigger_or_get_market_scores(...) -> LeadMarketScoresResponse: ...
def get_market_scores_status(...) -> LeadMarketScoringStatusResponse: ...
def get_lead_market_score_descriptions(...) -> LeadMarketScoreDescriptionsResponse: ...
```

Having services return Pydantic response models couples the service layer to the HTTP response schema. If a future caller (CLI command, background task, different endpoint) needs the same logic with a different response shape, the service function is locked to one model.

The existing Phase B pattern (used by `leads`, `icp`, `signals`, `documents`) has services return plain dicts/lists, and routers construct the response model. The spec should follow that pattern here for consistency.

**Alternative:** Services return `Dict[str, Any]` or a service-layer dataclass. Routers construct the response model. This matches the established convention.

---

## Missing Considerations

### MC-1. `conftest.py` patches `profiler_client` — must update in Item 2

`tests/conftest.py:100`:
```python
mocker.patch("app.core.clients.profiler_client", mongo)
```

If `profiler_client` is deleted from `clients.py`, this patch target becomes invalid. The conftest must be updated to patch only `app.core.clients.client`. Additionally, individual test files that patch `profiler_client` directly (`test_market_scoring.py:110,141,164`, `test_icp.py:148,167,194,333`) must also be updated.

The spec (§3.2) mentions "All callers of `_get_profiler_mongo_client()`" but doesn't mention the test mock targets. The acceptance criterion (§6.3) grepping for `profiler_client` in `app/` will miss test references.

**Recommendation:** Add a test-update step to Item 2. Update the acceptance grep to include `tests/`.

### MC-2. Cross-service import cycle: `leads.py` → `market_scoring.py` → `leads.py`

`app/services/leads.py:249` imports `_get_profiler_mongo_client` from `market_scoring.py`. `app/services/market_scoring.py:26` imports `fetch_leads_for_org` from `leads.py`. This creates a circular dependency that Python resolves via deferred imports (the `from ... import ...` is inside function bodies), but it's fragile.

Item 2 (delete `_get_profiler_mongo_client`) partially addresses this by removing the `leads.py` → `market_scoring.py` import. But `customer_profile.py` (4 call sites: lines 16, 145, 236, 384) also imports from `market_scoring.py`. After Item 2, all these imports change to `from app.core.clients import client`, which fully breaks the cycle. The spec should note this benefit explicitly — it's a genuine architectural improvement.

### MC-3. Item 5 startup event needs `BREWRA_SKIP_DB_INIT` guard

The spec proposes moving `create_index` calls to a FastAPI startup event. If the `Profiler` database doesn't exist yet (fresh environment), MongoDB will create it lazily — this is fine. But the startup event must be guarded by `_SKIP_DB_INIT` (or `clients.client is None`) to avoid connection errors during test runs, matching the pattern used for `clients.graph.refresh_schema()` at `app/main.py:81-82`.

The spec should explicitly call this out. The current `refresh_schema` guard is the precedent.

### MC-4. Item 4's 429 body shape change may break the frontend

The current `BudgetExhaustedError` flow:
1. `_claude_budget.py:54-61` raises `BudgetExhaustedError({"error": "Token budget exceeded...", "token_limit_5m": ..., "current_tokens_5m": ..., "requested_tokens": ...})`
2. Router catches: `except BudgetExhaustedError as e: raise HTTPException(status_code=429, detail=str(e))`
3. Frontend receives: `{"detail": "{'error': 'Token budget exceeded...', ...}"}` — a **string**, not a JSON object.

If the spec converts to `raise HTTPException(status_code=429, detail={...})`, the response becomes:
```json
{"detail": {"error": "Token budget exceeded...", "token_limit_5m": ..., ...}}
```

This changes the type of `detail` from `string` to `object`. If the frontend parses `detail` as a string (e.g., displays it in a toast), it will break. The spec says "preserve any fields... so the frontend isn't broken" but doesn't specify the new shape or acknowledge the type change.

**Recommendation:** Either:
- (a) Keep `detail` as a string but fix it to be a proper JSON string (not a Python repr): `detail=json.dumps(payload)`.
- (b) Change to a dict body and update the frontend in the same commit (the monorepo enables this).
- (c) Use a structured error response model for 429s: `{"status": 429, "message": "...", "details": {...}}`.

Option (a) is the safest minimal change. Option (c) is the best long-term choice.

### MC-5. The spec doesn't address the `except HTTPException: raise` anti-pattern cleanup

The Phase B review (H5) flagged the `except HTTPException: raise` anti-pattern appearing 20 times. If Item 4 converts domain exceptions back to `HTTPException`, these catch blocks gain more relevance — every new `raise HTTPException(429, ...)` in a service will be caught and re-wrapped by the catch-all blocks in the same function.

The spec should note whether any of the affected functions in Items 2-5 have this pattern and whether it needs updating as part of the conversion.

### MC-6. Item 1 is too trivial for its own commit

`extract_number` return-type fix is a one-line annotation change. Bundling it with Item 2 (which is also small and touches nearby code) would reduce commit noise without losing bisectability. The spec's granularity policy says "each plan task = 1 commit," but this is a case where the literal application of the policy produces a commit that's below the signal threshold.

**Recommendation:** Merge Items 1 and 2 into a single commit (both are "type annotation + alias cleanup" in the same neighborhood). Or keep separate commits but note that Item 1 is intentionally minimal.

---

## Minor Nits

1. **§3.5 `_get_market_score_collections` call count.** The function is called from: the router (3 calls: lines 31, 111, 182) and the service (4+ calls: lines 206, 232, 409, 455). After Item 5's extraction, all router calls disappear — the function is only called within the service. The spec should note that this function becomes purely internal and can be inlined or simplified.

2. **§4 branch name.** `refactor-backend-modularization-phase-c` is fine but long. Consider `refactor/phase-c` for brevity. Low priority.

3. **§5 test count.** "93 tests passing after the post-B-review cleanup commits" — this should be verified at plan-writing time. The count may have drifted if test files were added/removed.

4. **§3.3 table.** "Caller(s)" column says `market_scoring._run_market_scoring_for_org` but the router (`market_scoring.py:126`) also calls `fetch_leads_for_org`. The spec should list both callers.

5. **§3.2 line numbers are stale.** "app/core/clients.py:55", "app/services/market_scoring.py:32-37" — verify these at implementation time. The post-B-review cleanup commits may have shifted line numbers.

---

## Summary of Required Changes Before Plan-Writing

| Priority | Item | Action |
|---|---|---|
| **Must fix** | FE-1 | Add all 6 router catch sites to Item 4 scope; expand commit plan |
| **Must fix** | MC-1 | Add conftest + test mock updates to Item 2; widen acceptance grep to `tests/` |
| **Must fix** | MC-4 | Specify the exact 429 response body shape; acknowledge type change from `str` to `dict` |
| **Must fix** | MC-3 | Add `BREWRA_SKIP_DB_INIT` guard to startup event in Item 5 |
| **Should fix** | DD-1 | Reconsider: keep `BudgetExhaustedError`, fix the router catch to pass the dict correctly |
| **Should fix** | DD-3 | Services return plain dicts, not Pydantic response models (match Phase B convention) |
| **Should fix** | FE-2 | Update router LOC from 216 to 201 |
| **Nice to have** | DD-2 | Consider `order_by` parameter design for Item 3 |
| **Nice to have** | MC-6 | Consider merging Items 1 and 2 |
