# Backend Modularization Phase D — HTTPException → Domain-Exception Migration

**Status:** approved (brainstorm 2026-05-22), pending plan-write
**Branch (planned):** `refactor-backend-modularization-phase-d` off `master`
**Predecessors:** Phase B (2026-05-21), Phase C (2026-05-22)

---

## 1. Summary

Phase D resolves the architectural question Phase C deliberately left open: should the backend's service layer raise `HTTPException` (the FastAPI transport class) or domain exceptions caught at the HTTP boundary?

The decision: **migrate to domain exceptions** with a small, principled hierarchy. After Phase D, no `app/services/*.py` file imports or raises `HTTPException`. A registered FastAPI exception handler maps each domain-exception base to its HTTP response. The layer rule becomes crisp — services raise `BrewraError` subclasses; routers may still raise `HTTPException` for transport-only concerns (e.g., a router-only check that doesn't deserve a typed exception).

This unblocks three latent improvements that Phase C surfaced:
- Direct service-function unit tests (Phase C review N7) become natural — assert on exception type, no `TestClient` required.
- Non-HTTP callers (background tasks, LangChain agent chains, future CLI commands) can call service functions safely. Today `HTTPException` raised inside a `BackgroundTask` silently propagates and is swallowed.
- The `raise_on_error: bool = True` parameter on `get_leads_for_org` (introduced in Phase C task 4 as a workaround for this exact problem) gets deleted.

## 2. Scope

### 2.1 In scope

1. Add a typed exception hierarchy in `app/core/exceptions.py` (~25-30 leaf classes under 4 status-family bases + 2 retained domain-specific classes).
2. Register one FastAPI `@app.exception_handler(...)` per base type in `app/main.py` (6 handlers total).
3. Migrate all ~77 `raise HTTPException` sites in `app/services/` (9 files) to raise typed exceptions.
4. Delete the ~20 `except HTTPException: raise` re-raise boilerplate sites (Phase B review H5).
5. Delete the ~30 `except Exception as e: raise HTTPException(500, ...)` wrap-and-rethrow sites where they exist only to convert unknown errors. Let those propagate to FastAPI's default 500 handler.
6. Delete the 6 router-side catches of `BudgetExhaustedError` / `ICPIdRegistryError` (now handled by the registered handler).
7. Remove the `raise_on_error` parameter from `get_leads_for_org` and update callers (the workaround is no longer needed).
8. Update background-task code paths (`_run_market_scoring_for_org` and any others) to catch `BrewraError` and log+continue instead of relying on caller-side raise suppression.

### 2.2 Out of scope (deferred)

**Test improvements (Phase E candidate, carries forward):**
- Add direct service-function unit tests that exercise the new typed exceptions. Phase C review N7 tracks this. Phase D *enables* the pattern but does not deliver the tests — that's a dedicated test-improvement phase.

**Third-party error mapping:**
- `pymongo.errors.DuplicateKeyError`, `neo4j.exceptions.ClientError`, Pinecone client errors, etc. Today some services catch these and convert to `HTTPException(500)`. Phase D removes that wrapper. Unknown errors hit FastAPI's default 500 handler — no per-driver mapping introduced. If a service has a *meaningful* domain mapping (e.g., MongoDB `DuplicateKeyError` → `ICPAlreadyExistsError`), it stays. The bar: there must be a real semantic mapping, not just status-code conversion.

**FastAPI's own validation handling:**
- `RequestValidationError` (Pydantic 422s) and `HTTPException` (FastAPI's own) keep their default handlers. Phase D doesn't touch FastAPI internals.

**Other refactor work in Phase D+ inventory (see §8):**
- Dependency injection, security hardening, pagination convention, `lifespan` migration, etc.

### 2.3 Why this isn't bigger

A textbook implementation would also include:
- Centralized error logging via the exception handlers (Sentry/structured logging integration).
- A migration of third-party driver errors to a typed `DataStoreError` family.
- Service-level unit tests in the same phase.

These are deferred because they each deserve their own design phase. Phase D's job is the *pattern shift* — not boil-the-ocean infrastructure work.

## 3. Architecture

### 3.1 Exception hierarchy

File: `app/core/exceptions.py` (expansion of existing 2-class file).

```
BrewraError(Exception)                      # base; never raised directly
├── NotFoundError(BrewraError)              # status-family base → 404
│   ├── LeadNotFoundError
│   ├── ICPNotFoundError
│   ├── MarketScoreNotFoundError
│   ├── CompanyProfileNotFoundError
│   ├── CustomerProfileNotFoundError
│   ├── DocumentNotFoundError
│   ├── OrgNotFoundError
│   ├── SignalNotFoundError
│   ├── RunNotFoundError
│   └── … (~15-20 leaves, finalized by §4 discovery)
├── ValidationError(BrewraError)            # status-family base → 400
│   ├── ICPValidationError
│   ├── LeadValidationError
│   └── … (leaves as discovered)
├── ConflictError(BrewraError)              # status-family base → 409
│   ├── ICPAlreadyExistsError
│   ├── RunAlreadyRunningError
│   └── … (leaves as discovered)
├── AuthorizationError(BrewraError)         # status-family base → 403
│   └── … (leaves as discovered)
├── BudgetExhaustedError(BrewraError)       # → 429, args[0] is dict (retained)
└── ICPIdRegistryError(BrewraError)         # → 500 (retained)
```

**Conventions:**
- All leaves end in `Error` (PEP 8 compliance).
- Leaves take a string message: `raise LeadNotFoundError(f"Lead {lead_id} not found")`.
- Status-family bases are abstract — services raise leaves, not bases.
- Resource type lives in the class name, not the message — tests can `pytest.raises(LeadNotFoundError)` rather than parsing strings.
- The two retained classes (`BudgetExhaustedError`, `ICPIdRegistryError`) reparent from their current `Exception` base to `BrewraError`. Their existing semantics (dict payload in `args[0]` for budget, string message for ICP registry) are preserved.

### 3.2 Exception handler registration

File: `app/main.py` — add after `app = FastAPI()`, before `include_router` calls.

```python
from fastapi.responses import JSONResponse
from app.core.exceptions import (
    NotFoundError, ValidationError, ConflictError, AuthorizationError,
    BudgetExhaustedError, ICPIdRegistryError,
)

@app.exception_handler(NotFoundError)
async def _handle_not_found(request, exc):
    return JSONResponse(status_code=404, content={"detail": str(exc)})

@app.exception_handler(ValidationError)
async def _handle_validation(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(ConflictError)
async def _handle_conflict(request, exc):
    return JSONResponse(status_code=409, content={"detail": str(exc)})

@app.exception_handler(AuthorizationError)
async def _handle_forbidden(request, exc):
    return JSONResponse(status_code=403, content={"detail": str(exc)})

@app.exception_handler(BudgetExhaustedError)
async def _handle_budget(request, exc):
    return JSONResponse(status_code=429, content={"detail": exc.args[0]})

@app.exception_handler(ICPIdRegistryError)
async def _handle_icp_registry(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

Python's exception MRO makes inheritance work — registering against `NotFoundError` catches any `LeadNotFoundError`, `ICPNotFoundError`, etc.

### 3.3 Per-service migration shape

```python
# Before
def get_lead_by_id(org_id: str, lead_id: str):
    try:
        result = neo4j_query(...)
        if not result:
            raise HTTPException(404, "Lead not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch lead: {e}")
        raise HTTPException(500, f"Failed to fetch lead: {e}")

# After
def get_lead_by_id(org_id: str, lead_id: str):
    result = neo4j_query(...)
    if not result:
        raise LeadNotFoundError(f"Lead {lead_id} not found")
    return result
```

Net per-file: -1 import (`HTTPException`), +1 import (typed exception), several `try/except` wrappers deleted, file LOC drops.

### 3.4 Background-task pattern

```python
# Before (Phase C workaround)
leads = fetch_leads_for_org(org_id, limit=5000, raise_on_error=False)
# `raise_on_error` flag suppresses HTTPException because the BackgroundTasks
# runner would swallow it.

# After
try:
    leads = get_leads_for_org(org_id, limit=5000, order_by_recent=True)
except BrewraError as e:
    logger.warning(f"Could not fetch leads for run {run_id}: {e}")
    leads = []
```

The catch is now explicit and at the right layer (the background-task orchestrator). The service function has one honest contract.

## 4. Migration approach

### 4.1 Discovery pass

Before code changes, audit every `raise HTTPException` in `app/services/` (~77 sites). Group by:
- Status code (mostly 404, 400, 409, 500)
- Resource type (Lead, ICP, Document, Signal, Run, etc.)

Output: the finalized leaf class list. This goes into the first hierarchy commit so the hierarchy doesn't grow ad-hoc during migration.

### 4.2 Commit order

| # | Type | Scope |
|---|------|-------|
| 1 | `refactor(be):` | Add hierarchy classes from §4.1 discovery |
| 2 | `refactor(be):` | Register exception handlers in `app/main.py` |
| 3-11 | `refactor(be):` | Migrate one service file per commit (9 files) |
| 12 | `refactor(be):` | Delete router-side catches of retained domain exceptions (6 sites across signals/market_research/icp) |
| 13 | `refactor(be):` | Remove `raise_on_error` flag from `get_leads_for_org` and update callers |
| 14 | `refactor(be):` | Background tasks: catch `BrewraError`, log+continue (`_run_market_scoring_for_org`, any others) |
| 15 | `chore(be):` | Final sweep — grep-based validation, delete dead imports if any |

Estimated 14-16 commits total. Each is small enough to review in isolation and to bisect if a regression appears.

### 4.3 Order within service-file commits

Order is not technically constrained (each migration is independent given the hierarchy is in place). Suggested order — easier files first to build confidence and catch hierarchy gaps early:

1. `org_auth.py` (simpler, fewer raises)
2. `profiles.py`
3. `customer_profile.py`
4. `documents.py`
5. `signals.py`
6. `market_research.py`
7. `icp.py`
8. `leads.py`
9. `market_scoring.py` (largest, most entangled with background tasks — last so the lessons compound)

If discovery reveals a service has zero `raise HTTPException` sites, drop it from the migration sequence.

### 4.4 Validation at each commit

- All 93 existing tests pass. Test code changes are expected to be zero; the exception is per §5.2 — if discovery surfaces tests asserting on the *content* of 500-response `detail` strings, update them in the same commit that migrates the service.
- `grep -n "raise HTTPException" app/services/<file>.py` → 0 hits in the file just migrated.
- File LOC drops (`wc -l` before/after).

## 5. Risks

### 5.1 Loss of exception-string leakage in 500 responses (security upside, debug downside)

Today some services do `raise HTTPException(500, f"Failed to do X: {e}")`. The `e` content — possibly including driver-internal details — appears in the HTTP response body. After Phase D, those wrappers are deleted; unknown errors hit FastAPI's default 500 handler which returns `{"detail": "Internal Server Error"}`.

**Implications:**
- **Security:** stops leaking exception strings (small but real upside).
- **Debug:** developers/oncall see less in the response.

**Mitigation:** ensure all services log the underlying exception before any conversion (most already do via `logger.error(...)`). Verify in each migration commit.

### 5.2 Tests that assert on 500-response detail content

Any existing test that asserts on the *content* of a 500-response `detail` field (rather than just the status code) will break. Discovery pass should grep for `assert.*detail.*Failed` or similar patterns. Expected count: low (most tests assert on status only). If found, update those tests in the relevant migration commit.

### 5.3 Background-task error paths now actively log

Today, `HTTPException` raised inside a BackgroundTask silently propagates. After Phase D, the orchestrator catches `BrewraError` and *logs* it — meaning errors that were invisible before become visible in logs. This is correct (silent failures are bad) but the volume increase is worth flagging for the team if log-monitoring alerts are tuned to error rates.

### 5.4 Inheritance MRO edge cases

If a service raises a leaf class but two handlers could match (e.g., if a class accidentally inherited two bases), FastAPI's resolution follows Python's MRO. Risk is low given the flat hierarchy (each leaf has exactly one base), but a test of every status-family path is sensible during the §4.4 validation.

## 6. Acceptance criteria

### Hard (greppable / measurable)

1. `grep -rn "raise HTTPException" app/services/` → **0 hits**
2. `grep -rn "except HTTPException" app/services/` → **0 hits**
3. `grep -rn "raise_on_error" app/services/ app/routers/` → **0 hits**
4. `grep -rn "except BudgetExhaustedError\|except ICPIdRegistryError" app/routers/` → **0 hits**
5. `app/main.py` contains exactly 6 `@app.exception_handler(...)` registrations.
6. **All 93 existing tests pass without modification** (subject to §5.2 mitigation if asserts on 500 detail content are found).
7. Test warning count ≤ 11 (current baseline post Phase C).

### Soft (verifiable manually)

8. HTTP response shape unchanged for all known endpoints — spot-check via FastAPI `/docs` on a running instance.
9. `_run_market_scoring_for_org` catches `BrewraError` and logs; no exceptions leak to the BackgroundTasks runner.
10. Per-service LOC drops in every migrated file (`wc -l` before/after each migration commit).

### Phase complete when

- All hard criteria pass.
- All soft criteria verified.
- No new items added to the Phase E+ inventory beyond what's already in §8.

## 7. Architectural rationale

The current `HTTPException`-in-services pattern is a FastAPI convenience trap. It makes services look easy to write but accumulates structural debt:

1. **Layer violation.** Services know about HTTP status codes. HTTP is a transport concern — the router's job is to map domain outcomes to transport. When a service raises `HTTPException(404)`, it has committed to one transport (HTTP) and one mapping (404 for this domain condition). A CLI tool, batch job, or LangChain agent that calls the same service cannot use a different convention.

2. **Reuse is blocked.** This codebase already has reuse pressure. `BackgroundTasks` swallows `HTTPException` silently — which is exactly why `get_leads_for_org` had to grow a `raise_on_error=False` flag in Phase C. That flag is a workaround for the wrong abstraction. LangChain agent chains (`agent_chain` with `max_iterations=20` in `services.py`) are another non-HTTP caller path that would break if it ever touched code that raises `HTTPException`.

3. **Testability is structurally compromised.** Asserting on an exception's type (`pytest.raises(LeadNotFoundError)`) is what unit tests want. Asserting on `HTTPException.status_code == 404` requires either a TestClient (integration test) or pulling FastAPI internals into a unit test (smell). Phase C review N7 flagged the absence of direct service-function tests — Phase D is the precondition for ever adding them cheaply.

4. **`HTTPException.detail` is overloaded.** It carries both "user-facing message" (string) and "machine-readable payload" (dict). The Phase C 429-body bug fix (`detail=str(e)` → `detail=e.args[0]`) was a workaround inside the wrong model. Domain exceptions carry typed payloads naturally — `BudgetExhaustedError.args[0]` is a dict because the class says so, not because `detail` got coerced.

5. **AI-native coding inverts the cost-benefit.** When migration was "expensive" (developer-hours measured in days per service), HTTPException-everywhere was defensible. When migration is cheap (agentic per-file mechanical translation), the architecturally correct pattern wins on every dimension.

The cost of staying with `HTTPException`-in-services compounds: every new service, every new background-task path, every future non-HTTP caller pays the layer tax. Phase D pays it once.

## 8. Phase E+ Inventory (Carry-forward)

Phase C's §8 listed six Phase D candidates. Phase D consumes the HTTPException one. The rest carry forward, plus three new items the Phase C review surfaced.

### Phase E candidates (dedicated phases each)

1. **Dependency injection.** Replace module-level singletons (`clients.client`, `clients.driver`, etc.) with injected dependencies. Originally B-deferred.
2. **Test improvements.** Address `docs/TECH_DEBT.md` TD-001 + add direct service-function unit tests (the Phase C N7 gap; Phase D unblocks the pattern).
3. **Security hardening.** Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87,94,104`), missing `LIMIT` on `/leads`, CORS off `*`, raw Cypher endpoint guard.
4. **Pagination convention.** Pick a project-wide approach to bounded queries.
5. **B4 small-pattern dedup audit.** JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.
6. **Startup code → FastAPI `lifespan`.** Migrate `clients.graph.refresh_schema()` (currently module-level) and `_ensure_market_scoring_indexes` (currently `@app.on_event("startup")`, deprecated) to a single `lifespan` context manager. Phase C review C2 tracks this.
7. **`create_index`-on-hot-path audit.** Confirmed sites: `leads.py:255-256` in `batch_upload_leads`. Likely more in `customer_profile.py`. Move each to startup (per the Phase C N3 pattern) or to a migration script. Phase C review Q4 tracks this.

### Phase F+ candidates

8. Anthropic SDK migration.
9. `tiktoken` for budget estimation.
10. Redis-backed Claude budget.
11. Inline prompts → `app/prompts/`.
12. Shared `memory` audit.
