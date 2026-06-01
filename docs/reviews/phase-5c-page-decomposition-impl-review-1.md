---
artifact: phase-5c-page-decomposition
artifact_type: impl
verdict: findings
reviewer_model: glm-5.1
date: 2026-06-01
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec: `specs/24-frontend-phase-5-market-research-design.md` (round 5, §9 delta 9 — hook-first re-cut). Plan: `plans/24c-frontend-phase-5c-page-decomposition.md` (rewritten after R1 escape-hatch event #2). Both loaded and reviewed against the aggregate diff. Per §9 delta 9 the implementation passed `npm run preflight` (typecheck, lint, format, Vitest, build, bundle-advisory, all 14 e2e journeys incl. `journeys/04`, `knip --strict`).

## Findings

### [Medium] `IntelligenceTab` builds a renamed prop object and casts it `as unknown as MarketIntelligenceTabProps`, defeating type safety

**Location:** `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx:352-652`

The `IntelligenceTabProps` type uses `Pick<MarketResearchData, …>` (170 keys from the hook return), but the component then constructs an `intelligenceProps` object with **different key names** (e.g. `isEditing: isMarketIntelligenceEditing`, `onToggleEdit: handleMarketIntelligenceToggleEdit`, `GrowthRate: marketData?.GrowthRate || marketIntelligenceData.GrowthRate`) and casts it `as unknown as MarketIntelligenceTabProps` at line 652. This completely subverts the type system — any rename on `MarketIntelligenceTabProps` or the hook's return surface compiles fine and fails at runtime. The `Pick<>` gives false confidence; the real contract is untyped at this boundary.

The comment at line 651 acknowledges this ("the inline object literal defeats structural inference, so cast at this one boundary"). This is pre-existing behavior faithfully moved from the old page JSX — the 5c spec explicitly scoped the move as structural-only. The risk is real but contained: 5d–5h will replace `MarketIntelligenceTabProps` with per-section hook consumption, at which point the cast should disappear with the type. Until then, any change to `MarketIntelligenceTabProps` field names requires manual verification at this boundary.

### [Medium] `useMarketResearchData.ts` is 6,039 LOC — at the limit of maintainability for a single hook

**Location:** `frontend/src/features/market-research/hooks/useMarketResearchData.ts`

The data-layer hook carries the verbatim extraction of the page's entire raw-fetch/useState/cascade/cache machinery. 6K LOC in a single hook file means no single agent context window can hold the whole file plus the surrounding code, and any change requires scrolling/searching through an enormous file. This is a known transitional state (5d–5h progressively convert the hook's internals to TanStack, shrinking it section-by-section), and the plan explicitly called for a "pure move" — so the size is expected per spec. But the 5d–5h plans should treat this as a pressure to decompose early: the longer this file stays at 6K, the harder it is to work with.

### [Low] Shell is 1,098 LOC — "thin" is aspirational given the prop-threading and commented-out blocks

