---
synthesizes_review: 25-frontend-phase-6-mission-control-design-spec-review-2.md
artifact: specs/25-frontend-phase-6-mission-control-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-03
round: 2
---

## Round Recommendation

no

Reason: All round-2 findings are Medium-or-below clarity/precision items with obvious resolutions — no High findings, no new design surface. The spec is ready for planning once the agreed clarifications land; no further review round is warranted.

## Agreed Findings

- **[Medium] Finding 1 — stage 2 scope broad.** Add a light §7 note splitting stage 2 into **2a** (scaffold + relocate + error boundary + dead-code sweep, intra-feature) and **2b** (promote the profiler-util cluster + repoint the external `customers/SuggestedICPCards` importer), so the safe intra-feature work has its own revert boundary. Consistent with the stage-1 1a/1b treatment; the detailed task split is the plan's job (see Deferred).
- **[Medium] Finding 2 — §4.1 row 2 conflates two reads.** Split/clarify into the two reads + two hooks: lead-stream status (`GET /leads/stream/status` → `useLeadStreamStatus`) and the data-source list (→ `useDataSources`). The data-source-list path is not yet known from the map, so it is named as a **stage-3 confirm-live** item (one of DataSourcesManager's fetches), matching the precision of the ICP/company-profile rows.
- **[Medium] Finding 3 — §3 omits test dir.** Add `__tests__/` to the §3 tree and a one-line note that it follows the Phase 5 convention. Verified: market-research has `__tests__/` at the feature root and inside `services/`.
- **[Low] Finding 4 — stage 4 temporal ordering.** Clarify §7 stage 4: at stage-4 completion the `customer-profile`/`sources` tabs render the **undecomposed** (relocated) ICPManager and DataSourcesManager; stages 5 and 6 then decompose those into sub-component trees (not a stage-4 dependency on 5/6).
- **[Low] Finding 5 — §2.2 deferral target ambiguous.** Tighten the write-path deferral: the TD-FE entry (allocated at finalize) records the candidate phase; Spec 14 §4 has no dedicated mutation phase (Phase 13 is LOC reduction), so the trigger is whichever of a Phase 7 ICP-write migration or Phase 13 reaches it first.
- **[Low] Finding 6 — VR "should not move" is a claim, not an argument.** Soften §8: decomposition is structural and visually neutral; snapshots should stay **within the 2% threshold**, and minor bounding-box shifts from added wrapper elements are acceptable if visually identical. (Technically correct — DOM nesting can shift boxes; the threshold, not zero-drift, is the guard.)
- **[Nit] Finding 7 — §3 `services/` precedent.** Add "(following the Phase 5 convention)" to the `services/` entry so the decision is self-documenting (pre-empts the round-1 challenge recurring).
- **[Nit] Finding 8 — §7 stage 1 parenthetical.** Minor reword so the `App.tsx`-deep-import note reads as ordering rationale, not an action item.
- **[Nit] Finding 9 — §9 TD-FE ceiling.** Note that the plan author verifies the actual highest TD-FE number at finalize (TD-FE-32 is the spec-writing-time ceiling; sequential execution makes drift unlikely but the check is free).

## Disagreed Findings

- None. All nine findings are valid; the spec converged.

## Deferred Findings

- **Finding 1 (detailed 2a/2b task breakdown) → the plan.** Same disposition as round-1 finding 5 (stage 1): the spec carries the light checkpoint note; the plan enumerates the actual commits/tasks. §7 already frames stages as commit-series. Trigger: `writing-plans` for `plans/25`.

## Severity Disagreements

- **[Medium → Low] Finding 1 — stage 2 split.** Agree the value, and the external-`customers`-touch rationale is real (it modifies a Phase-7 file). But it is checkpoint granularity — the spec already frames stages as commit-series, and this mirrors the round-1 stage-1 split, which was treated as Low. Light spec note + plan-level detail.

## Open Questions

- None. The data-source-list endpoint path (finding 2) is a stage-3 confirm-live item (§4.1/§12), not an open design question.
