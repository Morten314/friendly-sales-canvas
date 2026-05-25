# Phase C Code Review: `refactor-backend-modularization-phase-c`

**Reviewer:** AI-assisted review of branch vs `master` (merge base `a17dccb`)
**Date:** 2026-05-22
**Commits:** 12 (3 docs-only, 9 code)

## Summary

Phase C is a focused cleanup pass after Phases A and B. It deletes dead aliases (`profiler_client`, `_get_profiler_mongo_client`, `BrewraError`), consolidates two near-duplicate lead-fetch functions into one parameterized function, extracts the three `market_scoring` router endpoints into service-layer functions, and moves per-request `create_index` calls to a startup event. The net change is +1040 / −299 LOC across 19 files (739 net, 543 of which are new review docs).

Overall this is clean, well-scoped work. The commits are logically atomic and correctly ordered (migrate callers → delete alias). Below are the critiques, organized by severity.

---

## Critical Issues

### C1. Service layer raises `HTTPException` — framework leak

The stated design convention from Phase B is: *"services return dicts, routers wrap with response_model."* Phase C's exceptions.py docstring was even updated to say *"free of FastAPI specifics for the cases that warrant it"* — but the extracted functions do the opposite.

Three newly-extracted functions in `market_scoring.py` raise `HTTPException` directly:

| Function | Line | Raises |
|---|---|---|
| `trigger_or_get_market_scores` | 327 | `HTTPException(404)` |
| `get_market_scores_status` | 359 | `HTTPException(404)` |
| `get_lead_market_score_descriptions` | 432 | `HTTPException(404)` |

The service also accepts a `BackgroundTasks` parameter — a FastAPI type — in `trigger_or_get_market_scores` (line 258).

**Impact:** These functions cannot be tested or called outside a FastAPI request context without pulling in the framework. This undercuts the goal of keeping the service layer framework-agnostic and is inconsistent with the stated convention.

**Recommendation:**
1. Replace `raise HTTPException(404, ...)` with a domain exception (e.g., `ScoreNotFoundError`, `RunNotFoundError`) or a sentinel return. Have the router catch and convert. This matches the existing `BudgetExhaustedError` → 429 pattern.
2. Move `background_tasks.add_task(...)` back to the router. The service function should return the data needed to schedule the task (run_id, user_id, org_id); the router wires it into `BackgroundTasks`. This removes the `from fastapi import BackgroundTasks` import from the service entirely.

**Scope note:** The `HTTPException` leak is pre-existing in Phase B — `leads.py`, `signals.py`, `customer_profile.py`, etc. all raise `HTTPException` from service functions. Phase C perpetuates it rather than introducing it. Fixing this project-wide is a separate task, but the *newly extracted* functions should not add to the debt. At minimum, Phase C should not make it worse by also importing `BackgroundTasks`.

### C2. `@app.on_event("startup")` is deprecated

`app/main.py:90` uses the deprecated `@app.on_event("startup")` API. FastAPI has recommended `lifespan` context managers since 0.93.0. The project pins `fastapi` in `requirements.txt` without a version constraint, so the installed version is unpredictable — but any modern FastAPI will emit a deprecation warning.

**Recommendation:** Migrate to a `lifespan` context manager. This is a one-time change and avoids a future breaking removal:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    if not os.getenv("BREWRA_SKIP_DB_INIT") and clients.client is not None:
        profiler_db = clients.client["Profiler"]
        profiler_db["Lead_Market_Scores"].create_index([("org_id", 1), ("lead_id", 1)], unique=True)
        profiler_db["Lead_Market_Scores"].create_index([("org_id", 1), ("updated_at", -1)])
        profiler_db["Lead_Market_Score_Runs"].create_index([("org_id", 1), ("status", 1)])
        profiler_db["Lead_Market_Score_Runs"].create_index([("org_id", 1), ("created_at", -1)])
    yield