**Location:** `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

~265 lines are the hook destructure, ~190 lines are the `<IntelligenceTab>` prop spread (lines 819–1007), and ~140 lines are commented-out JSX (Scout header 435–591, Settings/History/Refresh 673–773). The prop spread is a direct consequence of the props-not-context decision (the right call for 2 shallow consumers), and the commented-out blocks are pre-existing and documented in §9 delta 9 as "left for a future sweep." The 5d–5h section decomposition will progressively shrink the prop surface as each section converts to hook consumption, but until then the shell is not meaningfully "thin" — it's a router + data plumbers.

### [Low] `opportunityFilter` lives in the data-layer hook despite being a UI filter, not data

**Location:** `frontend/src/features/market-research/hooks/useMarketResearchData.ts` (state declaration); consumed at `MarketResearchPage.tsx:263-264` and threaded to `LeadStreamTab` via `MarketResearchPage.tsx:1012`.

Plan Task 4 Step 1 said "LeadStreamTab owns `leadStreamFilters`/`opportunityFilter` internally (analysis-local)." The implementation kept `opportunityFilter` in the hook because `handleViewOpportunityLeads` (intelligence → analysis cross-tab jump) writes it from the shell — so it fails the "not shared across ≥2" hoistability criterion. The spec §9 delta 9 records this as a conscious refinement. The concern is minor: a display filter lives in a file named "data layer" alongside fetch machinery and cascade logic. Not a functional issue, but a cohesion violation that 5d–5h or Phase 7 should clean up.

### [Low] Two large commented-out JSX blocks remain in the shell

**Location:** `frontend/src/features/market-research/pages/MarketResearchPage.tsx:435-591` (Scout header), `673-773` (Settings/History/Refresh buttons)

~140 lines of commented-out JSX are dead weight in the shell. The spec §9 delta 9 explicitly documents this: "the two pre-existing commented-out JSX blocks in the shell (Scout header, Settings/History/Refresh) left for a future sweep (not 5c moved-code residue)." These pre-date 5c and are not a regression, but they clutter the "thin shell" and a future sweep should delete them or extract them to a config/feature flag.

### [Nit] Test coverage is thin for the structural extraction — 3 test files, 8 total test cases

**Location:** `hooks/__tests__/useMarketResearchData.test.tsx` (1 test), `components/intelligence/__tests__/IntelligenceTab.test.tsx` (2 tests), `components/intelligence/__tests__/sanitizeIntelligenceProps.test.ts` (5 tests)

The plan explicitly scoped these as "smoke tests" and "mount smoke tests" — not comprehensive characterization. The plan's reasoning is sound (this is a pure structural move; the existing suite + `journeys/04` guard behavioral parity). The 8 tests exercise: hook shape + non-crash init (1), null-data CTA render + button click (2), sanitizer round-trip behaviors (5). No test exercises the intelligence tab's main render path (with data present), the TrendsTab, or the LeadStreamTab. This is acceptable for a structural-only move guarded by `journeys/04`, but 5d–5h should add per-section tests as they decompose.

### [Nit] `ScoutResearchContext` duplicates `ChatWithScoutResearchContext` from the legacy `ChatWithScout`

**Location:** `frontend/src/features/market-research/types.ts:9-14`

Documented and intentional — the feature avoids importing from a leaving legacy component. Structural typing ensures compatibility without a cast. The duplication is correct per the spec §5 and plan Task 5 Step 1a. Remove when `ChatWithScout` is retired (Phase 7+).

## Adherence summary

**Spec done-when (§5, round 5 + §9 delta 9) — all gates met:**
1. ✅ Page shell is a thin route-wire + tab router; no fetch-result/server `useState` in the shell body.
2. ✅ `useMarketResearchData()` holds the raw-fetch/useState/cache machinery; shell calls it once.
3. ✅ Lead-stream tab extracted to `src/components/market-research/lead-stream/LeadStreamTab.tsx`; imports no feature code; HANDOFF annotation present.
4. ✅ Cross-tab/nav/Strategist coordination injected as shell-owned callback props.
5. ✅ `SafeMarketIntelligenceTab` + `MarketIntelligenceTab` deleted; sanitization preserved as `sanitizeIntelligenceProps` (tested); `<FeatureErrorBoundary>` wraps.
6. ✅ Props-vs-context decision recorded (props — 2 shallow consumers; no `MarketResearchContext` created).
7. ✅ `journeys/04` behavioral parity + `npm run preflight` green (per §9 delta 9).

**Plan tasks — all 7 completed:**
- Task 1 (hook extraction): ✅ `useMarketResearchData.ts` (6,039 LOC, pure move) + smoke test.
- Task 2 (IntelligenceTab): ✅ `IntelligenceTab.tsx` (695 LOC) + mount smoke test.
- Task 3 (Safe→FeatureErrorBoundary): ✅ Sanitizer extracted + tested; both wrappers deleted.
- Task 4 (LeadStreamTab): ✅ Legacy unit with callback props; one-way boundary verified.
- Task 5 (TrendsTab): ✅ Out-of-band block lifted; empty placeholder removed; `ScoutResearchContext` type added.
- Task 6 (thin shell): ✅ Scout pair hoisted as props; dead code dropped; decisions recorded.
- Task 7 (preflight + done-when + deltas): ✅ Spec §9 delta 9 added; TD-FE-20 logged.
