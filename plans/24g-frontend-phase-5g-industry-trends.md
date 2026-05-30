# Frontend Phase 5g — IndustryTrendsSection decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the ~1,863-LOC `IndustryTrendsSection.tsx` into single-purpose files under `src/features/market-research/components/intelligence/industry-trends/` — a thin container + one focused sub-component per real seam (the section's seven editable blocks, the read-mode summary/metrics, the expand-gated detail, the header, the export footer) + a section hook `useIndustryTrends.ts` that sources data from the 5b TanStack layer + local types — and replace this section's `MarketIntelligenceTabProps` slice with hook consumption.

**Architecture:** The live file is **one monolithic display/edit component**, not a tabbed dashboard. It renders a header, three read-mode "key metric" cards + an executive summary, and a `Read More`-gated detail region with five blocks (Key Trend Snapshots, Regional Hotspots, Strategic Recommendations, Risks & Watchouts, Visual Charts) plus an export footer; in edit mode (`isIndustryTrendsEditing`) the same blocks render as inline forms with per-block "commit" + per-block "delete" affordances driven by `industryTrendsDeletedSections`. All section data and ~20 edit handlers are **prop-drilled** through `MarketIntelligenceTabProps` (26 industry-trends props), and the file also keeps **local mirror state** (`industryTrendsData`, `edit*` drafts, `isLoading`/`error`) plus its own `fetchIndustryTrendsData` (a dormant raw `fetch` to `market-research` with `component_name: "industry trends report"` — the parent cascade drives loading, this only fires on the empty-state "Generate"/"Retry" buttons). This plan lifts each block into its own file (display + edit variants co-located per block, since they share the block's shape), moves the dormant fetch + mirror state behind `useIndustryTrends` (5b), and reduces the container to compose-only. Data props collapse into the hook; the **edit/save orchestration props stay** (parent owns edit mode, history, save-to-workspace, PDF, scout — those are page concerns, not this section's, and are out of 5g's scope to relocate).

**Tech Stack:** React 18 + TS (strict), `@tanstack/react-query` via the 5b hooks, `zod` contracts (`contracts.ts`), `@/shared/components` (`FeatureErrorBoundary`), `@/components/ui` primitives (`Button`/`Input`/`Label`/`Textarea`/`Tooltip`) + `MiniLineChart`/`MiniPieChart` + `lucide-react`, Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`), knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §6 (and §2.1, §8, §12 R3/R6).

**Prerequisite (hard):** **5c (`plans/24c-frontend-phase-5c-page-decomposition.md`) merged to `master`** — which means 5a (relocate) + 5b (data layer) are merged too. 5g consumes the 5b hooks (`useResearchComponent`/`useRegenerateResearch`, `RESEARCH_COMPONENTS`, `contracts.ts`) and renders inside the `IntelligenceTab`/section surface that 5c produced. Branch off the latest `master`. **R3 escape hatch (Spec 24 §12):** if decomposition reveals coupling beyond this plan (e.g. the parent edit-orchestration props turn out to be load-bearing in ways that resist a clean container), stop, revert this sub-phase, and replan per master §5.7 — 5a–5c stay merged.

**Conventions for every task:** as 24a/24b/24c — npm from `frontend/`; commits from monorepo root; `type(scope):` with scope `fe`; **no `Co-Authored-By`, no `[N/M]`**; per-task `npx tsc --noEmit -p tsconfig.app.json` + `npm run lint` green before commit. Imports use the `@/` alias. **One sub-component per commit; TDD where logic-bearing.** Transitional legacy-dir import exception applies (Spec §1.4 / 4a `features/README.md`): during relocation the section may import not-yet-migrated legacy utils (`@/lib/*`, `@/utils/*`, `@/hooks/use-toast`) — that is permitted and expected.

**Visual guard:** behavioral E2E (`journeys/04`) + Vitest/RTL + `npm run preflight` only. **NO market-research pixel VR; do NOT add `toHaveScreenshot` for market-research** (5a TD-FE).

**Batching note (Spec §1.4):** the two smaller tail sections (5g IndustryTrends + 5h RegulatoryCompliance) MAY be batched into one sub-plan with per-section commits. This document is the **standalone** 5g plan; if the implementer batches, run 24g end-to-end on the branch first, then layer 24h's tasks onto the same branch with their own per-section commits — do not interleave the two sections' commits.

**Abort criteria (whole-branch — halt + report, do not fix-forward):**
1. 5c not merged (the `intelligence/` surface + 5b hooks + MSW handlers are absent).
2. Task 0 baseline preflight RED before any 5g change.
3. The 5b MSW handler does **not** serve `"industry trends report"` (escalate to 5b — do **not** stub an ad-hoc handler here).
4. `tsc --noEmit -p tsconfig.app.json` cannot be made clean after a task, or `journeys/04` reds after the container swap and the cause is unfound after investigation.
Everything else (a block that turns out to share more than expected, a knip flag on a transitional export) has an in-plan resolution and does not abort.

**Revert:** each commit is independently green, so `git revert` of the offending sub-phase commit(s) returns the section to its prior working state.

---

## Task 0: Branch + green baseline + seam audit (read the real file)

**Files:** none (verification only).

- [ ] **Step 1: Branch off the latest `master` (5c merged)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
test -d frontend/src/features/market-research/components/intelligence && echo "OK: 5c merged" || echo "STOP: 5c not merged (abort 1)"
test -f frontend/src/features/market-research/hooks/useMarketResearch.ts && echo "OK: 5b hooks present" || echo "STOP: 5b hooks missing"
git checkout -b phase-5g-industry-trends
```

- [ ] **Step 2: Green baseline** — `cd frontend && npm run preflight` (or the `typecheck && lint && test` subset; Task 9 is the real gate). RED before any change → STOP (abort 2).

- [ ] **Step 3: Confirm the 5b MSW handler serves this section**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n 'industry trends report\|market-research' src/test/msw/handlers.ts
```
Expected: a `POST /api/market-research` handler exists (5b) returning the component envelope; it keys off `component_name` so it serves `"industry trends report"`. If it cannot serve this component, STOP (abort 3 — escalate to 5b, do not stub here).

- [ ] **Step 4: Locate the file post-5c and re-confirm the seams against the live source**

The section was relocated by 5a/5c. Find it and read it before moving anything:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
find src/features/market-research -name 'IndustryTrendsSection.tsx'   # expect under components/intelligence/ (or intelligence/<...>)
P=$(find src/features/market-research -name 'IndustryTrendsSection.tsx' | head -1)
wc -l "$P"
grep -n 'interface \|const handle\|<h3\|MiniLineChart\|MiniPieChart\|normalizedDeletedSections\|fetchIndustryTrendsData\|component_name\|industryTrendsExpanded\|export default' "$P"
```

**Seam inventory — VERIFIED by reading the live file (`IndustryTrendsSection.tsx`, 1,863 LOC). Reconcile against what you find post-5c; drop/add seams as the actual code shows.** (Audit-and-reconcile backstop: the line numbers below are pre-5c anchors — re-find by content, not line.)

*Local type aliases (top of file → lift to `types.ts`):*
- `EditRecord`, `TrendSnapshot` (`{ title; metric; type: "growth"|"performance"|"adoption" }`), `IndustryTrendsRecommendations` (`{ primaryFocus; marketEntry }`), `IndustryTrendsData` (the big composite), `IndustryTrendsSectionProps`. (Spec note: `TrendSnapshot`/`IndustryTrendsRecommendations` are **also** referenced by `MarketIntelligenceTabProps.ts` — see Task 8; export them from `types.ts` and have the interface import from there rather than duplicating.)

*Props consumed — TWO kinds (this distinction is the spine of the plan):*
- **Data props (replace with the hook):** `executiveSummary`, `aiAdoption`, `cloudMigration`, `regulatory`, `trendSnapshots`, `recommendations`, `risks`, `regionalHotspots`, `visualCharts`, `companyProfile` (all optional, prefixed `prop*` internally).
- **Edit/page-orchestration props (KEEP — parent owns these; out of 5g scope):** `isIndustryTrendsEditing`, `isSplitView`, `industryTrendsExpanded`, `industryTrendsHasEdits`, `industryTrendsDeletedSections`, `industryTrendsEditHistory`, `isRefreshing`, and the callbacks `onIndustryTrendsToggleEdit/SaveChanges/CancelEdit/DeleteSection/EditHistoryOpen/ExpandToggle`, `onScoutIconClick`, `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`, and the per-field change callbacks `onIndustryTrends{ExecutiveSummary,AiAdoption,CloudMigration,Regulatory}Change` + `onIndustryTrendSnapshotsChange`.

*Local mirror state (collapse into hook / drafts move with their block):*
- `industryTrendsData` + `isLoading` + `error` (server mirror → hook); `normalizedDeletedSections` (a `useMemo` coercing the prop to a `Set` → lift to a tiny pure helper in `industryTrends.ts`); the seven `edit*` drafts (`editExecutiveSummary`, `editAiAdoption`, `editCloudMigration`, `editRegulatory`, `editTrendSnapshots`, `editRegionalHotspots`, `editStrategicRecommendations`, `editRisks`, `editVisualCharts`) + the five `useEffect`s persisting drafts to user-localStorage + the prop-sync `useEffect`.

*Pure-ish logic (→ `industryTrends.ts`):* `fetchIndustryTrendsData` (dormant raw `fetch`; **replaced** by the hook, not relocated), `handleModify` (seeds drafts from props/mirror), `handleSaveChanges` (builds original/modified JSON, writes localStorage, calls parent), the seven per-block `handleSave*` (toast + parent callback), the `normalize-to-Set` coercion, and the budget-string→chart-data parse (`parseInt(String(v).replace("%",""))` mapping in Visual Charts).

*The seven editable blocks (each currently rendered TWICE — an edit form gated by `!normalizedDeletedSections.has(<id>)` and a read view in the expanded region; extract each as ONE component with a `mode`/`editing` prop so both variants live together):*
1. **ExecutiveSummary** (id `executive-summary`) — read: paragraph; edit: `Textarea`.
2. **KeyMetrics** (id `key-metrics`) — read: 3 metric cards (AI Adoption / Cloud Migration / Regulatory); edit: 3 `Input`s.
3. **TrendSnapshots** (id `trend-snapshots`) — read: 3-up cards (`title`/`metric` + gradient bar); edit: per-snapshot `title`/`metric` `Input`s.
4. **RegionalHotspots** (id `regional-hotspots`) — read: `Object.entries(regionalHotspots)` value/region grid; edit: APAC/Europe/North America `Input`s.
5. **StrategicRecommendations** (id `strategic-recommendations`) — read: Primary Focus / Market Entry cards; edit: 2 `Textarea`s.
6. **RisksWatchouts** (id `risks`) — read: bulleted list; edit: add/remove/edit risk `Input`s.
7. **VisualCharts** (id `visual-charts`) — read: `MiniLineChart` (AI adoption trends) + `MiniPieChart` (budget allocation, via the parse helper); edit: trend-list editor + AI/ML/Cloud/Security budget `Input`s.

*Chrome seams (extract):*
- **SectionHeader** — `Zap` title + `Edit` (calls `handleModify`) + scout `Bot` (gated `!isSplitView`).
- **ExportFooter** — Save PDF / Save to Workspace / Shareable Link (used in BOTH edit-mode and the expanded read region — one component, two call sites).
- **EditToolbar** — the edit-mode Save Changes / Cancel / Edit History / scout row.
- **states** — the three early returns: loading (`Loader2`), error (with Retry), no-data (with Generate Report). These currently call `fetchIndustryTrendsData`; rewire to the hook's `regenerate`/`refetch`.
- **expand gate** — `Read More`/`Show Less` (`industryTrendsExpanded` + `onIndustryTrendsExpandToggle`, suppressed when `isSplitView`). Stays inline in the container (it's pure layout wiring over a kept prop).

*Current exports:* `export default IndustryTrendsSection` only (default). The sole importer is **`MarketIntelligenceSections.tsx`** (`import IndustryTrendsSection from "./IndustryTrendsSection"`) — a 5c-era legacy composer; if 5c replaced it with `IntelligenceTab`, re-find the real importer in Step 4. Keep a **named** export `IndustryTrendsSection` going forward (drop the default) and update the importer in Task 1.

**Done when:** branch created; baseline green; MSW serves `"industry trends report"`; the reconciled seam inventory (data-vs-orchestration prop split + the 7 blocks + chrome) is recorded in the PR description.

---

## Task 1: Relocate into `intelligence/industry-trends/` + rewrite importer

**Files:**
- Move: `…/intelligence/IndustryTrendsSection.tsx` → `…/intelligence/industry-trends/IndustryTrendsSection.tsx`
- Modify: the importer (`MarketIntelligenceSections.tsx` or its 5c successor)

> Spec 24 §6, §2.1. Give the section its own directory before splitting it, and switch the importer to a named import.

- [ ] **Step 1: Create the dir and move the file**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
B=src/features/market-research/components/intelligence
mkdir -p "$B/industry-trends"
git mv "$B/IndustryTrendsSection.tsx" "$B/industry-trends/IndustryTrendsSection.tsx"
```
(If 5c placed the file at a different intelligence path, adjust `$B` from Task 0 Step 4's `find`.)

- [ ] **Step 2: Switch to a named export** — in the moved file, change `export default IndustryTrendsSection` to `export const IndustryTrendsSection: React.FC<IndustryTrendsSectionProps> = (...)` (or keep the `const` and add `export`), removing the default. Update the importer:
```tsx
import { IndustryTrendsSection } from "./industry-trends/IndustryTrendsSection";
```
Do the move + importer rewrite + default→named change **in one commit** so no dangling path or default survives. (Transitional re-export shim is permitted only if a second importer turns up mid-edit; delete it in this same commit.)

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate IndustryTrendsSection into intelligence/industry-trends"
```

**Done when:** file under `intelligence/industry-trends/`; importer uses the named import; no old path / no `export default` remains; `tsc` clean; `journeys/04` still green (Task 9 is the full gate).

---

## Task 2: Lift local types to `types.ts`

**Files:**
- Create: `…/intelligence/industry-trends/types.ts`
- Modify: `IndustryTrendsSection.tsx` (import from the new sibling `./types`)
- **Do NOT modify** `…/components/MarketIntelligenceTabProps.ts` in this task (its legacy `./types` import stays valid — see below)

> Spec 24 §6. Mechanical move, no behavior change — do it before the hook/sub-components so everything imports one shape source.
>
> **Shared-type reality (verified):** these aliases are NOT section-private today — a **legacy** `src/components/market-research/types.ts` already exists and **`MarketIntelligenceTabProps.ts` imports `EditRecord, TrendSnapshot, IndustryTrendsRecommendations` from `./types`** (its line 1). So `IndustryTrendsSection.tsx` declares `EditRecord`/`TrendSnapshot`/`IndustryTrendsRecommendations`/`IndustryTrendsData` **inline** while `MarketIntelligenceTabProps` pulls the first three from legacy `./types`. Do **not** sever that shared dependency in 5g — it belongs to the not-yet-migrated `MarketIntelligenceTabProps` group (gone by 5h + cleanup). The new section-local `types.ts` is for the **section's own** shapes; for the three that are shared with the legacy `./types`, re-export from there rather than forking a competing copy.

- [ ] **Step 1: Create the section's `types.ts`** — move `IndustryTrendsData` (the section-private composite) and the `edit*` draft shapes (e.g. `VisualChartsData`, the regional-hotspots edit triple) out of `IndustryTrendsSection.tsx` and `export` them. For the **shared** trio, re-export from the legacy file so the section and `MarketIntelligenceTabProps` keep one source (no fork):
```ts
// Shared with the legacy MarketIntelligenceTabProps group (do not fork in 5g):
export type { EditRecord, TrendSnapshot, IndustryTrendsRecommendations } from "@/components/market-research/types";

// Section-private shapes lifted out of IndustryTrendsSection.tsx:
export interface IndustryTrendsData { /* executiveSummary, aiAdoption, …, visualCharts */ }
export interface VisualChartsData { /* aiAdoptionTrends: string[]; technologyBudgetAllocation: Record<string,string> */ }
```
(The `@/components/...` import is the transitional legacy-dir exception — permitted; record it. If 5c/5h has already promoted legacy `types.ts`, re-point to wherever it landed.) Where a field is already covered by the 5b Zod contract (`ResearchComponentResponse` in `contracts.ts`), prefer re-deriving over duplicating.

- [ ] **Step 2: Re-point the section** — `IndustryTrendsSection.tsx` imports all its types from `./types`. **Do not modify `MarketIntelligenceTabProps.ts`** here — its `./types` import already resolves to the legacy file and stays valid. Verify no duplicate competing declarations: `grep -rn 'interface IndustryTrendsData\|interface VisualChartsData' src/features/market-research src/components/market-research`.

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract industry-trends local types to types.ts"
```

