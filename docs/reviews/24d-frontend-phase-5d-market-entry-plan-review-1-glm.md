---
artifact: plans/24d-frontend-phase-5d-market-entry.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 1
---

## Context

Reviewed against spec `specs/24-frontend-phase-5-market-research-design.md` (§2.1, §2.3, §4.2, §4 amendment, §6, §8, §10, §12 R3/R6). The plan is thorough and well-structured — the findings below are refinements, not blockers.

## Findings

### [High] No mid-plan E2E checkpoint after the riskiest task (Task 4)

**Location:** Task 4 (hook adoption + fetch/cache removal) → Task N+2 Step 2 (`journeys/04`).

Task 4 is the heaviest single task — it replaces the section's entire data-access machinery (fetch, 4 `useEffect`s, 7 `useRef`s, localStorage SWOT cache, `marketEntryData`/`isLoading`/`_error` state) with `useMarketEntry`. If this swap breaks behavioral parity, the plan won't discover it until Task N+2 (the final verification), after 7+ extraction commits have been layered on top. A single `npx vitest run` on the section tests is specified, but `journeys/04` is the actual behavioral-parity guard. Adding an explicit `journeys/04` run (or at minimum a targeted Playwright subset) after Task 4's commit would close the feedback loop while the change is still warm. Suggested insertion: Task 4 Step 5, add `npx playwright test e2e/journeys/04-market-research-5-components.spec.ts` between the vitest run and the commit.

### [High] Task 4 Step 2 under-specifies the `displayData` derivation rewrite

**Location:** Task 4, Step 2 ("Route the read seams through `me.data`").

Step 2 says "Replace the `displayData` derivation … with a derivation off `me.data`, preserving the live fallbacks" in a single paragraph. This is the gnarliest rewrite in the plan — the current `displayData` merges `marketEntryData` ⊕ props ⊕ localStorage-SWOT ⊕ edit-state, with conditional fallbacks for `recommendedChannel` (object-vs-string), `swot` vs `swotAnalysis` aliasing, and edit-mode overrides. The paragraph names the key cases but doesn't show the actual derivation code or a decision table for each field's new source. An implementer must reverse-engineer the full derivation from ~1900 LOC of live code. A field-by-field source table (which fields come from `me.data.*`, which from `editSwotAnalysis`, which from props still passing through) would significantly reduce misimplementation risk on the plan's single most error-prone step.

### [Medium] Dual-fetch window: section uses hook while page may still fetch the same data

**Location:** Task 4 ("the parent may still pass the (soon-removed) data prop slice — fine until Task N+1") through Task N+1.

After Task 4, the section reads from `useMarketEntry` (TanStack hook), but the parent (`IntelligenceTab` / `useMarketResearchData`) may still fire its own raw `fetch` for market-entry data and forward it as props (which the section now ignores). This creates a window of redundant network requests (the page fetches market-entry data, the hook also fetches it). Task N+1 stops forwarding the data props, but doesn't explicitly say whether the parent's fetch for this component is also suppressed. The plan is consistent with the §4 amendment's distribution model (5i confirms zero raw fetches), but the dual-fetch window between Task 4 and 5i could confuse a reviewer or cause unnecessary API load during development. Consider noting whether the parent fetch should be conditionally skipped (`enabled: false` or a guard) once the section owns its own data, or explicitly mark this as acceptable temporary redundancy.

### [Medium] Task 3 hook tests are thin — no error or realistic-parsing coverage

**Location:** Task 3, Step 2 (test code, lines 269–301).

The three test cases confirm: (1) load + parse succeeds, (2) disabled without orgId, (3) regenerate trigger exists. Missing: (a) an error-state test (server returns 500 / malformed payload → `isError` is true, `data` is undefined), (b) a realistic-parsing test with a fixture matching the confirmed `data` shape from Task 0 Step 5 (confirming `MarketEntryResultSchema.parse` accepts the real payload), (c) a regeneration-success test. The hook is the sole data source after Task 4 — confidence in its error handling matters. At minimum, add one test with a realistic `market entry & growth strategy` payload fixture (which the plan already needs for the MSW handler) to confirm `parseMarketEntryResult` produces the expected view-model shape.

### [Medium] N+1 / N+2 naming obscures cross-references

**Location:** Tasks "N+1" and "N+2" used throughout, e.g., Task 4 Step 3 note referencing "Task N+2", Task 3 note referencing "Task 4".

The variable `N` depends on how many seams Task 0 confirms (the plan says "(reconcile) Add/drop tasks to match Task 0's confirmed seams"). This means "Task N+2" could be Task 12 or Task 15 depending on the reconciliation. When Task 4's note says "flag it for the reviewer (Task 4 / Task N+2)" the implementer must mentally resolve N each time. Consider adding a concrete task-number mapping table after Task 0 completes, or switching to symbolic anchors (e.g., "§Final-verify" instead of "Task N+2") that don't require arithmetic.

### [Low] `FeatureErrorBoundary` existence not verified in Task 0

**Location:** Task 4 Step 4 references `<FeatureErrorBoundary featureName="Market entry">` from `@/shared/components`, but Task 0's prerequisite checks don't confirm it exists.

The step is marked optional ("Optionally wrap"), and the component was presumably created in Phase 4 scaffolding, but a `test -f` in Task 0 Step 2 alongside the 5b/5c checks would surface a missing import early rather than at Task 4 execution time.

### [Low] Task 2 assumes dead block is a single contiguous `//`-prefixed run

**Location:** Task 2, Step 1 ("Everything strictly above the first live `import` is the dead block (one contiguous `//`-prefixed run)").

The audit command `grep -nvE '^\s*(//|/\*|\*|$)'` finds the first non-comment/non-blank line, but the dead block might contain block-comment delimiters (`/* ... */`) or non-`//` blank lines interspersed. The Step 1 note says "If the audit shows live code interleaved with comments (it should not), STOP and hand-verify" — this is the right escape hatch. However, the deletion method in Step 2 ("Delete from line 1 through the line immediately before the first live `import`") is based on line numbers, not on identifying the actual dead block boundaries. If there's a live code fragment above the first `import` (e.g., a `/* eslint-disable */` directive), it gets deleted too. Low risk since the post-deletion verification catches this, but worth noting.

### [Nit] Inline `import()` type in `parseMarketEntryResult` is unusual

**Location:** Task 3, Step 1, `types.ts` code (line 258):

```ts
response: import("@/features/market-research/contracts").ResearchComponentResponse | undefined,
```

This inline `import()` type syntax avoids adding `contracts.ts` to the module's top-level imports, but it's non-standard in this codebase. A top-level `import type { ResearchComponentResponse } from "…" ` is more conventional and doesn't affect tree-shaking (it's erased at compile time). Minor style preference.
