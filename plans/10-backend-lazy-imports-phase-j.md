# Backend Lazy-Imports Phase J Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all unannotated lazy `from app.services` imports inside `app/services/`. Seven vestigial sites get hoisted to module top; one real cycle (`market_scoring/persistence:67`) gets a structural fix by moving `_lead_to_score_row` to `normalization.py`. Add an AST-based pytest module enforcing the no-lazy-import invariant going forward.

**Architecture:** Per-site disposition driven by empirical import-test (every site verified at spec-write time, see spec §3.2 table). Seven hoists are in-file edits with no structural movement. One structural move relocates a pure data shaper from `scoring.py` to `normalization.py`, updating one named-import block and two docstring references. The new pytest module AST-walks `app/services/**/*.py`, flags any `ImportFrom` node with module starting `app.services` nested inside a function body without a `# defensive:` annotation on the `from`-keyword line.

**Tech Stack:** Python 3.12, FastAPI, pytest, pytest-mock. Standard library `ast` for the linter. No new dependencies.

**Spec:** `specs/10-backend-lazy-imports-phase-j-design.md` (with round-1 review + synthesis in `docs/reviews/`).

**Branch:** `refactor-backend-lazy-imports-phase-j` off `master`.

**Baseline:** Current master HEAD reports **247 tests collected**. `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` must report `247 passed, 19 snapshots passed` before the branch begins.

**Target:** `248 passed, 19 snapshots passed` at branch HEAD (247 preserved + 1 linter test added in commit 11).

**Merge cadence:** Per-commit merges to `master` acceptable (Phase H/I precedent + Brewra "Business State" — see CLAUDE.md). Each commit is independently green and bisectable.

**Abort criterion:** any commit's pytest run drops the count below 247 (or 248 after commit 11) → halt, diagnose, do not commit. The structural-move/hoist nature means a test break almost always indicates a missed import update, a missed test patch-path, or an empirical assumption that turned out wrong — diagnosable in minutes.

**On test failure during a task:** do not commit. Either fix forward (re-edit and re-run pytest) or `git checkout -- .` to discard and re-read the step. Never commit a red state.

**Plan-level kill criterion:** if a "vestigial" hoist turns out to be a real cycle after all (Risk R1 / R4 in spec §6), revert that commit, re-add the lazy import with `# defensive: <reason>` annotation on the `from` line, file a `docs/TECH_DEBT.md` entry naming the cycle, and continue with the remaining tasks. The branch does not need to be all-or-nothing.

**Commit message style (per CLAUDE.md):** `type(scope):` format. No `[N/M]` suffix. Body optional; include one when the *why* isn't obvious from the diff. Plan-reference trailers (`Refs: plan-10`) are author's judgment.

---

## Pre-flight (one-time, no commit)

- [ ] **Step 1: Confirm clean working tree on master.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git branch --show-current
```

Expected: `nothing to commit, working tree clean` and `master`.

- [ ] **Step 2: Confirm `.venv` is Python 3.12.**

```bash
cd backend
.venv/bin/python --version
```

Expected: `Python 3.12.x`. If it reports 3.13, rebuild per `feedback_backend_venv_rebuild` memory note:

```bash
uv venv --python 3.12 .venv --allow-existing
uv pip install -r requirements.txt
```

- [ ] **Step 3: Run baseline pytest; confirm 247 pass.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`. If less, halt — the branch baseline is wrong; reconcile master first.

- [ ] **Step 4: Create branch.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout -b refactor-backend-lazy-imports-phase-j
```

Expected: `Switched to a new branch 'refactor-backend-lazy-imports-phase-j'`.

---

## Task 1: Hoist `ICP_generator` import in `icp/persistence`

**Files:**
- Modify: `backend/app/services/icp/persistence.py`

**Reference:** spec §3.2 row 1, §4 commit 1.

The lazy import sits inside `list_icps` at line 40. The function-body comment block also describes the lazy import. Both go away; one new line goes into the module-top imports block.

- [ ] **Step 1: Add `ICP_generator` to module-top imports.**

In `backend/app/services/icp/persistence.py`, find the existing top imports block (currently ends at line 20 with `from app.core.logging import logger`). Add immediately after it:

```python
from app.services.icp.orchestrator import ICP_generator
```

- [ ] **Step 2: Remove the lazy import + its comment from `list_icps`.**

In the same file, find lines 39-40 inside `list_icps` (right after the docstring closes):

```python
    # Lazy imports to avoid circular dependency: persistence -> orchestrator -> persistence
    from app.services.icp.orchestrator import ICP_generator