**Done when:** the section's own shapes live in `types.ts` (with the three shared aliases re-exported from legacy `./types`, not forked); `IndustryTrendsSection.tsx` imports from `./types`; `MarketIntelligenceTabProps.ts` is unchanged and still resolves; no duplicate competing declarations; `tsc` + knip clean.

---

## Task 3: Section hook `useIndustryTrends.ts` (TDD)

**Files:**
- Create: `…/intelligence/industry-trends/useIndustryTrends.ts`
- Test: `…/intelligence/industry-trends/useIndustryTrends.test.ts`

> Spec 24 §6, §2.1. Wrap the 5b data hook with this section's registry key; surface refresh. The container reads `data` (the Zod-validated component payload) and feeds typed slices to blocks. This **replaces** the dormant `fetchIndustryTrendsData` raw fetch.

- [ ] **Step 1: Write the failing test** (RTL `renderHook` + `QueryClientProvider` + the 5b MSW handlers):
```ts
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useIndustryTrends } from "./useIndustryTrends";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("useIndustryTrends", () => {
  it("returns the validated industry-trends payload from the 5b layer", async () => {
    const { result } = renderHook(() => useIndustryTrends("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
  it("exposes a regenerate handle", () => {
    const { result } = renderHook(() => useIndustryTrends("user-1", "org-1"), { wrapper });
    expect(typeof result.current.regenerate.mutate).toBe("function");
  });
});
```

