---
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: impl
verdict: findings
reviewer_model: claude (subagent)
date: 2026-06-03
round: 1
base_ref: origin/master
spec_loaded: true
plan_loaded: true
---

## Context

- Reviewed the net three-dot diff `origin/master...HEAD` (not commit-by-commit). Gate status taken as given (preflight green on HEAD; vitest 510 passed, e2e 14 passed, knip clean) — not re-run.
- The four known/intended divergences from plan 24h (no `exportMarketSize.ts`/Sources modal; `view` object over `getDisplayX`; cascade-root slice deferred as TD-FE-30; `/api/ask` edit-save deferred as TD-FE-31) were verified as documented, not re-litigated.
- Adherence verified positively (no findings, recorded here so the next reviewer doesn't re-walk them): the umbrella `MarketIntelligenceTabProps.ts` is fully deleted with zero remaining consumers in `frontend/` (grep clean, including the old `components/MarketSizeSection` import path); `MarketIntelligenceSectionsProps` is the old umbrella interface verbatim **minus exactly** the 9 market-size data fields (`executiveSummary`, `tamValue`, `samValue`, `GrowthRate`, `strategicRecommendations`, `marketEntry`, `marketDrivers`, `marketSizeBySegment`, `growthProjections`) — every other field/callback (including `industryTrendsLastEditedField`, the scout-icon union signatures, regulatory/market-entry blocks) carried over unchanged; `sanitizeIntelligenceProps.ts` changed type references only, runtime logic untouched; `useMarketSize` is a thin wrapper over the 5b `useResearchComponent`/`useRegenerateResearch`; sub-component + hook tests are genuinely behavioral (render/empty-degradation/callback-firing; real MSW fetch+parse), not implementation tests; the two regression fixes (MSW `component_name: name` echo, `server.use()` override in the generic round-trip test) preserve the original assertions' strength — the generic test still pins `component_name`/`title`/`summary` round-trip, the override's shape is identical to the pre-5h shared handler. Spec §9 delta 10 and TECH_DEBT TD-FE-30/31 accurately describe the shipped code.

## Findings

### [Low] `view.strategicRecommendations` / `view.marketDrivers` create fresh array identities each render, so the prop-sync effect re-runs every render when `marketSize.data` is undefined

**Location:** `frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx` — `view` object (≈L105–115) and prop-sync `useEffect` dependency array (≈L243–253).

The `view` object coerces nullish arrays with `?? []` (`strategicRecommendations: marketSize.data?.strategicRecommendations ?? []`, same for `marketDrivers`). When `marketSize.data` is `undefined` (or those fields are nullish), `?? []` allocates a **new array literal every render**. Those two `view` fields are then listed in the prop-sync effect's dependency array, so the effect's deps change identity on every render and the effect body executes every render while data is absent. The body is guarded (it only calls `setLocal*` when the JSON-stringified value actually differs) so there is **no infinite loop and no functional bug** — but it is unnecessary per-render work and a subtle footgun for anyone who later adds an unconditional `setState` inside this effect. The primitive `view.*` string deps don't have this problem (only the two array deps do). Cheap fix: depend on `marketSize.data?.strategicRecommendations`/`marketSize.data?.marketDrivers` (stable identity from TanStack cache) instead of the coalesced `view.*` arrays, or memoize `view`. This is net-new 5h code (the `view` object is 5h's invention), so it is in scope.

### [Low] `MarketSizeResultSchema.parse()` throws on a string-typed or non-string-valued `marketSizeBySegment`/`growthProjections`, which the downstream chart helpers are written to tolerate

**Location:** `frontend/src/features/market-research/components/intelligence/market-size/types.ts` — `MarketSizeResultSchema` (`marketSizeBySegment`/`growthProjections: z.record(z.string()).nullish()`) + `parseMarketSizeResult` using `.parse()` (L30); contrasted with `marketSize.ts` `segmentsToPieData`/`projectionsToLineData`, which explicitly branch on `typeof input === "string"` and JSON-parse it.

The chart helpers carry a verbatim-preserved defensive path for the case where the backend delivers `marketSizeBySegment`/`growthProjections` as a **JSON-encoded string** (`if (typeof segmentsToUse === "string") { JSON.parse(...) }`). But `useMarketSize` runs the response through `MarketSizeResultSchema.parse()` **before** any of that, and `z.record(z.string())` will **throw** on a string value (or on a record whose values are numbers rather than strings). Because `parseMarketSizeResult` is called synchronously inside the hook's return, a malformed 5b payload would throw during render and take down the section. The legacy monolith path coerced these with `|| {}` (no throw), so this is a slightly weaker robustness posture for that specific shape.

Severity held at Low (not Medium) because: (a) this `.parse()`-that-throws + `z.record(z.string())` pattern is the **established sibling convention** — `industry-trends/types.ts` (`regionalHotspots: z.record(z.string())`, `.parse()`) and `market-entry/types.ts` (`.parse()`) do exactly the same, so 5h is consistency-preserving, not introducing a novel risk; (b) the section renders under `<FeatureErrorBoundary featureName="Market Intelligence">` (spec delta 9), so a throw degrades to the boundary rather than a white screen; (c) the MSW fixture and the legacy mapper both deliver an object, so the throwing branch is not exercised today. Worth recording so the convention's residual `string`-shape gap is visible; if it ever bites, `.safeParse()` with a `?? undefined` fallback is the surgical fix and should be applied across all sibling hooks, not just this one.

### [Nit] MSW market-size handler match is broad (`lower.includes("market size")`)

**Location:** `frontend/src/test/msw/handlers.ts` — new 5h branch (≈L178): `if (lower === "market size & opportunity" || lower.includes("market size"))`.

The `.includes("market size")` substring clause will also capture any future component whose name merely contains "market size". The exact-match clause already covers the real component, so the substring fallback is speculative breadth that could silently shadow a future component's generic fixture. The generic round-trip test now self-isolates with `server.use()`, so there is no current collision, but tightening to the exact-match (or anchored) check would remove the latent foot-gun.

### [Nit] Verbatim-carried debug logging (`console.log` + emoji) survives into the new container

**Location:** `frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx` — `handleSave` (`console.log("📤 Market Size - original_json:", ...)`, `"📥 GET /ask status:"`, `"✅ Market Size - Local state preserved..."`, ≈L336–396).

These `console.log` statements are parity-preserved from the deleted monolith, so they are not a 5h regression and the phase was explicitly verbatim-move. But the decomposition was the natural moment to drop dev-only console noise from the now-isolated edit-save path (TD-FE-31 already owns the broader rewrite). Leaving them is acceptable; flagging only so it is a conscious carry-forward rather than an oversight.

### [Nit] Dead/unused props retained on `MarketSizeSectionProps`

**Location:** `frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx` — interface fields `isLoading`, `error`, `onRefresh`, `isRefreshing`, `companyProfile` (declared, not destructured) and `hasEdits` (destructured as `_hasEdits`, unused).

The container documents (inline comment) that `isLoading`/`error`/`onRefresh`/`isRefreshing` are intentionally no longer destructured because loading/error/refresh is now hook-driven, "until a later task removes them." That is a defensible deferral (matches the 5d–5g convention of leaving the page slice in place), but it does leave five-plus interface fields that the component neither reads nor needs. Knip is green because they are typed props, not unused imports. No action required this phase; noting so the eventual prop-trim task has a pointer.
