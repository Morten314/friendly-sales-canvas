---
synthesizes_review: docs/reviews/30-frontend-phase-9-scout-profiler-design-spec-review-1.md
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

yes

Reason: Multiple High/Critical findings were confirmed against the code and require substantive spec revision (a new chat-surface render prop, a rescoped §8, a delete→relocate reframe of §9, and a third-file disposition). The revisions open enough new design surface that a round-2 review should validate them. Two of the changes also reverse scope assumptions the operator explicitly chose, so they need operator confirmation before the spec is rewritten.

All findings below were checked against the actual frontend code via a verification pass (importers, render paths, file existence, prior-decision comments). Verdicts cite that verification.

## Agreed Findings

- **[Critical] Cruft targets are not dead (§9, Appendix).** CONFIRMED. `ChatWithScout.tsx` is imported/rendered by `TrendsTab.tsx:6,53` (and referenced in `MarketResearchPage.tsx:287,745`). `ScoutChatPanel.tsx` (681 LOC) is imported by `ScoutChatWithHistory.tsx:14` (rendered :403) and `MarketIntelligenceSections.tsx:9` (rendered ×5 at :236/250/264/278/293). Neither is deletable. **`TD-FE-51` already assigns Phase 9 the task of *relocating* `ScoutChatPanel.tsx` + `types.ts` into `features/market-research` and draining the legacy `components/market-research/` dir — not deleting.** Revision: replace §9 "cruft sweep / deletion" with "drain legacy `components/market-research/` by relocating its live residue into `features/market-research`"; remove the deletion rows from the Appendix; drop the "dead Lovable leftovers" framing. (Scope-affecting — see Open Question 2.)

- **[High] Render-path divergence not in the contract (§4).** CONFIRMED. `ScoutChatWithHistory.tsx:375-403` conditionally **swaps** the main chat surface: `activeSession.context ? <SignalsContextChat/> : <ScoutChatPanel/>`. Profiler only ever renders `SignalsContextChat`. `renderExtras` (append-alongside) cannot express a surface swap. Revision: `ChatWithHistory` owns only the **history shell** (sidebar + session list + persistence + handlers) and accepts a `renderChat(session)` prop supplying the main chat-area renderer; the Scout wrapper passes a `renderChat` that does the `ContextChat`-vs-`ScoutChatPanel` swap, Profiler passes one that always renders `ContextChat`. `renderExtras` remains for modal/section overlays.

- **[High] ICP-merge extraction mischaracterized + contradicts a prior decision (§8).** CONFIRMED. The merge *algorithm* (`mergeProfilerAcceptedIcpDisplay`) is already in `shared/profiler/profilerAcceptedIcpDisplay.ts:180`, exported from the barrel, and already called by `ICPManager.tsx:16,187`. What remains inline (`ICPManager.tsx:179-237`, ~58 LOC) is a **mission-control-local view-model mapper** (snake/camel normalization + dedup-by-id). `ICPManager.tsx:174-178` documents that `ProfilerMergeView` was **intentionally not created** (Plan-25 T21) because it is a container data-transform with no extractable render region. Combined with the refuted cross-feature premise (below), §8's stated benefit does not exist. Revision: rewrite §8 to state the Phase 6 disposition is **already satisfied** (shared merge util consumed by both features) and to explicitly **uphold** the no-extract decision, recording the rationale — rather than extracting the local mapper. (Scope-affecting — see Open Question 1.)

- **[High] `§8`'s "eliminating customers → mission-control read" claim is false.** Finding 9 asked to verify; verification REFUTED the premise: there are **zero** imports from `@/features/mission-control` anywhere under `features/customers/`. Customers reads ICP utilities from `@/shared/profiler` (`icp-intelligence/icpMapping.ts:4`, `services/customers.ts`). Revision: delete the false cross-feature-elimination claim from §8 and §10.

