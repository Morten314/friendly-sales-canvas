---
artifact: phase-5d-market-entry
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch is a worktree (`worktree-phase-5d-market-entry`). 13 commits, 25 files changed (+2,304 / −3,919 LOC — net reduction from deleting the ~1,970-line commented-out dead block). Spec §6 + plan 24d both loaded. The edit-write `/ask` path and its localStorage writes are inherited from the pre-existing component; plan Task 4 explicitly scoped them as out-of-5d ("Leave that fetch exactly as-is"). Findings below cover both inherited and newly-introduced issues.

## Findings

### [Medium] Debug `console.log` statements left in the edit-save handler

**Location:** `frontend/src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx:178-179, 200`

Three `console.log` calls with emoji prefixes (`📤`, `📥`) in `handleMarketEntryFullSaveChanges` log the full original and modified JSON payloads plus the HTTP status. AGENTS.md calls out the repo's ~1,566 console.logs as known debt. The `console.error` on line 219 is defensible for error logging; the `console.log`s are debug-only and should be removed before merge.

### [Medium] Edit-save path sends full JSON payloads as URL query parameters via GET

**Location:** `MarketEntrySection.tsx:186-198`

`handleMarketEntryFullSaveChanges` URL-encodes two JSON objects into `URLSearchParams` and sends them as a GET to `/api/ask`. For substantial payloads this risks hitting browser URL-length limits (~2–8 KB depending on browser), exposes data in server access logs / browser history / referrers, and violates REST semantics (GET for a mutation). Pre-existing behavior, but the decomposition is the right moment to flag it — a future plan should convert this to a POST body. Log a `TD-FE` entry.

### [Medium] `localStorage.setItem` in the edit-save path survives the hook migration

**Location:** `MarketEntrySection.tsx:182-183`

`localStorage.setItem("market-entry_original_json", ...)` and `"market-entry_modified_json"` write the edit payload to localStorage before the GET call. The plan's Task 4 deleted the *read-path* localStorage cache (the `getUserLocalStorage("marketEntryData")` SWOT fallbacks + the `CACHE_DURATION` cache) but these *write-path* localStorage calls ride along with the explicitly-preserved `/ask` fetch. They are logically part of the same legacy pattern and should be tracked — either log a `TD-FE` or remove them now (the values don't appear to be read anywhere else in the codebase).

### [Low] Hardcoded SWOT defaults leak fake data into the edit form

**Location:** `MarketEntrySection.tsx:132-136, 156-161`

When `displayData.swotAnalysis` is absent, `handleModify` and `handleMarketEntryFullSaveChanges` fall back to `["Strong tech platform"]`, `["Limited local presence"]`, `["Growing market"]`, `["Regulatory changes"]`. If the backend genuinely has no SWOT data, the edit form presents these as real data and the save handler sends them as the "original" baseline. Inherited behavior, but the decomposition makes it more visible — an empty-state fallback (`{ strengths: [], … }`) would be safer.

### [Low] Duplicated success/error state-update block in save handler

**Location:** `MarketEntrySection.tsx:207-217` (success branch) and `:222-232` (error branch)

The same nine `on<Field>Change` calls + `onSaveChanges()` appear verbatim in both the `try` success path and the `catch` error path. A single `finally` block or extracted helper would eliminate the 11-line duplication and reduce the risk of them drifting apart.

### [Low] Container size exceeds plan estimate

**Location:** `MarketEntrySection.tsx` (537 LOC)

Plan Task N+2 expected ~150–250 LOC for the container. At 537 LOC it's about 2× the estimate, driven by the retained edit-save logic (`handleMarketEntryFullSaveChanges` ~90 LOC), the `displayData` derivation (~40 LOC), and `handleModify` (~30 LOC). Not a spec violation (the plan's "no hard LOC cap" clause in the spec applies), but worth noting — the edit-write path is the remaining bulk that future 5d+ work should extract into a mutation hook.

### [Low] `UntypedReportSection` used where `string` would suffice

**Location:** `MarketEntryBulletList.tsx:3, 13, 52, 61` and `MarketEntrySection.tsx:405`

`MarketEntryBulletList` types its `items` as `UntypedReportSection[]` but the actual values are always strings. The container at line 405 also types the `.split("\n")` paragraph iterator as `UntypedReportSection`. Inherited from the original code, but the decomposition was an opportunity to tighten this to `string`. Not blocking, but it propagates an escape-hatch type into a focused sub-component that could be fully typed.

### [Low] `recommendedChannel` unsafe cast in KpiCards

**Location:** `MarketEntryKpiCards.tsx:30`

`(recommendedChannel.channel as string)` forces a cast from `unknown` (the zod schema is `z.record(z.unknown())`). If `.channel` is not actually a string (e.g., a nested object), the render silently outputs `[object Object]`. A `String(recommendedChannel.channel)` or a narrower zod schema for the channel field would be safer. Inherited behavior.

### [Nit] `_editHistory` prop received but unused

**Location:** `MarketEntrySection.tsx:61`

`editHistory: _editHistory` is destructured with the underscore convention but never read. The prop still flows through `MarketIntelligenceSections.tsx:294` from the parent. Either the section should consume it (e.g., to pass to the edit form's history button) or the prop and its forwarding should be removed in a follow-up cleanup.

### [Nit] `key={index}` in SWOT editor mapped items

**Location:** `MarketEntrySwotEditor.tsx:44, 93, 142, 191` (all four quadrant `.map` calls)

Index-based keys work correctly for append-only lists but can cause subtle state bugs when items are removed from the middle. Since the editor supports per-item removal, a unique key (e.g., an id or the item text) would be more robust. Low practical impact given the small list sizes.

### [Nit] `MarketEntryTimeline` is a fully static placeholder

**Location:** `MarketEntryTimeline.tsx:1-18`

Hardcoded "Q1/Q2/Q3 2025" text with no props. Plan Task 9 correctly identified this and says "do not invent data wiring" — extraction is faithful to the original. Flagged only for awareness; a future phase should either wire it to real data or remove it.

### [Nit] No `<FeatureErrorBoundary>` wrapping

**Location:** `MarketEntrySection.tsx` (absent)

Plan Task 4 Step 5 called this optional. The section now owns a data fetch via `useMarketEntry`, so a crash in market-entry would propagate to the entire intelligence tab. Consider adding it before merge or logging a `TD-FE` for the follow-up.
