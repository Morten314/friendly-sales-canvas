# Backend Lazy-Imports Phase J — Cycle Removal + Defensive-Import Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan written from this spec.

## 1. Summary

Phase J removes every unannotated lazy `from app.services` import inside `app/services/`. Eight call sites exist (one of which has four call points in a single file). Empirical import-tests run against the current master HEAD show that **seven of the eight sites are vestigial** — the cycle they were defending against either never existed or was broken by later phases. Each of those sites becomes a top-level import with the `# lazy` / `# circular` comment removed. The one remaining site (`market_scoring/persistence.py:67`) is a genuine cycle that requires moving one function (`_lead_to_score_row`) from `scoring.py` to `normalization.py`, where pure data shapers already live.

A new pytest module (`tests/unit/test_no_lazy_service_imports.py`, ~35 LOC, one test) AST-walks `app/services/**/*.py` and enforces the invariant going forward. Any future lazy `from app.services` import inside a function body must either be replaced with a top-level import or carry an explicit `# defensive: <reason>` comment on the same line. The test fails with a precise file:line:source listing if violated.

**Structural impact:** one function moves between submodules (`_lead_to_score_row`: `market_scoring/scoring.py` → `market_scoring/normalization.py`). All other changes are within-file edits. No HTTP surface change, no schema change, no new dependencies. Existing 247 tests stay green at every commit; final commit adds one test, settling the count at 248.

## 2. Scope

### 2.1 In scope

Eight lazy `from app.services` import sites inside `app/services/`:

1. `app/services/icp/persistence.py:40` — named import of `ICP_generator` from `icp.orchestrator`, inside `list_icps`.
2. `app/services/icp/persistence.py:41` — named import of `_build_market_context_queries`, `_fetch_pinecone_supporting_context` from `_retrieval`, inside `list_icps`.
3. `app/services/icp/orchestrator.py:251` — named import of `_build_market_context_queries`, `_fetch_pinecone_supporting_context` from `_retrieval`, inside `_run_icp_research_impl`.
4. `app/services/market_scoring/scoring.py:62` — module-import of `app.services.market_scoring.orchestrator`, inside `_run_market_scoring_for_org`.
5. `app/services/market_scoring/persistence.py:67` — named import of `_lead_to_score_row` from `market_scoring.scoring`, inside `_get_latest_market_score_rows` (genuine cycle; structural fix).
6. `app/services/customer_profile.py:20, 139, 217, 354` — four named imports of `_reserve_unique_icp_id` / `_release_icp_id` from `app.services.icp`, inside four separate functions. Consolidated into one top-level import.
7. `app/services/data_sources/loaders.py:35` — named import of `score_prospect` from `graph_chat`, inside `_process_prospect_data`. Existing inline comment `# lazy: avoid load-time dep` is empirically unfounded (no cycle exists).
8. `app/services/signals/search.py:225` + `app/services/signals/batch.py:66` — named import of `get_leads_for_org` from `leads`, inside two functions across two files.

New test module: `backend/tests/unit/test_no_lazy_service_imports.py`.

### 2.2 Out of scope

- **Cross-package lazy imports inside non-`services/` code** (e.g., routers, `main.py`, scripts). Phase J's invariant applies only to `app/services/**/*.py`.
- **`from app.core` or `from app.models` lazy imports.** Those modules don't have the same cycle history; not flagged in any Phase H/I review.
- **Other open tech debt:** TD-008 (LOC reduction), TD-009 (docstring/code drift), TD-010 (prompts modularization), TD-004 (LLM fixtures), TD-005 (count semantics). Each remains in the register for a future phase.
- **Cycle prevention at higher granularity** (e.g., `import-linter` config with explicit layer rules). The single AST-based pytest module is sufficient for the current scale; layer enforcement is over-engineering for an 8-site problem.

### 2.3 HTTP surface stability

No route paths, request schemas, response schemas, status codes, headers, or query/body parameter names change. No background-task semantics change. All commits are byte-equivalent at the HTTP boundary.

## 3. Architecture

### 3.1 Empirical-audit method

Each lazy-import site was verified against current master HEAD by simulating the hoist with a Python `import` test: load the would-be top-level import first, then load the file containing the lazy import, and confirm no `ImportError` raises. Sites where the test succeeded are classified **vestigial** (hoist OK). Sites where it raises (or where the cycle structure precludes it without code movement) are classified **real cycle** (structural fix required).

The audit method itself is not preserved as part of the deliverable — it's reproducible from the spec, but the running test that prevents regression is the AST linter (§3.4), not the import-time audit.

