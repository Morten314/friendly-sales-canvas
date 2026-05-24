# Backend Service Decomposition Phase H Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert five large service files (`signals.py` 1297 LOC, `icp.py` 1145 LOC, `market_research.py` 1016 LOC, `documents.py` 930 LOC, `market_scoring.py` 854 LOC) into per-domain packages under `services/<domain>/` split by concern (prompts / llm / parsing / persistence / orchestrator, with per-service deviations). Rename `documents/` → `data_sources/` package (including routers and test files; HTTP route paths unchanged). Close TD-006 as a side-effect of the `market_scoring/` decomposition.

**Architecture:** Structural move + patch-path migration. Every existing import path `from app.services.<domain> import <symbol>` keeps working byte-for-byte via `__init__.py` re-exports — this covers all non-test importers (routers, lifespan hooks, `customer_profile.py`, manual scripts). Six `_`-prefixed helpers must be re-exported despite the underscore convention (enumerated in spec §3.7); these are imported by `app/main.py` lifespan, by `customer_profile.py` (lazy imports), and by unit tests. **In addition**, tests that use `mocker.patch("app.services.<svc>.X")` are rewritten at the same commit as the move to `mocker.patch("app.services.<svc>.<submodule>.X")` — this is the *patch-where-it's-used* discipline mandated by spec §3.8. Re-exports make patch targets *findable* but do not *intercept* internal calls, so the patch string must follow the function to its defining submodule. Each per-service decomposition is 3-5 commits: scaffold (`git mv` + `__init__.py` + bulk test patch-path rewrite to `.orchestrator.X`), then extract one submodule per commit (with selective patch-path retargeting to the new submodule). All commits are individually green: the full pytest suite (236 tests) passes at every commit on the branch.

**Tech Stack:** Python 3.13, FastAPI, pytest, pytest-mock. No new dependencies. Tooling: `git mv` to preserve `git log --follow` and blame continuity; `BREWRA_SKIP_DB_INIT=1 python -m pytest -q` for per-commit verification.

**Spec:** `specs/2026-05-23-backend-service-decomposition-phase-h-design.md` (with `docs/reviews/2026-05-23-backend-service-decomposition-phase-h-design-spec-review-1.md`, `-2.md` and matching syntheses).

**Branch:** `refactor-backend-service-decomposition-phase-h` off `master`.

**Baseline:** Phase G HEAD on `master` (commit `9d1bf80` or later if more spec-only commits land first). `cd backend && BREWRA_SKIP_DB_INIT=1 python -m pytest -q` reports **236 tests passing**. Plan-writing-time spec commit: `9d1bf80`.

**Target:** 236 tests still passing at branch HEAD. No new tests; no removed tests. Test count is the safety net — any drop below 236 is a regression unless the commit message explicitly justifies it.

**Commit numbering convention:** `<type>(be): <description> [phase H, commit N/M]`. `M` is decided at execution time once the implementor confirms whether `signals/` cleanup (Task 20) is needed. Plan estimates **19-20 commits** total (Task 20 is conditional cleanup; omit if Tasks 16-19 leave `signals/` in a clean final state). Final M lands in commit-1's message.