- [ ] **Step 2: Run it red**, then **Step 3: implement the hook:**
```ts
import {
  RESEARCH_COMPONENTS,
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";

/** Section hook: industry-trends data via the 5b TanStack layer (component_name
 *  "industry trends report"), plus a regenerate handle for refresh/empty-state. */
export function useIndustryTrends(userId: string, orgId: string) {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.industryTrends);
  const regenerate = useRegenerateResearch(userId, orgId);
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    regenerate,
  };
}
```
> `useRegenerateResearch` (5b) takes the `componentName` at `.mutate(...)` time per the 5b contract — if the merged 5b signature differs, match it; do not add a second mutation. No raw `fetch`.

- [ ] **Step 4: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/industry-trends/useIndustryTrends.test.ts
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): add useIndustryTrends section hook over 5b data layer"
```

**Done when:** hook test passes against 5b MSW; wraps `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.industryTrends)`; no ad-hoc fetch.

---

## Task 4: Extract pure helpers to `industryTrends.ts` (TDD)

**Files:**
- Create: `…/intelligence/industry-trends/industryTrends.ts`
- Test: `…/intelligence/industry-trends/industryTrends.test.ts`

> Spec 24 §6. Move the file's only non-trivial, render-independent computations out so they are unit-testable and stop being re-created per render.

- [ ] **Step 1: Write the failing test** for:
- `normalizeDeletedSections(input)` — the `useMemo` coercion: `Set`→same, array→`Set`, object→`Set(keys)`, nullish→empty `Set`.
- `budgetToChartData(allocation)` — the Visual-Charts parse: `Object.entries` → `{ name, value: parseInt(String(v).replace("%","")), color }`, dropping `NaN`/`0`, cycling the 8-color palette.
- `buildEditSnapshot(data, props)` — the original/modified payload shaping that `handleSaveChanges` does (so the save side-effect is thin).

- [ ] **Step 2: Run red**, then **Step 3: implement `industryTrends.ts`** (pure functions over the `types.ts` shapes; no React, no `fetch`, no `localStorage`). Keep behavior byte-identical to the inline versions.

- [ ] **Step 4: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/industry-trends/industryTrends.test.ts
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract industry-trends pure helpers (normalizeDeletedSections, budgetToChartData)"
```