```

Delete both lines. Leave the `from app.services._retrieval import (...)` lazy import on lines 41-44 in place — Task 2 handles that.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp/persistence.py
git commit -m "refactor(be): hoist ICP_generator import in icp/persistence

The lazy 'persistence -> orchestrator -> persistence' cycle the comment
warned about does not exist at current master HEAD; empirical import
test in spec §3.2 confirmed hoisting is safe."
```

---

## Task 2: Hoist `_retrieval` imports in `icp/persistence`

**Files:**
- Modify: `backend/app/services/icp/persistence.py`

**Reference:** spec §3.2 row 2.

After Task 1, only the `_retrieval` lazy import remains inside `list_icps`. Hoist it.

- [ ] **Step 1: Add `_retrieval` imports to module-top imports.**

In `backend/app/services/icp/persistence.py`, find the imports block (now includes the `ICP_generator` line added in Task 1). Add immediately after the `ICP_generator` import:

```python
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)
```

- [ ] **Step 2: Remove the lazy import + its inline comment from `list_icps`.**

In the same file, find these lines inside `list_icps` (currently lines 39-42 after Task 1):

```python
    from app.services._retrieval import (  # lazy to avoid circular imports
        _build_market_context_queries,
        _fetch_pinecone_supporting_context,
    )
```

Delete all four lines (including the closing paren).

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp/persistence.py
git commit -m "refactor(be): hoist _retrieval imports in icp/persistence"
```

---

## Task 3: Hoist `_retrieval` imports in `icp/orchestrator`

**Files:**
- Modify: `backend/app/services/icp/orchestrator.py`

**Reference:** spec §3.2 row 3.

The lazy import sits inside `_run_icp_research_impl` at line 251 (the function signature is at line 240). Hoist to module top.

- [ ] **Step 1: Add `_retrieval` imports to module-top imports.**

In `backend/app/services/icp/orchestrator.py`, find the existing top imports block (last existing import is `from app.services.icp.prompts import (...)`). Add immediately after it:

```python
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)
```

- [ ] **Step 2: Remove the lazy import from `_run_icp_research_impl`.**

In the same file, find these lines inside `_run_icp_research_impl` (currently around lines 251-254):

```python
    from app.services._retrieval import (
        _build_market_context_queries,
        _fetch_pinecone_supporting_context,
    )
```

Delete all four lines.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp/orchestrator.py
git commit -m "refactor(be): hoist _retrieval imports in icp/orchestrator"
```

---

## Task 4: Hoist `orchestrator` import in `market_scoring/scoring` + update docstrings

**Files:**
- Modify: `backend/app/services/market_scoring/scoring.py`
- Modify: `backend/app/services/market_scoring/__init__.py`

**Reference:** spec §3.2 row 4, §4 commit 4 (extended per round-1 review to include `__init__.py:21-23` update).

