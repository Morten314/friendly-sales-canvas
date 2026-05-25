---
artifact: plans/10-backend-lazy-imports-phase-j.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### [Low] No explicit parallelizability annotation

**Location:** Tasks 1–10 structure; no dedicated "dependencies" or "parallelism" section.

Tasks 1–4 and 7–10 are independent vestigial hoists (the spec §4 ordering rationale states this explicitly: "Commits 1-4, 7-10 are independent vestigial hoists"). The plan's header directs agents to use `superpowers:subagent-driven-development`, which parallelizes independent tasks — but the plan itself never marks which tasks are independent. An executing agent reading only the plan (not re-reading the spec) would have to infer parallelizability from the absence of cross-references between tasks. A brief "Dependency graph" or "Parallelizable groups" note (even one line: "Tasks 1–4, 7–10 are mutually independent; 5→6; 11 is last") would remove ambiguity.

### [Low] Minor line-number citation off-by-ones

**Location:** Task 4 Step 4 ("lines 20-23"), Task 5 Step 4 ("lines 7-9").

- **Task 4 Step 4** says "find lines 20-23" in `__init__.py`, but the snippet's first line (`(unit-test import). Internal orchestrator helpers…`) is at line 19 in the actual file. The four-line block spans lines 19–22, not 20–23. The text match is correct; only the line citation is shifted by one.
- **Task 5 Step 4** says "find lines 7-9" in `persistence.py`, but the replacement target starts at line 6 (`Normalization helpers (_extract_company_name…`). The text spans lines 6–9.

Neither affects execution — the provided code snippets match the actual file content exactly — but an agent relying on line numbers alone (without matching the text) would land on the wrong location.

### [Low] Linter test double-reports violations inside nested functions

**Location:** Task 11 Step 1, `_find_violations` inner loop.

The outer `ast.walk(tree)` iterates all `FunctionDef`/`AsyncFunctionDef` nodes. For each, the inner `ast.walk(node)` walks the *entire* subtree — including any nested functions. When a lazy import sits inside a nested function `inner()` within `outer()`, the outer loop finds `outer` and its inner walk reports the violation; then the outer loop finds `inner` and reports the same violation again. The test still passes/fails correctly (duplicates don't change the boolean outcome), but the error message would list the same file:line twice, which is noisy.

Fix: skip the inner walk for `FunctionDef`/`AsyncFunctionDef` nodes that are direct children of an already-walked function, or flatten to a single pass that checks each `ImportFrom`'s ancestor chain for a function-def parent. This is cosmetic — the test is correct for its purpose — but worth noting because Phase J's linter is the long-term invariant enforcer.

### [Nit] Tasks 1 and 2 are a single-function edit split across two commits

**Location:** Task 1 and Task 2 (both edit `list_icps` in `icp/persistence.py`).

Both tasks remove lazy imports from the same function and add lines to the same module-top import block. The spec's 11-commit structure separates them by import source (ICP_generator vs. _retrieval), and the plan faithfully implements the spec. The split is defensible for bisect granularity — if one hoist reveals a cycle, only that commit needs reverting. Flagged as a nit because the two-commit diff for one function's lazy-import removal is unusually fine-grained relative to the rest of the plan (e.g., Task 7 consolidates four call sites in one commit).