app = FastAPI(lifespan=lifespan)
```

---

## Non-Critical Issues (Improvements)

### N1. `get_leads_for_org` has too many boolean flags

The consolidated function (`leads.py:21-54`) has `order_by_recent: bool` and `raise_on_error: bool` — two boolean parameters that multiply the behavioral space. The commit message acknowledges this is a "consolidation" of two functions, but the result is a function that does four different things depending on flag combinations.

**Recommendation for a future pass:** Consider splitting into two functions: `get_leads_for_org` (the happy-path, raises version) and a private `_get_leads_for_org_quiet` (returns [], no raise) used by background tasks. The `limit` and `order_by_recent` params are fine — they configure the query. The `raise_on_error` flag is the one that changes the function's contract.

### N2. `import uuid` is function-local in one place, module-level everywhere else

`trigger_or_get_market_scores` does `import uuid` at function scope (`market_scoring.py:266`) with a comment explaining why. But `signals.py`, `org_auth.py`, `icp.py`, `documents.py`, and `leads.py` all import `uuid` at module level. The function-local import is inconsistent.

**Recommendation:** Move `import uuid` to the module top-level in `market_scoring.py` alongside the other stdlib imports. The comment says "uuid is used only in this function" but that's a weak justification for a stdlib module — there's no circular-import risk.

### N3. Startup index creation bypasses `_get_market_score_collections()`

The startup event in `main.py:91-99` manually constructs collection references from `clients.client["Profiler"]`, duplicating the database name `"Profiler"` and collection names `"Lead_Market_Scores"` / `"Lead_Market_Score_Runs"` that also appear in `_get_market_score_collections()` at `market_scoring.py:36-37`.

**Recommendation:** Either:
- Call `_get_market_score_collections()` from the startup event (it now does zero indexing, so it's safe), or
- Extract the db/collection names as module-level constants so there's a single source of truth.

This prevents a future rename from updating one and missing the other.

### N4. `exceptions.py` docstring undercut by the actual code

The updated docstring says *"free of FastAPI specifics for the cases that warrant it"* — this reads like it's making an exception, which undermines the principle. If the project has decided that service-layer `HTTPException` is acceptable (and the evidence across 10 service files shows it is), the docstring should state the actual convention rather than aspirationally qualifying it.

**Recommendation:** Reword to something like: *"Routers may also raise HTTPException directly from service functions when the error maps 1:1 to an HTTP status code. Domain exceptions are reserved for cross-cutting error handling (e.g., budget exhaustion) where the mapping to HTTP status is determined by the router context."*

### N5. Three docs-only commits could have been one

Commits `46e8a0f`, `0b67076`, `730b647` add three review documents and nothing else. They're logically one unit ("add review documents for Phase B and Phase C"). Splitting them into three commits adds noise to `git log` without aiding bisect or review.

**Recommendation:** For future doc additions, batch related review/spec documents into one commit. This is cosmetic and doesn't affect correctness.

### N6. `get_market_scores_status` has a very long line

`market_scoring.py:387` has a 121-character projection list inside `score_coll.find(...)`. This is hard to read in standard terminal widths.

**Recommendation:** Break the projection dict onto multiple lines:
```python
recent_docs = list(
    score_coll.find(
        run_score_filter,
        {
            "lead_id": 1, "scoring_status": 1,
            "market_total_score": 1, "updated_at": 1,
            "component_descriptions": 1,
        },
    )
    .sort("updated_at", -1)
    .limit(recent_items_limit)
)
```

### N7. `test_market_scoring.py` still patches at the wrong level

`test_leads.py` was correctly updated from `patch("app.services.market_scoring.MongoClient")` to `patch("app.core.clients.client")` — good. But `test_market_scoring.py` still uses `patch("app.core.clients.client")` which is correct. However, none of the market-scoring tests verify that the newly-extracted service functions (`trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`) work correctly in isolation — they only test the router endpoints.

**Recommendation:** Add unit tests for the three new service functions that call them directly (without going through the FastAPI test client). This would also validate the `Dict[str, Any]` return contract.

---

## What's Done Well

1. **Correct two-phase alias deletion.** Commit `df306e4` migrates all callers, then `84e4cc3` deletes the alias. This is the safe pattern — no intermediate state where the alias is deleted before callers are migrated.

2. **Breaking the import cycle.** The commit message for `84e4cc3` explicitly notes that deleting `_get_profiler_mongo_client` breaks a real cross-service import cycle (`leads.py ↔ market_scoring.py`). This is a genuine improvement.

3. **Consistent router shape.** After the three extraction commits, `routers/market_scoring.py` is 48 LOC of pure HTTP wiring. This matches the `leads`, `icp`, `signals`, and `documents` router conventions from Phase B. Consistency matters more than perfection.

4. **Per-request index elimination.** Moving four `create_index` calls from the per-request path (`_get_market_score_collections`) to a startup event is a real latency improvement. MongoDB `createIndex` on existing indexes is a no-op metadata check but still a round-trip. Over hundreds of scoring requests, this adds up.

5. **`BrewraError` cleanup.** Deleting a dead base class and fixing the 429 body serialization (`detail=str(e)` → `detail=e.args[0]`) in one commit is the right granularity. The bug fix is invisible in a code search but meaningful to the frontend.

6. **Good commit messages.** Every commit explains *why*, not just *what*. The reference to review items (E4, M9, H2) creates a traceable chain from review → plan → implementation.

---

## Questions for the Author

1. **Was there a conscious decision to accept `HTTPException` in services?** The Phase B convention is "services return dicts, routers handle HTTP." Phase C's extracted functions raise `HTTPException(404)` from the service layer. Is this an intentional shift in the convention, or should these be domain exceptions caught by the router?

2. **Is the `BackgroundTasks` import in the service layer temporary?** It couples the service to FastAPI's task-scheduling mechanism. If the project ever moves to Celery/ARQ (mentioned in AGENTS.md as "in-process; tasks are lost on Render restart"), the service function signature will need to change.

3. **Should `_get_market_score_collections()` remain a private function?** After the extraction, the only callers of this function are within `market_scoring.py` itself (the three public functions and the background task). But the router no longer calls it. Consider whether it should stay private or if the collection references should be inlined into the callers for clarity.

4. **Are there other services with per-request `create_index` calls?** The startup event only handles market-scoring indexes. `leads.py:270` (`batch_upload_leads`) and `customer_profile.py` both call `create_index` on hot paths. Should those be moved to startup as well?
