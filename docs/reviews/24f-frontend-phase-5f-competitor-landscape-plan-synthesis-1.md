---
synthesizes_review: docs/reviews/24f-frontend-phase-5f-competitor-landscape-plan-review-1.md
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

## Round Recommendation

no

Reason: All eight actionable findings are agreed and resolved by cheap, mechanical revisions (a test assertion, a commit split, a baseline-gate tightening, an explicit decision branch, naming a guard, a TD-FE log step, two doc caveats). No Critical/High remains disagreed or deferred, and none of the revisions opens new design surface that warrants a re-review round.

## Agreed Findings

- **[High] `journeys/04` deferred to Task N+2.** The finding holds: spec §8 designates the behavioral journey as the primary proof that decomposition preserved behavior, yet Task 4 — the read-path swap, self-described as the heaviest commit and whose signature failure mode the plan itself predicts — is gated only by `tsc`/`lint`/directory-`vitest`/`knip`. Adopting review option (b): add to Task 4 Step 1's hook/container tests an assertion that the container auto-hydrates from `useCompetitorLandscape` and that the empty-state Scout affordance wires to `cl.refresh` (disabled on `cl.isRefreshing`), so the structural gate carries a behavioral signal. Plus a lighter version of option (a): run `journeys/04` **once** at the Task 4 checkpoint (the single riskiest commit), not the whole Playwright suite per task.
- **[Medium] Error-boundary wrap bundled into Task 4.** Finding's premise holds *in principle*, but resolved by investigation (see Open Questions): 5c already wraps the whole intelligence tab in one `<FeatureErrorBoundary featureName="Market Intelligence">` (`IntelligenceTab.tsx:649`), and the merged 5d `market-entry/` section added no section-level boundary. So per the plan's own Task 0 Step 5 rule, **5f adds no boundary** — there is nothing to bundle or split. Revision: downgrade Task 4 Step 4 and Task 0 Step 5 from a conditional "if warranted, wrap" to a confirm-only step ("tab-level boundary already covers this section — add none; note in PR"). Effective severity drops to Nit.
- **[Medium] Baseline gate weaker than final gate.** Holds, and the misattribution risk is real for a ~15-commit refactor branch built on 5c/5d/5e churn. Revision: drop the "or the lighter typecheck+lint+test subset" escape hatch in Task 0 Step 3 — run the full `npm run preflight` at baseline so a pre-broken build/`journeys/04`/`knip --strict` is caught as "already red," not blamed on 5f at N+2. (This is about diagnostic symmetry, not gate hardness, so it does not conflict with the project's advisory-gate posture.)
- **[Medium] No explicit branch if the self-fetch is already gone.** Holds — Task 0's own preamble raises the possibility ("5b/5c may have rewired or partially removed the in-component read machinery") but no concrete outcome handles it; abort 5 covers only un-cuttable cross-section coupling, not a clean prior removal. Revision: add an explicit Task 0 Step 4 / Task 4 outcome — *if the read fetch/cache is already absent, shrink or skip Task 4's read-path deletion, derive the read seams from the existing wiring, and record the reduced scope in the PR.*
- **[Low] Name `tsc --noEmit` as the field-removal guard.** Holds. Task N+1 Step 1's "removable only if no other section reads it" heuristic is sound but leans on grep/judgment; the Step 4 `tsc --noEmit` is the hard signal (a field still referenced by a sibling section type-errors). Revision: state this explicitly in Step 1.
- **[Low] `/ask` edit-write fetch: "candidate TD-FE" is ambiguous.** Holds. The plan keeps the write-path raw `fetch` as a deliberate scope boundary but leaves it unclear whether the executor logs it. Per repo convention (CLAUDE.md: log accepted quality compromises to `docs/TECH_DEBT.md`), resolve toward logging: add a Task N+2 step to record a TD-FE for the surviving `/ask` write path — **surgical append, no prettier reformat** of `TECH_DEBT.md`.
- **[Nit] Pre-5a line-number anchoring.** Holds (defensive). Revision: add a one-line "(re-derive from Task 0 grep output — do not use literal line numbers)" caveat on the densest anchor block (Task 0 Step 4 confirmed-structure / Architecture).
- **[Nit] Tasks 5–15 absolute numbering vs "reconcile".** Holds, minor. The N+1/N+2 abstraction already insulates the load-bearing references; revision is a one-clause add to the "(reconcile)" item noting subsequent tasks re-number if the block count changes.

## Disagreed Findings

None. All findings characterize the plan accurately and survive cross-referencing against §6/§8 and the plan's own task structure.

## Deferred Findings

None. Every agreed revision is in-scope for this plan artifact and cheap to apply now.

## Severity Disagreements

None — concur with all assigned severities. Note on the High (Finding 1): it is correctly High as framed (Task 4 is the branch lynchpin and a silent regression there is expensive to roll back across the subsequent extraction commits); the agreed option-(b) assertion plus a single Task-4 `journeys/04` run substantially de-risks it without per-task Playwright cost.

## Open Questions

- **Boundary placement (affects Finding 2) — RESOLVED 2026-06-02 by reading merged `master`:** 5c wraps the *entire* intelligence tab in a single `<FeatureErrorBoundary featureName="Market Intelligence">` (`IntelligenceTab.tsx:649`, around `<MarketIntelligenceSections />`), and `FeatureErrorBoundary` appears nowhere else in the feature — the merged 5d `market-entry/` section added none. Convention is per-tab, not per-section. Consequence: 5f adds no boundary; Finding 2 collapses to a confirm-only step (no commit to split). Folded into the Finding 2 entry above.
- **Finding 1's mid-branch `journeys/04` run** intersects the known FE-e2e false-green risk (a stale `:5173` preview server can make Playwright pass against the wrong build). If the Task-4 journey run is added, it must kill any orphan preview server first — otherwise the added behavioral signal is unreliable.
- **Positive (review's final Nit):** the plan's explicit scope-flagging of the self-fetch / read-migration (Goal + self-review) is acknowledged; no action.
