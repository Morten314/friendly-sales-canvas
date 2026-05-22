# Review: Backend Modularization Phase C Plan (`plans/modularization-plan-3.md`)

**Date:** 2026-05-22  
**Reviewer:** AI code review against codebase at `master`  
**Verdict:** Plan is sound and ready to execute with the issues below addressed. No blocking issues; a few medium-severity inaccuracies that will cause test failures or runtime errors if followed literally.

---

## Summary

The plan closes 5 Phase-B carry-forward items across 9 commits (Tasks 1–9, plus a final acceptance check). Line numbers and file references were verified against the current codebase. Most are accurate; the issues below are ordered by task.

---

## Task-by-Task Review

### Task 1 — Fix `extract_number` return-type annotation

**Verdict: Clean.** No issues. Line numbers match (`graph_chat.py:152-154`). The single-caller check is correct (3 matches: module docstring line 8, definition line 152, caller line 183). The `Optional` import check is a good defensive step.

**Minor note:** The plan doesn't mention that `graph_chat.py` currently has no `from typing import ...` at all (the file's only imports are `re`, `langchain_core.messages`, and local `llm_config`). Step 3's grep will correctly find nothing, and the implementer will need to add a new `from typing import Optional` line — the plan handles this fine.

---

### Task 2 — Switch `profiler_client` callers to `client`

**Verdict: Mostly clean, one missing location.**

**Issue 2a — `batch_upload_leads` uses a function-body import, not a module-level one.** The plan says to delete line 249 and change line 270 in `leads.py`. The current code at line 249 is:
```python
from app.services.market_scoring import _get_profiler_mongo_client
```
And line 270 is:
```python
mongo_client = _get_profiler_mongo_client()
```

This is correct — the plan correctly identifies these. However, the same function at line 271 also does:
```python
profiler_db = mongo_client["Profiler"]
```
After the change to `clients.client`, this still works (same client). No issue here.

**Issue 2b — Missing `batch_upload_leads` `create_index` calls.** The function at `leads.py:273-274` calls:
```python
lead_stream_coll.create_index("file_id", unique=True)
lead_stream_coll.create_index([("user_id", 1), ("org_id", 1)])
```
These are unrelated to the `profiler_client` migration but are the same per-request `create_index` pattern that Task 9 addresses for `_get_market_score_collections`. The plan doesn't mention them, which is fine — they're out of scope for Phase C. Noted for a future cleanup.

**Issue 2c — `delete_leads_by_file` has TWO `_get_profiler_mongo_client()` calls.** The plan's Step 1 says:
> Delete line 456: `from app.services.market_scoring import _get_profiler_mongo_client`
> Change line 487 from `mongo_client = _get_profiler_mongo_client()` to `mongo_client = clients.client`.

Looking at the actual code, line 456 has the import, but there's no second `_get_profiler_mongo_client()` call at line 487 — there's one at line 487 (`mongo_client = _get_profiler_mongo_client()`). This is fine; the plan is correct here.

Actually wait — line 456 has `from app.services.market_scoring import _get_profiler_mongo_client`, and the only call in `delete_leads_by_file` is at line 487. The plan says lines 456 and 487 which matches. This is correct.

**Issue 2d — `conftest.py` docstring also references `profiler_client` at lines 6-7.** The plan updates the `mock_mongo` fixture docstring (lines 85-101) but doesn't mention the module-level docstring at lines 6-7 which says:
```
`app.core.clients.client` (and `profiler_client`), so all Mongo mocking
happens via `app.core.clients.client` / `app.core.clients.profiler_client`.
```
Step 4's replacement text is correct for the fixture, but the module docstring above should also be cleaned up. **Recommendation:** Add a sub-step to update lines 6-7 of `conftest.py` to remove the `profiler_client` references. Without this, the cleanup grep in Step 7 (`grep -rn "profiler_client" tests/`) will still show hits from the module docstring even after the fixture is updated.

---

### Task 3 — Delete `profiler_client` alias and helper

**Verdict: Clean.** Line numbers for `clients.py:55-60` and `market_scoring.py:32-37` are accurate. The docstring update for `clients.py` line 6 is correctly identified.

