---
synthesizes_review: docs/reviews/26-frontend-phase-7-customers-design-spec-review-1.md
artifact: specs/26-frontend-phase-7-customers-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-04
round: 1
---

## Round Recommendation

no

Reason: All three High findings are accepted and resolved by clarification (no residual High surface); the remainder are Low/Nit, severity-only, or a correctly-rejected alternative.

## Agreed Findings

- **[High] Log-and-degrade under-specified (1).** §4 — define degradation precisely: an all-optional `.passthrough()` schema means `.parse` does not reject real responses, so there is essentially no throw path; the preserved `mapApiICPToSuggested` "return defaults for missing fields" behavior *is* the degradation. Drop the overstated "throw"/"log-and-degrade" framing and state the all-optional/best-effort-extraction semantics.
- **[High] Stage-2 hook consumption ambiguous (2).** §7 stage 2 — state that contracts/services/read-hooks/MSW are *built and unit-tested* in stage 2 and *consumed into the components* in stage 3 (hook-first, matching Phase 6's read-path→decomposition ordering). Note the unused-export window closes before the stage-5 merge gate (full `knip --strict` only runs at merge), so no dead code reaches `master`.
- **[High] TanStack loading/error/refetch parity (3).** §4 + §8 — add an explicit parity note grounded in `shared/api/queryClient.ts`: customers' read hooks inherit Phase 3's defaults (`refetchOnWindowFocus: false` already matches raw fetch; `staleTime: 5min` preserves the prior ~5-min cache intent), set per-query `retry: false` where strict parity with raw fetch's single attempt matters (global default is `retry: 1`), and audit each consuming component's loading/error render output against the raw-fetch equivalent. The absolute "no behavior change" claim in §8 is qualified accordingly.
- **[Medium] Decomposition seams under-analyzed (4) + [Low] internal-state analysis (10).** §3/§7 — add a coarse purity characterization: `icpMapping.ts` is pure (no React/state), `suggestedIcpStorage.ts` is pure `localStorage` I/O (no React), card subcomponents consume the read hooks + receive container state via props. The full state-footprint DAG is deferred to the plan (see Deferred).
- **[Medium] Dual ICP read paths, no divergence detection (5).** §9 — state the maintenance hazard explicitly: until Phase 9 consolidates, an `/api/icp` shape change must be updated independently in `features/customers/contracts.ts` and mission-control's ICP schema, with nothing coupling the two to catch a missed update (accepted under pre-launch, zero-user posture).
- **[Medium] TD-FE allocations both finalized and speculative (6).** §10 — relabel the entries as *provisional* (numbered from TD-FE-41 assuming no intervening register allocations; renumbered at stage-5 finalize). Removes the heading/body contradiction.
- **[Medium] Stage 5 mixes code + cross-artifact amendments (7).** §7 stage 5 — reorder so all finalization/cross-artifact work (lock `index.ts`, README, amend Spec 25 §6 + mission-control README, allocate TD-FE) precedes the serial preflight, which becomes the strictly-final action; a doc-revealed contradiction is resolved before the gate, not fixed forward. (Implemented as explicit intra-stage ordering, not a new numbered stage — see Severity.)
- **[Medium] Rollback mechanism unspecified (8).** §7 — specify the concrete op: `git reset --hard` to the last green checkpoint commit (the branch is local/unshared during the phase, so a lost attempt is acceptable and avoids revert noise).
- **[Low] e2e path omits `frontend/` prefix (9).** §1.4 + §8 — correct to `frontend/e2e/journeys/06-customers-page-load.spec.ts`.
- **[Low] LeadStream relocation value (11, pattern-consistency half).** §2.1/§3 — add rationale: `LeadStream` moves for structural consistency (customers-owned; consumed intra-feature by `SuggestedICPCards` via `getLeadCountForICP`), not for a data-layer benefit. (The "leave it in place" half is rejected — see Disagreed.)
- **[Nit] LOC total (12).** §1.3 — make the total exact (`= 3,717`).
- **[Nit] Commit SHAs without branch context (13).** §1.2 — annotate `010c131`/`5a91848` as on `master`.
- **[Nit] "raw-fetches" as a verb (14).** §5 — reword to "issues raw `fetch` calls".
- **[Nit] Tree `__tests__/` inconsistency (15).** §3 — note co-located `__tests__/` in each component folder (not only `icp-intelligence/`).

## Disagreed Findings

- **[Low] LeadStream "consider leaving it in place" alternative (11).** Rejected. Leaving customers files in legacy `src/components/customers/` defeats the feature-extraction goal, violates the §11 done-when ("`src/components/customers/*` gone"), and breaks the same-feature relative-import requirement — `SuggestedICPCards` imports `getLeadCountForICP` from `LeadStream`, so they must co-locate. Only the pattern-consistency observation is agreed; the leave-in-place suggestion is incorrect for this design.

## Deferred Findings

- **Full `SuggestedICPCards` state-footprint DAG (deep half of 4/10).** Deferred to plan-writing. Mapping every `useState`/`useEffect` chain and its flow into the extracted cards requires the full 2,494-LOC read that is the plan's job; the spec adds the coarse purity note now so the plan has a safe starting frame. Trigger: writing `plans/26-...` stage-3 tasks.

## Severity Disagreements

- **TD-FE finalized-vs-speculative (6): Low, not Medium.** Internal-consistency wording with no design or cost impact.
- **Stage-5 mixing (7): Low, not Medium.** A stage-organization preference; the existing ordering already placed the gate last, so the residual design risk is minimal. Addressed by tightening the intra-stage ordering rather than adding a sub-stage.
- **Rollback mechanism (8): Low, not Medium.** A one-line operational detail already implied by Spec 14 §5.7 + repo convention (unshared local branch → `reset --hard`). Agreed and added, but not Medium.

## Open Questions

- Finding 3's residual nuance: Phase 3's global `retry: 1` differs from raw fetch's single attempt. The spec edit pins `retry: false` on customers' read queries where strict parity matters; whether a single transient-failure retry is materially user-visible (vs. an acceptable robustness improvement) is a judgment the plan/impl confirms against the actual loading-state renders. Everything else about the QueryClient defaults is now verified in `shared/api/queryClient.ts`, so this is the only open item.
