---
synthesizes_review: docs/reviews/32-frontend-phase-13-loc-reduction-pass-2-plan-review-1.md
artifact: plans/32-frontend-phase-13-loc-reduction-pass-2.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-06
round: 1
---

## Round Recommendation

no

Reason: Both High findings are agreed and resolved by in-place revision (phase-wide re-scope trigger; similarity scan flipped to ts-morph); all remaining findings are Medium/Low recovery/precision/clarity fixes applied this round — no Critical/High remains and no new design surface was opened.

## Agreed Findings

- **[High] F1 — no phase-wide cost ceiling.** Abort criterion rewritten to add a concrete phase-wide re-scope trigger (pause + surface to operator if >50% of 13a-i candidates need full `investigate`, or the 13a-iv dedup loop exceeds ~15 groups), grounded in Spec 14 §5.7's ≥2× rule.
- **[High] F2 — similarity-scan from-scratch build with unbounded fallback.** Task A2 flipped to **ts-morph-first** (added as a devDep in its own commit; implemented with ts-morph's AST API), and the precision spot-check is now bounded to **one** tuning commit (>30% false positives → raise threshold/shingle once, then proceed). Tech Stack + File Structure updated. This **reverses** the plan-write raw-API-first decision — the reviewer is right that the dep cost is trivial while the from-scratch scanner was the real risk.
- **[Medium] F3 — no candidate source for single-use trivial wrappers.** Task E now has an explicit identification step (list <15-LOC components, keep those that are one-line passthroughs imported exactly once) — closes the Spec §3.1 bullet-5 gap the similarity/knip scans miss.
- **[Medium] F4 — dead-export removal lacked recovery.** Added `git checkout -- <file>` revert + switch-to-keep on G failure, matching the dead-file recovery pattern.
- **[Medium] F5 — 6-check basename false positives for generic names.** Added a caveat for `index/utils/types/constants/helpers`: trust knip's path-aware graph + C1/C3 over the C4 plain-text grep; noted the failure direction is safe-side (spurious C4 → conservative keep, never a broken build).
- **[Medium] F6 — no dedup-loop cardinality bound.** Covered by the F1 phase-wide trigger plus a Task E header note (>15 candidate groups → surface for prioritization).
- **[Medium] F7 — advisory-failure handling undefined.** Gate description now states an advisory failure is treated exactly like a gate-G failure (fix, or revert + defer the finding) and counts toward the 3-attempt abort.
- **[Low] F8 — "pixel-neutral" vs 2% threshold.** Clarified the advisory visual-regression expectation as component-level ~0% drift on the affected screenshots (not the 2% global floor); a perceptible sub-2% change is deferred, not shipped. Applied to the gate description + Task E.
- **[Low] F9 — TD-FE runtime-grep atomicity.** Stated decomposition sub-phases run serially (Phase 13 is solo), so the grep is collision-free; pre-allocate a block only if ever parallelized.
- **[Low] F10 — dead-export re-scan split across Tasks B/C.** Task C now opens with "skip any symbol already removed/closed in Task B" to prevent double-processing.
- **[Low] F11 — hardcoded baseline filename.** Stage 0 Step 6 globbed to `docs/audits/*-frontend-bundle-baseline.json`.
- **[Nit] F12 — topo-sort SHA reference.** Replaced `git show 5099110:…` with the plain `plans/16-…` path (on master).
- **[Nit] F13 — Task K branch ambiguity.** Gave explicit guidance: final sub-phase branch if unmerged, else a `phase-13-close` branch off master.

## Disagreed Findings

None. All thirteen findings held on verification against the plan and Spec 32. (On F2 I adopted recommendation (a) — switch to ts-morph — over (b) — bound the raw-API attempt — because the dependency cost is trivial and the from-scratch AST scanner was itself the risk the finding identified; bounding a risky build is weaker than removing the risk.)

## Deferred Findings

None. Every finding was addressed in this round.

## Severity Disagreements

- **F1: reviewer High → I assess Medium.** Spec 14 §5.7 already provides the phase-level abort-and-revert backstop; the genuine gap was that the plan didn't surface it as a concrete, loop-specific checkpoint. Resolved regardless, so this does not change the round recommendation.
- **F2: High accepted.** A from-scratch shingle-Jaccard AST scanner at the very start of 13a is a real stall risk; no severity disagreement. Resolved by the ts-morph flip.

## Open Questions

- The single-use-wrapper heuristic (F3 fix: `<15 LOC` + one-line passthrough + single importer) is a candidate filter, not a decision — the executing agent still judges "adds semantic clarity." Flagged so the executor does not over-inline meaningful thin wrappers.
- The ts-morph fingerprint threshold (0.85) is a starting heuristic; the Step 2 bound caps tuning at one commit, but the empirically-right value is settled during 13a-0 and recorded in the scorecard (§12 Q3).
