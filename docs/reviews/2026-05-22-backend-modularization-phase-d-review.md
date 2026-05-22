# Review: Backend Modularization Phase D — HTTPException → Domain-Exception Migration

**Reviewed spec:** `specs/2026-05-22-backend-modularization-phase-d-design.md`
**Reviewer:** Kilo (automated)
**Date:** 2026-05-22
**Verdict:** Solid spec, few corrections needed, several actionable improvements

---

## 1. Factual Accuracy Checks

### Verified correct

| Claim | Actual | Status |
|---|---|---|
| ~77 `raise HTTPException` in `app/services/` | Exactly 77 | Correct |
| ~20 `except HTTPException` re-raise sites | Exactly 20 | Correct |
| 9 service files to migrate | 9 files import `HTTPException` | Correct |
| 6 router-side catches of domain exceptions | Exactly 6 | Correct |
| `raise_on_error` used in `market_scoring.py` | 2 call sites at lines 369, 644 | Correct |

### Corrections needed

| Claim | Actual | Issue |
|---|---|---|
| "All 93 existing tests pass" | 89 test functions across `tests/` | Test count is off by 4. Re-run `pytest --co -q` on a clean environment to confirm baseline before migration starts. Acceptance criterion 6 should use the verified count. |
| "~30 `except Exception as e: raise HTTPException(500, ...)` wrap-and-rethrow sites" | 34 such sites (32 of the 33 total `status_code=500` raises sit inside `except Exception as e:` blocks) | Close but undercount. Spec should say "~34" or rephrase as "all catch-all 500 wrappers." |
| §3.4 only shows `market_scoring.py` as `raise_on_error` caller | `signals.py` also calls `get_leads_for_org(..., raise_on_error=False)` at lines 590 and 730 | §2.1 item 7 ("update callers") implicitly covers this, but §3.4's code example and §4.2 commit 14 should explicitly name both `market_scoring.py` and `signals.py`. Missing the signals callers risks leaving dead code after the parameter is removed. |

---

## 2. Structural Issues

### 2.1 Missing background task: `process_file_to_embeddings`

§2.1 item 8 and §3.4 only discuss `_run_market_scoring_for_org`. But `documents.py:160` defines `process_file_to_embeddings`, also dispatched via `BackgroundTasks.add_task` at `documents.py:505`. This function already has its own internal `try/except` structure, so it may not need the same `BrewraError` catch pattern — but the spec should either:

- **Acknowledge it explicitly in-scope** (add a `catch BrewraError` at the outer level), or
- **Document it as a deliberate exclusion** with reasoning (e.g., "its error handling is self-contained and doesn't call other service functions that raise domain exceptions").

Silent omission is the risk — a reader could reasonably assume §3.4 is exhaustive.

### 2.2 Missing 401 Unauthorized in the hierarchy

