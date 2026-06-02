---
synthesizes_review: docs/reviews/phase-5e-regulatory-compliance-impl-review-1.md
artifact: phase-5e-regulatory-compliance
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

## Round Recommendation

no

Reason: Every finding is verified pre-existing (byte-identical against `master`), a deliberate audit-driven decision, or technically incorrect — none are introduced by the 5e decomposition, so another review round on this artifact surfaces nothing new; the real pre-existing items belong in a pre-launch data-fidelity pass tracked as TD.

## Agreed Findings

No in-branch code changes are agreed. Plan 24e's mandate is a **byte-identical** structural decomposition (visual/behavior parity guarded by behavioral E2E + Vitest, not pixel VR; behavior changes are explicitly disallowed mid-extraction, abort criterion 3). Every substantively-valid finding is a pre-existing condition faithfully carried forward — agreed as real but actioned via deferral + TD, not an in-5e fix (see Deferred). The reviewer's own framing concurs ("reasonable scope call", "pre-existing bug carried forward", "correct as-is", "Not a bug per the plan") on the items that hold up.

## Disagreed Findings

- **[Medium] #5 — `KeyRegulatoryUpdatesSection` `hoveredCard` causes "unnecessary re-renders in edit mode":** Incorrect. The `onMouseEnter={() => setHoveredCard(...)}` / `onMouseLeave` handlers exist only in the non-editing render path (the read-only card grid); the editing path never attaches them, so `hoveredCard` stays `null` and never re-renders in edit mode. The reviewer self-corrected the `Dispatch<SetStateAction>` import sub-point (it IS used, for `setLocalKeyDataValues`). No action.
- **[Medium] #6 — Dropping `isLoading`/`isRefreshing` is a "UX regression vs. the original":** Incorrect premise. The original's `_isLoading` is underscore-prefixed **write-only** state (verified `master:…/RegulatoryComplianceSection.tsx:132`) — it was never read, and no loading spinner ever rendered from it; the only "Loading…" strings were error-fallback values set into the five editable fields inside the deleted fetch. So there is **no loading UI to regress**. Wiring the hook's `isLoading` into a real indicator would be a *new feature* (YAGNI for a decomposition), not a regression fix. No action; enhancement opportunity noted.
- **[Medium] #7 / [Nit] #13 — `ComplianceVisualCard`/`ComplianceAnalyticsSection` "works by accident" / `isExpanded` is "misleading":** The expanded path being read-only and the editable path living under `isExpanded={false}` is the original monolith's structure, lifted byte-identically and verified correct in both container branches (editing → `isEditing=true, isExpanded=false`; normal-expanded → `isEditing=false, isExpanded=true`). It works by design, not by accident. The flag double-serving as a render-mode selector is a naming clarity nit, not a defect; renaming would be a behavior-equivalent refactor out of scope. No action.
- **[Low] #9 — `RegulatoryHeader` drops the plan's `isEditing` prop:** Deliberate and correct. The Task 0 seam audit showed the header JSX does not reference `isEditing` (the Edit button is always visible); the plan's interface was a pre-read guess and the plan's own rule is "the audit wins." Adding `isEditing` would be an unused prop (lint `--max-warnings 0` would flag it). No action.
- **[Low] #10 — `useRegulatoryCompliance` double cast `as unknown as`:** Required, not optional. `query.data?.data` is `Record<string, unknown>` (from `ResearchComponentSchema`), which TS will not direct-cast to the `Untyped*` escape-hatch type; the single cast the plan sketched does not compile (confirmed during Task 3). The reviewer acknowledges this. The "asserted not validated" shape gap is the established escape-hatch pattern (TD-FE-9/10 territory), not a 5e issue. No action.
- **[Low] #12 — `RegulatoryFooter` `isSplitView` "name suggests broader usage":** It is used correctly (gates the "Show Less" button, byte-identical to the original). A prop being used in exactly one place is not a defect. No action.
- **[Medium] #8 — Backend repoint "bundled… mixes concerns":** This was an explicit operator decision (asked and answered: "Full repoint, separate commit"). It is isolated in its own commit (`500bbb5`), not interleaved with the decomposition commits, so it is independently revertible; it resolves TD-FE-13 and consolidates to a single `BACKEND_BASE_URL`. Acknowledged as a deliberate, operator-directed scope inclusion — not an accidental concern-mix. No action.
- **[Nit] #15 — `ICP_BACKEND_URL` template-literal alias:** A documented, working workaround for a `knip --strict` duplicate-export false-positive; value-identical to `BACKEND_BASE_URL`. Harmless. (Alternative: a knip config exception — not worth it.) No action.

