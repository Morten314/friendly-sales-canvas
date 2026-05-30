# Frontend Phase 5d — Decompose `MarketEntrySection` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the market-research feature's biggest file — `MarketEntrySection.tsx` (3,873 raw LOC, of which **~1,970 lines are a commented-out old copy of the component (dead code)** and **~1,900 are the live component**) — into a small tree of single-purpose files under `src/features/market-research/components/intelligence/market-entry/`: delete the dead block, then split the live component into a thin **container** (`MarketEntrySection.tsx`), **focused presentational sub-components** (one file each, one per render seam), a **section-data hook** (`useMarketEntry.ts`) consuming the 5b TanStack hooks, and **section-local types**. The section stops consuming its slice of the prop-drilled `MarketIntelligenceTabProps`, **deletes its own in-component research fetch + localStorage cache machinery** (5b's page rewire missed this file — see Architecture), and reads its server data through the hook. Behavioral + structural parity is mandatory; no rendered output changes.

**Architecture:** A horizontal, parity-preserving decomposition staged **relocate → delete dead block → add section hook → adopt hook + delete in-component fetch/cache → extract one piece per commit → drop the prop slice → finalize**, each kept green by `tsc --noEmit` + `npm run lint` + targeted Vitest. The **live** section (lines ~1971–3870) is a **single-layer** component (`const MarketEntrySection: React.FC<MarketEntrySectionProps>` at ~2045, `export default MarketEntrySection` at the end — *not* a two-layer wrapper, *not* a separate `…Component`). It takes a large `MarketIntelligenceTabProps`-shaped slice — `isEditing/isSplitView/isExpanded/hasEdits/deletedSections/editHistory`, the eight data fields (`executiveSummary`, `entryBarriers`, `recommendedChannel`, `timeToMarket`, `topBarrier`, `competitiveDifferentiation`, `strategicRecommendations`, `riskAssessment`), ~17 `on*` callbacks, `companyProfile`/`isRefreshing` — and renders one of three view modes (collapsed / expanded / edit). **Critically, the live code is NOT purely presentational: it still does its own data access** — `fetchMarketEntryData` (~2120) calls `apiFetchJson("market-research", POST)` via `executeWithRateLimit`, hydrates props through the `on*Change` callbacks, with 4 `useEffect` + 7 `useRef` orchestrating mount-fetch / refresh-on-`isRefreshing` / props-sync, plus `getUserLocalStorage("marketEntryData")` SWOT-from-localStorage fallbacks (~2295/2466) and a raw `fetch("/api/ask?…")` in the edit-save path (`handleMarketEntryFullSaveChanges`, ~2607). **5b's data-layer migration did not reach this in-component machinery** (5b rewired the *page*; this section kept its own fetch/cache) — so 5d both decomposes **and** completes the 5b migration for this section: `useMarketEntry(userId, orgId)` → `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketEntry)` (5b, memory-only cache) replaces `fetchMarketEntryData` + the localStorage SWOT cache + the fetch-orchestration effects/refs. **SWOT is not a prop** — the display SWOT comes from the fetched data (`displayData.swotAnalysis`), falling back to `editSwotAnalysis` in edit mode. The `"market entry & growth strategy"` `data` shape — a `.passthrough()` blob in 5b's `contracts.ts` — is refined into a section-local view-model (`market-entry/types.ts`, zod), parsed at the hook boundary (R2/polyglot: confirmed against a captured payload, never inferred). Each extracted piece is wired into the container in the **same commit** so the boundary is always green and each piece independently revertable. `MarketIntelligenceTabProps.ts` is **not deleted** here — MarketEntry is the *first* of five sections to convert (5d); the four remaining sections still consume it. Only MarketEntry's exclusive fields/usage are removed; the interface dies with the last section (5h) and 5i confirms it gone.