**Issue 3a — `MongoClient` import removal check.** Step 2 says to check if `MongoClient` is still used after deleting `_get_profiler_mongo_client`. Looking at `market_scoring.py` line 17, the import is:
```python
from pymongo import MongoClient
```
After the deletion, `MongoClient` is used only in the return type annotation of `_get_profiler_mongo_client` (which is being deleted). However, the plan also mentions removing it — but does `MongoClient` appear anywhere else in the file? Let me check... The function `_get_profiler_mongo_client` is the only function annotated with `MongoClient`, and the import should indeed become unused. The plan's instruction is correct.

---

### Task 4 — Consolidate `fetch_leads_for_org` and `get_all_leads`

**Verdict: Has a functional bug in the proposed replacement function.**

**Issue 4a (MEDIUM) — Missing `score` parameter in `fetch_leads_for_org`'s `ORDER BY`.** The current `fetch_leads_for_org` uses:
```sql
ORDER BY l.created_at DESC
LIMIT $limit
```
The new `get_leads_for_org` proposes:
```python
if order_by_recent:
    clauses.append("ORDER BY l.created_at DESC")
if limit is not None:
    clauses.append("LIMIT $limit")
```
This is correct — `order_by_recent=True` gives the same behavior as the old function. The router call in Step 5 uses `get_leads_for_org(org_id)` with defaults (no limit, no order, raises on error), which matches `get_all_leads`. Good.

**Issue 4b (MEDIUM) — The `_process_neo4j_lead_records` call won't match `fetch_leads_for_org` behavior exactly.** The old `fetch_leads_for_org` inlines its own JSON-deserialization loop (lines 33-47) which is identical to `_process_neo4j_lead_records`. The new function delegates to `_process_neo4j_lead_records`, which is correct. No behavior difference.

**Issue 4c (LOW) — Step 1 caller count is wrong.** The plan says:
> Expected: 4 hits — definition (`leads.py:21`), and 3 callers in `market_scoring.py` (background task) and `routers/market_scoring.py` (router fallback at line ~119) plus the import in `routers/market_scoring.py`.

That's actually: 1 definition + 1 call in `market_scoring.py` + 1 call in `routers/market_scoring.py` + 1 import in `market_scoring.py` + 1 import in `routers/market_scoring.py` = **5 hits**. The plan says "3 callers" but lists 2 callers and 1 import = 3 "in market_scoring.py and routers/market_scoring.py" — but there's also the import at `market_scoring.py:26`. So `grep -rn "fetch_leads_for_org" app/` will produce:
1. `app/services/leads.py:21` — definition
2. `app/services/market_scoring.py:26` — import
3. `app/services/market_scoring.py:462` — call
4. `app/routers/market_scoring.py:18` — import
5. `app/routers/market_scoring.py:126` — call

That's 5 hits, not 4. **Recommendation:** Update the expected count to 5.

**Issue 4d (LOW) — Line ~119 vs actual ~126.** The plan says the router fallback call is "at line ~119", but looking at the actual router code, the `fetch_leads_for_org` call is at line 126 (inside `get_lead_market_scores_status`). This is within the range of "~119" so not a real problem — the implementer will find it by function name.

---

### Task 5 — Delete `BrewraError` base + fix 429 body shape

**Verdict: Clean with one verification gap.**

**Issue 5a (LOW) — Snapshot test update path.** Step 7 says to run `pytest --snapshot-update tests/test_signals.py tests/test_market_research.py`. This is correct, but the plan should note that if no snapshot test currently pins the 429 response body (the tests might use mocking that short-circuits before the HTTPException), then `--snapshot-update` won't produce any changes. The implementer should check whether existing tests even exercise the `BudgetExhaustedError` catch path. If they don't, the `--snapshot-update` step is a no-op, which is fine but could be confusing.

**Issue 5b — `BudgetExhaustedError` exception payload shape.** The plan says `e.args[0]` is a dict. This depends on how the exception is raised. Looking at `services/_claude_budget.py:54-61`, the plan references this but doesn't show it. The implementer should verify this before trusting the fix. **Recommendation:** Add a sub-step to verify the exception constructor:
```bash
grep -A5 "class BudgetExhaustedError" app/services/_claude_budget.py
```
Or grep for `raise BudgetExhaustedError` to confirm the payload is a dict.

**Issue 5c — `detail=e.args[0]` vs `detail={"detail": e.args[0]}`.** FastAPI's HTTPException wraps `detail` in `{"detail": <value>}`. So `detail=e.args[0]` (where `args[0]` is a dict) produces `{"detail": {"error": "...", "token_limit_5m": ..., ...}}`. The plan's commit message correctly describes this. But the frontend may be parsing the response differently depending on how it expects the error payload. Since this is a bug fix (the current `str(e)` produces unparseable Python repr), any change is an improvement. Noted but not a plan issue.