### 3.2 Per-site disposition

| # | Site | Import form | Real cycle? | Action |
|---|------|-------------|-------------|--------|
| 1 | `icp/persistence.py:40` | `from app.services.icp.orchestrator import ICP_generator` | No | Hoist |
| 2 | `icp/persistence.py:41` | `from app.services._retrieval import _build_market_context_queries, _fetch_pinecone_supporting_context` | No | Hoist |
| 3 | `icp/orchestrator.py:251` | `from app.services._retrieval import _build_market_context_queries, _fetch_pinecone_supporting_context` | No | Hoist |
| 4 | `market_scoring/scoring.py:62` | `from app.services.market_scoring import orchestrator` | No (module-import handles partial-load) | Hoist |
| 5 | `market_scoring/persistence.py:67` | `from app.services.market_scoring.scoring import _lead_to_score_row` | **Yes** | Structural fix (§3.3) |
| 6 | `customer_profile.py:20, 139, 217, 354` (4 sites) | `from app.services.icp import _reserve_unique_icp_id` and `_release_icp_id` | No | Hoist (single top-level import covers all 4) |
| 7 | `data_sources/loaders.py:35` | `from app.services.graph_chat import score_prospect` | No | Hoist; delete `# lazy: avoid load-time dep` comment |
| 8 | `signals/search.py:225` + `signals/batch.py:66` | `from app.services.leads import get_leads_for_org` | No | Hoist (both files) |

### 3.3 Structural fix: `market_scoring/persistence:67`

**Cycle anatomy** at current master HEAD:

1. `app/services/market_scoring/__init__.py` loads on package import; it first executes `from app.services.market_scoring.orchestrator import ...` (its first non-docstring statement).
2. `orchestrator.py` module body contains `from app.services.market_scoring.scoring import _lead_to_score_row, _is_stale_queued_run, _run_market_scoring_for_org` near the top (named imports, line ~40).
3. `scoring.py` module body contains `from app.services.market_scoring import persistence` at line 20 (its top imports block).
4. `persistence.py` begins loading. If line 67's lazy import is hoisted to its top as `from app.services.market_scoring.scoring import _lead_to_score_row`, Python attempts to read `_lead_to_score_row` from the **partial** `scoring` module. At that moment `scoring` is mid-load at its line 20 (the `from . import persistence` line that triggered persistence's load); `_lead_to_score_row` is defined at line 27 of `scoring.py`, **not yet bound**. `ImportError: cannot import name '_lead_to_score_row' from partially initialized module 'app.services.market_scoring.scoring'`.

**Fix:** move `_lead_to_score_row` from `scoring.py` to `normalization.py`.

Rationale: `_lead_to_score_row` is a pure data shaper — it takes a `lead_doc: Dict[str, Any]` and returns a `LeadMarketScoreRow` dataclass, with no side effects, no LLM calls, no I/O. Its purpose matches `normalization.py`'s stated role in `market_scoring/__init__.py` docstring: *"normalization.py: pure data shapers — `_safe_json_to_obj`, `_extract_company_name / _lead_name`, `_parse_iso_datetime`, etc."* It already has no dependency on `orchestrator` or `scoring` internals; the move is a relocation, not a rewrite.

**Dependency graph after move:**

```
normalization  →  (no app.services back-edges)
persistence    →  normalization              (no cycle: normalization is leaf-most)
scoring        →  normalization, persistence (no cycle)
orchestrator   →  scoring, persistence, normalization (no cycle)
__init__       →  orchestrator, persistence, scoring (existing pattern, unchanged)
```

**Caller updates** (verified against master HEAD at spec-write time via `grep -rn "_lead_to_score_row" backend/`):

- `app/services/market_scoring/scoring.py`: defines `_lead_to_score_row` at line 27 but never calls it internally. After the move, `scoring.py` does not import the function back.
- `app/services/market_scoring/orchestrator.py:41`: imports `_lead_to_score_row` as part of a named-import block from `scoring`. Update to import from `normalization` instead.
- `app/services/market_scoring/persistence.py:67`: the previously-lazy line `from app.services.market_scoring.scoring import _lead_to_score_row` becomes `from app.services.market_scoring.normalization import _lead_to_score_row` at module top.
- `app/services/market_scoring/persistence.py:8`: docstring contains the stale line `_lead_to_score_row lives in scoring.py and is imported lazily inside ...`. Update to reflect the new home (`normalization.py`) and the new top-level import.
- `app/services/market_scoring/__init__.py:14`: package docstring lists `_lead_to_score_row` under `scoring.py:`. Update to list it under `normalization.py:`. Not a re-export (verified — no `from .scoring import _lead_to_score_row` exists in `__init__.py`), so the package's public surface is unaffected.

