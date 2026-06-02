---
artifact: phase-5f-competitor-landscape
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec: `specs/24-frontend-phase-5-market-research-design.md` (§6 per-section decomposition, §8 testing, §12 R3/R6).
Plan: `plans/24f-frontend-phase-5f-competitor-landscape.md` (17 commits, 29 files changed, +3,959 −2,670).

The branch decomposes a 2,648-LOC monolithic `CompetitorLandscapeSection` into a container + 11 sub-components + section hook + pure helpers + types + barrel + tests, all under `intelligence/competitor-landscape/`. The structural decomposition (Tasks 1–3, 5–15) and test suite are well-executed. The review's weight is on the two areas where the implementation diverges from the plan's intent: the incomplete read-path migration (Task 4) and residual debug/dead code.

## Findings

### High — Task 4 read-path migration incomplete: localStorage read/write + giant sync effect retained

**Location:** `CompetitorLandscapeSection.tsx:110–202, 207–356`

Plan Task 4 Step 3 explicitly instructs: *"Delete: the `getUserLocalStorage` read fallbacks (L163-186), the localStorage-write effects (L323-339), the big props↔local read-sync effect (L344-525)…"* All three survive:

1. **`getUserLocalStorage` calls** in `useState` initializers (lines 114, 122, 130) — the hook now owns read data; these localStorage reads race with the TanStack cache.
2. **Three `setUserLocalStorage` write effects** (lines 186–202) — writes every scalar-local change to per-user localStorage, a cache the plan said to retire.
3. **The ~150-line sync effect** (lines 207–356) — the exact `justSavedRef`/`savedLocalStateRef`/competitorData-belongs-to-current-user guard the plan said to delete. The `forceUpdate` useReducer (line 183, called at 461, 628, 656) was also to be deleted if it only backed re-renders after now-removed fetch/cache writes; it survives.

The hook IS adopted (line 81: `const cl = useCompetitorLandscape(...)`), and the parent correctly stops forwarding data props. But the old machinery was left in place alongside it, creating two competing read sources (hook + localStorage + props). The `isLoading` gate (line 99) checks `localLoading` which is never set to `true`, and `hasPropData` (line 96) checks the now-empty props — both are dead paths.

**Impact:** Data-display bugs are possible after the hook resolves but before the sync effect runs, or when localStorage holds stale data from a prior session. The 150-line sync effect is the same fragile reconciliation logic the decomposition was meant to eliminate.

**Recommendation:** Complete Task 4 as specified — delete the localStorage read fallbacks, the write effects, the big sync effect, `forceUpdate`, `justSavedRef`/`savedLocalStateRef`, `localError`/`localLoading`/`hasPropData`/`isLoading` — and have the container read exclusively from `cl.data` (falling back to the passed-through edit props for the write path only). This is the plan's central task; leaving it half-done undermines the decomposition's purpose.

### High — Debug rendering artifacts shipped in production JSX

**Location:** `CompetitorLandscapeSection.tsx:838–844`

```tsx
{isRefreshing && (
  <div className="mb-4 p-2 bg-blue-100 border border-blue-300 rounded text-sm">
    🔍 Company Profile: {companyProfile ? "Available" : "Not available"} | Industry:{" "}
    {companyProfile?.industry || "Unknown"} | Company Size:{" "}
    {companyProfile?.companySize || "Unknown"}
  </div>
)}
```

This renders a visible debug panel showing internal state ("🔍 Company Profile: Available | Industry: …") whenever `isRefreshing` is true — i.e., every time the user triggers a data refresh. Lines 826–836 also contain commented-out debug JSX (timestamp/status blocks). These are development artifacts, not the section's display strings the plan's "section-copy note" preserves.

**Recommendation:** Remove lines 826–844 (both the commented-out blocks and the active debug panel).

### Medium — `useCompetitorLandscape` hook's `data` cast bypasses the contract boundary

**Location:** `useCompetitorLandscape.ts:29`, `CompetitorLandscapeSection.tsx:87`

```ts
// hook:
data: query.data?.data as unknown as CompetitorLandscapeView | undefined,
// container:
const competitorData = cl.data as UntypedBackendApiResponse | undefined;
```

The hook double-casts through `unknown` to reach `CompetitorLandscapeView`, then the container immediately casts it to `UntypedBackendApiResponse` to access dynamic fields (`timestamp`, `user_id`, `uiComponents`). This means `CompetitorLandscapeView` in `types.ts` doesn't actually model the fields the container uses — it's a fiction the casts paper over. The `uiComponents` field exists on both types, but `timestamp`/`user_id` do not exist on `CompetitorLandscapeView`.

