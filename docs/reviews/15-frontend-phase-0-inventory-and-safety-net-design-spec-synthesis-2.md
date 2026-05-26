---
synthesizes_review: docs/reviews/15-frontend-phase-0-inventory-and-safety-net-design-spec-review-2.md
artifact: specs/15-frontend-phase-0-inventory-and-safety-net-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 2
---

## Round Recommendation

**no**

Reason: Reviewer explicitly declares the spec plan-ready. Remaining findings are 2 Medium + 4 Low + 3 Nit — all factual corrections, cosmetic improvements, or plan-level anchors. No Critical/High. All 17 round-1 findings verified as properly addressed.

## Agreed Findings

- **[M-rev2-1] §1.3 wrong claim about journey 04 snapshots.** Verified: `04-market-research-5-components.spec.ts` has no `*-snapshots/` directory and the file's own comment says "Visual-regression assertions intentionally omitted." Total committed snapshots: 20 (journeys 01/03/05 + 5 stubs). Removing `market-research-5-components` from the §1.3 list and changing §2.5's ">5 snapshots fail unexpectedly" threshold to ">25% of snapshots fail" (a ratio survives future snapshot count changes). Revising §1.3, §2.5.

- **[M-rev2-2] §2.4 script spec doesn't cover Vitest measurement.** Adding a bullet to §2.4: Phase 0b extends `measure-baselines.sh` with a `vitest run` measurement using the same 3-run median protocol; no cache clear needed because Vitest has no persistent build cache. Also keeping §3.6 explicit. Revising §2.4.

- **[L-rev2-1] §2.7 node-version TBD could be anchored.** Verified: no `frontend/.nvmrc`, `frontend/.node-version`, or repo-root equivalent exists. Anchoring to "current LTS — 20 or 22" with a note that the plan author confirms by checking what `node --version` reports on their dev environment. Revising §2.7.

- **[L-rev2-2] §2.1 `components/ (loose)` qualification.** Adding a sentence to Tier 1 noting that any files directly under `src/components/` (not in a named subfolder) should be flagged in the notes column as candidates for relocation in Phase 1 or in their owning feature's extraction phase. Revising §2.1.

- **[L-rev2-4] §2.3 bundle JSON `"others"` shape ambiguous.** Simplifying — dropping the top-10/others distinction entirely. The JSON contains a single `"chunks"` array sorted by `size_bytes` descending, with every chunk listed. Phase 2c can compute its own ordering and slicing. The schema becomes self-explanatory. Revising §2.3.

- **[N-rev2-2] §2.9 done-when ordering.** Adding a one-line note: "Items are a checklist, not an execution sequence — the plan specifies execution order." Cheaper than reordering and clearer for future readers. Revising §2.9.

- **[N-rev2-3] §6 R0a-5 Dependabot wording.** Tightening to "If Dependabot or Renovate is ever introduced, it must be configured to update both in the same PR." The conditional now reads as forward-looking, not as a current obligation. Revising §6 R0a-5.

## Disagreed Findings

- **[N-rev2-1] §4 branch naming convention.** The reviewer explicitly notes this is "fine, just consistent with author's judgment." It's an observation, not a finding requiring action. Leaving as is.

## Deferred Findings

- **[L-rev2-3] Firebase transitive imports may need Vitest `deps.inline`.** Reviewer explicitly notes "No spec change needed. Flag for the 0b plan." Acknowledged: the 0b plan author should verify whether Vitest needs Firebase-related `deps.inline` or `deps.optimizer.web.include` configuration if a characterization test transitively pulls in `src/lib/firebase.ts` via shared imports. Trigger to revisit at spec level: if the 0b plan discovers this is a non-trivial config burden that affects characterization-test scope.

## Severity Disagreements

None. The reviewer's severity assignments are accepted.

## Open Questions

1. The reviewer's plan-readiness assessment is unambiguous: "the spec is plan-ready." After round-2 revisions land, the next step is to write the Phase 0a plan (`plans/15a-frontend-phase-0a-inventory.md`).
2. The reviewer's round-1 verification table is exhaustive (all 17 findings confirmed resolved). No round-1 findings re-surface in round 2.
