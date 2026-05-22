# Backend Modularization Phase C — Cleanup Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `/specs/2026-05-22-backend-modularization-phase-c-design.md` (commit `944c65d`).

**Goal:** Close out 5 Phase B carry-forward cleanup items so the next phase can focus on a single architectural concern (DI, tests, or features) without trailing debt.

**Architecture:** Five small refactors on the existing FastAPI backend. Each task is a structural change verified by the existing test suite (93 tests). No new tests in this phase. No new features. Items 1-4 are small (1 commit each); item 5 (market_scoring extraction) spans tasks 6-10.

**Tech Stack:** FastAPI, Pydantic V2, pytest with syrupy snapshots, MongoDB (pymongo, lazy SRV-resolved singleton), Neo4j (neo4j-driver). All work on the `refactor-backend-modularization-phase-c` branch (already checked out, branched from master).

**Working directory:** All `pytest` commands assume `cd /projects/Brewra/brewra-gtm-intelligence/backend`. Git commands run from monorepo root `/projects/Brewra/brewra-gtm-intelligence/`.

**Commit policy:** Per monorepo `CLAUDE.md` — small, frequent commits, no `Co-Authored-By: Claude` footer. Message prefixes: `fix(be):` for bug fixes, `refactor(be):` for structural moves, `chore(be):` for hygiene.

---

## Pre-flight

- [ ] **Step 1: Verify branch and clean tree**

Run from monorepo root:
```bash
git branch --show-current && git status --short
```
Expected: `refactor-backend-modularization-phase-c` and clean working tree (no unstaged changes).

- [ ] **Step 2: Verify baseline test count**

Run from `backend/`:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest 2>&1 | tail -3
```
Expected: `93 passed, 9 warnings in <time>s` (or similar — the warning count of 9 was the post-cleanup baseline). If the count is not 93, note the actual number and confirm with the user before proceeding.

---

## Task 1: Fix extract_number return-type annotation (Item 1)

**Files:**
- Modify: `app/services/graph_chat.py:152-154`

**Context:** `extract_number` is annotated `-> str` but returns `None` when the regex doesn't match. The single caller (`score_prospect` at line 183) returns `extract_number`'s result directly, which then flows into a Cypher f-string at `app/services/documents.py:119` as `'{score}'`. If `score` is `None`, Python silently formats it as the literal string `"None"`. The fix is an annotation correction only — no behavior change.

- [ ] **Step 1: Verify single-caller assumption**

Run from `backend/`:
```bash
grep -rn "extract_number" app/
```
Expected output: exactly 3 lines — the definition at `graph_chat.py:152`, a doc reference at `graph_chat.py:8`, and the caller at `graph_chat.py:183`. If anything else appears, stop and inform the user — the fix may need a different shape.

- [ ] **Step 2: Apply the annotation fix**

Modify `app/services/graph_chat.py:152-154`. Before:
```python
def extract_number(content) -> str:
    match = re.search(r"'([^']+)'", str(content))
    return match.group(1) if match else None
```
After:
```python
def extract_number(content) -> Optional[str]:
    match = re.search(r"'([^']+)'", str(content))
    return match.group(1) if match else None
```

- [ ] **Step 3: Ensure `Optional` is imported**

Check the top of `app/services/graph_chat.py` for `from typing import ... Optional ...`. If `Optional` is not already imported, add it. To check:
```bash
grep -n "^from typing\|^import typing" app/services/graph_chat.py
```
If `Optional` is missing from the typing import, add it (preserve any other imported names from typing).

- [ ] **Step 4: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 5: Commit**

From monorepo root:
```bash
git add backend/app/services/graph_chat.py
git commit -m "fix(be): annotate extract_number as Optional[str] to match actual behavior

The function returned None on no-match but was annotated -> str. Phase A
review (E4) flagged this; Phase B deferred it. Annotation-only change —
the existing None-tolerant caller flow (graph_chat.score_prospect ->
documents._process_prospect_row) is unchanged."
```

---

## Task 2: Switch all profiler_client callers to client (Item 2a)

**Files:**
- Modify: `app/services/leads.py:249,270` (function `upload_leads_csv`)
- Modify: `app/services/leads.py:426-428` (function `get_stream_status`)
- Modify: `app/services/leads.py:456,487` (function `delete_leads_by_file`)
- Modify: `app/services/customer_profile.py:16,20` (function `upsert_customer_profile`)
- Modify: `app/services/customer_profile.py:145,149` (function `get_customer_profile`)
- Modify: `app/services/customer_profile.py:236,240` (function `create_from_suggested_icp`)
- Modify: `app/services/customer_profile.py:384,387` (function `delete_icp_from_customer_profile`)
- Modify: `app/services/market_scoring.py:43` (internal helper `_get_market_score_collections`)
- Modify: `tests/conftest.py:98-101` (mock fixture)
- Modify: `tests/test_icp.py:148, 167, 194, 333` (4 patch sites)
- Modify: `tests/test_market_scoring.py:9 (docstring), 110, 141, 164` (3 patch sites + 1 docstring)

**Context:** The current code imports `_get_profiler_mongo_client` from `market_scoring.py` in 8 production sites (3 in `leads.py`, 4 in `customer_profile.py`, plus the internal use in `market_scoring.py:43`). The helper just returns `app.core.clients.profiler_client`, which is itself an alias for `client`. Replacing the callers with direct use of `clients.client` is the prep step before deleting the alias in Task 3.

Both `leads.py` and `customer_profile.py` already have `from app.core import clients` at the top — no new imports needed in production code.

- [ ] **Step 1: Update `leads.py` — three call sites**

In `app/services/leads.py`, locate function `upload_leads_csv`:
- Delete line 249: `from app.services.market_scoring import _get_profiler_mongo_client`
- Change line 270 from:
  ```python
              mongo_client = _get_profiler_mongo_client()
  ```
  to:
  ```python
              mongo_client = clients.client
  ```

In function `get_stream_status` (line ~423):
- Delete line 426: `from app.services.market_scoring import _get_profiler_mongo_client`
- Change line 428 from `mongo_client = _get_profiler_mongo_client()` to `mongo_client = clients.client`.

In function `delete_leads_by_file` (line ~451):
- Delete line 456: `from app.services.market_scoring import _get_profiler_mongo_client`
- Change line 487 from `mongo_client = _get_profiler_mongo_client()` to `mongo_client = clients.client`.

- [ ] **Step 2: Update `customer_profile.py` — four call sites**

Apply the same pattern in each of the four functions. For each:
- Delete the line: `from app.services.market_scoring import _get_profiler_mongo_client`
- Change `mongo_client = _get_profiler_mongo_client()` to `mongo_client = clients.client`.

The four functions are: `upsert_customer_profile` (lines 16, 20), `get_customer_profile` (lines 145, 149), `create_from_suggested_icp` (lines 236, 240), `delete_icp_from_customer_profile` (lines 384, 387). Line numbers will shift as edits are applied — re-locate by function name if needed.

- [ ] **Step 3: Update internal use in `market_scoring.py:_get_market_score_collections`**

In `app/services/market_scoring.py:40-49`, change line 43 from:
```python
    profiler_db = _get_profiler_mongo_client()["Profiler"]
