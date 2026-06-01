---
synthesizes_review: docs/reviews/24d-frontend-phase-5d-market-entry-plan-review-1.md
artifact: plans/24d-frontend-phase-5d-market-entry.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 1
---

## Round Recommendation

no

Reason: All findings agreed and applied to the plan; the High finding is resolved, the sole deferred item is a Low spec-owner action (not a plan gap). No re-review round needed.

## Agreed Findings

- **[High] Behavioral guard runs only at the end.** Revised Task 4 to run `journeys/04` at the fetch→hook checkpoint (reordered so the settle+commit becomes Step 4 and runs Playwright `journeys/04` after the unit gates), and to add a Vitest/RTL auto-hydrate assertion so the unit gate carries a behavioral signal — detecting the explicitly-predicted auto-hydrate regression at the risky commit, not at Task N+2.
- **[Medium] Baseline gate weaker than final gate.** Revised Task 0 Step 3 to run the full preflight (the same gate Task N+2 uses) and forbade greening the baseline on a lighter subset; tightened abort criterion 2 to require the full baseline preflight.
- **[Medium] No re-plan branch for 5c having already removed the self-fetch.** Added an explicit Decision Branch to the Task 0 Step 4 preamble: if the audit finds the self-fetch already removed/replaced by 5c's hook-first form, shrink/skip Task 4 and re-derive read seams from the existing hook; if it conflicts with `useMarketEntry`, STOP and escalate per abort criterion 5 (no second stacked hook).
- **[Medium] Error-boundary bundled into the heaviest commit.** Reordered Task 4 so the optional `FeatureErrorBoundary` wrap is a SEPARATE commit (new Step 5) taken only after the fetch→hook swap (Step 4) is green — keeping the gnarliest commit single-concern.
- **[Low] Prerequisite rationale clarity.** Added to the hard-prerequisite block that the binding reason to gate on 5c is the data-path-rewire risk (5c may have already touched this section's fetch), not renderer identity — and recorded the current status (5c unmerged on master; Task 0 Step 2 will correctly STOP).
- **[Low] Task N+1 heuristic field removal.** Named `tsc --noEmit` (Step 4) as the hard regression guard for over-removal, and forbade silencing a resulting sibling type error by re-adding `any`/`?`.
- **[Nit] Literal line-number trust.** Hardened the "Confirmed live structure" header in Task 0 Step 4 to direct re-deriving every line number from the grep output and never acting on a literal `~N` anchor.

## Disagreed Findings

None. Each finding was verified against the live tree before authoring and held; the fixes were low-cost, in-scope plan edits.

## Deferred Findings

- **[Low] Scope-expansion vs. spec §6 — the spec amendment itself.** The plan-side note is applied (self-review "Spec gap flagged"): 5d necessarily absorbs the read-migration 5b's descoped page-rewire missed, to satisfy §6's "reading from hooks" Done-when. The *actual* spec §6 amendment (or master-plan delta) stating 5d–5h each complete their section's 5b read-migration is the spec owner's edit, not a plan edit. **Trigger to revisit:** spec §6 revision cycle, or the 5d impl-review where this is re-flagged (Task N+2 Step 5).

## Severity Disagreements

None. Severities were calibrated deliberately at authoring and stand: the verification-coverage gap at the single riskiest, explicitly-anticipated failure step is High; the baseline-gate, re-plan-branch, and commit-scoping gaps are Medium; the rest Low/Nit.

## Open Questions

- **Will the merged 5c actually leave the self-fetch intact?** Verified present on `master` today, but 5c (hook-first replan) is unmerged. The new Task 0 Decision Branch now handles either outcome, but the executor cannot finalize Tasks 3–4's true scope until 5c lands and Task 0 re-audits. This is correctly gated, not a blocker — flagged so the orchestrator sequences 5d strictly after 5c merges.
- **`journeys/04` runtime cost at the Task 4 checkpoint.** Added one mid-stream Playwright run; if that proves too slow in practice, the Vitest auto-hydrate assertion (also added) is the cheaper primary signal and the E2E can stay end-of-phase — a judgement call for the executor, noted in the revised Step 4.
