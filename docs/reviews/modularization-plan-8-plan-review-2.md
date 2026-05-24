---
artifact: plans/modularization-plan-8.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 2
---

## Context

Round-2 review of the same plan file (1833 lines, 20 tasks across 5 service decompositions). The plan was substantially revised after round-1 findings: plan-level kill criteria added (line 27), fix-forward/rollback instruction added (line 25), spec deviations section added (lines 29-31), parallelizability section added (line 32), Task 3 misleading import fixed (lines 354), signals/ tasks 17-19 expanded with detailed steps, `data_sources/` commit-count deviation explicitly flagged, and pre-flight DI sanity check false-positive caveat clarified (lines 72-73).

The companion spec is `specs/2026-05-23-backend-service-decomposition-phase-h-design.md` (352 lines, with two prior spec reviews). The reviewer read both documents and the round-1 review in full.

Round-1 findings are cross-referenced below where partially addressed or residual.

## Findings

### [Low] Parallelizability claim omits git branch strategy for parallel agents

**Location:** "Parallelizability" paragraph (line 32).

The plan states "B-E may be dispatched to parallel subagents using the `subagent-driven-development` skill" after Sequence A validates the pattern. This is correct on task-independence grounds (different service files, different routers, different test files, no shared mutable state). However, the plan doesn't specify that each parallel subagent needs its own branch from Sequence A's HEAD, with results merged afterward. Two subagents committing to the same branch simultaneously would produce git conflicts.

The referenced `subagent-driven-development` skill likely handles branch management, but the plan should at minimum note that parallel sequences must not share a branch — otherwise an implementor unfamiliar with the skill's internals might attempt parallel commits on a single branch.

### [Low] `__pycache__` cleanup remains remedial rather than preventive

**Location:** Scaffold task "if pytest fails" notes (lines 141, 521, 874, 1150, 1405).

Round-1 recommended making `__pycache__` cleanup a mandatory post-`git mv` step. The plan added explicit remedial guidance ("If pytest fails later in this task with mysterious `ImportError`: `rm -rf backend/app/services/__pycache__`") in every scaffold task, but kept it as a reactive step rather than a preventive one. Since `git mv` turns a module into a package (e.g., `market_scoring.py` → `market_scoring/__init__.py`), stale `.pyc` files from the pre-move module are predictable, not exceptional. Running `find backend/app/services -name "__pycache__" -type d -exec rm -rf {} +` between `git mv` and the first pytest in each scaffold task would eliminate a class of false-negative failures.

### [Low] Task 16 Step 1 expected output lists symbol not matched by the grep pattern

**Location:** Task 16, Step 1 (lines 1391, 1394).

The grep pattern is:

```
grep -n "^def search_signals\|^async def run_signals_research\|^async def generate_signals_batch\|^async def fetch_signals\|^async def record_signal_action\|^async def signal_ask" app/services/signals.py
```

The expected output lists `_generate_signals_batch_impl` as a symbol to confirm, but the grep pattern has no clause matching `^def _generate_signals_batch_impl` (or `^async def _generate_signals_batch_impl`). An implementor running the grep won't see this function in the output and may conclude it's missing from the source, when actually the grep just doesn't search for it.

Since `_generate_signals_batch_impl` is internal (not re-exported, not in `__init__.py`), verifying its presence is unnecessary at this step. Either remove it from the expected output or add `|^def _generate_signals_batch_impl\|^async def _generate_signals_batch_impl` to the grep pattern.

### [Low] Pre-flight `_`-prefix inventory misses `mocker.patch` string references

**Location:** Pre-flight, "`_`-prefix external-import inventory" (lines 84-87).

The grep `grep -rn "from app.services.$d import _" backend/ tests/` catches direct imports of underscore-prefixed symbols but not `mocker.patch("app.services.$d._func")` patterns in test files. These mock-target strings resolve through `__init__.py` and therefore also require the symbol to be re-exported. If a symbol is referenced only via `mocker.patch` (no direct import), the pre-flight inventory would miss it.

A more comprehensive pattern would be:

```bash
grep -rn "from app.services.$d import _\|mocker\.patch.*app\.services\.$d\._" backend/ tests/
```

The practical impact is low: the spec §3.7 table was assembled by manual inspection and is assumed complete, and the data_sources/ rename handles mock-patch strings separately in Task 5 Step 6. But the general inventory pre-flight has a coverage gap.

### [Nit] No guidance for baseline test counts exceeding 236 at execution time

**Location:** Pre-flight "Verify the test baseline" (line 66) and subsequent task pytest steps.

The fill-in-the-blank says "must be 236" and every task says "expected: 236 passed." The parenthetical says "if different, surface to operator" which handles detection. However, if the actual count is higher (e.g., 238 because tests were added between plan-writing and execution), the operator must then mentally update 19+ "expected: 236" comments throughout the plan. A single note like "if actual count > 236, update all subsequent expected-count references" would reduce friction.

### [Nit] Self-review section remains embedded in the plan

**Location:** "Self-review" section (lines 1813-1833).

Flagged in round-1; unchanged. The self-review is useful reviewer context but cannot be independently versioned or reviewed. No blocking concern — noting for completeness.

### [Nit] Task 7 defers orchestrator.py deletion decision while commit message assumes it

**Location:** Task 7, Steps 4-7 (lines 770-843).

Step 4 presents two options with a recommendation for (a) — delete `orchestrator.py`. The commit message template at lines 840-841 hardcodes "orchestrator.py deleted." An implementor choosing option (b) (keep as placeholder) would need to write a different commit message and a different `__init__.py` structure. The recommendation is clear enough that option (a) is the expected path, but the conditional framing in Step 4 creates a minor inconsistency with the unconditional commit message.