```
to:
```python
    profiler_db = clients.client["Profiler"]
```

Note: `clients` is already imported in `market_scoring.py` at line 20 (`from app.core import clients`). Verify with:
```bash
grep -n "from app.core import clients\|import clients" app/services/market_scoring.py | head -3
```

- [ ] **Step 4: Update `tests/conftest.py:mock_mongo` fixture**

In `tests/conftest.py:85-101`, the `mock_mongo` fixture patches both `client` and `profiler_client` because both names referenced the same singleton. After Task 3 deletes `profiler_client`, the second patch becomes invalid. Update now to remove the redundancy.

Before (lines 85-101):
```python
@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Source-patches `app.core.clients.client` so
    all router and service code that imports `client` from `app.core.clients`
    uses the mock.

    Phase B Task 5: per-router MongoClient patches removed. All 26 inline
    MongoClient constructions have been replaced with imports from
    app.core.clients. A single patch of `app.core.clients.client` is now
    sufficient for the primary cluster. `profiler_client` is also patched
    since it is the same mock (same cluster alias).
    """
    mongo = MagicMock()
    mocker.patch("app.core.clients.client", mongo)
    # profiler_client is an alias for client on the same cluster.
    mocker.patch("app.core.clients.profiler_client", mongo)
    return mongo
```

After:
```python
@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Source-patches `app.core.clients.client` so
    all router and service code that imports `client` from `app.core.clients`
    uses the mock.

    Phase B Task 5: per-router MongoClient patches removed. All 26 inline
    MongoClient constructions have been replaced with imports from
    app.core.clients. A single patch of `app.core.clients.client` is
    sufficient — the Profiler databases live on the same cluster.
    """
    mongo = MagicMock()
    mocker.patch("app.core.clients.client", mongo)
    return mongo
```

- [ ] **Step 5: Update `tests/test_icp.py` — four patch sites**

In `tests/test_icp.py`, the four lines (148, 167, 194, 333) each contain:
```python
         patch("app.core.clients.profiler_client", mc):
```
Change each to:
```python
         patch("app.core.clients.client", mc):
```

To verify the find-and-replace will work, first count the occurrences:
```bash
grep -c "app.core.clients.profiler_client" tests/test_icp.py
```
Expected: `4`. Then apply the replacement to all 4.

- [ ] **Step 6: Update `tests/test_market_scoring.py` — three patch sites + docstring**

In `tests/test_market_scoring.py`:
- Line 9 docstring mentions `profiler_client` — update the wording to refer only to `client`. Read the current docstring and rewrite to omit the `profiler_client` reference. Example replacement:
  - Before (around line 9): `... and profiler_client from app.core.clients. Patch "app.core.clients.client" for mocking.`
  - After: `... from app.core.clients. Patch "app.core.clients.client" for mocking.`
- Lines 110, 141, 164: same change as in Step 5 — replace `profiler_client` with `client` in each `patch("app.core.clients.profiler_client", ...)` call.

- [ ] **Step 7: Verify the production grep is clean**

```bash
grep -rn "_get_profiler_mongo_client" app/
```
Expected: only 1 match — the function definition at `app/services/market_scoring.py:32` (to be deleted in Task 3). All callers should be gone.

```bash
grep -rn "profiler_client" tests/
```
Expected: no matches.

- [ ] **Step 8: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`. If any test fails, the most likely cause is a missed call site — re-grep and fix.

- [ ] **Step 9: Commit**

From monorepo root:
```bash
git add backend/app/services/leads.py backend/app/services/customer_profile.py backend/app/services/market_scoring.py backend/tests/conftest.py backend/tests/test_icp.py backend/tests/test_market_scoring.py
git commit -m "refactor(be): switch profiler_client callers to client directly

Prep step before deleting the alias in the next commit. The Profiler
databases (ICP_config, Lead_Market_Scores, Company_Profile, etc.) live
on the same MongoDB cluster as everything else; the profiler_client name
was misleading. After this commit, _get_profiler_mongo_client() is
unused (kept temporarily to keep the diff focused)."
```

---

## Task 3: Delete the profiler_client alias and helper (Item 2b)

