# Frontend Phase 5f — Decompose `CompetitorLandscapeSection` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `CompetitorLandscapeSection.tsx` (**2,648 LOC**, one `React.FC`) into a thin container + single-purpose presentational sub-components (one file each) + a section-data hook `useCompetitorLandscape.ts` (consuming the 5b data layer) + local types + a tested `competitorUiComponents.ts` helper module, all under `frontend/src/features/market-research/components/intelligence/competitor-landscape/`. Swap this section's slice of the prop-drilled `MarketIntelligenceTabProps` surface for hook consumption, **delete its in-component `fetch` + per-user `localStorage` cache machinery** (5b's data-layer migration did not reach this section — see Architecture), wrap the section in `<FeatureErrorBoundary>` if warranted, and preserve behavior + visuals (no pixel VR). This is sub-phase **5f** of Spec 24.

**Architecture:** The live section is an **inline-editable, single-layer** component (`const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps>` at L84, `export default` at L2648) — NOT chart-driven (it uses **zero recharts**; the only chart is `MiniLineChart` from `@/components/ui` for market-trends sparklines). It takes a `MarketIntelligenceTabProps`-shaped slice (view flags `isEditing/isSplitView/isExpanded/hasEdits`, `deletedSections`, `editHistory`; data `executiveSummary`/`topPlayerShare`/`emergingPlayers`/`fundingNews` + a `competitorData` blob whose `uiComponents` array is parsed into ten local-state slices; ~17 `on*` callbacks; `isRefreshing`/`companyProfile`/`error`). It holds **16 `useState` + 1 `useReducer` (`forceUpdate`) + 15 `useEffect` + 4 `useRef`**, parses `competitorData.uiComponents` via `normalizeUiComponents` into `localDataPoints/localCompetitors/localRegions/localEntities(SWOT)/localHeadlines/localFeatures/localTools/localInsights/localCharts/localMetrics`, mirrors props↔local↔per-user-localStorage with a justSaved/savedLocalState guard, and renders inline-editable blocks (each gated on `isEditing` with a per-block save handler). **Critically, it is NOT purely presentational: it does its own data access** — a raw `fetch("/api/ask?…")` edit-save (L697) + a `fetch("/api/market_intelligence")` re-read (L727), and `getUserLocalStorage/setUserLocalStorage` (`@/utils/cacheUtils`) per-user caching (L163/171/179, L323-339, L676-685). **5b rewired the page, not this section**, so 5f both decomposes **and** completes the 5b migration for this section's *read* path: `useCompetitorLandscape(userId, orgId)` → `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.competitor)` (5b, memory-only) replaces the props-as-data + localStorage-read fallbacks and the read-orchestration effects/refs. **The edit-write path** (`handleCompetitorLandscapeSaveChanges` → `/ask` `fetch`) is the **write** side — kept on its current behavior this phase (flagged for review), not silently dropped. Decomposition mirrors 5d (MarketEntry) / 5e (RegulatoryCompliance): lift each inline block into a controlled sub-component, lift the `uiComponents` parsing + the `generateTrendData` sparkline helper into a tested `competitorUiComponents.ts`, introduce the hook, drop the prop slice. Edit/local state stays in the container; sub-components are controlled + presentational; each extraction is its own green, revertible commit.

**Tech Stack:** React 18 + Vite + TS (strict), `@/` → `src/`, `@tanstack/react-query` (5b hooks), `zod` (5b contracts), shared `@/shared/api/*`, `<FeatureErrorBoundary>` from `@/shared/components`, ESLint flat-config (`eslint-plugin-import-x` + 4a resolver + zone/no-cycle + transitional legacy-import exception), Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`), Playwright (behavioral `journeys/04` — **no MR pixel VR**), knip `--strict`. GNU `sed`/`grep` (linux).

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §6 (per-section decomposition + "Done when (each)"), with §2.1 (target tree), §2.2 (dependency rules), §2.3, §5 (5c page-decomposition context), §8 (testing), §12 R3/R6.

**Locked data-layer contract (from 5b / `24b` — use these EXACT identifiers; do not redefine):**
- Hooks: `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.competitor)` and `useRegenerateResearch(userId, orgId)` from `@/features/market-research/hooks/useMarketResearch` (`userId = currentUser?.uid` from `useAuth()`).
- `RESEARCH_COMPONENTS.competitor` resolves to component_name **`"competitor landscape"`** (confirmed live: `MarketResearch.tsx` L3736 `component_name: "competitor landscape"`); helpers in `@/features/market-research/services/marketResearch`.
- Schema `ResearchComponentSchema` / type `ResearchComponentResponse` (`{ status, data }`) in `@/features/market-research/contracts` (per-component `data` is a tolerant `.passthrough()` blob — no `CompetitorLandscapeSchema`; the section view-model stays local).
- Company profile (if still needed) reuses Phase 3's `useCompanyProfile` — do **not** add a new profile hook.

**Prerequisite (hard):** **5c (`plans/24c-frontend-phase-5c-page-decomposition.md`) merged to `master`.** 5f operates on the section as rendered by the 5c-created intelligence tab (the page is a thin shell + tab router; sections read 5b hooks). Post-5a the section lives under `features/market-research/components/` (5a `git mv`); Task 0 confirms the exact path. 5b (data layer) is a transitive prerequisite, merged before 5c. Branch off the latest `master`. This plan re-identifies seams **by reading the moved file**, not by the line numbers below (a pre-5a anchor from the live `src/components/market-research/CompetitorLandscapeSection.tsx`).

**Conventions for every task:** as 24a–24e. File ops (`mkdir`, `git mv`, `sed`, `grep`, `npm`, `eslint --fix`) run from `frontend/`; `git add`/`git commit` from the monorepo root `/projects/Brewra/brewra-gtm-intelligence`. There is no root-level `package.json`. After each rewrite/extraction run `npx eslint --fix src` (settles `import-x/order`), then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` must be green before committing; run `npx vitest run <files>` for touched tests and `npx knip --strict --no-progress` where reachability changed. Commit messages: `type(scope):` form, scope `fe`; **no `Co-Authored-By` footer**; **no `[N/M]`**. **One commit per extracted sub-component** (file + its test). **Visual-parity guard for all of Phase 5 is behavioral E2E `journeys/04` + Vitest/RTL + `npm run preflight` — NO market-research pixel VR; do NOT add `toHaveScreenshot` for market-research** (5a TD-FE; spec §8/§12 R4). Transitional import exception applies: `features/market-research` may import legacy dirs (`@/components/*`, `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`) plus `@/components/ui/*`, `@/shared/*`, npm. **Section copy:** keep this section's hard-coded display strings inline verbatim — do **not** migrate them to `sectionCopy.ts` (see the *Section-copy note* below for the full rationale + the 5c-migrated fallback).

