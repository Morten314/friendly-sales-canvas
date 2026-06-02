# Frontend Phase 5h — Decompose `MarketSizeSection` (the last section) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the ~1,661-LOC `MarketSizeSection.tsx` into a thin section container + focused single-purpose sub-components + a section-data hook `useMarketSize.ts` + local types, under `src/features/market-research/components/intelligence/market-size/`, reading its data from the 5b hooks instead of the prop-drilled `MarketIntelligenceTabProps` slice. Because MarketSize is **the last of the five sections to convert (5d–5h)**, this plan also **deletes the now-orphaned `MarketIntelligenceTabProps.ts`** — guarded by a no-remaining-consumer grep with a STOP-and-reconcile backstop.

**Architecture:** A decompose-in-place, parity-preserving restructure of one section, staged **relocate-into-folder → add section hook (TDD) → carve one sub-component per real render seam (TDD where logic-bearing, commit per sub-component) → cut the prop slice + delete `MarketIntelligenceTabProps.ts` → preflight**. The current file (verified live 2026-05-30) is a single `MarketSizeSection: React.FC<MarketSizeSectionProps>` (13 `useState`, 5 `useEffect`, 5 `useRef`, 0 `useCallback`/`useMemo`) that **prop-drills** a wide data slice from `MarketIntelligenceSections.tsx` (`executiveSummary`/`tamValue`/`samValue`/`GrowthRate`/`marketEntry`/`strategicRecommendations`/`marketDrivers`/`marketSizeBySegment`/`growthProjections` + `companyProfile` + edit-coordination props `isEditing`/`onSaveChanges`/`on*Change`/`onToggleEdit`/`onRefresh`/`isRefreshing`/`isLoading`/`error`). It holds **its own load path** — `fetchMarketSizeData()` → legacy `executeWithRateLimit(() => apiFetchJson("market-research", { method: "POST", body: { org_id, company_profile } }), "market-research-fetch")` — fired by a `useEffect` on the `isRefreshing` prop's rising edge (it stores the result in `_marketSizeData`, currently *unused* for display; the displayed values come from the drilled props via `getDisplayX()` prop-vs-local switches — and those drilled props are sourced upstream from the page-level `useMarketResearchData()` hook, into which 5c relocated the page's raw-`fetch`/`CACHE_DURATION`-cache/cascade/timestamp machinery verbatim (spec §5 / §9 delta 8). That hook's **market-size slice** — *not* the section-internal `_marketSizeData` — is the live load+cache path this phase must retire per spec §6; it is inventoried in Task 0 Step 6 and removed in Task 4 Step 2). It **also** holds a separate **edit-persistence** path — `handleSave()` → `setUserLocalStorage("market-size_original_json"/"_modified_json", …)` + raw `fetch('/api/ask?…', { method: "GET" })` — which targets a **different** endpoint (`/api/ask`) **not** covered by the 5b `market-research` data layer. The hook `useMarketSize.ts` wraps `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketSize)` + `useRegenerateResearch(userId, orgId)` (the 5b data layer, `userId = currentUser?.uid` from `useAuth()`) and **replaces the `fetchMarketSizeData`/`isRefreshing`-effect load path** (deleting its `executeWithRateLimit`/`apiFetchJson` + the `_marketSizeData`/`isLoadingData`/`_errorData` server-state holders). The **`/api/ask` save path is OUT of 5b's scope** — it stays a section concern in this phase (kept, optionally lifted into a `saveMarketSizeEdits` helper), explicitly NOT routed through `useMarketSize`; its data-layer migration is later work (flag as `TD-FE`). Sub-component markup is moved **byte-for-byte** (className-identical) so behavior + visual stay parity-true. The container keeps the same default-export name `MarketSizeSection` so `MarketIntelligenceSections.tsx` need not change *how* it renders the section — only *where* it is imported from (one path swap), then later *which* props it still passes (Task 4).

