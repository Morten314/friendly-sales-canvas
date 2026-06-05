---
synthesizes_review: docs/reviews/30-frontend-phase-9-scout-profiler-design-spec-review-2.md
artifact: specs/30-frontend-phase-9-scout-profiler-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 2
---

## Round Recommendation

yes

Reason: The Critical §9 finding is confirmed against the code (the legacy dir has 11 files / 3,021 LOC, not 4, and two are cross-feature-coupled). §9 needs substantive rework that is gated on an operator scope re-decision (the round-1 "full drain" choice was made on an incorrect 4-file count). After the rescope + the smaller agreed edits, a round-3 review should validate.

All findings checked against the code via a verification pass (directory listing + LOC + `git grep` importers + HANDOFF annotations). Verdicts cite it.

## Agreed Findings

- **[Critical] §9 drain omits 7 of 11 files (§9, §3, Appendix).** CONFIRMED. `components/market-research/` holds 11 files / 3,021 LOC. Beyond the 4 listed: `ScoutSettingsForm.tsx` (137), `ScoutLeadStream.tsx` (65), `lead-stream/{LeadStreamTab.tsx (51), LeadsTable.tsx (773), OpportunityDashboard.tsx (246), leadData.ts (679)}`, `EditDropdownMenu.tsx` (44). The "EMPTIED/removed" claim (§3 line 86, §9 line 170) is infeasible as written. Two files are cross-feature-coupled (below). Revision: rewrite §9 as an explicit per-file disposition over all 11; drop the "emptied" promise; narrow the actual drain to the cleanly-movable scout/chat-adjacent subset and defer the rest as a new TD. Gated on **Open Question 1**.

- **[High] `leadData.ts` cross-boundary consumers (§9, §10).** CONFIRMED. `leadData.ts` (679 LOC) is imported by `src/lib/marketScoresHeatmap.ts`, `src/lib/leadStreamHeatmapSession.ts`, and `features/strategist/{StrategistRecommendations,StrategistLeadStream}.tsx`. Moving it into `features/market-research` would create `strategist → market-research` imports, violating §10. It is annotated `// HANDOFF → customers`. Revision: exclude from the market-research drain; defer the whole lead-stream subsystem (its UI siblings `ScoutLeadStream`/`LeadStreamTab`/`LeadsTable`/`OpportunityDashboard` move only with it, to their real → customers home) as a new TD; if/when relocated, `shared/` is the candidate home for `leadData.ts` given lib+strategist+customers consumers. Part of **Open Question 1**.

- **[Medium] `EditDropdownMenu.tsx` spans customers (§9, §10).** CONFIRMED. 44 LOC, imported by `features/customers/components/icp-intelligence/{SuggestedICPCard,CurrentIcpsTable}.tsx`, annotated `// HANDOFF → customers`. Moving into market-research creates `customers → market-research`. Revision: exclude from the market-research drain; correct home is `shared/` or `features/customers`; defer + TD. Part of **Open Question 1**.

- **[High] `types.ts` destination wrong (§9 line 175, §3 line 73).** CONFIRMED with correction: `EditRecord` has 8 importers — 1 in `scout-chat/`, 6 elsewhere in market-research (`trends/`, `intelligence/market-size`, `intelligence/market-entry`, `intelligence/industry-trends/types`, `intelligence/regulatory-compliance/types`, `MarketIntelligenceSections`), 1 in the legacy `ScoutChatPanel`. Revision: relocate `types.ts` to a market-research feature-level home (e.g. `features/market-research/components/types.ts` or feature-root `types.ts`), not under `scout-chat/`.

- **[Medium] `renderChat` has no ref-forwarding mechanism (§4).** Agree. Revision: add a note to §4/§17 explicitly scoping OUT imperative shell→surface calls (the surface owns its own refs internally, as today); if a future need arises it's a plan-time addition. Low cost, prevents plan-time surprise.

- **[Medium] §13 Stage 3 "no active worktree contends" understates blast radius (§13, §14).** Agree. Revision: reword to distinguish "no *other worktree* touches these paths" (true) from "low-risk" — the drain repoints imports across active market-research surfaces within this worktree, so it carries normal refactor risk.

- **[Low] `TMeta` generic is Scout-only (§4).** Agree. Revision: one-line note that the generic exists for Scout's `leadContext`; Profiler passes `unknown`.

- **[Low] §3 `ChatWithScout.tsx (or trends/)` ambiguous.** Agree. Revision: commit to `features/market-research/components/trends/` (sole consumer is `trends/TrendsTab.tsx`) — assuming ChatWithScout stays in the drain per Open Question 1.

- **[Low] `ScoutDeploymentDetails` HANDOFF comment stale (§7).** Agree. Revision: state the file's `// HANDOFF → scout` comment is rewritten/removed on relocation to reflect its corrected market-research home.

## Disagreed Findings

- **[Medium] "`features/scout/` has only 2 files — marginal value."** Disagree that this warrants change; the reviewer themselves notes "this isn't wrong." The thin folder is the deliberate, honest outcome of the Approach-1 asymmetry decision the operator chose (§1.1): Scout's research surface *is* market-research, so its only distinct surface is ScoutDeployment. A 2-file feature folder is acceptable per the per-phase convention, and the reviewer's own fallback (consolidate later if no Scout code materializes) is cheap. No change beyond what §1.1 already states.

## Deferred Findings

- **[Nit] §14 "both currently at spec/plan stage" is temporally unstable.** Agree it's procedural and will age; the spec header already flags "design intent (frozen record)." Trigger: the plan captures the point-in-time worktree state. Optional minor trim; no substantive change.
- **[Nit] §3 `README.md ← updated` notation.** Acknowledged; it correctly denotes a content edit, not a new file. No action.
- **[Nit] Wrapper LOC estimates are speculative.** No action (reviewer agrees none needed); estimates communicate intended thinness.

## Severity Disagreements

None. The §9 finding is legitimately Critical: the spec makes an infeasible "emptied" promise and omits ~2,000 LOC including two cross-feature-coupled modules, which would misdirect the plan author into Approach-1-violating moves.

## Open Questions

1. **§9 scope must be re-decided — the round-1 "full drain" choice rested on an incorrect 4-file count.** Reality: 11 files / 3,021 LOC, with HANDOFF annotations pointing 5 → scout, 5 → customers, 1 market-research. The customers-annotated **lead-stream subsystem** (`ScoutLeadStream`+`LeadStreamTab`+`LeadsTable`+`OpportunityDashboard`+`leadData.ts` ≈ 1,814 LOC) is entangled with strategist + `src/lib`, and `EditDropdownMenu` is a customers component — none of these belong in `features/market-research`, and they are unrelated to Phase 9's chat dedup. Recommended resolution: **narrow §9** to the chat/scout-adjacent, market-research-only files (`ScoutChatPanel.tsx`, `types.ts`, `ChatWithScout.tsx`, `ScoutDeploymentDetails.tsx`, `ScoutSettingsForm.tsx`), which resolves TD-FE-51 (its named `ScoutChatPanel.tsx`+`types.ts`), and **defer** the lead-stream subsystem + `EditDropdownMenu` to a customers-focused phase via a new TD entry. Operator to confirm the narrowed scope vs a minimal (TD-FE-51 two-files-only) vs a full 11-file disposition (touches customers/strategist/shared/lib — high collision, not recommended for a parallel worktree).