**Done when:** helpers unit-tested and green; container/blocks consume them; behavior unchanged.

---

## Task 5: Extract section states + `SectionHeader`

**Files:**
- Create: `…/industry-trends/states.tsx`, `…/industry-trends/SectionHeader.tsx`
- Test: `…/industry-trends/states.test.tsx`, `…/industry-trends/SectionHeader.test.tsx`
- Modify: `IndustryTrendsSection.tsx`

> Spec 24 §6. The three early-return views + the title bar are chrome shared by every render path.

- [ ] **Step 1: `states.tsx`** — `LoadingState` (`Loader2` + copy), `ErrorState` ({ message, onRetry }), `NoDataState` ({ onGenerate }). Prefer reusing `@/shared/components`'s `LoadingState`/`EmptyState` where the visual matches; keep a section-local variant only where the existing markup differs materially. The container wires `onRetry`/`onGenerate` to the hook (`refetch`/`regenerate.mutate("industry trends report")`), not to the deleted raw fetch.

- [ ] **Step 2: `SectionHeader.tsx`** — `Zap` title + `Edit` button (`onModify`) + scout `Bot` (gated by an `showScout` / `!isSplitView` prop, calls `onScoutIconClick`). Props in, callbacks out.

- [ ] **Step 3: Tests** — `states.test.tsx`: each renders its copy; `ErrorState` shows `message` and fires `onRetry`. `SectionHeader.test.tsx`: renders title; `onModify` fires; scout hidden when `showScout={false}`.