**Tech Stack:** React 18 + Vite + TS (strict), `@/` path alias → `src/`, ESLint flat-config (`eslint-plugin-import-x` + 4a resolver + zone/no-cycle rules + transitional legacy-import exception), `@tanstack/react-query` (provider mounted at `App.tsx`), `zod`, Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`, market-research handlers added in 5b), knip `--strict`, Playwright (behavioral journey only — **no MR pixel VR**, see Conventions). GNU `sed`/`grep` (linux).

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §6 (per-section decomposition pattern + "Done when (each)") — with §2.1 (target tree), §2.3, §4.2 (memory-only TanStack; retire raw `fetch`/localStorage cache), §8 (testing), §12 R3/R6 (prop-drill blast radius; context blow-up).

**Companion (the locked data-layer contract this plan consumes — set by 5b/`24b`, do not redefine):**
- `services/marketResearch.ts` → `RESEARCH_COMPONENTS` (`RESEARCH_COMPONENTS.marketEntry === "market entry & growth strategy"`), `fetchResearchComponent`.
- `contracts.ts` → `ResearchComponentSchema` / `ResearchComponentResponse` (the `{ status, data }` envelope).
- `hooks/useMarketResearch.ts` → **`useResearchComponent`**, **`useRegenerateResearch`**.
- `qk.marketResearchComponent` in `src/shared/api/queryKeys.ts`.
- MSW handlers for `market-research` already in `src/test/msw/handlers.ts`.

**Prerequisite (hard):** **5c (`plans/24c-frontend-phase-5c-page-decomposition.md`) merged to `master`.** 5d operates on the section as rendered by the 5c-created `IntelligenceTab` (the page is a thin shell + tab router; sections render through `IntelligenceTab` reading 5b hooks). Task 0 Step 2 verifies 5b's hooks/services/contracts + 5c's `IntelligenceTab` are present; if any is missing, stop. Branch off the latest `master`.

**Conventions for every task:**
- File ops (`mkdir`, `git mv`, `sed`, `grep`, `npm`, `eslint --fix`) run from `frontend/`. `git add`/`git commit` run from the monorepo root `/projects/Brewra/brewra-gtm-intelligence` (so any `docs/`/`specs/` path is includable). There is no root-level `package.json` — all `npm` is in `frontend/`.
- After each rewrite/extraction run `npx eslint --fix src` (settles `import-x/order`), then **`npm run lint`** and **`npx tsc --noEmit -p tsconfig.app.json`** must be green before committing. Run **`npx vitest run <files>`** for the touched tests and **`npx knip --strict --no-progress`** where a file's reachability changed.
- Commit messages: `type(scope):` form, scope `fe`; **no `Co-Authored-By` footer**; no `[N/M]`. One commit per task (one commit per extracted piece — preserves per-piece revert).
- **Visual-parity guard for ALL of Phase 5 is behavioral E2E `e2e/journeys/04-market-research-5-components.spec.ts` + Vitest/RTL + `npm run preflight`.** Market-research has **no** pixel visual-regression baseline and Phase 5 does **not** add one (TD-FE logged in 5a). **Do NOT add `toHaveScreenshot` for market-research.** Spec §6's "visual regression" wording predates the 5a finding — read it as behavioral-E2E + Vitest here.
- Transitional import exception (Phases 4b–12): `features/` may import `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`, plus `@/components/ui/*`, `@/shared/*`, and npm.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend pushed commits, or revert without sign-off):** the per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
1. 5b or 5c is not actually merged (Task 0 Step 2 fails).
2. The Task 0 baseline preflight (or its lighter subset) is RED **before any 5d change**.
3. The live `"market entry & growth strategy"` `data` shape cannot be confirmed — neither against a captured payload (5b fixtures / `/tmp` captures / MSW handler) nor a live backend call — so `market-entry/types.ts` would have to be inferred statically (R2). STOP and get a captured payload.
4. Behavioral `journeys/04` cannot be made green after decomposition and the cause is unfound after investigation (final task) — a structural-only refactor must not change behavior.
5. Replacing the in-component fetch/cache (Task 4) reveals cross-section coupling the 5b page-rewire depends on (e.g. the parent expects this section to hydrate shared props via `on*Change`) that cannot be cleanly cut — that is a 5b/5c boundary question (revert Task 4 and replan), not 5d's to force.

A half-decomposed tree is recoverable from the last green commit; a force-pushed/amended history is not.

---

## Task 0: Branch + green baseline + seam audit (confirm the live structure)

**Files:** none (verification + audit only).

> This task confirms the **seam list + the in-component data machinery** that drive Tasks 2–N. The structure below was read from the file at plan-authoring time (2026-05-30, against the pre-5a copy) and is concrete — **re-confirm it against the merged tree** (5b/5c may have rewired or partially removed the in-component fetch during the page rewire; line numbers will have shifted after relocation + dead-block deletion). Two findings to verify first: (1) **roughly half the file is a commented-out old copy of the component** (a `// import …`-prefixed block, ~lines 1–1970 of the raw file) that is dead code — Task 2 deletes it; (2) **the live code still fetches + caches on its own** (5b rewired the page, not this section) — Task 4 replaces that with the hook.

- [ ] **Step 1: Branch off the latest `master` (5c merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
git checkout -b phase-5d-market-entry
```

- [ ] **Step 2: Confirm 5b + 5c landed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/market-research/hooks/useMarketResearch.ts && echo "OK: 5b hooks"
grep -q 'RESEARCH_COMPONENTS' src/features/market-research/services/marketResearch.ts && echo "OK: 5b services"
test -f src/features/market-research/contracts.ts && echo "OK: 5b contracts"
grep -q 'market-research' src/test/msw/handlers.ts && echo "OK: 5b MSW handlers"
test -f src/features/market-research/components/intelligence/IntelligenceTab.tsx && echo "OK: 5c IntelligenceTab"
test -f src/features/market-research/components/MarketEntrySection.tsx && echo "OK: section at post-5a path"
```
Expected: all OK. If any fails, STOP — a prerequisite is not merged (abort criterion 1). (If 5c relocated the section to a different path, record the actual path and use it throughout — adjust Task 1's `git mv` source.)

- [ ] **Step 3: Green preflight baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight   # or the lighter typecheck+lint+test subset; the final task is the real gate
```
Expected: PASS. RED before any change → STOP (abort criterion 2).

- [ ] **Step 4: Seam audit — confirm the live structure (drives Tasks 2 + 4–N)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
S=src/features/market-research/components/MarketEntrySection.tsx
echo "=== raw LOC ==="; wc -l "$S"
echo "=== commented-out dead block (expect ~1900 // -prefixed lines at the top) ==="; grep -c '^\s*//' "$S"
echo "=== LIVE imports (expect ~line 1971+) ==="; grep -n '^import' "$S"
echo "=== component layers + nested render fns (expect ONE component) ==="; grep -nE 'const MarketEntrySection\b|const MarketEntrySectionComponent\b|const SwotQuadrant\b|const TimelineChart\b|renderCollapsedView|renderExpandedView|renderEditView|export default' "$S"
echo "=== props interface ==="; grep -nE 'interface MarketEntrySectionProps' "$S"
echo "=== live data machinery (MUST exist in the LIVE code — Task 4 removes it) ==="; grep -nE 'fetchMarketEntryData|apiFetchJson|executeWithRateLimit|getUserLocalStorage|fetch\(|useEffect|useRef|useAuth' "$S" | tail -50
```
**Confirmed live structure (verify each against the output; reconcile any drift):**
- **Single layer** — one `const MarketEntrySection: React.FC<MarketEntrySectionProps> = ({ … }) => {` (~2045), `export default MarketEntrySection;` at the end (~3870). **There is no inner `…Component` wrapper** (the commented-out block had a similar shape; do not be confused by it).
- **Props slice consumed (~2007–2042):** view flags `isEditing/isSplitView/isExpanded/hasEdits`, `deletedSections: Set<string>`, `editHistory: EditRecord[]`; **data** `executiveSummary`, `entryBarriers: string[]`, `recommendedChannel`, `timeToMarket`, `topBarrier`, `competitiveDifferentiation: string[]`, `strategicRecommendations: string[]`, `riskAssessment: string[]`; ~17 `on*` callbacks (`onToggleEdit`, `onScoutIconClick`, `onEditHistoryOpen`, `onDeleteSection`, `onSaveChanges`, `onCancelEdit`, `onExpandToggle`, the eight `on<Field>Change`, `onExportPDF`, `onSaveToWorkspace`, `onGenerateShareableLink`); `isRefreshing?`, `companyProfile?: UntypedBackendProfile`.
- **Live data machinery to REMOVE in Task 4 (this is the gnarly part):** `useAuth()` → `{ currentUser, orgId }` (~2080); `fetchMarketEntryData(refresh)` (~2120) = `executeWithRateLimit(() => apiFetchJson("market-research", { method:"POST", body:{ component_name:"Market Entry & Growth Strategy", … } }))`, then hydrates props via the `on*Change` callbacks; **4 `useEffect`** (mount-fetch ~2329 with a `setTimeout`, refresh-on-`isRefreshing`, props-sync ~2410, SWOT-from-localStorage ~2281); **7 `useRef`** (`hasApiDataRef`/`isFetchingRef`/`hasFetchedRef`/`hasTriedSwotFetchRef`/`hasMountedRef`/…); `getUserLocalStorage("marketEntryData")` SWOT fallback (~2295, ~2466); `handleMarketEntryFullSaveChanges` (~2557) does a raw `fetch("/api/ask?…")`. **The hook (Tasks 3–4) replaces the research GET/POST + localStorage-SWOT machinery.** The `/ask` edit-save `fetch` is the **edit-write path** — leaving it as-is (or migrating it) is a 5d-scope call flagged for review (Task 4 / Task N+2); default: keep behavior, do not silently drop it.
- **Edit/UI state to KEEP (moves with the edit form / sub-components):** `useToast`, eight `edit*` fields incl. `editSwotAnalysis`, `deletedSections` handling, `showShareModal`/`shareableLink`. (`isLoading`/`_error`/`marketEntryData` get subsumed by the hook.) The display SWOT reads `displayData.swotAnalysis` (falling back to `editSwotAnalysis`) — **SWOT is not a prop**, it arrives from the fetched data / localStorage / edit state.
- **Render seams (the sub-component list — confirmed live; reconcile if 5c rewired):**
  1. **Header** (`<h2> Market Entry & Growth Strategy` + Edit / Clock(edit-history) / Bot(Scout) / Share buttons; repeated across the loading / empty / collapsed / expanded blocks ~2886/2904/2955) → `MarketEntryHeader.tsx`
  2. **Three KPI cards** (Top Entry Channel = `recommendedChannel` with object-vs-string handling ~3012, Time to Market = `timeToMarket`, Top Barrier = `topBarrier`) → `MarketEntryKpiCards.tsx`
  3. **SWOT display** (`SwotQuadrant` ~2678, 2×2 grid, per-quadrant "No data available"; logic-bearing) → `MarketEntrySwotGrid.tsx`
  4. **Timeline** (`TimelineChart` ~2785 — a **static placeholder** "Q1/Q2/Q3" with no data input; confirm) → `MarketEntryTimeline.tsx`
  5. **Entry barriers** list (`displayData.entryBarriers.map` ~3112) → `MarketEntryBarriers.tsx`
  6. **Competitive differentiation** list (~3127) → `MarketEntryDifferentiation.tsx`
  7. **Strategic recommendations** list (~3145) → `MarketEntryRecommendations.tsx`
  8. **Risk assessment** list (~3161) → `MarketEntryRiskAssessment.tsx`
  9. **Edit form** (`renderEditView`, the large `isEditing` branch ~3169–3820: Executive-Summary/Top-Barrier inputs, Entry-Barriers add/remove ~3346, **inline SWOT editor** ~3411 [there is *no* separate `SwotEditor` const — it's inline add/remove per quadrant], Competitive-Differentiation ~3640, Strategic-Recommendations ~3713, Risk-Assessment ~3786, each with per-section save/delete/Scout affordances) → `MarketEntryEditForm.tsx`, with the inline SWOT editor extracted into `MarketEntrySwotEditor.tsx`
  Plus the non-component artifacts: **`useMarketEntry.ts`** (section hook) and **`types.ts`** (view-model). The three view modes compose these inside the container (the container coordinates `isExpanded`/`isEditing`/loading/empty). Lists 5–8 are near-identical display shells (modulo icon + accent colour), so they may be served by **one parameterized** `MarketEntryBulletList.tsx` (title + icon/accent + items) — collapse them if the live display markup is uniform, keeping one extraction commit per distinct logical block. Record the **final reconciled list**.

- [ ] **Step 5: Confirm the `data` shape for `market entry & growth strategy` (R2 — no static inference)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== 5b captured payload, if present ==="; ls -la e2e/fixtures/api-mocks.ts /tmp/mr-market-entry.json 2>/dev/null
echo "=== how the MSW handler shapes the marketEntry result ==="; grep -n 'market entry\|component_name\|result' src/test/msw/handlers.ts | head
echo "=== field names the live + dead code read off the API (a hint, not the contract) ==="; grep -nE 'apiData\.|swot|executiveSummary|entryBarriers|recommendedChannel|timeToMarket|topBarrier|competitiveDifferentiation|strategicRecommendations|riskAssessment' "$S" | head -40
```
Both the dead block **and the live `fetchMarketEntryData`** map the API to exactly these fields: `executiveSummary`, `entryBarriers`, `recommendedChannel` (string **or** object with a `.channel`), `timeToMarket`, `topBarrier`, `competitiveDifferentiation`, `strategicRecommendations`, `riskAssessment`, and `swot`/`swotAnalysis` (the live code aliases the two) each with `strengths/weaknesses/opportunities/threats` arrays — a strong hint for `types.ts`. The live POST body sends `component_name: "Market Entry & Growth Strategy"` (title-case) and reads `result.data.<camelCase>`; the 5b service sends `RESEARCH_COMPONENTS.marketEntry` (`"market entry & growth strategy"`, lower-case) — **confirm the current backend's actual response casing/envelope against a live/captured payload** before writing `types.ts` (do not assume the old camelCase survives 5b's contract). Source of truth, in order: a captured real payload (5b `/tmp` captures or `e2e/fixtures/api-mocks.ts`) → a live `/docs`/`curl` call → otherwise STOP (abort criterion 3). These fields define `market-entry/types.ts` (Task 3).

