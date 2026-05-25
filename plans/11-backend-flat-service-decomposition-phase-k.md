# Backend Flat Service Decomposition Phase K Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the six remaining flat service files under `backend/app/services/` (`leads`, `customer_profile`, `profiles`, `org_auth`, `graph_chat`, `pipeline`) into packages with `__init__.py` re-export modules, following the Phase H decomposition pattern. Also extracts `probe_llm` from `pipeline.py` to a new flat `services/health.py` (pre-decomposition cleanup for Sequence F).

**Architecture:** Six per-service sequences (A–F) execute in order, largest-first. Each sequence is normally a 2-commit pair (scaffold → split); Sequence F is a 3-commit triple (extract probe_llm → scaffold → split). Sequence B's split commit additionally retargets 6 `mocker.patch` strings in `test_customer_profile.py` to the new submodule binding (bundled in one commit to avoid a red-pytest window). No production behavior changes — pure structural moves and one router edit (`routers/pipeline.py`).

**Tech Stack:** Python 3.12, FastAPI, pytest, pytest-mock, syrupy. No new dependencies.

**Spec:** `specs/11-backend-flat-service-decomposition-phase-k-design.md` (round 0 + round 1 + round 2 synthesis applied; status "design approved").

**Branch:** `refactor-backend-flat-service-decomposition-phase-k` off `master` (current HEAD at plan-writing time: `4d5937e docs(specs): apply review round 2 synthesis to Phase K spec`).

**Baseline (measured at plan-writing time):** 248 behavior tests passing, 19 syrupy snapshots passing. Verified by `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` on master `4d5937e`.

**Target:** 248 tests passing + 19 snapshots after every commit. Phase K is purely structural — no test should be added, removed, or change outcome. If the count drifts, halt.

**Commit numbering convention:** `<type>(be): <description> [phase K, commit N/13]`. 13 total commits.

**Greenness invariant:** Every commit ends with `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` clean. No "fix in next commit" exceptions. Any test failure during a task: do not commit. Either fix forward, or `git reset --hard HEAD` (working-tree changes are uncommitted; safe to discard) and re-read the step. Never commit a red state.

**Abort criterion:** If any commit drops the test count below the 248-passed / 19-snapshot baseline, halt and surface to operator. Structural moves shouldn't change test count.

**Commit-message footer policy:** No `Co-Authored-By: Claude` footer on commits — user preference recorded in `~/.claude/projects/-projects-Brewra/memory/`.

---

## Pre-flight (one-time setup, no commit)

### Task 0a: Verify master state and create branch

- [ ] **Step 1: Confirm clean tree on master**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                # expected: nothing to commit, working tree clean
git rev-parse --abbrev-ref HEAD           # expected: master
git log --oneline -1                      # expected: 4d5937e docs(specs): apply review round 2 synthesis to Phase K spec
```

If status is not clean or HEAD is not master with the Phase K synthesis commit at the top, surface to operator. Do not proceed.

- [ ] **Step 2: Create the Phase K branch**

```bash
git checkout -b refactor-backend-flat-service-decomposition-phase-k
git branch --show-current                 # expected: refactor-backend-flat-service-decomposition-phase-k
```

### Task 0b: Record the test baseline

- [ ] **Step 1: Run the full suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected output (last 2 lines):
```
19 snapshots passed.
============== 248 passed, <N> warnings in <X>s ==============
```

- [ ] **Step 2: Confirm the numbers**

If the line does not say `248 passed` and `19 snapshots passed`, halt and surface to the operator — the baseline has drifted from what was measured at plan-writing time (`master @ 4d5937e`), and the abort criterion may need recalibration before proceeding.

If the numbers match, proceed.

### Task 0c: Confirm the per-sequence patch surface matches the spec inventory

The spec's §4 patch inventory lists which test files patch which symbols using `mocker.patch`. Running the per-service grep up front (in one batch) catches any drift between spec and current code before sequences begin.

- [ ] **Step 1: Run all six greps**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for svc in leads customer_profile profiles org_auth graph_chat pipeline; do
  echo "=== $svc ==="
  grep -rnE --include='*.py' "\"app\.services\.${svc}" backend/tests/ || echo "(no matches)"
done
```

The grep matches the patch-target string itself (`"app.services.<svc>...`) anchored to the opening quote. This catches both single-line patches (e.g., `mocker.patch("app.services.foo._bar")`) and multi-line patches (where the string sits on its own indented line after `mocker.patch(`). The spec §4's `mocker\.patch.*app\.services\.<svc>` pattern only matches single-line patches; the quoted-string pattern used here covers both forms.

- [ ] **Step 2: Verify the output matches expectations**

Expected (verbatim, line numbers are from `backend/tests/unit/test_customer_profile.py` on `4d5937e`):

```
=== leads ===
(no matches)
=== customer_profile ===
backend/tests/unit/test_customer_profile.py:49:        "app.services.customer_profile._reserve_unique_icp_id",
backend/tests/unit/test_customer_profile.py:92:        "app.services.customer_profile._reserve_unique_icp_id",
backend/tests/unit/test_customer_profile.py:129:        "app.services.customer_profile._reserve_unique_icp_id",
backend/tests/unit/test_customer_profile.py:188:        "app.services.customer_profile._reserve_unique_icp_id",
backend/tests/unit/test_customer_profile.py:244:    mocker.patch("app.services.customer_profile._release_icp_id")
backend/tests/unit/test_customer_profile.py:262:    release_mock = mocker.patch("app.services.customer_profile._release_icp_id")
=== profiles ===
(no matches)
=== org_auth ===
(no matches)
=== graph_chat ===
(no matches)
=== pipeline ===
(no matches)
```

Lines 49, 92, 129, 188 are the patch-string lines inside 4-line multi-line `mocker.patch(...)` calls (the `mocker.patch(` token itself is on line 48, 91, 128, 187 respectively). Lines 244 and 262 are single-line patches. Total: 6 patch sites in `customer_profile` matching spec §4.