**Test patch-path updates:** none required. `grep -rn "_lead_to_score_row" backend/tests/` returns zero results at master HEAD — no test patches the symbol. The patch-where-it's-used discipline from Phase H/I (codified in `backend/TESTING.md` and memory note `feedback_phase_h_module_import_pattern.md`) is still binding for future patches, but commit 5 introduces no test-side changes.

### 3.4 Regression-prevention test

**File:** `backend/tests/unit/test_no_lazy_service_imports.py` (~35 LOC, single test function).

**Behavior:** AST-walks every `app/services/**/*.py` file. For each `FunctionDef` or `AsyncFunctionDef` node, walks its body for nested `ImportFrom` nodes. If an `ImportFrom` node's `module` attribute starts with `app.services` AND the source line at `node.lineno - 1` does not contain `# defensive:`, the import is flagged. Test fails if any flags collected.

**Allowed escape hatch:** a same-line `# defensive: <reason>` comment exempts a lazy import from the check. This is intentional — there may be future cases where a runtime-deferred import is genuinely required (e.g., to break a cycle that can't be resolved structurally without bigger costs, or to defer an expensive module's load until a rarely-called function runs). The annotation forces the author to articulate *why* and makes the choice reviewable.

**Implementation sketch** (reference, not normative — the plan determines the exact text):

```python
import ast
from pathlib import Path

SERVICES_DIR = Path(__file__).resolve().parents[2] / "app" / "services"

def _find_violations(source, src_lines):
    tree = ast.parse(source)
    violations = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for child in ast.walk(node):
                if (isinstance(child, ast.ImportFrom)
                        and child.module
                        and child.module.startswith("app.services")
                        and "# defensive:" not in src_lines[child.lineno - 1]):
                    violations.append((child.lineno, src_lines[child.lineno - 1].strip()))
    return violations

def test_no_unannotated_lazy_service_imports():
    all_violations = {}
    for py_file in SERVICES_DIR.rglob("*.py"):
        src = py_file.read_text()
        violations = _find_violations(src, src.splitlines())
        if violations:
            all_violations[str(py_file.relative_to(SERVICES_DIR.parent.parent))] = violations
    assert not all_violations, (
        "Unannotated lazy 'from app.services' imports inside services/. "
        "Hoist to module top, or annotate with `# defensive: <reason>`.\n"
        + "\n".join(f"  {fp}:\n" + "\n".join(f"    L{ln}: {code}" for ln, code in vs)
                    for fp, vs in all_violations.items())
    )
```

**Why pytest, not a separate linter:** the test runs with the existing `BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` invocation that gates every commit. No new tooling, no CI config, no `import-linter` install. Discoverable by anyone who runs the suite.

### 3.5 Defensive-annotation policy

After Phase J, the only acceptable lazy `from app.services` imports inside `app/services/` are those with `# defensive: <reason>` on the same line. Examples of acceptable reasons:

- `# defensive: avoids loading heavy ML deps until this rarely-called code path runs`
- `# defensive: structural cycle — orchestrator A and B mutually call each other's helpers; refactor blocked on TD-NNN`

The linter is mechanical — it only checks for the substring `# defensive:` on the same line as the import statement. Reason quality is enforced by reviewers, not by the test. The following pass the linter but should be rejected at code review:

- `# defensive: avoid circular import` (vague — doesn't name which cycle or why structural fix isn't viable)
- `# defensive:` with no reason

The following are not honored at all (different comment text — linter only matches `# defensive:`):
- `# lazy: ...`
- `# circular: ...`

**Multi-line import constraint:** the `# defensive:` comment must appear on the **same line as the `from` keyword** (the first physical line of the import statement). This is what `ast.ImportFrom.lineno` resolves to. A multi-line import with the comment on the closing-paren line, e.g.:

```python
from app.services.foo import (
    bar,
    baz,
)  # defensive: <reason>   ← NOT detected by the linter
```

would be flagged as a violation. Authors writing defensive imports must either collapse to a single-line `from app.services.foo import bar  # defensive: <reason>`, or place the comment on the `from` line directly (using a `#` before the opening paren is not syntactically valid in Python; in practice this means defensive imports should be single-line, importing one symbol at a time).

