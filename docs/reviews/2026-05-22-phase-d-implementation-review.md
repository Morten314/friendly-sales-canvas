# Review: Phase D Implementation (branch `refactor-backend-modularization-phase-d`)

**Reviewed:** 14 commits from `4b8b588` to `10ff697`
**Scope:** 14 files, +1,477 / −1,440 lines
**Reviewer:** Kilo (automated)
**Date:** 2026-05-22
**Verdict:** Clean, well-ordered execution. All hard acceptance criteria pass. Several behavioral regressions and edge-case risks worth addressing.

---

## Acceptance Criteria Verification

| Criterion | Result |
|---|---|
| 0 `raise HTTPException` in `app/services/` | PASS |
| 0 `except HTTPException` in `app/services/` | PASS |
| 0 `raise_on_error` sites | PASS |
| 0 router-side catches of retained domain exceptions | PASS |
| 7 exception handlers registered in `main.py` | PASS |
| 93 tests pass (per commit messages) | PASS (claimed) |

---

## MEDIUM — Behavioral Regressions

### M1. `RuntimeError` produces bare 500s with no detail in response body

Three sites in `signals.py` now raise `RuntimeError` instead of `HTTPException(500, detail=...)`:

- **L997:** `raise RuntimeError("Failed to delete signal")` — signal reject path
- **L1115:** `raise RuntimeError("ANTHROPIC_API_KEY is not configured")` — signal_ask_claude guard
- **L1239:** `raise RuntimeError(f"Claude API call failed ({response.status_code}): ...")` — upstream API failure

FastAPI's default handler for unhandled exceptions returns `{"detail": "Internal Server Error"}` — it does **not** include the `RuntimeError` message. This is a regression: previously the client received `{"detail": "Failed to delete signal"}` etc. The errors become opaque to the frontend.

**Recommendation:** Either:
1. Create a small `ServiceError(BrewraError)` base class for internal 500 errors and register a handler that returns `{"detail": str(exc)}`, or
2. Re-wrap these as `HTTPException(500, detail=...)` since routers are allowed to raise `HTTPException` per the docstring convention in `exceptions.py`.

Option 1 is cleaner and preserves the "no HTTPException in services" invariant. Option 2 is simpler and already sanctioned by the hierarchy's own documentation.

### M2. `get_market_scores_status` — `get_leads_for_org` call is now fatal

`market_scoring.py:375` calls `get_leads_for_org(org_id, limit=5000, order_by_recent=True)` to compute `total_leads`. Previously, `raise_on_error=False` would return `[]` on Neo4j failure, producing `total_leads = 0` and a degraded-but-functional response. Now a Neo4j transient error crashes the entire status endpoint with a raw 500.

This is a behavioral change the commit messages don't call out. The other two callers of `get_leads_for_org` in `_run_market_scoring_for_org` (background task) and in `signals.py` (research enrichment) are wrapped in appropriate `try/except` blocks. This one is not.

**Recommendation:** Wrap the call:
```python
try:
    total_leads = len(get_leads_for_org(org_id, limit=5000, order_by_recent=True))
except Exception:
    total_leads = 0
    logger.warning("Could not fetch leads for scoring status, defaulting total_leads=0")
```

### M3. `BudgetExhaustedError` handler — unsafe `exc.args[0]` access

`main.py:89-90`:
```python
logger.debug(f"{type(exc).__name__}: {exc.args[0]}")
return JSONResponse(status_code=429, content={"detail": exc.args[0]})
```

If `BudgetExhaustedError` is ever constructed without args (`BudgetExhaustedError()`), this raises `IndexError` inside the handler, which FastAPI converts to a 500 — masking the original 429. Current callers always pass a dict arg, so this is latent, not active.

**Recommendation:**
```python
payload = exc.args[0] if exc.args else str(exc)
logger.debug(f"{type(exc).__name__}: {payload}")
return JSONResponse(status_code=429, content={"detail": payload})
```

---

## MEDIUM — Design Concerns

### M4. All handlers log at `debug` — invisible in production