**Tech Stack:** React 18 + Vite + TS (strict), `@/` path alias → `src/`, `@tanstack/react-query` (5b hooks), ESLint flat-config (`eslint-plugin-import-x` + 4a resolver + zone/no-cycle rules + transitional legacy-import exception), Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`, 5b handlers), Playwright (behavioral `journeys/04`; **no MR visual snapshots** — see Conventions), knip `--strict`. GNU `sed`/`grep` (linux).

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §6 (and §2.1, §8, §12 R3/R6). Companion plans: `plans/24a-frontend-phase-5a-relocate.md` (relocation conventions), `plans/24b-frontend-phase-5b-data-layer.md` (the data-layer contract this plan consumes), `plans/24c-frontend-phase-5c-page-decomposition.md` (`IntelligenceTab`, the section render path).

**Prerequisite (hard):** **5c merged to `master`** (the section now renders under `components/intelligence/` via `IntelligenceTab`) **AND 5d–5g merged** (MarketEntry, RegulatoryCompliance, CompetitorLandscape, IndustryTrends already converted off `MarketIntelligenceTabProps`, so MarketSize is its **last** consuming section). Task 0 verifies both; if a 5d–5g section still imports `MarketIntelligenceTabProps`, this plan does **not** delete the file (STOP — Task 4). Branch `phase-5h-market-size` off the latest `master`; merges to `master` incrementally; revert is per sub-phase (master §5.7) without unwinding 5a–5g. The transitional legacy-import exception (Phases 4b–12) still applies — the section may import `@/components/ui/*`, `@/lib/*`, `@/hooks/*`, `@/utils/*` during the conversion.

**Conventions for every task:**
- File ops (`mkdir`, `git mv`, `sed`, `grep`, `npm`, `eslint --fix`) run from `frontend/`. `git add`/`git commit` run from the monorepo root `/projects/Brewra/brewra-gtm-intelligence` (so cross-cutting `docs/`/`specs/` paths are includable). There is no root-level `package.json` — all `npm` is in `frontend/`.
- After each change run `npx eslint --fix src` to settle `import-x/order`, then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` must be green before committing. Run the new/affected Vitest files (`npx vitest run <files>`) and, after the deletion, `npx knip --strict --no-progress`.
- Commit messages: `type(scope):` form, **scope `fe`**; **no `Co-Authored-By` footer**; **no `[N/M]`**.
- **Visual-parity guard for ALL of Phase 5 is behavioral E2E (`e2e/journeys/04-market-research-5-components.spec.ts`) + Vitest/RTL + `npm run preflight`.** Market-research has **no** pixel visual-regression baseline (5a logged the TD-FE) and this phase does **not** add one. Do **not** add `toHaveScreenshot` calls for market-research, and do **not** assert `maxDiffPixelRatio` for this surface.
- Move markup **verbatim** (same Tailwind classes, same element order) — class consolidation is out of scope (R4); a sub-component is a cut-line, not a rewrite.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend pushed commits, or revert without sign-off):** the per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
1. 5c is not merged (no `components/intelligence/IntelligenceTab.tsx`) **or** the 5b hooks are absent (Task 0).
2. The Task 0 baseline preflight (or its lighter subset) is RED **before any 5h change**.
3. Decomposing MarketSize reveals coupling beyond this section (e.g. a sub-component genuinely needs state owned by a *sibling* section or the page, not resolvable by lifting into `useMarketSize`/the container) — that is a cross-section concern, not 5h's to force (R3); revert 5h and flag for replan.
4. `MarketIntelligenceTabProps.ts` still has a consumer **other than this section's render path** after Task 1–3 (Task 4's grep is non-empty) — do **not** delete it; record which consumer remains and STOP (it means a 5d–5g section did not actually convert, contradicting the prerequisite).
5. Behavioral `journeys/04` cannot be made green after decomposition and the cause can't be found after investigation (Task 5).

A half-decomposed tree is recoverable from the last green commit; a force-pushed/amended history is not.

---

## Task 0: Branch + green baseline + seam audit (read the real file)

**Files:** none (verification only).

- [ ] **Step 1: Branch off the latest `master` (5c + 5d–5g merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
test -f frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx && echo "OK: 5c merged" || echo "STOP: 5c not merged (abort 1)"
test -f frontend/src/features/market-research/hooks/useMarketResearch.ts && echo "OK: 5b hooks present" || echo "STOP: 5b hooks missing (abort 1)"
git checkout -b phase-5h-market-size
```

- [ ] **Step 2: Confirm 5d–5g converted (MarketSize is the LAST `MarketIntelligenceTabProps` consumer)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== sibling section folders (5d-5g) should exist ==="
for d in market-entry regulatory-compliance competitor-landscape industry-trends; do
  test -d "src/features/market-research/components/intelligence/$d" && echo "OK: $d/ present" || echo "MISSING: $d/ (5d-5g not all merged → abort 1)"
done
echo "=== current MarketIntelligenceTabProps consumers (whole src) ==="
grep -rln "MarketIntelligenceTabProps" src --include=*.ts --include=*.tsx
```
Expected: the four sibling folders exist, and the **only** files referencing `MarketIntelligenceTabProps` are the composition layer (`MarketIntelligenceTabProps.ts` itself + whichever of `MarketIntelligenceSections.tsx` / `MarketIntelligenceTab.tsx` survived 5c) — i.e. the surface this plan removes. If any *other* converted section still imports it, the prerequisite is violated → STOP (abort 4).
> Anchor (measured on the **pre-5a** tree, 2026-05-30 — re-measure post-5c): the type's consumers were `MarketIntelligenceTabProps.ts` (the sole `export interface`), `MarketIntelligenceSections.tsx` (`type … = MarketIntelligenceTabProps`), `MarketIntelligenceTab.tsx`, and `SafeMarketIntelligenceTab.tsx`. The five sections each define their **own** `*SectionProps` and receive a **drilled slice** — they do **not** type-import `MarketIntelligenceTabProps`. 5c removes `SafeMarketIntelligenceTab.tsx` (24c Task 2) and possibly `MarketIntelligenceTab.tsx`; 5d–5g do not remove the umbrella interface (their sections never imported it) — they stop *reading* their slice, but the interface is only deleted here in 5h. So at 5h start, the live consumers should be just the surviving composition file(s); confirm with the grep.

- [ ] **Step 3: Green baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end. If RED **before any 5h change**, STOP and report (abort 2). The lighter subset `npm run typecheck && npm run lint && npm run test` is acceptable for the baseline; Task 5's full preflight is the real gate.

- [ ] **Step 4: Locate the section file + its render path**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== section file (post-5a/5c location) ==="
find src/features/market-research -name 'MarketSizeSection.tsx'
echo "=== who renders <MarketSizeSection …> ==="
grep -rn "MarketSizeSection" src --include=*.tsx | grep -v "MarketSizeSection.tsx:"
echo "=== how the section receives data today (drilled slice) ==="
grep -n "MarketSizeSection" src/features/market-research/components/intelligence/MarketIntelligenceSections.tsx
```
Expected: the section is at `src/features/market-research/components/MarketSizeSection.tsx` (moved by 5a; **not** yet in a `market-size/` folder) and is rendered by `MarketIntelligenceSections.tsx` (pre-5h baseline: the `<MarketSizeSection …/>` element with its drilled props). **Record the exact import path + the prop list passed at the render site** — Task 1 swaps the import path and Tasks 2–4 progressively let the render site stop passing the data slice. If 5c moved/renamed the composition layer differently than `MarketIntelligenceSections.tsx`, use the actual file the grep finds.

- [ ] **Step 5: Seam audit — enumerate the REAL render seams (read the file)**

Read `MarketSizeSection.tsx` end-to-end. The decomposition below is **this plan's breakdown, verified against the live file** (line anchors are a 2026-05-30 measurement — re-confirm; do not trust line numbers after edits). Headings/seams confirmed by grep:

| Seam (render block) | Anchor | Logic-bearing? | Becomes |
|---|---|---|---|
| Section header + title "Market Size & Opportunity" + Modify/Refresh/Scout/edit-mode controls | header @ ~607/700 | light (toggles, fires refresh) | `MarketSizeHeader.tsx` |
| Error banner + loading state | 745 (`bg-red-50`) | none | folds into the container or `MarketSizeHeader` |
| Executive Summary (view + inline edit + save) | 1339 ("Executive Summary"); buffer `localExecutiveSummary`, `handleSaveExecutiveSummary` 288 | edit buffer | `ExecutiveSummaryCard.tsx` |
| Key Metrics — TAM / SAM / Growth metric cards | 861; cards @ 1348/1357/1366; `handleSaveKeyMetrics` 296 | display formatting + edit buffer | `KeyMetricsCards.tsx` |
| Market Size & Opportunity Report / TAM·SAM·Growth chart block | 1393 ("…Report"), 1403 (`bg-green-50`), 1436/1440 ("Market Entry") | chart data shaping | `MarketSizeCharts.tsx` (or fold into KeyMetrics if adjacent — decide while reading) |
| Strategic Recommendations (editable list, add/remove) | 1115 + 1399; buffer `localStrategicRecommendations`, `handleSaveStrategicRecommendations` 306 | list edit | `StrategicRecommendationsCard.tsx` |
| Market Opportunity Breakdown (editable) | 1115 / 1447; `handleSaveMarketOpportunity` 330 | edit buffer | `MarketOpportunityCard.tsx` (or fold into a neighbor if trivially small — decide while reading) |
| Market Size by Segment (table + segment `MiniPieChart`, editable `Record<string,string>` map) | 1454; `MiniPieChart` @ 1461; `localMarketSizeBySegment`, `segmentKeys` 550 | map→rows/slices transform | `MarketSizeBySegment.tsx` |
| Growth Projections (table + `MiniLineChart`, editable `Record<string,string>` map) | 1513; `MiniLineChart` @ 1520; `localGrowthProjections` | map→series transform | `GrowthProjections.tsx` |
| Key Market Drivers (editable list) | 1579; `localMarketDrivers`, `handleSaveMarketDrivers` 541 | list edit | `MarketDriversCard.tsx` |
| Export Options UI + JSON-export / print / shareable-link handlers + Sources modal | UI @ 1303 / 1603; `handleExportData` 487 (JSON Blob download), `handleExportPDF` 518 (`window.print()`), `handleShareableLink` 509 (clipboard); `showSourcesModal` 560 @ 602 | **mostly pure** (JSON serialize/Blob) | `exportMarketSize.ts` (pure JSON-export/share helpers) + `ExportOptions.tsx` (the UI + Sources modal). **NOTE:** the render site also passes `onExportPDF`/`onSaveToWorkspace`/`onGenerateShareableLink` *callbacks* — keep those wired through; the local `handleExport*` are the in-section variants |
| **Load path** (server state): `fetchMarketSizeData` 438 → `executeWithRateLimit(() => apiFetchJson("market-research", {method:"POST", body:{org_id, company_profile}}), "market-research-fetch")`, fired by the `useEffect` on `isRefreshing` (480–485); fills `_marketSizeData`/`isLoadingData`/`_errorData` | 438–485 | **server state** | **deleted** — replaced by `useMarketSize.ts` (Task 2) |
| **Edit-save path** (DIFFERENT endpoint — OUT of 5b scope): `handleSave` 339 → `setUserLocalStorage("market-size_original_json"/"_modified_json")` + raw `fetch('/api/ask?…', GET)` | 339–435 | persistence | **kept** this phase (optionally lifted to a `saveMarketSizeEdits` helper); NOT routed through `useMarketSize`; flag a `TD-FE` for its later migration |

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/components/MarketSizeSection.tsx
echo "=== verify render seams still present (re-anchor) ==="
grep -n "Market Size & Opportunity\|Key Metrics\|Executive Summary\|Strategic Recommendations\|Market Opportunity\|Market Size by Segment\|Growth Projections\|Key Market Drivers\|Export Options" "$P"
echo "=== LOAD path to delete (replaced by useMarketSize) ==="
grep -n "fetchMarketSizeData\|executeWithRateLimit\|apiFetchJson\|isRefreshing\|_marketSizeData\|setMarketSizeData\|isLoadingData" "$P"
echo "=== EDIT-SAVE path (DIFFERENT endpoint /api/ask — kept, NOT 5b) ==="
grep -n "handleSave\b\|setUserLocalStorage\|/api/ask" "$P"
echo "=== export/share/print helpers to extract ==="
grep -n "handleExportData\|handleExportPDF\|handleShareableLink\|URL.createObjectURL\|window.print" "$P"
echo "=== drilled data props the section reads (to source from the hook) ==="
grep -n "executiveSummary\|tamValue\|samValue\|GrowthRate\|marketDrivers\|marketSizeBySegment\|growthProjections\|strategicRecommendations\|companyProfile\|getDisplay" "$P" | head -40
```
Record the finalized sub-component list (you may merge/split from the table above based on what you read — e.g. fold "Market Opportunity Breakdown" or the "Report" chart block into a neighbor if small; keep the `ExportOptions` UI separate from the pure `exportMarketSize` helpers). No commit (audit only).

> **Note on edit buffers + display switch:** the section mirrors each drilled value into a `local*` `useState` (e.g. `localTamValue`, `localStrategicRecommendations`) used while `isEditing`, and reads display values via `getDisplayX()` helpers (522–539: `isEditing ? local* : prop`). After Task 2 the **prop** side of that switch comes from `useMarketSize.data` (not a drilled prop). The `local*` buffers + `editing*` toggles + per-block `handleSave*` are **ephemeral UI** state — keep them local to whichever sub-component owns that block (pass the value + the `on*Change` callback down). Only **server data** (the load payload) and the **refresh action** move into `useMarketSize`; the `/api/ask` edit-save stays a section/container concern. Do not route edit buffers through the hook.

> **`useEffect` inventory (5 effects, verified):** (1) 173 re-init local buffers when entering edit; (2) 202 sync local from props when not editing/just-saved; (3) 480 fire `fetchMarketSizeData` on `isRefreshing` — **this one is deleted in Task 2** (the hook owns fetching); (4) 562 clear local state on user switch; (5) the escape-key handler. Effects (1)(2)(4) are edit-buffer plumbing — they move with the blocks/container; (5) moves with the Sources modal into `ExportOptions`.

- [ ] **Step 6: Inventory the page-level `useMarketResearchData()` market-size slice (the REAL load+cache path)**

The data the section *displays* is drilled in from the page-level `useMarketResearchData()` hook — 5c relocated the page's raw-`fetch`/`useState`/cascade/timestamp/`CACHE_DURATION`-cache machinery into it (spec §5 / §9 delta 8). The section's own `fetchMarketSizeData` (deleted in Task 2) is a *separate, display-unused* load path. Per spec §6, removing **this section's slice** of that page-hook machinery (its raw `fetch` site + its `CACHE_DURATION`/localStorage slice + cascade/timestamp/edit-history) happens **here** in 5h — and because MarketSize is the *last* section, this is the last per-section cleanup before 24i's zero-raw-`fetch` / zero-`CACHE_DURATION` gate. Inventory it now so Task 4 Step 2 can remove it:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
H="$(find src/features/market-research -name 'useMarketResearchData.ts')"   # confirm path (5c location)
echo "=== market-size slice in the page hook: state + fetch + cache + cascade ==="
grep -n "marketData\|market-research\|CACHE_DURATION\|isTimestampNewer\|saveMarketDataToLocalStorage\|setMarketData\|_cb\|_r=" "$H"
echo "=== who reads the market-size slice the shell threads as props ==="
grep -rn "marketData\|tamValue\|samValue\|GrowthRate" \
  src/features/market-research/components/intelligence/IntelligenceTab.tsx \
  src/features/market-research/components/intelligence/MarketIntelligenceSections.tsx 2>/dev/null
```
Record: (a) the exact slice name (likely `marketData` per the §4-amendment six-state list — verify; distinguish from `marketIntelligenceData` if both exist), (b) its fetch/cache/cascade/timestamp/edit-history surface, (c) every shell/tab consumer of the slice. If the slice's state turns out to be genuinely shared with a *sibling* section (not separable into a market-size-only removal), that is abort criterion 3 (cross-section coupling) — STOP and flag rather than force it.

---

## Task 1: Relocate the section into `components/intelligence/market-size/` + rewrite its importer

**Files:**
- Move: `frontend/src/features/market-research/components/MarketSizeSection.tsx` → `frontend/src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx`
- Modify: the composition layer that renders it (`…/intelligence/MarketIntelligenceSections.tsx` per Task 0) — import-path swap only.

> Spec 24 §2.1 (target tree `components/intelligence/market-size/`), §6. Move first, in one green commit, so subsequent sub-component carves happen in the section's final home. The container keeps its default-export name `MarketSizeSection` — only its location changes — so the render site's element stays identical (only the import source changes).

- [ ] **Step 1: `git mv` into the section folder (history preserved)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/market-research/components/intelligence/market-size
git mv src/features/market-research/components/MarketSizeSection.tsx \
       src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx
```

- [ ] **Step 2: Fix the moved file's own relative imports**

The file imports `EditRecord` via `./types` (i.e. `src/features/market-research/components/types.ts`). After the move it is two levels deeper. Repoint that (and any other `./`/`../` relative) to the correct depth or an `@/` path:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx
grep -n 'from "\.\.\?/' "$P"   # list every relative import to fix
# the known one — ./types now lives two dirs up:
sed -i 's|from "./types"|from "../../types"|' "$P"
grep -n 'from "\.\.\?/' "$P"   # re-check: each relative must resolve from the new depth
```
Expected: `../../types` resolves to `src/features/market-research/components/types.ts`. Confirm any other relative import the first grep surfaced is likewise corrected (the `@/`-aliased imports — `@/components/ui/*`, `@/lib/*`, `@/hooks/*`, `@/shared/auth`, `@/utils/cacheUtils` — are depth-independent and need no change).

- [ ] **Step 3: Repoint the render-site import**

In the composition layer (`MarketIntelligenceSections.tsx` per Task 0), change the import source for `MarketSizeSection` to the new folder path:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rl "components/MarketSizeSection\|/MarketSizeSection\"" src --include=*.ts --include=*.tsx | while read -r f; do
  sed -i 's|@/features/market-research/components/MarketSizeSection|@/features/market-research/components/intelligence/market-size/MarketSizeSection|g' "$f"
  sed -i 's|"\./MarketSizeSection"|"./intelligence/market-size/MarketSizeSection"|g' "$f"
  sed -i 's|"\.\./MarketSizeSection"|"../market-size/MarketSizeSection"|g' "$f"
done
echo "=== backstop: no stale MarketSizeSection import path remains ==="
grep -rn "components/MarketSizeSection" src --include=*.ts --include=*.tsx   # expect: empty
```
Expected: empty backstop. Use whichever import form the composition file actually uses (alias vs relative) — the `tsc` in Step 4 is the final catch for a missed path.

- [ ] **Step 4: Settle, typecheck, lint, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS (no behavior change — pure relocation + path swap).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate MarketSizeSection into components/intelligence/market-size/"
```

---

## Task 2: Add the section hook `useMarketSize.ts` (TDD) + delete the raw refresh path

**Files:**
- Create: `frontend/src/features/market-research/components/intelligence/market-size/useMarketSize.ts`
- Create: `frontend/src/features/market-research/components/intelligence/market-size/__tests__/useMarketSize.test.tsx`
- Modify: `…/market-size/MarketSizeSection.tsx` (consume the hook; delete the **load** path — `fetchMarketSizeData` + its `executeWithRateLimit`/`apiFetchJson` + the `isRefreshing` effect + the `_marketSizeData`/`isLoadingData`/`_errorData` state. **Keep** the `/api/ask` edit-save path and its `setUserLocalStorage` — out of 5b scope.)

> Spec 24 §6 (section-data hook consuming 5b), §4.2. The hook wraps the 5b data layer (locked contract in `plans/24b-…` self-review): `useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketSize)` from `@/features/market-research/hooks/useMarketResearch` (`RESEARCH_COMPONENTS.marketSize === "market size & opportunity"`; service fns in `services/marketResearch.ts`; schemas in `contracts.ts`), plus `useRegenerateResearch(userId, orgId)` for the refresh button (`userId = currentUser?.uid` from `useAuth()`). This replaces the section's `fetchMarketSizeData` load path (the `executeWithRateLimit`/`apiFetchJson("market-research", POST {org_id, company_profile})` + the `useEffect` on `isRefreshing`) — same backend operation, now memory-only via TanStack. **It does NOT replace the `/api/ask` edit-save** (`handleSave`) — that endpoint is outside 5b; leave that path intact in this task.

- [ ] **Step 1: Write the failing hook test** (RTL `renderHook` + `QueryClientProvider` + MSW from `src/test/msw/handlers.ts`)

Assert that `useMarketSize(userId, orgId)` returns the parsed market-size component data (from the 5b MSW handler keyed on `component_name`) and exposes a `refresh()` that triggers `useRegenerateResearch`'s mutation (invalidating `qk.marketResearchComponent(orgId, "market size & opportunity")`). Include not-enabled cases (`orgId` empty **or** `userId` empty → query disabled — `userId = currentUser?.uid` is `undefined` when `useAuth()` has no signed-in user, and the backend trusts client-supplied IDs, so an ungated empty `userId` fires a malformed query rather than failing safe). Skeleton:
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { useMarketSize } from "@/features/market-research/components/intelligence/market-size/useMarketSize";
import { makeTestQueryClient } from "@/test/utils"; // use the repo's existing test QC factory; otherwise inline a new QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
);

describe("useMarketSize", () => {
  it("returns parsed market-size component data for an org", async () => {
    const { result } = renderHook(() => useMarketSize("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
    expect(typeof result.current.refresh).toBe("function");
  });
  it("does not fetch when orgId is empty", () => {
    const { result } = renderHook(() => useMarketSize("user-1", ""), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });
  it("does not fetch when userId is empty", () => {
    const { result } = renderHook(() => useMarketSize("", "org-1"), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });
});
```
> If the repo lacks a shared test QueryClient helper, construct one inline (`new QueryClient({ defaultOptions: { queries: { retry: false } } })`) — mirror how the 5b hook test (`hooks/__tests__/useMarketResearch.test.tsx`) sets up its provider.

- [ ] **Step 2: Run it red**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/components/intelligence/market-size/__tests__/useMarketSize.test.tsx
```
Expected: FAIL — `useMarketSize.ts` does not exist.

- [ ] **Step 3: Implement `useMarketSize.ts`**

> **Illustrative, not copy-paste.** The block below is a reference *shape*. Verify 5b's actual exports and `enabled` handling against the live files (next note) before using it; the Step-1 red test is the real contract.

```ts
import {
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "@/features/market-research/services/marketResearch";

/** Section-data hook for the Market Size & Opportunity section (5b data layer).
 *  Wraps the per-component query + the regenerate mutation; memory-only (no localStorage). */