If grep output diverges from the expected (extra patches, missing patches, different line numbers), halt and surface to operator before proceeding. Otherwise the spec inventory is current and sequences A–F can execute as planned.

---

## Sequence A — leads (commits 1-2)

`leads.py` (465 LOC, 10 functions: 8 public + 2 private) decomposes into three submodules: `orchestrator.py` (2 orchestration flows), `persistence.py` (7 DB read/write functions), `normalization.py` (1 private data-transformation helper).

No test patches reference `app.services.leads.*`; tests inject mock drivers as arguments. The split is mechanical.

### Task A.1: Scaffold the leads package (commit 1/13)

**Files:**
- Create directory: `backend/app/services/leads/`
- Modify (via `git mv`): `backend/app/services/leads.py` → `backend/app/services/leads/__init__.py`

- [ ] **Step 1: Confirm the per-service grep (no surprises)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.leads" backend/tests/ || echo "(no matches)"
```

Expected: `(no matches)` — Sequence A has zero patch surface to migrate.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/leads
git mv backend/app/services/leads.py backend/app/services/leads/__init__.py
```

(`git mv` does not create intermediate directories, so the `mkdir` step is required.)

- [ ] **Step 3: Verify the move**

```bash
ls backend/app/services/leads/
git status
```

Expected `ls`: `__init__.py`.
Expected `git status` shows one rename: `leads.py -> leads/__init__.py`.

- [ ] **Step 4: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. The file is now reachable via `app.services.leads` (the package), and Python resolves the same module contents through `__init__.py`. No caller needs to change.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/leads/
git commit -m "refactor(be): scaffold leads package [phase K, commit 1/13]"
```

### Task A.2: Split leads into orchestrator / persistence / normalization (commit 2/13)

**Files:**
- Create: `backend/app/services/leads/orchestrator.py`
- Create: `backend/app/services/leads/persistence.py`
- Create: `backend/app/services/leads/normalization.py`
- Modify: `backend/app/services/leads/__init__.py` (rewrite as pure re-export)

The current `leads/__init__.py` (formerly `leads.py`) contains 10 functions across lines 14–465. The split is by responsibility:

| Function | Lines (in current `__init__.py`) | Destination |
|---|---:|---|
| `_ensure_leads_indexes` | 14–20 | `persistence.py` |
| `get_leads_for_org` | 27–57 | `persistence.py` |
| `_process_neo4j_lead_records` | 64–80 | `normalization.py` |
| `create_lead` | 88–125 | `persistence.py` |
| `update_lead` | 128–163 | `persistence.py` |
| `delete_lead` | 166–197 | `persistence.py` |
| `batch_upload_leads` | 200–354 | `orchestrator.py` |
| `list_leads_by_file` | 357–387 | `persistence.py` |
| `get_stream_status` | 390–410 | `persistence.py` |
| `delete_leads_by_file` | 413–465 | `orchestrator.py` |

- [ ] **Step 1: Create `leads/normalization.py`**

Create `backend/app/services/leads/normalization.py` with the following header, then append the body of `_process_neo4j_lead_records` (lines 64–80 of the current `leads/__init__.py`) verbatim — copy the function definition, its docstring, and its body exactly as written.

```python
"""Lead-record normalization helpers (private)."""
import json
from typing import Any, Dict, List


# --- copy _process_neo4j_lead_records from leads/__init__.py lines 64-80 below ---
```

(Drop the trailing `# --- ... ---` comment after pasting the function. It's a marker only, not part of the final file.)

- [ ] **Step 2: Create `leads/persistence.py`**

Create `backend/app/services/leads/persistence.py` with this header, then append the seven functions in order: `_ensure_leads_indexes`, `get_leads_for_org`, `create_lead`, `update_lead`, `delete_lead`, `list_leads_by_file`, `get_stream_status` — copied verbatim from the corresponding lines of `leads/__init__.py` listed in the table above.

```python
"""Lead persistence — direct Neo4j/Mongo reads and writes."""
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import LeadNotFoundError
from app.models.leads import LeadCreateRequest, LeadUpdateRequest

from .normalization import _process_neo4j_lead_records


# --- copy _ensure_leads_indexes, get_leads_for_org, create_lead, update_lead,
#     delete_lead, list_leads_by_file, get_stream_status verbatim below ---
```

The `from .normalization import _process_neo4j_lead_records` line is the only new import. Its two call sites are inside `get_leads_for_org` and `list_leads_by_file`, both destined for `persistence.py`. From-import is safe here because `_process_neo4j_lead_records` is never patched in any test.

- [ ] **Step 3: Create `leads/orchestrator.py`**

Create `backend/app/services/leads/orchestrator.py` with this header, then append `batch_upload_leads` (lines 200–354) and `delete_leads_by_file` (lines 413–465) verbatim.

```python
"""Lead orchestration flows — multi-step CSV upload and bulk delete."""
from datetime import datetime, timezone
from typing import Any, Dict

from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import LeadCSVValidationError, LeadNotFoundError
from app.core.logging import logger


# --- copy batch_upload_leads and delete_leads_by_file verbatim below ---
```

`batch_upload_leads` performs inline imports inside its body (`pandas`, `uuid`, `tempfile`, `os`); leave those inline — do not hoist them. The function already imports them lazily for cold-start performance.

- [ ] **Step 4: Rewrite `leads/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/leads/__init__.py` (the old `leads.py` body — now redundant since its functions live in the new submodules) with:

```python
"""leads service — public API.

Service for lead CRUD + bulk CSV/XLSX upload + lead-stream registry.
Submodules:
  - orchestrator.py: batch_upload_leads, delete_leads_by_file
  - persistence.py: _ensure_leads_indexes, get_leads_for_org, create_lead,
    update_lead, delete_lead, list_leads_by_file, get_stream_status
  - normalization.py: _process_neo4j_lead_records (private — not re-exported)

_-prefix helpers re-exported below for external callers that import via the
package path: _ensure_leads_indexes (app/main.py lifespan). Tests patching
these for those callers target the caller's namespace (e.g.,
app.main._ensure_leads_indexes), per patch-where-used.
"""

from app.services.leads.orchestrator import (
    batch_upload_leads,
    delete_leads_by_file,
)
from app.services.leads.persistence import (
    _ensure_leads_indexes,
    get_leads_for_org,
    create_lead,
    update_lead,
    delete_lead,
    list_leads_by_file,
    get_stream_status,
)
```

`_process_neo4j_lead_records` is intentionally NOT re-exported — it's a private helper used only inside `persistence.py`.

- [ ] **Step 5: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. All external callers (listed in spec §5: `app/main.py`, `app/routers/v2/leads.py`, `market_scoring/scoring.py`, `market_scoring/orchestrator.py`, `signals/search.py`, `signals/batch.py`, `app/routers/leads.py`) continue to work unchanged because the import paths are preserved and `__init__.py` re-exports every public symbol they reference.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/leads/
git commit -m "refactor(be): split leads into orchestrator/persistence/normalization [phase K, commit 2/13]"
```

---

## Sequence B — customer_profile (commits 3-4)

`customer_profile.py` (385 LOC, 4 functions) decomposes into a single submodule `orchestrator.py`. All 4 public functions live there because they share the same `_reserve_unique_icp_id` import from `app.services.icp` and splitting them would force duplicating that import and splitting the 6 test patch paths across two binding addresses.

**Bundle the split + patch retarget in one commit.** The 6 `mocker.patch` strings in `test_customer_profile.py` currently target `app.services.customer_profile._reserve_unique_icp_id` and `..._release_icp_id`. After the split, that binding moves to `app.services.customer_profile.orchestrator.*`. If the structural split commit lands without the patch-string update, pytest goes red between commits — violating the greenness invariant. Hence one commit.

### Task B.1: Scaffold the customer_profile package (commit 3/13)

**Files:**
- Create directory: `backend/app/services/customer_profile/`
- Modify (via `git mv`): `backend/app/services/customer_profile.py` → `backend/app/services/customer_profile/__init__.py`

- [ ] **Step 1: Confirm the per-service grep (6 patch sites expected)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.customer_profile" backend/tests/
```

Expected: 6 hits across `backend/tests/unit/test_customer_profile.py` at lines 49, 92, 129, 188, 244, 262 (matches Task 0c). If the count differs, halt — the spec's patch inventory needs reconciliation.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/customer_profile
git mv backend/app/services/customer_profile.py backend/app/services/customer_profile/__init__.py
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. The 6 patch strings `app.services.customer_profile._reserve_unique_icp_id` / `..._release_icp_id` still resolve correctly because both symbols are still in the package's top-level namespace (they're module-level from-imports at the top of the file, which `__init__.py` inherits unchanged after the rename).

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/customer_profile/
git commit -m "refactor(be): scaffold customer_profile package [phase K, commit 3/13]"
```

### Task B.2: Split customer_profile into orchestrator + retarget 6 patch paths (commit 4/13)

**Files:**
- Create: `backend/app/services/customer_profile/orchestrator.py`
- Modify: `backend/app/services/customer_profile/__init__.py` (rewrite as pure re-export)
- Modify: `backend/tests/unit/test_customer_profile.py` (6 patch-string retargets)

The current `customer_profile/__init__.py` contains 4 functions: `upsert_customer_profile` (16–130), `get_customer_profile` (133–208), `create_from_suggested_icp` (211–345), `delete_icp_from_customer_profile` (348–385). All move to `orchestrator.py`.

- [ ] **Step 1: Create `customer_profile/orchestrator.py`**

Create `backend/app/services/customer_profile/orchestrator.py` with this header, then append all 4 functions verbatim from the lines above.

```python
"""Customer profile orchestration — ICP CRUD + suggested-ICP-to-customer-profile flow."""
import json
from datetime import datetime, timezone

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    CustomerProfileICPNotFoundError,
    CustomerProfileNotFoundError,
    ICPAlreadyExistsError,
    SuggestedICPNotFoundError,
)
from app.models.customer_profile import (
    CustomerProfileRequest,
    SuggestedICPToCustomerProfileRequest,
)
from app.services.icp import _reserve_unique_icp_id, _release_icp_id


# --- copy upsert_customer_profile, get_customer_profile,
#     create_from_suggested_icp, delete_icp_from_customer_profile verbatim below ---
```

The `from app.services.icp import _reserve_unique_icp_id, _release_icp_id` line stays as module-level from-imports. The binding lives in `orchestrator.__dict__` — the "patch where used" rule is satisfied by targeting `orchestrator._reserve_unique_icp_id` in tests (Step 3 below).

- [ ] **Step 2: Rewrite `customer_profile/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/customer_profile/__init__.py` with:

```python
"""customer_profile service — public API.

Service for customer profile (ICP) CRUD on MongoDB + suggested-ICP
promotion flow that pulls from app.services.icp and persists into the
Profiler database. Single submodule because all 4 functions share the
same _reserve_unique_icp_id / _release_icp_id binding from app.services.icp.

Submodules:
  - orchestrator.py: upsert_customer_profile, get_customer_profile,
    create_from_suggested_icp, delete_icp_from_customer_profile
"""