- [ ] **Step 4: Wire into the container** (replace the inline early returns + header), green + commit
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/market-research/components/intelligence/industry-trends
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): extract industry-trends states + SectionHeader"
```

**Done when:** states + header render from props; callbacks route to the hook; tests pass; `tsc` clean.

---

## Task 6: Extract `ExportFooter` + `EditToolbar`

**Files:**
- Create: `…/industry-trends/ExportFooter.tsx`, `…/industry-trends/EditToolbar.tsx`
- Test: `…/industry-trends/ExportFooter.test.tsx`, `…/industry-trends/EditToolbar.test.tsx`
- Modify: `IndustryTrendsSection.tsx`

> Spec 24 §6. The export footer appears in **two** call sites (edit mode + expanded read region) — one component kills the duplication. The edit toolbar is the Save/Cancel/History/scout row.

- [ ] **Step 1: `ExportFooter.tsx`** — Save PDF / Save to Workspace / Shareable Link buttons; props `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`. Render-only.

- [ ] **Step 2: `EditToolbar.tsx`** — Save Changes (`onSave`) / Cancel (`onCancel`) / Edit History (`onHistory`, disabled when `historyCount === 0`) / scout `Bot` (`onScout`). Props in, callbacks out.

- [ ] **Step 3: Tests** — footer fires all three callbacks; toolbar fires save/cancel/scout and disables history at `historyCount={0}`.

- [ ] **Step 4: Wire both into the container** (footer used in both places), green + commit
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/features/market-research/components/intelligence/industry-trends
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): extract industry-trends ExportFooter + EditToolbar"
```

**Done when:** footer + toolbar render from props; callbacks fire; duplication removed; tests pass; `tsc` clean.

---

## Task 7: Extract the seven editable blocks (one commit per block, TDD)

**Files (per block):** `…/industry-trends/<Block>.tsx` + `…/industry-trends/<Block>.test.tsx`; modify `IndustryTrendsSection.tsx`.

> Spec 24 §6. **The heart of the decomposition.** Each block today renders TWICE (an edit form + a read view). Extract each as ONE component taking `editing: boolean` (or a `mode` prop) plus its data slice, its draft + draft setter (edit), and its per-block callbacks (`onCommit`, `onDelete`, and field-change handlers). The container passes the `editing` flag, the deleted-section visibility (`normalizeDeletedSections(...).has(<id>)`), and the data/draft. Do these as **separate commits**, in the file's source order. TDD each (they are logic-bearing: conditional read/edit rendering + change emission).

For each block: write the failing RTL test first (read mode renders the slice; edit mode renders inputs and emits the field-change/commit/delete callbacks; the block is omitted when its `deleted` prop is true), run red, implement, green, commit.