**Decomposition template (applies to every sub-component task).** Each extraction follows the same TDD loop:
1. **Red:** write the sub-component test (RTL render from fixture props) — or a unit test for a pure helper — and run it red.
2. **Green:** lift the inline JSX + any local logic into the new file under `…/competitor-landscape/`; wire it into the container with typed props from `./types`.
3. **Refactor:** delete the now-dead inlined code from the container; keep imports tidy.
4. **Gate:** `npx eslint --fix src`; `npm run lint`; `npx tsc --noEmit -p tsconfig.app.json`; `npx vitest run <the new test>`; `npx knip --strict --no-progress` where exports changed.
5. **Commit:** one commit, `refactor(fe): extract <Name> from CompetitorLandscapeSection`.
Each sub-component **receives typed props** (from `types.ts`); it does **not** call the hook or fetch. Edit/local state lives in the container and is passed down as value + callback pairs, so every block is controlled and unit-testable in isolation. **Preserve markup byte-for-byte** when lifting (do not "fix" classNames or the `>= 1` chart-visibility quirks) — visual parity is mandatory.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend pushed commits, or revert without sign-off):** per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
1. **5c is not actually merged** (Task 0 fails its check) — the `intelligence/` section pattern is absent.
2. The Task 0 baseline **full** preflight is RED **before any 5f change**.
3. The seam audit (Task 0) contradicts this plan's sub-component list in a way that changes the **number** of blocks or reveals a seam this plan didn't anticipate — the audit wins; update the task list, record the delta in the PR, continue **only if** mechanical. If it implies a behavior change not covered by a test, STOP.
4. `useResearchComponent`'s `data` cannot supply a field the section renders (the parsed competitor shape — `uiComponents` and the four scalar fields — is unavailable through the 5b hook), so the read path can't be migrated without re-inferring a contract — escalate to revisit 5b (do NOT re-introduce a permanent prop or a raw research `fetch`). See Task 4's reconcile step.
5. Replacing the in-component read fetch/cache (Task 4) reveals cross-section coupling the 5b/5c page-rewire depends on (e.g. the parent expects this section to hydrate shared props via `on*Change`) that cannot be cleanly cut — that is a 5b/5c boundary question (revert Task 4 and replan), not 5f's to force.
6. Behavioral `journeys/04` cannot be made green after the swap and the cause is unfound after investigation (final task).
7. `MarketIntelligenceTabProps.ts` is already deleted — ordering is wrong (its last consumer ≤5h deletes it; 5i confirms).

A half-decomposed tree is recoverable from the last green commit; a force-pushed/amended history is not.

---

## Task 0: Branch + green baseline + seam audit (read the real file)

**Files:** none (verification + audit only).

> This confirms the **seam list + the in-component data machinery** that drive Tasks 2–N. The structure below was read from the live file at plan-authoring time (2026-05-30, pre-5a/5b/5c) and is concrete — **re-confirm against the merged tree** (5b/5c may have rewired or partially removed the in-component read machinery; line numbers shift after relocation). Two findings to verify first: (1) the section uses **no recharts** and has **no tabs/CSV export** — it is an inline-editable block layout; (2) the live code **still fetches + caches on its own** (5b rewired the page, not this section) — Task 4 replaces the *read* path with the hook.