from app.services.customer_profile.orchestrator import (
    upsert_customer_profile,
    get_customer_profile,
    create_from_suggested_icp,
    delete_icp_from_customer_profile,
)
```

- [ ] **Step 3: Retarget the 6 patch strings in `test_customer_profile.py` + update the file's docstring**

Open `backend/tests/unit/test_customer_profile.py` and make two sets of edits, both in the same file.

**3a. Update the module docstring (lines 1–10).** The current docstring references `app/services/customer_profile.py` and the patch path `app.services.customer_profile.<helper>` — both become wrong after the split. Replace the docstring at the top of the file with:

```python
# backend/tests/unit/test_customer_profile.py
"""Unit tests for app/services/customer_profile/.

Covers all four public functions plus the 5 typed-exception sites.

Cross-service mocking note: customer_profile/orchestrator.py imports icp
helpers at the module level. Because _reserve_unique_icp_id and
_release_icp_id are top-level imports in orchestrator.py, they are bound
in customer_profile.orchestrator's namespace. The correct patch target is
app.services.customer_profile.orchestrator.<helper>, not
app.services.icp.<helper>.
"""
```

**3b. Retarget the 6 `mocker.patch(...)` calls.** The 4 `_reserve_unique_icp_id` patches are multi-line and follow this shape:

Before (lines 48–51, 91–94, 128–131, 187–190):
```python
    mocker.patch(
        "app.services.customer_profile._reserve_unique_icp_id",
        ...,
    )
```

After:
```python
    mocker.patch(
        "app.services.customer_profile.orchestrator._reserve_unique_icp_id",
        ...,
    )
```

The 2 `_release_icp_id` patches are single-line. Before:
```python
    mocker.patch("app.services.customer_profile._release_icp_id")          # line 244
    release_mock = mocker.patch("app.services.customer_profile._release_icp_id")   # line 262
```

After:
```python
    mocker.patch("app.services.customer_profile.orchestrator._release_icp_id")
    release_mock = mocker.patch("app.services.customer_profile.orchestrator._release_icp_id")
```

To confirm exactly 6 string substitutions:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "app\.services\.customer_profile\.orchestrator\._" backend/tests/unit/test_customer_profile.py
```

Expected: 6 matches (4 for `_reserve_unique_icp_id`, 2 for `_release_icp_id`).

```bash
grep -n "app\.services\.customer_profile\._reserve_unique_icp_id\|app\.services\.customer_profile\._release_icp_id" backend/tests/unit/test_customer_profile.py
```

Expected (after the retarget): no matches — the old paths must all be replaced. If anything remains, that's a missed retarget; fix before running pytest.

- [ ] **Step 4: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. The patches now intercept `orchestrator._reserve_unique_icp_id` and `orchestrator._release_icp_id`, which are the bindings the moved functions actually call through their module's `__dict__`. Standard "patch where used."

- [ ] **Step 5: Commit (bundled structural split + patch retarget)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/customer_profile/ backend/tests/unit/test_customer_profile.py
git commit -m "refactor(be): split customer_profile into orchestrator + retarget patches [phase K, commit 4/13]"
```

---

## Sequence C — profiles (commits 5-6)

`profiles.py` (236 LOC, 4 functions, all DB operations) decomposes into a single submodule `persistence.py`. No tests patch `app.services.profiles.*` — tests inject mock drivers directly.

### Task C.1: Scaffold the profiles package (commit 5/13)

**Files:**
- Create directory: `backend/app/services/profiles/`
- Modify (via `git mv`): `backend/app/services/profiles.py` → `backend/app/services/profiles/__init__.py`

- [ ] **Step 1: Confirm the per-service grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.profiles" backend/tests/ || echo "(no matches)"
```

Expected: `(no matches)`.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/profiles
git mv backend/app/services/profiles.py backend/app/services/profiles/__init__.py
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/profiles/
git commit -m "refactor(be): scaffold profiles package [phase K, commit 5/13]"
```

### Task C.2: Split profiles into persistence (commit 6/13)

**Files:**
- Create: `backend/app/services/profiles/persistence.py`
- Modify: `backend/app/services/profiles/__init__.py` (rewrite as pure re-export)

The current `profiles/__init__.py` contains 4 functions: `upsert_profile` (15–110), `get_profile` (113–181), `cleanup_company_profiles` (184–211), `edit_profile_field` (214–236). All move to `persistence.py`.

- [ ] **Step 1: Create `profiles/persistence.py`**

Create `backend/app/services/profiles/persistence.py` with this header, then append all 4 functions verbatim.

```python
"""Profile persistence — Neo4j and Mongo CRUD for company/user/agent profiles."""
import json
from datetime import datetime, timezone
from typing import Optional

from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ProfileNotFoundError,
    ProfileValidationError,
)
from app.models.profiles import EditRequest


# --- copy upsert_profile, get_profile, cleanup_company_profiles,
#     edit_profile_field verbatim below ---
```

- [ ] **Step 2: Rewrite `profiles/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/profiles/__init__.py` with:

```python
"""profiles service — public API.

Service for company/user/agent profile CRUD across Neo4j (graph) and
Mongo (per-org configuration). No orchestration tier — all four
functions are direct DB operations.

Submodules:
  - persistence.py: upsert_profile, get_profile, cleanup_company_profiles,
    edit_profile_field
"""

from app.services.profiles.persistence import (
    upsert_profile,
    get_profile,
    cleanup_company_profiles,
    edit_profile_field,
)
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/profiles/
git commit -m "refactor(be): split profiles into persistence [phase K, commit 6/13]"
```

---

## Sequence D — org_auth (commits 7-8)

`org_auth.py` (210 LOC, 5 functions) decomposes into two submodules by entity: `orgs.py` (3 org-lifecycle functions) and `registrations.py` (2 cross-tenant registration functions). No tests patch `app.services.org_auth.*` — tests inject mock Mongo.

### Task D.1: Scaffold the org_auth package (commit 7/13)

**Files:**
- Create directory: `backend/app/services/org_auth/`
- Modify (via `git mv`): `backend/app/services/org_auth.py` → `backend/app/services/org_auth/__init__.py`

- [ ] **Step 1: Confirm the per-service grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.org_auth" backend/tests/ || echo "(no matches)"
```

