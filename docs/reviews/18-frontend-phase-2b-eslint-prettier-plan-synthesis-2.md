---
synthesizes_review: docs/reviews/18-frontend-phase-2b-eslint-prettier-plan-review-2.md
artifact: plans/18-frontend-phase-2b-eslint-prettier.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 2
---

## Round Recommendation

no

Reason: All round-2 findings are addressable with in-scope tightening (remove redundant post-Wave-A probe commit, acknowledge spec override on Wave B default, add spot-check + cascade-recovery reference); the one carry-forward High (inlined helper source) is a methodological disagreement that another round won't resolve.

## Agreed Findings

- **M1 — Post-Wave-A re-probe artifact has no gate value (overengineering).** Reviewer is right that the post-Wave-A re-probe is "informational" by my own plan text and doesn't feed a downstream gate the way post-Wave-B/post-Wave-C do. Removing Task 3.end Steps 6–7 (probe + commit). Updating Task 4.prep Step 1 to read the original Step 0 probe JSON instead of the post-Wave-A artifact. Wave A end-of-wave keeps the format:check + Vitest checkpoint. Reduces Wave A by one commit and removes 4 unused audit artifacts from the branch history.
- **M2 — Wave B combined default overrides spec without acknowledgment.** Reviewer is right that the spec §4 Step 3's "one commit per rule" wording is the implied default and the plan overrides to combined without explanation. Adding a one-line rationale to header decision #3: "This overrides the spec §4 Step 3's implicit per-rule default, exchanging finer commit-grain for execution-time simplicity and removing the ESLint v9 `--rule` flag uncertainty for the common case (diff ≤500). Spec §7.3 explicitly defers batching to plan stage."
- **M3 — Wave B `eslint --fix` may incidentally resolve Wave C/D rules.** Adding a post-fix spot-check step to Task 4.1: `git diff | grep -E '(no-floating-promises|no-misused-promises|exhaustive-deps)'` to surface any incidental fixes. If matches appear, the commit body notes which Wave D rule(s) the sweep also resolved (not a posture violation — Wave D's count from Step 0 already absorbs this; the note just makes the side-effect visible for the impl-review and scorecard).
- **L1 — Wave C ~10-commit progress check has no remediation.** Adding a one-line continuation to Task 5.loop Step 6: "If the count increases between checks, the most recent commit likely introduced a cascade — see the plan header's 'Wave C cascade recovery' procedure: revert the offending commit and apply a tighter fix, escape-hatch the source, or register a TD-FE deferral."
- **L2 — Task 3.7 Step 2 `<config-files>` placeholder.** Replacing the placeholder with command substitution: `npx prettier --write e2e/ scripts/ $(ls *.config.* 2>/dev/null)`. Step 1 stays as the existence pre-check (the `ls` output to working notes for record-keeping); Step 2 uses the same `ls` invocation inline.
- **Nits (carry-forward) — verbose commit bodies, `cd ..` paths.** Acknowledged again; no revision (Phase 2a convention).

## Disagreed Findings

- **L3 — Wave D `rules-of-hooks` fix has no soft-escape for new-file restructuring.** Reviewer flagged the case where the fix might need to extract a child component, calling it a "minor scope expansion not covered by the spec's 'restructure the hook call' language." This is incorrect: Spec 18 §4 Step 5 Wave D §`rules-of-hooks` explicitly lists "pulled into a child component" as a common pattern. The plan's abort criterion (3 failed attempts → halt) plus the spec-covered scope expansion are sufficient. No revision.

## Deferred Findings

(none)

## Severity Disagreements

- **H1 — `build-lint-probe.ts` source inlined verbatim (~310 lines) — round 1 carry-forward.** Agreed substance, **disagree severity (High → Low)**. Round 1 synthesis already adjusted this from High to Low with reasoning that still stands:
  - The writing-plans skill's "No Placeholders" rule mandates "Complete code in every step — if a step changes code, show the code." Inlining the helper follows the skill, not a deviation.
  - Phase 2a precedent (`build-strict-probe.ts`, ~150 inlined lines) shipped via the same pattern and executed cleanly.
  - Steps 2–6 of Task 1.0b explicitly verify the helper: Step 2 runs it and checks exit/output, Step 3 validates JSON shape + top-N files, Step 4 spot-checks raw TXT, Step 5 validates area tree, Step 6 deltas vs Spec §1.3 anchors. A helper bug surfaces at the same commit and aborts the wave before contaminating downstream.
  - The reviewer's argument ("if the code has a bug the executor follows it") would apply to any code embedded in a plan; the discriminator is whether verification gates the use. Here they do.
  
  Round 2's persistence on High does not introduce new evidence; the original counter-arguments stand. Marking again as severity-disagreement; no plan revision.

## Open Questions

(none — round 2 findings are tightly scoped and the synthesis revisions are mechanical)