**Files:**
- Modify: `app/core/clients.py:55-60` (delete the alias block)
- Modify: `app/services/market_scoring.py:32-37` (delete the helper function)

**Context:** With Task 2 done, `_get_profiler_mongo_client` has no callers and `profiler_client` is referenced only in its own definition. Safe to delete both.

- [ ] **Step 1: Delete the alias from `clients.py`**

In `app/core/clients.py:55-60`, delete the following block:
```python
# Secondary "Profiler" alias — the Profiler databases (ICP_config, Lead_Market_Scores,
# Company_Profile, etc.) live on the same primary cluster as all other Mongo databases.
# Migrated from app/services/market_scoring.py:_get_profiler_mongo_client() in Phase B Task 5.
# Exposed as a separate name so callers that conceptually talk to the "Profiler cluster"
# can import `profiler_client` without knowing it resolves to the same connection.
profiler_client = client
```

If the file's top-level docstring (lines 1-7) references `profiler_client`, update it. The current docstring at line 6 says `importing 'client' (or 'profiler_client') from this module.` — change to `importing 'client' from this module.`.

- [ ] **Step 2: Delete the helper from `market_scoring.py`**

In `app/services/market_scoring.py:32-37`, delete:
```python
def _get_profiler_mongo_client() -> MongoClient:
    """Return the shared Mongo singleton. Kept as a thin alias for callers in this service.
    Migrated from per-call construction to singleton in Phase B Task 5.
    """
    from app.core.clients import profiler_client
    return profiler_client
```

If there is a blank line gap left between surrounding functions, leave one blank line (PEP 8 spacing). Also check whether `MongoClient` is still imported in `market_scoring.py`; if the import is now unused, remove it. To verify:
```bash
grep -n "MongoClient" app/services/market_scoring.py
```
If `MongoClient` appears only on the import line, delete that import.

- [ ] **Step 3: Verify the grep is fully clean**

```bash
grep -rn "profiler_client\|_get_profiler_mongo_client" app/ tests/
```
Expected: no output. If anything is found, fix the remaining reference.

- [ ] **Step 4: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 5: Commit**

From monorepo root:
```bash
git add backend/app/core/clients.py backend/app/services/market_scoring.py
git commit -m "refactor(be): delete profiler_client alias and _get_profiler_mongo_client helper

Both were unused after the previous commit migrated callers. The
'Profiler cluster' implied by the alias name never existed as a separate
cluster — it always referenced the same primary MongoDB connection.
Code-review M9 (post-Phase-B) flagged this; closing it now.

Side effect: this breaks a real cross-service import cycle. leads.py and
customer_profile.py previously imported _get_profiler_mongo_client from
market_scoring.py, while market_scoring.py imports fetch_leads_for_org
from leads.py. The cycle was tolerated via function-body imports; it's
gone now."
```

---

## Task 4: Consolidate fetch_leads_for_org and get_all_leads (Item 3)

**Files:**
- Modify: `app/services/leads.py:21-51` (delete `fetch_leads_for_org`)
- Modify: `app/services/leads.py:81-99` (replace `get_all_leads` with `get_leads_for_org`)
- Modify: `app/services/market_scoring.py` (line ~477 and `app/routers/market_scoring.py` line ~119) — two callers of `fetch_leads_for_org`
- Modify: `app/routers/leads.py:21` (sole caller of `get_all_leads`)

**Context:** Two functions read leads from Neo4j with divergent error handling and JSON parsing. Consolidating into a single function `get_leads_for_org(org_id, limit, order_by_recent, raise_on_error)` removes duplicated JSON-deserialization logic and lets each caller specify the behavior it wants.

- [ ] **Step 1: Locate and read both current functions**

Read the current state of both functions in `app/services/leads.py`:
- `fetch_leads_for_org` at line 21 (limit/order, returns `[]` on error)
- `get_all_leads` at line 81 (no limit, raises on error, uses `_process_neo4j_lead_records`)

Also locate the two callers of `fetch_leads_for_org`:
```bash
grep -rn "fetch_leads_for_org" app/
```
Expected: 4 hits — definition (`leads.py:21`), and 3 callers in `market_scoring.py` (background task) and `routers/market_scoring.py` (router fallback at line ~119) plus the import in `routers/market_scoring.py`.

- [ ] **Step 2: Add the unified function**

In `app/services/leads.py`, add the new function below `_process_neo4j_lead_records` (which lives around line 58). Place it before `get_all_leads`:

```python
def get_leads_for_org(
    org_id: str,
    limit: Optional[int] = None,
    order_by_recent: bool = False,
    raise_on_error: bool = True,
) -> List[Dict[str, Any]]:
    """Fetch leads from Neo4j for a given org.

    Args:
        org_id: tenant scope.
        limit: max rows to return; None for no LIMIT clause.
        order_by_recent: if True, adds `ORDER BY l.created_at DESC`.
        raise_on_error: if True, raises HTTPException(500); if False,
            logs a warning and returns [] (background-task path).
    """
    try:
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
    except Exception as e:
        if raise_on_error:
            logger.error(f"Error fetching leads: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")
        logger.warning(f"Could not fetch leads: {e}")
        return []
```

Verify `Optional` is imported from `typing` at the top of `leads.py`. To check:
```bash
grep -n "^from typing" app/services/leads.py
```
If `Optional` is not in the import, add it.

- [ ] **Step 3: Delete `fetch_leads_for_org` (lines 21-51)**

Delete the entire `fetch_leads_for_org` function. The deletion should remove ~30 lines (function body + docstring + surrounding blank lines if appropriate).

- [ ] **Step 4: Delete `get_all_leads` (was at lines 81-99, will shift after Step 3)**