export function useMarketSize(userId: string, orgId: string) {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketSize);
  const regenerate = useRegenerateResearch(userId, orgId);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    /** Force-refresh this section's research (replaces the legacy raw-fetch refresh). */
    refresh: () => regenerate.mutate(RESEARCH_COMPONENTS.marketSize),
    isRefreshing: regenerate.isPending,
  };
}
```
> Confirm the exact 5b export names at execution time (`grep -n "export" src/features/market-research/services/marketResearch.ts src/features/market-research/hooks/useMarketResearch.ts`). The signature is `useResearchComponent(userId, orgId, componentName, enabled?)`; if 5b exposes the optional trailing `enabled` arg, pass it through, but do not re-implement the query here. Two specific mismatches to confirm rather than assume: (1) **`enabled` gating** — if 5b's `useResearchComponent` does *not* internally disable the query on empty `orgId`/`userId`, the Step-1 `does not fetch when orgId is empty` / `does not fetch when userId is empty` tests will go red; make them pass by adding `enabled: !!orgId && !!userId` (via the trailing arg), not by weakening the tests; (2) **`RESEARCH_COMPONENTS` import path** — the reference code imports it from `services/marketResearch.ts`; if 5b exports it from a different module, fix the import to match.

- [ ] **Step 4: Wire the hook into the container; delete the raw refresh path**

The section already reads identity from `useAuth()` (`const { currentUser, orgId } = useAuth()`, with a `"brewra"` fallback); `userId = currentUser?.uid`. Reuse that (or accept `orgId`/`userId` as props if the sibling 5d–5g pattern moved them to props — match them). Call `const marketSize = useMarketSize(userId, orgIdToUse);` and source the displayed values from `marketSize.data` (mapping the parsed `ResearchComponentResponse` payload into the fields the markup reads — the `getDisplayX()` prop-side becomes `marketSize.data`'s `tam`/`sam`/growth/segments/projections/drivers/recommendations). Then **delete the load path only**:
- `fetchMarketSizeData` (438–477) and its `executeWithRateLimit` + `apiFetchJson("market-research", …)` call;
- the `useEffect` on `isRefreshing` (480–485) that called it;
- the `_marketSizeData`/`setMarketSizeData`/`isLoadingData`/`setIsLoadingData`/`_errorData`/`setErrorData` server-state `useState`s the load path filled (131–133);
- the now-unused imports — `import { executeWithRateLimit } from "@/lib/rateLimitManager"` and (if nothing else uses it) `import { apiFetchJson } from "@/lib/api"`; **keep** `setUserLocalStorage` from `@/utils/cacheUtils` (the `/api/ask` save still uses it);
- wire the refresh control to `marketSize.refresh` and the loading UI to `marketSize.isLoading`/`marketSize.isRefreshing`. The `onRefresh`/`isRefreshing`/`isLoading`/`error` props become removable in Task 4 (the hook owns them); for now you may keep accepting them while wiring.

**Do NOT touch** `handleSave` / the `/api/ask` `fetch` / its `setUserLocalStorage("market-size_*_json")` calls — that edit-save path is out of 5b's scope and stays. Keep the **edit-buffer** `local*` state, the `getDisplayX` helpers, `editing*` toggles, and per-block `handleSave*` untouched in this task (they move with their blocks in Task 3). Backstop:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx
echo "=== load path gone (expect empty) ==="; grep -n "fetchMarketSizeData\|executeWithRateLimit\|apiFetchJson\|setMarketSizeData" "$P"
echo "=== edit-save path INTACT (expect handleSave + /api/ask + setUserLocalStorage still present) ==="; grep -n "handleSave\b\|/api/ask\|setUserLocalStorage" "$P"
```
Expected: the first grep empty (load path removed, hook owns fetching); the second still showing `handleSave`, `/api/ask`, and `setUserLocalStorage` (the kept edit-save).