No commit (audit only). Record the reconciled seam list + the confirmed `data` fields for Tasks 1–N.

---

## Task 1: Relocate `MarketEntrySection.tsx` into `components/intelligence/market-entry/`

**Files:**
- Move: `frontend/src/features/market-research/components/MarketEntrySection.tsx` → `frontend/src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx`
- Modify: every importer of `MarketEntrySection` (path swap only) — canonically `MarketIntelligenceSections.tsx` and/or `intelligence/IntelligenceTab.tsx` (confirm via grep).

> Spec §2.1, §2.3. Pure relocation in one green commit — content unchanged except its own import paths if any are relative. This establishes the section's landing folder before decomposition. (The `./types` import on the live `import` line is intra-dir; after the move it must point at the leaving `src/components/market-research/types` or a relocated copy — confirm in Step 2.)

- [ ] **Step 1: `git mv` the section into its folder (history preserved)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/market-research/components/intelligence/market-entry
git mv src/features/market-research/components/MarketEntrySection.tsx \
       src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx
```

- [ ] **Step 2: Repoint every importer of `MarketEntrySection`, and the section's own relative imports**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== importers ==="; grep -rln 'market-research/components/MarketEntrySection\|/MarketEntrySection"' src --include=*.ts --include=*.tsx
grep -rl '@/features/market-research/components/MarketEntrySection' src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i 's|@/features/market-research/components/MarketEntrySection|@/features/market-research/components/intelligence/market-entry/MarketEntrySection|g' "$f"
done
grep -rn 'components/MarketEntrySection' src --include=*.ts --include=*.tsx   # backstop — expect: NO output
echo "=== section's own relative imports (e.g. ./types for EditRecord) ==="; grep -n 'from "\.\.\?/' src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx
```
Expected: empty backstop. If the importer used a **relative** path (`./MarketEntrySection`, e.g. from `MarketIntelligenceSections.tsx`), the file moved out of that dir — rewrite that relative import to the new `@/`-aliased path. The section's live `import type { EditRecord } from "./types"` now resolves to a different dir — repoint it to wherever the `types` module actually lives (`@/features/market-research/components/types` or `@/components/market-research/types` if it stayed legacy), confirmed by `tsc` in Step 3.

