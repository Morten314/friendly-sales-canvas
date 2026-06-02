---
artifact: worktree-phase-5g-industry-trends
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 1
base_ref: master
spec_loaded: false
plan_loaded: true
---

## Context

No spec file was auto-discovered for branch `worktree-phase-5g-industry-trends` (the plan references `specs/24-frontend-phase-5-market-research-design.md` as its source spec, but the slug `phase-5g-industry-trends` did not match the `specs/24*` glob). The spec was loaded manually after auto-discovery failed. Plan loaded: `plans/24g-frontend-phase-5g-industry-trends.md`.

## Findings

### [Medium] Plan deviation: `export default` retained instead of named export

**Location:** `industry-trends/IndustryTrendsSection.tsx:611` and `MarketIntelligenceSections.tsx:4`

Plan Task 1 Step 2 explicitly requires switching from `export default` to a named `export const IndustryTrendsSection` and updating the importer to `import { IndustryTrendsSection } from "./industry-trends/IndustryTrendsSection"`. The implementation retains `export default` and the corresponding default import. This is the only plan task that was explicitly required but not executed. The deviation is cosmetic but means the plan's "done when" gate ("no old path / no `export default` remains") is not met.

### [Medium] Plan deviation: `orgId` sourced from `useAuth()` instead of explicit prop

**Location:** `industry-trends/IndustryTrendsSection.tsx:88-89`

Plan Task 8 Step 3 specifies: "Add `orgId: string` (prefer an explicit prop over `useAuth` for tenant). `userId` is sourced in-container from `useAuth()` (`currentUser?.uid`) to feed `useIndustryTrends(userId, orgId)` — it is identity, not a prop." The implementation instead reads both `userId` and `orgId` from `useAuth()` (line 88: `const { currentUser, orgId } = useAuth()`), with a hardcoded `"brewra"` fallback (line 89). This couples the section to the auth context's orgId resolution rather than receiving it from the parent, which makes the section harder to test in isolation and couples it to the auth provider's orgId semantics.

### [Medium] Unsafe `as TrendSnapshot[]` cast masks potential undefined `type` field

**Location:** `industry-trends/IndustryTrendsSection.tsx:107-111`

```ts
trendSnapshots: (it.data?.trendSnapshots ?? []).map((s) => ({
  title: s.title ?? "",
  metric: s.metric ?? "",
  type: s.type ?? undefined,
})) as TrendSnapshot[],
```

The `TrendSnapshot` interface (from `@/components/market-research/types`) defines `type: "growth" | "performance" | "adoption"` as a required field. When `s.type` is nullish (which is allowed by the Zod schema's `.nullish()`), the code sets it to `undefined` — which does not satisfy the union type. The `as TrendSnapshot[]` cast silences the type error. A downstream consumer that pattern-matches on `snapshot.type` without guarding for `undefined` will fail silently. Fix: provide a default like `s.type ?? "growth"` or make the cast explicit with runtime validation.

### [Low] Per-field change callbacks retained without recording the author's-judgment choice

**Location:** `industry-trends/IndustryTrendsSection.tsx:56-60` (props), `industry-trends/IndustryTrendsSection.tsx:252-266` (usage)

Plan Task 8 Step 3 says to drop the five `onIndustryTrends*Change` callbacks and optionally "surface a single `onCommit(payload)` instead — author's judgment, record the choice." The implementation keeps all five callbacks, which is within the plan's author's-judgment allowance, but does not record the decision. More importantly, these callbacks are still present on `MarketIntelligenceTabProps` (lines 152-156) and threaded through `IntelligenceTab`, meaning the data-prop-surface reduction is incomplete — the parent still drills five field setters to this section, unlike the market-entry section where those were fully removed. This pattern should be consciously chosen and documented, or consolidated in a follow-up.

### [Low] `budgetToChartData` color palette array recreated on every call

**Location:** `industry-trends/industryTrends.ts:64-73`

The 8-element `colors` array is declared inside the function body, so a new array is allocated on every invocation. Since the function is pure and the palette never changes, lift it to module scope (`const BUDGET_COLORS = [...]` at the top of the module). Minor allocation overhead; flagged because this is a pure-helper module explicitly extracted for reuse.

### [Low] VisualCharts read-mode line chart uses synthetic data formula

**Location:** `industry-trends/VisualCharts.tsx:231`

```ts
value: 45 + index * 11, // Dynamic values based on quarters
```

The `MiniLineChart` is fed synthetic numeric values derived from the array index rather than parsing the trend data strings (e.g., `"2023: 45%"`). This was carried from the original monolith for behavioral parity, but it means the chart always shows the same ascending line regardless of actual data. Not a regression, but worth flagging as a latent data-integrity issue that the decomposition could have addressed.

### [Nit] Emoji in console.error

**Location:** `industry-trends/IndustryTrendsSection.tsx:271`

```ts
console.error("❌ Industry Trends - Error saving changes:", error);
```

Carried from the original. The codebase's AGENTS.md style guide is neutral on logging, and the existing codebase has many such instances. Flagged for awareness only.