- [ ] **Step 5: Green + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/market-size
```
Expected: PASS (hook test green; section typechecks against `useMarketSize`).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): add useMarketSize hook; remove MarketSizeSection raw fetch/localStorage refresh"
```

---

## Task 3: Carve the sub-components (one task-step + one commit per real sub-component)

**Files (created under `…/intelligence/market-size/`, finalized in Task 0 Step 5):**
- `MarketSizeHeader.tsx`, `ExecutiveSummaryCard.tsx`, `KeyMetricsCards.tsx`, `StrategicRecommendationsCard.tsx`, `MarketSizeCharts.tsx` (if not folded), `MarketSizeBySegment.tsx`, `GrowthProjections.tsx`, `MarketDriversCard.tsx`, `MarketOpportunityCard.tsx` (if not folded), `ExportOptions.tsx`
- `exportMarketSize.ts` (pure JSON-export/share helpers) + `__tests__/exportMarketSize.test.ts`
- `types.ts` (section-local props/value types) — created on first need
- Modify each commit: `MarketSizeSection.tsx` (replace the lifted block with `<SubComponent …/>`)

> Spec 24 §6 ("focused presentational sub-components", "no hard LOC cap", "Vitest + RTL for the section's hook + logic-bearing sub-components"), §8. **One sub-component per commit**, each leaving `tsc`+`lint`+Vitest green. Move markup **verbatim** (R4 — same classes/order). Pass each block its data + edit-buffer state + `on*Change`/`handleSave*` callback as props (or let the leaf own its own ephemeral edit buffer, lifted from the container, when nothing else reads it). The container shrinks toward a thin composition of `<…/>` children fed by `useMarketSize`.