- [ ] **Step 1: Branch off the latest `master` (5e merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
git log --oneline master | grep -iE 'phase-5c|24c' | head -1 && echo "OK: 5c merged" || echo "STOP: 5c not merged (abort 1)"
test -d frontend/src/features/market-research/components/intelligence && echo "OK: intelligence dir (5c)" || echo "STOP: no intelligence dir (abort 1)"
git checkout -b phase-5f-competitor-landscape
```

- [ ] **Step 2: Confirm the relocated section file + the 5b data layer landed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
F=$(find src/features/market-research -name 'CompetitorLandscapeSection.tsx'); echo "section: $F"
test -n "$F" && echo "OK: section relocated (5a)" || echo "STOP: section not under features/ (5a not merged)"
test -f src/features/market-research/hooks/useMarketResearch.ts && echo "OK: 5b hooks"
test -f src/features/market-research/services/marketResearch.ts && echo "OK: 5b services"
test -f src/features/market-research/contracts.ts && echo "OK: 5b contracts"
grep -q 'competitor' src/features/market-research/services/marketResearch.ts && echo "OK: RESEARCH_COMPONENTS.competitor present"
grep -q 'market-research' src/test/msw/handlers.ts && echo "OK: MSW handlers (5b)"
ls -d src/features/market-research/components/intelligence/{market-entry,regulatory-compliance} 2>/dev/null | head -1 && echo "OK: a sibling decomposed section exists (the 5d/5e per-section pattern 5f mirrors)" || echo "WARN: no sibling section dir — the pattern 5f mirrors may not have landed (5d/5e unmerged); derive the hook/unwrap shape from contracts.ts instead of a sibling"
```
Expected: all OK. Likely target `src/features/market-research/components/intelligence/CompetitorLandscapeSection.tsx` (5a moves to `components/`, 5c may move it under `intelligence/`); use whatever `find` reports. Any STOP → abort 1.

- [ ] **Step 3: Green preflight baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight   # FULL preflight at baseline — NO lighter subset. A ~15-commit refactor branch needs a clean end-to-end start so a pre-broken build / journeys-04 / knip is caught here as "already red", not misattributed to 5f at Task N+2.
```
Expected: PASS. RED before any change → STOP (abort 2).

- [ ] **Step 4: Seam audit — read the moved file end-to-end and reconcile**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
F=$(find src/features/market-research -name 'CompetitorLandscapeSection.tsx')
echo "=== LOC ==="; wc -l "$F"
echo "=== component layers (expect ONE React.FC + export default) ==="; grep -nE 'const CompetitorLandscapeSection|export default' "$F"
echo "=== props interface ==="; grep -nE 'interface CompetitorLandscapeSectionProps' "$F"
echo "=== state slices ==="; grep -nE 'useState|useReducer' "$F"
echo "=== effects/refs (read-orchestration to thin out) ==="; grep -cE 'useEffect' "$F"; grep -cE 'useRef' "$F"
echo "=== in-component data access (MUST exist — Task 4 removes the READ path) ==="; grep -nE 'fetch\(|getUserLocalStorage|setUserLocalStorage|/api/ask|/api/market_intelligence' "$F"
echo "=== uiComponents parsing ==="; grep -nE 'normalizeUiComponents|comp\?\.type ===' "$F" | head
echo "=== per-block save handlers ==="; grep -nE 'const handleSave[A-Za-z]+' "$F"
echo "=== charts (expect MiniLineChart only; NO recharts) ==="; grep -nE 'MiniLineChart|BarChart|ScatterChart|RadarChart|recharts' "$F"
echo "=== importers ==="; grep -rln 'CompetitorLandscapeSection' src --include=*.ts --include=*.tsx
```

**Confirmed live structure (verify each; reconcile any drift — the audit wins, abort 3 on a behavior-changing divergence). Every `L###` below is a pre-5a/5b/5c anchor — re-derive each seam from this Step's grep output; do NOT use the literal line numbers:**

- **LOC 2,648. Single layer** — `const CompetitorLandscapeSection: React.FC<CompetitorLandscapeSectionProps> = ({ … }) => {` (L84), `export default CompetitorLandscapeSection;` (L2648). **No inner `…Component` wrapper.**
- **Props slice consumed (L46–82 interface; L84–113 destructure):** view flags `isEditing`(→`isCompetitorLandscapeEditing`)/`isSplitView`/`isExpanded`/`hasEdits`, `deletedSections`/`editHistory` (both **unused** — destructured as `_`-prefixed), **data** `executiveSummary`/`topPlayerShare`/`emergingPlayers`/`fundingNews: string[]`, plus the blob `competitorData?: UntypedBackendApiResponse` and `error?: string | null`; ~17 `on*` callbacks (`onToggleEdit`, `onScoutIconClick`, `onEditHistoryOpen`(unused), `onDeleteSection`(unused), `onSaveChanges`, `onCancelEdit`, `onExpandToggle`, `onExecutiveSummaryChange`, `onTopPlayerShareChange`, `onEmergingPlayersChange`, `onFundingNewsChange`, `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`); `isRefreshing?`, `companyProfile?: UntypedBackendProfile`.
- **State (16 `useState` + `useReducer`):** `localError`, `localLoading`, `localExecutiveSummary`, `localTopPlayerShare`, `localEmergingPlayers`, `localDataPoints`, `localCompetitors`, `localRegions`, `localEntities` (SWOT), `localHeadlines`, `localFeatures`, `localTools`, `localInsights`, `localCharts`, `localMetrics`, and `forceUpdate` (`useReducer`). The three scalar locals + the ten `uiComponents`-derived locals all initialize from `competitorData` ⊕ props ⊕ `getUserLocalStorage(...)`.
- **`uiComponents` parsing → `competitorUiComponents.ts`:** `normalizeUiComponents` (L139, JSON-parses string entries, filters null) + the per-type extractors keyed by `comp?.type` ∈ {`report`,`section`,`marketShareCharts`,`swotAnalysis`,`news`,`featureComparison`,`mnaInsights`,`marketTrends`} + `generateTrendData(xAxis)` (the sparkline data builder, L2189/L2424 — appears twice, "reused from competitor"). These are pure → lift + TDD (Task 3).
- **In-component data machinery to handle in Task 4 (the gnarly part):** `useAuth()` → `{ currentUser }` (L114); `getUserLocalStorage`/`setUserLocalStorage` per-user cache for `competitor_executiveSummary`/`competitor_topPlayerShare`/`competitor_emergingPlayers` (L163-186 init, L323-339 write effects); the big props↔local **sync effect** with the `justSavedRef`/`savedLocalStateRef` guard (L344-525); user-switch clear effect (L835-850); refresh effect (L856-861); `competitorData`-change effect (L864-871); props-sync effect (L886-903). `handleCompetitorLandscapeSaveChanges` (L602) is the **edit-write** path: builds `original_json`/`modified_json`, `setUserLocalStorage(...modified_json...)`, then `fetch("/api/ask?…")` (L697) and on success `fetch("/api/market_intelligence")` (L727) to re-read. **The hook (Tasks 3–4) replaces the READ path** (props-as-data + localStorage-read fallbacks + the read-sync effects). **The `/ask` edit-write `fetch` stays this phase** — it rides with the edit handlers; migrating it to a mutation is out of 5f scope (flag for review; log a `TD-FE` if it should move). Do **not** silently drop it (that drops save behavior). **If Task 0 finds the read fetch/cache already absent** (5b/5c removed this section's read machinery ahead of 5f): the section already sources server data through other wiring — derive the read seams from that wiring, **shrink or skip Task 4's read-path deletion** (it collapses to hook-adoption-only, or a no-op), and record the reduced scope in the PR. This is *distinct* from abort 5 (un-cuttable cross-section coupling): a clean prior removal is NOT an abort, just a smaller Task 4.
- **Render blocks (the sub-component list — each an `isEditing`-gated inline block with a `handleSave*`; confirm + reconcile):**
  1. **Header** (`BarChart3` icon + title "Competitor Landscape" + "Unsaved" badge + Edit + Scout buttons, L1024-1076) → `CompetitorLandscapeHeader.tsx`
  2. **Executive Summary** (always-visible; Textarea in edit, `handleSaveExecutiveSummary`, L1078-1117) → `CompetitorExecutiveSummary.tsx`
  3. **Key Metrics** (the `localMetrics` grid OR the props fallback of Top-Player-Share + Emerging-Players KPI cards; `handleSaveTopPlayerShare`/`handleSaveEmergingPlayers`, L1119-1300) → `CompetitorKeyMetrics.tsx` (logic-bearing: the metrics-vs-fallback branch — TDD)
  4. **Competitor Analysis Report** (`localDataPoints`; `handleSaveCompetitorReport`, L1322-1412) → `CompetitorReportDataPoints.tsx`
  5. **Major Competitors** (`localCompetitors` tags; `handleSaveMajorCompetitors`, L1414-1516) → `MajorCompetitorsList.tsx`
  6. **Market Share Analysis** (`localRegions`, `<Table>`×11; `handleSaveMarketShareCharts`, L1518-~1660) → `MarketShareRegionsTable.tsx` (logic-bearing — TDD)
  7. **Market Trends / sparklines** (`localCharts` + `generateTrendData` + `MiniLineChart`; `handleSaveMarketTrends`, ~L1646-1840 and again ~L2189-2470) → `CompetitorMarketTrends.tsx` (logic-bearing: trend-data shaping — TDD). NOTE the audit found `MiniLineChart`/`generateTrendData` at **two** sites (L1700 + L2222/L2444) — reconcile whether these are one block rendered in two view modes or two blocks; collapse to one component if the markup is uniform.
  8. **SWOT Analysis** (`localEntities` strengths/weaknesses/opportunities/threats per entity; `handleSaveSwotAnalysis`; display + empty-state ~L1842-2018) → `CompetitorSwotAnalysis.tsx` (logic-bearing — TDD)
  9. **News & Funding** (`localHeadlines`; ~L2020-2188) → `CompetitorNewsFeed.tsx`
  10. **Feature Comparison** (`localFeatures`/`localTools`; `handleSaveFeatureComparison`; ~L2298-2520 incl. a second MiniLineChart usage) → `CompetitorFeatureComparison.tsx` (logic-bearing — TDD)
  11. **M&A Insights** (`localInsights`; `handleSaveMnaInsights`; ~L2521-2606) → `CompetitorMnaInsights.tsx`
  12. **Footer actions** (Read More / Export / Save-to-Workspace / shareable-link, `onSaveToWorkspace`/`onExportPDF`/`onGenerateShareableLink`, L2607-2620) → fold into the container (small) or `CompetitorLandscapeFooter.tsx` if sizeable.
  Plus the loading block (L916-931) and the error/empty block (L934-963) → keep in the container (small early-returns) or a tiny `CompetitorLandscapeStates.tsx` if large after reconcile.
- **Charts:** `MiniLineChart` (`@/components/ui/MiniLineChart`) only. **No recharts, no tabs, no CSV export, no dossier/compare/positioning/tier — do NOT invent these.**
- **Importer:** single — `MarketIntelligenceSections.tsx` (default import L3, `<CompetitorLandscapeSection … />` render L183). **No `SectionErrorBoundary` exists** anywhere in the codebase; the only boundary is `FeatureErrorBoundary` (`@/shared/components`). Verify how 5c wraps sections (per-tab vs per-section) in Step 5.

- [ ] **Step 5: Importer + boundary precheck**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== importers ==="; grep -rn 'CompetitorLandscapeSection' src --include=*.tsx --include=*.ts | grep -v 'CompetitorLandscapeSection.tsx:'
echo "=== how sections are wrapped (per-tab vs per-section) ==="; grep -rnE 'FeatureErrorBoundary' src/features/market-research
echo "=== props passed to the section at the call site ==="; sed -n '180,215p' src/features/market-research/components/intelligence/MarketIntelligenceSections.tsx 2>/dev/null || grep -n 'CompetitorLandscapeSection' $(grep -rl 'CompetitorLandscapeSection' src)
```
**Boundary decision (resolved against merged `master`, 2026-06-02):** 5c wraps the **entire intelligence tab** in one `<FeatureErrorBoundary featureName="Market Intelligence">` (`IntelligenceTab.tsx`, around `<MarketIntelligenceSections />`), and the merged 5d `market-entry/` section adds **no** section-level boundary — `FeatureErrorBoundary` appears nowhere else in `features/market-research/`. Convention is **per-tab, not per-section**. → **5f adds NO boundary.** This step is confirm-only: re-verify the tab-level wrap is intact and note in the PR that the section inherits it (the contract's "if warranted" is satisfied). Do **not** add a section-level boundary — that would diverge from the 5d convention.

No commit (audit only). If reality diverges from Step 4/5, STOP and reconcile this plan (abort 3). Record the finalized seam list for Tasks 1–N.

---

## Section-copy note

This section currently **hard-codes** its display strings (title "Competitor Landscape", "Loading competitor landscape data…", "No data available", section headings) as inline literals — it does **not** read the shared `components/intelligence/sectionCopy.ts` (confirmed: no `sectionCopy.` references in the file). **Decision: keep these strings inline verbatim during extraction** — do NOT migrate them into `sectionCopy.ts` and do NOT invent new copy. Migrating copy into the shared module is not 5f's job (5c owns shared copy; this section was not migrated there). State this in the PR (a 5c gap, not 5f scope). If Task 0 finds 5c *did* migrate this section's copy, read from `../../sectionCopy` instead and note it.

---

## Task 1: Relocate the section into `competitor-landscape/` + barrel; rewrite importer

**Files:**
- Move: the section → `…/components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx`
- Create: `…/competitor-landscape/index.ts` (barrel)
- Modify: every importer (path swap only) — canonically `MarketIntelligenceSections.tsx`.

> Spec §2.1, §6. `git mv` preserves history; no content edits beyond import-path fixes. Mirror 5d/5e Task 1. Transitional exception: the old path may re-export from the new location until the importer is switched (within this sub-phase).

- [ ] **Step 1: Create the dir and `git mv` the file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
SRC=$(find src/features/market-research -name 'CompetitorLandscapeSection.tsx')
mkdir -p src/features/market-research/components/intelligence/competitor-landscape
git mv "$SRC" src/features/market-research/components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx
```
`git status` must show a rename. Fix any now-wrong **relative** imports inside the moved file (it currently uses `@/`-aliased imports only — confirm none are `./`-relative).

- [ ] **Step 2: Add the barrel `index.ts`** (the live file is a **default** export — mirror that):
```ts
export { default as CompetitorLandscapeSection } from "./CompetitorLandscapeSection";
```

- [ ] **Step 3: Repoint every importer** (`MarketIntelligenceSections.tsx` uses a relative `./CompetitorLandscapeSection` default import):
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rln "CompetitorLandscapeSection" src --include=*.ts --include=*.tsx
# In MarketIntelligenceSections.tsx, change:
#   import CompetitorLandscapeSection from "./CompetitorLandscapeSection";
# to:
#   import { CompetitorLandscapeSection } from "./competitor-landscape";
# (or "./intelligence/competitor-landscape" depending on the 5c location of MarketIntelligenceSections)
grep -rn "components/CompetitorLandscapeSection\|/CompetitorLandscapeSection\"" src --include=*.ts --include=*.tsx   # backstop after edit: NO output
```
The Step 4 `tsc` is the final backstop.

- [ ] **Step 4: Settle, typecheck, lint, knip, commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate CompetitorLandscapeSection into intelligence/competitor-landscape"
```

---

## Task 2: Extract local types `types.ts`

**Files:**
- Create: `…/competitor-landscape/types.ts`

> Feature-local view-model for the section. No shared per-component schema exists (24b leaves `data` tolerant) — keep section-scoped until a 2nd consumer appears.

- [ ] **Step 1: Lift the local types + add the view-model.** Move `EditRecord` and `CompetitorLandscapeSectionProps` out of the section into `types.ts`. Add the shapes the `uiComponents` slices use (derive the real fields from the Task 0 read):
```ts
export interface EditRecord { /* lifted verbatim (L36) */ }

export interface DataPoint { label: string; value: string }
export interface RegionShare { name: string; data: Record<string, string> }
export interface SwotEntity {
  name: string; strengths: string[]; weaknesses: string[];
  opportunities: string[]; threats: string[];
}
export interface MnaInsight { label: string; description: string }
export interface TrendChart { name: string; xAxis: string | string[] }
export interface Metric { label: string; value: string; trend?: string }

/** The slice the section renders (mirror of the MarketIntelligenceTabProps fields it consumes). */
export interface CompetitorLandscapeSectionProps { /* lifted verbatim (L46) */ }

/** The section's view-model (what useCompetitorLandscape resolves the 5b data into). */
export interface CompetitorLandscapeView {
  executiveSummary?: string;
  topPlayerShare?: string;
  emergingPlayers?: string;
  fundingNews?: string[];
  // Intentionally `unknown[]` — mirrors 5b's tolerant `.passthrough()` (no per-component schema; see §"Locked data-layer contract").
  // The typed + tested boundary is competitorUiComponents.ts (Task 3), not a runtime guard here.
  uiComponents?: unknown[];
}
```
Re-point the moved section file (and the soon-to-be-extracted children) to import these from `./types` (transitional intra-section import).

- [ ] **Step 2: tsc + lint + knip + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsc --noEmit -p tsconfig.app.json && npm run lint
npx knip --strict --no-progress   # the type move changes reachability — catch an orphaned old inline type (per the Conventions "knip where reachability changed")
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract local view types for competitor-landscape section"
```

---

## Task 3: Extract `competitorUiComponents.ts` (pure uiComponents parsing + trend helper) — TDD

**Files:**
- Create: `…/competitor-landscape/competitorUiComponents.ts`
- Test: `…/competitor-landscape/__tests__/competitorUiComponents.test.ts`

> Spec §6, §8. The `normalizeUiComponents` parser, the per-type extractors, and `generateTrendData` are pure functions — lift them out and unit-test the logic directly (this is the section's only real "business logic"). The container keeps the initialization/sync `useState` initializers but calls these pure extractors.

- [ ] **Step 1: Write the failing test** covering the load-bearing rules:
```ts
import { describe, expect, it } from "vitest";
import {
  normalizeUiComponents, extractDataPoints, extractCompetitorTags, extractRegions,
  extractSwotEntities, extractHeadlines, extractFeatureComparison, extractMnaInsights,
  extractTrendCharts, extractMetrics, generateTrendData,
} from "../competitorUiComponents";

describe("competitorUiComponents", () => {
  it("normalizeUiComponents: JSON-parses string entries, drops unparseable, passes objects", () => {
    const out = normalizeUiComponents(['{"type":"news","headlines":["a"]}', "not json", { type: "report" }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "news" });
  });
  it("extractSwotEntities: backfills missing opportunities/threats to []", () => {
    const ents = extractSwotEntities([{ type: "swotAnalysis", entities: [{ name: "X", strengths: ["s"], weaknesses: [] }] }]);
    expect(ents[0]).toMatchObject({ opportunities: [], threats: [] });
  });
  it("extractMnaInsights: parses nested JSON-string insights, filters empties", () => {
    expect(extractMnaInsights([{ type: "mnaInsights", insights: '[{"label":"L","description":"D"}]' }])).toHaveLength(1);
  });
  it("generateTrendData: turns x-axis labels into chart data without throwing on empty", () => {
    expect(() => generateTrendData([])).not.toThrow();
    expect(generateTrendData(["Q1", "Q2"]).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run red, then implement `competitorUiComponents.ts`** — lift `normalizeUiComponents` verbatim (L139), one `extract<Slice>(components)` per `comp?.type` ({`report`→dataPoints, `section`→tags/metrics, `marketShareCharts`→regions, `swotAnalysis`→entities (with the opportunities/threats backfill), `news`→headlines, `featureComparison`→features+tools, `mnaInsights`→insights (with nested JSON-parse), `marketTrends`→charts}), and `generateTrendData` verbatim (de-dupe the two copies at L2189/L2424 into one export). Keep each pure (array in → typed array/record out), preserving the exact fallbacks.

- [ ] **Step 3: In the section, import these extractors** and replace the inline `normalizedComponents.find(...)` + `generateTrendData` bodies with calls. Green + commit:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/competitor-landscape/__tests__/competitorUiComponents.test.ts
npx tsc --noEmit -p tsconfig.app.json && npm run lint
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract pure uiComponents parsing + trend helper for competitor-landscape"
```

---

## Task 4: Add the section hook `useCompetitorLandscape.ts` + adopt it (delete the in-component READ fetch/cache) — TDD

**Files:**
- Create: `…/competitor-landscape/useCompetitorLandscape.ts`
- Test: `…/competitor-landscape/__tests__/useCompetitorLandscape.test.tsx`
- Modify: `…/competitor-landscape/CompetitorLandscapeSection.tsx` (read server data from the hook; delete the localStorage-read fallbacks + read-sync effects/refs)

> Spec §6 ("replace the section's prop slice with hook consumption"), §5 (5b memory-only; retire raw `fetch`/localStorage cache), §12 R3. **This is the heaviest task.** 5b rewired the page, not this section, so 5f completes it for the *read* path. The hook wraps `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.competitor)` + `useRegenerateResearch`, maps `data` → `CompetitorLandscapeView`, and the container's read seams switch from props/localStorage to the hook. **Keep** the edit/local state and the per-block save handlers (sub-components are Tasks 5–N); **keep** the `/ask` edit-write `fetch` (write path) untouched this phase.

- [ ] **Step 1: Write the failing hook test** (RTL `renderHook` + `QueryClientProvider` + 5b MSW):
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useCompetitorLandscape } from "../useCompetitorLandscape";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useCompetitorLandscape", () => {
  it("returns mapped data from the research-component hook once loaded", async () => {
    const { result } = renderHook(() => useCompetitorLandscape("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
    // shape contract (abort-4 guard): the mapped view must expose what the section renders
    expect(Array.isArray(result.current.data?.uiComponents)).toBe(true);
    expect(result.current.data).toEqual(
      expect.objectContaining({ executiveSummary: expect.any(String) }),
    );
    expect(typeof result.current.refresh).toBe("function");
  });
  it("is disabled without an orgId", () => {
    const { result } = renderHook(() => useCompetitorLandscape("user-1", ""), { wrapper });
    expect(result.current.isLoading).toBe(false);
  });
});
```
> If 5b's MSW handler doesn't return competitor-shaped `data` (the four scalars + a `uiComponents` array), extend it in `src/test/msw/handlers.ts` to echo a realistic `"competitor landscape"` payload — commit that tweak with this task.

> **Behavioral signal at the structural gate (this is the heaviest, riskiest commit).** Also add a container-level test that renders `CompetitorLandscapeSection` with the hook live against MSW and asserts it **auto-hydrates** the section content from `useCompetitorLandscape` (no props-as-data), and that the empty-state Scout affordance calls `cl.refresh` and is disabled while `cl.isRefreshing`. `journeys/04` (spec §8's primary proof that behavior was preserved) otherwise runs only at Task N+2 — this RTL assertion carries the auto-hydrate/refresh contract at the point of maximum risk, so a Task 4 regression fails *here* rather than after Tasks 5–N.

- [ ] **Step 2: Run red, then implement `useCompetitorLandscape.ts`** (mirror 5d/5e shape):
```ts
import { useCallback, useMemo } from "react";

import {
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "@/features/market-research/services/marketResearch";

import type { CompetitorLandscapeView } from "./types";

export interface UseCompetitorLandscape {
  data: CompetitorLandscapeView | undefined;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
  isRefreshing: boolean;
}

export function useCompetitorLandscape(userId: string, orgId: string): UseCompetitorLandscape {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.competitor, !!userId && !!orgId);
  const regenerate = useRegenerateResearch(userId, orgId);
  const data = useMemo<CompetitorLandscapeView | undefined>(
    () => (query.data?.data ?? query.data) as CompetitorLandscapeView | undefined,
    [query.data],
  );
  const refresh = useCallback(() => regenerate.mutate(RESEARCH_COMPONENTS.competitor), [regenerate]);
  return { data, isLoading: query.isLoading, isError: query.isError, refresh, isRefreshing: regenerate.isPending };
}
```
> **Reconcile (abort 4 backstop):** the section renders the four scalar fields + `uiComponents`; the 5b hook returns `ResearchComponentResponse` (`{ status, data }`). Map `query.data?.data` to `CompetitorLandscapeView` — refine the unwrap to whatever 5d/5e's hooks do (match the siblings). If `data` cannot supply `uiComponents`/the scalars a block renders, STOP → escalate to 5b (abort 4); do NOT re-add a prop or a raw research `fetch`.

- [ ] **Step 3: Adopt the hook in the container; delete the READ-path machinery.** Resolve `orgId` and `userId` from the existing `useAuth()` source (reuse it; `userId = currentUser?.uid`; the live `orgId` default is `"brewra"` — keep behavior) and pass both to `useCompetitorLandscape(userId, orgId)`. Switch the read seams (`executiveSummary`/`topPlayerShare`/`emergingPlayers`/`fundingNews` + the `uiComponents` initializers) to read from `cl.data` via the Task 3 extractors. Render `cl.isLoading` → the existing loading block (L916), no-data → the existing empty block (L934) whose Scout affordance now calls `cl.refresh` (disabled on `cl.isRefreshing`). **Delete:** the `getUserLocalStorage` read fallbacks (L163-186), the localStorage-write effects (L323-339), the big props↔local read-sync effect (L344-525) and the `competitorData`-change / props-sync read effects (L864-903), and the `justSavedRef`/`savedLocalStateRef` read-guard **if** they only guarded the prop sync (keep whatever the edit-write path still needs). Keep `localError`/`localLoading` only if still used; drop the now-dead `@/utils/cacheUtils` import once no read uses it.
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
F=src/features/market-research/components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx
echo "=== READ-path localStorage gone (expect only edit-write survivors, if any) ==="; grep -nE 'getUserLocalStorage|setUserLocalStorage' "$F"
echo "=== research read no longer via props-as-data sync (effects thinned) ==="; grep -cE 'useEffect' "$F"
echo "=== surviving fetches (expect ONLY the two in handleCompetitorLandscapeSaveChanges) ==="; grep -nE 'fetch\(' "$F"
```
> **The two surviving fetches inside `handleCompetitorLandscapeSaveChanges`** (the Step-3 `grep 'fetch('` above lists exactly these — confirm no others remain): the `/api/ask` edit-write (L697) and the `/api/market_intelligence` post-save re-read (L727). The `/ask` call is a pure write; the re-read is functionally a **read-refresh** that, once the hook owns the read path, runs *parallel* to the TanStack cache — it sets local state from a raw fetch, so the hook's cached copy and the post-save state can diverge. **Decision (this phase): keep BOTH as-is** — they ride together with the deferred write path; do **not** route the re-read through `cl.refresh()`/query-invalidation in 5f. Log BOTH in the single write-path `TD-FE` (Task N+2 Step 7, which already names `/api/ask` + `/api/market_intelligence`) and flag the cache-divergence caveat for the reviewer. **Deferred end-state (NOT done here):** post-save refresh should become `cl.refresh()`/query-invalidation so the hook cache stays the single source of truth — deferred to that same write-path TD-FE (trigger: migrating `/ask` off raw fetch). If removing the read fetch/sync makes `journeys/04` fail because the section no longer hydrates, the hook's `enabled`/auto-fetch isn't matching the old behavior — fix the hook wiring, do NOT re-add the read fetch.

- [ ] **Step 4: Boundary — confirm only (no wrap added).** Per the Task 0 Step 5 decision: 5c wraps the whole intelligence tab in `<FeatureErrorBoundary>` and 5d added none, so 5f adds **no** section-level boundary. Just confirm the tab-level wrap still covers this section and note it in the PR. (No separate commit — there is nothing to add or split out.)

- [ ] **Step 5: Settle, typecheck, lint, test, knip, commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/competitor-landscape
# Checkpoint behavioral run — Task 4 is the single riskiest commit (read-path swap). Kill any orphan vite preview on :5173 first so Playwright can't false-green against a stale build, then run §8's journey:
pkill -f 'vite preview' 2>/dev/null || true
npx playwright test e2e/journeys/04-market-research-5-components.spec.ts
npx knip --strict --no-progress
```
> If the journey reds here, the swap changed behavior (a block not rendering, the refresh wiring, the hook's `enabled`/auto-fetch not matching the old behavior, or lost edit state) — fix the hook wiring, do NOT re-add the read fetch. This is the one mid-branch Playwright run; the rest of Phase 5's behavioral gating stays at Task N+2.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): add useCompetitorLandscape hook; CompetitorLandscape reads it, drops in-component read fetch/cache"
```

---

## Tasks 5–N: Extract one focused block per commit (TDD where logic-bearing)

> Spec §6 (single-purpose files + tests for logic-bearing units), §12 R6. **Run one task per confirmed block from Task 0 Step 4.** Follow the Decomposition template. Each sub-component takes typed props from `types.ts`; the container passes `cl.data` slices (run through the Task 3 extractors) + the edit value/callback pairs down. **No sub-component fetches or calls the hook.** Logic-bearing blocks (Key Metrics' metrics-vs-fallback branch, Market-Share regions table, Market Trends sparklines, SWOT, Feature Comparison) get an RTL test first; trivial presentational shells (header, exec-summary textarea, news list, data-points, M&A insights, major-competitors tags) may skip the test per §8.

**Concrete task list (reconcile to Task 0; one commit each):**

- [ ] **Task 5 — `CompetitorLandscapeHeader.tsx`** (presentational). Title + icon + "Unsaved" badge + Edit + Scout buttons; props `{ isEditing, hasEdits, onToggleEdit, onScoutIconClick }`. Commit: `refactor(fe): extract CompetitorLandscapeHeader from CompetitorLandscapeSection`.
- [ ] **Task 6 — `CompetitorExecutiveSummary.tsx`** (presentational; small). Display `<p>` vs edit `<Textarea>` + `handleSaveExecutiveSummary`; props `{ isEditing, value, onChange, onCommit, displayValue }`. Commit: `refactor(fe): extract CompetitorExecutiveSummary from CompetitorLandscapeSection`.
- [ ] **Task 7 — `CompetitorKeyMetrics.tsx`** (logic-bearing — TDD the metrics-vs-fallback branch). The `localMetrics` grid OR the Top-Player-Share/Emerging-Players KPI fallback; add/remove/commit in edit. Commit: `refactor(fe): extract CompetitorKeyMetrics from CompetitorLandscapeSection`.
- [ ] **Task 8 — `CompetitorReportDataPoints.tsx`** (presentational). `localDataPoints` add/remove/edit + `handleSaveCompetitorReport`. Commit: `refactor(fe): extract CompetitorReportDataPoints from CompetitorLandscapeSection`.
- [ ] **Task 9 — `MajorCompetitorsList.tsx`** (presentational). `localCompetitors` tags add/remove/edit + `handleSaveMajorCompetitors`. Commit: `refactor(fe): extract MajorCompetitorsList from CompetitorLandscapeSection`.
- [ ] **Task 10 — `MarketShareRegionsTable.tsx`** (logic-bearing — TDD). `localRegions` `<Table>` of per-region company→share rows, add/remove/edit + `handleSaveMarketShareCharts`. Commit: `refactor(fe): extract MarketShareRegionsTable from CompetitorLandscapeSection`.
- [ ] **Task 11 — `CompetitorMarketTrends.tsx`** (logic-bearing — TDD the trend-data shaping). `localCharts` + `generateTrendData` + `MiniLineChart` + `handleSaveMarketTrends`. **Reconcile the two MiniLineChart sites** (Task 0) — one component if uniform; the empty-state-in-edit-mode quirk (L1721) preserved. Commit: `refactor(fe): extract CompetitorMarketTrends from CompetitorLandscapeSection`.
- [ ] **Task 12 — `CompetitorSwotAnalysis.tsx`** (logic-bearing — TDD). `localEntities` 4-quadrant SWOT per entity + empty-state + `handleSaveSwotAnalysis`. Commit: `refactor(fe): extract CompetitorSwotAnalysis from CompetitorLandscapeSection`.
- [ ] **Task 13 — `CompetitorNewsFeed.tsx`** (presentational). `localHeadlines` news/funding list add/remove/edit. Commit: `refactor(fe): extract CompetitorNewsFeed from CompetitorLandscapeSection`.
- [ ] **Task 14 — `CompetitorFeatureComparison.tsx`** (logic-bearing — TDD). `localFeatures`/`localTools` comparison + `handleSaveFeatureComparison`. Commit: `refactor(fe): extract CompetitorFeatureComparison from CompetitorLandscapeSection`.
- [ ] **Task 15 — `CompetitorMnaInsights.tsx`** (presentational). `localInsights` list + `handleSaveMnaInsights`. Commit: `refactor(fe): extract CompetitorMnaInsights from CompetitorLandscapeSection`.
- [ ] **(reconcile) Add/drop tasks** to match Task 0's confirmed blocks (e.g. a `CompetitorLandscapeFooter.tsx` for the export/workspace/share actions if sizeable; a `CompetitorLandscapeStates.tsx` for the loading/empty blocks if large; collapse the two trend sites). Drop any task whose block does not exist. **If the block count changes, re-number the subsequent concrete tasks accordingly** — the load-bearing references use the `N+1`/`N+2` abstraction, which stays stable regardless of the renumber.

After the last extraction the container is a thin coordinator over `useCompetitorLandscape` + the edit/local state + the composed sub-components. Sanity:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
wc -l src/features/market-research/components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx   # expect a small container
ls src/features/market-research/components/intelligence/competitor-landscape
npx knip --strict --no-progress   # every sub-component reachable from the container; no orphan export
```

---

## Task N+1: Remove CompetitorLandscape's `MarketIntelligenceTabProps` slice (do NOT delete the interface)

**Files:**
- Modify: `frontend/src/features/market-research/components/MarketIntelligenceTabProps.ts` (drop **only** competitor-exclusive **data** fields)
- Modify: the caller (`MarketIntelligenceSections.tsx`) — stop forwarding the competitor data slice
- Modify: `…/competitor-landscape/CompetitorLandscapeSection.tsx` (drop now-unused prop typing)

> Spec §6, R3. Stop consuming the data/loading/refresh props for this section; source them from `useCompetitorLandscape`. **`MarketIntelligenceTabProps.ts` is retained** — other sections still consume it; it is deleted by the **last** converting section (≤5h), and 5i's dead-code sweep confirms it gone (abort 7 if already deleted). Remove here **only** competitor-exclusive **data** fields; keep cross-section fields and any edit-callback the section still calls.

- [ ] **Step 1: Identify competitor-exclusive data fields.** From Task 0, split the competitor-prefixed fields into two groups — do **not** treat them as one undifferentiated candidate list:
  - **Data fields (the hook now owns → removable):** `competitorData`, `competitorExecutiveSummary`, `competitorTopPlayerShare`, `competitorEmergingPlayers`, `competitorFundingNews`, `competitorError`.
  - **Per-section view/edit-state fields (`competitorExpanded`, `competitorHasEdits`, `competitorDeletedSections`, `competitorEditHistory`, `competitorLastEditedField`, `competitorCustomMessage`):** these may be **container-local now** (the hook-first 5c extraction) **or** still forwarded by the parent — the plan cannot decide this on paper. **Confirm ownership against the merged tree at Task 0 and default to KEEPING them**; drop one only if Task 0 shows the container self-manages it and nothing forwards it.

  A field is removable only if no other section reads it:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/components/MarketIntelligenceTabProps.ts
grep -niE 'competitor' "$P"
echo "=== consumers that must remain ==="; grep -rln 'MarketIntelligenceTabProps' src --include=*.ts --include=*.tsx
```
The **data** fields (`competitorData`/`competitor{ExecutiveSummary,TopPlayerShare,EmergingPlayers,FundingNews,Error}`) the hook now owns are removable. Keep cross-section coordination (`orgId`/global search/active section) and any edit callback the container still uses; when in doubt, leave the field (the last section deletes the interface anyway). **The hard regression backstop is Step 4's `tsc --noEmit`:** removing a field a sibling section still references is a compile error — trust `tsc` over grep/judgment. If Step 4 type-checks green, nothing else depended on the dropped field.

- [ ] **Step 2: Drop the exclusive data fields + stop forwarding them.** Remove them from `MarketIntelligenceTabProps.ts`; in `MarketIntelligenceSections.tsx` stop passing them to `<CompetitorLandscapeSection>` (render `<CompetitorLandscapeSection orgId={…} />` plus whatever edit props remain); in the container drop the corresponding destructured props (read from the hook now). Remove now-dead page-side wiring that only fed them if 5b/5c left any.

- [ ] **Step 3: Confirm the interface survives + record remaining consumers** (for the PR):
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/market-research/components/MarketIntelligenceTabProps.ts && echo "OK: interface retained (≤5h deletes it)"
grep -rln 'MarketIntelligenceTabProps' src --include=*.ts --include=*.tsx   # expect: interface + other un-converted sections + SafeMarketIntelligenceTab + MarketIntelligenceSections + MarketIntelligenceTab
```

- [ ] **Step 4: Gates + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/competitor-landscape
npx knip --strict --no-progress   # interface still referenced → must NOT be flagged; if it is, a consumer was missed (do NOT delete it)
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): drop CompetitorLandscape data slice of MarketIntelligenceTabProps (interface retained)"
```

---

## Task N+2: Final preflight + done-when + handoff

**Files:** none (verification + handoff).

- [ ] **Step 1: Cleanup transitional artifacts** — remove any old-path re-export and leftover intra-section transitional imports; confirm the barrel exports only the container.

- [ ] **Step 2: eslint + knip**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint
npx knip --strict --no-progress
```
Expected: no orphaned exports/files — every new module (`types.ts`, `competitorUiComponents.ts`, `useCompetitorLandscape.ts`, each `*.tsx`) is imported; the section is reachable from the intelligence tab.

- [ ] **Step 3: Full preflight** (the visual guard — behavioral E2E + Vitest/RTL + build; **no pixel VR added**)
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

- [ ] **Step 4: Behavioral parity — `journeys/04` green; NO MR pixel VR**

The Playwright run inside Step 3 includes `e2e/journeys/04-market-research-5-components.spec.ts` (login → marketintelligence → the five sections load; competitor renders its content). Confirm it passed and that **no `toHaveScreenshot`/pixel-VR was added for market-research** (§8/§12 R4 / 5a TD-FE). If it reds, the swap changed behavior (a block not rendering, the refresh wiring, the hook not firing, lost edit state) — investigate, fix, re-run; if unfound, STOP (abort 6).

- [ ] **Step 5: Diff-shape sanity check**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-5f-competitor-landscape
```
Expected: a history-preserving rename into `intelligence/competitor-landscape/`; new `competitor-landscape/` files (`useCompetitorLandscape.ts`, `competitorUiComponents.ts`, `types.ts`, the sub-components, `__tests__/*`); small edits to `MarketIntelligenceSections.tsx` + `MarketIntelligenceTabProps.ts`; a possible MSW-handler tweak. **No** route/URL change, **no** other section touched, **no** new raw research `fetch` introduced, `MarketIntelligenceTabProps.ts` still present.

- [ ] **Step 6: Done-when (spec §6 "Done when (each)")**
1. The section renders from `components/intelligence/competitor-landscape/` as a tree of single-purpose files (container + sub-components + `useCompetitorLandscape.ts` + `competitorUiComponents.ts` + `types.ts` + `index.ts` + `__tests__`) reading from hooks.
2. The legacy monolithic `CompetitorLandscapeSection.tsx` (2,648 LOC) is gone — it is now the thin container.
3. The section's data comes from `useCompetitorLandscape` (5b hooks); it has **no raw research `fetch`/localStorage read cache** of its own (the `/ask` edit-write path is the documented exception, flagged for review).
4. This section's `MarketIntelligenceTabProps` **data** slice is removed; the interface is **retained**; remaining consumers noted in the PR.
5. Logic-bearing units (`competitorUiComponents`, `useCompetitorLandscape`, and the metrics/regions/trends/SWOT/feature-comparison sub-components) have Vitest/RTL tests.
6. `<FeatureErrorBoundary>` covers the section (or the 5c per-tab convention is honoured); section copy kept inline verbatim (decision documented).
7. `knip --strict` clean; `journeys/04` + Vitest + `npm run preflight` green; **no `toHaveScreenshot` added for market-research**.

- [ ] **Step 7: Hand off for review + merge**
Per Spec §10: `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below; depth is the orchestrator's call — this is a large section, so likely a fuller sign-off). Then the controller runs `npm run preflight` once more and, on green, merges `phase-5f-competitor-landscape` → `master`. If any task regresses, revert that task's commit (per-sub-phase revert discipline). Flag for the reviewer: (a) the reconciled seam list (Task 0); (b) that the **edit-write path (`/ask` `fetch`) stayed as-is** (5f migrated the read path only) — **and log it as a `TD-FE` (next free number) in `docs/TECH_DEBT.md`**: a raw `fetch` surviving inside a feature being migrated off raw fetch is an accepted compromise the register must record (current state = section's edit-save still calls `/api/ask` + `/api/market_intelligence` directly; should-be = a 5b mutation; trigger = next touch of the write path). Append the entry **surgically — do NOT run prettier on `TECH_DEBT.md`** (it sits outside the frontend prettier gate and reformatting corrupts its markdown); (c) the remaining `MarketIntelligenceTabProps` consumers; (d) section copy kept inline (a 5c gap). **Next: 5g/5h** (IndustryTrends, then MarketSize — the last section, which deletes `MarketIntelligenceTabProps.ts`; 5i confirms).

---

## Self-review notes (plan author)

- **Grounded in the REAL file (2,648 LOC), read end-to-end, not inferred.** Corrected against the live source: the section is an **inline-editable, single-layer `React.FC`** (`export default`), **NOT** chart-driven — it uses **zero recharts** (only `MiniLineChart` sparklines), **no tabs**, **no CSV export**, no dossier/compare/positioning/tier. Seams: 16 `useState` + `useReducer`, the `competitorData.uiComponents` parsing (8 `comp.type` slices) + `generateTrendData` → tested `competitorUiComponents.ts`, and ~12 inline-editable blocks each with a `handleSave*`. No invented sub-components.
- **NOT purely prop-driven — it self-fetches (5b missed it).** Two `fetch` calls (`/api/ask` edit-save + `/api/market_intelligence` re-read) and per-user `getUserLocalStorage`/`setUserLocalStorage` caching. So 5f mirrors **5d (MarketEntry)**: introduce the hook and **delete the in-component READ fetch/cache** (Task 4), while **keeping the edit-write `/ask` path** (flagged for review, not silently dropped) — exactly the 5d treatment of its `/ask` edit-write path. Abort 5 covers parent coupling on `on*Change` hydration.
- **Identifiers locked to 5b:** `useResearchComponent`, `useRegenerateResearch`, `RESEARCH_COMPONENTS.competitor` = **`"competitor landscape"`** (verified live in `MarketResearch.tsx`). Hook mirrors 5d/5e shape. No `CompetitorLandscapeSchema` (tolerant `data`) → view-model local in `types.ts`.
- **TDD where logic-bearing:** `competitorUiComponents.ts` (the only real logic) + the hook are TDD; metrics/regions/trends/SWOT/feature-comparison sub-components get RTL tests; trivial shells skip per §8.
- **Props discipline:** the competitor **data** slice is removed (Task N+1); `MarketIntelligenceTabProps.ts` is **retained** (≤5h deletes it; 5i confirms; abort 7 if already gone); remaining consumers (`SafeMarketIntelligenceTab`, `MarketIntelligenceSections`, `MarketIntelligenceTab`, the un-converted sections) enumerated; knip guards against an accidental orphan.
- **Boundary:** **no `SectionErrorBoundary` exists** in the codebase (corrected) — only `FeatureErrorBoundary` (`@/shared/components`). Task 0 Step 5 checks how 5c wraps sections; add one section-level boundary only if 5c doesn't already, matching the 5d/5e convention.
- **Section copy:** the section hard-codes its strings (does NOT use `sectionCopy.ts`) — kept inline verbatim; not migrated (a 5c gap, out of 5f scope). Decision stated.
- **Commit per logical step / sub-component**, all `refactor(fe):`/`feat(fe):`, from the monorepo root, **no `Co-Authored-By`, no `[N/M]`.**
- **Visual guard:** behavioral E2E `journeys/04` + Vitest/RTL + preflight; `knip --strict`; **no market-research pixel VR / `toHaveScreenshot`** (§8/§12 R4 / 5a TD-FE). Branch off latest `master`; incremental merge; revert per sub-phase; transitional import exception cleaned in Task N+2.

## Appendix A — Baseline metrics (from Task 0 audit, verified at authoring against the pre-5a file)

| Metric | Value |
|---|---|
| LOC (`CompetitorLandscapeSection.tsx`) | 2,648 |
| Layers | 1 (`React.FC`, `export default`) |
| `useState` | 16 + 1 `useReducer` (`forceUpdate`) |
| `useEffect` / `useRef` | 15 / 4 |
| In-component data access | `fetch`×2 (`/api/ask` edit-save L697, `/api/market_intelligence` re-read L727); `getUserLocalStorage`/`setUserLocalStorage` ×3 keys |
| Charts | `MiniLineChart` only (NO recharts) |
| Tabs / CSV export | none |
| `uiComponents` slices parsed | report, section(tags+metrics), marketShareCharts, swotAnalysis, news, featureComparison, mnaInsights, marketTrends |
| Pure helpers → `competitorUiComponents.ts` | `normalizeUiComponents` + 8 extractors + `generateTrendData` (de-dupe 2 copies) |
| Per-block save handlers | handleSave{ExecutiveSummary,TopPlayerShare,EmergingPlayers,CompetitorReport,MajorCompetitors,MarketShareCharts,SwotAnalysis,FeatureComparison,MnaInsights,MarketTrends} (10) |
| Inline-editable blocks → `*.tsx` | header, exec-summary, key-metrics, report-datapoints, major-competitors, market-share-regions(`<Table>`), market-trends(sparklines), SWOT, news, feature-comparison, M&A-insights (+ footer/states) |
| Props slice (data, to remove) | `competitorData` + `competitor{ExecutiveSummary,TopPlayerShare,EmergingPlayers,FundingNews,Error}` (+ keep `orgId`/edit callbacks) |
| Importer | 1 (`MarketIntelligenceSections.tsx`, default import L3, render L183) |
| Error boundary in codebase | `FeatureErrorBoundary` only (NO `SectionErrorBoundary`) |
| `contracts.ts` competitor schema | none — tolerant `ResearchComponentResponse`; view-model stays local |
| Section copy | hard-coded inline (does NOT use `sectionCopy.ts`) |

## Appendix B — Per-section template (spec §6 / set by 5c, applied 5d/5e)

Each section directory: `<Section>.tsx` (container, consumes the section hook + composes children) · presentational sub-components (one per block, plain props, no hook access) · `use<Section>.ts` (wraps the 5b `useResearchComponent`/`useRegenerateResearch`; surface `{ data, isLoading, isError, refresh, isRefreshing }`) · `types.ts` (local view-model) · `index.ts` (barrel) · `__tests__/*` (Vitest + RTL + MSW). This section adds `competitorUiComponents.ts` (the pure `uiComponents` parsing + trend helper) given the live file's data shaping lives there — consistent with the template's intent (logic out of JSX, into a tested module).