- [ ] **Step 3: Settle, typecheck, lint, knip, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx knip --strict --no-progress
```
Expected: all PASS (a pure move + path swap cannot change reachability). If `tsc` errors on `./types`, fix the path per Step 2.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate MarketEntrySection into intelligence/market-entry/"
```

---

## Task 2: Delete the commented-out dead copy of the component

**Files:**
- Modify: `…/market-entry/MarketEntrySection.tsx` (delete the leading commented-out block, ~1,970 lines)

> Spec §6 (single-purpose files) + repo dead-code posture (CLAUDE.md "Gotchas" calls out exactly this kind of frontend cruft — e.g. the `~150 lines of commented-out code in ICPManager.tsx`). Roughly the first ~1,970 lines of the raw file are a `// import …`-prefixed prior implementation (an older copy of the same component — note it imports `useAuth` from the pre-promotion `@/contexts/AuthContext`, whereas the live code uses `@/shared/auth`). Deleting it first shrinks the file to its ~1,900 live LOC so the subsequent extractions operate on real code only. Done as its own commit so the dead-code removal is reviewable in isolation and the diff for Tasks 4–N stays clean.

- [ ] **Step 1: Identify the exact boundary between dead block and live code**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
S=src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx
echo "=== first LIVE (non-comment, non-blank) line ==="; grep -nvE '^\s*(//|/\*|\*|$)' "$S" | head -1
echo "=== confirm it is the live import block ==="; grep -n '^import' "$S" | head -1
```
Expected: the first live line is the live `import { … } from "lucide-react";` block (~line 1971 pre-edit). Everything strictly above the first live `import` is the dead block (one contiguous `//`-prefixed run). If the audit shows live code interleaved with comments (it should not), STOP and hand-verify before deleting.

- [ ] **Step 2: Delete the dead block**

Delete from line 1 through the line immediately before the first live `import`. Verify the file now begins with the live imports and still ends with `export default MarketEntrySection;`:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
S=src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx
head -1 "$S"            # expect: a live import line (lucide-react), NOT a // comment
tail -1 "$S"            # expect: export default MarketEntrySection;
grep -c '^\s*//' "$S"   # expect: a handful of genuine inline comments, not ~1900
wc -l "$S"              # expect: ~1900 (down from ~3873)
```

- [ ] **Step 3: Settle, typecheck, lint, knip, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx knip --strict --no-progress
```
Expected: PASS — the deleted block was inert comments; removing it cannot change behavior or reachability. **If `knip` now flags a symbol as unused**, it means a live import was only referenced from the dead block — delete that now-dead import too (do not silence with an ignore).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): delete commented-out dead copy in MarketEntrySection"
```

---

## Task 3: Add the `useMarketEntry.ts` section hook (TDD) + `types.ts`

**Files:**
- Create: `…/market-entry/types.ts`
- Create: `…/market-entry/useMarketEntry.ts`
- Test: `…/market-entry/__tests__/useMarketEntry.test.tsx`

> Spec §6 (section-data hook consuming 5b), §12 R3. This introduces the hook that Task 4 uses to replace the in-component fetch/cache. The hook wraps `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketEntry)` + `useRegenerateResearch`, parses `data` into the section view-model (`types.ts`), and exposes `{ data, isLoading, isError, error, regenerate, isRegenerating }`. TDD: failing test → hook → green. The hook is **created green but not yet consumed by render** — fine; Task 4 wires it. Run the knip gate at Task 4 (not here) if knip transiently flags the unconsumed export.

- [ ] **Step 1: Write `types.ts` from the Task 0/Step 5 confirmed fields**

```ts
import { z } from "zod";

/** Market-entry per-component `data` view-model. Fields confirmed against the
 *  captured "market entry & growth strategy" payload in 5d Task 0 Step 5 (R2 —
 *  not inferred). `.passthrough()` tolerates extra backend fields. The field set
 *  mirrors what the live section renders (the live fetch mapped the same names). */
export const MarketEntrySwotSchema = z
  .object({
    strengths: z.array(z.string()).nullish(),
    weaknesses: z.array(z.string()).nullish(),
    opportunities: z.array(z.string()).nullish(),
    threats: z.array(z.string()).nullish(),
  })
  .passthrough();

export const MarketEntryResultSchema = z
  .object({
    executiveSummary: z.string().nullish(),
    entryBarriers: z.array(z.string()).nullish(),
    recommendedChannel: z.union([z.string(), z.record(z.unknown())]).nullish(),
    timeToMarket: z.string().nullish(),
    topBarrier: z.string().nullish(),
    competitiveDifferentiation: z.array(z.string()).nullish(),
    strategicRecommendations: z.array(z.string()).nullish(),
    riskAssessment: z.array(z.string()).nullish(),
    swot: MarketEntrySwotSchema.nullish(),
    swotAnalysis: MarketEntrySwotSchema.nullish(),
  })
  .passthrough();

export type MarketEntryResult = z.infer<typeof MarketEntryResultSchema>;
export type MarketEntrySwot = z.infer<typeof MarketEntrySwotSchema>;