- [ ] **7a — `ExecutiveSummary.tsx`** — read: `<p>{summary}</p>`; edit: `Textarea` → `onChange`; `onCommit`/`onDelete`. Commit: `feat(fe): extract ExecutiveSummary block from IndustryTrendsSection`
- [ ] **7b — `KeyMetrics.tsx`** — read: 3 metric cards (AI Adoption / Cloud Migration / Regulatory); edit: 3 `Input`s with the three change callbacks; `onCommit`/`onDelete`. Commit: `feat(fe): extract KeyMetrics block from IndustryTrendsSection`
- [ ] **7c — `TrendSnapshots.tsx`** — read: 3-up cards (`title`/`metric` + gradient bar), empty hint when none; edit: per-snapshot `title`/`metric` `Input`s (immutably updating the draft array). Commit: `feat(fe): extract TrendSnapshots block from IndustryTrendsSection`
- [ ] **7d — `RegionalHotspots.tsx`** — read: `Object.entries(regionalHotspots)` value/region grid (empty hint when none); edit: APAC/Europe/North America `Input`s. Commit: `feat(fe): extract RegionalHotspots block from IndustryTrendsSection`
- [ ] **7e — `StrategicRecommendations.tsx`** — read: Primary Focus / Market Entry cards; edit: 2 `Textarea`s updating the recommendations draft. Commit: `feat(fe): extract StrategicRecommendations block from IndustryTrendsSection`
- [ ] **7f — `RisksWatchouts.tsx`** — read: bulleted list (empty hint when none); edit: add/remove/edit risk `Input`s over the draft array. Commit: `feat(fe): extract RisksWatchouts block from IndustryTrendsSection`
- [ ] **7g — `VisualCharts.tsx`** — read: `MiniLineChart` (AI adoption trends) + `MiniPieChart` (budget via `budgetToChartData` from Task 4), each with its empty/parse-fail hint; edit: trend-list add/remove/edit + AI/ML/Cloud/Security budget `Input`s. Commit: `feat(fe): extract VisualCharts block from IndustryTrendsSection`

Per-block gate before each commit:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json \
  && npx vitest run src/features/market-research/components/intelligence/industry-trends