**Order (low-risk → higher):** extract the **pure logic first** (testable in isolation), then the simplest presentational leaves, then the chart/table blocks.

- [ ] **Step A — `exportMarketSize.ts` (pure helpers, TDD)**
  - The section's export logic (verified) is: `handleExportData` (487) — serialize the section data to JSON, build a `Blob`, `URL.createObjectURL`, `<a download>` click, `revokeObjectURL` (a JSON file download, **no CSV**); `handleShareableLink` (509) — `navigator.clipboard.writeText(...)`; `handleExportPDF` (518) — `window.print()`.
  - Write `__tests__/exportMarketSize.test.ts` first: feed a known section payload to a pure `buildMarketSizeExportJson(data)` and assert the JSON shape; for the download helper, mock `URL.createObjectURL`/`document.createElement` and assert a Blob+anchor is produced with `download === "market-size-analysis.json"`; the print/clipboard helpers are environment-driven — test only the data-shaping part, keep the `window.print()`/`clipboard` call thin.
  - Run red. Then move `handleExportData` (487) into `exportMarketSize.ts` split as a **pure** `buildMarketSizeExportJson(data)` + a thin `downloadMarketSizeJson(data)`; move `handleShareableLink` (509) and `handleExportPDF` (518) as small helpers taking their inputs as args (no closures over component state). Re-wire the section/`ExportOptions` to call them.
  - Green: `npx vitest run …/market-size/__tests__/exportMarketSize.test.ts`. Commit: `refactor(fe): extract pure JSON-export/share helpers from MarketSizeSection (exportMarketSize)`.

- [ ] **Step B — `ExportOptions.tsx`** — lift the "Export Options" UI (1303 / 1603) + the Sources modal (`showSourcesModal` 560, rendered @ 602) into a presentational component that takes the section data + the (now-pure) `exportMarketSize` helpers + the passed-through `onExportPDF`/`onSaveToWorkspace`/`onGenerateShareableLink` callbacks. Keep its `showSourcesModal` + escape-key `useState`/effect local to it. Commit: `refactor(fe): extract ExportOptions from MarketSizeSection`.

- [ ] **Step C — `MarketSizeHeader.tsx`** — title "Market Size & Opportunity" + Modify/Refresh/edit-mode controls (~700); takes `editMode`/`onEditModeChange`, `onRefresh` (= `marketSize.refresh`), `isRefreshing`. Commit: `refactor(fe): extract MarketSizeHeader from MarketSizeSection`.