---

### Task 6 — Extract `trigger_or_get_market_scores` into service

**Verdict: Has a type mismatch bug.**

**Issue 6a (HIGH) — `last_scored_at` type mismatch.** The proposed service function returns:
```python
last_scored_at = rows[0].updated_at if rows else None
```
But `rows` is the return value of `_get_latest_market_score_rows()`, which returns `List[LeadMarketScoreRow]` (Pydantic models, not dicts). `LeadMarketScoreRow` has an `updated_at` field of type `Optional[str]`. So `rows[0].updated_at` is fine — it accesses a Pydantic model attribute.

However, the current router code at line 93 does the same thing: `rows[0].updated_at`. So this is consistent. No actual bug here — I was initially concerned because the plan says "returns a dict (not a `LeadMarketScoresResponse` instance)" but the inner data from `_get_latest_market_score_rows` is already Pydantic models. The returned dict will contain `LeadMarketScoreRow` instances in the `rows` key, which FastAPI will serialize via `response_model`. This works.

**Issue 6b (MEDIUM) — The function receives `BackgroundTasks` as a parameter.** This creates a coupling between the service layer and FastAPI's `BackgroundTasks`. The plan acknowledges this:
> Convention (verified...): service functions return `Dict[str, Any]`...

But importing `BackgroundTasks` from FastAPI into the service layer violates the stated convention that "services return dicts; routers do HTTP wiring." The `BackgroundTasks.add_task` call inside the service function is inherently FastAPI-coupled.

**Recommendation:** Consider returning the task-scheduling information (function reference + args) from the service and letting the router call `background_tasks.add_task`. For example:
```python
# Service returns:
return {...response dict..., "_schedule": (_run_market_scoring_for_org, user_id, org_id, run_id)}

# Router does:
result = market_scoring_service.trigger_or_get_market_scores(request)
task_info = result.pop("_schedule", None)
if task_info:
    background_tasks.add_task(*task_info)
return result
```
This keeps the service FastAPI-free. However, this is a design preference, not a bug — the plan's approach works and matches Phase B's pattern where services already import `HTTPException` from FastAPI.