Expected: `(no matches)`.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/org_auth
git mv backend/app/services/org_auth.py backend/app/services/org_auth/__init__.py
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/org_auth/
git commit -m "refactor(be): scaffold org_auth package [phase K, commit 7/13]"
```

### Task D.2: Split org_auth into orgs + registrations (commit 8/13)

**Files:**
- Create: `backend/app/services/org_auth/orgs.py`
- Create: `backend/app/services/org_auth/registrations.py`
- Modify: `backend/app/services/org_auth/__init__.py` (rewrite as pure re-export)

The current `org_auth/__init__.py` contains 5 functions:

| Function | Lines (in current `__init__.py`) | Destination |
|---|---:|---|
| `list_orgs` | 10–47 | `orgs.py` |
| `create_org` | 50–111 | `orgs.py` |
| `connect_user_to_org` | 114–153 | `orgs.py` |
| `list_registrations` | 156–182 | `registrations.py` |
| `create_registration` | 185–210 | `registrations.py` |

The two submodules contain disjoint function sets — no cross-calls between them, so no inter-submodule imports needed.

- [ ] **Step 1: Create `org_auth/orgs.py`**

Create `backend/app/services/org_auth/orgs.py` with this header, then append `list_orgs`, `create_org`, `connect_user_to_org` verbatim.

```python
"""Org lifecycle — list orgs for user, create org, connect user-to-org."""
import uuid
from datetime import datetime, timezone
from typing import Dict

from app.core.exceptions import OrgNotFoundError, UsersDocumentNotFoundError


# --- copy list_orgs, create_org, connect_user_to_org verbatim below ---
```

- [ ] **Step 2: Create `org_auth/registrations.py`**

Create `backend/app/services/org_auth/registrations.py` with this header, then append `list_registrations` and `create_registration` verbatim.

```python
"""Registration entries — cross-tenant admin view + per-user registration creation."""
from datetime import datetime, timezone
from typing import List

from app.models.org_auth import RegistrationRequest, RegistrationResponse


# --- copy list_registrations and create_registration verbatim below ---
```

- [ ] **Step 3: Rewrite `org_auth/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/org_auth/__init__.py` with:

```python
"""org_auth service — public API.

Service for org lifecycle (per-user org listing + creation + user-org link)
and admin-only registration entries. Split by entity: orgs.py for the
Org_Management collections, registrations.py for the Registration_DB
collection.

Submodules:
  - orgs.py: list_orgs, create_org, connect_user_to_org
  - registrations.py: list_registrations, create_registration
"""

from app.services.org_auth.orgs import (
    list_orgs,
    create_org,
    connect_user_to_org,
)
from app.services.org_auth.registrations import (
    list_registrations,
    create_registration,
)
```

- [ ] **Step 4: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. External callers (`app/routers/v2/org_auth.py` imports `list_registrations`; `app/routers/org_auth.py` does `from app.services import org_auth as org_auth_service`) continue to work because the re-exports expose all 5 functions at the package's top-level namespace.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/org_auth/
git commit -m "refactor(be): split org_auth into orgs and registrations [phase K, commit 8/13]"
```

---

## Sequence E — graph_chat (commits 9-10)

`graph_chat.py` (209 LOC, 11 functions) decomposes into two submodules: `neo4j.py` (4 graph read/write functions) and `prospect_pipeline.py` (7 prospect-scoring pipeline functions covering audio transcription, LinkedIn enrichment, score calculation, and LLM scoring). No tests patch `app.services.graph_chat.*`.

### Task E.1: Scaffold the graph_chat package (commit 9/13)

**Files:**
- Create directory: `backend/app/services/graph_chat/`
- Modify (via `git mv`): `backend/app/services/graph_chat.py` → `backend/app/services/graph_chat/__init__.py`

- [ ] **Step 1: Confirm the per-service grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.graph_chat" backend/tests/ || echo "(no matches)"
```

Expected: `(no matches)`.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/graph_chat
git mv backend/app/services/graph_chat.py backend/app/services/graph_chat/__init__.py
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/graph_chat/
git commit -m "refactor(be): scaffold graph_chat package [phase K, commit 9/13]"
```

### Task E.2: Split graph_chat into neo4j + prospect_pipeline (commit 10/13)

**Files:**
- Create: `backend/app/services/graph_chat/neo4j.py`
- Create: `backend/app/services/graph_chat/prospect_pipeline.py`
- Modify: `backend/app/services/graph_chat/__init__.py` (rewrite as pure re-export)

The current `graph_chat/__init__.py` contains 11 functions:

| Function | Lines (in current `__init__.py`) | Destination |
|---|---:|---|
| `convert_audio_to_text` | 24–37 | `prospect_pipeline.py` |
| `create_prospect_node` | 40–57 | `neo4j.py` |
| `get_linkedin_followers` | 59–75 | `prospect_pipeline.py` |
| `get_linkedin_recent_activity` | 77–93 | `prospect_pipeline.py` |
| `extract_linkedin_username` | 95–98 | `prospect_pipeline.py` |
| `calculate_prospect_score` | 100–129 | `prospect_pipeline.py` |
| `get_ranked_prospects` | 131–148 | `neo4j.py` |
| `extract_number` | 150–152 | `prospect_pipeline.py` |
| `score_prospect` | 154–182 | `prospect_pipeline.py` |
| `run_cypher_query` | 189–191 | `neo4j.py` |
| `add_engagement` | 194–209 | `neo4j.py` |