Delete the entire `get_all_leads` function as well — its functionality is now covered by `get_leads_for_org()` with default arguments.

- [ ] **Step 5: Update caller in `app/routers/leads.py:21`**

Locate the `GET /leads` handler. Change the body from:
```python
    return leads_service.get_all_leads(org_id)
```
to:
```python
    return leads_service.get_leads_for_org(org_id)
```

The default arguments (`limit=None, order_by_recent=False, raise_on_error=True`) match the old `get_all_leads` behavior exactly.

- [ ] **Step 6: Update caller in `app/services/market_scoring.py:_run_market_scoring_for_org`**

Locate the line that calls `fetch_leads_for_org`. Verify:
```bash
grep -n "fetch_leads_for_org" app/services/market_scoring.py
```
Two locations expected:
- An import: `from app.services.leads import fetch_leads_for_org`
- A call in `_run_market_scoring_for_org`: `leads = fetch_leads_for_org(org_id, limit=5000)`

Change the import to:
```python
from app.services.leads import get_leads_for_org
```

Change the call from `fetch_leads_for_org(org_id, limit=5000)` to:
```python
get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False)
```

This preserves the original behavior: limit=5000, ordered by recency, silent fallback on error (background tasks must not raise to the BackgroundTasks runner).

- [ ] **Step 7: Update caller in `app/routers/market_scoring.py`**

Locate:
```bash
grep -n "fetch_leads_for_org" app/routers/market_scoring.py
```
Two locations expected: an import and a call site at line ~119 (`total_leads = len(fetch_leads_for_org(org_id, limit=5000))`).

Change the import similarly. Change the call to:
```python
total_leads = len(get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False))
```

- [ ] **Step 8: Verify the grep is clean**

```bash
grep -rn "fetch_leads_for_org\|get_all_leads" app/
```
Expected: no output.

- [ ] **Step 9: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`. If `test_leads.py::test_get_all_leads_*` fails, double-check the router change in Step 5. If `test_market_scoring.py::test_trigger_market_scoring_*` fails, double-check the call signatures in Steps 6-7.

- [ ] **Step 10: Commit**

From monorepo root:
```bash
git add backend/app/services/leads.py backend/app/services/market_scoring.py backend/app/routers/leads.py backend/app/routers/market_scoring.py
git commit -m "refactor(be): consolidate fetch_leads_for_org and get_all_leads into get_leads_for_org

Two functions doing similar Neo4j-lead reads with divergent error
handling (one returned [] silently, one raised 500) and a duplicated
JSON-deserialization loop. The new get_leads_for_org() accepts
limit/order_by_recent/raise_on_error parameters; callers opt into the
behavior they need:
  - routers/leads.py: defaults (no limit, raises on error).
  - market_scoring._run_market_scoring_for_org: limit=5000,
    order_by_recent=True, raise_on_error=False (background-task path).
  - routers/market_scoring.py fallback: same shape as background task."
```

---

## Task 5: Delete BrewraError base + fix 429 body shape (Item 4)

**Files:**
- Modify: `app/core/exceptions.py` (delete `BrewraError`, reparent the other two)
- Modify: `app/routers/signals.py:40, 71` (fix catch body)
- Modify: `app/routers/market_research.py:24` (fix catch body)

**Context:** `BrewraError` has zero callers/catches — it's a dead base class. The `BudgetExhaustedError` and `ICPIdRegistryError` subclasses are working correctly; only the 429 catch body has a latent bug (`detail=str(e)` produces Python-repr instead of JSON). Keep both subclasses, reparent to `Exception`, fix the catch bodies.

- [ ] **Step 1: Verify the catch sites**

```bash
grep -n "BudgetExhaustedError\|ICPIdRegistryError" app/routers/
```
Expected: 6 catch sites — 2 in `signals.py` (lines 40, 71), 1 in `market_research.py` (line 24), 3 in `icp.py` (lines 16, 24, 36). Plus their imports at the top of each router file.

The 3 `ICPIdRegistryError` catches in `icp.py` already use `detail=str(e)` correctly because that exception carries a single string message (see `services/icp.py:1137`: `raise ICPIdRegistryError("Failed to generate globally unique ICP id.")`). They are NOT changed by this task.

Only the 3 `BudgetExhaustedError` catches need updating — those pass `str(e)` on an exception whose `args[0]` is a dict, producing Python-repr.

- [ ] **Step 2: Reparent the two surviving exception classes**

In `app/core/exceptions.py`, replace the entire file contents with:
```python
"""Domain exception hierarchy.

Service-layer functions raise these. Routers catch and convert to
HTTPException at the HTTP boundary. This keeps the services layer
free of FastAPI specifics for the cases that warrant it.
"""


class BudgetExhaustedError(Exception):
    """Claude per-window token budget exhausted. Carries a dict payload
    (error message + budget metadata) in args[0]. Routers map to HTTP 429."""


class ICPIdRegistryError(Exception):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
```

Note: `BrewraError` is gone. `BudgetExhaustedError` and `ICPIdRegistryError` both inherit directly from `Exception`.

- [ ] **Step 3: Fix the 429 catch in `signals.py:40`**

In `app/routers/signals.py`, change line 40-41 from:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
```
to:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=e.args[0])
```

`e.args[0]` is the dict that `services/_claude_budget.py:54-61` passes to the exception constructor. FastAPI serializes dict `detail` values to JSON automatically.

- [ ] **Step 4: Fix the 429 catch in `signals.py:71`**

In the same file, change lines 71-72 from:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
```
to:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=e.args[0])
```

- [ ] **Step 5: Fix the 429 catch in `market_research.py:24`**

In `app/routers/market_research.py`, change lines 24-25 from:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
```
to:
```python
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=e.args[0])
```