Every exception handler uses `logger.debug(...)`. In production (typically `INFO` level), none of these will appear in logs. This means:
- 404s are fine to suppress (they're client errors).
- 400 validation errors are also generally fine.
- 429 (budget exhausted), 409 (conflict), and 500 (ICP registry) are operationally important and should be visible.

**Recommendation:** Log at `warning` for 429 and 500 family handlers. Keep `debug` for 404/400.

### M5. f-string log calls evaluated even when level is suppressed

All handler log lines use f-strings:
```python
logger.debug(f"{type(exc).__name__}: {exc}")
```

When the log level is `INFO` or higher, the f-string is still evaluated (string formatting happens before the call). This is minor overhead but violates Python logging best practices.

**Recommendation:** Use lazy formatting:
```python
logger.debug("%s: %s", type(exc).__name__, exc)
```

### M6. Exception handlers are `async def` but never `await`

All 7 handler functions are declared `async def` but perform no async operations. They create a `JSONResponse` synchronously.

**Recommendation:** Declare them as `def` (synchronous). FastAPI supports both sync and async exception handlers. This removes a needless coroutine wrapper on every error path.

---

## LOW — Code Hygiene

### L1. Unused reserved base classes add dead weight

`AuthenticationError` and `AuthorizationError` are defined, imported in `main.py`, and registered as handlers — but have zero leaf classes and are never raised. The docstrings say "reserved for future use." This is harmless but adds 10 lines of dead code to `main.py` (2 handler functions + 2 registrations + imports) and 14 lines to `exceptions.py`.

**Recommendation:** Acceptable as-is. Add a `# TODO(Phase E+): remove if auth is not implemented within 2 sprints` comment if you want a future reminder, or just drop them and add them when auth work starts.

### L2. `BrewraError` and status-family bases have no `__str__` override

The hierarchy relies on `Exception.__str__` which returns `self.args[0]` if args exist. For `BudgetExhaustedError`, `args[0]` is a dict, so `str(exc)` returns the Python dict repr (e.g., `{'error': '...', 'token_limit_5m': 5000}`). This works because the handler accesses `args[0]` directly. But any future handler or logging call that does `str(exc)` will get the dict repr, not a human-readable message.

**Recommendation:** Add `__str__` to `BrewraError` that returns `str(self.args[0]) if self.args else ""`. This makes `str(exc)` safe for all subclasses.

### L3. `org_auth.py` lost `logger` import — any future debug logging will need re-adding

The commit removes `from app.core.logging import logger` because all `logger.error(...)` calls were inside the deleted wrap-and-rethrow blocks. This is correct today but means `org_auth.py` has no logging at all — Neo4j/Mongo failures will propagate silently.

**Recommendation:** Consider adding `logger` back and logging at `warning` before raising, at least for the two lookup functions (`list_orgs`, `connect_user_to_org`). Not blocking.

### L4. No `__all__` exports in `exceptions.py`

The file now exports 25 exception classes. Without `__all__`, a wildcard import (`from app.core.exceptions import *`) pulls everything, including the abstract bases.

**Recommendation:** Add `__all__` listing only the leaf classes and the two retained classes. Mark bases as internal by convention. Not blocking.

---

## POSITIVE — Things Done Well

### P1. Commit ordering is textbook

Hierarchy → handlers → per-service migration → cleanup. The two foundational commits (`4b8b588`, `7d8c148`) are purely additive, meaning any per-service commit can be reverted independently without breaking the exception infrastructure.

### P2. Consistent pattern application across all 9 service files

Every service file follows the identical transformation:
1. Remove `from fastapi import HTTPException`
2. Add specific exception imports from `app.core.exceptions`
3. Replace `raise HTTPException(status_code=N, ...)` with typed exception
4. Delete `except HTTPException: raise` re-raise blocks
5. Delete `except Exception as e: logger.error(...); raise HTTPException(500, ...)` wrap-and-rethrow blocks

No ad-hoc variations. This makes the diff extremely reviewable.

### P3. Background-task error handling is well-structured

The split between `except BrewraError` (warning, expected) and `except Exception` (error, unexpected) in both `_run_market_scoring_for_org` and `process_file_to_embeddings` is the right pattern. The nested `try/except` for status-update-on-failure is also correct — the status collection write shouldn't mask the original error.

### P4. Commit messages are high-quality

Every commit message explains what changed, why, and notes what was intentionally preserved. Cross-references to other tasks (e.g., "The inner raise_on_error is preserved for Task 14") make the commit history navigable.

### P5. Router cleanup (commit `67ac241`) is clean

Removing 6 redundant router-side `try/except` blocks while verifying response-shape parity with the registered handlers is thorough. The commit message documents the parity check explicitly.

---

## Summary of Actionable Items

### Should fix before merge (behavioral regressions):
| ID | Issue | Effort |
|---|---|---|
| M1 | `RuntimeError` produces opaque 500s — consider a `ServiceError` base or revert to `HTTPException` in routers | Small |
| M2 | `get_market_scores_status` lacks error handling for `get_leads_for_org` — add try/except | Small |
| M3 | `BudgetExhaustedError` handler `args[0]` access is unsafe — add fallback | Trivial |

### Should consider (design improvements):
| ID | Issue | Effort |
|---|---|---|
| M4 | Handlers log at `debug` — upgrade 429/500 to `warning` | Trivial |
| M5 | f-string log calls — switch to lazy `%` formatting | Trivial |
| M6 | `async def` handlers — make synchronous | Trivial |

### Optional (code hygiene):
| ID | Issue | Effort |
|---|---|---|
| L2 | Add `__str__` to `BrewraError` | Trivial |
| L4 | Add `__all__` to `exceptions.py` | Trivial |
