---
artifact: plans/modularization-plan-8.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 1
---

## Context

Review conducted against the plan's companion spec (`specs/2026-05-23-backend-service-decomposition-phase-h-design.md`, 350 lines) and two rounds of prior spec reviews. The plan is 1557 lines covering 20 tasks across 5 service decompositions. The reviewer read both documents in full.

## Findings

### [High] No plan-level kill criteria — per-step halt is not the same as plan abort

**Location:** "Abort criterion" paragraph (line 23), and absence of any section discussing whole-plan abandonment.

The plan states: "if any task's pytest run shows any failure … halt and report the failure mode before proceeding." This is a per-step halt instruction. It does not address the scenario where multiple services succeed but a later service (e.g., `signals/`) reveals a fundamental problem with the decomposition pattern that casts doubt on the already-committed work. Questions an implementor cannot answer from the plan alone:

- After completing 3 of 5 services, if the pattern breaks on service 4, do you revert the entire branch, or ship the 3 completed decompositions and defer the remaining 2?
- Is there a point where the plan author/operator must be consulted before continuing, beyond "halt and report"?

**Recommendation:** Add a sentence like: "If the decomposition pattern fails on a service (i.e., cannot be made green after reasonable effort), halt the branch and escalate to the operator. Already-completed services that are individually green may be cherry-picked to `master` at the operator's discretion; the branch does not need to be all-or-nothing."

### [High] Template code in Task 3 Step 3 contains a misleading import that will break if followed literally

**Location:** Task 3, Step 3, `scoring.py` template (lines 326–335).

The template shows:

```python
from app.services.market_scoring.normalization import (
    _lead_to_score_row,  # if it depends on normalization helpers
)
```

But `_lead_to_score_row` is listed under `scoring.py` in spec §3.6 (and in the Task 3 Step 1 identification list at line 293). An agentic worker following instructions literally would create `scoring.py` with an import from `normalization` that imports the very function it's supposed to define — causing an `ImportError` or a circular dependency. The parenthetical comment "if it depends on normalization helpers" attempts to qualify this, but the example code block is presented as the file content to write.

A less capable agent may not recognize this as a conditional illustration vs. literal instruction, especially since the rest of the plan's code blocks are meant to be used verbatim.

**Recommendation:** Remove `_lead_to_score_row` from the normalization import example. Replace with a comment: `# from app.services.market_scoring.normalization import (<helpers used by scoring functions, if any>)`. Keep `_lead_to_score_row` only in the scoring module's own function definitions.

### [Medium] Tasks 14, 15, 17, 18, 19 are underspecified — "same pattern as Task X" delegation risks divergent execution

**Location:** Tasks 14 (line 1262), 15 (line 1284), 17 (line 1369), 18 (line 1397), 19 (line 1417).

Tasks 14–15 (`icp/` prompts and llm+parsing) and 17–19 (`signals/` persistence, prompts, llm+parsing) abbreviate their steps to "Same pattern as Task 10/11" with 3–4 line items, while their counterparts (Tasks 10, 11, 9) have 5–7 detailed steps with exact grep commands, file templates, and diagnostic notes. The problem:

- `icp/` and `signals/` have different symbol surfaces, different `_`-prefix exceptions, and different internal structures than `market_research/`. "Same pattern" elides these differences.
- An agentic worker must mentally map the detailed Task 10 template to the `icp/` symbol surface without explicit guidance on what changes (e.g., `icp/` has `_ensure_icp_indexes` + `_reserve_unique_icp_id` + `_release_icp_id` as re-export exceptions that `market_research/` doesn't have; `signals/` has Claude variants).
- Tasks 17–19 for `signals/` are particularly concerning since it's the "hardest case." The plan's own risk assessment (lines 27–31) justifies doing `signals/` last *because* it's hardest, yet the hardest tasks get the least procedural detail.

**Recommendation:** For `signals/` at minimum (Tasks 17–19), expand the steps to include the actual grep commands and `__init__.py` update blocks, matching the detail level of Tasks 2–3. For `icp/` (Tasks 14–15), the abbreviated form is acceptable since `icp/` closely mirrors `market_research/`, but the differences (three `_`-prefix re-exports vs. zero) should be called out explicitly.

### [Medium] No explicit rollback instruction after a failed step

**Location:** "Abort criterion" (line 23) and per-task pytest steps.

The plan says "halt and report the failure mode before proceeding" but does not specify what to do with the working tree state at that point. Should the agent `git reset --hard HEAD` to discard the failed commit? `git stash`? Fix forward in-place? The diagnostic notes ("most likely cause is…") suggest fix-forward, but this is implicit.

An agentic worker that encounters a test failure may leave modified files in the working tree while "reporting," making the branch state ambiguous.

**Recommendation:** Add a single sentence to the abort criterion: "On failure: do not commit. Either fix forward (re-edit the files and re-run pytest) or `git checkout -- .` to discard the attempt and re-read the step."

### [Medium] `data_sources/` commit count deviates from spec without a spec amendment

**Location:** "Note on `data_sources/` commit count" (lines 33–34) and Task 5 header.

The spec §4.2 states `data_sources/` is 4 commits. The plan collapses it to 3, with a clear justification: the spec's 4-commit split would violate per-commit greenness because a partial rename breaks imports. The justification is sound. However:

- The spec file itself (`specs/2026-05-23-backend-service-decomposition-phase-h-design.md`) still says "approximately 21–22 commits" at §4.2 (line 268). The plan targets 20.
- There is no instruction to update the spec to match, and no "spec deviation" annotation in the plan.
- A reviewer cross-referencing spec and plan will see a discrepancy without an explicit reconciliation.

**Recommendation:** Either (a) add a "Spec deviations" subsection at the top of the plan listing this and any other intentional departures, or (b) note in the plan header that the spec should be amended to reflect the 3-commit `data_sources/` sequence.

### [Medium] Plan does not note parallelizability of services B–E after A validates the pattern

**Location:** "Order of attack" (lines 25–31).

The five service decompositions are independent — no task in Sequence B depends on any output from Sequence A. The plan sequences them linearly for pattern-proving (easiest first), which is correct for a single-agent serial execution. However, the plan header explicitly recommends the `subagent-driven-development` skill, which is designed for parallel task dispatch. A plan optimized for parallel execution would note:

- After Sequence A (market_scoring/) validates the pattern, Sequences B–E could be dispatched to parallel agents.
- Each sequence is self-contained and has no shared mutable state with the others (they touch different files).

The plan's silence on this means an implementor using `subagent-driven-development` has no guidance on what can be parallelized.

**Recommendation:** Add a "Parallelizability" note after the order of attack: "Sequences B–E are mutually independent. After Sequence A validates the pattern, B–E may be dispatched to parallel agents. Within each sequence, tasks must remain serial (scaffold → extraction → closeout)."

### [Low] Post-phase `__pycache__` cleanup is optional but could prevent stale-import false positives

**Location:** Post-phase verification, Step 1 (line 1498).

The `find app/services -name "__pycache__"` step is described as "(operational only — if running locally and seeing import oddities)." But `git mv` creates new package directories, and Python's import cache can serve stale `.pyc` files from the pre-move paths, causing `ImportError` that doesn't reflect actual code issues. This is especially likely when the scaffold commit turns a module into a package (e.g., `market_scoring.py` → `market_scoring/__init__.py`).

Making `__pycache__` cleanup mandatory (or at least running it before the first pytest in each scaffold task) would eliminate a common source of false-negative test runs.

**Recommendation:** Add `find backend/app/services -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null` as a step in each scaffold task (Tasks 1, 5, 8, 12, 16) between the `git mv` and the first pytest.

### [Low] Task 20's conditional nature makes the "20 commits" target ambiguous

**Location:** Task 20 header (line 1433) and commit numbering convention (line 19).

The plan states "approximately 20 commits" but Task 20 "may be omitted entirely" if no cleanup is needed (line 1474). The `M` in `[phase H, commit N/M]` is deferred to execution time, which handles the ambiguity, but:

- The plan says "Plan estimates **20 commits** total" (line 19, bold), which reads as a commitment rather than an estimate.
- An implementor who reaches Task 20 with no cleanup needed might feel pressure to find something to clean up to meet the stated target.

**Recommendation:** Change "Plan estimates **20 commits** total" to "Plan estimates **19–20 commits** total (Task 20 is optional cleanup)."

### [Low] TD-006 fix commit mixes two concerns

**Location:** Task 4 (lines 397–462).

Task 4 combines (1) confirming orchestrator.py is correct after extractions and (2) applying the TD-006 two-character fix. The TD-006 fix is a behavioral change (albeit a trivial one) folded into a structural verification commit. Per the plan's own "Decomposition for reviewability" implied standard, these are two distinct concerns:

- Verifying the orchestrator is clean after extraction (structural concern)
- Fixing TD-006 (bug-fix concern)

The spec explicitly says TD-006 should be "folded into" the closeout, so this alignment is correct per spec. But from a plan-review perspective, the commit message should foreground the TD-006 fix more prominently since it's the only behavioral change in an otherwise purely structural phase.

**Recommendation:** No change needed — the commit message already leads with "close TD-006." Flagged for awareness only.

### [Low] Pre-flight Phase F DI sanity check could produce false positives

**Location:** Pre-flight, "Phase F DI sanity check" (lines 59–67).

The grep `grep -rEn "^(client|mongo|driver|pc|agent_chain)\s*=" backend/app/services/` will match any top-level assignment, including legitimate module-level constants (e.g., `client = None` as a sentinel). The plan acknowledges this: "expected: zero matches (or only false positives like inline assignments inside functions)." But the regex anchors to `^` (start of line), so it won't match assignments inside functions — only module-level ones. The parenthetical about "inline assignments inside functions" is misleading about what the regex actually matches.

**Recommendation:** Clarify the note to: "expected: zero matches. Any match is a module-level global assignment, which violates the Phase F DI assumption — classify before halting."

### [Nit] Task 8 Step 4 combines pytest and commit; other tasks separate them

**Location:** Task 8, Step 4 (line 883).

Most tasks have separate "Run pytest" and "Commit" steps (e.g., Task 1 Steps 4–5). Task 8 combines both in one step: "Run pytest, then commit." Similarly, Tasks 12 Step 4, 14 Step 4, and 16 Step 4 do the same. This inconsistency doesn't affect correctness but makes the plan slightly harder to follow for a step-by-step executor.

### [Nit] Self-review section is plan-reviewing-itself — consider moving to a separate artifact

**Location:** "Self-review" section (lines 1537–1557).

The self-review at the end of the plan reads as the plan author's own quality checklist. It's useful context for a reviewer, but embedding it in the plan means it can't be independently versioned or reviewed. Not blocking — just noting the unusual placement.

### [Nit] Placeholder scan claim may be slightly overstated

**Location:** "Placeholder scan" in Self-review (line 1553).

The plan claims "No 'TODO', no 'TBD', no 'implement later'." But Task 9 Step 2 (line 924) shows `_save_market_research_report` as a named-but-not-yet-existent helper with an example signature and `# ... extracted code ...` placeholder body. The plan acknowledges this ("helper names assigned during implementation"), which is fair, but the "no placeholder" claim is slightly overstated.