```

**Done when:** all seven blocks render both modes from props, emit their callbacks, honor the `deleted` flag, and pass co-located tests; container delegates to them; `tsc` clean per commit.

---

## Task 8: Thin the container, wire `FeatureErrorBoundary`, and drop the data-prop slice

**Files:**
- Modify: `IndustryTrendsSection.tsx`; the importer (`MarketIntelligenceSections.tsx`/`IntelligenceTab`); `…/components/MarketIntelligenceTabProps.ts`
- Test: `…/industry-trends/IndustryTrendsSection.test.tsx`

> Spec 24 §6, §2.1, §12 R6. With every block + chrome extracted, the container becomes hook + edit/expand wiring + compose. Then sever this section's **data** prop slice (the edit-orchestration props stay).

- [ ] **Step 1: Reduce the container** to: `useIndustryTrends(userId, orgId)` for data + `refetch`/`regenerate` (`userId = currentUser?.uid` from `useAuth()` — the backend `MarketRequest` requires `user_id`; `orgId` stays the explicit prop per Step 3); keep the seven `edit*` drafts + `handleModify`/`handleSaveChanges`/per-block `handleSave*` (seeded from `data` instead of `prop*`/mirror — the localStorage-draft `useEffect`s may stay as-is or move into a small `useEditDrafts` helper, author's judgment; do not change their behavior); `normalizeDeletedSections` from `industryTrends.ts`; loading/error/no-data via `states.tsx`; then compose `SectionHeader` → (edit ? blocks-in-edit + `EditToolbar` + `ExportFooter` : read summary/metrics + `Read More`-gated [blocks-in-read + `ExportFooter`]). The `Read More`/`Show Less` expand wiring (over the kept `industryTrendsExpanded`/`onIndustryTrendsExpandToggle` props) stays inline. No JSX-building closures, no `fetch`, no data shaping beyond passing hook slices + drafts.

- [ ] **Step 2: Wrap the composed subtree in `<FeatureErrorBoundary>`** from `@/shared/components` (warranted per R6 — seven independent blocks + two charts; one block's render error should not blank the section). If 5c already wraps the section at the `IntelligenceTab` level and a second boundary is redundant, note that and skip — default: a section-level boundary here.

- [ ] **Step 3: Drop the DATA prop slice from `IndustryTrendsSectionProps`** — remove `executiveSummary`, `aiAdoption`, `cloudMigration`, `regulatory`, `trendSnapshots`, `recommendations`, `risks`, `regionalHotspots`, `visualCharts`, `companyProfile`, **and the now-orphaned per-field change callbacks** `onIndustryTrendsExecutiveSummaryChange`, `onIndustryTrendsAiAdoptionChange`, `onIndustryTrendsCloudMigrationChange`, `onIndustryTrendsRegulatoryChange`, `onIndustryTrendSnapshotsChange` (the section now sources data from the hook and commits via its own `handleSave*`; if the parent still needs to mirror committed edits, surface a single `onCommit(payload)` instead of re-drilling five field setters — author's judgment, record the choice). **KEEP** the edit/page-orchestration props the parent owns: `isIndustryTrendsEditing`, `isSplitView`, `industryTrendsExpanded`, `industryTrendsHasEdits`, `industryTrendsDeletedSections`, `industryTrendsEditHistory`, `isRefreshing`, `onIndustryTrendsToggleEdit/SaveChanges/CancelEdit/DeleteSection/EditHistoryOpen/ExpandToggle`, `onScoutIconClick`, `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`. Add `orgId: string` (prefer an explicit prop over `useAuth` for tenant). `userId` is sourced in-container from `useAuth()` (`currentUser?.uid`) to feed `useIndustryTrends(userId, orgId)` — it is identity, not a prop.

- [ ] **Step 4: Update the importer JSX** — in `MarketIntelligenceSections.tsx` (the `<IndustryTrendsSection …/>` block, verified at lines ~138–173), delete the data prop lines: `executiveSummary={props.industryTrendsExecutiveSummary}`, `aiAdoption`, `cloudMigration`, `regulatory`, `trendSnapshots={props.industryTrendSnapshots}` (**note the asymmetric source name `industryTrendSnapshots`**), `recommendations`, `risks`, `regionalHotspots`, `visualCharts={props.industryTrendsVisualCharts}`, `companyProfile`, plus the five `on…Change` lines (158–172). Add `orgId={…}`. Keep the orchestration props (139–157) as-is.

- [ ] **Step 5: Do NOT delete `MarketIntelligenceTabProps.ts`.** Three other files consume it (`MarketIntelligenceSections.tsx`, `MarketIntelligenceTab.tsx`, `SafeMarketIntelligenceTab.tsx`) plus the interface file itself — **verified**. Remove **only** this section's now-unused **data** members from the interface (verified present): `industryTrendsExecutiveSummary`, `industryTrendsAiAdoption`, `industryTrendsCloudMigration`, `industryTrendsRegulatory`, **`industryTrendSnapshots`** (asymmetric — confirm the exact key with `grep -n 'industryTrendSnapshots\|industryTrendsTrendSnapshots' MarketIntelligenceTabProps.ts`), `industryTrendsRecommendations`, `industryTrendsRisks`, `industryTrendsRegionalHotspots`, `industryTrendsVisualCharts`, and their orphaned `on…Change` callbacks (`onIndustryTrendsExecutiveSummaryChange/AiAdoptionChange/CloudMigrationChange/RegulatoryChange`, `onIndustryTrendSnapshotsChange`) — **only if** no other consumer still reads them (grep first). **Leave** the industry-trends edit-orchestration members (`isIndustryTrendsEditing`, `industryTrendsExpanded/HasEdits/DeletedSections/EditHistory/LastEditedField`, the scout-chat members, `on…ToggleEdit/SaveChanges/CancelEdit/DeleteSection/EditHistoryOpen/ExpandToggle/ScoutIconClick/ScoutClose`) and **every other section's** members untouched. **Remaining `MarketIntelligenceTabProps` consumers + slices after 5g** (section order is 5d=market-entry, 5e=regulatory, 5f=competitor-landscape, 5g=industry-trends, 5h=market-size): the three files above + the interface, carrying the industry-trends **orchestration** members and — since 5d–5f already migrated market-entry/regulatory/competitor — **only the `marketSize` section slice**. **Confirm the actual remaining consumers/slices by `grep` at execution time** (this projection assumes 5d–5f merged; do not hard-code it). **5h (the last section, market-size) removes the final slice and deletes `MarketIntelligenceTabProps.ts`; 5i confirms.**

- [ ] **Step 6: Container test** — `IndustryTrendsSection.test.tsx` with 5b MSW + `QueryClientProvider`: renders loading → then the read summary/metrics; clicking `Read More` reveals the detail blocks; `isIndustryTrendsEditing` renders the edit forms + toolbar; the no-data state's `Generate` calls the hook regenerate. (Behavioral only — no `toHaveScreenshot`.)

- [ ] **Step 7: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json \
  && npx vitest run src/features/market-research/components/intelligence/industry-trends && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): thin IndustryTrends container, wire FeatureErrorBoundary, drop data prop slice"
```