`score_prospect` calls `extract_number`; both live in `prospect_pipeline.py`. No cross-submodule calls (`neo4j.py` functions don't call any `prospect_pipeline.py` function and vice versa).

- [ ] **Step 1: Create `graph_chat/neo4j.py`**

Create `backend/app/services/graph_chat/neo4j.py` with this header, then append `create_prospect_node`, `get_ranked_prospects`, `run_cypher_query`, `add_engagement` verbatim from the lines above.

```python
"""Graph read/write operations for the prospect chat surface."""
import json

from app.core.config import PREDEFINED_QUESTIONS
from app.services._neo4j_helpers import query


# --- copy create_prospect_node, get_ranked_prospects, run_cypher_query,
#     add_engagement verbatim below ---
```

`get_ranked_prospects` returns a human-formatted markdown string (a pre-existing data/presentation entanglement noted in spec §3 Sequence E). Phase K does not refactor it — leave the function as-is.

- [ ] **Step 2: Create `graph_chat/prospect_pipeline.py`**

Create `backend/app/services/graph_chat/prospect_pipeline.py` with this header, then append `convert_audio_to_text`, `get_linkedin_followers`, `get_linkedin_recent_activity`, `extract_linkedin_username`, `calculate_prospect_score`, `extract_number`, `score_prospect` verbatim, in that order.

```python
"""Prospect-scoring pipeline — audio transcription, LinkedIn enrichment, score calculation, LLM scoring."""
import re
from typing import Optional

import requests
import speech_recognition as sr
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import rapidapi_key


# --- copy convert_audio_to_text, get_linkedin_followers,
#     get_linkedin_recent_activity, extract_linkedin_username,
#     calculate_prospect_score, extract_number, score_prospect verbatim below ---
```

`score_prospect` calls `extract_number` — both are now in the same module, so the call resolves through `prospect_pipeline.__dict__` without any cross-module import.

- [ ] **Step 3: Rewrite `graph_chat/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/graph_chat/__init__.py` with:

```python
"""graph_chat service — public API.

Service for prospect-chat ingest and scoring. Mixes Neo4j graph operations
(prospect/engagement nodes, ranking) with a multi-step prospect-scoring
pipeline (audio → LinkedIn enrichment → numeric score → LLM scoring).

Submodules:
  - neo4j.py: create_prospect_node, get_ranked_prospects,
    run_cypher_query, add_engagement
  - prospect_pipeline.py: convert_audio_to_text, get_linkedin_followers,
    get_linkedin_recent_activity, extract_linkedin_username,
    calculate_prospect_score, extract_number, score_prospect
"""

from app.services.graph_chat.neo4j import (
    create_prospect_node,
    get_ranked_prospects,
    run_cypher_query,
    add_engagement,
)
from app.services.graph_chat.prospect_pipeline import (
    convert_audio_to_text,
    get_linkedin_followers,
    get_linkedin_recent_activity,
    extract_linkedin_username,
    calculate_prospect_score,
    extract_number,
    score_prospect,
)
```

- [ ] **Step 4: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. External callers (`data_sources/loaders.py` does `from app.services.graph_chat import score_prospect`; `app/routers/graph_chat.py` does `from app.services import graph_chat as graph_chat_service`) continue to work because both forms are satisfied by the re-export block.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/graph_chat/
git commit -m "refactor(be): split graph_chat into neo4j and prospect_pipeline [phase K, commit 10/13]"
```

---

## Sequence F — pipeline (commits 11-13)

`pipeline.py` (74 LOC, 2 functions: `compute_sales_pipeline` Neo4j read + `probe_llm` langchain probe) is the smallest service but requires a 3-commit sequence. Commit 11 extracts `probe_llm` to a new flat `services/health.py` (so the resulting `pipeline/` package contains only the Neo4j read, avoiding a categorical mismatch). Commits 12 and 13 then scaffold + split the trimmed `pipeline.py` following the standard pattern.

### Task F.0: Extract probe_llm to services/health.py (commit 11/13)

**Files:**
- Create: `backend/app/services/health.py`
- Modify: `backend/app/services/pipeline.py` (remove `probe_llm`, update docstring)
- Modify: `backend/app/routers/pipeline.py` (add `from app.services.health import probe_llm`; update `/test-llm` handler call site)

- [ ] **Step 1: Create `backend/app/services/health.py`**

Create the file with this exact content. The body of `probe_llm` is copied verbatim from `backend/app/services/pipeline.py` lines 64–74 (current file at master `4d5937e`).

```python
"""Health/diagnostic probes — small smoke functions for /test-* endpoints."""
from typing import Dict


def probe_llm(llm2) -> Dict[str, str]:
    """LLM-availability smoke probe. Returns a small dict."""
    try:
        from langchain_core.messages import HumanMessage

        test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"
        messages = [HumanMessage(content=test_prompt)]
        response = llm2.invoke(messages)
        return {"status": "success", "response": str(response.content)}
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

The lazy `from langchain_core.messages import HumanMessage` inside the function body is preserved — the lazy-import linter (see Task 14) only flags `from app.services.*` imports, so this langchain import does not require any annotation.

`health.py` is intentionally a flat file, not a package. The uniformity decision in spec §1 applies only to the six *existing* flat services; new services like `health.py` follow normal sizing rules, and a 1-function file does not justify package overhead.

- [ ] **Step 2: Edit `backend/app/services/pipeline.py` — remove `probe_llm` and update the docstring**

Replace the entire contents of `backend/app/services/pipeline.py` with:

```python
"""Pipeline service: sales-pipeline aggregator."""
from datetime import datetime, timedelta, timezone
from typing import Dict

from app.core.config import STAGE_ORDER, STAGE_MAPPING
from app.models.pipeline import SalesPipelineResponse, TimeframeResponse, StageStats


def compute_sales_pipeline(driver, user_id: str, timeframe: int) -> SalesPipelineResponse:
    """Aggregate lead stage counts from Neo4j for the given user/timeframe."""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=timeframe)

    query_string = """
    MATCH (l:Lead)
    WHERE l.last_stage_update_date >= $start_date AND l.last_stage_update_date <= $end_date
    RETURN l.stage AS stage, count(*) AS count
    """

    with driver.session() as session:
        results = session.run(query_string, {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        })

        # Count occurrences per mapped UI stage
        ui_stage_counts: Dict[str, int] = {stage: 0 for stage in STAGE_ORDER}

        for record in results:
            neo4j_stage = record["stage"]
            count = record["count"]
            mapped_stage = STAGE_MAPPING.get(neo4j_stage)
            if mapped_stage in ui_stage_counts:
                ui_stage_counts[mapped_stage] += count

        # Build ordered stage data and calculate conversion rates
        ordered_counts = [ui_stage_counts[stage] for stage in STAGE_ORDER]

        stages = []
        for i, stage in enumerate(STAGE_ORDER):
            count = ordered_counts[i]
            if i == 0:
                conversion = 1.0
            else:
                prev = ordered_counts[i - 1]
                conversion = round(count / prev, 2) if prev > 0 else 0.0

            stages.append(StageStats(
                name=stage,
                count=count,
                conversionRate=conversion,
            ))

        return SalesPipelineResponse(
            timeframes=[
                TimeframeResponse(
                    days=timeframe,
                    stages=stages,
                )
            ]
        )
```

Two changes vs. the current file:
1. Docstring: `"""Pipeline service: sales-pipeline aggregator + LLM probe."""` → `"""Pipeline service: sales-pipeline aggregator."""` (removes "+ LLM probe").
2. The entire `probe_llm` function (current lines 64–74) is removed.

The `compute_sales_pipeline` function body is unchanged.

- [ ] **Step 3: Edit `backend/app/routers/pipeline.py` — add health import + update call site**

Replace the entire contents of `backend/app/routers/pipeline.py` with:

```python
"""Pipeline router: HTTP wiring for sales pipeline + LLM probe."""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_llm2, get_neo4j_driver
from app.services import pipeline as pipeline_service
from app.services.health import probe_llm
from app.models.pipeline import SalesPipelineResponse

router = APIRouter(tags=["pipeline"])


@router.get("/Sales_Pipeline", response_model=SalesPipelineResponse)
def get_sales_pipeline(
    user_id: str = Query(...),
    timeframe: int = Query(...),
    driver=Depends(get_neo4j_driver),
) -> SalesPipelineResponse:
    return pipeline_service.compute_sales_pipeline(driver, user_id=user_id, timeframe=timeframe)


# /test-llm is a diagnostic; response shape is informal (status + raw model output).
@router.get("/test-llm")
async def test_llm(llm2=Depends(get_llm2)):
    """LLM-availability diagnostic. Response shape is informal."""
    return probe_llm(llm2)
```

Two changes vs. the current file:
1. A new import added after the existing `from app.services import pipeline as pipeline_service` line: `from app.services.health import probe_llm`. The two `from app.services...` imports sit adjacently in the import block.
2. The `/test-llm` handler body changed: `return pipeline_service.probe_llm(llm2)` → `return probe_llm(llm2)`.

The existing `from app.services import pipeline as pipeline_service` import is preserved unchanged. The `/Sales_Pipeline` handler still calls `pipeline_service.compute_sales_pipeline(...)` unchanged.

- [ ] **Step 4: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. The `/test-llm` route URL is unchanged (still `GET /test-llm` on the same router), and `probe_llm` is now sourced from `app.services.health` — invisible to all callers of the endpoint.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/health.py backend/app/services/pipeline.py backend/app/routers/pipeline.py
git commit -m "refactor(be): extract probe_llm to services/health.py [phase K, commit 11/13]"
```

### Task F.1: Scaffold the pipeline package (commit 12/13)

After Task F.0, `pipeline.py` is a 60-LOC file containing only `compute_sales_pipeline`. Scaffold it as a package, same pattern as Sequences A–E.

**Files:**
- Create directory: `backend/app/services/pipeline/`
- Modify (via `git mv`): `backend/app/services/pipeline.py` → `backend/app/services/pipeline/__init__.py`

- [ ] **Step 1: Confirm the per-service grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE --include='*.py' "\"app\.services\.pipeline" backend/tests/ || echo "(no matches)"
```

Expected: `(no matches)`.

- [ ] **Step 2: Create the package directory and move the file**

```bash
mkdir backend/app/services/pipeline
git mv backend/app/services/pipeline.py backend/app/services/pipeline/__init__.py
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. `routers/pipeline.py`'s `from app.services import pipeline as pipeline_service` import now binds to the package (which contains `compute_sales_pipeline` at its top level via `__init__.py`); `pipeline_service.compute_sales_pipeline(...)` still resolves.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/pipeline/
git commit -m "refactor(be): scaffold pipeline package [phase K, commit 12/13]"
```

### Task F.2: Split pipeline into neo4j submodule (commit 13/13)

**Files:**
- Create: `backend/app/services/pipeline/neo4j.py`
- Modify: `backend/app/services/pipeline/__init__.py` (rewrite as pure re-export)

The current `pipeline/__init__.py` contains 1 function: `compute_sales_pipeline`. It moves to `neo4j.py`.

- [ ] **Step 1: Create `pipeline/neo4j.py`**

Create `backend/app/services/pipeline/neo4j.py` with this exact content (the function body is `compute_sales_pipeline` copied verbatim from the current `pipeline/__init__.py`):

```python
"""Sales-pipeline aggregation — Neo4j stage-count read."""
from datetime import datetime, timedelta, timezone
from typing import Dict

from app.core.config import STAGE_ORDER, STAGE_MAPPING
from app.models.pipeline import SalesPipelineResponse, TimeframeResponse, StageStats


def compute_sales_pipeline(driver, user_id: str, timeframe: int) -> SalesPipelineResponse:
    """Aggregate lead stage counts from Neo4j for the given user/timeframe."""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=timeframe)

    query_string = """
    MATCH (l:Lead)
    WHERE l.last_stage_update_date >= $start_date AND l.last_stage_update_date <= $end_date
    RETURN l.stage AS stage, count(*) AS count
    """

    with driver.session() as session:
        results = session.run(query_string, {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        })

        # Count occurrences per mapped UI stage
        ui_stage_counts: Dict[str, int] = {stage: 0 for stage in STAGE_ORDER}

        for record in results:
            neo4j_stage = record["stage"]
            count = record["count"]
            mapped_stage = STAGE_MAPPING.get(neo4j_stage)
            if mapped_stage in ui_stage_counts:
                ui_stage_counts[mapped_stage] += count

        # Build ordered stage data and calculate conversion rates
        ordered_counts = [ui_stage_counts[stage] for stage in STAGE_ORDER]

        stages = []
        for i, stage in enumerate(STAGE_ORDER):
            count = ordered_counts[i]
            if i == 0:
                conversion = 1.0
            else:
                prev = ordered_counts[i - 1]
                conversion = round(count / prev, 2) if prev > 0 else 0.0

            stages.append(StageStats(
                name=stage,
                count=count,
                conversionRate=conversion,
            ))

        return SalesPipelineResponse(
            timeframes=[
                TimeframeResponse(
                    days=timeframe,
                    stages=stages,
                )
            ]
        )
```

- [ ] **Step 2: Rewrite `pipeline/__init__.py` as a pure re-export**

Replace the entire contents of `backend/app/services/pipeline/__init__.py` with:

```python
"""pipeline service — public API.

Service for sales-pipeline stage-count aggregation from Neo4j. The
service is intentionally narrow: probe_llm lives in services/health.py
(extracted in Phase K commit 11/13) because LLM-availability probing
is not a pipeline concern.

Submodules:
  - neo4j.py: compute_sales_pipeline
"""

from app.services.pipeline.neo4j import compute_sales_pipeline
```

- [ ] **Step 3: Run the test suite**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/pipeline/
git commit -m "refactor(be): split pipeline into neo4j submodule [phase K, commit 13/13]"
```

---

## Task 14: Run §6 acceptance criteria (no commit)

After commit 13/13, run the four acceptance criteria from spec §6 to confirm Phase K's success conditions. If any criterion fails, halt and surface to operator — do not push the branch.

- [ ] **Step 1: Final test count (criterion 1 + 2)**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
```

Expected: `248 passed, 19 snapshots passed`. This is the same count recorded at Task 0b, confirming no test drift across all 13 commits.

- [ ] **Step 2: Submodule-bypass grep #1 — deep-import form (criterion 3, part a)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rE --include='*.py' "from app\.services\.(leads|customer_profile|graph_chat|org_auth|profiles|pipeline)\.[a-z_]+ import" backend/app/
```

Expected: no matches (zero lines printed). Catches `from app.services.leads.persistence import X` style imports that would bypass `__init__.py` re-exports.

- [ ] **Step 3: Submodule-bypass grep #2 — dotted-import form (criterion 3, part b)**

```bash
grep -rE --include='*.py' "^import app\.services\.(leads|customer_profile|graph_chat|org_auth|profiles|pipeline)\." backend/app/
```

Expected: no matches. Catches `import app.services.leads.persistence` and `import app.services.leads.persistence as foo` style imports.

(A third bypass form — `from app.services.leads import persistence`, importing the submodule object itself — cannot be distinguished by grep from `from app.services.leads import get_leads_for_org`. The spec's §5 external-caller inventory confirmed no current code uses this form; code review of new external callers is the only reliable defense going forward.)

- [ ] **Step 4: Lazy-import linter (criterion 3, part c)**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_no_lazy_service_imports.py::test_no_unannotated_lazy_service_imports -v 2>&1 | tail -5
```

Expected: `1 passed`. The test scans every `*.py` under `backend/app/services/` (including the 6 new packages and `services/health.py`) and flags any unannotated `from app.services...` import nested inside a function body. Phase K introduces no such imports — `health.py`'s only function-body import is `from langchain_core.messages import HumanMessage`, which is langchain, not `app.services.*`, and is therefore out of the linter's scope.

- [ ] **Step 5: No v1 router or integration test regressions (criterion 4)**

Already satisfied by Step 1 — the 248-test count includes both the v1 router tests (`backend/tests/integration/` directly hits `backend/app/routers/*.py` for the flat-router surface, alongside the newer `app/routers/v2/` set) and the v2 router tests. If Step 1 passes at the baseline count, criterion 4 is met by inclusion.

- [ ] **Step 6: Confirm the branch is ready for review**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD
```

Expected: exactly 13 commits, each suffixed `[phase K, commit N/13]`, in the order:
1. `refactor(be): scaffold leads package [phase K, commit 1/13]`
2. `refactor(be): split leads into orchestrator/persistence/normalization [phase K, commit 2/13]`
3. `refactor(be): scaffold customer_profile package [phase K, commit 3/13]`
4. `refactor(be): split customer_profile into orchestrator + retarget patches [phase K, commit 4/13]`
5. `refactor(be): scaffold profiles package [phase K, commit 5/13]`
6. `refactor(be): split profiles into persistence [phase K, commit 6/13]`
7. `refactor(be): scaffold org_auth package [phase K, commit 7/13]`
8. `refactor(be): split org_auth into orgs and registrations [phase K, commit 8/13]`
9. `refactor(be): scaffold graph_chat package [phase K, commit 9/13]`
10. `refactor(be): split graph_chat into neo4j and prospect_pipeline [phase K, commit 10/13]`
11. `refactor(be): extract probe_llm to services/health.py [phase K, commit 11/13]`
12. `refactor(be): scaffold pipeline package [phase K, commit 12/13]`
13. `refactor(be): split pipeline into neo4j submodule [phase K, commit 13/13]`

If all 13 are present and Step 1 reports 248 passed + 19 snapshots, Phase K is complete. The branch is ready for review and merge into `master`.
