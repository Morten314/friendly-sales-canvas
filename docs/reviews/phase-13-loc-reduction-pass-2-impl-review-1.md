---
artifact: phase-13-loc-reduction-pass-2
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-06
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Reviewing the **Stage 13a** sub-phase only (tree-wide dedup + dead-code audit). Stage SELECT and decomposition sub-phases (13b+) are not yet on this branch and are out of scope for this review. The scorecard at `docs/audits/2026-06-06-frontend-loc-pass-2.md` was produced by this branch and was cross-checked against the actual diff; no discrepancies found between scorecard claims and code changes.

## Findings

### [Medium] Momentary-red commit violates plan's per-commit greenness invariant

**Location:** `823e535` → `e1d6ea2`, `frontend/src/shared/api/transport.ts`

Commit `823e535` dropped `API_BASE_URL`, `ICP_BACKEND_URL`, *and* `ApiFetchOptions` from `transport.ts`. The first two were confirmed dead, but `ApiFetchOptions` is imported by `src/shared/api/client.ts`. This intermediate commit would have failed `npm run verify` (typecheck would catch the broken import). The plan states: "every commit ends with G clean" and defines the "greenness invariant" as a per-commit contract. The fix arrived in the very next commit (`e1d6ea2`) before any gate ran, and the scorecard documents this transparently (§6 momentary-red note). No real damage, but it's a process gap — the plan's gate G should have caught it between commits. For future removal passes: run `npm run verify` immediately after each `export`-drop commit, before starting the next.

### [Low] IntelligenceSectionHeader carries 7 visual-customization props (4 verbatim Tailwind class strings)

**Location:** `frontend/src/features/market-research/components/intelligence/shared/IntelligenceSectionHeader.tsx:8-26`

The component accepts `icon`, `title`, `scoutContext`, `iconClassName`, `editButtonClassName`, `scoutButtonClassName`, `scoutGradientClassName` — four of which are full Tailwind class strings passed verbatim. This is the correct approach for preserving Tailwind static analysis (classes must appear literally in source), but the prop surface is heavy. An alternative: a `variant: "industry-trends" | "market-size"` prop with an internal class map would centralize the styling, reduce the prop count to 4, and remove the duplicated class strings from both consumers and their test fixtures. The tradeoff is coupling the component to its callers' visual specs. Not a defect — flagging for consideration if a third consumer appears and the prop count grows further.

### [Nit] keyMetricsConfig arrays allocated fresh every render without memoization

**Location:** `frontend/src/features/market-research/components/intelligence/industry-trends/IndustryTrendsSection.tsx:306-347`, `frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx:502-543`

Both consumers construct a `KeyMetricConfig[]` inline in the render body, capturing state values and setters. The array is recreated on every render. Since `KeyMetricsGrid` doesn't `React.memo` and the array props change on every render anyway, memoization would be pointless here. Standard React pattern for non-memoized leaf props. Flagging only because the inline config is 42–45 lines of object literals in the render body — if the metrics list grows, consider extracting to a `useMemo` or a custom hook.

### [Nit] Test fixture factories duplicate production config values

**Location:** `frontend/src/features/market-research/components/intelligence/shared/KeyMetricsGrid.test.tsx:16-103`, `IntelligenceSectionHeader.test.tsx:12-38`

The test files define `industryTrendsMetrics()` / `marketSizeMetrics()` and `industryTrendsConfig` / `marketSizeConfig` that manually mirror the production config objects. If a production config value changes (e.g., a Tailwind class or a label), the corresponding test fixture must be updated in lockstep. Standard practice for component tests, but the duplication is worth noting — there are now 4 copies of each config (2 production consumers + 2 test fixtures).
