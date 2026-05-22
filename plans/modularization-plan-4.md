# Backend Modularization Phase D — HTTPException → Domain-Exception Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `/specs/2026-05-22-backend-modularization-phase-d-design.md` (commit `5244d85`).

**Goal:** Migrate ~77 `raise HTTPException` sites in `app/services/` to a typed domain-exception hierarchy with FastAPI-registered handlers. Delete the related `try/except` boilerplate and the Phase C `raise_on_error` workaround. After Phase D, no service file imports or raises `HTTPException`.

**Architecture:** Add a 7-class status-family hierarchy under `BrewraError` in `app/core/exceptions.py`. Register 7 FastAPI exception handlers in `app/main.py` that map each base type to its HTTP response (with `logger.debug` for observability). Migrate one service file per commit, replacing raises with typed exceptions and deleting redundant try/except wrappers. Clean up router catches, the `raise_on_error` flag, and background-task error handling.

**Tech Stack:** FastAPI, Pydantic V2, pytest with syrupy snapshots, Python's standard exception MRO. All work on the `refactor-backend-modularization-phase-d` branch off `master`.

**Working directory:** `pytest` commands run from `/projects/Brewra/brewra-gtm-intelligence/backend`. Git commands run from monorepo root `/projects/Brewra/brewra-gtm-intelligence/`.

**Commit policy:** Per monorepo `CLAUDE.md` — small, frequent commits, no `Co-Authored-By: Claude` footer. Message prefixes: `refactor(be):` for structural moves, `chore(be):` for hygiene.