## Deferred Findings

- **[High→Medium] #1 — Default data (regional rows / visual cards / strategic lists) duplicated across ~5 sites:** Real and a maintenance trap, but **pre-existing** (byte-identical lift) and an explicit Plan 24e Task 2 scope decision (declined `deriveVisualDataCards`/`deriveRegionalData`). Defer. **Trigger:** a `regulatoryDefaults.ts` (or `regulatoryHelpers.ts`) constants-consolidation follow-up, or the 24i market-research phase-close sweep. Recommend a dedicated TD entry.
- **[High→Medium] #2 — Read-only `StrategicRecommendationsSection` reads `regulatoryData`, never `localStrategicRecommendations`:** A genuine state-coherence quirk (post-save the view can revert to API data) **and inconsistent** with `ExecutiveSummarySection` (which falls back through `currentExecutiveSummary = localExecutiveSummary || regulatoryData?.… || prop`). But verified **pre-existing**: `master` read-only Strategic reads `regulatoryData?.strategicRecommendations?.X` (3 sites) and uses `localStrategicRecommendations` only in edit mode. Making read-only fall back to local would be a behavior change, disallowed mid-decomposition. Defer. **Trigger:** pre-launch data-fidelity pass (align the read-only fallback chain with `ExecutiveSummarySection`); log as TD. Related: TD-FE-23 (the section's `visualDataCards`/`chartType` data-fidelity gap).
- **[Medium] #3 — ~14 lines of commented-out `useEffect` in the container:** Real noise, but Plan 24e Task 0 **explicitly directs** "leave them commented, do not revive." Honoring the plan directive over a reviewer preference; not overriding a documented plan decision in synthesis without the operator. Defer. **Trigger:** delete (or reduce to a one-line rationale) in the 24i sweep, when the preservation directive no longer applies.
- **[Medium] #4 — Non-user-scoped `localStorage.setItem("regulatory_*")` writes are dead (read path is user-scoped via `getUserLocalStorage`):** Real dead writes, but **pre-existing** (5 occurrences on `master`); removing them is behavior-neutral but outside 5e's decomposition scope (5e carried the effects forward unchanged). Defer. **Trigger:** a localStorage/caching cleanup or 24i sweep; log as TD.
- **[Low] #11 — Identical-branch ternaries (`cond ? "X" : "X"`) in `StrategicRecommendationsSection`:** No-op dead code, **pre-existing** on `master`, byte-identically lifted. Safe to simplify but deferred to keep the lift record clean. **Trigger:** bundle with the #1/#2 StrategicRecommendations cleanup.
- **[Nit] #14 — `<li>` rendered without a `<ul>` parent + manual `•` bullet:** Pre-existing HTML-semantics nit, byte-identical lift; renders fine. Defer. **Trigger:** an a11y/markup pass on the section. (File citation looks mis-attributed to `KeyRegulatoryUpdatesSection`; the `• {item}` lists live in `StrategicRecommendationsSection`.)

## Severity Disagreements

- **#1 — reviewer [High] → [Medium] (tending Low):** Duplication is real but causes no correctness or runtime issue; it is pre-existing and a deliberate, documented scope call. "High" overstates it for a maintenance-only, deferred item.
- **#2 — reviewer [High] → [Medium]:** A real UX quirk, but pre-existing and not triggered on the happy path (read-only renders API/default data coherently); "High" implies a 5e-introduced break, which it is not.

## Open Questions

- **#2 persistence:** Are strategic-recommendation edits persisted to the parent/API at all? Unlike the five editable strings (which have `on*Change` callbacks), `localStrategicRecommendations` appears to lack a parent-bound change callback, so edits may never round-trip even via `handleRegulatoryComplianceSaveChanges`. Worth confirming when the #2 data-fidelity fix is scheduled — it affects whether the fix is "read local in read-only" or "wire a persist callback."
- **TD logging:** #1, #2, #4 are the materially-worth-recording deferred items (#2 overlaps TD-FE-23's data-fidelity theme). Should these be folded into TD-FE-23 / a new TD entry now, or batched at the 24i phase-close? (Operator's call.)