/** Narrow a generic component response to the market-entry result view-model. */
export function parseMarketEntryResult(
  response: import("@/features/market-research/contracts").ResearchComponentResponse | undefined,
): MarketEntryResult | undefined {
  if (!response?.data) return undefined;
  return MarketEntryResultSchema.parse(response.data);
}
```
> Replace each field with the **actual** keys from the captured payload (the live + dead code used camelCase + a `swot`↔`swotAnalysis` alias; the current backend may use snake_case — confirm and normalize). `recommendedChannel` is sometimes an object in the live code (`channel || JSON.stringify(...)`), hence the union — keep whatever the payload shows.

- [ ] **Step 2: Write the failing hook test (RTL + `QueryClientProvider` + MSW)**

Create `__tests__/useMarketEntry.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useMarketEntry } from "../useMarketEntry";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMarketEntry", () => {
  it("loads + parses the market-entry component for an org", async () => {
    const { result } = renderHook(() => useMarketEntry("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeDefined();
  });

  it("is disabled (no fetch) without an orgId", () => {
    const { result } = renderHook(() => useMarketEntry("user-1", ""), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("exposes a regenerate trigger", () => {
    const { result } = renderHook(() => useMarketEntry("user-1", "org-1"), { wrapper });
    expect(typeof result.current.regenerate).toBe("function");
  });
});
```
> If 5b's MSW handler does not return market-entry-shaped `data` fields, extend the handler in `src/test/msw/handlers.ts` to echo a realistic `"market entry & growth strategy"` payload (keep it in sync with `contracts.ts`/`types.ts`) — commit that handler tweak with this task.

- [ ] **Step 3: Run it red**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/market-entry/__tests__/useMarketEntry.test.tsx
```
Expected: FAIL — `useMarketEntry` does not exist yet.

- [ ] **Step 4: Implement `useMarketEntry.ts`**

```ts
import {
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "@/features/market-research/services/marketResearch";

import { parseMarketEntryResult, type MarketEntryResult } from "./types";

export interface UseMarketEntry {
  data: MarketEntryResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  regenerate: () => void;
  isRegenerating: boolean;
}

/** Section-data hook for the market-entry section. Reads the
 *  "market entry & growth strategy" component via the 5b TanStack hooks
 *  (memory-only cache) and narrows the data to the section view-model.
 *  `userId` is the authenticated user id (the backend `MarketRequest` requires
 *  it); the section supplies it from `useAuth().currentUser?.uid`. */
export function useMarketEntry(userId: string, orgId: string): UseMarketEntry {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketEntry, !!orgId);
  const regen = useRegenerateResearch(userId, orgId);
  return {
    data: parseMarketEntryResult(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    regenerate: () => regen.mutate(RESEARCH_COMPONENTS.marketEntry),
    isRegenerating: regen.isPending,
  };
}
```

- [ ] **Step 5: Run green + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/market-entry/__tests__/useMarketEntry.test.tsx
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS (3 tests).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): add useMarketEntry section hook + market-entry view-model types"
```

---

## Task 4: Adopt the hook + delete the in-component fetch/cache machinery

**Files:**
- Modify: `…/market-entry/MarketEntrySection.tsx` (read server data from `useMarketEntry`; **delete** `fetchMarketEntryData`, the fetch-orchestration `useEffect`/`useRef`s, the localStorage-SWOT cache, and the now-dead legacy imports)

> Spec §6 ("Replace the section's prop slice with hook consumption"), §4.2 (memory-only TanStack; retire raw `fetch`/localStorage cache), §2.3. **This is the heaviest task** — the live section does its own data access (Architecture / Task 0 Step 4), which 5b's page rewire did not reach. Replace it wholesale: `useMarketEntry(userId, orgId)` becomes the single source of the section's server data; the read seams stop coming from props/`marketEntryData`/localStorage and come from `me.data`. **Delete** `fetchMarketEntryData`, the four fetch-orchestration `useEffect`s (mount-fetch + `setTimeout`, refresh-on-`isRefreshing`, props-sync, SWOT-from-localStorage), the seven `useRef`s backing them, the `getUserLocalStorage("marketEntryData")` SWOT fallbacks, and the `marketEntryData`/`_error`/`isLoading` local state the hook now owns. Keep the JSX structure and the edit-mode callbacks for now (sub-components are Tasks 5–N).

- [ ] **Step 1: Resolve `userId`/`orgId` and call the hook**

The live code already gets both ids from `useAuth()` (`const { currentUser, orgId } = useAuth()` from `@/shared/auth`, with a `"brewra"` org fallback). Reuse that exact source (do **not** add `userId`/`orgId` props) so behavior matches — `userId` is `currentUser?.uid` (the backend `MarketRequest` requires it):
```tsx
const me = useMarketEntry(currentUser?.uid ?? "", orgId || "brewra");
```

- [ ] **Step 2: Route the read seams through `me.data`**

Replace the `displayData` derivation (currently merged from `marketEntryData` ⊕ props ⊕ localStorage-SWOT) with a derivation off `me.data`, **preserving the live fallbacks** (e.g. `recommendedChannel` object-vs-string handling ~3012; SWOT display reading `me.data?.swot ?? me.data?.swotAnalysis`, still falling back to `editSwotAnalysis` in edit mode). Render `me.isLoading` → the existing loading block (~2882), no-data → the existing empty state (~2900) whose "Generate Report with Scout" button now calls `me.regenerate` (disabled while `me.isRegenerating`); the header's refresh/regenerate affordance likewise.

- [ ] **Step 3: Delete the dead machinery + its imports**

Remove `fetchMarketEntryData`, the fetch `useEffect`s + `useRef`s, the localStorage-SWOT effects, and the `marketEntryData`/`isLoading`/`_error` `useState`s. Then drop the now-unused legacy imports and confirm:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
S=src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx
echo "=== research fetch + cache gone (expect NO output) ==="; grep -nE 'fetchMarketEntryData|apiFetchJson\("market-research"|executeWithRateLimit|getUserLocalStorage' "$S"
echo "=== research-fetch refs gone (expect 0, or only genuine UI refs) ==="; grep -cE 'useRef\(' "$S"
echo "=== now-dead imports removed (expect NO output) ==="; grep -nE 'apiFetchJson|executeWithRateLimit|getUserLocalStorage' "$S"
```
> **The `/ask` edit-save `fetch`** in `handleMarketEntryFullSaveChanges` (~2607) is the **edit-write path, NOT a research read** — 5d converts the *read* path. Leave that `fetch` exactly as-is this phase (it rides with the edit form into Task 11); migrating the edit-write path to a mutation is **out of 5d scope** — flag it for the reviewer (Task N+2) and, if it should move, log a `TD-FE`. Do **not** silently delete it (that would drop save behavior). If removing the research fetch makes `journeys/04` fail because the section no longer auto-hydrates, that means the hook's `enabled`/auto-fetch is not matching the old mount-fetch — fix the hook wiring, do not re-add the raw fetch.

- [ ] **Step 4: Optionally wrap in a section error boundary**

Wrap the section body in `<FeatureErrorBoundary featureName="Market entry">` (from `@/shared/components`) so a market-entry crash does not blank the whole intelligence tab — warranted now that the section owns a data fetch.

- [ ] **Step 5: Settle, typecheck, lint, test, knip, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/market-entry
npx knip --strict --no-progress
```
Expected: PASS. The section now owns its read data via the hook with no raw research `fetch`/localStorage; the parent may still pass the (soon-removed) data prop slice — fine until Task N+1.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): MarketEntry reads useMarketEntry; remove in-component research fetch + localStorage cache"
```

---

## Tasks 5–N: Extract one focused piece per commit (TDD where logic-bearing)

> Spec §6 (single-purpose files + tests for logic-bearing units), §12 R6. **Run one task per confirmed seam from Task 0 Step 4.** The canonical order below is logic-bearing-first. Each task: (for logic-bearing seams) write a failing RTL test → extract the focused file → wire it into the container/view-mode renderers in the **same commit** → green → **commit**. Trivial presentational shells (KPI cards, the bullet lists, the static timeline, the header) skip the test per §8 ("not every trivial presentational shell"). Each sub-component takes typed props derived from `market-entry/types.ts`; **no sub-component fetches** — the container passes `me.data` slices down.

**General shape for every extraction task (apply per seam):**

- [ ] **Step A (logic-bearing seams only): failing test.** Create `__tests__/<SubComponent>.test.tsx` rendering the sub-component with a fixture slice and asserting its real logic — e.g. SWOT renders all four quadrants and shows "No data available" for an empty quadrant (the live `SwotQuadrant` already does this); the SWOT editor adds/removes items per quadrant; the edit form wires the eight fields to their `on*Change`. Run it red.
- [ ] **Step B: extract.** Cut the seam's JSX (and its pure helpers) from `MarketEntrySection.tsx` into `…/market-entry/<SubComponent>.tsx` as a focused component with explicit typed props; move **ephemeral** UI state local to it where it belongs (the `edit*` fields stay with the edit form). Import types from `./types`.
- [ ] **Step C: wire + green.** Replace the cut JSX in the container/view renderers with `<SubComponent {...slice} />`. Run `npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json` and `npx vitest run src/features/market-research/components/intelligence/market-entry`. Expected: PASS.
- [ ] **Step D: commit** (one per piece):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): extract <SubComponent> from MarketEntrySection"
```

**Concrete task list (reconcile to Task 0 Step 4; one commit each):**

- [ ] **Task 5 — `MarketEntrySwotGrid.tsx`** (logic-bearing — TDD). The display SWOT 2×2 (`SwotQuadrant`); renders all four quadrants, empty-state per quadrant; props `{ swot?: MarketEntrySwot }`. Commit: `refactor(fe): extract MarketEntrySwotGrid from MarketEntrySection`.
- [ ] **Task 6 — `MarketEntrySwotEditor.tsx`** (logic-bearing — TDD). The edit-mode SWOT (today inline JSX inside `renderEditView` ~3411, not a named const); add/remove/change items per quadrant via the existing edit handlers; props `{ value: MarketEntrySwot; onChange: (next: MarketEntrySwot) => void }`. Commit: `refactor(fe): extract MarketEntrySwotEditor from MarketEntrySection`.
- [ ] **Task 7 — `MarketEntryKpiCards.tsx`** (logic-bearing only for the object-vs-string `recommendedChannel` — TDD that case; else trivial). The three KPI cards (`recommendedChannel`/`timeToMarket`/`topBarrier`). Commit: `refactor(fe): extract MarketEntryKpiCards from MarketEntrySection`.
- [ ] **Task 8 — `MarketEntryBulletList.tsx`** (one parameterized list — TDD the empty/non-empty branch once). Backs **Entry barriers / Competitive differentiation / Strategic recommendations / Risk assessment** (props `{ title; icon; accent; items?: string[] }`) **if** the live display markup is uniform; otherwise extract them as four trivial shells (`MarketEntryBarriers`, `MarketEntryDifferentiation`, `MarketEntryRecommendations`, `MarketEntryRiskAssessment`), one commit each. Commit (parameterized path): `refactor(fe): extract MarketEntryBulletList; render barriers/differentiation/recommendations/risk through it`.
- [ ] **Task 9 — `MarketEntryTimeline.tsx`** (trivial today — skip test; the live `TimelineChart` is a static placeholder). Extract as-is; **do not invent data wiring** — preserve exact output. If Task 0 found it actually consumes data, treat as logic-bearing and TDD. Commit: `refactor(fe): extract MarketEntryTimeline from MarketEntrySection`.
- [ ] **Task 10 — `MarketEntryHeader.tsx`** (presentational — skip test unless it branches). Title + Edit/Edit-history/Scout/Share buttons (`onToggleEdit`/`onEditHistoryOpen`/`onScoutIconClick` + Share via `showShareModal`); used by the loading/empty/collapsed/expanded blocks. Commit: `refactor(fe): extract MarketEntryHeader from MarketEntrySection`.
- [ ] **Task 11 — `MarketEntryEditForm.tsx`** (logic-bearing — TDD the field wiring). `renderEditView`: the text inputs for the eight data fields + `<MarketEntrySwotEditor>` + per-section save/delete/Scout affordances; owns the `edit*` local state and calls the parent `on*Change`/`onSaveChanges`/`onCancelEdit`; **keeps the `/ask` edit-save `fetch` unchanged** (out of 5d scope). Commit: `refactor(fe): extract MarketEntryEditForm from MarketEntrySection`.
- [ ] **(reconcile) Add/drop tasks** to match Task 0's confirmed seams (e.g. a `MarketEntryShareModal.tsx` if the share modal is sizeable, a `MarketEntryStates.tsx` for loading/empty if those blocks are large). Drop any task whose block does not exist.

After the last extraction, the container is a thin coordinator over `useMarketEntry` + `isExpanded`/`isEditing` + the sub-components. Sanity:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
wc -l src/features/market-research/components/intelligence/market-entry/MarketEntrySection.tsx   # expect: a small container (~150–250 LOC)
ls src/features/market-research/components/intelligence/market-entry
npx knip --strict --no-progress   # every sub-component reachable from the container; no orphan export
```
Expected: container small; no knip orphans (each sub-component is imported by the container; the container by `MarketIntelligenceSections`/`IntelligenceTab`).

---

## Task N+1: Remove MarketEntry's `MarketIntelligenceTabProps` slice (do NOT delete the interface)

**Files:**
- Modify: `frontend/src/features/market-research/components/MarketIntelligenceTabProps.ts` (drop **only** MarketEntry-exclusive fields)
- Modify: the parent that passes props to `MarketEntrySection` (`MarketIntelligenceSections.tsx` and/or `intelligence/IntelligenceTab.tsx`) — stop forwarding the MarketEntry data slice
- Modify: `…/market-entry/MarketEntrySection.tsx` (drop now-unused prop typing; keep what it still receives)

> Spec §6. MarketEntry is the **first** of five sections to convert (5d) — `MarketIntelligenceTabProps.ts` therefore **stays**; the four remaining sections (RegulatoryCompliance, CompetitorLandscape, IndustryTrends, MarketSize) still consume it. The interface is deleted by the **last** converting section (5h / MarketSize); 5i's dead-code sweep confirms it gone. Remove here **only** the fields that exclusively served MarketEntry's *read* path (the eight data fields, `isRefreshing`, `companyProfile` — now hook-owned, and any `marketEntry*` Scout-panel fields the interface carries). **Keep the edit-mode callbacks** the section still calls (the edit-write path is unchanged in 5d) and any field a sibling section also reads. The shared `MarketIntelligenceTabProps` is large and keys several sections' data + Scout-panel state by name (e.g. `marketEntryLastEditedField`, `showMarketEntryScoutChat`, `onMarketEntryScoutClose`) — those `marketEntry*`-prefixed fields are exclusive and removable.

- [ ] **Step 1: Identify MarketEntry-exclusive vs shared prop fields**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/components/MarketIntelligenceTabProps.ts
echo "=== interface fields ==="; grep -nE '^\s*[a-zA-Z].*[:?]' "$P"
echo "=== who still consumes the interface (must remain) ==="; grep -rln 'MarketIntelligenceTabProps' src --include=*.ts --include=*.tsx
echo "=== marketEntry-named fields (exclusive — removable) ==="; grep -niE 'marketentry|market_entry' "$P"
```
A field is **MarketEntry-exclusive** only if no other section reads it. Cross-section coordination (a global `isEditing`/`isExpanded` shared by all sections, `deletedSections`, generic `onExportPDF`/`onSaveToWorkspace`) **stays**. When in doubt, leave the field (the last section deletes the interface anyway). Note: the props the section reads (`isEditing`, `executiveSummary`, etc.) are passed as a *flat* slice today — confirm whether they are MarketEntry-only or shared before removing each.

- [ ] **Step 2: Drop the exclusive fields + stop forwarding them**

Remove MarketEntry-exclusive fields from `MarketIntelligenceTabProps.ts`. In the parent (`MarketIntelligenceSections.tsx` / `IntelligenceTab.tsx`), stop computing/forwarding the MarketEntry data props to `<MarketEntrySection />` (and remove now-dead fetch-result/loading wiring that fed them, if 5b/5c left any). In `MarketEntrySection.tsx`, delete the corresponding props from its signature — it reads them from `useMarketEntry` now; keep the edit callbacks.

- [ ] **Step 3: Confirm the interface survives + remaining consumers**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/market-research/components/MarketIntelligenceTabProps.ts && echo "OK: interface retained (5h deletes it)"
echo "=== remaining consumers (expect the 4 unconverted sections + composition layer) ==="
grep -rln 'MarketIntelligenceTabProps' src --include=*.ts --include=*.tsx
```
Expected: the file still exists; remaining consumers are the four un-converted sections + `MarketIntelligenceSections`/`IntelligenceTab`; no MarketEntry data slice is forwarded.

- [ ] **Step 4: Settle, typecheck, lint, test, knip, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/market-entry
npx knip --strict --no-progress
```
Expected: PASS. (If knip flags a symbol now-unused because only MarketEntry read it, that confirms the removal — delete the dead symbol; do not silence with an ignore.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): drop MarketEntry slice of MarketIntelligenceTabProps (interface retained for remaining sections)"
```

---

## Task N+2: Final preflight + done-when verification + handoff

**Files:** none (verification only).

- [ ] **Step 1: Full preflight on the branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict).