**Merge cadence:** Per Brewra "Business State" (0 live users, deployment ceremony not a constraint), per-commit merges from the feature branch to `master` are acceptable. Each commit is independently green and bisectable. Recommendation: complete one full per-service sequence (e.g., all of `market_scoring/`'s 4 commits) before merging, so a service is never half-decomposed on `master`.

**Abort criterion:** if any task's pytest run shows any failure (count drops below 236, or any test errors), halt and report the failure mode before proceeding. The structural-move nature of this work means *any* test break indicates a missing re-export, a wrong import, or a function moved to the wrong submodule — these are diagnosable in minutes, not hours.

**On test failure during a task:** do not commit. Either fix forward (re-edit the files and re-run pytest) or `git checkout -- .` to discard the attempt and re-read the step. Never commit a red state to the branch.

**Plan-level kill criterion:** if the decomposition pattern fails on a service after reasonable diagnosis effort (e.g., the package structure can't be made green for a service after two or three attempts), halt the branch and escalate to the operator. Already-completed sequences are individually green and may be cherry-picked to `master` at the operator's discretion — the branch does not need to be all-or-nothing. The order-of-attack (easiest → hardest) is designed so partial completion still ships value.

**Spec deviations from `specs/2026-05-23-backend-service-decomposition-phase-h-design.md`:**
- `data_sources/` collapses from 4 commits (spec §4.2) to 3, with the spec-defined Step 5 closeout folded into Step 1 as an atomic full-rename. Reason: the generic Step 1 (`git mv` only) leaves router importers referencing the deleted `app.services.documents` path, violating per-commit greenness. The spec §4.2 commit-count line was amended in the same review round to match (20 total instead of 21-22).
- **Test patch-path migration is bundled into every move commit** per spec §3.8 (added in the round-3 spec revision after the original plan tried scaffold-only on 2026-05-24 and broke 9 unit tests). Each scaffold task includes a bulk find-and-replace of `app.services.<svc>.X` → `app.services.<svc>.orchestrator.X` in the service's test files; each extraction task includes a selective retarget to the new submodule path for symbols that moved. The pytest gate at the end of each task asserts 236 passing because the move and the path edits land together — within a commit, ordering is "move → re-export → patch-rewrite → pytest", and each commit is atomic so there is no intermediate red state. The `__init__.py` re-export list stays at the public surface + spec §3.7 exceptions (no need to inflate it with patch-target symbols, since the patches no longer target the package path after the rewrite).
- **Round-4 revisions** (2026-05-24, after Phase H execution): three plan/spec gaps were folded back upstream after the merged branch hit 236 passing.
  - **Module-import + namespace-prefix for any moved-and-patched symbol** (spec §3.8 subsection added). The original Step 3 wording — "At the top of `orchestrator.py`, add: `from app.services.<svc>.<submodule> import (...)`" — is broken for symbols that tests patch by string: from-import binds the name into orchestrator's `__dict__`, so step-2 retargets to `.<submodule>.X` fail to intercept orchestrator-side calls. Sequence A Task 2 broke 6 tests with this pattern and was fixed by switching to `from app.services.<svc> import <submodule>` + `<submodule>.X(...)` namespace-prefix calls. Tasks 2 and 13 now spell out the module-import pattern; Tasks 6, 9, 17 use from-import because none of their moved symbols are patched (verified per the §3.8 pre-flight inventory). Plan Step 3 wording was rewritten to reference the decision rule per task.
  - **Task 12 Step 3a excludes `test_customer_profile.py` from the bulk sed.** `app/services/customer_profile.py` uses lazy imports through `app.services.icp.__init__.py`; tests patch via the package path (`app.services.icp.X`). Rewriting them to `.orchestrator.X` would patch a binding the lazy import never reads. Spec §3.8 grew a "lazy-import-through-`__init__` exception" subsection documenting this case generally.
  - **`__init__.py` re-export surface is wider than spec §3.7's illustrative example.** Sequence A's Task 1 had to add `get_market_reports_for_org` and `score_single_lead_against_market` to market_scoring's `__init__.py`; Sequence B's Task 5 had to add `load_document`, `grapher`, `process_prospect_list` to data_sources's. Spec §3.7's pre-flight grep was extended to also catch unprefixed external imports, and §3.7 now explicitly states the table is the `_`-prefix exceptions list (not the full public surface).

**Parallelizability:** Sequences B-E (`data_sources/`, `market_research/`, `icp/`, `signals/`) are mutually independent — they touch different service files, different routers, different test files, and don't share mutable state. After Sequence A (`market_scoring/`) validates the pattern, B-E may be dispatched to parallel subagents using the `subagent-driven-development` skill. Within each sequence, tasks must remain serial (scaffold → extraction → extraction). Sequence A must complete first because its outcome decides whether to continue at all (per the plan-level kill criterion).

**Branch strategy for parallel sequences:** Each parallel subagent must operate on its own branch off Sequence A's HEAD (e.g., `refactor-backend-service-decomposition-phase-h-data_sources`, `…-market_research`, `…-icp`, `…-signals`); the operator merges results into the main phase branch after all sequences complete. The `subagent-driven-development` skill normally handles this via worktrees. If running parallel sequences manually, do not share a single branch — concurrent commits will conflict on `__init__.py` re-export blocks and overlapping helper files.

**Order of attack** (spec §4.1, easiest → hardest):

1. `market_scoring/` (4 commits) — no LLM, cleanest seams. Proves the pattern. Closes TD-006.
2. `data_sources/` (3 commits) — proves the rename pattern. Atomic rename in commit 1.
3. `market_research/` (4 commits) — proves the LLM-package pattern.
4. `icp/` (4 commits) — applies the proven LLM pattern.
5. `signals/` (5 commits) — hardest case, done last.

**Note on `data_sources/` commit count.** The spec §4.2 listed `data_sources/` as 4 commits including a separate "closeout" rename step. This plan collapses the rename into commit 1 (atomic full-rename) because the alternative — `git mv services/documents.py → services/data_sources/orchestrator.py` *without* renaming the importers — breaks `pytest -q` at commit 1, violating the per-commit-greenness constraint. Three commits for `data_sources/`, four for the other non-LLM service. Total estimate adjusted to 20 (from spec's 21-22).

---

## Pre-flight (one-time setup, no commit)

- [ ] **Verify master state and create branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                # expected: clean working tree
git rev-parse --abbrev-ref HEAD           # expected: master
git log --oneline -3                      # confirm Phase H spec commits are landed
git checkout -b refactor-backend-service-decomposition-phase-h
```

- [ ] **Verify the test baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: "236 passed in <8s"
```

Record exact count here at execution time: __________ (must be 236; if different, surface to operator).

**If the actual count is greater than 236** (e.g., new tests landed after plan-writing): update every subsequent "expected: 236 passed" reference in this plan to the new baseline before starting Sequence A. The 236 number reflects the Phase G post-merge state at plan-writing time; only the relative invariant ("count must not drop") is load-bearing, not the absolute number.

- [ ] **Phase F DI sanity check (spec §5.6)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rEn "^(client|mongo|driver|pc|agent_chain)\s*=" backend/app/services/
# expected: zero matches. The ^ anchor restricts matches to module-level
# assignments only — any hit is a real Phase F DI violation, not a false
# positive. Surface to operator before halting.
```

If any module-level assignments appear, halt — a service still reaches into module globals and decomposition assumptions are violated.

- [ ] **`_`-prefix external-import inventory (spec §3.7 pre-flight)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for d in signals icp market_research documents market_scoring; do
  echo "=== $d ==="
  grep -rn "from app.services.$d import _\|mocker\.patch.*app\.services\.$d\._" backend/ tests/ 2>/dev/null
done
```

(The `mocker.patch` alternation catches string-based mock-target references — these resolve through `__init__.py` at runtime and therefore also require the symbol to be re-exported. The §3.7 table assumes complete coverage; this grep validates the assumption for future-phase reuse.)

Expected matches per spec §3.7 table:
- `signals`: none
- `icp`: `app/services/customer_profile.py` (4 sites — `_reserve_unique_icp_id` ×3, `_release_icp_id` ×1)
- `market_research`: none
- `documents`: none
- `market_scoring`: `tests/unit/test_market_scoring.py` (2 sites — `_run_market_scoring_for_org`, `_get_latest_market_score_rows`)

If any new external `_`-prefixed import surfaces that's not in spec §3.7, add it to the table before decomposing that service.

- [ ] **Broad patch-target inventory (spec §3.8 pre-flight)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for svc in signals icp market_research documents market_scoring; do
  echo "=== $svc ==="
  grep -rnE "\"app\\.services\\.$svc\\." backend/tests/ \
    | sed -E "s/.*\"app\\.services\\.$svc\\.([^\"]+)\".*/\\1/" \
    | sort -u
done
```

Record the per-service deduped symbol lists below at execution time. These are the patch-target strings that will be rewritten at the scaffold-task of each service. They are also the **minimum** set of symbols that the scaffold's `__init__.py` must re-export (super-set of the public + §3.7 exception lists), so the patches stay *findable* even before the bulk path rewrite lands.

- `signals` patch targets: __________
- `icp` patch targets: __________
- `market_research` patch targets: __________
- `documents` patch targets: __________
- `market_scoring` patch targets: __________

**Plan-writing-time prior observation (2026-05-24, branch wiped after halt):** when this grep was run on `master` HEAD just before halt, `market_scoring` returned `_get_lead_identity_from_neo4j`, `_get_market_score_collections`, `_persist_market_score_for_lead`, `get_company_profile_for_org`, `get_leads_for_org`, `get_market_reports_for_org`, `score_single_lead_against_market`. Use as a sanity check — re-run at execution time and resolve any drift.

- [ ] **`documents` reference inventory (spec §5.4 pre-flight)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "documents" backend/app/main.py backend/app/routers/ backend/app/services/customer_profile.py backend/tests/ 2>/dev/null
```

Classify hits into rename categories:
- `app/main.py:141,145` — router import lines (will rename in Task 5)
- `app/routers/documents.py`, `app/routers/v2/documents.py` — router files (renamed in Task 5)
- `tags=["documents"]` (`routers/documents.py:25`) and `tags=["v2", "documents"]` (`routers/v2/documents.py:8`) — OpenAPI tags (renamed in Task 5, spec §2.1 item 2)
- `tests/test_documents.py`, `tests/test_documents_v2.py`, `tests/unit/test_documents.py` — test files (renamed in Task 5)
- Any other `documents` mention — classify before Task 5

---

## Sequence A — `market_scoring/` (4 commits)

### Task 1: Scaffold `market_scoring/` package

**Files:**
- Move: `backend/app/services/market_scoring.py` → `backend/app/services/market_scoring/orchestrator.py`
- Create: `backend/app/services/market_scoring/__init__.py`

- [ ] **Step 1: Read the current `market_scoring.py` to confirm public + `_`-exception surface**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def \|^async def " app/services/market_scoring.py
```

Confirm the expected symbols exist: `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`, `get_company_profile_for_org` (public); `_ensure_market_scoring_indexes`, `_run_market_scoring_for_org`, `_get_latest_market_score_rows` (re-exported `_` per §3.7).

- [ ] **Step 2: Move the file into a package with `git mv`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/app/services/market_scoring.py backend/app/services/market_scoring/orchestrator.py
```

(`git mv` creates the directory automatically when the target path includes a new parent.)

- [ ] **Step 2a: Preemptively clear `__pycache__` for the affected directory**

```bash
rm -rf backend/app/services/__pycache__
```

Module-to-package conversion makes stale `.pyc` shadowing predictable, not exceptional. Clearing the cache eliminates a class of false-negative pytest failures. (If pytest later in this task still hits a mysterious `ImportError`, broaden to `find backend -name __pycache__ -type d -exec rm -rf {} +`.)

- [ ] **Step 3: Create `__init__.py` with full re-exports**

Write `backend/app/services/market_scoring/__init__.py`:

```python
"""market_scoring service — package skeleton (Phase H commit 1/M).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, normalization.py, and scoring.py. __init__.py re-exports
the public surface plus the §3.7 _-prefix exceptions.
"""

from app.services.market_scoring.orchestrator import (
    trigger_or_get_market_scores,
    get_market_scores_status,
    get_lead_market_score_descriptions,
    get_company_profile_for_org,
    _ensure_market_scoring_indexes,
    _run_market_scoring_for_org,
    _get_latest_market_score_rows,
)

__all__ = [
    "trigger_or_get_market_scores",
    "get_market_scores_status",
    "get_lead_market_score_descriptions",
    "get_company_profile_for_org",
    "_ensure_market_scoring_indexes",
    "_run_market_scoring_for_org",
    "_get_latest_market_score_rows",
]
```

- [ ] **Step 3a: Bulk-rewrite test patch paths (spec §3.8 step 1)**

All `market_scoring` patched symbols still live in `orchestrator.py` at this commit (no extraction yet). Rewrite every `"app.services.market_scoring.X"` patch-target string to `"app.services.market_scoring.orchestrator.X"` so the patches keep intercepting where the functions actually resolve names.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Two test files for market_scoring; both may contain patch strings:
sed -i 's/"app\.services\.market_scoring\./"app.services.market_scoring.orchestrator./g' \
  backend/tests/test_market_scoring.py \
  backend/tests/unit/test_market_scoring.py
```

Verify the rewrite didn't catch unintended substrings:

```bash
grep -nE '"app\.services\.market_scoring\.' backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
# expected: every match is now "app.services.market_scoring.orchestrator.X"
```

**Direct-import lines stay unchanged.** Lines like `from app.services.market_scoring import _get_latest_market_score_rows` continue to resolve through the `__init__.py` re-export — they target the `__init__.py` namespace at import time, not at call time, so they're unaffected by the patch-path issue. Verify none of these were touched:

```bash
grep -n "from app.services.market_scoring import" backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
# expected: no .orchestrator suffix in any of these import lines
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

If any test fails: most likely cause is a public function listed above but missing from `orchestrator.py` (run `grep -n "def trigger_or_get_market_scores\|def get_market_scores_status\|def get_lead_market_score_descriptions\|def get_company_profile_for_org\|def _ensure_market_scoring_indexes\|def _run_market_scoring_for_org\|def _get_latest_market_score_rows" backend/app/services/market_scoring/orchestrator.py` — every name must appear exactly once). Second-most-likely cause: a patch string that the sed missed (e.g., line-broken across two source lines) — re-run the verify grep in Step 3a.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/ backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
git commit -m "refactor(be): scaffold market_scoring/ package [phase H, commit 1/M]

git mv services/market_scoring.py → services/market_scoring/orchestrator.py
Create __init__.py re-exporting full public API plus §3.7 _-prefix
exceptions (_ensure_market_scoring_indexes, _run_market_scoring_for_org,
_get_latest_market_score_rows). No code change inside orchestrator.py.

Rewrite test patch paths per spec §3.8 step 1: every
'app.services.market_scoring.X' patch target retargeted to
'app.services.market_scoring.orchestrator.X' so patches intercept the
function where it now resolves names. Direct imports (from app.services.
market_scoring import X) unchanged — they go through __init__.py.

Per-commit verification: 236 tests passing."
```

### Task 2: Extract `market_scoring/persistence.py`

**Files:**
- Create: `backend/app/services/market_scoring/persistence.py`
- Modify: `backend/app/services/market_scoring/orchestrator.py` (delete persistence functions, add internal import)

- [ ] **Step 1: Read the persistence functions to extract**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def _get_market_score_collections\|^def _get_latest_market_score_rows\|^def _get_latest_scoring_run\|^def _get_lead_identity_from_neo4j\|^def get_company_profile_for_org\|^def _ensure_market_scoring_indexes" app/services/market_scoring/orchestrator.py
```

Note the line ranges for each function (use `awk` or read the file). The functions to move are spec §3.6 `persistence.py` row: `_get_market_score_collections`, `_get_latest_market_score_rows`, `_get_latest_scoring_run`, `_get_lead_identity_from_neo4j`, `get_company_profile_for_org`, `_ensure_market_scoring_indexes`.

- [ ] **Step 2: Create `persistence.py` with the extracted functions**

Cut the six functions and their immediate dependencies (typing imports, `pymongo`/`neo4j` types they reference) from `orchestrator.py` into a new file `backend/app/services/market_scoring/persistence.py`. The file should start with a module docstring:

```python
"""Persistence layer for market_scoring/ — Mongo and Neo4j I/O helpers.

Public re-exports (§3.7): _ensure_market_scoring_indexes (lifespan),
_get_latest_market_score_rows (unit test), get_company_profile_for_org.
"""
```

followed by the imports each extracted function needs (re-derive these by reading the function bodies), then the functions themselves in their original order.

- [ ] **Step 3: Update `orchestrator.py` to call into `persistence.py`**

All six moved symbols are in the §3.8 patch-target inventory (the unit tests patch `_get_market_score_collections`, `_get_lead_identity_from_neo4j`, and `get_company_profile_for_org` directly; the other three are pulled in transitively by orchestrator-function tests). Per spec §3.8 "How callsite code must look", any moved-and-patched symbol requires **module-import + namespace-prefix calls** in orchestrator — otherwise the Step 4a retarget to `.persistence.X` cannot intercept orchestrator-side callers.

At the top of `orchestrator.py`, add (do NOT use `from .persistence import ...`):

```python
from app.services.market_scoring import persistence
```

Rewrite every callsite of a moved symbol inside `orchestrator.py` to use the namespace prefix. Expect ~9 sites:

```python
# Before:
score_coll, run_coll = _get_market_score_collections(mongo)
rows, _ = _get_latest_market_score_rows(driver, mongo, request.org_id)
company_profile = get_company_profile_for_org(driver, org_id)

# After:
score_coll, run_coll = persistence._get_market_score_collections(mongo)
rows, _ = persistence._get_latest_market_score_rows(driver, mongo, request.org_id)
company_profile = persistence.get_company_profile_for_org(driver, org_id)
```

Delete the original function definitions (they now live in `persistence.py`).

**Why not the from-import pattern.** `from app.services.market_scoring.persistence import X` binds `X` into `orchestrator.__dict__`. A test that patches `app.services.market_scoring.persistence.X` only replaces persistence's binding; orchestrator-side callers still hit the real function. This was the failure mode at Sequence A Task 2's first attempt (6 unit tests with `TypeError: '<' not supported between instances of 'int' and 'MagicMock'` and similar mock-non-intercept symptoms). See spec §3.8.

**Circular-import resolution.** `persistence.py` needs four normalization helpers (`_extract_company_name`, `_extract_lead_name`, `_lead_to_score_row`, `_normalize_non_empty_string`) that still live in `orchestrator.py` until Task 3 moves them. Import them **lazily inside the persistence function bodies** that use them — never at persistence.py's top level. Module-import for orchestrator + lazy import for persistence's reverse-edge breaks the cycle. Once Task 3 moves the helpers to `normalization.py`, persistence's lazy imports can be promoted to top-level from-imports against `normalization` (no cycle then).

- [ ] **Step 4: Update `__init__.py` to source persistence-resident symbols from `persistence.py`**

Edit `backend/app/services/market_scoring/__init__.py`. Move `get_company_profile_for_org`, `_ensure_market_scoring_indexes`, and `_get_latest_market_score_rows` to import from `persistence` instead of `orchestrator`:

```python
from app.services.market_scoring.orchestrator import (
    trigger_or_get_market_scores,
    get_market_scores_status,
    get_lead_market_score_descriptions,
    _run_market_scoring_for_org,
)
from app.services.market_scoring.persistence import (
    get_company_profile_for_org,
    _ensure_market_scoring_indexes,
    _get_latest_market_score_rows,
)
```

(`__all__` list is unchanged.)

- [ ] **Step 4a: Retarget test patches for moved symbols (spec §3.8 step 2)**

Of the 6 functions that just moved to `persistence.py`, retarget the ones that any test patches by string. From the plan-writing-time inventory, the patched subset is:

- `_get_market_score_collections` (multiple call sites in `tests/unit/test_market_scoring.py`)
- `_get_lead_identity_from_neo4j` (`tests/test_market_scoring.py:150`)
- `get_company_profile_for_org` (`tests/unit/test_market_scoring.py:326`)

Other moved symbols (`_get_latest_market_score_rows`, `_get_latest_scoring_run`, `_ensure_market_scoring_indexes`) are not patched in tests at plan-writing time — re-verify at execution time and add to the substitution if the grep surfaces a new site.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for sym in _get_market_score_collections _get_lead_identity_from_neo4j get_company_profile_for_org; do
  sed -i "s/\"app\\.services\\.market_scoring\\.orchestrator\\.$sym\"/\"app.services.market_scoring.persistence.$sym\"/g" \
    backend/tests/test_market_scoring.py \
    backend/tests/unit/test_market_scoring.py
done
```

Verify:

```bash
grep -nE '"app\.services\.market_scoring\.(orchestrator|persistence)\.' backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
# expected: the three retargeted symbols now appear with .persistence.; other patched
# symbols (e.g., get_leads_for_org, _persist_market_score_for_lead) stay at .orchestrator.
```

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

Common failures:
- A function in `persistence.py` references an internal helper still in `orchestrator.py` → circular import or `NameError`. Fix: either move the helper to `persistence.py` too, or pass it as a parameter from orchestrator.
- A patch for a moved symbol that the Step 4a sed missed (e.g., a previously-uncatalogued site, or a symbol that was patched but isn't in the three above). Re-run the verify grep in Step 4a and extend the substitution list.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/market_scoring/ backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
git commit -m "refactor(be): extract market_scoring/persistence.py [phase H, commit 2/M]

Move 6 Mongo/Neo4j I/O helpers out of orchestrator.py:
- _get_market_score_collections, _get_latest_market_score_rows,
  _get_latest_scoring_run, _get_lead_identity_from_neo4j (internal)
- get_company_profile_for_org (public), _ensure_market_scoring_indexes (lifespan)

__init__.py updated to re-export from persistence for the three exception
symbols that landed there.

Retarget test patches per spec §3.8 step 2 for the three moved symbols
that tests patch by string: _get_market_score_collections,
_get_lead_identity_from_neo4j, get_company_profile_for_org → .persistence.X.
Other patches (get_leads_for_org, _persist_market_score_for_lead) stay
at .orchestrator.X since those symbols didn't move.

236 tests passing."
```

### Task 3: Extract `market_scoring/normalization.py` + `scoring.py`

**Files:**
- Create: `backend/app/services/market_scoring/normalization.py`
- Create: `backend/app/services/market_scoring/scoring.py`
- Modify: `backend/app/services/market_scoring/orchestrator.py`
- Modify: `backend/app/services/market_scoring/__init__.py`

This commit splits two submodules at once because they're tightly related (scoring uses normalization helpers) and the spec §3.6 commit template treats them as one step.

- [ ] **Step 1: Identify the functions to move**

Per spec §3.6:
- `normalization.py`: `_safe_json_to_obj`, `_normalize_non_empty_string`, `_canonicalize_key`, `_build_lookup_maps`, `_first_non_empty_value_from_keys`, `_extract_company_name`, `_extract_lead_name`, `_extract_description_preview`, `_parse_iso_datetime`
- `scoring.py`: `_lead_to_score_row`, `_is_stale_queued_run`, `_run_market_scoring_for_org`

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def _safe_json_to_obj\|^def _normalize_non_empty_string\|^def _canonicalize_key\|^def _build_lookup_maps\|^def _first_non_empty_value_from_keys\|^def _extract_company_name\|^def _extract_lead_name\|^def _extract_description_preview\|^def _parse_iso_datetime\|^def _lead_to_score_row\|^def _is_stale_queued_run\|^def _run_market_scoring_for_org" app/services/market_scoring/orchestrator.py
```

- [ ] **Step 2: Create `normalization.py`**

Cut the nine normalization helpers from `orchestrator.py` into `backend/app/services/market_scoring/normalization.py`:

```python
"""Data normalization helpers for market_scoring/.

Pure functions — no I/O, no LLM, no DB. Used by scoring.py and orchestrator.py.
"""
# (re-derive imports from function bodies — typically just `typing` and `json` and `datetime`)

# ... nine functions in their original order ...
```

- [ ] **Step 3: Create `scoring.py`**

Cut the three scoring-task functions into `backend/app/services/market_scoring/scoring.py`:

```python
"""Scoring task body for market_scoring/.

_run_market_scoring_for_org is the background task invoked from
trigger_or_get_market_scores via BackgroundTasks.add_task. Re-exported
from __init__.py per §3.7 (imported by tests/unit/test_market_scoring.py).
"""
# Imports re-derived from function bodies. Common needs:
# - from app.services.market_scoring.normalization import (
#       <pure-data helpers used by _lead_to_score_row or the scoring loop>
#   )
# - from app.services.market_scoring.persistence import (
#       _get_market_score_collections,
#       _get_latest_scoring_run,
#       <other Mongo/Neo4j helpers used by the background task>
#   )

# Three functions defined here, per spec §3.6:
#   _lead_to_score_row(...)        — lead → score-row shape transform
#   _is_stale_queued_run(...)      — stale-run detection
#   _run_market_scoring_for_org(...) — background task body
```

`_lead_to_score_row` is **defined** in this file (per spec §3.6) — do not attempt to import it from `normalization`. Only import from `normalization` and `persistence` the helpers that `_lead_to_score_row`, `_is_stale_queued_run`, or `_run_market_scoring_for_org` actually call when you read their bodies.

- [ ] **Step 4: Update `orchestrator.py` imports**

At the top of `orchestrator.py`, add (after the persistence import from Task 2):

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
)
from app.services.market_scoring.scoring import (
    _lead_to_score_row,
    _is_stale_queued_run,
    _run_market_scoring_for_org,
)
```

Delete the 12 original function definitions from `orchestrator.py`.

- [ ] **Step 5: Update `__init__.py` for the relocated `_run_market_scoring_for_org`**

Move `_run_market_scoring_for_org` from the orchestrator import block to a new scoring import block:

```python
from app.services.market_scoring.scoring import (
    _run_market_scoring_for_org,
)
```

- [ ] **Step 5a: Retarget test patches for moved symbols (spec §3.8 step 2)**

The 12 moved symbols (9 normalization helpers + 3 scoring functions) are not patched by string at plan-writing time — they're either pure helpers (normalization) called from inside the package, or in the case of `_run_market_scoring_for_org`, only imported directly into the test module (no patch). Verify with grep before pytest:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for sym in _safe_json_to_obj _normalize_non_empty_string _canonicalize_key _build_lookup_maps \
           _first_non_empty_value_from_keys _extract_company_name _extract_lead_name \
           _extract_description_preview _parse_iso_datetime \
           _lead_to_score_row _is_stale_queued_run _run_market_scoring_for_org; do
  grep -n "\"app\.services\.market_scoring\..*\.$sym\"" backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py 2>/dev/null
done
# expected: zero matches
```

If any hits surface, retarget them with the same `sed` pattern as Task 2 Step 4a (just change the destination submodule to `normalization` or `scoring` per the spec §3.6 table).

- [ ] **Step 6: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/market_scoring/
# add tests/ only if Step 5a surfaced and retargeted any patches; usually skipped:
# git add backend/tests/test_market_scoring.py backend/tests/unit/test_market_scoring.py
git commit -m "refactor(be): extract market_scoring/normalization.py + scoring.py [phase H, commit 3/M]

normalization.py: 9 pure data-shaping helpers (_safe_json_to_obj,
_canonicalize_key, _extract_*, _parse_iso_datetime).
scoring.py: _lead_to_score_row, _is_stale_queued_run, and the
_run_market_scoring_for_org background task body.

__init__.py updated to source _run_market_scoring_for_org from scoring.
No test patch-path retargeting needed: the 12 moved symbols are not
patched by string in tests (verified per spec §3.8 step 2).

236 tests passing."
```

### Task 4: Orchestrator closeout + TD-006 fix

**Files:**
- Modify: `backend/app/services/market_scoring/orchestrator.py` (TD-006 two-char fix at 2 callsites)
- Modify: `docs/TECH_DEBT.md` (remove TD-006)

- [ ] **Step 1: Locate the TD-006 callsites in orchestrator**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "leads, _ = get_leads_for_org\|total_leads = len(leads)" app/services/market_scoring/orchestrator.py
```

Expected: two adjacent line pairs (originally `market_scoring.py:404` and `:690`; may have shifted during Tasks 1-3 but should still be two pairs).

- [ ] **Step 2: Apply the two-character fix at each site**

For each callsite, change:

```python
leads, _ = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
# ... possibly other code ...
total_leads = len(leads)
```

to:

```python
leads, total_leads = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
# ... delete the `total_leads = len(leads)` line ...
```

- [ ] **Step 3: Update `docs/TECH_DEBT.md` — remove TD-006**

Delete the TD-006 section from `docs/TECH_DEBT.md`. Add a one-line note near the existing "IDs aren't reused" note at the top:

```markdown
TD-006 (market_scoring callers recomputing len(leads)) was resolved 2026-05-23 by Phase H Task 4.
```

(Keep the ID-renumbering note pattern from the round-1 spec revision.)

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

The two-char fix is semantically identical for orgs ≤5000 leads, so test count and behavior are unchanged.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring/orchestrator.py docs/TECH_DEBT.md
git commit -m "refactor(be): close TD-006 in market_scoring/orchestrator [phase H, commit 4/M]

Two callsites in trigger_or_get_market_scores and get_market_scores_status
now unpack get_leads_for_org's full tuple instead of recomputing total_leads
from len(leads). Behavior is unchanged below the 5000 cap (the only case
that exists today); above the cap, total_leads now reflects DB truth.

Closes TD-006. 236 tests passing."
```

---

## Sequence B — `data_sources/` (3 commits)

### Task 5: Atomic rename + scaffold `data_sources/` package

**Files:**
- Move: `backend/app/services/documents.py` → `backend/app/services/data_sources/orchestrator.py`
- Move: `backend/app/routers/documents.py` → `backend/app/routers/data_sources.py`
- Move: `backend/app/routers/v2/documents.py` → `backend/app/routers/v2/data_sources.py`
- Move: `backend/tests/test_documents.py` → `backend/tests/test_data_sources.py`
- Move: `backend/tests/test_documents_v2.py` → `backend/tests/test_data_sources_v2.py`
- Move: `backend/tests/unit/test_documents.py` → `backend/tests/unit/test_data_sources.py`
- Modify: `backend/app/main.py` (router import lines, tags)
- Modify: `backend/app/routers/data_sources.py` and `backend/app/routers/v2/data_sources.py` (tags + internal import of service)
- Create: `backend/app/services/data_sources/__init__.py`

This is the largest commit of the phase (single commit, multiple renames). Done atomically because partial renames break per-commit greenness.

- [ ] **Step 1: Inventory current state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "documents" backend/app/main.py backend/app/routers/documents.py backend/app/routers/v2/documents.py backend/app/services/documents.py
```

Confirm expected hits (per pre-flight grep): main.py imports at lines 141, 145; `tags=["documents"]` at routers/documents.py:25; `tags=["v2", "documents"]` at routers/v2/documents.py:8; internal `from app.services.documents import ...` lines in both router files.

- [ ] **Step 2: Perform all `git mv` renames**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/app/services/documents.py backend/app/services/data_sources/orchestrator.py
git mv backend/app/routers/documents.py backend/app/routers/data_sources.py
git mv backend/app/routers/v2/documents.py backend/app/routers/v2/data_sources.py
git mv backend/tests/test_documents.py backend/tests/test_data_sources.py
git mv backend/tests/test_documents_v2.py backend/tests/test_data_sources_v2.py
git mv backend/tests/unit/test_documents.py backend/tests/unit/test_data_sources.py
```

- [ ] **Step 2a: Preemptively clear `__pycache__` across all renamed directories**

```bash
rm -rf backend/app/services/__pycache__ backend/app/routers/__pycache__ backend/app/routers/v2/__pycache__ backend/tests/__pycache__ backend/tests/unit/__pycache__
```

Six renames in one commit produce six potential stale-`.pyc` shadowing sites. Clearing the cache up front eliminates a class of false-negative failures later in the task. (If pytest still hits a mysterious `ImportError`, broaden to `find backend -name __pycache__ -type d -exec rm -rf {} +`.)

- [ ] **Step 3: Create `services/data_sources/__init__.py`**

Write `backend/app/services/data_sources/__init__.py`:

```python
"""data_sources service — package skeleton (Phase H commit 5/M).

Renamed from documents/ to disambiguate from project documentation.
All code lives in orchestrator.py for now; commits 6-7 extract
persistence.py, loaders.py, pipeline.py. No LLM in this service.
"""

from app.services.data_sources.orchestrator import (
    upload_file_text,
    upload_prospect_list_file,
    upload_document_file,
    process_file_to_embeddings,
    list_user_documents,
    get_document_status,
    delete_data_source,
    update_data_source,
)

__all__ = [
    "upload_file_text",
    "upload_prospect_list_file",
    "upload_document_file",
    "process_file_to_embeddings",
    "list_user_documents",
    "get_document_status",
    "delete_data_source",
    "update_data_source",
]
```

Confirm by greping the orchestrator.py for `def upload_file_text`, etc., that every name in the import block exists.

- [ ] **Step 4: Update `app/main.py` router imports**

In `backend/app/main.py`, change:

```python
from app.routers import documents                    # was line 141
from app.routers.v2 import documents as documents_v2 # was line 145
```

to:

```python
from app.routers import data_sources
from app.routers.v2 import data_sources as data_sources_v2
```

Also update the corresponding `app.include_router(documents.router)` and `app.include_router(documents_v2.router)` lines to use the new names (`data_sources.router`, `data_sources_v2.router`).

- [ ] **Step 5: Update `routers/data_sources.py` and `routers/v2/data_sources.py`**

In both router files:
- Change `tags=["documents"]` → `tags=["data_sources"]` (v1)
- Change `tags=["v2", "documents"]` → `tags=["v2", "data_sources"]` (v2)
- Change any `from app.services.documents import ...` → `from app.services.data_sources import ...`

Use grep to find all sites:

```bash
grep -n "documents\|from app.services" backend/app/routers/data_sources.py backend/app/routers/v2/data_sources.py
```

HTTP route paths (`/user-documents`, `/document/upload-and-process`, `/delete-data-source`, etc.) **stay unchanged** — they're FE contracts (spec §2.1 item 2).

- [ ] **Step 6: Update test files for the rename + apply spec §3.8 patch-path migration**

In each of the three renamed test files (`test_data_sources.py`, `test_data_sources_v2.py`, `unit/test_data_sources.py`), find and replace:
- `from app.services.documents` → `from app.services.data_sources`
- `mocker.patch("app.services.documents.X")` → `mocker.patch("app.services.data_sources.orchestrator.X")` — note the `.orchestrator` insertion is the spec §3.8 step 1 patch-path migration; all moved code currently lives in `data_sources/orchestrator.py` at this commit
- `from app.routers.documents` → `from app.routers.data_sources` (if any)
- Any string-based test descriptions referring to "documents service" — update to "data_sources service" for consistency.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Import lines (use module path, no .orchestrator suffix — these go through __init__.py):
sed -i 's/from app\.services\.documents/from app.services.data_sources/g' \
  backend/tests/test_data_sources.py \
  backend/tests/test_data_sources_v2.py \
  backend/tests/unit/test_data_sources.py
# String-based patch targets (combine rename + spec §3.8 step 1):
sed -i 's/"app\.services\.documents\./"app.services.data_sources.orchestrator./g' \
  backend/tests/test_data_sources.py \
  backend/tests/test_data_sources_v2.py \
  backend/tests/unit/test_data_sources.py
# Router import paths if present:
sed -i 's/from app\.routers\.documents/from app.routers.data_sources/g' \
  backend/tests/test_data_sources.py \
  backend/tests/test_data_sources_v2.py \
  backend/tests/unit/test_data_sources.py
```

Verify:

```bash
grep -rn "documents" backend/tests/test_data_sources.py backend/tests/test_data_sources_v2.py backend/tests/unit/test_data_sources.py
# expected: no surviving "documents" string except cosmetic test descriptions (and the
# Mongo collection name "user_documents" if asserted on, which stays unchanged)
grep -rnE '"app\.services\.data_sources\.' backend/tests/test_data_sources.py backend/tests/test_data_sources_v2.py backend/tests/unit/test_data_sources.py
# expected: every match has the .orchestrator. infix
```

- [ ] **Step 7: Verify no stragglers**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.documents\|app\.routers\.documents\|app\.routers\.v2\.documents\|tests\.test_documents\|tests\.unit\.test_documents" backend/ 2>/dev/null
# expected: zero matches
```

If any matches, fix them before pytest.

- [ ] **Step 8: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

Most common failure: missed an import rename. The error message will name the file and line — fix it and re-run.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/data_sources/ backend/app/services/ backend/app/routers/ backend/app/main.py backend/tests/
git commit -m "refactor(be): rename documents → data_sources + scaffold package [phase H, commit 5/M]

Atomic rename of services/documents.py → services/data_sources/orchestrator.py
including all importers: routers/documents.py → routers/data_sources.py,
routers/v2/documents.py → routers/v2/data_sources.py, three test files
(test_documents{,_v2}.py and unit/test_documents.py), main.py router-include
lines, and OpenAPI tags (documents → data_sources).

HTTP route paths unchanged (/user-documents, /document/*, /delete-data-source
remain FE contracts). Swagger /docs grouping shifts from 'documents' to
'data_sources' — intentional cosmetic surface change per spec §2.1 item 2.

236 tests passing."
```

### Task 6: Extract `data_sources/persistence.py`

**Files:**
- Create: `backend/app/services/data_sources/persistence.py`
- Modify: `backend/app/services/data_sources/orchestrator.py`
- Modify: `backend/app/services/data_sources/__init__.py`

- [ ] **Step 1: Identify the functions to move**

Per spec §3.5 `persistence.py` row: `list_user_documents`, `get_document_status`, `delete_data_source`, `update_data_source`.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^async def list_user_documents\|^async def get_document_status\|^async def delete_data_source\|^async def update_data_source" app/services/data_sources/orchestrator.py
```

- [ ] **Step 2: Create `persistence.py`**

Cut the four functions into `backend/app/services/data_sources/persistence.py`:

```python
"""Persistence layer for data_sources/ — Mongo + S3 + Pinecone reads/writes
for user-uploaded data sources.
"""
# Re-derive imports from function bodies — typically: typing, datetime,
# pymongo.errors, app.core.exceptions, etc.

# ... four functions ...
```

- [ ] **Step 3: Update `orchestrator.py` to import from persistence**

None of the four moved functions appear in the §3.8 patch-target inventory for `data_sources`, so per spec §3.8 "How callsite code must look" the simpler from-import pattern is safe here (no module-import + namespace-prefix needed). Re-verify with the §3.8 pre-flight grep before adopting the from-import; if any of the four turn out to be patched, switch to the module-import pattern from Task 2 Step 3 for this task.

```python
from app.services.data_sources.persistence import (
    list_user_documents,
    get_document_status,
    delete_data_source,
    update_data_source,
)
```

Delete the four original function definitions.

- [ ] **Step 4: Update `__init__.py`**

Move the four symbols from the orchestrator import block to a new persistence import block:

```python
from app.services.data_sources.persistence import (
    list_user_documents,
    get_document_status,
    delete_data_source,
    update_data_source,
)
```

- [ ] **Step 4a: Verify no test patches retarget needed (spec §3.8 step 2)**

The four moved functions (`list_user_documents`, `get_document_status`, `delete_data_source`, `update_data_source`) are not patched by string at plan-writing time. Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for sym in list_user_documents get_document_status delete_data_source update_data_source; do
  grep -n "\"app\.services\.data_sources\..*\.$sym\"" backend/tests/test_data_sources.py backend/tests/test_data_sources_v2.py backend/tests/unit/test_data_sources.py 2>/dev/null
done
# expected: zero matches
```

If any hits surface, retarget them from `.orchestrator.X` → `.persistence.X` with the sed pattern from Task 2 Step 4a.

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/data_sources/
# add tests/ only if Step 4a surfaced and retargeted patches; usually skipped:
# git add backend/tests/test_data_sources*.py backend/tests/unit/test_data_sources.py
git commit -m "refactor(be): extract data_sources/persistence.py [phase H, commit 6/M]

Move 4 Mongo CRUD functions out of orchestrator.py: list_user_documents,
get_document_status, delete_data_source, update_data_source. Each is a
public symbol re-exported from persistence via __init__.py.

No test patch-path retargeting needed: the 4 moved symbols are not
patched by string in tests (verified per spec §3.8 step 2).

236 tests passing."
```

### Task 7: Extract `data_sources/loaders.py` + `pipeline.py`

**Files:**
- Create: `backend/app/services/data_sources/loaders.py`
- Create: `backend/app/services/data_sources/pipeline.py`
- Modify: `backend/app/services/data_sources/orchestrator.py` (becomes near-empty / deletable)
- Modify: `backend/app/services/data_sources/__init__.py`

- [ ] **Step 1: Identify the functions per spec §3.5**

- `loaders.py`: `load_document`, `grapher`, `process_prospect_list`, `upload_file_text`, `upload_prospect_list_file`
- `pipeline.py`: `process_file_to_embeddings`, `upload_document_file`

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def load_document\|^def grapher\|^def process_prospect_list\|^def upload_file_text\|^def upload_prospect_list_file\|^async def process_file_to_embeddings\|^async def upload_document_file" app/services/data_sources/orchestrator.py
```

- [ ] **Step 2: Create `loaders.py`**

```python
"""File loaders for data_sources/ — PDF/text loading, graph construction,
and prospect-list parsing entry points.
"""
# Imports re-derived from function bodies (langchain_community loaders, etc.)

# ... five functions ...
```

- [ ] **Step 3: Create `pipeline.py`**

```python
"""S3 + Pinecone + Mongo coordinated upload pipeline for data_sources/.

process_file_to_embeddings: async S3 → Pinecone embedding flow.
upload_document_file: the main upload handler that coordinates S3 upload,
Mongo status tracking, and async embedding via BackgroundTasks.
"""
# Imports re-derived — likely needs from loaders, persistence, plus
# pinecone, boto3, app.core.exceptions, etc.

# May need:
# from app.services.data_sources.loaders import upload_file_text, upload_prospect_list_file
# from app.services.data_sources.persistence import get_document_status

# ... two functions ...
```

- [ ] **Step 4: Delete `orchestrator.py`**

After Steps 2-3, `orchestrator.py` contains only imports and re-exports — `data_sources/` has no multi-step compositional logic (every public function does its own thing in loaders, pipeline, or persistence). Per YAGNI, delete it:

```bash
git rm backend/app/services/data_sources/orchestrator.py
```

`__init__.py` (next step) imports directly from `loaders`, `pipeline`, and `persistence` — no orchestrator hop needed.

- [ ] **Step 5: Update `__init__.py`**

Final form:

```python
"""data_sources service — public API.

Renamed from documents/ in Phase H. No LLM in this service; submodules
are loaders (file loading), pipeline (S3+Pinecone+Mongo upload), and
persistence (Mongo CRUD).
"""

from app.services.data_sources.loaders import (
    upload_file_text,
    upload_prospect_list_file,
)
from app.services.data_sources.pipeline import (
    process_file_to_embeddings,
    upload_document_file,
)
from app.services.data_sources.persistence import (
    list_user_documents,
    get_document_status,
    delete_data_source,
    update_data_source,
)

__all__ = [
    "upload_file_text",
    "upload_prospect_list_file",
    "upload_document_file",
    "process_file_to_embeddings",
    "list_user_documents",
    "get_document_status",
    "delete_data_source",
    "update_data_source",
]
```

- [ ] **Step 5a: Retarget remaining `.orchestrator.X` patches (spec §3.8 step 2)**

This commit deletes `data_sources/orchestrator.py`, so every patch still pointing at `app.services.data_sources.orchestrator.X` must move to its final submodule:

- `load_document`, `grapher`, `process_prospect_list` → `.loaders.X` (moved to loaders.py in Step 2 of this task)
- `PyPDFLoader`, `pd.read_csv` → `.loaders.X` (these are external library imports — they were imported into orchestrator.py; after the extraction they're imported into loaders.py, so patches targeting them follow there)
- `query` → check where this function lands (likely `loaders.py` or `pipeline.py`; classify at execution time by greping the source for `def query` or `query =`)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Symbols confirmed to go to loaders:
for sym in load_document grapher process_prospect_list PyPDFLoader; do
  sed -i "s/\"app\\.services\\.data_sources\\.orchestrator\\.$sym\"/\"app.services.data_sources.loaders.$sym\"/g" \
    backend/tests/test_data_sources.py \
    backend/tests/test_data_sources_v2.py \
    backend/tests/unit/test_data_sources.py
done
# pd.read_csv has a dot inside the symbol name — escape carefully:
sed -i 's/"app\.services\.data_sources\.orchestrator\.pd\.read_csv"/"app.services.data_sources.loaders.pd.read_csv"/g' \
  backend/tests/test_data_sources.py \
  backend/tests/test_data_sources_v2.py \
  backend/tests/unit/test_data_sources.py
# query — substitute after confirming its final submodule:
# sed -i 's/"app\.services\.data_sources\.orchestrator\.query"/"app.services.data_sources.<submodule>.query"/g' ...
```

After the rewrite, no `.orchestrator.` strings should remain (orchestrator.py is gone):

```bash
grep -rnE '"app\.services\.data_sources\.orchestrator\.' backend/tests/
# expected: zero matches
```

- [ ] **Step 6: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/data_sources/ backend/tests/test_data_sources.py backend/tests/test_data_sources_v2.py backend/tests/unit/test_data_sources.py
git commit -m "refactor(be): extract data_sources/loaders.py + pipeline.py [phase H, commit 7/M]

loaders.py: file-loading entry points (load_document, grapher,
process_prospect_list, upload_file_text, upload_prospect_list_file).
pipeline.py: S3+Pinecone+Mongo coordinated upload (process_file_to_embeddings,
upload_document_file).

orchestrator.py deleted — data_sources/ has no multi-step compositions left
to compose. __init__.py re-exports directly from loaders/pipeline/persistence.

Retarget remaining test patches per spec §3.8 step 2: every
.orchestrator.X patch path moves to its final submodule (.loaders.X for
load_document, grapher, process_prospect_list, PyPDFLoader, pd.read_csv;
.<submodule>.query as classified at execution time). No .orchestrator.
strings remain in any data_sources test file.

236 tests passing."
```

---

## Sequence C — `market_research/` (4 commits)

### Task 8: Scaffold `market_research/` package

Same pattern as Task 1 with different names.

**Files:**
- Move: `backend/app/services/market_research.py` → `backend/app/services/market_research/orchestrator.py`
- Create: `backend/app/services/market_research/__init__.py`

- [ ] **Step 1: Verify public surface**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def Research_Market_\|^async def run_market_research" app/services/market_research.py
```

Expected: `Research_Market_1` through `Research_Market_5`, plus `run_market_research`.

- [ ] **Step 2: Move with `git mv`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/app/services/market_research.py backend/app/services/market_research/orchestrator.py
```

- [ ] **Step 2a: Preemptively clear `__pycache__`**

```bash
rm -rf backend/app/services/__pycache__
```

Eliminates stale-`.pyc` shadowing of the new package. (Same rationale as Task 1.)

- [ ] **Step 3: Create `__init__.py`**

```python
"""market_research service — package skeleton (Phase H commit 8/M).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.
"""

from app.services.market_research.orchestrator import (
    Research_Market_1,
    Research_Market_2,
    Research_Market_3,
    Research_Market_4,
    Research_Market_5,
    run_market_research,
)

__all__ = [
    "Research_Market_1",
    "Research_Market_2",
    "Research_Market_3",
    "Research_Market_4",
    "Research_Market_5",
    "run_market_research",
]
```

- [ ] **Step 3a: Bulk-rewrite test patch paths (spec §3.8 step 1)**

From plan-writing-time inventory, `market_research` has 4 patch targets: `COMPONENT_FUNCTIONS`, `COMPONENT_FUNCTIONS_CLAUDE`, `Research_Market_1`, `_fetch_pinecone_supporting_context`. All currently resolve in the monolithic `market_research.py`; after the `git mv` they live in `orchestrator.py`.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's/"app\.services\.market_research\./"app.services.market_research.orchestrator./g' \
  backend/tests/test_market_research.py \
  backend/tests/unit/test_market_research.py
```

Verify:

```bash
grep -nE '"app\.services\.market_research\.' backend/tests/test_market_research.py backend/tests/unit/test_market_research.py
# expected: every match now has .orchestrator. infix
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_research/ backend/tests/test_market_research.py backend/tests/unit/test_market_research.py
git commit -m "refactor(be): scaffold market_research/ package [phase H, commit 8/M]

git mv services/market_research.py → services/market_research/orchestrator.py
Create __init__.py re-exporting Research_Market_1..5 and run_market_research.
No code change inside orchestrator.py.

Rewrite test patch paths per spec §3.8 step 1: every
'app.services.market_research.X' patch target retargeted to
'app.services.market_research.orchestrator.X'. 236 tests passing."
```

### Task 9: Extract `market_research/persistence.py`

**Files:**
- Create: `backend/app/services/market_research/persistence.py`
- Modify: `backend/app/services/market_research/orchestrator.py`

- [ ] **Step 1: Identify the persistence functions/code**

Per spec §3.4 `persistence.py`: Mongo writes for the market-research report (helpers extracted from `run_market_research` body — no top-level functions today, so extraction here will surface NEW helpers).

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "collection\|insert_one\|update_one\|find_one\|client\[" app/services/market_research/orchestrator.py | head -20
```

Identify the Mongo I/O blocks (likely inside `run_market_research`'s body). Extract these into named helpers.

- [ ] **Step 2: Create `persistence.py` with extracted helpers**

```python
"""Persistence layer for market_research/ — Mongo writes for assembled reports."""
# Imports from pymongo, typing, app.models.market_research as needed.

# Example new helper signature (actual name and signature depend on what's
# in the orchestrator body):
def _save_market_research_report(mongo, org_id: str, report: dict) -> None:
    """Insert the assembled market-research report into the
    Scout_Agent.market_research collection. Extracted from
    run_market_research body during Phase H."""
    # ... extracted code ...
```

Name new helpers with `_` prefix (internal to package). They're not re-exported.

- [ ] **Step 3: Update `orchestrator.py`**

The new helpers in `persistence.py` are extracted from inline code — they did not exist as named functions before, so no test patches them. Per spec §3.8 "How callsite code must look", the simpler from-import pattern is safe. (If you find any pre-existing test patches them, switch to the module-import pattern from Task 2 Step 3.)

Replace the inline Mongo I/O blocks with calls to the new helpers:

```python
from app.services.market_research.persistence import _save_market_research_report

# inside run_market_research:
_save_market_research_report(mongo, org_id, report)
```

- [ ] **Step 3a: Verify no patch retargets needed (spec §3.8 step 2)**

The new helpers in `persistence.py` are extracted from inside `run_market_research`'s body — they didn't exist as named functions before, so they can't have been patched. Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '"app\.services\.market_research\.persistence\.' backend/tests/
# expected: zero matches (no pre-existing tests patch helpers that didn't exist yet)
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/market_research/
git commit -m "refactor(be): extract market_research/persistence.py [phase H, commit 9/M]

Lift Mongo report-writes out of run_market_research body into new helper(s)
in persistence.py. Internal-only (no re-export). No test patch-path
retargeting needed (helpers are newly named, no pre-existing patches).
236 tests passing."
```

### Task 10: Extract `market_research/prompts.py`

**Files:**
- Create: `backend/app/services/market_research/prompts.py`
- Modify: `backend/app/services/market_research/orchestrator.py`

- [ ] **Step 1: Identify prompt templates inside `Research_Market_1..5`**

Each `Research_Market_N` function builds a template (typically `template = f"""..."""` or a multi-line string). Locate each:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "template = \|template=\"" app/services/market_research/orchestrator.py
```

- [ ] **Step 2: Create `prompts.py` with extracted templates**

For each worker, extract the prompt template as a module-level constant or builder:

```python
"""Prompt templates for market_research/ — five Research_Market_N workers.

Templates stay as inline Python strings per Phase H scope. Option D will
externalize these to .md/.yaml in a follow-up phase.
"""

RESEARCH_MARKET_1_TEMPLATE = """..."""  # full template text from current Research_Market_1
RESEARCH_MARKET_2_TEMPLATE = """..."""
RESEARCH_MARKET_3_TEMPLATE = """..."""
RESEARCH_MARKET_4_TEMPLATE = """..."""
RESEARCH_MARKET_5_TEMPLATE = """..."""
```

If a template uses `.format(company_profile_json=...)`, keep `{company_profile_json}` placeholders in the template constant — the orchestrator calls `.format()` after import.

- [ ] **Step 3: Update `orchestrator.py` to import templates**

Replace each `template = f"""..."""` block with:

```python
from app.services.market_research.prompts import RESEARCH_MARKET_1_TEMPLATE
# ...
prompt = RESEARCH_MARKET_1_TEMPLATE.format(company_profile_json=company_profile_json)
```

(Top-of-file import; one block, not per-function.)

- [ ] **Step 3a: Verify no patch retargets needed (spec §3.8 step 2)**

Prompt templates are string constants, not patched in any test. Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '"app\.services\.market_research\.(orchestrator|prompts)\.(RESEARCH_MARKET_|.*TEMPLATE)' backend/tests/
# expected: zero matches
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/market_research/
git commit -m "refactor(be): extract market_research/prompts.py [phase H, commit 10/M]

Lift 5 Research_Market_N prompt templates out of orchestrator function
bodies into module-level constants in prompts.py. Templates stay as inline
Python strings; externalization is Option D scope. No test patch-path
retargeting needed (templates are constants, not patched).
236 tests passing."
```

### Task 11: Extract `market_research/llm.py` + `parsing.py`

**Files:**
- Create: `backend/app/services/market_research/llm.py`
- Create: `backend/app/services/market_research/parsing.py`
- Modify: `backend/app/services/market_research/orchestrator.py`

- [ ] **Step 1: Identify `llm.py` content**

Per spec §3.4: `_market_research_agent_output` (~20 LOC). Locate:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def _market_research_agent_output" app/services/market_research/orchestrator.py
```

- [ ] **Step 2: Identify `parsing.py` content**

Per spec §3.4: JSON-extraction helpers shared across the five Research_Market_N workers. These are likely inline `json.loads(...)`-wrapped-in-try-except blocks inside each `Research_Market_N`. Extract the common pattern into a helper (`_extract_research_json(raw_response: str) -> dict` or similar).

- [ ] **Step 3: Create both files**

`llm.py`:

```python
"""LLM invocation wrappers for market_research/."""

def _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend):
    # ... original body ...
```

`parsing.py`:

```python
"""Response parsing for market_research/ — JSON extraction shared across
Research_Market_N workers.
"""

def _extract_research_json(raw_response: str) -> dict:
    """Strip code fences and parse JSON from agent-chain output."""
    # ... extracted from the common pattern across Research_Market_1..5 ...
```

- [ ] **Step 4: Update `orchestrator.py`**

```python
from app.services.market_research.llm import _market_research_agent_output
from app.services.market_research.parsing import _extract_research_json
```

Delete the original `_market_research_agent_output` definition; replace inline JSON parsing in each Research_Market_N with `_extract_research_json(response)` calls.

- [ ] **Step 4a: Retarget test patches for moved symbols (spec §3.8 step 2)**

`_market_research_agent_output` and `_fetch_pinecone_supporting_context` are the candidates. `_fetch_pinecone_supporting_context` is patched in tests; classify at execution time whether it lands in `llm.py` (likely, since it's an LLM-input-context fetch) or stays in `orchestrator.py`. `_market_research_agent_output` is not patched in tests at plan-writing time.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# If _fetch_pinecone_supporting_context moves to llm.py:
sed -i 's/"app\.services\.market_research\.orchestrator\._fetch_pinecone_supporting_context"/"app.services.market_research.llm._fetch_pinecone_supporting_context"/g' \
  backend/tests/test_market_research.py backend/tests/unit/test_market_research.py
# If it stays in orchestrator.py: skip this sed.
```

Verify final state:

```bash
grep -nE '"app\.services\.market_research\.' backend/tests/test_market_research.py backend/tests/unit/test_market_research.py
# expected: every match names a submodule, not the bare package path
```

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/market_research/ backend/tests/test_market_research.py backend/tests/unit/test_market_research.py
git commit -m "refactor(be): extract market_research/llm.py + parsing.py [phase H, commit 11/M]

llm.py: _market_research_agent_output wrapper (unchanged).
parsing.py: _extract_research_json — new helper consolidating the JSON
extraction pattern from all five Research_Market_N bodies.

Test patch-path retargeting per spec §3.8 step 2: if
_fetch_pinecone_supporting_context moved to llm.py, its patch path moved
with it (else stayed at .orchestrator.). Other patched symbols
(COMPONENT_FUNCTIONS, COMPONENT_FUNCTIONS_CLAUDE, Research_Market_1) stay
at .orchestrator.X since those symbols didn't move.

236 tests passing. market_research/ decomposition complete (4 commits)."
```

---

## Sequence D — `icp/` (4 commits)

### Task 12: Scaffold `icp/` package

**Files:**
- Move: `backend/app/services/icp.py` → `backend/app/services/icp/orchestrator.py`
- Create: `backend/app/services/icp/__init__.py`

- [ ] **Step 1: Verify public + `_`-exception surface**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def ICP_generator\|^def icp_research_\|^def run_icp_research\|^def list_icps\|^def delete_recommended_icp\|^def _ensure_icp_indexes\|^def _reserve_unique_icp_id\|^def _release_icp_id" app/services/icp.py
```

- [ ] **Step 2: Move with `git mv`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/app/services/icp.py backend/app/services/icp/orchestrator.py
```

- [ ] **Step 2a: Preemptively clear `__pycache__`**

```bash
rm -rf backend/app/services/__pycache__
```

Eliminates stale-`.pyc` shadowing of the new package. (Same rationale as Task 1.)

- [ ] **Step 3: Create `__init__.py`**

```python
"""icp service — package skeleton (Phase H commit 12/M).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.

§3.7 exceptions: _ensure_icp_indexes (lifespan), _reserve_unique_icp_id +
_release_icp_id (lazy-imported by customer_profile.py).
"""

from app.services.icp.orchestrator import (
    ICP_generator,
    icp_research_1,
    icp_research_2,
    icp_research_3,
    icp_research_4,
    run_icp_research,
    list_icps,
    delete_recommended_icp,
    _ensure_icp_indexes,
    _reserve_unique_icp_id,
    _release_icp_id,
)

__all__ = [
    "ICP_generator",
    "icp_research_1",
    "icp_research_2",
    "icp_research_3",
    "icp_research_4",
    "run_icp_research",
    "list_icps",
    "delete_recommended_icp",
    "_ensure_icp_indexes",
    "_reserve_unique_icp_id",
    "_release_icp_id",
]
```

**This is the highest-stakes scaffold commit** — if either `_reserve_unique_icp_id` or `_release_icp_id` is missing from the `__init__.py` re-export list above, `customer_profile` tests will fail with `ImportError` at runtime when their tests run. The Critical-finding fix in spec round-2 specifically guards against this.

- [ ] **Step 3a: Bulk-rewrite test patch paths (spec §3.8 step 1)**

From plan-writing-time inventory, `icp` has 6 patch targets across two test directories: `ICP_FUNCTIONS`, `ICP_generator`, `_ensure_icp_indexes`, `_release_icp_id`, `_reserve_unique_icp_id`, `icp_research_2`. **`tests/unit/test_customer_profile.py` is intentionally EXCLUDED from this bulk sed** — that file patches `app.services.icp._ensure_icp_indexes` and `app.services.icp._reserve_unique_icp_id` at 9+ sites, and per spec §3.8 "Lazy-import-through-`__init__` exception" those patches must stay at the package path. `app/services/customer_profile.py` uses lazy imports (`from app.services.icp import _reserve_unique_icp_id` inside function bodies) that resolve through `app.services.icp.__init__.py` at call time; rewriting the patches to `app.services.icp.orchestrator.X` (or later `app.services.icp.persistence.X`) would patch a binding the lazy import never reads, breaking every customer_profile test.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's/"app\.services\.icp\./"app.services.icp.orchestrator./g' \
  backend/tests/test_icp.py \
  backend/tests/unit/test_icp.py
```

Verify the rewrite landed where intended:

```bash
grep -nE '"app\.services\.icp\.' backend/tests/test_icp.py backend/tests/unit/test_icp.py
# expected: every match now has .orchestrator. infix
```

Verify `test_customer_profile.py` was NOT touched:

```bash
grep -nE '"app\.services\.icp\.' backend/tests/unit/test_customer_profile.py
# expected: every match stays at app.services.icp.<symbol> with NO .orchestrator. infix
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp/ backend/tests/test_icp.py backend/tests/unit/test_icp.py
git commit -m "refactor(be): scaffold icp/ package [phase H, commit 12/M]

git mv services/icp.py → services/icp/orchestrator.py
__init__.py re-exports full public API plus three §3.7 _-prefix exceptions
(_ensure_icp_indexes for lifespan; _reserve_unique_icp_id and _release_icp_id
for customer_profile.py lazy imports).

Rewrite test patch paths per spec §3.8 step 1: every 'app.services.icp.X'
patch target retargeted to 'app.services.icp.orchestrator.X' across
test_icp.py and unit/test_icp.py only. unit/test_customer_profile.py is
intentionally NOT touched (per spec §3.8 'Lazy-import-through-__init__
exception'): customer_profile uses lazy imports that resolve through
__init__.py, so its patches must stay at the package path
(app.services.icp.X) regardless of where the function lives now.

236 tests passing."
```

### Task 13: Extract `icp/persistence.py`

**Files:**
- Create: `backend/app/services/icp/persistence.py`
- Modify: `backend/app/services/icp/orchestrator.py`
- Modify: `backend/app/services/icp/__init__.py`

- [ ] **Step 1: Identify persistence functions per spec §3.3**

`list_icps`, `delete_recommended_icp`, `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def list_icps\|^def delete_recommended_icp\|^def _ensure_icp_indexes\|^def _reserve_unique_icp_id\|^def _release_icp_id" app/services/icp/orchestrator.py
```

- [ ] **Step 2: Create `persistence.py`**

```python
"""Persistence layer for icp/ — Mongo CRUD for ICP records + ID-registry helpers.

§3.7 exceptions re-exported from __init__.py:
- _ensure_icp_indexes (called from app/main.py lifespan)
- _reserve_unique_icp_id, _release_icp_id (lazy-imported by customer_profile.py)
"""

# ... five functions ...
```

- [ ] **Step 3: Update `orchestrator.py` to call into `persistence.py`**

Three of the five moved symbols (`_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`) are in the §3.8 patch-target inventory. Per spec §3.8 "How callsite code must look", any moved-and-patched symbol requires **module-import + namespace-prefix calls** in orchestrator. Use the module-import pattern for all five (consistent style; the two unpatched symbols `list_icps`, `delete_recommended_icp` cost nothing extra to access via the prefix).

At the top of `orchestrator.py`, add (do NOT use `from .persistence import ...`):

```python
from app.services.icp import persistence
```

Rewrite every callsite of a moved symbol inside `orchestrator.py` to use the namespace prefix:

```python
# Before:
persistence._ensure_icp_indexes(mongo)
list_icps(mongo, org_id)

# After:
persistence._ensure_icp_indexes(mongo)
persistence.list_icps(mongo, org_id)
```

Delete the original function definitions.

**Why not the from-import pattern.** Same reasoning as Task 2 Step 3 — see Task 2 for the full explanation. `customer_profile.py`'s lazy imports go through `app.services.icp.__init__.py` (covered by Step 4 below), so they are unaffected by orchestrator's choice of from-import vs. module-import; the constraint is purely about orchestrator-internal callers and unit-test patches in `tests/unit/test_icp.py`.

**Circular-import resolution.** If `persistence.py` ends up needing helpers still in `orchestrator.py`, use lazy imports inside the persistence function bodies (same pattern as Task 2).

- [ ] **Step 4: Update `__init__.py`**

Move all five symbols from the orchestrator-import block to a new persistence-import block (preserving `__all__`).

- [ ] **Step 4a: Retarget test patches for moved symbols (spec §3.8 step 2)**

Of the 5 moved persistence functions, three are patched extensively: `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`. The other two (`list_icps`, `delete_recommended_icp`) are public functions tests typically call directly rather than patch. Retarget across the two `test_icp.py` files only — **do NOT touch `tests/unit/test_customer_profile.py`** (its patches stay at the package path per spec §3.8 "Lazy-import-through-`__init__` exception"; see Task 12 Step 3a for the explanation):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
for sym in _ensure_icp_indexes _reserve_unique_icp_id _release_icp_id; do
  sed -i "s/\"app\\.services\\.icp\\.orchestrator\\.$sym\"/\"app.services.icp.persistence.$sym\"/g" \
    backend/tests/test_icp.py \
    backend/tests/unit/test_icp.py
done
```

Verify the retarget landed in the icp test files:

```bash
grep -nE '"app\.services\.icp\.(orchestrator|persistence)\.' backend/tests/test_icp.py backend/tests/unit/test_icp.py
# expected: the three retargeted symbols appear with .persistence.; other patched
# symbols (ICP_FUNCTIONS, ICP_generator, icp_research_2) stay at .orchestrator.
```

Verify `test_customer_profile.py` was NOT touched — its patches must remain at the package path:

```bash
grep -nE '"app\.services\.icp\.' backend/tests/unit/test_customer_profile.py
# expected: every match stays at app.services.icp.X (no .orchestrator., .persistence., etc.)
```

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

**Specifically verify `tests/unit/test_customer_profile.py` passed** — it's the load-bearing coverage that exercises the lazy imports of `_reserve_unique_icp_id` and `_release_icp_id`:

```bash
BREWRA_SKIP_DB_INIT=1 python -m pytest tests/unit/test_customer_profile.py -v 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/icp/ backend/tests/test_icp.py backend/tests/unit/test_icp.py
git commit -m "refactor(be): extract icp/persistence.py [phase H, commit 13/M]

Move 5 ICP CRUD + ID-registry helpers out of orchestrator.py. Three are §3.7
exceptions re-exported despite _ prefix: _ensure_icp_indexes (lifespan),
_reserve_unique_icp_id and _release_icp_id (lazy-imported by
customer_profile.py at 4 sites).

Orchestrator uses module-import + namespace-prefix calls
(persistence.X(...)) per spec §3.8 — required for the three patched
symbols whose interception must work for orchestrator-side callers.

Retarget test patches per spec §3.8 step 2: the three _-prefix symbols
move from .orchestrator. to .persistence. across test_icp.py and
unit/test_icp.py. unit/test_customer_profile.py is intentionally NOT
touched (its patches stay at app.services.icp.X per the lazy-import-
through-__init__ exception in spec §3.8). Other patched icp symbols
(ICP_FUNCTIONS, ICP_generator, icp_research_2) stay at .orchestrator.X
since those symbols didn't move.

236 tests passing including test_customer_profile.py (the load-bearing
coverage for the lazy-import case)."
```

### Task 14: Extract `icp/prompts.py`

Same pattern as Task 10 (market_research/prompts.py).

**`_`-exception note:** Task 13 already landed the three `_`-prefix exception re-exports (`_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`) into `persistence.py` and `__init__.py`. Task 14 doesn't touch them — prompts are public-template data with no exception surface to manage.

- [ ] **Step 1: Identify prompt templates inside `ICP_generator` + `icp_research_1..4`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "template = " app/services/icp/orchestrator.py
```

- [ ] **Step 2: Create `prompts.py`** with `ICP_GENERATOR_TEMPLATE`, `ICP_RESEARCH_1_TEMPLATE`, `..._2`, `..._3`, `..._4` constants. Preserve any `{placeholder}` substitution markers — the orchestrator calls `.format(...)` after import.

- [ ] **Step 3: Update orchestrator.py imports** to source templates from `prompts.py`. Delete the original inline template assignments.

- [ ] **Step 3a: Retarget test patches if needed (spec §3.8 step 2)**

Templates are string constants and not patched in tests. If `ICP_FUNCTIONS` (a module-level constant) gets moved into `prompts.py` during extraction (classify at execution time), retarget its patches:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# If ICP_FUNCTIONS lands in prompts.py:
# sed -i 's/"app\.services\.icp\.orchestrator\.ICP_FUNCTIONS"/"app.services.icp.prompts.ICP_FUNCTIONS"/g' \
#   backend/tests/test_icp.py backend/tests/unit/test_icp.py
# If ICP_FUNCTIONS stays in orchestrator.py: skip this sed.
grep -nE '"app\.services\.icp\.prompts\.' backend/tests/
# expected: appears only for symbols that actually moved to prompts.py
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/icp/
# add tests/ only if Step 3a retargeted any patches
git commit -m "refactor(be): extract icp/prompts.py [phase H, commit 14/M]

Lift ICP_generator + icp_research_1..4 prompt templates out of orchestrator
function bodies into module-level constants in prompts.py. Templates stay
as inline Python strings; externalization is Option D scope.

If ICP_FUNCTIONS landed in prompts.py during extraction, its test patches
moved with it per spec §3.8 step 2; otherwise no test path changes.

236 tests passing."
```

### Task 15: Extract `icp/llm.py` + `parsing.py`

Same pattern as Task 11 (market_research/llm.py + parsing.py).

**`_`-exception note:** Same as Task 14 — the three `_`-prefix exception re-exports landed in Task 13 and are not touched here.

- [ ] **Step 1: Identify content**
  - `llm.py`: `_icp_research_agent_output`
  - `parsing.py`: JSON-extraction helpers from `icp_research_N` bodies (likely a `_extract_icp_json(raw_response: str) -> dict` extracted from a repeated pattern across the four workers)

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def _icp_research_agent_output" app/services/icp/orchestrator.py
```

- [ ] **Step 2: Create `llm.py`** with `_icp_research_agent_output` (unchanged body, re-derive imports from function references).

- [ ] **Step 3: Create `parsing.py`** with the new `_extract_icp_json` (or similarly-named) helper consolidating JSON parsing from `icp_research_1..4` bodies.

- [ ] **Step 4: Update orchestrator.py**

```python
from app.services.icp.llm import _icp_research_agent_output
from app.services.icp.parsing import _extract_icp_json
```

Delete the original `_icp_research_agent_output` definition; replace inline JSON parsing in each `icp_research_N` with `_extract_icp_json(response)` calls.

- [ ] **Step 4a: Verify no patch retargets needed (spec §3.8 step 2)**

`_icp_research_agent_output` and `_extract_icp_json` are not in the plan-writing-time icp patch inventory. Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '"app\.services\.icp\.(llm|parsing)\.' backend/tests/
# expected: zero matches
```

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/icp/
git commit -m "refactor(be): extract icp/llm.py + parsing.py [phase H, commit 15/M]

llm.py: _icp_research_agent_output wrapper (unchanged).
parsing.py: _extract_icp_json — new helper consolidating the JSON
extraction pattern from icp_research_1..4 bodies.

No test patch-path retargeting needed: moved symbols are not patched
by string in tests (verified per spec §3.8 step 2).

236 tests passing. icp/ decomposition complete (4 commits)."
```

---

## Sequence E — `signals/` (5 commits)

### Task 16: Scaffold `signals/` package

**Files:**
- Move: `backend/app/services/signals.py` → `backend/app/services/signals/orchestrator.py`
- Create: `backend/app/services/signals/__init__.py`

- [ ] **Step 1: Verify public surface (including live Claude variants)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def search_signals\|^async def run_signals_research\|^async def generate_signals_batch\|^async def fetch_signals\|^async def record_signal_action\|^async def signal_ask" app/services/signals.py
```

Expected: `search_signals`, `run_signals_research`, `generate_signals_batch`, `generate_signals_batch_claude`, `fetch_signals`, `record_signal_action`, `signal_ask`, `signal_ask_claude`.

(`_generate_signals_batch_impl` is internal and intentionally not in the grep pattern — it doesn't get re-exported and doesn't need scaffold-time verification.)

Per spec §3.2 implementor note: Claude variants confirmed live — keep in package.

- [ ] **Step 2: Move with `git mv`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/app/services/signals.py backend/app/services/signals/orchestrator.py
```

- [ ] **Step 2a: Preemptively clear `__pycache__`**

```bash
rm -rf backend/app/services/__pycache__
```

Eliminates stale-`.pyc` shadowing of the new package. (Same rationale as Task 1.)

- [ ] **Step 3: Create `__init__.py`**

```python
"""signals service — package skeleton (Phase H commit 16/M).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, prompts.py, llm.py, and parsing.py.

Hardest service of Phase H — done last with the pattern validated.
"""

from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
    record_signal_action,
    fetch_signals,
)

__all__ = [
    "search_signals",
    "run_signals_research",
    "generate_signals_batch",
    "generate_signals_batch_claude",
    "signal_ask",
    "signal_ask_claude",
    "record_signal_action",
    "fetch_signals",
]
```

- [ ] **Step 3a: Bulk-rewrite test patch paths (spec §3.8 step 1)**

From plan-writing-time inventory, `signals` has 10 patch targets — the highest count of any service: `CLAUDE_API_KEY`, `_claude_messages_text`, `_estimate_token_count`, `_fetch_pinecone_supporting_context`, `_finalize_claude_signal_budget`, `_generate_signals_batch_impl`, `_reserve_claude_signal_budget`, `_tavily_context_and_urls`, `requests.post`, `search_signals`. All currently live in monolithic `signals.py`; after `git mv` they're in `orchestrator.py`.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's/"app\.services\.signals\./"app.services.signals.orchestrator./g' \
  backend/tests/test_signals.py \
  backend/tests/test_signals_v2.py \
  backend/tests/unit/test_signals.py
```

Verify:

```bash
grep -nE '"app\.services\.signals\.' backend/tests/test_signals.py backend/tests/test_signals_v2.py backend/tests/unit/test_signals.py
# expected: every match now has .orchestrator. infix
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/signals/ backend/tests/test_signals.py backend/tests/test_signals_v2.py backend/tests/unit/test_signals.py
git commit -m "refactor(be): scaffold signals/ package [phase H, commit 16/M]

git mv services/signals.py → services/signals/orchestrator.py
__init__.py re-exports public API including confirmed-live Claude variants
(generate_signals_batch_claude, signal_ask_claude — backend-dispatcher
wrappers covered by tests/unit/test_signals.py).

Rewrite test patch paths per spec §3.8 step 1: 10 patched symbols
across 3 test files (test_signals.py, test_signals_v2.py,
unit/test_signals.py) retargeted from 'app.services.signals.X' to
'app.services.signals.orchestrator.X'.

236 tests passing."
```

### Task 17: Extract `signals/persistence.py`

**Files:**
- Create: `backend/app/services/signals/persistence.py`
- Modify: `backend/app/services/signals/orchestrator.py`
- Modify: `backend/app/services/signals/__init__.py`

Per spec §3.2: `record_signal_action` (public) + Mongo read helpers extracted from `fetch_signals` body. Note: `signals/` has no §3.7 `_`-prefix exception re-exports — `record_signal_action` is the only public symbol that lands in `persistence.py`.

- [ ] **Step 1: Locate `record_signal_action` and the Mongo blocks inside `fetch_signals`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^async def record_signal_action\|^async def fetch_signals" app/services/signals/orchestrator.py
```

Read the body of `fetch_signals` and identify the Mongo I/O sections to extract as named helpers. Typical pattern: a `.find().sort().skip().limit()` chain reading from the signals collection, possibly with secondary lookups (e.g., enrichment from a profiles collection). Each cohesive Mongo block becomes one `_`-prefixed helper like `_load_signals_for_user(mongo, user_id, limit, offset)`.

- [ ] **Step 2: Create `persistence.py`**

```python
"""Persistence layer for signals/ — Mongo writes/reads for signal records.

Public symbol re-exported from __init__.py: record_signal_action.
Internal helpers (prefix _): new helpers extracted from fetch_signals body
during Phase H — see commit message for exact names.
"""
# Re-derive imports from function bodies (typing, pymongo, app.models.signals, etc.)

async def record_signal_action(mongo, request):
    """Public — record a user action against a signal. Mongo write to
    the signal_actions collection."""
    # ... original body moved unchanged from orchestrator.py ...

# ... new internal _ helpers extracted from fetch_signals body ...
```

- [ ] **Step 3: Update `orchestrator.py` to import from `persistence.py`**

Neither `record_signal_action` nor the new internal helpers extracted here are in the §3.8 patch-target inventory for `signals`, so per spec §3.8 "How callsite code must look" the simpler from-import pattern is safe. (Re-verify with the §3.8 pre-flight grep; if any moved symbol turns out to be patched, switch to the module-import pattern from Task 2 Step 3.)

```python
from app.services.signals.persistence import (
    record_signal_action,
    # ... internal helpers consumed by fetch_signals ...
)
```

Delete the original `record_signal_action` definition. Inside `fetch_signals`, replace the inline Mongo I/O blocks with calls to the new internal helpers.

- [ ] **Step 4: Update `__init__.py`** — move `record_signal_action` from the orchestrator-import block to a new persistence-import block:

```python
from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
    fetch_signals,
)
from app.services.signals.persistence import (
    record_signal_action,
)
```

(`__all__` list unchanged.)

- [ ] **Step 4a: Verify no patch retargets needed (spec §3.8 step 2)**

`record_signal_action` is not in the patched-symbols inventory; the new `_`-prefix helpers extracted from `fetch_signals` are newly named and have no pre-existing patches. Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '"app\.services\.signals\.persistence\.' backend/tests/
# expected: zero matches
```

- [ ] **Step 5: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

Common failure: an extracted helper references a function still in `orchestrator.py` → circular import or `NameError`. Fix: move the dependency to `persistence.py` too, or pass it as a parameter from orchestrator.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/signals/
git commit -m "refactor(be): extract signals/persistence.py [phase H, commit 17/M]

record_signal_action (public) moved unchanged out of orchestrator.py.
New internal _-prefix helpers extracted from fetch_signals body for
the Mongo I/O blocks. __init__.py updated to source record_signal_action
from persistence. No test patch-path retargeting needed (record_signal_action
not patched; new helpers are newly named). 236 tests passing."
```

### Task 18: Extract `signals/prompts.py`

**Files:**
- Create: `backend/app/services/signals/prompts.py`
- Modify: `backend/app/services/signals/orchestrator.py`

Per spec §3.2: Inline `MAIN_PROMPT_TEMPLATE` + persona prompt blocks (currently lines ~75-313 in the original `signals.py`; line numbers may have shifted after Tasks 16-17).

- [ ] **Step 1: Locate the prompt block**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "MAIN_PROMPT_TEMPLATE\|persona\|PROMPT\|template = " app/services/signals/orchestrator.py | head -20
```

Identify each named prompt constant or inline `template = f"""..."""` block. Common shapes:
- `MAIN_PROMPT_TEMPLATE = """..."""` — a module-level constant
- Persona-specific blocks inside `search_signals(persona=...)` switches (scout vs profiler)
- Per-worker templates inside `generate_signals_batch` / `signal_ask`

- [ ] **Step 2: Create `prompts.py`**

```python
"""Prompt templates for signals/ — main search prompt + persona variants
+ per-operation prompts.

Templates stay as inline Python strings per Phase H scope. Option D will
externalize these to .md/.yaml in a follow-up phase.
"""

MAIN_PROMPT_TEMPLATE = """..."""  # text from current MAIN_PROMPT_TEMPLATE

# Persona variants (Scout vs Profiler) — extract from search_signals body
SCOUT_PERSONA_PROMPT = """..."""
PROFILER_PERSONA_PROMPT = """..."""

# Per-operation prompts as you find them in the source
SIGNAL_ASK_PROMPT = """..."""
# ... etc ...
```

Preserve any `{placeholder}` substitution markers — the orchestrator calls `.format()` after import. If a template is built via f-string interpolation today (not `.format()`), convert it to a `.format()`-friendly template constant + an orchestrator-side `.format(...)` call.

- [ ] **Step 3: Update `orchestrator.py`**

At the top of `orchestrator.py`, add imports for every template constant created in Step 2. Delete the inline template definitions. Replace each f-string-built `prompt = f"""..."""` block with `prompt = TEMPLATE_NAME.format(...)`.

- [ ] **Step 3a: Verify no patch retargets needed (spec §3.8 step 2)**

Prompt templates are string constants and not in the signals patched-symbols inventory. `CLAUDE_API_KEY` is a constant but classifies as config (likely stays in orchestrator unless extracted to a shared config module — out of scope here). Verify:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '"app\.services\.signals\.prompts\.' backend/tests/
# expected: zero matches
```

- [ ] **Step 4: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

If any test fails: the most likely cause is a missed `.format(...)` substitution (the template still contains an unrendered `{placeholder}`). Re-grep the orchestrator for `template`, `prompt =`, and `f"""` to find any inline prompt construction that wasn't lifted.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/signals/
git commit -m "refactor(be): extract signals/prompts.py [phase H, commit 18/M]

MAIN_PROMPT_TEMPLATE, persona prompts (scout/profiler), and per-operation
prompt blocks lifted out of orchestrator into prompts.py module-level
constants. Templates remain inline Python strings. No test patch-path
retargeting needed (templates are constants, not patched). 236 tests passing."
```

### Task 19: Extract `signals/llm.py` + `parsing.py`

**Files:**
- Create: `backend/app/services/signals/llm.py`
- Create: `backend/app/services/signals/parsing.py`
- Modify: `backend/app/services/signals/orchestrator.py`

Per spec §3.2:
- `llm.py`: `_signals_agent_output`
- `parsing.py`: response-normalization helpers extracted from `search_signals` / `_generate_signals_batch_impl` bodies (the response parsing is interleaved with LLM-call logic in `signals.py` — extraction surfaces new named helpers)

- [ ] **Step 1: Identify `llm.py` content**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "^def _signals_agent_output" app/services/signals/orchestrator.py
```

`_signals_agent_output(agent_chain, prompt, company_profile_seed, llm_backend)` should be the only function moving to `llm.py`.

- [ ] **Step 2: Identify `parsing.py` content**

Read the bodies of `search_signals` and `_generate_signals_batch_impl` (and `signal_ask` if needed). Identify response-shape transformations: JSON extraction, signal-list normalization, deduplication, field renaming. Each cohesive transformation becomes a named helper:
- `_extract_signals_from_response(raw: str) -> list[dict]` — raw LLM output → structured signal list
- `_normalize_signal_record(signal: dict) -> dict` — field renaming + defaults
- Plus any others surfaced during extraction

- [ ] **Step 3: Create `llm.py`**

```python
"""LLM invocation wrapper for signals/."""

def _signals_agent_output(agent_chain, prompt, company_profile_seed, llm_backend):
    # ... original body moved unchanged from orchestrator.py ...
```

- [ ] **Step 4: Create `parsing.py`**

```python
"""Response parsing for signals/ — LLM output → structured signal records.

Internal _-prefix helpers (not re-exported). Extracted from search_signals
and _generate_signals_batch_impl bodies during Phase H.
"""
# Re-derive imports (typing, json, re, app.models.signals as needed)

def _extract_signals_from_response(raw_response: str) -> list[dict]:
    """Parse the LLM response into a list of structured signal records.
    Extracted from the response-handling block inside search_signals."""
    # ... extracted code ...

# ... additional helpers as discovered ...
```

- [ ] **Step 5: Update `orchestrator.py`**

```python
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _extract_signals_from_response,
    # ... other parsing helpers ...
)
```

Delete the original `_signals_agent_output` definition. Inside `search_signals` and `_generate_signals_batch_impl`, replace the inline parsing blocks with calls to the new helpers.

- [ ] **Step 5a: Retarget test patches for moved symbols (spec §3.8 step 2)**

Of the 10 signals patched symbols, classify which moved during this commit:

- `_signals_agent_output` → `.llm.` (definitely moves to llm.py per spec §3.2; not in patch inventory but verify)
- `_claude_messages_text`, `_reserve_claude_signal_budget`, `_finalize_claude_signal_budget`, `_estimate_token_count` — classify at execution time: these look LLM-budget-related, likely move to `.llm.X`; verify by reading the source
- `_tavily_context_and_urls`, `_fetch_pinecone_supporting_context` — context-gathering helpers; classify as `.llm.X` or stay in `.orchestrator.X` based on what the implementor extracts
- `requests.post` — external library function; the patch path follows wherever the `requests` import lands (likely orchestrator stays unless llm.py imports requests too)
- `search_signals`, `_generate_signals_batch_impl`, `CLAUDE_API_KEY` — orchestration/config-level, stay in `.orchestrator.`

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Substitute for each symbol that moved to llm.py (extend the list per classification):
for sym in _claude_messages_text _reserve_claude_signal_budget _finalize_claude_signal_budget _estimate_token_count; do
  sed -i "s/\"app\\.services\\.signals\\.orchestrator\\.$sym\"/\"app.services.signals.llm.$sym\"/g" \
    backend/tests/test_signals.py \
    backend/tests/test_signals_v2.py \
    backend/tests/unit/test_signals.py
done
```

Verify the rewrite hit only intended symbols and no stragglers remain:

```bash
grep -nE '"app\.services\.signals\.(orchestrator|llm|parsing)\.' backend/tests/test_signals.py backend/tests/test_signals_v2.py backend/tests/unit/test_signals.py
# expected: each match points to the submodule where the symbol now resides
```

- [ ] **Step 6: Run pytest**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/signals/ backend/tests/test_signals.py backend/tests/test_signals_v2.py backend/tests/unit/test_signals.py
git commit -m "refactor(be): extract signals/llm.py + parsing.py [phase H, commit 19/M]

llm.py: _signals_agent_output wrapper (unchanged body).
parsing.py: response-normalization helpers extracted from search_signals
and _generate_signals_batch_impl bodies — _extract_signals_from_response
plus additional helpers surfaced during extraction.

Retarget test patches per spec §3.8 step 2: budget/context helpers that
moved to llm.py have their patch paths updated. Symbols that stay in
orchestrator (search_signals, _generate_signals_batch_impl, CLAUDE_API_KEY,
requests.post) keep .orchestrator.X paths.

236 tests passing. signals/ structural extraction complete; Task 20 is
the optional cleanup pass."
```

### Task 20: Final cleanup pass for `signals/`

This task is held back as the last commit of the phase. Use it to:

- [ ] **Step 1: Review the final `orchestrator.py` size and contents**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
wc -l app/services/signals/orchestrator.py
grep -n "^def \|^async def " app/services/signals/orchestrator.py
```

Confirm only orchestration-level functions remain (`search_signals`, `run_signals_research`, `_generate_signals_batch_impl`, `generate_signals_batch`, `generate_signals_batch_claude`, `fetch_signals`, `signal_ask`, `signal_ask_claude`).

- [ ] **Step 2: Verify no `signals.py` (file) shadows `signals/` (package)**

```bash
ls backend/app/services/signals*
# expected: only "signals" directory, no signals.py
```

- [ ] **Step 3: Run full pytest one last time**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed
```

- [ ] **Step 4: Post-phase capture-script smoke (spec §5.3)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "from app.services.signals import search_signals; from app.services.market_research import Research_Market_1; from app.services.icp import icp_research_1; print('ok')"
# expected: "ok"
```

This verifies the manual-script imports (capture_fixtures.py and scripts/test_claude_batch_and_market_research.py) will resolve correctly.

- [ ] **Step 5: If any cleanup-worthy issue surfaces** (e.g., a Mongo helper accidentally landed in `signals/orchestrator.py` instead of `signals/persistence.py`), fix it now in this commit.

If no cleanup is needed: this commit may be omitted entirely. Final commit count is then 19, not 20. Update commit-1's message footer (or amend it with `git commit --amend` if the implementor prefers, before pushing).

If cleanup is needed:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/
git commit -m "refactor(be): signals/ final cleanup pass [phase H, commit 20/M]

[Describe any structural touch-ups discovered after the four extraction
commits. If genuinely no cleanup needed, this commit was skipped.]

236 tests passing. signals/ decomposition complete (5 commits).
Phase H end-state: 5 services decomposed, TD-006 closed, test count 236."
```

---

## Post-phase verification

After Task 20 commit (or last commit if Task 20 skipped):

- [ ] **Verify no stale `__pycache__` confusion**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
find app/services -name "__pycache__" -type d | head -10
# (operational only — if running locally and seeing import oddities, rm -rf these)
```

- [ ] **Verify full test count and timing**

```bash
BREWRA_SKIP_DB_INIT=1 python -m pytest -q 2>&1 | tail -3
# expected: 236 passed in ≤10s
```

- [ ] **Verify branch state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD
# expected: 19-20 commits, all "[phase H, commit N/M]" tagged
git status
# expected: clean working tree
```

- [ ] **Verify spec §6 patch-path acceptance criterion**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rnE '"app\.services\.(signals|icp|market_research|data_sources|market_scoring)\.[a-zA-Z_]+"' backend/tests/
# expected: every match names a <submodule> (.orchestrator/.persistence/.prompts/.llm/
# .parsing/.scoring/.normalization/.loaders/.pipeline); no bare-package patch targets remain.
# Bare-package "from app.services.<svc> import X" lines are NOT matched by this grep
# (different pattern) and are fine — they exercise the __init__.py re-export.
```

If any bare-package patch target survives, the corresponding extraction task missed a sed pass — fix forward with the appropriate retarget and amend the relevant commit, OR add a follow-up commit if amending isn't acceptable to the operator.

- [ ] **Optional: manual capture-script run**

If API keys available locally:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python tests/capture_fixtures.py --dry-run
# (or whatever flag exists for dry-run; if no dry-run flag, skip this step)
```

This catches re-export breakage for the manually-run script that pytest doesn't exercise (spec §5.3 known gap).

- [ ] **Hand back to user for merge** — branch is ready for the `finishing-a-development-branch` skill.

---

## Self-review

**Spec coverage check:**
- Spec §2.1 #1 (five decompositions): Tasks 1, 5, 8, 12, 16 (scaffold) + their per-service follow-ups ✓
- Spec §2.1 #2 (rename ripple): Task 5 ✓
- Spec §2.1 #3 (TD-006): Task 4 ✓
- Spec §2.1 #4 (re-exports + §3.7 exceptions): every scaffold task lists the full re-export including `_`-exception symbols ✓
- Spec §2.1 #5 (shared helpers stay flat): no task touches `_llm_helpers.py`, `_retrieval.py`, etc. ✓
- Spec §3.1 dependency direction (no leaf-to-leaf): persistence/loaders/pipeline/normalization/scoring/prompts files don't import from siblings — only orchestrator does ✓
- Spec §3.7 exception list: Task 1, 12 scaffolds re-export all six entries; Task 13 specifically verifies test_customer_profile.py passes for the lazy-import case ✓
- **Spec §3.8 patch-path migration:** every scaffold task (1, 5, 8, 12, 16) has a Step 3a / Step 6 bulk-rewrite of `.X` → `.orchestrator.X` across all relevant test files; every extraction task has a Step Xa selective retarget or verification grep ✓. Tasks 4, 20 omit the step (no moves to retarget). The §3.8-mandated `__init__.py` policy (public + §3.7 exceptions only, no patch-target inflation) is followed: scaffold tasks list only the original spec-defined re-exports.
- Spec §4.2 commit template: every task follows the move/extract/test/commit pattern ✓ (updated to include test-edit step per §3.8)
- Spec §4.3 per-commit verification: every task ends with `BREWRA_SKIP_DB_INIT=1 python -m pytest -q` expecting 236 passed ✓
- Spec §5.4 rename ripple: Task 5 has the broad grep + manual classification + verify-no-stragglers step ✓
- Spec §5.6 Phase F DI assumption: pre-flight has the global-scan grep ✓
- Spec §6 acceptance criteria (incl. new patch-path acceptance line): post-phase verification covers each ✓ (new grep verifies no bare-package patch targets remain)

**Placeholder scan:** No "TODO", no "TBD", no "implement later". Tasks 9, 11, 14, 15, 17, 18, 19 use phrases like "name TBD by implementor" and "extracted helpers" — these are explicitly acknowledged in the spec §3 tables as "helper names assigned during implementation" since the new helpers don't exist yet and have to be carved out of orchestrator function bodies during the work. This is intentional and isn't a placeholder failure. Tasks 7, 11, 14, 15, 19 contain `if X moved to Y, run this sed` conditionals — these reflect implementor classification decisions per spec §3 (the structural-move table lists *most* but not *all* function homes); these are not placeholders but execution-time judgement calls.

**Type consistency:** Public symbol names consistent across spec, scaffold tasks, and re-export blocks. `_run_market_scoring_for_org`, `_get_latest_market_score_rows`, `_reserve_unique_icp_id`, `_release_icp_id`, `_ensure_market_scoring_indexes`, `_ensure_icp_indexes` all spelled identically per spec §3.7.

**Commit count:** Tasks 1-20 = 20 commits, matches the plan's stated "20 commits" target. M=19 or 20 (decided at execution time per Task 20 outcome). Patch-path edits are bundled into the same commit as their corresponding move, so commit count does NOT change despite the §3.8 addition.