Phase J introduces no annotated lazy imports; all eight sites are resolved structurally or by hoisting. Future agents may add annotated lazy imports when a cycle is genuinely unfixable, but the burden of justification rests on them.

## 4. Implementation order

11 commits on branch `refactor-backend-lazy-imports-phase-j` off `master`.

| # | Subject | Notes |
|---|---------|-------|
| 1 | `refactor(be): hoist ICP_generator import in icp/persistence` | Move `from app.services.icp.orchestrator import ICP_generator` from inside `list_icps` to module top imports. Delete the `# Lazy imports to avoid circular dependency: persistence -> orchestrator -> persistence` comment. |
| 2 | `refactor(be): hoist _retrieval imports in icp/persistence` | Move the two `_retrieval` named imports from inside `list_icps` to module top. Delete the `# lazy to avoid circular imports` comment. |
| 3 | `refactor(be): hoist _retrieval imports in icp/orchestrator` | Move the two `_retrieval` named imports from inside `_run_icp_research_impl` to module top. |
| 4 | `refactor(be): hoist orchestrator import in market_scoring/scoring` | Move `from app.services.market_scoring import orchestrator` from inside `_run_market_scoring_for_org` to module top. Update the module docstring comment block at the top of `scoring.py` (lines 7-11) that explains the lazy import — replace with a one-liner noting the import is module-level. Also update `market_scoring/__init__.py` lines 21-23 (the architectural-description paragraph ending in *"scoring.py accesses them via a lazy `from app.services.market_scoring import orchestrator` import; tests import them from the submodule directly"*) to reflect the new top-level import. |
| 5 | `refactor(be): move _lead_to_score_row from scoring to normalization` | Delete the function (and its imports of `Dict`, `Any`, `LeadMarketScoreRow` if no longer used in `scoring.py`) from `scoring.py`; add it (with its imports) to `normalization.py`. Update `orchestrator.py:41` named-import block to pull `_lead_to_score_row` from `normalization` instead of `scoring`. Update `persistence.py:8` and `__init__.py:14` docstring lines that reference the old location. No test patches exist for this symbol (verified at spec-write time). |
| 6 | `refactor(be): hoist _lead_to_score_row import in market_scoring/persistence` | Move `from app.services.market_scoring.scoring import _lead_to_score_row` (now `.normalization`) from inside `_get_latest_market_score_rows` to module top. |
| 7 | `refactor(be): hoist icp imports in customer_profile` | Replace four in-function `from app.services.icp import _reserve_unique_icp_id` (and one `_release_icp_id`) with a single top-level `from app.services.icp import _reserve_unique_icp_id, _release_icp_id`. Delete the four lazy lines. |
| 8 | `refactor(be): hoist graph_chat.score_prospect import in data_sources/loaders` | Move to module top. Delete the `# lazy: avoid load-time dep` comment. |
| 9 | `refactor(be): hoist leads.get_leads_for_org import in signals/search` | Move to module top. |
| 10 | `refactor(be): hoist leads.get_leads_for_org import in signals/batch` | Move to module top. |
| 11 | `test(be): add lazy-service-import linter` | Create `backend/tests/unit/test_no_lazy_service_imports.py` per §3.4. Test count: 247 → 248. |

**Ordering rationale:**
- Commits 1-4, 7-10 are independent vestigial hoists; the order chosen is by package, for review clarity (commit-message scope tag groups by sub-package).
- Commit 5 must precede commit 6 — commit 6 depends on `_lead_to_score_row` having moved to `normalization`.
- Commit 11 must be last — adding the linter before all violations are cleared would fail per-commit greenness.

**Branch policy:** per Phase H/I precedent and the CLAUDE.md "Business State (MVP, pre-launch)" note, per-commit merges from this feature branch to `master` are acceptable. Each commit is independently green and bisectable; the implementor may merge after every commit, or in package-grouped batches, or after the full branch — operator's choice.

## 5. Test strategy

### 5.1 Greenness invariant

`cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` reports `247 passed, 19 snapshots passed` at every commit on the branch (i.e., commits 1-10 hold the baseline). Commit 11 adds one test, settling at `248 passed, 19 snapshots passed`.

Per the memory note `feedback_backend_venv_rebuild`, the implementor must confirm `.venv` is built against Python 3.12 (not 3.13) before running the suite for the first time on a fresh checkout:

```bash
cd backend
uv venv --python 3.12 .venv --allow-existing
uv pip install -r requirements.txt
```

### 5.2 Per-commit verification

