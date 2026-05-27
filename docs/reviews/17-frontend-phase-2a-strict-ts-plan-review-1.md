---
artifact: plans/17-frontend-phase-2a-strict-ts.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
---

## Context

Reviewed against paired spec `specs/17-frontend-phase-2a-strict-ts-design.md` (round 6). The plan is 2,349 lines implementing a 6-step strict-TypeScript turn-on across `frontend/src/`. The spec was read in full for drift comparison. All six open questions from spec §6 were resolved in the plan's "Plan-stage decisions" section.

## Findings

### [Medium] Wave B/C prep scripts use Step 0 baseline with no re-probe mechanism on drift

**Location:** Task 3.prep Step 1 (line 1682–1683), Task 4.prep Step 2 (line 1964)

The Wave B and Wave C ordering scripts read from the Step 0 JSON artifact (`2026-05-27-frontend-phase-2a-strict-probe.json`). The plan instructs the executor to "recompute against post-Wave-A residue if substantial drift occurred at the Wave A checkpoint" (line 1683) — but this instruction is embedded in a Python docstring comment, and no re-probe command or procedure is provided.

If the Wave A checkpoint shows drift outside tolerance (which the plan explicitly checks for at Task 2-checkpoint), the executor would need to either re-run `build-strict-probe.ts` or run `tsc` directly and parse the output to get fresh per-file/per-code counts. Neither mechanism is codified. The Wave B ordering Python script at line 1685 unconditionally reads the Step 0 file.

Consequence: an executor could miss the manual instruction, proceed with stale ordering data, and process files that no longer have Wave B errors (or skip files that gained errors from Wave A cascades).

**Suggested fix:** Add an explicit conditional step after Task 2-checkpoint when drift exceeds tolerance: re-run `npx tsx scripts/build-strict-probe.ts --date <wave-a-date>` (or a lighter `tsc | parse` step), capture a fresh JSON, and point the Wave B prep script at the new artifact. Alternatively, always re-probe between waves (the runtime cost is a single `tsc` invocation).

### [Low] No merge/rebase strategy if master advances during multi-day execution

**Location:** Pre-flight through Step 5 (entire plan)

The plan assumes master is frozen at `073bf50` during execution. If concurrent work lands on master (e.g., sync.sh merges, other feature branches), the phase-2a branch could face merge conflicts — particularly in `frontend/src/pages/MarketResearch.tsx` and `frontend/src/pages/MissionControl.tsx`, which are the two highest-error files and most likely to receive unrelated edits.

The plan has no rebase-or-merge strategy, no guidance on when to absorb upstream changes, and no instruction to re-baseline after absorbing them.

### [Low] build-strict-probe.ts post-phase lifecycle unspecified

**Location:** File Structure section, "Created" list (line 91)

The helper script is committed in Step 0 and persists in the tree indefinitely. The plan doesn't state whether it's a permanent project tool (for future strict-checking), a Phase-2a-only artifact to be cleaned up post-merge, or something that stays until Phase 4. Without explicit disposition, the file becomes orphaned tooling that a future contributor must evaluate.

### [Low] "No new deps" claim contradicted by R10 contingency

**Location:** "Tech Stack" section (line 9: "No new deps for this phase"), Spec §5 R10

The plan states "No new deps for this phase (the `typescript` package already at `^5.5.3`)." However, Spec §5 R10 explicitly contemplates installing a missing `@types/*` package if TS7016 errors surface, calling it "a Phase-2a-scope dep change because it's required to make typecheck pass." If this contingency triggers, the "no new deps" claim is falsified and the executor has no guidance on how to handle a `package.json` dep addition (commit grain, whether it rides with Step 1b or gets its own commit, whether `package-lock.json` changes need separate handling).

### [Low] python3 is an implicit unstated prerequisite

**Location:** Task 1 Steps 3/5/6 (lines 437–518), Task 2.prep Step 1 (line 1265), Task 3.prep Step 1 (line 1679), Task 4.prep Step 2 (line 1964)

Multiple verification and ordering scripts use `python3` for JSON parsing and data transformation. The "Tech Stack" section lists Node, npm, TypeScript, Vite, Playwright, Vitest, knip, and tsx — but not Python. While Python is ubiquitously available on Linux and the project's AGENTS.md doesn't restrict it, the plan could use Node for these tasks (which is already in the stack) to eliminate the implicit dependency.

### [Low] git reset --hard rollback has minimal re-approach guidance

**Location:** "Post-commit rollback" (line 67)

The plan says "use `git reset --hard HEAD~N` to revert N commits, diagnose root cause, and re-attempt — never 'fix forward' past a runtime regression." This is a sound principle but lacks guidance for common failure modes: what if the cascade is too deep (a type annotation in Wave B broke 5 downstream files), what if reverting loses context about which files in the wave were already verified green, and what constitutes "diagnose" before re-attempting. For Wave A (mechanical deletes), re-attempt is straightforward. For Wave B/C, a partial revert may require the executor to re-identify which files in the wave were clean vs. broken.

### [Nit] Tasks 1a-i/ii/iii repeat ~350 lines of near-identical procedure

**Location:** Tasks 1a-i (lines 572–709), 1a-ii (lines 713–831), 1a-iii (lines 833–970)

The three batch-delete tasks follow an identical 5-step procedure (confirm existence → 6-check kit → git rm → preflight → commit). The only substantive differences are the file list and batch iii's specialized switch.tsx noise handling. A parameterized template with one appendix for the switch special case would reduce this from ~350 lines to ~100 lines without losing information.

### [Nit] Spec companion docs have stale TD-FE numbering

**Location:** Spec §7 (line 394: "next entry is TD-FE-8")

The plan correctly identifies at line 73 that TD-FE-1 through TD-FE-8 already exist, making Phase 2a's first deferral TD-FE-9. The spec's companion documents section still says "next entry is TD-FE-8." Not a plan defect — the plan compensates — but the cross-reference is stale and could mislead a reader who starts from the spec.
