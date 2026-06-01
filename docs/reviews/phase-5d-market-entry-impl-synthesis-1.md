---
synthesizes_review: phase-5d-market-entry-impl-review-1.md
artifact: phase-5d-market-entry
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings. The one in-scope defect (debug `console.log`s) plus a Low dedup and a Low type-tighten are trivial in-place fixes needing no re-review; the two substantive Mediums are the `/ask` edit-write path that plan Task 4 explicitly scoped *out* of 5d ("leave as-is") — they convert to tracked TD-FE deferrals, not re-reviewable defects.

## Agreed Findings

- **[Medium] Debug `console.log`s in `handleMarketEntryFullSaveChanges`** (`MarketEntrySection.tsx:178-179, 200`) — Remove the three emoji-prefixed `console.log` calls that dump full original/modified payloads and the HTTP status. Keep `console.error` on line 219 (defensible error logging). Confirmed present; trivial removal.
- **[Low] Duplicated success/error state-update block** (`MarketEntrySection.tsx:207-214` success / `:222-229` catch) — The eight `on<Field>Change` calls + `onSaveChanges()` appear verbatim in both `try` and `catch`. Hoist into a single helper (or a `finally`) so the two paths can't drift apart. Confirmed verbatim duplication.
- **[Low] `UntypedReportSection` where `string` suffices** (`MarketEntryBulletList.tsx:3, 13, 52, 61`; `MarketEntrySection.tsx:405`) — Tighten the new sub-component's `items` to `string[]` and the `.split("\n")` paragraph iterator to `string`. The feeding values (`displayData.*` from the zod result, `String.split`) are already strings, so the tightening is safe and removes a freshly-propagated escape-hatch type from new 5d code.

## Disagreed Findings

- **[Low] `recommendedChannel` unsafe cast "silently outputs `[object Object]`"** (`MarketEntryKpiCards.tsx:30`) — Partial disagreement on the stated failure mode, not the underlying point. The expression is `(recommendedChannel.channel as string) || JSON.stringify(recommendedChannel)`: when `.channel` is absent/falsy the `JSON.stringify` fallback fires (no `[object Object]`); when `.channel` is itself an object it is truthy, so React would *throw* "Objects are not valid as a React child" rather than silently render `[object Object]`. The cast is genuinely unsafe, but the backend prompt (`research_market_5.md.j2`) emits `recommendedChannel` as a string and the live code only ever saw `.channel` as a string — practical risk is near-zero. Faithful preservation of original behavior; see Deferred.

## Deferred Findings

- **[Medium] GET `/api/ask` sends JSON payloads as URL query params** (`MarketEntrySection.tsx:186-198`) — Defer. Plan Task 4 explicitly scoped the `/ask` edit-write path out of 5d ("leave that fetch exactly as-is"); 5d converted the *read* path only. Log **TD-FE** (URL-length/log-exposure/REST-semantics; convert to POST body). Trigger: the future market-entry edit-write mutation-hook phase.
- **[Medium] `localStorage.setItem` in the edit-save path** (`MarketEntrySection.tsx:182-183`) — Defer into the *same* TD-FE entry as the `/ask` finding; the write-path `localStorage` calls are part of the same legacy `/ask` pattern Task 4 preserved. (Values aren't read elsewhere, so removal is safe whenever the `/ask` conversion happens.) Trigger: same edit-write mutation phase.
- **[Low] Hardcoded SWOT defaults leak fake data into the edit form** (`MarketEntrySection.tsx:132-136, 156-161`) — Defer. Inherited; an empty-state fallback (`{ strengths: [], … }`) is safer and should fold into the same edit-write TD-FE. Trigger: edit-write mutation phase.
- **[Low] Container 537 LOC exceeds the ~150–250 plan estimate** (`MarketEntrySection.tsx`) — Defer; not a spec violation (spec §6 sets no hard LOC cap). The excess bulk *is* the retained `/ask` edit-write logic; it shrinks automatically once the edit-write path is extracted to a mutation hook. Trigger: resolved by the `/ask` TD-FE work.
- **[Low] `recommendedChannel` unsafe cast** (`MarketEntryKpiCards.tsx:30`) — Defer (see Disagreed for the failure-mode correction). Optional one-line hardening: wrap in `String(...)`. Inherited; near-zero practical risk given the confirmed string shape.
- **[Nit] `_editHistory` prop received but unused** (`MarketEntrySection.tsx:61`) — Defer. The underscore is a deliberate received-but-unused marker; removing the prop + its forwarding (`MarketIntelligenceSections.tsx:294`) is cross-file cleanup better batched with a later sweep.
- **[Nit] `key={index}` in SWOT editor maps** (`MarketEntrySwotEditor.tsx:44, 93, 142, 191`) — Defer. Faithful to the original; small lists; low practical impact. Candidate for a later sweep.
- **[Nit] `MarketEntryTimeline` is a static placeholder** (`MarketEntryTimeline.tsx:1-18`) — Defer. Plan Task 9 explicitly mandated faithful extraction with no invented data wiring; the extraction is correct. Trigger: a future phase wires real `timeline` data or removes it.
- **[Nit] No `<FeatureErrorBoundary>` wrapping** (`MarketEntrySection.tsx`) — Defer. Plan Task 4 Step 5 marked it optional and a page-level boundary already exists (spec §2). The section now owns a fetch via `useMarketEntry`, so log a **TD-FE** noting the propagation risk; cheap to add later if a market-entry crash proves disruptive.

## Severity Disagreements

(none — agree with the reviewer's severity ratings; the only substance disagreement is the `[object Object]` failure-mode in `MarketEntryKpiCards.tsx:30`, captured under Disagreed)

## Open Questions

- TD-FE consolidation: fold the `/ask` GET-with-query-params, the write-path `localStorage`, the SWOT fake-default, and the container-LOC items into **one** TD-FE entry ("market-entry edit-write path migration to a mutation hook"), with the missing `FeatureErrorBoundary` as a second, smaller entry — or split them? Append surgically to `docs/TECH_DEBT.md` (no prettier reformat per repo convention).
- The plan-sanctioned deferral of the two Medium findings is the one place the controller could legitimately override this `no` recommendation and pull the `/ask` mutation-hook conversion forward into 5d rather than a later phase.
