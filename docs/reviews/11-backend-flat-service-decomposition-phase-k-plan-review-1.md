---
artifact: plans/11-backend-flat-service-decomposition-phase-k.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### [Medium] Inconsistent content specification: hardcoded bodies for pipeline sequences vs. "copy verbatim" for all others

**Location:** Sequence F — Task F.0 Step 1 (line 939), Step 2 (lines 964–1027), Task F.2 Step 1 (lines 1143–1205); contrasted with Sequences A–E (e.g., Task A.2 Steps 1–3, lines 198–250).

All six sequences except F use the instruction pattern "copy the body of `<function>` (lines X–Y) verbatim." Sequence F hardcodes the full function bodies inline: `probe_llm` in Task F.0 Step 1, the trimmed `pipeline.py` in Task F.0 Step 2, and `compute_sales_pipeline` in Task F.2 Step 1. If `pipeline.py` (or any function within it) changes between plan-writing (commit `4d5937e`) and execution, the hardcoded bodies will be stale and wrong, while the "copy verbatim" instructions in Sequences A–E would self-correct by copying whatever is currently on disk.

The pre-flight check (Task 0a Step 1) pins execution to `4d5937e`, which mitigates this, but only if the check is obeyed. If the plan is re-executed on a later commit (e.g., after a minor doc change on master), the inconsistency becomes a live defect: Sequences A–E adapt automatically, Sequence F silently creates wrong files.

**Recommendation:** Either switch pipeline tasks to "copy verbatim" style (consistent with A–E), or add a pre-Sequence-F guard that SHA-checks the current `pipeline.py` against the hardcoded content.

### [Low] Post-commit rollback procedure specified in spec but not in plan

**Location:** Greenness invariant (line 21); spec §2 (line 63).

The plan's greenness invariant says: "Any test failure during a task: do not commit. Either fix forward, or `git reset --hard HEAD` (working-tree changes are uncommitted; safe to discard)." This covers the pre-commit scenario well. The spec §2 adds: "If pytest fails after any commit, `git reset --hard HEAD~1` reverts the commit." This post-commit recovery step is absent from the plan.

The scenario where this matters: tests pass at commit time, a later acceptance check (Task 14) or a subsequent sequence's test run reveals a latent issue. The plan says "halt and surface to operator" but doesn't tell the operator (or agent) how to mechanically revert — e.g., `git reset --hard HEAD~1` to undo the last commit, or `git reset --hard master` to scrap the entire branch. An agent following only the plan would halt without a clear rollback path.

### [Low] No explicit global abort criteria beyond per-step halt

**Location:** Abort criterion (line 23); Task 14 (line 1247).

The plan states: "If any commit drops the test count below the 248-passed / 19-snapshot baseline, halt and surface to operator." This is a per-step criterion. There is no stated condition under which the *entire plan* is abandoned (as opposed to replanning a single sequence). For example, if Sequence A's split fails due to a fundamental issue with the scaffold+split pattern, should Sequences B–F be attempted? If Sequence B's patch retarget fails due to an unexpected mock interaction, does that invalidate Sequences C–F (which have zero patch surface)?

The spec §2 discusses Option A vs. Option B and chooses Option A specifically for "blast-radius containment," implying per-sequence isolation, but the plan doesn't make this explicit. A single sentence like "Each sequence is independent; failure of one sequence does not automatically abort the others — the operator decides whether to replan the failed sequence or replan the entire phase" would close this gap.

### [Nit] Forward reference to "Task 14" in Sequence F body text

**Location:** Task F.0 Step 1 (line 957).

The text says: "The lazy-import linter (see Task 14) only flags `from app.services.*` imports." Task 14 is the final acceptance-criteria section, far downstream of Sequence F. A reader (or agent) executing the plan sequentially would not yet have encountered Task 14's description of the lazy-import linter. The reference is navigable but creates a moment of ambiguity. A parenthetical like "(defined in Phase J, exercised in Task 14)" would resolve it.

### [Nit] Function line-number references are pinned to `4d5937e` but not verified by pre-flight

**Location:** All sequences — e.g., Task A.2 function table (lines 186–196), Task B.2 (line 362), Task D.2 (lines 672–678), Task E.2 (lines 812–824).

Every sequence provides line numbers for function boundaries (e.g., "lines 14–20", "lines 64–80"). These are accurate at `4d5937e` but will be wrong if the source files change. Task 0a verifies the commit hash, which prevents drift at the plan's start. However, after Sequence A's scaffold+split commits modify the git history, the line numbers cited for Sequences B–F are referencing the *pre-modification* state of those files, not the current state. This is fine because those files haven't been modified yet (each sequence operates on a different file), but it's a subtlety that could confuse an agent that tries to validate line numbers mid-execution. No action required — just noting the potential for confusion.

### [Nit] Pre-flight grep pattern intentionally diverges from spec §4, documented but not flagged as deliberate deviation

**Location:** Task 0c Step 1 (lines 79–86) vs. spec §4 (lines 239–243).

The plan uses `grep -rnE --include='*.py' "\"app\.services\.${svc}" backend/tests/` (anchored to the opening quote of the patch-string) while the spec uses `grep -r --include='*.py' "mocker\.patch.*app\.services\.leads" backend/tests/` (anchored to `mocker.patch`). The plan explains the difference at line 86: the quoted-string pattern catches both single-line and multi-line patch calls, while the spec's pattern only catches single-line ones. This is an improvement. The explanation is present, but it doesn't explicitly state "this is a deliberate deviation from spec §4, applied because the plan's pattern is strictly more thorough." Adding that framing would make the relationship between plan and spec clearer for future readers.