- [ ] **Step 2: Behavioral parity — `journeys/04` green (spec §6/§8)**

The Playwright run inside Step 1 includes `e2e/journeys/04-market-research-5-components.spec.ts` — the primary guard that decomposition preserved behavior (login → `/your-ai-team/scout/marketintelligence` → the market-entry section renders its content). Confirm it passed. **If it failed**, a sub-component extraction or the fetch→hook swap changed behavior — investigate (a missing `me.data` slice, a dropped prop a sibling still needed, the regenerate handler unwired, the edit form's state lost in extraction, the auto-hydrate no longer firing); fix and re-run. If unfound after investigation, STOP (abort criterion 4). **No `toHaveScreenshot` for market-research** (no MR pixel VR — 5a TD-FE).

- [ ] **Step 3: Diff-shape sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-5d-market-entry
```
Expected: a history-preserving rename of `MarketEntrySection.tsx` into `intelligence/market-entry/`; the dead-block deletion (~1,970 lines gone); the in-component research fetch/cache removed; new `market-entry/` files (`useMarketEntry.ts`, `types.ts`, the sub-components, `__tests__/*`); small edits to the composition parent + `MarketIntelligenceTabProps.ts`; a possible MSW-handler tweak. **No** route/URL change, **no** other section touched, **no** new raw research `fetch`, `MarketIntelligenceTabProps.ts` still present.

- [ ] **Step 4: Walk the done-when (spec §6 "Done when (each)")**

Confirm each, fixing any gap before declaring done:
1. The market-entry section renders from `components/intelligence/market-entry/` as a tree of single-purpose files (container + sub-components + `useMarketEntry.ts` + `types.ts`) reading from hooks.
2. The legacy monolithic `MarketEntrySection.tsx` is gone (it is now the thin container; the ~3.9k-LOC file — half of it dead — no longer exists).
3. The section's unit tests pass (`useMarketEntry` + the logic-bearing sub-components: SWOT grid, SWOT editor, edit form, and any other confirmed logic seam).
4. `journeys/04` (behavioral) + Vitest + `npm run preflight` green — **no MR pixel VR** (spec §6 "visual" → behavioral-E2E + Vitest here, per 5a TD-FE).
5. MarketEntry no longer consumes its `MarketIntelligenceTabProps` read slice and has **no raw research `fetch`/localStorage cache** of its own (Task 4); `MarketIntelligenceTabProps.ts` is **retained** for the four remaining sections (Task N+1).

- [ ] **Step 5: Hand off for review + merge**

Per Spec 24 §10: `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below; approval depth is the orchestrator's call — 5d is the largest-file section and now also completes a missed 5b migration, so it likely warrants a fuller sign-off than the mechanical sub-phases). Then the controller runs `npm run preflight` once more and, on green, merges `phase-5d-market-entry` → `master`. **5e (`24e`, decompose `RegulatoryComplianceSection`) must not begin until 5d is merged** (5e branches off the latest `master` and follows this same per-section pattern — note `RegulatoryComplianceSection` likely has the same self-fetch pattern, so 5e completes its 5b migration too). Flag for the reviewer: (a) the reconciled seam list (Task 0); (b) the confirmed `market entry & growth strategy` `data` shape that `types.ts` parses; (c) that the **edit-write path (`/ask` raw `fetch`) stayed untouched** (5d converted the research *read* path only) — confirm acceptable or schedule for Phase 7/11.

---

## Self-review notes (plan author)

- **Spec coverage:** §6 per-section pattern — container + focused sub-components + section-data hook + local types (Tasks 1–11), prop-slice replacement with `MarketIntelligenceTabProps.ts` **retained** because MarketEntry is the first of five sections (Task N+1), no hard LOC cap / single-purpose files (Tasks 5–11), Vitest+RTL for the hook + logic-bearing sub-components (Tasks 3, 5, 6, 8, 11, §8); §4.2 memory-only / retire raw `fetch`+localStorage (Task 4 — applied to this section, which 5b missed); §6 "Done when (each)" (Task N+2 Step 4); §2.1 target tree (`components/intelligence/market-entry/`); §2.3 mapping (prop-drill → hook; section file → decomposed); §12 R3 (hooks exist from 5b before this section converts) and R6 (narrow per-piece commits; E2E as the executable spec).
- **Grounded in the live file (read 2026-05-30 against the pre-5a copy at `src/components/market-research/MarketEntrySection.tsx`):** the file is 3,873 raw LOC, of which **~1,970 are a commented-out old copy of the component** (an earlier version still importing `useAuth` from `@/contexts/AuthContext`) and **~1,900 are live** (lines ~1971–3870). The live component is **single-layer** (`const MarketEntrySection: React.FC<MarketEntrySectionProps>` ~2045, `export default MarketEntrySection` at the end — *not* a two-layer wrapper, *not* a separate `…Component`). **It is NOT purely presentational:** it still runs its own `fetchMarketEntryData` (`apiFetchJson("market-research", POST)` via `executeWithRateLimit`), 4 `useEffect` + 7 `useRef` of fetch orchestration, `getUserLocalStorage("marketEntryData")` SWOT cache, and a raw `/ask` `fetch` in the edit-save path — i.e. **5b's data-layer migration never reached this section**, so 5d completes it (Task 4 replaces the research fetch/cache with `useMarketEntry`). There is **no separate `SwotEditor` const** — the edit-mode SWOT is inline JSX inside `renderEditView` (extracted into `MarketEntrySwotEditor` in Task 6/11). Render seams confirmed live: header, 3 KPI cards, `SwotQuadrant`, static `TimelineChart`, four bullet lists (barriers / differentiation / recommendations / risk), and the large edit form. `types.ts` field names come from both the live `fetchMarketEntryData` mapping and the dead block (camelCase + `swot`↔`swotAnalysis` alias) — Task 0 re-confirms against the merged tree (5b/5c may have rewired) and the captured payload (R2), since 5b's contract may have changed the casing.
- **Decisions a reviewer should sanity-check:** (a) **Task 2 deletes ~1,970 lines of commented-out code** as its own commit — flagged because it is a large (if inert) deletion; consistent with the repo's dead-code posture (CLAUDE.md Gotchas). (b) **Task 4 deletes the live in-component research fetch + localStorage cache** (the gnarliest change) and routes the read path through `useMarketEntry` — this *completes a 5b migration that missed this file*; abort criterion 5 covers the case where the parent depends on this section hydrating shared props via `on*Change`. (c) The **edit-write path (`/ask` raw `fetch` in `handleMarketEntryFullSaveChanges`) is deliberately left untouched** — 5d converts the research *read* path only; re-routing edits to a mutation is out of scope (flagged for review; candidate `TD-FE`/Phase 7). (d) The four near-identical display bullet lists may collapse into one parameterized `MarketEntryBulletList` — gated on the live markup being uniform (Task 8). (e) `TimelineChart` is a static placeholder today — extracted as-is, not data-wired.
- **Greenness + revertability:** every commit leaves `tsc --noEmit` + `lint` (+ targeted Vitest) green; relocation (Task 1), dead-block deletion (Task 2), the hook (Task 3), the hook-adopt + fetch/cache removal (Task 4), and each extraction (Tasks 5–11) is its own commit, so any single piece reverts without unwinding the section. Task 4 (section owns its data) precedes the prop-slice removal (Task N+1) so the section reads from the hook before the parent stops feeding it.
- **TD / numbering:** 5d logs no new TD-FE by default; the MR-visual-baseline TD-FE (logged in 5a) still governs — no pixel VR added. If Task 0 surfaces an out-of-scope discovery (e.g. a shared transform that belongs in `src/shared/` per the ≥2-feature rule, or the edit-write-path migration), log it as the next free `TD-FE-<n>` (read `docs/TECH_DEBT.md` at execution time) rather than expanding 5d's scope (Phase 11 owns shared promotion).