**Done when:** container is hook + edit/expand wiring + compose only; `FeatureErrorBoundary` in place (or 5c's noted); section reads its data from `useIndustryTrends` with only `orgId` + edit/orchestration props passed in; the industry-trends **data** members are gone from `MarketIntelligenceTabProps` while the interface and all other slices remain; remaining consumers recorded; container test + knip green; `tsc` clean.

---

## Task 9: Final preflight + done-when + handoff

**Files:** `specs/24-…` (§9 delta) as needed.

- [ ] **Step 1: Full preflight + behavioral parity**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/industry-trends
npx knip --strict --no-progress
npm run preflight
```
Expected: PASS incl. `journeys/04` (the market-research journey renders the industry-trends surface unchanged — read summary/metrics, Read More, edit forms). **If `journeys/04` reds**, investigate the container swap / hook wiring; if the cause is coupling beyond this plan, invoke the R3 escape hatch (revert 5g, replan — master §5.7) rather than fix-forward. **No market-research pixel VR / `toHaveScreenshot` introduced.**

- [ ] **Step 2: Done-when (Spec 24 §6)**
1. `IndustryTrendsSection` is a thin container; each block (`ExecutiveSummary`, `KeyMetrics`, `TrendSnapshots`, `RegionalHotspots`, `StrategicRecommendations`, `RisksWatchouts`, `VisualCharts`) and each chrome piece (`SectionHeader`, `ExportFooter`, `EditToolbar`, `states`) is single-purpose and co-located with a test; pure logic lives in `industryTrends.ts` with unit tests; types in `types.ts`.
2. The section sources data via `useIndustryTrends` (5b hooks); the dormant raw `fetch` is gone; no market-research `fetch` remains in the section.
3. This section's **data** prop slice is removed from `MarketIntelligenceTabProps` (edit-orchestration props + other sections intact); `MarketIntelligenceTabProps.ts` is **not** deleted; remaining consumers recorded.
4. Section-level `<FeatureErrorBoundary>` in place (or 5c's documented).
5. All gates green; no new knip unused exports; `npm run preflight` passes; behavioral coverage only (RTL + `journeys/04`), no MR pixel VR.

- [ ] **Step 3: Spec §9 delta + handoff** — append a §9 note recording the data-vs-orchestration prop split decision (edit/save/history/export props stayed with the parent; only data props moved to the hook) and the remaining `MarketIntelligenceTabProps` consumers. Then `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below) → controller `npm run preflight` → merge `phase-5g-industry-trends` → `master`. **Next: 5h (`24h`, decompose `MarketSizeSection`) — the last section; it removes the final `MarketIntelligenceTabProps` slice and deletes the interface, after which 5i (`24i`) finalizes and confirms the phase complete.** (If batching per the §1.4 note, fold 5h's tasks onto this branch before opening the PR, keeping per-section commits.)

---

## Self-review notes (plan author)

- **Spec coverage:** §6 decomposition into single-purpose files (Tasks 1–8); §2.1 section dir + 5b hook consumption (Tasks 1, 3, 8); §8 Vitest/RTL/MSW (Tasks 3–8); §12 R3 escape hatch (header + Task 9), R6 `FeatureErrorBoundary` (Task 8); §6 "Done when" (Task 9).
- **Grounded in the REAL file, not the brief's assumptions.** I read all 1,863 lines. The live `IndustryTrendsSection` is an **edit/display section** (executive summary, key metrics, trend snapshots, regional hotspots, strategic recommendations, risks, visual charts — each with an edit form + a read view), **not** a tabbed dashboard of trend cards / adoption charts / regional hotspot maps / disruptors / risk matrices / timing recommendations. The brief's example seam list (TrendCard, AdoptionCurveChart, RegionalHotspotMap, DisruptorCard, RiskMatrix, TimingRecommendation, TrendDetailDrawer) does **not** match the code; I substituted the actual seven blocks and recorded the audit-and-reconcile backstop in Task 0.
- **The load-bearing distinction:** props split into **data** (replaced by `useIndustryTrends`) vs **edit/page-orchestration** (kept — the parent owns edit mode, deleted-sections, history, save, PDF/workspace/share, scout, split-view, expand). 5g only severs the data slice; relocating edit orchestration is a page concern out of scope. This is why only the nine `industryTrends*` **data** members leave `MarketIntelligenceTabProps`, not the whole industry-trends group.
- **Each block extracted as one component with both modes** (edit form + read view share the block's shape and id), eliminating the file's pervasive read/edit duplication and the per-render closures.
- **Did NOT delete `MarketIntelligenceTabProps.ts`** — confirmed 4 consumers (`MarketIntelligenceSections`, `MarketIntelligenceTab`, `SafeMarketIntelligenceTab`, the interface file); `TrendSnapshot`/`IndustryTrendsRecommendations` are shared with it, so Task 2 points it at `types.ts`. 5h removes the last slice; cleanup deletes the interface.
- **MSW prereq verified as a gate** (Task 0 Step 3 / abort 3): rely on 5b's `"industry trends report"` handler; do not stub ad hoc.
- **Visual guard:** behavioral E2E + Vitest/RTL + preflight only; explicitly no `toHaveScreenshot`/MR pixel VR.
- **Tree reality:** 5a/5b/5c artifacts are absent in the current working tree (pre-Plan-02 monorepo state); this plan is written to the **locked 5b contract identifiers** (`RESEARCH_COMPONENTS.industryTrends`, `useResearchComponent`, `useRegenerateResearch`, `contracts.ts`, MSW handlers) and the post-5c layout, with a Task 0 `find`-based audit-and-reconcile backstop for the exact relocated path + line drift.
