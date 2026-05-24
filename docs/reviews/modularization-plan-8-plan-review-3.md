---
artifact: plans/modularization-plan-8.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 3
---

## Context

Round-3 review of the plan (2318 lines, 20 tasks across 5 service decompositions). The companion spec is `specs/2026-05-23-backend-service-decomposition-phase-h-design.md` (419 lines, with §3.8 added in a round-3 revision after empirical Task-1 execution failure). Prior reviews: round 1 (7 findings: 2 High, 3 Medium, 3 Low, 2 Nit), round 2 (4 Low, 2 Nit). This review assessed the plan as it currently stands, incorporating prior-round resolutions.

## Findings

### [High] Task 12 scaffold has a step-ordering error — pytest runs before patch-path rewrite

**Location:** Task 12 (Sequence D), Steps 3–5 (lines 1488–1537).

The step sequence in Task 12 is:

1. Step 3: Create `__init__.py` (line 1448)
2. Step 4: Run pytest (line 1489)
3. Step 3a: Bulk-rewrite test patch paths (line 1499)
4. Step 5: Commit (line 1518)

Step 3a (the spec §3.8 patch-path rewrite from `app.services.icp.X` → `app.services.icp.orchestrator.X`) is placed **after** Step 4 (pytest). Every other scaffold task in the plan uses the correct order: create `__init__.py` → rewrite patch paths → pytest:

- Task 1 (market_scoring): Step 3 → Step 3a → Step 4 ✓
- Task 5 (data_sources): Step 3 → Step 6 → Step 8 ✓
- Task 8 (market_research): Step 3 → Step 3a → Step 4 ✓
- Task 12 (icp): Step 3 → **Step 4** → Step 3a ✗
- Task 16 (signals): Step 3 → Step 3a → Step 4 ✓

An agentic worker following the plan literally will run pytest at Step 4 with patch strings still targeting `app.services.icp.X`. Per spec §3.8 (confirmed empirically during Phase H execution on Task 1), these patches will fail to intercept internal calls — the `__init__.py` re-export makes the target *findable* but does not redirect name resolution inside `orchestrator.py`. The resulting test failures will trigger the plan's abort criterion (line 23: "if any task's pytest run shows any failure … halt and report").

The "highest-stakes scaffold commit" note at line 1497 is correctly placed in terms of content (it warns about the `customer_profile` lazy-import risk) but its placement inside the premature pytest step compounds the confusion — an agent may read it as validation that the expected test failures are a known risk rather than a step-ordering bug.

**Fix:** Move Step 3a (lines 1499–1516) to between the current Step 3 and Step 4, matching the ordering in Tasks 1, 8, and 16.

### [Low] Task 5 commit step uses `git add -A` — broader staging than other commits

**Location:** Task 5, Step 9 (line 786).

```
git add -A backend/app/services/data_sources/ backend/app/services/ backend/app/routers/ backend/app/main.py backend/tests/
```

The `-A` flag stages all changes (including deletions and untracked files) in the listed paths. Every other commit step in the plan uses bare `git add` (no `-A`) with explicit file paths. If any untracked or unexpected file exists in those directories (e.g., editor swap files, stray `__pycache__` artifacts, temporary test outputs), `-A` would stage them unintentionally. The other commit steps' explicit-file approach is safer.

**Fix:** Replace `git add -A` with `git add` (drop the `-A` flag), or list the specific renamed/created files explicitly as other tasks do.

### [Low] Task 12's "highest-stakes" note is misplaced inside the prematurely-ordered pytest step

**Location:** Task 12, Step 4 note (lines 1497–1498).

The note "This is the highest-stakes scaffold commit — if either `_reserve_unique_icp_id` or `_release_icp_id` is missing from `__init__.py`, `customer_profile` tests will fail" is a task-level observation about the scaffold commit's importance, not a pytest-specific concern. Placing it inside Step 4 (pytest) makes it look like commentary on the test run rather than a warning about the `__init__.py` re-export list in Step 3.

If the High finding above is fixed (Step 3a moves before Step 4), this note should also move to the task header or to Step 3 (where `__init__.py` is created), since it's about the re-export list, not about test execution.

### [Nit] Self-review section remains embedded in the plan

**Location:** "Self-review" section (lines 2297–2318).

Flagged in rounds 1 and 2; unchanged. The self-review is useful context but cannot be independently versioned or reviewed. Not blocking — noting for continuity.

### [Nit] Task 12 Step 1 grep pattern omits `_run_icp_research_impl`

**Location:** Task 12, Step 1 (line 1428).

The grep pattern searches for `ICP_generator`, `icp_research_1..4`, `run_icp_research`, `list_icps`, `delete_recommended_icp`, and the three `_`-prefix exceptions. It does not search for `_run_icp_research_impl`, which spec §3.3 lists as an orchestrator.py resident. Since `_run_icp_research_impl` is internal (not re-exported, not in `__init__.py`, not in §3.7), verifying its presence at scaffold time is unnecessary — but its absence from the grep output could confuse an implementor who cross-references against the spec §3.3 table.