**Recommendation:** Either (a) add the used dynamic fields to `CompetitorLandscapeView` (making it honest) and drop the cast in the container, or (b) since the plan explicitly says the view-model is intentionally loose ("mirrors 5b's tolerant `.passthrough()`"), just have the hook return `unknown` directly and let the container cast once. The current double-cast obscures the real contract.

### Medium — Empty no-op `useEffect` and dead state variables

**Location:** `CompetitorLandscapeSection.tsx:90–91, 99, 684`

- Line 684: `useEffect(() => {}, [])` — empty effect, no purpose.
- Lines 90–91: `localError` and `localLoading` are declared but `localLoading` is never set to `true` (only `false` at line 690); `localError` is set only to `null` (lines 672, 689). Neither serves a function the hook doesn't already cover.
- Line 99: `isLoading = localLoading && !hasPropData` — `localLoading` is always `false`, so `isLoading` is always `false`, making the loading block (lines 747–762) unreachable.

**Recommendation:** Remove `localError`, `localLoading`, `isLoading`, `hasPropData`, and the empty `useEffect`. Derive loading/error states from `cl.isLoading`/`cl.isError` instead.

### Medium — `MarketIntelligenceSections.tsx` still forwards hollow props instead of removing them

**Location:** `MarketIntelligenceSections.tsx` (diff +8/−12 lines)

The parent now passes `executiveSummary=""`, `topPlayerShare=""`, `emergingPlayers=""`, `fundingNews={[]}` — hollow values that are only used as fallbacks in the sync effect the plan said to delete. These props survive in `CompetitorLandscapeSectionProps` (types.ts). The plan's Task N+1 was to "drop now-unused prop typing" — the data props were removed from `MarketIntelligenceTabProps` (done), but the section's local props interface still declares them and the container still destructures them.

**Recommendation:** Remove `executiveSummary`, `topPlayerShare`, `emergingPlayers`, `fundingNews` from `CompetitorLandscapeSectionProps` and stop passing them from the parent. If the edit-write path still needs to communicate scalar values upstream, the `on*Change` callbacks already do that.

### Medium — Twelve `console.log` calls with emoji prefixes in production code

**Location:** `CompetitorLandscapeSection.tsx:252–272, 454, 503–504, 536, 565, 606, 620, 634, 649`

The save handler and sync effect contain 12 `console.log` calls with emoji prefixes (🛡️, ✅, 📤, 📥) logging truncated state values, timestamps, and API statuses. These are debugging aids that ship to end users.

**Recommendation:** Remove all `console.log` calls from the container. The save handler's error path (line 634) can keep `console.error` for the caught error, but the informational logs should go.

### Low — Sub-component extraction quality is solid; test coverage is good

The 11 sub-components are clean single-responsibility extractions with typed props. The `competitorUiComponents.ts` pure helper module (207 LOC) has 262 LOC of thorough unit tests covering edge cases (null/undefined input, unparseable JSON, missing fields, empty arrays). Sub-component tests (CompetitorFeatureComparison, CompetitorKeyMetrics, CompetitorSwotAnalysis, MarketShareRegionsTable, CompetitorMarketTrends) test behavior (what renders under given props) rather than implementation. The autohydrate test (`CompetitorLandscapeSection.autohydrate.test.tsx`) validates the hook-to-section integration.

### Low — `index.ts` barrel exports only the container (correct per plan)

**Location:** `competitor-landscape/index.ts`

The barrel exports only `CompetitorLandscapeSection` as a named export. This matches the plan ("confirm the barrel exports only the container"). The container is a default export internally; the barrel re-renders it as named. This is consistent with sibling sections.

### Nit — `eslint-disable-next-line react-hooks/exhaustive-deps` appears twice

**Location:** `CompetitorLandscapeSection.tsx:346, 733`

Both suppressions guard effects that intentionally omit local-state dependencies to avoid write-then-read loops. If the sync effects are deleted per the High finding above, these go away with them.

### Nit — MSW handler `user_id` field extracted but `name` variable still computed

**Location:** `frontend/src/test/msw/handlers.ts:61`

The body destructures `user_id` alongside `component_name`. The error-path probe (`body.user_id === "competitor-error-user"`) is cleanly scoped. No issue, just noting the extension is minimal and well-targeted.
