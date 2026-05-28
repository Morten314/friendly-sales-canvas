---
artifact: plans/19-frontend-phase-2c-preflight-bundle.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 2
---

## Context

Reviewed against companion spec `specs/19-frontend-phase-2c-preflight-bundle-design.md` (round 2). Verified: Phase 0 baseline JSON exists at `docs/audits/2026-05-26-frontend-bundle-baseline.json` with 5 chunks matching the spec's description; `capture-bundle-baseline.ts` exists at `frontend/scripts/`; `baseName` regex correctness traced against all 5 real baseline filenames (all produce correct results, including `index-CqIc-MII.css` where the greedy `[A-Za-z0-9_-]+` consumes the internal hyphen in the hash).

## Findings

### [Low] Smoke test expected output template shows zero deltas despite acknowledging non-zero reality

**Location:** Task 7 Step 4

The "Expected output (roughly)" block displays `+0 B (+0.00%)` for every delta. The paragraph immediately following states "deltas may be non-zero" and the "What to verify" guidance (table renders, totals match `dist/` reality, exit 0) is correct and sufficient. But an executing agent matching against the template could waste time investigating why their deltas aren't zero. Replacing the zero-delta template with placeholder values (e.g., `<delta>`) or removing it in favor of the prose guidance alone would eliminate the ambiguity.

### [Low] No pre-check that `capture-bundle-baseline.ts` exists before Task 9 depends on it

**Location:** Task 9 Step 1, Task 9 Step 2

The `bundle:rebaseline` script delegates to `tsx scripts/capture-bundle-baseline.ts`. No step verifies this Phase 0 artifact exists on the branch. If it were absent (deleted by a prior cleanup, not present in a partial checkout), Task 9 Step 2 would fail with a non-obvious error. The failure is caught by the recovery policy (stop and report), but a `ls frontend/scripts/capture-bundle-baseline.ts` in Task 9 Step 1 would produce a clearer diagnostic. (The file does exist on `master` as verified during this review; this is about defensive execution, not current state.)

### [Low] `baseName` over-stripping of hyphenated names without dots is an untested known limitation

**Location:** Task 3 Step 1 (tests), Task 3 Step 3 (implementation comment)

The inline comment on `baseName` in Task 3 Step 3 acknowledges that `my-component.js` would be incorrectly stripped to `my-*.js`. The test suite covers 6 cases but none exercise this edge case. The system-level ambiguity fallback in `compareAndPrint` (Task 6) mitigates the impact when duplicate base names result, and the current 5-file baseline has no files that trigger the bug. A test case documenting the known limitation — even one asserting the current behavior with an explanatory comment — would prevent a future agent from assuming full correctness because all tests pass. Noted in spec §6 R1 as "Phase 3+ revisits."

### [Low] `bundle:rebaseline` verification writes to the Phase 0 anchor before discarding

**Location:** Task 9 Step 2

Round 1 flagged this; persists in current plan text. Running `bundle:rebaseline` overwrites `docs/audits/2026-05-26-frontend-bundle-baseline.json` before `git checkout` discards the change. The discard is explicit and verified with `git diff`, so the risk is that an executing agent skips the discard step. The comparator's `BUNDLE_BASELINE_PATH` env var only applies to the read path (`check-bundle-budget.ts`), not to `capture-bundle-baseline.ts`, so there's no clean way to redirect the capture output without modifying the Phase 0 script (out of scope). A safer approach: skip the rebaseline execution entirely and verify only that the npm script is defined and `capture-bundle-baseline.ts` exists — the capture script's correctness was established in Phase 0.

### [Low] `compareAndPrint` output has no automated regression guard

**Location:** Task 6, Task 7 Step 4

Round 1 flagged this; persists. The ~90 LOC rendering logic (alignment, padding, per-chunk matching, added/removed detection, ambiguity fallback) is verified only by visual inspection in Task 7 Step 4. The plan's File Structure section explicitly documents this as a design choice ("No tests added for IO functions"). Defensible for Phase 2c's scope, but any future refactor of the output format (column widths, sort order, delta sign conventions) will have no automated guard. Capturing stdout in Task 7 Step 4 into a committed golden file under `__fixtures__/` would provide a lightweight regression anchor without unit tests.

### [Nit] The `pad` helper is a trivial indirection over `String.prototype.padEnd`

**Location:** Task 6 Step 1

`function pad(s: string, width: number): string { return s.padEnd(width); }` wraps a single method with no added logic. Inlining `.padEnd(width)` at the three call sites would remove the indirection. No functional impact.

### [Nit] Task 9 Step 1 renders the full `scripts` block, risking accidental replacement

**Location:** Task 9 Step 1

Round 1 flagged this; persists. The plan shows the complete `scripts` object and instructs "Preserve any keys that exist that aren't shown here." The surrounding prose ("add two entries") is unambiguous, but showing only the two new lines to insert would be more defensive against a script entry added between plan writing and execution.