Every commit is verified individually before staging the next. The implementor runs the suite after each edit, confirms `247 passed` (or `248 passed` at commit 11), and only then commits. If a commit drops below 247, abort and diagnose — by the design's construction, any failure indicates either a missed test patch-path update (commit 5), a missed import update in a caller, or an empirical assumption that turned out wrong (vestigial site that wasn't).

### 5.3 No new behavioral tests required

Phase J adds zero new behavior. The only new test (commit 11) is structural — it checks that the codebase doesn't reintroduce lazy `from app.services` imports inside `services/`. No assertions about runtime behavior, no LLM mocks, no Mongo fixtures.

### 5.4 Snapshot count

19 snapshots before, 19 snapshots after. Phase J touches no code that produces snapshots.

## 6. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Hoisting a "vestigial" import surfaces a cycle that the empirical test missed (e.g., a different import order at runtime triggers the cycle). | Per-commit pytest run catches this immediately — the test suite covers all the cross-module call paths that the audit simulated. If a hoist breaks tests, revert that commit, re-add the lazy import with a `# defensive: <reason>` comment, and document the discovery in `docs/TECH_DEBT.md` as a new TD entry. |
| R2 | The `_lead_to_score_row` move breaks a test patch that wasn't found by `grep`. | Grep is exhaustive for the function name across `backend/tests/`. If a test fails after commit 5, the failure message will name the missing attribute (`AttributeError: module ... has no attribute '_lead_to_score_row'`), pointing directly at the un-updated patch path. |
| R3 | A future commit adds a lazy import without `# defensive:`, and the author overrides the linter test to keep moving. | The linter's failure message includes the file:line:source of every violation, making the override deliberate. The annotation requirement makes the override reviewable in PR / commit log. This is the intended behavior — the linter prevents accidents, not deliberate decisions. |
| R4 | Hoisting `from app.services.market_scoring import orchestrator` to `scoring.py`'s top (commit 4) appears to work in isolation but fails under unusual import sequencing (e.g., direct `import app.services.market_scoring.scoring` without going through `__init__`). | The current `__init__.py` order (orchestrator → persistence → scoring) is the canonical load path used by routers, lifespan hooks, and tests. Any caller bypassing `__init__` would have already been hitting issues; the test suite uses standard imports. If R4 manifests, the same revert + annotate pattern as R1 applies. |

## 7. Out-of-band changes

None. Phase J does not update `docs/TECH_DEBT.md`, `CLAUDE.md`, `BRANCHES.md`, or any other doc, because no register entry corresponds to "lazy imports in services/" — this is finishing work, not a tracked debt. If R1 or R4 manifests and produces a `# defensive:` annotation, the implementor opens a corresponding TD entry as part of the commit that introduces the annotation.

## 8. Acceptance criteria

Branch is mergeable when:

1. `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` reports `248 passed, 19 snapshots passed` — this includes `test_no_unannotated_lazy_service_imports`, which is the binding check for §3.2's disposition (the AST walk is authoritative; no grep-based criterion is needed).
2. No file outside `backend/app/services/` and `backend/tests/unit/test_no_lazy_service_imports.py` is modified by the branch.
3. The pre-existing route-shape and integration tests in `backend/tests/` continue to pass unchanged (covered by criterion 1; called out separately because Phase J's hoists could theoretically perturb import-time side effects that those tests rely on).

## 9. References

- Phase I spec (closes deferrals to Phase J): `specs/2026-05-23-backend-service-decomposition-phase-h-design.md` §2.2 (Out of scope: Item B), `specs/2026-05-24-backend-modularization-phase-i-design.md` §2.2 (Out of scope: Item B).
- Phase H plan (introduces the patch-where-used discipline): `plans/modularization-plan-8.md`; codified in `backend/TESTING.md`.
- Memory note: `feedback_phase_h_module_import_pattern.md` (module-import vs from-import for patched symbols).
- Memory note: `feedback_backend_venv_rebuild.md` (Python 3.12 venv setup).
- CLAUDE.md §"Specs and plans are a frozen record of intent, not current truth" — this spec freezes at merge; the linter is the live invariant going forward.

## 10. Revision log

- **2026-05-25, round 0** — initial draft after `/brainstorming` session. Scope per user: full sweep (all 8 sites), Phase J = lazy-import closure phase. Approach 1 (empirical hoist + minimal structural fix) chosen over alternatives. Paired NN with `plans/10-backend-lazy-imports-phase-j.md` (to be written next via `superpowers:writing-plans`).