- [ ] **Step 6: Verify no stale references to BrewraError remain**

```bash
grep -rn "BrewraError" app/ tests/
```
Expected: no output.

- [ ] **Step 7: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`. If any snapshot test fails because it pinned the old Python-repr 429 body, update the snapshot:
```bash
pytest --snapshot-update tests/test_signals.py tests/test_market_research.py
pytest 2>&1 | tail -3
```
After the update, re-run pytest and confirm 93 passed. Inspect the updated snapshot file (`tests/__snapshots__/`) to confirm the new body is a JSON object containing the `error`, `token_limit_5m`, `current_tokens_5m`, `requested_tokens` fields. If it isn't, stop and investigate.

- [ ] **Step 8: Commit**

From monorepo root:
```bash
git add backend/app/core/exceptions.py backend/app/routers/signals.py backend/app/routers/market_research.py
# also add any updated snapshot file in backend/tests/__snapshots__/ if step 7 produced one
git status --short  # review what's staged
git commit -m "fix(be): delete unused BrewraError base; emit 429 detail as JSON object

BrewraError was a dead base class — zero callers/catches across the
codebase. BudgetExhaustedError and ICPIdRegistryError now inherit from
Exception directly.

429 body bug fix: BudgetExhaustedError carries a dict in args[0]
(error message + budget metadata), but the router catches used
detail=str(e), which produces a Python-repr string like
\"{'error': 'Token budget exceeded...', 'token_limit_5m': ..., ...}\".
The frontend cannot parse this. Switching to detail=e.args[0] returns
a proper JSON object: {'detail': {'error': '...', 'token_limit_5m': ..., ...}}.

The 3 ICPIdRegistryError catches in icp.py remain unchanged — that
exception carries a plain string message, so str(e) is correct.