The exception hierarchy in §3.1 includes `AuthorizationError → 403` but has no `401 Unauthorized` base. While no service currently raises 401 (the backend doesn't validate JWTs — see AGENTS.md "Auth reality check"), `org_auth.py` has 7 raises that include 400 and 404 cases for missing users/orgs. If authentication is ever added at the service layer (the spec hints at this in §8 Phase E "Security hardening"), a 401 base would be needed.

**Recommendation:** Either add `AuthenticationError(BrewraError) → 401` to the hierarchy now (it costs nothing and prevents a hierarchy modification later), or add an explicit note: "401 is excluded because the backend does not perform authentication; if that changes, add `AuthenticationError` at that time."

### 2.3 `AuthorizationError` and `ConflictError` are speculative

The hierarchy proposes 4 status-family bases, but current usage is:

| Base | Current service raises |
|---|---|
| `NotFoundError → 404` | 17 raises |
| `ValidationError → 400` | 6 raises |
| `ConflictError → 409` | **1 raise** (customer_profile.py:331) |
| `AuthorizationError → 403` | **0 raises** |

`AuthorizationError` has zero current usage. `ConflictError` has exactly one leaf (`ICPAlreadyExistsError` / `This suggested ICP is already saved`). Spec §3.1 says "leaves as discovered" for both, implying they're forward-looking.

**Recommendation:** This is fine as-is — the bases are cheap to define and registering a handler with zero raises is harmless. But the spec should be explicit about which bases are speculative vs. derived from discovery. A short annotation ("*0 current raises — added for anticipated §8 security work*") would prevent a reviewer from hunting for missing 403 sites during discovery.

### 2.4 Leaf-class count estimate is high

§2.1 says "~25-30 leaf classes." Given that 32 of the 33 `status_code=500` raises are catch-all rethrows (deleted, not mapped), the actual mapping surface is:

- 404: ~10-12 distinct resource types
- 400: ~3-4 validation patterns
- 409: 1 (ICP already saved)
- BudgetExhaustedError: retained
- ICPIdRegistryError: retained

Realistic total: **~17-20 leaves.** The "~25-30" estimate inflates expectations and could cause unnecessary scope anxiety. Adjust to "~15-20, finalized by §4 discovery."

### 2.5 Out-of-scope section doesn't mention the 6 clean service files

15 service files exist in `app/services/`. 9 import `HTTPException` and need migration. The remaining 6 (`graph_chat.py`, `_retrieval.py`, `_llm_helpers.py`, `_claude_budget.py`, `pipeline.py`, `__init__.py`) have zero raises. §4.3 doesn't list them, and §2.2 doesn't call them out.

**Recommendation:** Add a line to §2.2: "The following service files contain zero `raise HTTPException` sites and require no changes: `graph_chat.py`, `_retrieval.py`, `_llm_helpers.py`, `_claude_budget.py`, `pipeline.py`." This makes the scope audit trail explicit.

---

## 3. Design Suggestions

### 3.1 Make `BrewraError` abstract-enforceable

§3.1 says the status-family bases are "abstract — services raise leaves, not bases." This is convention-only. Python won't prevent `raise NotFoundError("something")`. Consider making the bases abstract:

```python
class BrewraError(Exception):
    """Base for all Brewra domain exceptions. Never raised directly."""
    _status_code: int  # subclasses must set

class _StatusFamilyBase(BrewraError):
    """Intermediate base — not meant to be raised directly."""
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if not hasattr(cls, '_status_code') and cls.__name__ not in (
            'NotFoundError', 'ValidationError', 'ConflictError', 'AuthorizationError',
        ):
            pass  # leaf class, OK
```

Or simpler: just document the convention. The overhead of ABC enforcement may not be worth it for 15-20 leaf classes in an MVP codebase. The spec should at least acknowledge the choice — "bases are abstract by convention, not enforced by ABC, to keep the hierarchy simple."

### 3.2 Exception handler should log

§3.2 registers handlers that return `JSONResponse` but don't log. §5.1 correctly identifies that 500-detail leakage stops (good) and that the debug surface shrinks. But the handlers are the natural place to add a single structured log line per caught exception:

```python
@app.exception_handler(NotFoundError)
async def _handle_not_found(request, exc):
    logger.info(f"{type(exc).__name__}: {exc}")  # or debug level
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

Without this, 404s from domain exceptions become invisible in server logs unless the service itself logged before raising. The spec's §5.1 mitigation says "ensure all services log the underlying exception before any conversion" — but that puts the burden on every service. A handler-level log is a single point of guarantee.

**Recommendation:** Add `logger.debug(...)` or `logger.info(...)` to each handler. This is explicitly *not* Sentry/structured logging integration (which the spec correctly defers), just a basic observability floor.

### 3.3 Consider a `to_dict()` method on `BrewraError`

The current design relies on `str(exc)` for the `detail` field. `BudgetExhaustedError` already breaks this by using `exc.args[0]` (a dict). As the hierarchy grows, other exceptions may need structured payloads (e.g., validation errors with field-level details). A `to_dict()` method on the base class gives a clean extension point:

```python
class BrewraError(Exception):
    def to_dict(self) -> dict:
        return {"detail": str(self)}
```

Subclasses override as needed. Handlers call `exc.to_dict()` instead of `{"detail": str(exc)}`. This costs 3 lines now and prevents a scatter of handler hacks later.

### 3.4 Response shape contract

§6 soft criterion 8 says "HTTP response shape unchanged." This is critical but unstructured. Consider defining the canonical error response shape once in the spec:

```
All domain-exception HTTP responses are JSON:
{"detail": <string or dict>}
```

And explicitly noting that this matches FastAPI's default `HTTPException` shape, so no frontend changes are needed. This answers the question before a reviewer asks it.

### 3.5 Commit 12 scope is underspecified

§4.2 commit 12 says "Delete router-side catches of retained domain exceptions (6 sites across signals/market_research/icp)." But those router-side catches currently do translation work:

```python
except BudgetExhaustedError as e:
    raise HTTPException(status_code=429, detail=e.args[0])
```

The registered handler now does this translation. The commit should also verify that the response shape is identical (especially for `BudgetExhaustedError` where `detail` is a dict, not a string). A quick note in the commit description would help future readers understand *why* the deletion is safe.

---

## 4. Missing Considerations

### 4.1 What happens to `HTTPException` raises in routers?

The spec focuses on services but routers also raise `HTTPException` directly (12 sites in `app/routers/`). §1 says "routers may still raise `HTTPException` for transport-only concerns" — this is correct and the right boundary. But the acceptance criteria (§6) only grep `app/services/`. Consider adding a soft criterion: "No new `raise HTTPException` added to `app/services/` — routers remain unchanged." This prevents scope creep during review.

### 4.2 Import path changes

The spec mentions removing `from fastapi import HTTPException` from each migrated service. It doesn't mention the replacement import pattern. Each service file will need something like:

```python
from app.core.exceptions import LeadNotFoundError, ValidationError, ...
```

For services with many raises (e.g., `leads.py` with 13, `signals.py` with 12), the import line could be long. Consider recommending a per-service import style (individual imports vs. namespace import) in the spec. Individual imports are the Python convention and make it easy to grep for usage.

### 4.3 Interaction with `process_file_to_embeddings`'s existing error handling

`documents.py:process_file_to_embeddings` (line 160+) has deep internal `try/except` blocks with `logger.error` calls. If Phase D migrates the 10 `HTTPException` raises in `documents.py` service functions, but `process_file_to_embeddings` doesn't raise any of them (it's self-contained), then this is a non-issue. But the spec should confirm this — a quick note in §2.1 item 8 or §2.2 would suffice.

### 4.4 No mention of how the discovery pass outputs its results

§4.1 says the discovery pass produces "the finalized leaf class list" that "goes into the first hierarchy commit." But the output artifact isn't specified. Is it a comment in `exceptions.py`? A separate file? A section in the commit message? A brief note would help the implementer.

### 4.5 Hierarchy stability after migration

Once the hierarchy is committed (commit 1) and migration proceeds file-by-file (commits 3-11), what happens if discovery during migration of file 7 reveals a new status code or resource type not in the hierarchy? The spec says "finalized by §4 discovery" but doesn't describe the amendment process. Options:

- **Amend commit 1** (rebase — possible since not pushed).
- **Add a supplementary commit** after commit 1 but before the file that needs it.

A one-line guidance ("if discovery during migration reveals a missing class, add it in a commit before the file that needs it, amending the hierarchy") would prevent ambiguity.

---

## 5. Minor Nits

1. **§4.2 table numbering:** Commits 3-11 are merged into one row. The total "14-16 commits" in the paragraph below doesn't match (1 + 1 + 9 + 1 + 1 + 1 + 1 = 15). The range should be "15 commits" or "14-15" if the final sweep sometimes merges with commit 14.

2. **§4.3 ordering rationale:** "easier files first" is good, but `org_auth.py` (7 raises, all straightforward 400/404/500) is indeed the best starter. `market_scoring.py` (3 raises but entangled with background tasks) is correctly last. The ordering is sound.

3. **§5.3 log volume increase:** This is a valid risk to flag. Worth noting that the volume increase is *correct* behavior — silent failures are bugs, not features.

4. **§7 point 5 ("AI-native coding inverts the cost-benefit"):** This is the strongest argument in the spec and should be emphasized more. The entire migration is mechanically translatable by an agent — the cost is near-zero, the benefit compounds forever.

5. **Typographical:** §3.1 tree shows `AuthorizationError` with no leaves and `… (leaves as discovered)` — but §2.1 says there are no 403 raises. The ellipsis is misleading; consider "no current leaves" instead.

---

## 6. Summary of Recommendations

**Must-fix (factual):**
- Correct test count (89, not 93) and verify baseline before migration.
- Count catch-all rethrows as 34, not ~30.
- Acknowledge `signals.py` as a `raise_on_error` caller in §3.4 and commit 14 scope.

**Should-fix (scope completeness):**
- Address `process_file_to_embeddings` background task — either in-scope or explicitly excluded.
- Note the 6 clean service files as out-of-scope in §2.2.
- Add `AuthenticationError → 401` to hierarchy or document its exclusion.

**Nice-to-have (design quality):**
- Add `logger.debug` to exception handlers (§3.2).
- Define canonical error response shape explicitly.
- Add `to_dict()` method on `BrewraError`.
- Specify discovery pass output artifact.
- Add hierarchy amendment process for mid-migration discoveries.
- Annotate speculative bases (ConflictError, AuthorizationError) with current usage counts.