- **[High] `ScoutDeploymentDetails.tsx` omitted (§7, Appendix).** CONFIRMED. The file exists (70 LOC, `components/market-research/ScoutDeploymentDetails.tsx`), is imported/rendered by `IntelligenceTab.tsx:11,631`, and carries `// HANDOFF → scout (Spec 24 §7)`. Its only consumer is in market-research. Revision: add an explicit disposition. Given Approach 1's "no new `feature → feature` imports" rule and its sole consumer being `IntelligenceTab`, relocate it into `features/market-research` (consistent with the legacy-dir drain) rather than `features/scout`; note the `HANDOFF → scout` annotation is superseded by the Approach-1 decision to keep `features/scout` thin. (Tied to Open Question 2.)

- **[High] ~90% duplication overstated (§1, §4).** Agree. Recharacterize as "~70-75% by raw line overlap; ~85-90% on the shared session/sidebar/persistence/handler core," and stop implying the shared component absorbs nearly everything.

- **[Medium] Wrapper size estimates optimistic (§6).** Agree. Given the surface-swap render path and scout-only state (`editHistory`, `suggestionPrefill`, lead-stream handlers), widen the Scout wrapper estimate to ~100-150 LOC; keep Profiler ~20-40 LOC but hedge.

- **[Medium] `editHistory` missing from the interface (§4).** CONFIRMED (`ScoutChatWithHistoryProps:32-37` has `editHistory?: EditRecord[]` + `onTabChange?`; Profiler lacks `editHistory`). Revision: clarify prop ownership — scout-only props (`editHistory`) are held by the Scout wrapper and threaded into its `renderChat`, not added to the shared `ChatWithHistoryProps` core. State this explicitly.

- **[Medium] Sidebar width/styling differences (§4, §6).** CONFIRMED exact: Scout `w-64 sm:w-72 min-w-[14rem] max-w-[min(18rem,42vw)]`; Profiler `w-[28rem] min-w-[24rem] max-w-[90vw]`. Revision: the shared shell accepts a `sidebarClassName` (wrapper-supplied) so each persona keeps its current responsive widths verbatim (behavior preservation).

- **[Low] Render-path is a plan-level blocker (§17).** Agree. Expand §17 into a concrete decision framework: (a) `renderChat` prop (recommended), (b) refactor `ScoutChatPanel` to wrap `ContextChat`, or (c) Approach-2 fallback (base + named wrappers).

## Disagreed Findings

None on substance. Verification CONFIRMED every factual claim the reviewer made (findings 1, 2, 3, 4, 6, 7, 8). Finding 9's underlying assumption (a `customers → mission-control` coupling to partially eliminate) was refuted — but that traces to an error in *my* spec (§8), not a reviewer error; it is handled as an Agreed revision above.

## Deferred Findings

- **[Nit] Appendix `App.tsx` edit row could cite line ranges (finding 13).** Defer to the plan, which enumerates exact lines (`App.tsx:11` import, `:87-94` route block; `app/routes.tsx` `featureRoutes`). Trigger: plan-writing. No spec change.
- **[Nit] `ScoutDeploymentDetails` "Spec 24 §7" annotation (finding 12).** Subsumed by the §7 disposition revision above; no separate action.

## Severity Disagreements

None. Critical for finding 1 is accepted: although §9's own fallback clause would prevent an erroneous deletion, the deliverable is materially mischaracterized (relocation work, per TD-FE-51, is omitted and described as deletion), which would misdirect the plan author.

## Open Questions

1. **ICP scope (§8) collapses to confirm-and-document.** The operator chose "resolve the profiler ICP home too," but verification shows it is largely already resolved (shared merge util consumed by both features; no cross-feature read; remaining inline code is a mission-control-local mapper deliberately left per Plan-25 T21). Does the operator accept rescoping §8 to "verify + document the disposition is satisfied and uphold the no-extract decision" (near-zero code), or do they want the inline view-model mapper extracted anyway (against Plan-25 T21's stated reasoning)?

2. **Legacy-dir drain (§9) is larger than "delete 2 files."** Per TD-FE-51 the real Phase 9 task is relocating `ScoutChatPanel.tsx` (681 LOC) + `types.ts` + `ChatWithScout.tsx` + `ScoutDeploymentDetails.tsx` from `components/market-research/` into `features/market-research`. Confirm this relocation is in Phase 9's scope (TD-FE-51 assigns it here), or defer the legacy-drain to a later cleanup and keep Phase 9 to chat dedup + `features/scout` + the ICP disposition.