- [ ] **Step D — `ExecutiveSummaryCard.tsx`** (+ fold `MarketOpportunityCard` here if Task 0 found it trivially adjacent; else a separate `MarketOpportunityCard.tsx`) — the Executive Summary / Market Opportunity view+edit blocks; owns its `localExecutiveSummary`/`editingExecutiveSummary` buffer + `handleSaveExecutiveSummary`. Commit: `refactor(fe): extract ExecutiveSummaryCard from MarketSizeSection`.

- [ ] **Step E — `KeyMetricsCards.tsx` (TDD — display logic)** — the TAM/SAM/Growth metric cards (861; the three value cards @ 1348/1357/1366), driven by `getDisplayTamValue`/`getDisplaySamValue`/`getDisplayGrowthRate` (the `isEditing ? local : prop` switch). Move whatever value-formatting/empty-fallback the cards apply with the block; a small RTL test asserts a sample `{tam,sam,growth}` renders the figures and an empty value degrades gracefully. Commit: `refactor(fe): extract KeyMetricsCards from MarketSizeSection (with display test)`.

- [ ] **Step F — `StrategicRecommendationsCard.tsx` (TDD — list edit)** — the editable recommendations list (1115; `localStrategicRecommendations`, add/remove, `handleSaveStrategicRecommendations`); RTL test asserts add/remove mutates the local list and save fires the callback. Commit: `refactor(fe): extract StrategicRecommendationsCard from MarketSizeSection`.

- [ ] **Step G — `MarketDriversCard.tsx` (TDD — list edit)** — the editable Key Market Drivers list (1579; `localMarketDrivers`, `handleSaveMarketDrivers`); RTL test mirrors Step F. Commit: `refactor(fe): extract MarketDriversCard from MarketSizeSection`.

- [ ] **Step H — `MarketSizeBySegment.tsx` (TDD — map→rows transform)** — Market Size by Segment table + segment pie (1454; `localMarketSizeBySegment` `Record<string,string>`, `MiniPieChart`, editable map); test the `Record`→table-rows / pie-slices transform with a sample map (and an empty map). **Test contract (input → expected):** `{ "Enterprise": "40%", "SMB": "35%", "Startup": "25%" }` → 3 table rows + 3 pie slices, label/value preserved and order stable; `{}` → empty table + the no-data fallback rendered, **no thrown error**. Commit: `refactor(fe): extract MarketSizeBySegment from MarketSizeSection`.

- [ ] **Step I — `GrowthProjections.tsx` (TDD — map→series transform)** — Growth Projections table + line chart (1513; `localGrowthProjections`, `MiniLineChart`, editable map); test the `Record`→series transform. **Test contract (input → expected):** `{ "2024": "10", "2025": "14", "2026": "19" }` → 3 ordered points (x = year, y = numeric value), order stable; `{}` → empty series, chart renders with no points and **no thrown error**. Commit: `refactor(fe): extract GrowthProjections from MarketSizeSection`.

- [ ] **Step J — `MarketSizeCharts.tsx`** — the "Market Size Analysis / TAM·SAM·Growth" chart block (1393/1399) if it is distinct from KeyMetrics/Segment/Projections after the carves above; otherwise note it was absorbed and skip (record the decision). Commit (if created): `refactor(fe): extract MarketSizeCharts from MarketSizeSection`.