**Issue 6c (LOW) — The proposed function imports `uuid` at function-body level.** The plan has `import uuid` inside the function body. The current router imports it at module level. Moving it into the function is fine (and arguably better since it's the only place `uuid` is needed after the extraction), but the plan should note this explicitly so the implementer doesn't wonder whether to also add a module-level import.

---

### Task 7 — Extract `get_market_scores_status` into service

**Verdict: Clean.** The proposed function is a faithful copy of the router logic. The `get_leads_for_org` fallback at `total_leads <= 0` correctly uses the new consolidated function from Task 4.

**Issue 7a (LOW) — Router import cleanup.** Step 2 says to remove the `LeadMarketScoreStatusItem` import if unused. After this task, no handler constructs `LeadMarketScoreStatusItem` directly, so it can be removed. The plan correctly notes this.

---

### Task 8 — Extract `get_lead_market_score_descriptions` into service

**Verdict: Clean.** Straightforward extraction.

**Issue 8a (LOW) — `MARKET_SCORE_COMPONENT_KEYS` import in router.** After this extraction, the router no longer uses `MARKET_SCORE_COMPONENT_KEYS` directly (the service uses it). Step 3 should explicitly mention removing this from the router's imports. Currently the router imports it at line 15. After all three extractions, the router only needs: `APIRouter`, `Query`, `Optional`, `BackgroundTasks`, the three response model classes, and `market_scoring_service`.

---

### Task 9 — Move `create_index` calls to startup event

**Verdict: Has a potential test issue.**

**Issue 9a (MEDIUM) — Startup event runs against MagicMock in tests.** The plan acknowledges this:
> The mocked `clients.client` in `mock_mongo` fixture is a `MagicMock`, not `None`, so the guard's `if clients.client is None` returns False and the startup function runs against the mock.

A `MagicMock` supports arbitrary attribute access and method calls, so `clients.client["Profiler"]["Lead_Market_Scores"].create_index(...)` will succeed silently. This is correct. However, the plan's fallback (checking `BREWRA_SKIP_DB_INIT`) is safer and should be the primary guard, not a fallback. **Recommendation:** Use the `BREWRA_SKIP_DB_INIT` check as the primary guard in Step 2, since the conftest already sets this env var (indirectly via `_SKIP_DB_INIT` in `clients.py`... actually, looking at the test setup, `BREWRA_SKIP_DB_INIT` IS set in the test environment, which is why `clients.client = None` initially). The `mock_mongo` fixture then patches `clients.client` with a `MagicMock`. So at startup time during test collection, `clients.client` is `None`, and the `None` guard works. But the startup event fires *after* fixture setup for each test, at which point `clients.client` is a `MagicMock`. This depends on FastAPI's event lifecycle during `TestClient` construction.

**The real question is: when does the startup event fire during testing?** If tests use `TestClient(app)`, the startup event fires during `__enter__` or construction, which may happen before fixtures are applied. The plan should include a verification step that the startup event doesn't cause test failures. The fallback `BREWRA_SKIP_DB_INIT` check is safer and should be preferred.

**Issue 9b (LOW) — `@app.on_event("startup")` is deprecated.** The plan notes this and explains why it's the right choice for now (matching existing style). This is correct.

---

### Task 10 — Final acceptance check

**Verdict: Clean.** The grep commands are comprehensive and the commit-count expectation (9 commits) matches the plan structure.

**Issue 10a — Criterion 3.2 docstring still mentions `profiler_client`.** The acceptance check doesn't verify that `clients.py`'s docstring was updated. Task 3 Step 1 mentions this but the acceptance grep only checks `app/core/exceptions.py`. Add a check:
```bash
grep "profiler_client" app/core/clients.py
# Expected: no output
```

---

## Cross-cutting Issues

### 1. Service-layer FastAPI coupling

Tasks 6-8 extract router logic into service functions, but the services continue to import `HTTPException` (and in Task 6, `BackgroundTasks`) from FastAPI. This is a deliberate trade-off — the plan notes that Phase B already established this pattern. However, this should be flagged in the Phase D debt list (Task 10, Step 4).

### 2. `_get_market_score_collections` is called in service functions after extraction

After Tasks 6-8, the service functions `trigger_or_get_market_scores`, `get_market_scores_status`, and `get_lead_market_score_descriptions` all call `_get_market_score_collections()`. After Task 9 moves the `create_index` calls out, this function becomes a pure collection-lookup helper. Consider making it a module-level constant or a simpler accessor, but this is Phase D scope.

### 3. `conftest.py` module-level docstring references

As noted in Issue 2d, the module docstring at lines 6-7 of `conftest.py` references `profiler_client`. Task 2's cleanup grep in Step 7 will catch this if run against `tests/` broadly, but the plan only greps `app/` in Step 7's first command and `tests/` in the second. The second grep (`grep -rn "profiler_client" tests/`) will find the conftest module docstring. This should be cleaned up.

### 4. Missing `Optional` import in `leads.py`

Task 4 Step 2 adds `get_leads_for_org` which uses `Optional[int]`. The plan includes a step to check for the `Optional` import, but the current `leads.py` line 7 has:
```python
from typing import Any, Dict, List
```
`Optional` is not there. The implementer will need to add it. The plan handles this correctly with a grep check.

---

## Recommendations Summary

| # | Severity | Task | Issue | Recommendation |
|---|----------|------|-------|----------------|
| 1 | Medium | 2 | `conftest.py` module docstring at lines 6-7 still references `profiler_client` | Add a sub-step to clean up the module docstring |
| 2 | Low | 4 | Expected grep count is 5, not 4 | Update Step 1 expected count |
| 3 | Medium | 5 | `e.args[0]` dict assumption not verified in plan | Add verification sub-step to read `_claude_budget.py` |
| 4 | Medium | 6 | Service imports `BackgroundTasks` from FastAPI | Acknowledge as known coupling; flag for Phase D |
| 5 | Low | 8 | `MARKET_SCORE_COMPONENT_KEYS` import removal in router not explicit | Add to Step 3 |
| 6 | Medium | 9 | Startup event test behavior depends on TestClient lifecycle | Use `BREWRA_SKIP_DB_INIT` as primary guard; add explicit test verification |
| 7 | Low | 10 | Acceptance check doesn't verify `clients.py` docstring cleanup | Add grep for `profiler_client` in `clients.py` |

**Overall:** The plan is well-structured with correct line numbers (with minor drift), good defensive verification steps, and clear commit boundaries. The issues above are all fixable during implementation without redesigning any task.