This task touches two files because the lazy import is described in three places (the import itself, scoring.py's module docstring, and the package `__init__.py` docstring) — all must change together to keep the codebase internally consistent.

- [ ] **Step 1: Add `orchestrator` to scoring.py's module-top imports.**

In `backend/app/services/market_scoring/scoring.py`, find the existing top imports block (last existing line is `from app.services.market_scoring.normalization import _parse_iso_datetime`, currently line 21). Add immediately after it:

```python
from app.services.market_scoring import orchestrator
```

This uses the module-import pattern (not a named import) — required for the patch-where-used discipline (see `backend/TESTING.md` and `feedback_phase_h_module_import_pattern.md`) and required to avoid hitting the partial-load case Python warns about (`orchestrator` is mid-loading at this point; only the module object is bound, not its symbols, but `scoring.py` only accesses `orchestrator.X` from inside function bodies, so by call-time the symbols exist).

- [ ] **Step 2: Remove the lazy import from `_run_market_scoring_for_org`.**

In the same file, find line 62 inside `_run_market_scoring_for_org` (first line of the function body):

```python
    from app.services.market_scoring import orchestrator
```

Delete this line.

- [ ] **Step 3: Update scoring.py's module docstring (lines 7-11).**

In the same file, find the docstring paragraph that begins:

```
Cross-module dependency: _run_market_scoring_for_org calls three
orchestrator-resident helpers (score_single_lead_against_market,
_persist_market_score_for_lead, get_market_reports_for_org) that aren't
moved out as part of Phase H. They're imported lazily inside the function
body to break the orchestrator <-> scoring import cycle.
```

Replace the entire paragraph with:

```
Cross-module dependency: _run_market_scoring_for_org calls three
orchestrator-resident helpers (score_single_lead_against_market,
_persist_market_score_for_lead, get_market_reports_for_org). The
orchestrator module is imported at module top; the partial-load case
is handled because scoring only accesses orchestrator.X symbols from
function bodies (by call-time, orchestrator has finished loading).
```

- [ ] **Step 4: Update market_scoring/__init__.py lines 20-23.**

In `backend/app/services/market_scoring/__init__.py`, find lines 20-23 (end of the module docstring):

```
(unit-test import). Internal orchestrator helpers (get_market_reports_for_org,
score_single_lead_against_market) live in orchestrator.py — scoring.py
accesses them via a lazy `from app.services.market_scoring import orchestrator`
import; tests import them from the submodule directly.
```

Replace those four lines with:

```
(unit-test import). Internal orchestrator helpers (get_market_reports_for_org,
score_single_lead_against_market) live in orchestrator.py — scoring.py
accesses them via a module-top `from app.services.market_scoring import orchestrator`
import; tests import them from the submodule directly.
```

(Only word change: `lazy` → `module-top`.)

- [ ] **Step 5: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 6: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/scoring.py backend/app/services/market_scoring/__init__.py
git commit -m "refactor(be): hoist orchestrator import in market_scoring/scoring

The module-import pattern handles the partial-load case (scoring is
loaded mid-__init__ chain, before orchestrator finishes — but the
\`orchestrator.X\` accesses only happen inside function bodies, by
which time orchestrator has fully loaded). Also updates the scoring.py
and __init__.py docstrings that described the now-removed lazy import."
```

---

## Task 5: Move `_lead_to_score_row` from `scoring` to `normalization`

**Files:**
- Modify: `backend/app/services/market_scoring/scoring.py` (delete function)
- Modify: `backend/app/services/market_scoring/normalization.py` (add function)
- Modify: `backend/app/services/market_scoring/orchestrator.py` (update named import)
- Modify: `backend/app/services/market_scoring/persistence.py` (update docstring)
- Modify: `backend/app/services/market_scoring/__init__.py` (update docstring)

**Reference:** spec §3.3, §4 commit 5.

This is the one structural move in Phase J. `_lead_to_score_row` is a pure data shaper that fits `normalization.py`'s purpose. After the move, no caller updates outside the listed files are needed (verified at spec time: `grep -rn "_lead_to_score_row" backend/tests/` returns zero results, and `app/` callers are exactly orchestrator.py:41 + persistence.py:67 + the function definition itself).

- [ ] **Step 1: Add `_lead_to_score_row` to `normalization.py` along with its imports.**

In `backend/app/services/market_scoring/normalization.py`, find the existing top imports block (ends at line 11 with `from app.models.market_scoring import MARKET_SCORE_COMPONENT_KEYS`). Replace that one line with:

```python
from app.models.market_scoring import LeadMarketScoreRow, MARKET_SCORE_COMPONENT_KEYS
```

(Adds `LeadMarketScoreRow` to the existing import, since the moved function returns one.)

Then at the end of the file, after the last function (`_parse_iso_datetime`), add a blank line followed by:

```python
def _lead_to_score_row(lead_doc: Dict[str, Any]) -> LeadMarketScoreRow:
    component_scores = lead_doc.get("component_scores", {}) if isinstance(lead_doc.get("component_scores"), dict) else {}
    return LeadMarketScoreRow(
        lead_id=str(lead_doc.get("lead_id")),
        org_id=str(lead_doc.get("org_id")),
        file_id=lead_doc.get("file_id"),
        company_name=lead_doc.get("company_name"),
        lead_name=lead_doc.get("lead_name"),
        score_market_size_opportunity=float(component_scores.get("market size & opportunity", 0)),
        score_industry_trends_report=float(component_scores.get("industry trends report", 0)),
        score_competitor_landscape=float(component_scores.get("competitor landscape", 0)),
        score_regulatory_compliance_highlights=float(component_scores.get("regulatory & compliance highlights", 0)),
        score_market_entry_growth_strategy=float(component_scores.get("market entry & growth strategy", 0)),
        combined_score=float(lead_doc.get("market_total_score", 0)),
        scoring_status=str(lead_doc.get("scoring_status", "completed")),
        scored_at=lead_doc.get("scored_at"),
        updated_at=lead_doc.get("updated_at"),
    )
```

- [ ] **Step 2: Delete `_lead_to_score_row` from `scoring.py`.**

In `backend/app/services/market_scoring/scoring.py`, find the function definition starting at line 27:

```python
def _lead_to_score_row(lead_doc: Dict[str, Any]) -> LeadMarketScoreRow:
    component_scores = lead_doc.get("component_scores", {}) if isinstance(lead_doc.get("component_scores"), dict) else {}
    return LeadMarketScoreRow(
        ...
        updated_at=lead_doc.get("updated_at"),
    )
```

Delete the entire function (lines 27-45 inclusive — the function body plus the blank line(s) before the next definition).

Verify after deletion that `LeadMarketScoreRow` is still used elsewhere in `scoring.py`:

```bash
cd backend
grep -n "LeadMarketScoreRow" app/services/market_scoring/scoring.py
```

If zero matches, also delete `LeadMarketScoreRow` from the existing `from app.models.market_scoring import LeadMarketScoreRow, MARKET_SCORE_COMPONENT_KEYS` import (leaving only `MARKET_SCORE_COMPONENT_KEYS`). If there are remaining matches, leave the import untouched.

- [ ] **Step 3: Update `orchestrator.py` named-import block.**

In `backend/app/services/market_scoring/orchestrator.py`, find the named-import block starting at line 40:

```python
from app.services.market_scoring.scoring import (
    _lead_to_score_row,
    _is_stale_queued_run,
    _run_market_scoring_for_org,
)
```

Change to import `_lead_to_score_row` from `normalization` instead. Replace with:

```python
from app.services.market_scoring.normalization import (
    _safe_json_to_obj,
    _normalize_non_empty_string,
    _canonicalize_key,
    _build_lookup_maps,
    _first_non_empty_value_from_keys,
    _extract_company_name,
    _extract_lead_name,
    _extract_description_preview,
    _parse_iso_datetime,
    _lead_to_score_row,
)
from app.services.market_scoring.scoring import (
    _is_stale_queued_run,
    _run_market_scoring_for_org,
)
```

(Merges `_lead_to_score_row` into the existing `normalization` named-import block — which already imports the other 9 normalization helpers — and removes it from the `scoring` named-import block.)

Verify the existing `normalization` import block above the `scoring` import block has the 9 helpers listed; the exact ordering of the merged list doesn't matter functionally but match the existing order for diff clarity.

- [ ] **Step 4: Update `persistence.py` module docstring.**

In `backend/app/services/market_scoring/persistence.py`, find lines 7-9 of the docstring:

```
Normalization helpers (_extract_company_name, _extract_lead_name,
_normalize_non_empty_string) come from normalization.py at top level.
_lead_to_score_row lives in scoring.py and is imported lazily inside
_get_latest_market_score_rows because scoring -> persistence is a back-edge.
```

Replace those four lines with:

```
Normalization helpers (_extract_company_name, _extract_lead_name,
_normalize_non_empty_string, _lead_to_score_row) come from normalization.py
at module top.
```

- [ ] **Step 5: Update `__init__.py` docstring (line 14).**

In `backend/app/services/market_scoring/__init__.py`, find lines 12-15:

```
  - normalization.py: pure data shapers — _safe_json_to_obj,
    _extract_company_name / _lead_name, _parse_iso_datetime, etc.
  - scoring.py: _lead_to_score_row, _is_stale_queued_run,
    _run_market_scoring_for_org (background task body)
```

Change to:

```
  - normalization.py: pure data shapers — _safe_json_to_obj,
    _extract_company_name / _lead_name, _parse_iso_datetime,
    _lead_to_score_row, etc.
  - scoring.py: _is_stale_queued_run, _run_market_scoring_for_org
    (background task body)
```

(Adds `_lead_to_score_row` to `normalization.py` list; removes it from `scoring.py` list.)

- [ ] **Step 6: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

If a test fails with `AttributeError: module 'app.services.market_scoring.scoring' has no attribute '_lead_to_score_row'` or `ImportError: cannot import name '_lead_to_score_row' from 'app.services.market_scoring.scoring'`, a caller was missed. Re-grep:

```bash
grep -rn "_lead_to_score_row" backend/
```

The only legitimate occurrences after this commit are: `app/services/market_scoring/normalization.py` (definition + one import line in normalization itself), `app/services/market_scoring/orchestrator.py` (the updated named-import block + any usage), and the docstring references in `persistence.py` and `__init__.py`. Any other `scoring._lead_to_score_row` reference is a bug to fix.

- [ ] **Step 7: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/normalization.py \
        backend/app/services/market_scoring/scoring.py \
        backend/app/services/market_scoring/orchestrator.py \
        backend/app/services/market_scoring/persistence.py \
        backend/app/services/market_scoring/__init__.py
git commit -m "refactor(be): move _lead_to_score_row from scoring to normalization

The function is a pure data shaper — Dict -> LeadMarketScoreRow with no
I/O or side effects — and fits normalization.py's stated purpose. The
move breaks the persistence -> scoring cycle that Phase H deferred to
Phase J: persistence can now import _lead_to_score_row from normalization
at module top (Task 6 makes that hoist)."
```

---

## Task 6: Hoist `_lead_to_score_row` import in `market_scoring/persistence`

**Files:**
- Modify: `backend/app/services/market_scoring/persistence.py`

**Reference:** spec §3.2 row 5, §4 commit 6.

After Task 5, `_lead_to_score_row` lives in `normalization.py`. The lazy import inside `_get_latest_market_score_rows` can now be hoisted (no cycle: `normalization` has no back-edges to `persistence` or `scoring`).

- [ ] **Step 1: Update the module-top imports to include `_lead_to_score_row` from normalization.**

In `backend/app/services/market_scoring/persistence.py`, find the existing top imports block (currently lines 15-19):

```python
from app.services.market_scoring.normalization import (
    _extract_company_name,
    _extract_lead_name,
    _normalize_non_empty_string,
)
```

Add `_lead_to_score_row` to the list:

```python
from app.services.market_scoring.normalization import (
    _extract_company_name,
    _extract_lead_name,
    _lead_to_score_row,
    _normalize_non_empty_string,
)
```

- [ ] **Step 2: Remove the lazy import from `_get_latest_market_score_rows`.**

In the same file, find line 67 inside `_get_latest_market_score_rows`:

```python
    from app.services.market_scoring.scoring import _lead_to_score_row
```

Delete this line.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/persistence.py
git commit -m "refactor(be): hoist _lead_to_score_row import in market_scoring/persistence

After Task 5 moved the function to normalization.py, the back-edge to
scoring is gone; the import hoists to module top safely."
```

---

## Task 7: Hoist `icp` imports in `customer_profile`

**Files:**
- Modify: `backend/app/services/customer_profile.py`

**Reference:** spec §3.2 row 6, §4 commit 7.

Four lazy import sites consolidate into one top-level import. Sites at lines 20, 139, 217 (`_reserve_unique_icp_id`) and 354 (`_release_icp_id`).

- [ ] **Step 1: Add the consolidated top-level import.**

In `backend/app/services/customer_profile.py`, find the existing top imports block (ends with `from app.models.customer_profile import CustomerProfileRequest, SuggestedICPToCustomerProfileRequest`). Add immediately after it:

```python
from app.services.icp import _reserve_unique_icp_id, _release_icp_id
```

- [ ] **Step 2: Remove all four lazy import lines from function bodies.**

In the same file, delete each of these lines (preserving surrounding code):

- Line 20 (inside `upsert_customer_profile`):
  ```python
      from app.services.icp import _reserve_unique_icp_id
  ```
- Line 139 (inside the function whose docstring mentions "Get customer profiles (ICPs) from MongoDB"):
  ```python
      from app.services.icp import _reserve_unique_icp_id
  ```
- Line 217 (inside the function whose docstring begins "Convert a suggested/recommended ICP"):
  ```python
      from app.services.icp import _reserve_unique_icp_id
  ```
- Line 354 (inside `delete_icp_from_customer_profile`):
  ```python
      from app.services.icp import _release_icp_id
  ```

After each deletion, the line immediately below remains (typically `db = mongo["Profiler"]` or `profiler_db = mongo["Profiler"]`).

Line numbers shift after each deletion — work top-to-bottom or re-grep after each. To confirm all four are gone:

```bash
cd backend
grep -n "from app.services.icp" app/services/customer_profile.py
```

Expected: one line of output (the new top-level import on whatever line the imports block now ends).

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/customer_profile.py
git commit -m "refactor(be): hoist icp imports in customer_profile

Four in-function 'from app.services.icp import _reserve_unique_icp_id'
(plus one _release_icp_id) calls consolidate to a single top-level
import. icp/ does not import customer_profile, so there is no cycle to
defend against."
```

---

## Task 8: Hoist `graph_chat.score_prospect` import in `data_sources/loaders`

**Files:**
- Modify: `backend/app/services/data_sources/loaders.py`

**Reference:** spec §3.2 row 7.

The lazy import sits inside `process_prospect_list` at line 35 with a misleading comment `# lazy: avoid load-time dep`. Empirical test: `graph_chat.py` does not import `data_sources/loaders` (verified at spec time). Hoist.

- [ ] **Step 1: Add `score_prospect` to module-top imports.**

In `backend/app/services/data_sources/loaders.py`, find the existing top imports block. The last existing import is:

```python
from app.services._neo4j_helpers import query  # function — local binding ok
```

Add immediately after it:

```python
from app.services.graph_chat import score_prospect
```

- [ ] **Step 2: Remove the lazy import + its comment from `process_prospect_list`.**

In the same file, find line 35 inside `process_prospect_list`:

```python
    from app.services.graph_chat import score_prospect  # lazy: avoid load-time dep
```

Delete this line.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/data_sources/loaders.py
git commit -m "refactor(be): hoist graph_chat.score_prospect import in data_sources/loaders

The 'avoid load-time dep' comment was unfounded — graph_chat does not
import data_sources, so module-top binding is safe and slightly faster
(saves a Python-level import call per process_prospect_list invocation)."
```

---

## Task 9: Hoist `leads.get_leads_for_org` import in `signals/search`

**Files:**
- Modify: `backend/app/services/signals/search.py`

**Reference:** spec §3.2 row 8.

The lazy import sits inside `search_signals` at line 225 (inside a `try` block). Empirical test: `leads.py` does not import `signals` (verified at spec time). Hoist.

- [ ] **Step 1: Add `get_leads_for_org` to module-top imports.**

In `backend/app/services/signals/search.py`, find the existing top imports block. The current top-imports area ends with the standard-library + typing imports (and the existing intra-package imports per the module docstring). Add a new line at the appropriate position (matching the existing pattern of grouping by package origin — `app.services` group):

```python
from app.services.leads import get_leads_for_org
```

If `app.services._retrieval` imports already exist there (per the module docstring's "Cross-package: app.services._retrieval" mention), add the `leads` import in the same logical group.

- [ ] **Step 2: Remove the lazy import from `search_signals`.**

In the same file, find line 225 inside the `try:` block within `search_signals`:

```python
            from app.services.leads import get_leads_for_org
```

Delete this line. Leave the surrounding `try:`/`except:` structure and the `leads_data, _ = get_leads_for_org(...)` call line intact — they continue to work because `get_leads_for_org` is now in module scope.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/search.py
git commit -m "refactor(be): hoist leads.get_leads_for_org import in signals/search"
```

---

## Task 10: Hoist `leads.get_leads_for_org` import in `signals/batch`

**Files:**
- Modify: `backend/app/services/signals/batch.py`

**Reference:** spec §3.2 row 8 (same disposition as Task 9, different file).

The lazy import sits inside `_generate_signals_batch_impl` at line 66 (inside a `try` block). Empirical test: `leads.py` does not import `signals/` (verified at spec time). Hoist.

- [ ] **Step 1: Add `get_leads_for_org` to module-top imports.**

In `backend/app/services/signals/batch.py`, find the existing top imports block (per the module docstring: standard-library + typing imports, plus intra-package imports). Add a new line in the `app.services` group:

```python
from app.services.leads import get_leads_for_org
```

- [ ] **Step 2: Remove the lazy import from `_generate_signals_batch_impl`.**

In the same file, find line 66 inside the `try:` block within `_generate_signals_batch_impl`:

```python
            from app.services.leads import get_leads_for_org
```

Delete this line. Leave the surrounding `try:` structure and the `leads_data, _ = get_leads_for_org(...)` call intact.

- [ ] **Step 3: Run pytest.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `247 passed, 19 snapshots passed`.

- [ ] **Step 4: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/batch.py
git commit -m "refactor(be): hoist leads.get_leads_for_org import in signals/batch"
```

---

## Task 11: Add lazy-service-import linter

**Files:**
- Create: `backend/tests/unit/test_no_lazy_service_imports.py`

**Reference:** spec §3.4, §4 commit 11.

The test AST-walks `app/services/**/*.py` and enforces the no-lazy-import invariant. After this commit lands, any future agent who adds a lazy `from app.services` import inside a function body without a `# defensive:` annotation on the `from` line will see this test fail in CI.

- [ ] **Step 1: Create the test file.**

Create `backend/tests/unit/test_no_lazy_service_imports.py` with:

```python
"""Linter: no unannotated lazy `from app.services` imports inside services/.

A lazy import is an `ImportFrom` node nested inside a `FunctionDef` or
`AsyncFunctionDef` body whose module starts with `app.services`. Lazy
imports are allowed only when annotated with `# defensive: <reason>` on
the same line as the `from` keyword (the linter checks the lineno of the
ImportFrom node, which Python sets to the `from`-keyword line).

For multi-line imports, the annotation must therefore appear on the
`from` line, not on the closing-paren line. In practice this means
defensive imports should be single-line, importing one symbol at a time.

This test runs alongside the rest of the suite via `pytest -q` and adds
no new dependencies beyond stdlib `ast`.
"""
import ast
from pathlib import Path


SERVICES_DIR = Path(__file__).resolve().parents[2] / "app" / "services"


def _find_violations(source: str, src_lines: list[str]) -> list[tuple[int, str]]:
    """Return (lineno, source-line) for every unannotated lazy from-app-services import."""
    tree = ast.parse(source)
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for child in ast.walk(node):
            if not isinstance(child, ast.ImportFrom):
                continue
            if not (child.module and child.module.startswith("app.services")):
                continue
            line = src_lines[child.lineno - 1]
            if "# defensive:" in line:
                continue
            violations.append((child.lineno, line.strip()))
    return violations


def test_no_unannotated_lazy_service_imports() -> None:
    """All lazy `from app.services` imports inside services/ must be annotated."""
    all_violations: dict[str, list[tuple[int, str]]] = {}
    for py_file in SERVICES_DIR.rglob("*.py"):
        source = py_file.read_text()
        violations = _find_violations(source, source.splitlines())
        if violations:
            rel = py_file.relative_to(SERVICES_DIR.parent.parent)
            all_violations[str(rel)] = violations

    assert not all_violations, (
        "Unannotated lazy 'from app.services' imports inside services/. "
        "Hoist to module top, or annotate with `# defensive: <reason>` "
        "on the same line as the `from` keyword.\n"
        + "\n".join(
            f"  {fp}:\n" + "\n".join(f"    L{ln}: {code}" for ln, code in vs)
            for fp, vs in all_violations.items()
        )
    )
```

- [ ] **Step 2: Run the new test on its own; confirm it passes.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q tests/unit/test_no_lazy_service_imports.py
```

Expected: `1 passed`.

If this fails with violations listed, Tasks 1-10 missed a lazy import. Read the failure message — it lists `<file>:Lnn: <source>` for each violation. Address each by hoisting (or `# defensive:` annotating if a real cycle exists) before proceeding.

- [ ] **Step 3 (TDD verification): inject a temporary violation; confirm the test detects it.**

Temporarily add a function with a lazy import to `app/services/icp/persistence.py` at the very end of the file (after all existing functions):

```python
def _phase_j_linter_self_test() -> None:
    """Temporary — will be removed in Step 4."""
    from app.services._retrieval import _build_market_context_queries
    _ = _build_market_context_queries
```

Run:

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q tests/unit/test_no_lazy_service_imports.py
```

Expected: `1 failed`. Failure message should include:

```
app/services/icp/persistence.py:
  L<NN>: from app.services._retrieval import _build_market_context_queries
```

(The exact line number depends on where the temp function landed.)

- [ ] **Step 4: Remove the temporary violation.**

Delete the `_phase_j_linter_self_test` function from `app/services/icp/persistence.py`. Re-run:

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q tests/unit/test_no_lazy_service_imports.py
```

Expected: `1 passed`.

Verify no leftover changes to `persistence.py`:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff backend/app/services/icp/persistence.py
```

Expected: empty diff (no output). If anything shows, the temp function wasn't fully removed.

- [ ] **Step 5: Run the full suite; confirm 248 pass.**

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Step 6: Commit.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/tests/unit/test_no_lazy_service_imports.py
git commit -m "test(be): add lazy-service-import linter

AST-walks app/services/**/*.py and flags any \`from app.services\`
import nested inside a function body without a \`# defensive:\`
annotation on the from-keyword line. Test count: 247 -> 248.

Verified during write: the test passes on clean tree (no violations
after Tasks 1-10) and fails as expected when a violation is injected."
```

---

## Closeout

- [ ] **Final verification:** run the full suite once more on the branch HEAD.

```bash
cd backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
```

Expected: `248 passed, 19 snapshots passed`.

- [ ] **Confirm no lazy imports remain (independent check from the linter):**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -rnE '^[[:space:]]+from app\.services' app/services/ --include='*.py'
```

Expected: empty output (no matches). This is a redundant check — the linter is authoritative — but provides a second-source confirmation independent of the AST-based test.

- [ ] **Confirm branch is mergeable:**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD
```

Expected: 11 commits matching the table in spec §4, in order.

- [ ] **Merge to master (per Brewra business state + Phase H/I precedent):**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git merge --ff-only refactor-backend-lazy-imports-phase-j
git branch -d refactor-backend-lazy-imports-phase-j
```

Or, if the operator prefers a merge commit for traceability:

```bash
git checkout master
git merge --no-ff refactor-backend-lazy-imports-phase-j -m "Merge: Phase J — lazy-import cycle removal (10 hoists + 1 structural fix + linter)"
git branch -d refactor-backend-lazy-imports-phase-j
```

(Merge style is operator's choice. The `--ff-only` form keeps history linear and matches the cadence Phase H/I used; the `--no-ff` form preserves the branch grouping at the cost of a merge commit.)

---

## Reference

- **Spec:** `specs/10-backend-lazy-imports-phase-j-design.md`
- **Round-1 review + synthesis:** `docs/reviews/10-backend-lazy-imports-phase-j-design-spec-review-1.md` and `-synthesis-1.md`
- **Patch-where-used discipline:** `backend/TESTING.md`
- **Module-import pattern:** memory note `feedback_phase_h_module_import_pattern.md`
- **Venv setup:** memory note `feedback_backend_venv_rebuild.md`
- **Phase I (preceding phase, completed 2026-05-25):** `plans/modularization-plan-9.md`, `specs/2026-05-24-backend-modularization-phase-i-design.md`
- **CLAUDE.md `## AI-Native Development` section:** governs commit message style and merge cadence used throughout this plan.