Snapshot test for /signal_ask_claude updated if pinned to the old body."
```

---

## Task 6: Extract trigger_or_get_market_scores into service (Item 5a)

**Files:**
- Modify: `app/services/market_scoring.py` (add new function near the top of the public-functions section)
- Modify: `app/routers/market_scoring.py:25-104` (the first endpoint handler)

**Context:** The router endpoint `POST /leads/market-scores` (the "trigger or fetch" endpoint) is the largest in the router — handles stale-run detection, run-document construction, background-task scheduling, and returning latest scores. Move all business logic to a service function returning a plain dict; router becomes a thin wrapper.

Convention (verified in `app/services/leads.py`, `icp.py`, `signals.py`, `documents.py`): service functions return `Dict[str, Any]` or `List[Dict[str, Any]]`; routers return the dict and FastAPI validates against `response_model`.

- [ ] **Step 1: Read current router state**

Read `app/routers/market_scoring.py` end-to-end to see what the handler does (after the H1 fix in commit b837d44 removed the `mongo_client.close()` boilerplate, but the business logic remains inline). Read `app/services/market_scoring.py` to understand what private helpers already exist (`_get_market_score_collections`, `_is_stale_queued_run`, `_get_latest_market_score_rows`, `_get_latest_scoring_run`).

- [ ] **Step 2: Add the service function**

In `app/services/market_scoring.py`, near where other public functions live (after the private helpers section, near `get_company_profile_for_org` around line 278), add:

```python
def trigger_or_get_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Trigger a new market-scoring run or return current/latest scores for an org.

    Returns a dict matching the LeadMarketScoresResponse schema:
      org_id, total_leads, processing_status, active_run_id, last_scored_at, rows.
    Raises HTTPException(404) if no rows exist and no refresh was requested.
    """
    import uuid

    _, run_coll = _get_market_score_collections()
    active_run = run_coll.find_one(
        {"org_id": request.org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )

    if active_run and _is_stale_queued_run(active_run):
        stale_run_id = str(active_run.get("run_id"))
        now_iso = datetime.now(timezone.utc).isoformat()
        run_coll.update_one(
            {"run_id": stale_run_id},
            {
                "$set": {
                    "status": "failed",
                    "error": "Run auto-failed because it remained queued without starting.",
                    "updated_at": now_iso,
                    "completed_at": now_iso,
                }
            },
        )
        logger.warning(
            "Marked stale queued market scoring run as failed. org_id=%s run_id=%s",
            request.org_id,
            stale_run_id,
        )
        active_run = None

    run_doc: Optional[Dict[str, Any]] = None
    if request.refresh and not active_run:
        run_id = str(uuid.uuid4())
        queued_at = datetime.now(timezone.utc).isoformat()
        run_doc = {
            "run_id": run_id,
            "user_id": request.user_id,
            "org_id": request.org_id,
            "status": "queued",
            "created_at": queued_at,
            "started_at": None,
            "completed_at": None,
            "updated_at": queued_at,
            "total_leads": 0,
            "processed_count": 0,
            "failed_count": 0,
        }
        run_coll.insert_one(run_doc)
        background_tasks.add_task(
            _run_market_scoring_for_org,
            request.user_id,
            request.org_id,
            run_id,
        )
    elif active_run:
        active_run.pop("_id", None)
        run_doc = active_run
    else:
        run_doc = _get_latest_scoring_run(request.org_id)

    rows = _get_latest_market_score_rows(request.org_id)
    if not rows and not request.refresh:
        raise HTTPException(status_code=404, detail="No lead market scores found for org_id")

    latest_run = run_doc or _get_latest_scoring_run(request.org_id)
    processing_status = str((latest_run or {}).get("status", "idle"))
    last_scored_at = rows[0].updated_at if rows else None
    return {
        "org_id": request.org_id,
        "total_leads": len(rows),
        "processing_status": processing_status,
        "active_run_id": (latest_run or {}).get("run_id"),
        "last_scored_at": last_scored_at,
        "rows": rows,
    }
```

This is the router's current logic with one shape change: the function returns a dict (not a `LeadMarketScoresResponse` instance), matching Phase B's service convention.

- [ ] **Step 3: Ensure required imports in `market_scoring.py`**

Check the top of `app/services/market_scoring.py` for these imports — add any that are missing:
```python
from fastapi import BackgroundTasks, HTTPException
from app.models.market_scoring import LeadMarketScoresRequest
```

Existing imports already include `datetime`, `timezone`, `Dict`, `Any`, `Optional`, `logger`. Verify with:
```bash
head -30 app/services/market_scoring.py
```

- [ ] **Step 4: Update the router handler**

In `app/routers/market_scoring.py`, replace the entire body of `get_or_refresh_lead_market_scores` (lines 25 to ~95 — everything inside the function) with a single line:

Before (showing only function shape; actual content is the ~80 lines that are being deleted):
```python
@router.post("/leads/market-scores", response_model=LeadMarketScoresResponse)
async def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
):
    run_doc: Optional[Dict[str, Any]] = None
    _, run_coll = market_scoring_service._get_market_score_collections()
    # ... ~75 more lines of business logic ...
```

After:
```python
@router.post("/leads/market-scores", response_model=LeadMarketScoresResponse)
async def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
):
    return market_scoring_service.trigger_or_get_market_scores(request, background_tasks)
```

Remove any imports from the router that are no longer used (e.g., `uuid` if the only use was inside the moved code, `datetime`/`timezone` if no other handler in this file uses them). After Task 6, the next two endpoints still inline their logic, so several of these may still be needed — check on a per-import basis. To find unused imports cleanly:
```bash
python -c "import ast, sys; tree = ast.parse(open('app/routers/market_scoring.py').read()); print([n.names[0].name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))])"
```
Then visually scan the router file for usage.

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_market_scoring.py -v 2>&1 | tail -10
```
Expected: 4 tests pass (`test_trigger_market_scoring_returns_accepted`, `test_get_market_score_returns_score`, `test_get_market_score_status_404_when_no_run`, `test_trigger_market_scoring_missing_org_id`).

Then full suite:
```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 6: Commit**

From monorepo root:
```bash
git add backend/app/services/market_scoring.py backend/app/routers/market_scoring.py
git commit -m "refactor(be): extract trigger_or_get_market_scores into service layer

Moves stale-run detection, run-document construction, background-task
scheduling, and latest-scores fetch out of the router into a public
service function. Service returns Dict[str, Any] matching the
LeadMarketScoresResponse schema; router does HTTP wiring only.

Pattern matches Phase B's leads/icp/signals/documents extraction
convention — services return dicts, routers wrap with response_model."
```

---

## Task 7: Extract get_market_scores_status into service (Item 5b)

**Files:**
- Modify: `app/services/market_scoring.py` (add new function)
- Modify: `app/routers/market_scoring.py` (the second endpoint handler — `GET /leads/market-scores/status`)

**Context:** Mirror of Task 6 for the status endpoint. Includes total-leads fallback (calls `get_leads_for_org` if `run_doc.total_leads` is 0), count queries, progress percentage, and recent-items shaping.

- [ ] **Step 1: Add the service function**

In `app/services/market_scoring.py`, below `trigger_or_get_market_scores`, add:

```python
def get_market_scores_status(
    user_id: str,
    org_id: str,
    run_id: Optional[str],
    recent_items_limit: int,
) -> Dict[str, Any]:
    """Return progress + recent items for a market-scoring run.

    Returns a dict matching the LeadMarketScoringStatusResponse schema.
    Raises HTTPException(404) if no run is found for the given filter.
    """
    score_coll, run_coll = _get_market_score_collections()
    run_filter: Dict[str, Any] = {"org_id": org_id, "user_id": user_id}
    if run_id:
        run_filter["run_id"] = run_id
    run_doc = run_coll.find_one(run_filter, sort=[("created_at", -1)])
    if not run_doc:
        raise HTTPException(status_code=404, detail="No market scoring run found for org_id")

    run_doc.pop("_id", None)
    target_run_id = str(run_doc.get("run_id"))
    total_leads = int(run_doc.get("total_leads") or 0)
    processed_leads = int(run_doc.get("processed_count") or 0)
    failed_count = int(run_doc.get("failed_count") or 0)

    if total_leads <= 0:
        # get_leads_for_org is already imported at module top (updated in Task 4 Step 6).
        total_leads = len(get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False))

    run_score_filter = {"org_id": org_id, "user_id": user_id, "run_id": target_run_id}
    scored_doc_count = score_coll.count_documents(run_score_filter)
    if processed_leads < scored_doc_count:
        processed_leads = scored_doc_count

    processed_with_descriptions = score_coll.count_documents(
        {
            **run_score_filter,
            "component_descriptions": {"$type": "object"},
        }
    )

    progress_denominator = max(total_leads, 1)
    progress_percent = round(min(100.0, (processed_leads / progress_denominator) * 100.0), 2)

    recent_docs = list(
        score_coll.find(run_score_filter, {"lead_id": 1, "scoring_status": 1, "market_total_score": 1, "updated_at": 1, "component_descriptions": 1})
        .sort("updated_at", -1)
        .limit(recent_items_limit)
    )
    recent_items: List[Dict[str, Any]] = []
    for doc in recent_docs:
        recent_items.append(
            {
                "lead_id": str(doc.get("lead_id")),
                "scoring_status": str(doc.get("scoring_status", "unknown")),
                "combined_score": float(doc.get("market_total_score", 0)) if doc.get("market_total_score") is not None else None,
                "updated_at": doc.get("updated_at"),
                "description_preview": _extract_description_preview(doc.get("component_descriptions")),
            }
        )

    return {
        "org_id": org_id,
        "run_id": target_run_id,
        "processing_status": str(run_doc.get("status", "idle")),
        "processed_leads": processed_leads,
        "total_leads": total_leads,
        "processed_with_descriptions": int(processed_with_descriptions),
        "failed_count": failed_count,
        "progress_percent": progress_percent,
        "started_at": run_doc.get("started_at"),
        "updated_at": run_doc.get("updated_at"),
        "completed_at": run_doc.get("completed_at"),
        "recent_items": recent_items,
    }
```

Note: `recent_items` is now a `List[Dict[str, Any]]` instead of `List[LeadMarketScoreStatusItem]`. FastAPI will coerce when validating against `response_model=LeadMarketScoringStatusResponse` in the router.

- [ ] **Step 2: Update the router handler**

In `app/routers/market_scoring.py`, replace the entire body of `get_lead_market_scores_status` with a single delegation:

```python
@router.get("/leads/market-scores/status", response_model=LeadMarketScoringStatusResponse)
async def get_lead_market_scores_status(
    user_id: str = Query(...),
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    recent_items_limit: int = Query(10, ge=1, le=100),
):
    return market_scoring_service.get_market_scores_status(
        user_id=user_id, org_id=org_id, run_id=run_id, recent_items_limit=recent_items_limit,
    )
```

Remove the router-side import of `LeadMarketScoreStatusItem` if no other handler uses it (after Task 7 the router doesn't construct these directly any more). Verify by grep before deleting.

- [ ] **Step 3: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/routers/market_scoring.py
git commit -m "refactor(be): extract get_market_scores_status into service layer

Mirror of the previous commit for the status endpoint. Service returns
Dict matching LeadMarketScoringStatusResponse; recent_items is a list
of dicts (FastAPI coerces to LeadMarketScoreStatusItem during
response_model validation)."
```

---

## Task 8: Extract get_lead_market_score_descriptions into service (Item 5c)

**Files:**
- Modify: `app/services/market_scoring.py` (add new function)
- Modify: `app/routers/market_scoring.py` (the third endpoint handler)

**Context:** Smallest of the three endpoints. Look up a single lead's score row and shape the component-description dict.

- [ ] **Step 1: Add the service function**

In `app/services/market_scoring.py`, below `get_market_scores_status`, add:

```python
def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str,
    org_id: str,
) -> Dict[str, Any]:
    """Return the component descriptions for a single lead's scoring.

    Returns a dict matching the LeadMarketScoreDescriptionsResponse schema.
    Raises HTTPException(404) if the lead has no scoring document.
    """
    score_coll, _ = _get_market_score_collections()
    doc = score_coll.find_one({"org_id": org_id, "lead_id": lead_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead scoring descriptions not found")

    descriptions = doc.get("component_descriptions", {})
    if not isinstance(descriptions, dict):
        descriptions = {}

    normalized_descriptions = {
        key: str(descriptions.get(key, "Description not available"))
        for key in MARKET_SCORE_COMPONENT_KEYS
    }
    return {
        "lead_id": lead_id,
        "org_id": org_id,
        "combined_score": float(doc.get("market_total_score", 0)),
        "scored_at": doc.get("scored_at") or doc.get("updated_at"),
        "descriptions": normalized_descriptions,
    }
```

- [ ] **Step 2: Update the router handler**

In `app/routers/market_scoring.py`, replace the handler body:

```python
@router.get("/leads/{lead_id}/market-score-descriptions", response_model=LeadMarketScoreDescriptionsResponse)
async def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
):
    return market_scoring_service.get_lead_market_score_descriptions(
        lead_id=lead_id, user_id=user_id, org_id=org_id,
    )
```

After this task, the router should be ~25-30 lines total. Confirm:
```bash
wc -l app/routers/market_scoring.py
```
Expected: ~30 (target per spec §6). If significantly larger, double-check that nothing was left inlined in the handlers.

- [ ] **Step 3: Remove now-unused router imports**

After the three handlers are all thin wrappers, the router likely has imports it no longer needs. Common candidates: `uuid`, `datetime`, `timezone`, `LeadMarketScoreStatusItem`. Visually scan and delete any that have no remaining usage. Use Python parsing or just grep each candidate name within the file.

- [ ] **Step 4: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/routers/market_scoring.py
git commit -m "refactor(be): extract get_lead_market_score_descriptions into service layer

Completes the market_scoring router extraction. All three endpoints
now delegate to service functions; the router is ~30 LOC of HTTP
wiring only, matching the leads/icp/signals/documents convention from
Phase B."
```

---

## Task 9: Move create_index calls to a guarded startup event (Item 5d)

**Files:**
- Modify: `app/services/market_scoring.py:_get_market_score_collections` (remove the 4 `create_index` calls)
- Modify: `app/main.py` (add startup event)

**Context:** Today `_get_market_score_collections` calls `create_index` four times per request. MongoDB's `createIndex` is idempotent, but each call still issues a round-trip. Move to a one-time startup event in `app/main.py`. Critical: must be guarded by `BREWRA_SKIP_DB_INIT` (or equivalently `clients.client is None`) — pytest sessions in sandboxes have this env var set and `client` mocked, so the startup hook must not attempt real Mongo calls during tests.

- [ ] **Step 1: Remove `create_index` calls from `_get_market_score_collections`**

In `app/services/market_scoring.py`, the function (around line 40 — earlier line 40-49 before this task's edits) should currently look like:

```python
def _get_market_score_collections():
    # Returns only the collections — never the client. Callers MUST NOT close
    # the underlying connection; it is the shared singleton from app.core.clients.
    profiler_db = clients.client["Profiler"]
    score_coll = profiler_db["Lead_Market_Scores"]
    run_coll = profiler_db["Lead_Market_Score_Runs"]
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
    return score_coll, run_coll
```

Change to:
```python
def _get_market_score_collections():
    # Returns only the collections — never the client. Callers MUST NOT close
    # the underlying connection; it is the shared singleton from app.core.clients.
    # Index creation has moved to a startup event in app/main.py.
    profiler_db = clients.client["Profiler"]
    return profiler_db["Lead_Market_Scores"], profiler_db["Lead_Market_Score_Runs"]
```

- [ ] **Step 2: Add a startup event in `app/main.py`**

At the end of `app/main.py` (after the existing `clients.graph.refresh_schema()` guard at lines 81-82), add:

```python
# Phase C: one-time index creation on startup. Guarded same as
# graph.refresh_schema() above so test sandboxes (BREWRA_SKIP_DB_INIT=1,
# client mocked to None) don't try to issue real Mongo round-trips.
@app.on_event("startup")
def _ensure_market_scoring_indexes() -> None:
    if clients.client is None:
        return
    profiler_db = clients.client["Profiler"]
    score_coll = profiler_db["Lead_Market_Scores"]
    run_coll = profiler_db["Lead_Market_Score_Runs"]
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
```

Note: `@app.on_event("startup")` is deprecated in FastAPI 0.93+ in favor of the lifespan context manager pattern, but the rest of this codebase has not migrated to lifespan yet, and the deprecation warning is non-fatal. Using `on_event` here matches the file's existing style (the `refresh_schema()` call at line 82 is implicitly module-level, not a lifespan handler — even more divergent). A future phase can migrate the whole file to lifespan.

- [ ] **Step 3: Run tests**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`. The mocked `clients.client` in `mock_mongo` fixture is a `MagicMock`, not `None`, so the guard's `if clients.client is None` returns False and the startup function runs against the mock. The mock's `create_index` calls succeed silently. Verify this with:
```bash
pytest tests/test_market_scoring.py -v 2>&1 | tail -10
```

If the mock setup causes a problem (e.g., the `[...]` subscript on a `MagicMock` doesn't return the chain expected by `create_index`), then the guard should be tightened. Safe form to use instead:
```python
@app.on_event("startup")
def _ensure_market_scoring_indexes() -> None:
    import os
    if os.getenv("BREWRA_SKIP_DB_INIT") or clients.client is None:
        return
    # ... body unchanged
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/main.py
git commit -m "perf(be): move market-scoring create_index calls to startup event

Previously _get_market_score_collections() called create_index four
times per request. MongoDB createIndex is idempotent but each call is
a round-trip. Moved to a FastAPI startup event guarded by
clients.client is None so test sandboxes (BREWRA_SKIP_DB_INIT=1) and
any other no-Mongo configurations skip the calls.

Code-review H2 (post-Phase-B) flagged this."
```

---

## Task 10: Final acceptance check

- [ ] **Step 1: Verify all spec acceptance criteria (§6 of the spec)**

Run from `backend/`:

```bash
# Criterion 3.1: router LOC drops to ~30
wc -l app/routers/market_scoring.py
# Expected: somewhere in [25, 35]

# Criterion 3.2: BrewraError gone, other two reparented
grep "class " app/core/exceptions.py
# Expected: two lines, both inheriting (Exception), no BrewraError

# Criterion 3.3: profiler_client + helper fully gone
grep -rn "profiler_client\|_get_profiler_mongo_client" app/ tests/
# Expected: no output

# Criterion 3.4: fetch_leads_for_org gone, single get_leads_for_org
grep -rn "fetch_leads_for_org" app/
# Expected: no output
grep -n "def get_leads_for_org\|def get_all_leads" app/services/leads.py
# Expected: only get_leads_for_org

# Criterion 3.5: 429 body is a JSON object (manual check; tests cover most of this)
grep -n "detail=str(e)\|detail=e.args\[0\]" app/routers/*.py
# Expected: 3 lines with detail=e.args[0] in signals.py(×2) and market_research.py(×1);
# ICP router still has 3 detail=str(e) catches (intentional — ICPIdRegistryError carries a string)
```

- [ ] **Step 2: Verify test count and warning count**

```bash
pytest 2>&1 | tail -3
```
Expected: `93 passed`. Warning count may stay at 9 or change slightly if the `on_event` deprecation warning surfaces — record either way.

- [ ] **Step 3: Verify commit shape**

```bash
git log master..HEAD --oneline
```
Expected: 8-10 commits, each with a clear `fix(be)` / `refactor(be)` / `perf(be)` prefix and a focused subject. Confirm:
- 1 commit for Task 1 (extract_number)
- 1 commit for Task 2 (profiler_client callers)
- 1 commit for Task 3 (alias deletion)
- 1 commit for Task 4 (leads consolidation)
- 1 commit for Task 5 (BrewraError + 429 body)
- 3 commits for Tasks 6-8 (market_scoring extraction)
- 1 commit for Task 9 (create_index startup)

Total: 9 commits.

- [ ] **Step 4: Note any new debt for Phase D**

If implementation surfaced any new issues that don't fit Phase C's scope, append them to `/specs/2026-05-22-backend-modularization-phase-c-design.md` §8 (Phase D+ inventory). Spec edit + commit on the same branch is fine.

- [ ] **Step 5: Phase C is complete**

No final commit step — Phase C is done when all task commits land and the acceptance grep is clean. The next step is a final code-review pass (out of scope for this plan) and merge to master.
