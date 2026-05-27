---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-plan-review-1.md
artifact: plans/17-frontend-phase-2a-strict-ts.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: One Medium finding agreed and revised inline (inter-wave re-probe now codified as commit steps); remaining items are Low/Nit, all either revised inline or disagreed with reasoning. No new design surface opened.

## Agreed Findings

1. **[Medium] Wave B/C prep scripts use Step 0 baseline with no re-probe mechanism on drift.** Revised Task 2-checkpoint and Task 3-checkpoint to add an explicit Step 3 that always re-runs `npx tsx scripts/build-strict-probe.ts --date 2026-05-27-post-wave-{a,b}` and commits the resulting JSON+TXT artifacts. Wave B's prep (Task 3.prep Step 1) now reads from `post-wave-a-frontend-phase-2a-strict-probe.json`; Wave C's prep (Task 4.prep Step 2) reads from `post-wave-b-frontend-phase-2a-strict-probe.json`. The File Structure section's "Created" list updated to enumerate the four new audit files. No `build-strict-probe.ts` code change needed — the existing `--date` flag stitches the literal value (including `post-wave-a` qualifier) into the filename.

2. **[Low] build-strict-probe.ts post-phase lifecycle unspecified.** Added one-line statement to the File Structure section's helper entry: kept permanently as project tooling (re-runnable before Phase 2b to verify strict-clean state; precedent: Phase 0a's `build-audit-scorecard.ts` was also kept). No cleanup at Phase 2a merge.

3. **[Low] "No new deps" claim contradicted by R10 contingency.** Re-worded the Tech Stack section to "No new npm deps in the expected case. If Risk R10 triggers, the executor adds the corresponding `@types/<pkg>` as a Wave-C-grain change; the dep addition rides in the same commit as the call-site fix (commit subject form: `chore(fe): add @types/<pkg> to resolve TS7016 in <file>`; commit body explains why no `@types/*` was already present and whether a local `.d.ts` shim under `src/types/` would have been a better fix)." The contingency now has explicit commit-grain guidance.

4. **[Low] python3 implicit unstated prerequisite.** Added Python 3 to the Tech Stack section as a prerequisite, with the note that it's used for JSON parsing/aggregation in verification scripts (same convention Plan 16 uses; Brewra is a Python+TS polyglot). Disagreed with rewriting the Python snippets to Node — see Disagreed Findings.

5. **[Low] No merge/rebase strategy if master advances** (partial agree). Added a "Note on master advancing mid-phase" paragraph at the top of the Pre-flight section: stop at the next natural commit boundary, evaluate whether the upstream change touches a Phase 2a target file, then either rebase (if untouched) or abort per Spec 14 §5.7 (if touched). No full rebase strategy — the branch is short-lived (1–2 days expected) and the abort path already has a codified procedure.

6. **[Low] git reset --hard rollback has minimal re-approach guidance** (partial agree). Added a "Wave B/C cascade recovery" paragraph to the Post-commit rollback section with three named options: (a) tighter fix that doesn't change inferred types downstream, (b) escape-hatch the cascade origin, (c) abort the file and defer to TD-FE. No scripted recipe — cascade patterns vary; the three options cover the common shapes and choice is judgment.

## Disagreed Findings

1. **[Nit] Tasks 1a-i/ii/iii repeat ~350 lines of near-identical procedure.** Disagree. The writing-plans skill explicitly directs: "Repeat the code — the engineer may be reading tasks out of order. 'Similar to Task N' is a plan failure." The three batch tasks are deliberately self-contained — each contains its file list, its 6-check kit invocations, its commit body template. Under the recommended subagent-driven execution model (REQUIRED SUB-SKILL header at line 3), a fresh subagent dispatched on Task 1a-iii has zero shared context with Task 1a-i; the duplication is what makes Task 1a-iii self-contained. Plan 16 follows the same convention (its dead-file removal procedure is repeated across all per-file tasks). The 350-line cost is the price for self-containment; the alternative (parameterized template with appendix) couples tasks to a shared reference, breaking subagent isolation.

2. **[Nit] Spec companion docs have stale TD-FE numbering.** Disagree on this being a plan finding. The reviewer themselves notes: "Not a plan defect — the plan compensates." The plan's header at line 73 explicitly identifies the staleness ("Spec 17 §1.3's 'next entry is TD-FE-8' line is therefore stale") and compensates with the correct number (TD-FE-9). Per CLAUDE.md: "Specs and plans are a frozen record of intent, not current truth ... Don't update specs/plans to reflect post-merge drift; the code is authoritative for current behavior." Spec 17 was correct at its drafting; TD-FE-8 landed afterward; the plan compensates. Backdating the spec would violate the frozen-record convention. No action.

3. **[Low] python3 — rewrite snippets to Node** (sub-finding within review item 5). Disagree on the substance. Python is universally present in Brewra's environment (Brewra is a Python+TS polyglot — backend is Python, every Brewra dev has it installed). Plan 16 uses Python heavily for the same shape of work (e.g., topological sort over knip JSON, area-aggregation tally). Rewriting to Node would discard a project convention and produce more verbose code (Python's dict comprehensions + JSON-load idiom are tighter than Node's equivalents for this kind of aggregation). The "missing prerequisite documentation" gap is the real defect, and it's been addressed (see Agreed item 4).

## Deferred Findings

(none)

## Severity Disagreements

(none — agreed with the reviewer's severities for findings 1, 3, 4; partial-agreed on 2 and 6 at the original Low severity; disagreed entirely with 7 and 8 at the original Nit severity. No case where I agree with substance but disagree with severity.)

## Open Questions

(none surfaced during evaluation.)