**Expected total:** 15 commits across 17 tasks (Tasks 1 and 17 don't commit — discovery prep and final acceptance verification).

---

## Pre-flight

- [ ] **Step 1: Create the branch from master**

```bash
git checkout master && git checkout -b refactor-backend-modularization-phase-d
```

- [ ] **Step 2: Verify clean tree and capture baseline tests**

```bash
git status --short
```
Expected: empty (clean tree).

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest 2>&1 | tail -3
```
Expected at plan-writing time: `93 passed, 11 warnings`. **Capture the actual count from your run** — this becomes the baseline. Throughout this plan, "93 passed" refers to this baseline; if your number differs, substitute it everywhere. The validation logic is "tests still pass and count unchanged," not the literal number 93.

If `pytest` is not found, the backend virtualenv is not active. Activate it before continuing (`source <venv-path>/bin/activate` or equivalent for the project's setup).

- [ ] **Step 3: Verify Phase C is complete (defensive)**

This plan assumes Phase C's post-state. Verify:

```bash
cat backend/app/core/exceptions.py
```
Expected: a 2-class file with `BudgetExhaustedError(Exception)` and `ICPIdRegistryError(Exception)` plus the post-Phase-C module docstring. If the file already contains `BrewraError`, `NotFoundError`, etc., Phase D has been partially started — stop and verify state before proceeding.

```bash
cd backend && grep -rn "raise_on_error" app/services/
```
Expected: hits in `leads.py` (function definition + body, ~3 lines), `market_scoring.py` (2 call sites), `signals.py` (2 call sites). If `raise_on_error` doesn't exist, Phase C wasn't applied — stop.

---

## Task 1: Discovery pass (inventory raises and design leaf classes)

**Goal:** Produce the leaf-class inventory that Task 2 commits into the hierarchy. **No commit in this task** — output is consumed by Task 2.

**Files:** Read-only inspection of `app/services/*.py`.

- [ ] **Step 1: Enumerate every `raise HTTPException` in `app/services/`**

```bash
cd backend && grep -rn "raise HTTPException" app/services/
```
Expected: 77 hits across 9 files (`customer_profile.py`, `documents.py`, `icp.py`, `leads.py`, `market_research.py`, `market_scoring.py`, `org_auth.py`, `profiles.py`, `signals.py`).

- [ ] **Step 2: For each hit, extract: status code + resource type + intent message**

Read each raise in context. Group into a table like:

```
File                     | Line | Status | Resource          | Suggested leaf class
-------------------------|------|--------|-------------------|-----------------------------
leads.py                 |  42  |  404   | Lead              | LeadNotFoundError
leads.py                 |  56  |  404   | Lead              | LeadNotFoundError
leads.py                 |  89  |  400   | Lead/upload-format| LeadValidationError
icp.py                   |  33  |  404   | ICP               | ICPNotFoundError
... (all 77 sites)
```

- [ ] **Step 3: Identify the `except Exception as e: raise HTTPException(500, ...)` wrappers**

```bash
cd backend && grep -B1 -A3 "except Exception as e:" app/services/ | grep -A2 "raise HTTPException" | head -50
```
Mark each as a "wrap-and-rethrow site to be deleted." Expected count: ~34. Cross-reference against the 77 from Step 1 — these are inside larger try-blocks, so a single raise site may be one of the 77 AND inside a wrap-and-rethrow block.

- [ ] **Step 4: Identify the `except HTTPException: raise` re-raise sites**

```bash
cd backend && grep -B1 -A2 "except HTTPException:" app/services/ | grep -B1 "raise" | head -40
```
Mark each as a "re-raise boilerplate site to be deleted." Expected count: ~20.

- [ ] **Step 5: Audit `except Exception as e:` blocks for side effects (cleanup, status updates)**

Some `except Exception as e:` blocks do more than wrap-and-rethrow — they close connections, mark a run as failed in MongoDB, decrement counters, etc. Those side effects MUST be preserved during migration, even when the surrounding wrapper is deleted.

For each wrap-and-rethrow site found in Step 3, read the full except block. If it contains anything beyond `logger.<level>(...)` and `raise HTTPException(...)` — flag it as "SIDE-EFFECT BLOCK — preserve cleanup logic during migration." Examples to watch for:
- `mongo_client.close()` or `session.close()`
- `run_coll.update_one(... status: 'failed' ...)` (run-status updates)
- `cleanup_partial_state()` or similar
- Any database write before the raise

The per-service migration (Tasks 4-12) handles flagged blocks by keeping the body, replacing the raise, and removing the catch-and-rethrow boilerplate around it.

- [ ] **Step 6: Identify standalone 500 raises (not in wrap-and-rethrow blocks)**

Most `status_code=500` raises are inside wrap-and-rethrow blocks (caught by Step 3). But some are standalone — e.g., configuration checks like `raise HTTPException(500, "ANTHROPIC_API_KEY is not configured")` at `signals.py:1137`. These won't be deleted by the wrap-and-rethrow pattern; they need a typed leaf class.

```bash
cd backend && grep -B5 "raise HTTPException(.*status_code=500\|raise HTTPException(500" app/services/ | grep -v "except Exception"
```

For each standalone 500 raise, decide the leaf class:
- Configuration / missing dependency → `ConfigurationError(BrewraError)` (add to hierarchy in Task 2; maps to 500)
- Anything else → judge case-by-case; if it's truly catch-all "something went wrong server-side," consider whether it should propagate to FastAPI's default 500 instead of having a typed exception.

Add any new leaf class to the Task 1 inventory and the Task 2 hierarchy.

- [ ] **Step 7: Consolidate leaf classes**

From Step 2, collapse the per-line list into the unique leaf classes needed. Resource types that have just one raise (e.g., `RunNotFoundError` if only one site needs it) still get their own class — per-resource granularity is the spec convention.

Expected output: ~15-20 unique leaf classes across the status families. Compare to the spec §3.1 examples — your list should be a superset of the named leaves (`LeadNotFoundError`, `ICPNotFoundError`, etc.) and may include additional resource types the spec didn't enumerate.

- [ ] **Step 8: Persist the inventory to `/tmp/phase-d-leaf-inventory.txt`**

Write the full inventory + the Step 5 side-effect-block list + the Step 6 standalone-500 list to a durable file that subsequent tasks (especially Task 2 and the per-service migrations) can read back. This protects against context resets between subagent dispatches.

Use the Write tool, not Bash heredoc:

```
Target path: /tmp/phase-d-leaf-inventory.txt

Content format:

# Phase D leaf-class inventory (discovery YYYY-MM-DD):

## 404 NotFoundError (N raises across M files):
  - LeadNotFoundError                  : leads.py:42,56,142; market_scoring.py:...
  - ICPNotFoundError                   : icp.py:33,67,...
  - DocumentNotFoundError              : documents.py:...
  ...

## 400 ValidationError (N raises):
  - LeadValidationError                : leads.py:89
  ...

## 409 ConflictError (1 raise):
  - ICPAlreadyExistsError              : customer_profile.py:331

## 500 ConfigurationError (N raises, if any standalone 500s identified in Step 6):
  - <leaf class>                       : <file>:<line>
  ...

## 401 AuthenticationError: 0 (reserved for future JWT auth)
## 403 AuthorizationError: 0 (reserved for future use)
## 429 BudgetExhaustedError (retained)
## 500 ICPIdRegistryError (retained)

# Side-effect-bearing except blocks (preserve cleanup during migration):
  - <file>:<line> — <description of side effect>
  ...

# Standalone 500 raises (not in wrap-and-rethrow):
  - <file>:<line> — <reason>
  ...
```

This file is the source of truth for Tasks 2-12. Task 2 also copies the leaf-class summary into the `app/core/exceptions.py` header comment and the commit message body.

---

## Task 2: Add typed exception hierarchy

**Files:**
- Modify: `app/core/exceptions.py` (current state: 16 lines, `BudgetExhaustedError` + `ICPIdRegistryError` direct-children of `Exception`)

**Context:** This task replaces `exceptions.py` with the full hierarchy from Task 1's inventory. The two retained classes reparent from `Exception` to `BrewraError`. Nothing yet raises the new classes — that happens in Tasks 4-12. Behavior unchanged at the end of this commit.

- [ ] **Step 1: Read the current `app/core/exceptions.py`**

```bash
cat backend/app/core/exceptions.py
```

Confirm the current state is the post-Phase-C version (10-line docstring describing the convention, two classes inheriting directly from `Exception`).

- [ ] **Step 2: Write the new `exceptions.py`**

Replace file contents with:

```python
"""Domain exception hierarchy.

Service-layer functions raise these. A FastAPI exception handler in
app/main.py maps each base class to its HTTP response. Routers MAY still
raise HTTPException directly for transport-only concerns; the rule is
crisp: services raise BrewraError subclasses, routers may raise either.

Phase D leaf-class inventory (discovery 2026-05-22):
# [paste the inventory comment block from Task 1 Step 6]
"""


class BrewraError(Exception):
    """Base for all Brewra domain exceptions. Never raised directly."""


# ─── Status-family bases (abstract by convention, not enforced by ABC) ───

class NotFoundError(BrewraError):
    """→ HTTP 404. Resource exists in the domain model but not in storage."""


class ValidationError(BrewraError):
    """→ HTTP 400. Input fails domain validation rules."""


class ConflictError(BrewraError):
    """→ HTTP 409. Operation conflicts with current resource state."""


class AuthenticationError(BrewraError):
    """→ HTTP 401. Caller's identity could not be verified.
    No leaves today — reserved for future JWT auth."""


class AuthorizationError(BrewraError):
    """→ HTTP 403. Caller's identity is verified but lacks permission.
    No leaves today — reserved for future use."""


# ─── 404 NotFoundError leaves ───
# Populate every leaf identified in /tmp/phase-d-leaf-inventory.txt's
# "404 NotFoundError" section. Each is one line, e.g.:
class LeadNotFoundError(NotFoundError):
    """Lead not found in Neo4j."""

# Add the remaining NotFoundError leaves here, one class per resource type.


# ─── 400 ValidationError leaves ───
# Populate every leaf identified in /tmp/phase-d-leaf-inventory.txt's
# "400 ValidationError" section.


# ─── 409 ConflictError leaves ───

class ICPAlreadyExistsError(ConflictError):
    """ICP already saved for this org."""


# ─── 429: retained domain-specific ───

class BudgetExhaustedError(BrewraError):
    """Claude per-window token budget exhausted. Carries dict payload
    (error message + budget metadata) in args[0]. Routers map to HTTP 429."""


# ─── 500: retained domain-specific ───

class ICPIdRegistryError(BrewraError):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
```

**Important:** Before committing, replace the two "Populate every leaf..." comments with the actual leaf class definitions from `/tmp/phase-d-leaf-inventory.txt` (written in Task 1 Step 8). The committed file must contain **zero "Populate..." comments and zero `[bracketed]` placeholders** — the comments are guidance for the writer, not content for the file.

For each leaf, follow the `LeadNotFoundError` example shape — one-line docstring describing what's missing:
```python
class ICPNotFoundError(NotFoundError):
    """ICP not found."""
```

- [ ] **Step 3: Verify the file parses**

```bash
cd backend && python -c "from app.core.exceptions import BrewraError, NotFoundError, ValidationError, ConflictError, AuthenticationError, AuthorizationError, BudgetExhaustedError, ICPIdRegistryError; print('imports OK')"
```
Expected: `imports OK`

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`. Tests pass because nothing yet raises the new classes — only the two retained classes are referenced anywhere, and they still exist with the same names.

- [ ] **Step 5: Commit**

From monorepo root:
```bash
git add backend/app/core/exceptions.py
git commit -m "refactor(be): add typed domain-exception hierarchy under BrewraError

Adds NotFoundError, ValidationError, ConflictError, AuthenticationError,
AuthorizationError status-family bases under a new BrewraError root, plus
~15-20 per-resource leaf classes (see file header comment for the full
inventory). The two retained classes (BudgetExhaustedError,
ICPIdRegistryError) reparent from Exception to BrewraError.

Nothing yet raises the new leaf classes; that happens per-service in the
next 9 commits. This commit is purely additive — 93 tests pass unchanged.

Discovery inventory:
[paste the long-form leaf inventory from Task 1 Step 6 here]"
```

---

## Task 3: Register exception handlers in main.py

**Files:**
- Modify: `app/main.py` (current state: ~100 lines, has the Phase C `_ensure_market_scoring_indexes` startup hook at the bottom)

**Context:** Register 7 handlers (5 status-family + 2 retained). Each handler logs at debug level and returns a `JSONResponse` matching FastAPI's default `HTTPException` shape. Behavior unchanged for current callers — the existing services still raise `HTTPException`, which is handled by FastAPI's built-in handler. The new handlers don't activate until services start raising the typed classes (Tasks 4-12).

- [ ] **Step 1: Read `app/main.py` to identify the insertion point**

```bash
cat backend/app/main.py | head -40
```

Identify the section after `app = FastAPI()` and the CORS middleware block, before the `app.include_router(...)` calls. The handlers belong there so they're registered before any route handler.

- [ ] **Step 2: Add the imports**

In `app/main.py`, after the existing `from fastapi.middleware.cors import CORSMiddleware` import block, add:

```python
from fastapi.responses import JSONResponse
from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError,
    AuthenticationError,
    AuthorizationError,
    BudgetExhaustedError,
    ICPIdRegistryError,
)
```

- [ ] **Step 3: Add the 7 handler functions**

Place after the CORS middleware configuration block (where `app.add_middleware(CORSMiddleware, ...)` ends) and before the first `app.include_router(...)` call. (The `from app.routers import ...` lines are interleaved with `include_router()` calls in this file's existing style — place the handlers in that same code region.)

```python
# Phase D: domain-exception handlers. Map each BrewraError base to its HTTP
# response. Python's exception MRO makes subclass routing automatic —
# registering against NotFoundError catches every NotFoundError subclass.


@app.exception_handler(NotFoundError)
async def _handle_not_found(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
async def _handle_validation(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def _handle_conflict(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(AuthenticationError)
async def _handle_unauthorized(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(AuthorizationError)
async def _handle_forbidden(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(BudgetExhaustedError)
async def _handle_budget(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc.args[0]}")
    return JSONResponse(status_code=429, content={"detail": exc.args[0]})


@app.exception_handler(ICPIdRegistryError)
async def _handle_icp_registry(request, exc):
    logger.debug(f"{type(exc).__name__}: {exc}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

`logger` is already imported in `main.py` (re-exported from `app/core/logging.py`).

**Response-shape note:** The `BudgetExhaustedError` handler returns `{"detail": <dict>}` (the dict payload from `exc.args[0]`), while every other handler returns `{"detail": <string>}`. This asymmetry is intentional — it matches the response shape Phase C's router catches produced, and the frontend already consumes both forms. Do not "fix" the inconsistency by stringifying the budget dict.

- [ ] **Step 4: Verify handler count**

```bash
cd backend && grep -c "@app.exception_handler" app/main.py
```
Expected: `7`

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`. No tests exercise the new handlers yet — they're inactive until services raise the typed classes.

- [ ] **Step 6: Commit**

From monorepo root:
```bash
git add backend/app/main.py
git commit -m "refactor(be): register domain-exception handlers in main.py

Adds 7 @app.exception_handler registrations: 5 status-family bases
(NotFoundError, ValidationError, ConflictError, AuthenticationError,
AuthorizationError) plus the 2 retained domain-specific classes
(BudgetExhaustedError, ICPIdRegistryError). Each handler logs at debug
level and returns the canonical {'detail': <string-or-dict>} shape.

Handlers are inactive until services start raising the typed classes
(next 9 commits). 93 tests pass."
```

---

## Per-service migration shared pattern

Tasks 4-12 each migrate one service file in spec-prescribed order: `org_auth` → `profiles` → `customer_profile` → `documents` → `signals` → `market_research` → `icp` → `leads` → `market_scoring`. The pattern below applies to every per-service task; each task below repeats the steps with its own substitutions so the task is self-contained.

**For each raise, transform:**
```python
# Before
raise HTTPException(status_code=404, detail=f"Lead {lead_id} not found")
# After
raise LeadNotFoundError(f"Lead {lead_id} not found")
```

**For each `except HTTPException: raise` re-raise block, delete the block.** Typed exceptions don't match `except HTTPException:` — the re-raise is dead.

**For each `except Exception as e: raise HTTPException(500, ...)` wrap-and-rethrow block, transform:**
```python
# Before
try:
    result = do_work()
except HTTPException:
    raise
except Exception as e:
    logger.error(f"Failed to do work: {e}")
    raise HTTPException(status_code=500, detail=f"Failed to do work: {e}")
# After
result = do_work()
```
If retaining the log line is valuable (e.g., the inner code doesn't log on its own), use:
```python
try:
    result = do_work()
except Exception as e:
    logger.error(f"Failed to do work: {e}")
    raise
```

**Cross-service transition safety:** During Tasks 4-12, already-migrated services call yet-to-be-migrated services. This is safe by construction because:

1. The hierarchy and handlers are in place (Tasks 2-3) before any per-service migration begins.
2. Each migration only changes what the service *raises*, not what it *catches* from other services.
3. `HTTPException` raised by unmigrated services is still caught by FastAPI's built-in handler.
4. Domain exceptions raised by migrated services are caught by the registered handlers from Task 3.

The migration order doesn't create cross-service breakage — don't worry about which file is called by which.

**Line-number drift:** All line numbers in Tasks 4-12 are approximate. Phase C changed line numbers; this plan was written from a point-in-time snapshot. Re-locate every raise by function name and surrounding context, not by line number alone.

**If no test file exists for a service:** Step 5 (targeted tests) of each per-service task runs `pytest tests/test_<service>.py`. If the test file doesn't exist for a given service, skip Step 5 and proceed to Step 6 (full suite). The full suite is the binding validation.

**Side-effect preservation:** Some `except Exception as e:` blocks do cleanup beyond logging+rethrowing (status updates, connection closing, etc.) — these were flagged in Task 1 Step 5. When migrating a file, check Task 1's `/tmp/phase-d-leaf-inventory.txt` for flagged blocks in that file. For each flagged block: keep the side-effect body, replace the raise with the typed exception, and remove only the catch-and-rethrow boilerplate. Do not delete the whole block.

---

### Task 4: Migrate `org_auth.py`

**Files:**
- Modify: `app/services/org_auth.py` (7 raise sites — smallest, deliberately first per spec §4.3 to build pattern fluency)

- [ ] **Step 1: Read the file end-to-end to understand raise-site contexts**

```bash
cat backend/app/services/org_auth.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

Apply the "Before/After" transform from the shared pattern to each of the 7 sites.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks**

Apply the deletion patterns from the shared pattern.

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` (only if HTTPException is no longer referenced in the file). Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_org_auth.py -v 2>&1 | tail -15
```
Expected: all `test_org_auth.py` tests pass.

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`.

```bash
grep -n "raise HTTPException\|except HTTPException" backend/app/services/org_auth.py
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/org_auth.py
git commit -m "refactor(be): migrate org_auth to typed domain exceptions

Replaces 7 raise HTTPException sites with typed exceptions from
app.core.exceptions. Removes redundant except HTTPException re-raise
and except Exception wrap-and-rethrow blocks. 93 tests pass."
```

---

### Task 5: Migrate `profiles.py`

**Files:**
- Modify: `app/services/profiles.py` (10 raise sites)

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/profiles.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

Apply the "Before/After" transform from the shared pattern to each of the 10 sites.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks**

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_profiles.py -v 2>&1 | tail -15
```
Expected: all pass.

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/profiles.py
```
Expected: `93 passed`; grep empty.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/profiles.py
git commit -m "refactor(be): migrate profiles to typed domain exceptions

Replaces 10 raise HTTPException sites with typed exceptions from
app.core.exceptions. Removes redundant except-blocks. 93 tests pass."
```

---

### Task 6: Migrate `customer_profile.py`

**Files:**
- Modify: `app/services/customer_profile.py` (9 raise sites, including the only 409 → `ICPAlreadyExistsError` at line ~331)

**Special note:** This file contains the codebase's only `ConflictError` raise. The line near 331 (`detail="This suggested ICP is already saved"` or similar) maps to `ICPAlreadyExistsError`, which was added in Task 2. Verify it's in the hierarchy before this migration starts.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/customer_profile.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

9 sites. The "already saved" raise → `ICPAlreadyExistsError`. The rest map to `NotFoundError`/`ValidationError` family leaves per the inventory.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks**

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`, including `ICPAlreadyExistsError`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_customer_profile.py tests/test_icp.py -v 2>&1 | tail -15
```
Expected: all pass. (`test_icp.py` exercises some `customer_profile` paths.)

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/customer_profile.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/customer_profile.py
git commit -m "refactor(be): migrate customer_profile to typed domain exceptions

Replaces 9 raise HTTPException sites with typed exceptions from
app.core.exceptions, including the codebase's only ConflictError leaf
(ICPAlreadyExistsError). Removes redundant except-blocks. 93 tests pass."
```

---

### Task 7: Migrate `documents.py`

**Files:**
- Modify: `app/services/documents.py` (10 raise sites)

**Special note:** This file imports `from fastapi import BackgroundTasks, HTTPException` because `process_file_to_embeddings` uses `BackgroundTasks`. **Preserve `BackgroundTasks`** in the import; remove only `HTTPException`. The `process_file_to_embeddings` background-task error handling itself is revisited in Task 15.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/documents.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks** — but be careful around `process_file_to_embeddings`'s internal error handling; if a wrap exists there, leave it for Task 15.

- [ ] **Step 4: Update imports**

Change `from fastapi import BackgroundTasks, HTTPException` to `from fastapi import BackgroundTasks`. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_documents.py -v 2>&1 | tail -15
```

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/documents.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/documents.py
git commit -m "refactor(be): migrate documents to typed domain exceptions

Replaces 10 raise HTTPException sites with typed exceptions from
app.core.exceptions. Preserves BackgroundTasks import for the embedding
pipeline (revisited in Task 15 for outer error handling). 93 tests pass."
```

---

### Task 8: Migrate `signals.py`

**Files:**
- Modify: `app/services/signals.py` (12 raise sites)

**Special note:** This file calls `get_leads_for_org(..., raise_on_error=False)` at lines 590 and 730. **Leave those 2 lines unchanged in this task** — Task 14 removes the `raise_on_error` parameter and updates these call sites.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/signals.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

12 sites. Do not touch the `get_leads_for_org(..., raise_on_error=False)` call sites — those are caller-side and stay as-is until Task 14.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks**

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_signals.py -v 2>&1 | tail -15
```

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/signals.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/signals.py
git commit -m "refactor(be): migrate signals to typed domain exceptions

Replaces 12 raise HTTPException sites with typed exceptions from
app.core.exceptions. Removes redundant except-blocks. The two
get_leads_for_org(..., raise_on_error=False) call sites at lines 590,
730 are intentionally left for Task 14. 93 tests pass."
```

---

### Task 9: Migrate `market_research.py`

**Files:**
- Modify: `app/services/market_research.py` (3 raise sites)

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/market_research.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class identified in Task 1's inventory**

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks**

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_market_research.py -v 2>&1 | tail -15
```

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/market_research.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/market_research.py
git commit -m "refactor(be): migrate market_research to typed domain exceptions

Replaces 3 raise HTTPException sites with typed exceptions from
app.core.exceptions. 93 tests pass."
```

---

### Task 10: Migrate `icp.py`

**Files:**
- Modify: `app/services/icp.py` (10 raise sites)

**Special note:** This file raises `ICPIdRegistryError` internally at the ICP id reservation site. That class is one of the two retained domain-specific exceptions (now a `BrewraError` subclass after Task 2). **Preserve that raise** — only migrate the `HTTPException` raises.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/icp.py
```

- [ ] **Step 2: Replace each `HTTPException` raise with the typed leaf class identified in Task 1's inventory**

Skip the `raise ICPIdRegistryError(...)` site — it stays as-is.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks** — but preserve any `except ICPIdRegistryError:` block that wraps cleanup logic (those are intentional, not boilerplate).

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_icp.py -v 2>&1 | tail -15
```

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/icp.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/icp.py
git commit -m "refactor(be): migrate icp to typed domain exceptions

Replaces 10 raise HTTPException sites with typed exceptions from
app.core.exceptions. Preserves the ICPIdRegistryError raise at the
id-reservation site (one of the two retained domain-specific classes).
93 tests pass."
```

---

### Task 11: Migrate `leads.py`

**Files:**
- Modify: `app/services/leads.py` (13 raise sites — largest file)

**Special note:** This file defines `get_leads_for_org` with the `raise_on_error=True` parameter from Phase C. The function body contains an `if raise_on_error: raise HTTPException(...)` block. **Do not delete the `raise_on_error` parameter in this task** — Task 14 handles that. For this task, the inner `raise HTTPException(...)` inside the `if raise_on_error:` block should change to either (a) `raise <appropriate leaf class>(...)` if the original message maps cleanly, or (b) bare `raise` to let the underlying exception propagate. Use (b) if the underlying exception is already a typed domain exception (after this task migrates the other raises) or a 3rd-party driver error.

The cleanest pattern given Task 14's upcoming work:
```python
# Current (Phase C end-state):
try:
    ...
except Exception as e:
    if raise_on_error:
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")
    logger.warning(f"Could not fetch leads: {e}")
    return []

# After Task 11:
try:
    ...
except Exception as e:
    if raise_on_error:
        logger.error(f"Failed to fetch leads: {e}")
        raise
    logger.warning(f"Could not fetch leads: {e}")
    return []

# After Task 14 (preview, not done here):
# The entire if/else block becomes a bare raise, no parameter.
```

**Bare-raise semantics:** The bare `raise` in the `if raise_on_error:` branch propagates whatever `e` was caught — which could be a Neo4j driver exception (`neo4j.exceptions.ClientError`, etc.), a typed domain exception, or any unhandled error. Non-`BrewraError` exceptions propagate to FastAPI's default error handler, which returns HTTP 500. **This is correct.** Do NOT wrap Neo4j or other 3rd-party driver errors in a `BrewraError` subclass — the spec §2.2 explicitly defers third-party error mapping.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/leads.py
```

- [ ] **Step 2: Replace each `HTTPException` raise with the typed leaf class identified in Task 1's inventory**

13 sites. For the `get_leads_for_org` site inside `if raise_on_error:`, use the bare `raise` pattern shown above.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks** — but leave `get_leads_for_org`'s `raise_on_error` branching intact (Task 14).

- [ ] **Step 4: Update imports**

Remove `from fastapi import HTTPException` if no longer referenced. Add `from app.core.exceptions import <leaf classes used>`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_leads.py -v 2>&1 | tail -15
```

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/leads.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/leads.py
git commit -m "refactor(be): migrate leads to typed domain exceptions

Replaces 13 raise HTTPException sites with typed exceptions from
app.core.exceptions. The get_leads_for_org function's raise_on_error
parameter and surrounding branching are preserved for Task 14, which
removes the parameter entirely. 93 tests pass."
```

---

### Task 12: Migrate `market_scoring.py`

**Files:**
- Modify: `app/services/market_scoring.py` (3 raise sites)

**Special note:** This file is **last** per spec §4.3 because it's the most entangled with background tasks (`_run_market_scoring_for_org`). The 3 raises are all in the public functions added in Phase C — `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`. All map to 404s:
- `trigger_or_get_market_scores` (around line 332): "No lead market scores found for org_id" → `MarketScoreNotFoundError`
- `get_market_scores_status` (around line 359): "No market scoring run found for org_id" → `RunNotFoundError`
- `get_lead_market_score_descriptions` (around line 432): "Lead scoring descriptions not found" → `MarketScoreNotFoundError`

The file imports `from fastapi import BackgroundTasks, HTTPException` because `trigger_or_get_market_scores` takes `BackgroundTasks` as a parameter. **Preserve `BackgroundTasks`** in the import; remove only `HTTPException`.

This task does NOT touch `_run_market_scoring_for_org`'s outer error handling — that's Task 15.

- [ ] **Step 1: Read the file end-to-end**

```bash
cat backend/app/services/market_scoring.py
```

- [ ] **Step 2: Replace each raise with the typed leaf class per the mapping above**

3 sites. Each replaces `raise HTTPException(status_code=404, detail=...)` with the corresponding `raise <FooNotFoundError>(...)`.

- [ ] **Step 3: Delete `except HTTPException: raise` and wrap-and-rethrow blocks** if any exist. Leave `_run_market_scoring_for_org`'s error handling for Task 15.

- [ ] **Step 4: Update imports**

Change `from fastapi import BackgroundTasks, HTTPException` to `from fastapi import BackgroundTasks`. Add `from app.core.exceptions import MarketScoreNotFoundError, RunNotFoundError`.

- [ ] **Step 5: Run targeted tests**

```bash
cd backend && pytest tests/test_market_scoring.py -v 2>&1 | tail -15
```
Expected: all 4 market_scoring tests pass.

- [ ] **Step 6: Run full suite + grep validation**

```bash
cd backend && pytest 2>&1 | tail -3
grep -n "raise HTTPException\|except HTTPException" backend/app/services/market_scoring.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/market_scoring.py
git commit -m "refactor(be): migrate market_scoring to typed domain exceptions

Replaces 3 raise HTTPException(404) sites with typed exceptions:
trigger_or_get_market_scores -> MarketScoreNotFoundError,
get_market_scores_status -> RunNotFoundError,
get_lead_market_score_descriptions -> MarketScoreNotFoundError.

Preserves BackgroundTasks import (used by trigger_or_get_market_scores).
The _run_market_scoring_for_org background-task error handling is
revisited in Task 15. 93 tests pass.

This completes the per-service migration. After this commit, no
app/services/*.py file imports or raises HTTPException."
```

---

## Task 13: Delete router-side catches of retained domain exceptions

**Files:**
- Modify: `app/routers/signals.py` (2 catches at lines ~40, ~70)
- Modify: `app/routers/market_research.py` (1 catch at line ~25)
- Modify: `app/routers/icp.py` (3 catches at lines ~17, ~25, ~37)

**Context:** All 6 router-side catches of `BudgetExhaustedError` / `ICPIdRegistryError` are now redundant — the registered handlers in `main.py` do the conversion. Delete the catches and verify the response shape parity.

- [ ] **Step 1: Read each router file to find the catches**

```bash
grep -B1 -A2 "except BudgetExhaustedError\|except ICPIdRegistryError" backend/app/routers/
```
Expected: 6 catch blocks across signals/market_research/icp.

- [ ] **Step 2: Delete each catch block**

For `signals.py:40-41` (and the parallel one at `signals.py:71-72`), the current pattern is:
```python
try:
    result = await some_service_call(...)
    return result
except BudgetExhaustedError as e:
    raise HTTPException(status_code=429, detail=e.args[0])
```

Change to:
```python
return await some_service_call(...)
```

Same pattern for `market_research.py:24-25`. For `icp.py` (3 sites), the catches are `except ICPIdRegistryError as e: raise HTTPException(status_code=500, detail=str(e))`. Same transformation — delete the try/except, let the exception propagate.

- [ ] **Step 3: Remove now-unused imports**

If `BudgetExhaustedError` / `ICPIdRegistryError` are no longer referenced in the file, remove from the import block at the top.

Verify with:
```bash
grep -n "BudgetExhaustedError\|ICPIdRegistryError" backend/app/routers/signals.py backend/app/routers/market_research.py backend/app/routers/icp.py
```
Expected: no remaining references (only the import line if it survived).

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`. The handler in `main.py` produces identical HTTP responses to the deleted router catches — same status codes, same detail shapes.

- [ ] **Step 5: Verify shape parity**

Specifically validate the 429 path (the BudgetExhaustedError case has a dict payload):
```bash
cd backend && pytest tests/ -k "budget or signal_ask_claude" -v 2>&1 | tail -10
```
If any test pinned the response shape via snapshot, confirm it still matches.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/signals.py backend/app/routers/market_research.py backend/app/routers/icp.py
git commit -m "refactor(be): delete router-side catches of retained domain exceptions

The registered handlers in main.py (added in commit 2/14) now do the
HTTPException conversion for BudgetExhaustedError -> 429 and
ICPIdRegistryError -> 500. The 6 router-side try/except blocks across
signals.py (2), market_research.py (1), and icp.py (3) are redundant.

Response-shape parity verified:
- BudgetExhaustedError -> 429 with {'detail': <dict from args[0]>}
- ICPIdRegistryError -> 500 with {'detail': <string message>}

Both match the registered handler output. 93 tests pass."
```

---

## Task 14: Remove `raise_on_error` parameter from `get_leads_for_org`

**Files:**
- Modify: `app/services/leads.py` (function definition at lines 21-54)
- Modify: `app/services/market_scoring.py` (2 call sites at lines 369, 644)
- Modify: `app/services/signals.py` (2 call sites at lines 590, 730)

**Context:** Phase C added `raise_on_error: bool = True` as a workaround for HTTPException-in-background-tasks. With typed exceptions, the workaround is unnecessary — callers wrap with `try/except BrewraError:` if they want silent failure. Remove the parameter; update all 4 call sites to drop it (callers wanting silent failure get a try/except in Task 15).

- [ ] **Step 1: Read the current `get_leads_for_org` to confirm shape**

```bash
sed -n '20,58p' backend/app/services/leads.py
```

Expected: the function has 4 parameters (`org_id`, `limit`, `order_by_recent`, `raise_on_error`) and a try/except that branches on `raise_on_error`.

- [ ] **Step 2: Simplify `get_leads_for_org` in `leads.py`**

Replace the function with:
```python
def get_leads_for_org(
    org_id: str,
    limit: Optional[int] = None,
    order_by_recent: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch leads from Neo4j for a given org.

    Args:
        org_id: tenant scope.
        limit: max rows to return; None for no LIMIT clause.
        order_by_recent: if True, adds `ORDER BY l.created_at DESC`.

    Raises:
        BrewraError subclasses on storage or query failures. Callers that
        want silent failure should wrap with try/except BrewraError.
    """
    clauses = ["MATCH (l:Lead)", "WHERE l.org_id = $org_id"]
    params: Dict[str, Any] = {"org_id": org_id}
    clauses.append("RETURN l")
    if order_by_recent:
        clauses.append("ORDER BY l.created_at DESC")
    if limit is not None:
        clauses.append("LIMIT $limit")
        params["limit"] = limit
    query_string = "\n".join(clauses)
    with clients.driver.session() as session:
        results = session.run(query_string, **params)
        return _process_neo4j_lead_records(results)
```

Notes:
- The outer `try/except` is gone. Neo4j driver exceptions propagate unhandled; **FastAPI's default error handler returns HTTP 500.** This is correct — Phase D does not register a catch-all 500 handler for non-`BrewraError` exceptions (per spec §2.2 "third-party error mapping" is out of scope). Background-task callers wrap with `try/except BrewraError:` in Task 15 if they want silent failure.
- No service-level logging happens on storage failure here. If oncall visibility into Neo4j errors is desired, add a `logger.error(...)` before propagation in a future cleanup pass — out of scope for Phase D.

- [ ] **Step 3: Update the 4 callers**

In `app/services/market_scoring.py` at lines 369 and 644, change:
```python
get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False)
```
to:
```python
get_leads_for_org(org_id, limit=5000, order_by_recent=True)
```

In `app/services/signals.py` at lines 590 and 730, same change.

- [ ] **Step 4: Verify grep is clean**

```bash
grep -rn "raise_on_error" backend/app/services/ backend/app/routers/
```
Expected: no output.

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`. Tests don't exercise the storage-failure path with the old `raise_on_error=False` semantics (they exercise the happy path).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/leads.py backend/app/services/market_scoring.py backend/app/services/signals.py
git commit -m "refactor(be): remove raise_on_error from get_leads_for_org

The parameter was a Phase C workaround for HTTPException-in-background-tasks.
With typed domain exceptions (Phase D), callers that want silent failure
wrap with try/except BrewraError (handled in Task 15's background-task fix).
The function's contract is now uniform: raise on failure, let the caller
decide.

4 callers updated: market_scoring.py (lines 369, 644), signals.py
(lines 590, 730). 93 tests pass."
```

---

## Task 15: Background tasks — catch `BrewraError` and log+continue

**Files:**
- Modify: `app/services/market_scoring.py` — `_run_market_scoring_for_org` (around line 460+)
- Modify: `app/services/documents.py` — `process_file_to_embeddings` (around line 160+)

**Context:** These two functions are dispatched via `BackgroundTasks.add_task(...)`. After Phase D, the services they call raise `BrewraError` subclasses. The background task must catch them — exceptions raised inside a BackgroundTask after the HTTP response is sent silently propagate, getting swallowed by FastAPI's task runner.

Without this catch, the indirect callers of `get_leads_for_org` (now without `raise_on_error`) would crash the background run on any storage hiccup.

- [ ] **Step 1: Read `_run_market_scoring_for_org` in `market_scoring.py`**

```bash
grep -n "def _run_market_scoring_for_org" backend/app/services/market_scoring.py
sed -n '<starting line>,<starting line + 50>p' backend/app/services/market_scoring.py
```

Find the function body that does the lead fetch + scoring loop.

- [ ] **Step 2: Wrap the orchestration body with a `BrewraError` catch**

The function currently calls `get_leads_for_org(...)` (without `raise_on_error` after Task 14) and proceeds to score them. Wrap the entire body:

```python
def _run_market_scoring_for_org(user_id: str, org_id: str, run_id: str) -> None:
    """Background task: score leads for an org, log failures.

    Catches BrewraError so storage hiccups don't propagate to the
    BackgroundTasks runner (which would swallow them silently).
    """
    try:
        leads = get_leads_for_org(org_id, limit=5000, order_by_recent=True)
        # ... existing scoring loop unchanged ...
    except BrewraError as e:
        logger.warning(
            "Market scoring run failed for org_id=%s run_id=%s: %s",
            org_id, run_id, e,
        )
        # Mark the run as failed in the run-doc collection
        _, run_coll = _get_market_score_collections()
        now_iso = datetime.now(timezone.utc).isoformat()
        run_coll.update_one(
            {"run_id": run_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "updated_at": now_iso,
                "completed_at": now_iso,
            }},
        )
```

Adapt the wrap to the actual existing body — the structure depends on how the function is currently organized post-Phase-C. Preserve all existing logic; the only change is the outer try/except.

- [ ] **Step 3: Add the `BrewraError` import in `market_scoring.py`**

At the top, with the other `app.core.exceptions` imports (added during Task 12's migration):
```python
from app.core.exceptions import BrewraError, MarketScoreNotFoundError, RunNotFoundError
```

- [ ] **Step 4: Read `process_file_to_embeddings` in `documents.py`**

```bash
grep -n "def process_file_to_embeddings" backend/app/services/documents.py
```

The function already has internal try/except handling per the spec — verify whether its outermost block catches a sufficient base class (e.g., `Exception` would catch `BrewraError` already; if it does, no functional change needed but explicit `BrewraError` catch improves clarity).

- [ ] **Step 5: Update `process_file_to_embeddings`'s outermost catch (if applicable)**

If the outermost `except Exception as e:` block exists and already logs, change to:
```python
except BrewraError as e:
    logger.warning(
        "File processing failed for file_id=%s: %s",
        file_id, e,
    )
    # ... existing status-update logic ...
except Exception as e:
    logger.error("Unexpected error processing file_id=%s: %s", file_id, e)
    raise
```

This makes the domain-exception path explicit and leaves the generic catch for truly unexpected errors (which still re-raise to the default handler).

- [ ] **Step 6: Run tests**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 7: Run targeted background-task tests**

```bash
cd backend && pytest tests/test_market_scoring.py tests/test_leads.py -v 2>&1 | tail -15
```
Expected: all pass.

**Coverage caveat:** Existing tests mock storage and exercise the happy path. They almost certainly don't exercise the `BrewraError` catch path in `_run_market_scoring_for_org` or `process_file_to_embeddings`. The validation here is **structural** — tests still pass, code still parses, the catch is syntactically present — not behavioral. A future test-improvement phase (Phase E candidate, see TD-002 in `docs/TECH_DEBT.md`) should add tests that mock `get_leads_for_org` to raise `BrewraError` and assert the run is marked failed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/services/documents.py
git commit -m "refactor(be): background tasks catch BrewraError and log+continue

After Phase D, services raise BrewraError subclasses instead of
HTTPException. BackgroundTasks runner swallows exceptions silently
after the HTTP response is sent, so background tasks must catch
explicitly.

- _run_market_scoring_for_org: catches BrewraError, marks run as
  failed in run-doc collection, continues.
- process_file_to_embeddings: catches BrewraError in outer block,
  logs at warning level. Truly unexpected errors still re-raise.

93 tests pass."
```

---

## Task 16: Final sweep — grep validation, dead-import cleanup

**Files:** read-only inspection across `app/services/`, `app/routers/`, `app/core/`.

**Context:** Confirm every hard-acceptance grep is clean. Sweep for dead imports.

- [ ] **Step 1: Verify no `raise HTTPException` in services**

```bash
grep -rn "raise HTTPException" backend/app/services/
```
Expected: no output.

- [ ] **Step 2: Verify no `except HTTPException` in services**

```bash
grep -rn "except HTTPException" backend/app/services/
```
Expected: no output.

- [ ] **Step 3: Verify no `raise_on_error` anywhere**

```bash
grep -rn "raise_on_error" backend/app/services/ backend/app/routers/
```
Expected: no output.

- [ ] **Step 4: Verify no router-side catches of retained domain exceptions**

```bash
grep -rn "except BudgetExhaustedError\|except ICPIdRegistryError" backend/app/routers/
```
Expected: no output.

- [ ] **Step 5: Verify handler count in main.py**

```bash
grep -c "@app.exception_handler" backend/app/main.py
```
Expected: `7`

- [ ] **Step 6: Find and remove dead `HTTPException` imports**

Run from the monorepo root (`/projects/Brewra/brewra-gtm-intelligence/`):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for f in backend/app/services/*.py; do
  if grep -q "HTTPException" "$f"; then
    other_uses=$(grep -v "^from fastapi import" "$f" | grep -c "HTTPException")
    if [ "$other_uses" -eq 0 ]; then
      echo "DEAD IMPORT: $f"
    fi
  fi
done
```

The check: if `HTTPException` appears in the file but only on `from fastapi import …` lines (zero occurrences elsewhere), the import is dead. Manually inspect each flagged file and remove `HTTPException` from the import list. If the import line becomes empty (`from fastapi import` with nothing after), delete it entirely.

- [ ] **Step 7: Run full test suite one final time**

```bash
cd backend && pytest 2>&1 | tail -3
```
Expected: `93 passed, ≤11 warnings`.

- [ ] **Step 8: Commit (only if cleanup edits happened)**

If any dead-import removals were made in Step 6:
```bash
git add backend/app/services/<files modified>
git commit -m "chore(be): remove dead HTTPException imports after Phase D migration

Final sweep after the per-service migrations. Files where HTTPException
was only used for raises now no longer reference it; the import is
removed.

All Phase D hard acceptance criteria pass:
- 0 raise HTTPException in app/services/
- 0 except HTTPException in app/services/
- 0 raise_on_error sites
- 0 router-side catches of retained domain exceptions
- 7 exception handlers registered in main.py
- 93 tests pass"
```

If no edits were needed (all imports were cleaned during per-service migrations), skip this commit — Task 16 is verification only.

---

## Task 17: Final acceptance verification

No commit. Runs the full acceptance checklist from spec §6 against HEAD.

- [ ] **Hard criteria (greppable):**

```bash
cd backend
grep -rn "raise HTTPException" app/services/                # expect: empty
grep -rn "except HTTPException" app/services/               # expect: empty
grep -rn "raise_on_error" app/services/ app/routers/        # expect: empty
grep -rn "except BudgetExhaustedError\|except ICPIdRegistryError" app/routers/  # expect: empty
grep -c "@app.exception_handler" app/main.py                # expect: 7
pytest 2>&1 | tail -3                                       # expect: 93 passed
```

- [ ] **Soft criteria (manual):**

- HTTP response shape: spot-check 1 endpoint per status family via FastAPI `/docs` on a running instance.
- Background tasks: tail logs during a trigger of `_run_market_scoring_for_org` and `process_file_to_embeddings`; confirm `BrewraError` log lines appear, no traceback leak.

- [ ] **Diffstat check (spec §6 soft criterion 10):**

Confirm net-negative LOC for every migrated service file:

```bash
git diff master..HEAD --stat -- backend/app/services/
```
Expected: each of the 9 migrated files shows more deletions than insertions (try/except wrappers and HTTPException imports gone; typed-exception imports added are typically fewer lines). If any file shows net positive LOC, inspect — that file may have an unintended addition.

- [ ] **Commit shape:**

```bash
git log master..HEAD --oneline
```
Expected: 15 commits (Tasks 2, 3, 4-12 = 9, 13, 14, 15, 16-if-cleanup-needed). If Task 16 produced no commit, expect 14.

- [ ] **Phase E+ inventory update:**

If implementation surfaced new debt items, append to `docs/TECH_DEBT.md` or the spec's §8 inventory. Commit separately.

- [ ] **Phase D is complete.**

No final commit required. Phase D is done when all hard criteria pass and all soft criteria are verified.