**After each step (every sub-component):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research/components/intelligence/market-size
```
Expected: PASS before the step's commit. If a block needs sibling-section or page state to render (not just MarketSize's own data/edit buffers), that is abort criterion 3 — STOP and flag, do not invent a cross-section prop.

> **Container end-state:** `MarketSizeSection.tsx` is a thin composition — `const marketSize = useMarketSize(userId, orgId)` (`userId = currentUser?.uid` from `useAuth()`) + the `<…/>` children, passing data slices + edit buffers + save callbacks. Keep its default export `MarketSizeSection` and the props the render site still passes (e.g. `editMode`/`onEditModeChange`/`companyProfile`/`orgId`) until Task 4 trims the drilled **data** slice.

---

## Task 4: Cut the prop slice + DELETE `MarketIntelligenceTabProps.ts` (no-remaining-consumer guard)

**Files:**
- Modify: `…/market-size/MarketSizeSection.tsx` (drop the now-unused drilled **data** props from `MarketSizeSectionProps`)
- Modify: the composition layer (`MarketIntelligenceSections.tsx` / `MarketIntelligenceTab.tsx`) — stop drilling MarketSize's data slice; drop its `MarketIntelligenceTabProps` import once nothing in the file uses the type.
- Modify: `frontend/src/features/market-research/hooks/useMarketResearchData.ts` (confirm path) — remove the market-size slice (its raw `fetch` + `CACHE_DURATION`/cache + cascade/timestamp/edit-history) and update its return surface + every consumer found in Task 0 Step 6.
- **Delete:** `frontend/src/features/market-research/components/MarketIntelligenceTabProps.ts` (its post-5a location — confirm path)

> Spec 24 §6 ("`MarketIntelligenceTabProps.ts` is deleted when its last consuming section converts (≤ 5h); 5i's dead-code sweep confirms it is gone"), §2.3. MarketSize is the **last** section, so once its data comes from `useMarketSize`, the prop-drilling interface has **no live consumer** and is deleted here. **Guarded:** delete only if the grep shows no remaining importer.

- [ ] **Step 1: Trim MarketSize's drilled data props**

In `MarketSizeSection.tsx`, remove the data fields now sourced from `useMarketSize` from `MarketSizeSectionProps` and the destructure (`tamValue`/`samValue`/`GrowthRate`/`marketEntry`/`executiveSummary`/`marketDrivers`/`marketSizeBySegment`/`growthProjections`/`strategicRecommendations`/the `*Sources` set/`reportData`). **Keep** non-data props the render site still owns (`editMode`/`onEditModeChange`/`companyProfile` if used as the `orgId` source/`refreshKey`/`onDataRefresh`/`isLoading`) — or replace `refreshKey`/`onDataRefresh` with the hook's own refresh if the parent no longer coordinates it (decide from how 5d–5g handled it; match the sibling pattern). Then in the composition layer, stop passing the removed props to `<MarketSizeSection …/>`.

- [ ] **Step 2: Remove (or consciously drop / document-defer) the market-size slice from `useMarketResearchData()`**

This is the spec-§6 per-section data-layer cleanup that MUST land in 5h (the last section). With the composition layer no longer threading the market-size slice (Step 1) and the section now reading `useMarketSize.data` (Task 2), the page hook's market-size slice (inventoried in Task 0 Step 6 — `marketData` or as found) has **no live consumer**. Remove it from `useMarketResearchData.ts`: its raw `fetch(... "market-research" ...)` site, its `CACHE_DURATION`/localStorage slice (`save*ToLocalStorage` + the `?_cb&_r` cache-bust for this slice), and its cascade/timestamp/edit-history handling — **migrating** any still-needed behavior into `useMarketSize`/the section, or **consciously dropping** it per spec §6. Update the hook's return surface and every shell/tab consumer found in Task 0 Step 6 so they stop reading the removed slice.

**Deferral fallback (documented, not silent):** if the slice's cascade/timestamp/edit-history is entangled with a sibling section's state and cannot be cleanly severed here, do **not** force it — that is abort criterion 3 territory. Instead leave the slice in place and (a) record in the Task 5 §9 delta exactly what remains and why, and (b) flag it for 5i so its dead-code sweep removes it. Removal is the default; deferral requires the written rationale.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
H="$(find src -name 'useMarketResearchData.ts')"
echo "=== market-size slice gone from the page hook (expect empty, OR documented-deferred) ==="
grep -n "marketData\|saveMarketDataToLocalStorage\|setMarketData" "$H"
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research
```
Expected: the grep empty (slice removed) unless deferral was documented; `tsc`/Vitest green (the hook's consumers no longer read the slice).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): remove market-size raw fetch/cache slice from useMarketResearchData (5b conversion)"
```

- [ ] **Step 3: Drop the `MarketIntelligenceTabProps` import where it is now unused**

`MarketIntelligenceTabProps.ts` exports **exactly one** symbol — `export interface MarketIntelligenceTabProps` (verified; it *imports* `EditRecord`/`TrendSnapshot`/`IndustryTrendsRecommendations` from `./types` but **re-exports nothing**), so there is no co-exported type to relocate. Its consumers (pre-5h baseline, whole `src`) are: `MarketIntelligenceSections.tsx` (`type MarketIntelligenceSectionsProps = MarketIntelligenceTabProps`), `MarketIntelligenceTab.tsx`, and `SafeMarketIntelligenceTab.tsx`. **`SafeMarketIntelligenceTab.tsx` is removed by 5c** (24c Task 2) and `MarketIntelligenceTab.tsx` may be too (if it was only the Safe-wrapper inner shell) — so at 5h the live consumers should be just `MarketIntelligenceSections.tsx` (+ `MarketIntelligenceTab.tsx` if 5c kept it). Re-confirm the actual post-5c set at execution time (Task 0 Step 2 grep). In whichever composition file(s) remain, once no section needs a drilled data slice (all five self-fetch), reduce that file's prop surface to the non-data props it still passes (`isEditing`/`on*`/edit-coordination + `companyProfile`/orgId-ish) and remove its `import type { MarketIntelligenceTabProps } from "./MarketIntelligenceTabProps"` line. If 5c already made `IntelligenceTab` the data owner and the umbrella `MarketIntelligenceTabProps` object is fully dead, the composition file can drop the type entirely.

- [ ] **Step 4: THE GUARD — confirm no remaining consumer, then delete**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== locate the file (post-5a path) ==="
find src -name 'MarketIntelligenceTabProps.ts'
echo "=== any remaining reference to the type (excluding the file's own definition line) ==="
grep -rn "MarketIntelligenceTabProps" src --include=*.ts --include=*.tsx | grep -v "MarketIntelligenceTabProps.ts:"
```
**STOP condition (abort 4):** if that grep prints **anything**, a consumer remains — do **NOT** delete the file. Record the remaining importer and either (a) convert it here if it is a genuine MarketSize-adjacent leftover (e.g. the composition file still typed by the umbrella object — finish reducing it in Step 3), or (b) STOP and report that the prerequisite (5d–5g converted) is not actually satisfied — a *section* still drilling its slice means that section did not convert. Do not force the deletion to make the grep pass.

If the grep is empty:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
git rm "$(find src -name 'MarketIntelligenceTabProps.ts')"
```
> The file has a **single export** (the `MarketIntelligenceTabProps` interface), so there is no orphaned co-export to rescue — once `grep` is empty the `git rm` is safe and `tsc` (Step 4) is the final proof nothing referenced it.

- [ ] **Step 5: Green (incl. knip) + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/market-research
npx knip --strict --no-progress
```
Expected: PASS — `tsc` proves nothing references the deleted file/props; `knip --strict` confirms no newly-orphaned export (the prop-drilling surface is gone). **If knip flags** a now-unused export in the composition layer (e.g. a helper that only fed the drilled props), remove it here (it is genuinely dead) rather than masking it.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): drop MarketSize prop slice; delete MarketIntelligenceTabProps (last consumer converted)"
```

---

## Task 5: Final preflight + done-when + deltas + handoff

**Files:** `specs/24-frontend-phase-5-market-research-design.md` (§9 delta) as needed.

- [ ] **Step 1: Full preflight on the branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict). If `format:check` flags the new files, run `npm run format` and re-check (do **not** prettier `docs/TECH_DEBT.md` — out of scope here).

- [ ] **Step 2: Behavioral parity — `journeys/04` green (spec §8)**

The Playwright run inside Step 1 includes `e2e/journeys/04-market-research-5-components.spec.ts`. Confirm the market-size surface still renders on `/your-ai-team/scout/marketintelligence` (the section's components mount; the refresh still POSTs `component_name: "market size & opportunity"` — now via the hook/service). **If it reds**, investigate the decomposition (a lifted block missing data, a wrong hook wiring, a removed-prop the render site still passes); fix and re-run. If the cause is deep cross-section coupling, invoke abort criterion 3 (revert 5h, replan — master §5.7) rather than fix-forward. If unclear after investigation, STOP (abort 5).

- [ ] **Step 3: Diff-shape sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-5h-market-size
```
Expected: a history-preserving rename of `MarketSizeSection.tsx` into `…/intelligence/market-size/`; several **new** sub-component + hook + `exportMarketSize.ts` + test files under `market-size/`; the shrunk container; small edits to the composition layer; the **deletion** of `MarketIntelligenceTabProps.ts`; optional `specs/24` delta. **No** route/URL changes, **no** new raw `fetch`, **no** `toHaveScreenshot` for market-research.

- [ ] **Step 4: Walk the done-when (spec §6 "Done when (each)")**

Confirm each, fixing any gap before declaring done:
1. MarketSize renders from `components/intelligence/market-size/` as a tree of single-purpose files reading from hooks (`useMarketSize` → 5b). (Tasks 1–3)
2. The legacy monolithic `MarketSizeSection.tsx` is gone **as a monolith** — it survives only as the thin container in the new folder. (Tasks 1–3)
3. The section's unit tests pass (hook + logic-bearing sub-components + `exportMarketSize`). (Tasks 2–3)
4. `MarketIntelligenceTabProps.ts` is **deleted** with no remaining consumer (5i's sweep re-confirms). (Task 4)
5. The page-level `useMarketResearchData()` market-size slice (raw `fetch` + `CACHE_DURATION`/cache + cascade/timestamp/edit-history) is **removed** — or, if consciously deferred, documented in the §9 delta with a 5i handoff. No market-size raw `fetch`/cache remains in the feature. (Task 4 Step 2)
6. `journeys/04` E2E + Vitest + `npm run preflight` green. (Steps 1–2)

- [ ] **Step 5: Spec 24 §9 delta + handoff**

Append a dated Spec 24 §9 note: "5h decomposed `MarketSizeSection` into `components/intelligence/market-size/` (container + sub-components + `useMarketSize` over 5b) and — as the last consuming section — **deleted `MarketIntelligenceTabProps.ts`** (single-export interface, no remaining importer). The prop-drilling interface (§1.2/§2.3) is fully retired; 5i's dead-code sweep re-confirms. Also removed the **market-size slice** from the page-level `useMarketResearchData()` hook (its raw `fetch`/`CACHE_DURATION`-cache/cascade/timestamp/edit-history) — the deferred-half data-layer cleanup spec §6 assigns to each section sub-phase; as MarketSize is the last section, the page hook now holds no market-size raw `fetch`/cache (24i re-confirms zero raw `fetch` / zero `CACHE_DURATION`). *(If the slice was instead document-deferred per the Task 4 Step 2 fallback, record here exactly what remained, why, and the 5i handoff.)* Also: the section's `/api/ask` edit-save path is a different endpoint outside 5b's `market-research` data layer — kept this phase and logged as a `TD-FE` for later migration (with the lead-stream/Phase-7 data work)." Commit `docs(spec-24): record 5h MarketSize decomposition + MarketIntelligenceTabProps deletion`.

> If you log the `/api/ask` TD-FE, append it surgically to `docs/TECH_DEBT.md` at the next free `TD-FE-<n>` (read it at execution time) — **do not** run prettier on `docs/TECH_DEBT.md` (it is outside the frontend prettier gate and prettier corrupts its markdown). Commit it separately: `chore(fe): log TD-FE for market-size /api/ask edit-save migration`.

Then `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below; approval depth is the orchestrator's call — §10). On green, the controller runs `npm run preflight` once more and merges `phase-5h-market-size` → `master`. **5i (`24i`) is next: finalize `index.ts` public surface + `README.md` + the dead-code sweep that re-confirms `MarketIntelligenceTabProps.ts` is gone.** Flag for the reviewer: (a) the finalized sub-component breakdown (Task 0 Step 5 vs what shipped); (b) the `MarketIntelligenceTabProps` deletion (single export, guarded); (c) the kept `/api/ask` edit-save + its TD-FE; (d) any block that needed an `orgId`/`companyProfile` prop because the container lacked a direct tenant source; (e) the `useMarketResearchData()` market-size slice removal (or its documented deferral + 5i handoff) and whether any cascade/timestamp/edit-history behavior was migrated vs consciously dropped.

---

## Self-review notes (plan author)

- **Spec coverage:** §6 per-section pattern — section container + focused sub-components + section-data hook consuming 5b + local types (Tasks 1–3); replace the section's `MarketIntelligenceTabProps` slice with hook consumption + delete the file at the last consumer (Task 4); remove the page-level `useMarketResearchData()` market-size raw-`fetch`/`CACHE_DURATION`-cache/cascade slice as the section converts — the §6 "delete the page's raw fetch/cache for this section" half (Task 0 Step 6 inventory → Task 4 Step 2); no hard LOC cap, file breakdown is this plan's decision (Task 0 Step 5 / Task 3); Vitest + RTL for the hook + logic-bearing sub-components (Tasks 2–3, §8); §6 "Done when" (Task 5 Step 4); §2.1 target tree `components/intelligence/market-size/` (Task 1); §9 delta (Task 5); R3 prop-drilling blast radius (one section, hook-first via 5b — Tasks 2–4 + abort 3); R6 agent-context-bounded carves (per-sub-component commits — Task 3).
- **Verified against the live file (2026-05-30), not assumed:** the section is a single `React.FC<MarketSizeSectionProps>` (13 `useState`, **5** `useEffect`, 5 `useRef`) that **defines its own props** and does **not** type-import `MarketIntelligenceTabProps` — the umbrella type's only consumers are `MarketIntelligenceTabProps.ts` (the **sole** `export interface`, no co-exports), `MarketIntelligenceSections.tsx` (`type … = MarketIntelligenceTabProps`), `MarketIntelligenceTab.tsx`, `SafeMarketIntelligenceTab.tsx` (the last two pruned by 5c). MarketSize is rendered by `MarketIntelligenceSections.tsx`, which drills the full data slice (confirmed at the render site). **Two distinct data paths, handled differently:** (1) the **load** path `fetchMarketSizeData` (438) → `executeWithRateLimit(()=>apiFetchJson("market-research", POST {org_id, company_profile}), "market-research-fetch")` fired by the `useEffect` on `isRefreshing` (480) — this is what `useMarketSize`/5b **replaces** (deleted Task 2); (2) the **edit-save** path `handleSave` (339) → `setUserLocalStorage("market-size_*_json")` + raw `fetch('/api/ask?…', GET)` — a **different endpoint outside 5b**, **kept** this phase and flagged as TD-FE. Real seams (verified by heading/chart/handler greps): header, Executive Summary, Key Metrics (TAM/SAM/Growth cards via `getDisplayX`), Strategic Recommendations, Market Opportunity Breakdown, Market-Size-Report chart block, Market Size by Segment (table + `MiniPieChart`), Growth Projections (table + `MiniLineChart`), Key Market Drivers, Export Options + Sources modal. Export helpers are **JSON-download + clipboard + `window.print()`** (`handleExportData` 487 / `handleShareableLink` 509 / `handleExportPDF` 518) — **there is no CSV** in this section.
- **Deletion is guarded, not assumed:** Task 4 deletes `MarketIntelligenceTabProps.ts` only behind a no-remaining-consumer grep with an explicit STOP (abort 4). The file has a **single export** (the interface) — no co-export to rescue, so the deletion is clean once `grep` is empty; `tsc`+`knip` are the final proof. The prerequisite (5d–5g converted, MarketSize is the last consumer) is re-checked in Task 0 Step 2, not trusted blindly.
- **Locked-contract fidelity:** consumes the exact 5b identifiers from `plans/24b-…` (`useResearchComponent`, `useRegenerateResearch` from `@/features/market-research/hooks/useMarketResearch`; `RESEARCH_COMPONENTS.marketSize === "market size & opportunity"`; `services/marketResearch.ts`; `contracts.ts`) — no new fetch, no second rate-limiter; folder/commit/scope conventions (`type(fe):`, no `Co-Authored-By`, no `[N/M]`) per 24a/24b. **Visual guard = behavioral E2E + Vitest/RTL + preflight only; no market-research pixel VR / `toHaveScreenshot`.**
- **Greenness + revertability:** every commit leaves `tsc`+`lint`+Vitest green; one sub-component per commit (per-sub-component revert); the whole sub-phase reverts to the prior 5a–5g commit without unwinding them. Edit-buffer `useState`/`getDisplayX`/`editing*` toggles stay ephemeral-local (not routed through the hook); only the **load** server state + the refresh action move to `useMarketSize` — the `/api/ask` edit-save path is deliberately left in place (out of 5b's scope, TD-FE flagged), so this phase does not silently change how edits persist.
- **Line anchors are a point-in-time aid:** every line number is a 2026-05-30 measurement; tasks re-anchor by grep before editing and never trust a number after a prior edit in the same task.
