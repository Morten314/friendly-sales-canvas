# Frontend Phase 5c — market-research page decomposition (structural-only, hook-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **REWRITTEN 2026-05-31 after the R1 escape hatch fired a SECOND time (event #2).** The prior version (delta 7, structural-only) assumed the page's data layer could move **into `IntelligenceTab`**. When implementation began, the Task-1 implementer + a verified read-only inventory (`docs/reviews/24c-frontend-phase-5c-data-layer-inventory.md`) found the data layer is **shell-coupled** — `marketData`/`isRefreshing`/`isInitialLoading` are read by shell chrome (status banners, the `isRefreshing` loading-gate + refresh `Dialog`) and `editHistory` is read by the **trends** tab — so it **cannot** live inside one tab. The R1 hatch fired; no impl commits existed to revert. The human elected to **re-cut hook-first** (Spec 24 §9 delta 8). This plan is rewritten to match. **`docs/reviews/24c-…-plan-review-{1,2}.md` critiqued the pre-R1 plan and `-3,-4` critiqued the (now-superseded) into-`IntelligenceTab` delta-7 plan; review of this document resumes fresh.**

**Goal:** Break `MarketResearchPage.tsx` (7,013 LOC, ~76 `useState`, 9 raw `fetch`, ~24 `useEffect`) into a **`useMarketResearchData()` data-layer hook + a thin routed shell + per-tab containers** — **without rewiring the data layer to TanStack**. The page's existing raw-`fetch` + `useState` server-data flow (editable/cascade/timestamp state, not plain server cache — TD-FE-19) is **extracted UNCHANGED into one custom hook**; the shell calls it once and threads slices to the tabs as props; per-section TanStack conversion of the hook's internals is deferred to 5d–5h. Replace the bespoke `SafeMarketIntelligenceTab` wrapper with `<FeatureErrorBoundary>` **while preserving its prop-sanitization**, and **extract the inline `analysis` (lead-stream) tab into the self-contained legacy unit** at `src/components/market-research/lead-stream/` (annotated → customers/Phase 7), injecting its cross-tab/nav/Strategist coordination as **shell-owned callback props** so the legacy unit imports no feature code.

**Architecture (hook-first):**
- `useMarketResearchData()` (`hooks/useMarketResearchData.ts`) — the page's market-research **data layer**, extracted as-is: the six editable data `useState`s (`marketData`, `marketIntelligenceData`, `industryTrendsData`, `regulatoryData`, `competitorData`, `marketEntryData`), the lifecycle states (`isInitialLoading`, `isRefreshing`, `error`, `isShowingHistoricalData`, `historicalDataTimestamp`), the 9 raw `fetch` sites + `buildApiUrl`, the cascade/timestamp-merge logic (`isTimestampNewer`/`isDataFresh`/`data: previousContext`), the `CACHE_DURATION` localStorage cache + `save*ToLocalStorage`/`getUserCache`/`getUserLocalStorage`/`isCacheValid` helpers, the refresh engine (`fetchMarketData`/`smartRefresh`/`handleRefresh` + `handleRefreshRef` + the custom-event listener effect), the `window.*` refresh-coordination globals (+ the `declare global`), the per-section edit/expand state, and the **cross-tab `editHistory`** (+ `editHistoryContext`/`marketEntryEditHistory` + the edit handlers). It does **NOT** own routing, the scout cross-tab pair, the 3 analysis handlers, or `signalsChatContext` (all shell/tab concerns). **No TanStack rewire** (5d–5h convert its internals). Distinct from 5b's `useMarketResearch`/`useResearchComponent`.
- `MarketResearchPage.tsx` → route-wiring + tab-routing (`getActiveTabFromPath(location.pathname)`) + **one** `useMarketResearchData()` call + the shared cross-tab `scoutResearchContext`/`scoutMode` pair + the 3 shell-owned analysis handlers + the shell chrome that reads the hook (status banners, the `isRefreshing` opacity-gate, the refresh `Dialog`) + `<FeatureErrorBoundary>`, delegating each tab to a container:
  - `IntelligenceTab` (the genuine 5-section surface — fed the data slice it needs **as props** from the shell's hook call; gets decomposed section-by-section in 5d–5h),
  - `TrendsTab` (a thin router over the **legacy** Scout-chat — `trends` is Scout chat, per the 5a finding; lifts the **out-of-band** trends block; receives `scoutResearchContext`/`scoutMode` + `editHistory` as props),
  - an `analysis` branch rendering the extracted **legacy** `LeadStreamTab` with shell-owned callbacks.

State rehoming uses the 3-part hoistability test (shared-across-≥2 / not-URL-derivable / not-server-state). Tab-nav stays URL-derived (5c does **not** normalize to `useParams` — out of scope). The cross-tab `scoutResearchContext`/`scoutMode` pair (written by the analysis handlers, read by the trends chat) is **shell-lifted and passed as props** (2 shallow consumers ⇒ props, not context — §5 default).

**Tech Stack:** React 18 + TS (strict), React Router (`useNavigate`/`useLocation`), the page's existing `buildApiUrl` + raw `fetch` data layer (unchanged, now inside the hook), `@/features/shell` (`Layout`), `@/shared/components` (`FeatureErrorBoundary`), Vitest + RTL + MSW, knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §5 (round 5 — structural-only) + **§9 delta 8 (hook-first re-cut)**, with §2.1, §2.3, §12 R1/R5, §9 deltas 6–7. Inventory of record: `docs/reviews/24c-frontend-phase-5c-data-layer-inventory.md`.

**Prerequisite (hard):** **5b (`plans/24b-frontend-phase-5b-data-layer.md`) merged to `master`.** 5c does **not** consume the 5b hooks (the page rewire is deferred — TD-FE-19); 5b is a prerequisite only because 5a/5b established the feature's location + the data-layer scaffolding 5d–5h will use. Branch off the latest `master`.

**R1 escape hatch (Spec 24 §12 / §5.7 — exercised TWICE, both pre-/early-implementation, both resolved by replan not abandonment):** event #1 reconciled the spec to structural-only (round 5) + rewrote the plan into-`IntelligenceTab` (delta 7); event #2 (this rewrite) re-cut hook-first (delta 8) after the data layer proved shell-coupled. 5a/5b stay merged. If 5c implementation reveals **further** coupling beyond this hook-first plan (e.g. the hook's extraction proves to entangle routing or the scout pair in a way the inventory missed), revert 5c and replan (master §5.7) — do **not** silently fix-forward through a structural surprise of that magnitude.

**Conventions for every task:** as 24a/24b — npm from `frontend/`; commits from repo root; `type(scope):` subjects, **no** `Co-Authored-By`/`[N/M]` suffixes; per-task `tsc`+`lint` green; **surgical commits by path** (never `git add -A`). **Visual-parity guard is behavioral E2E `journeys/04` + Vitest/RTL — there is no MR pixel VR** (TD-FE-17 / §9 delta 6).

**Failure handling (every task):** if a task's verification reds, fix-forward within that task; if it can't be resolved, **stop and report to the human** — do not silently proceed. The R1 escape hatch (revert 5c + replan) is reserved for deep cross-coupling surprises, not ordinary task failures. **Secondary abort heuristic (given R1 has fired twice):** if **≥2 non-coupling tasks** require human intervention for *unexpected* failures, pause and reassess whether the hook-first cut is viable before continuing — repeated surprises on a supposedly-mechanical move are themselves a signal the inventory missed something. Advisory (a human decision tripwire), not an automatic revert.

**Task independence / serialization:** **Tasks 1, 2, 4, 5, and 6 all modify `MarketResearchPage.tsx`** and must run **strictly serial** in that order. Task 3 (edits `IntelligenceTab` only, plus deletions) is the only task disjoint from the page-editing chain and may run concurrently with 4/5/6 if commits stay surgical — but its prerequisite is Task 2. Do **not** run page-editing tasks in parallel (shared file → merge conflict). Conventional order 1→2→3→4→5→6 is the safe default.

**Key facts from the inventory (carry forward — do not re-derive):**
- Tab routing is **URL-derived**: `getActiveTabFromPath()` (page L370–386) maps `location.pathname`'s last segment (`marketintelligence→intelligence`, `leadstream→analysis`, `chatwithscout→trends`); `activeTab` `useState` seeds from it (L388) + a sync `useEffect` (L1884–1890); `handleTabChange` (L1863) inverse-maps + `navigate(...)`. **Stays in the shell. Not `useParams`.**
- Route registered at `App.tsx:129` (`/your-ai-team/scout/:tab`), already wrapped in `<FeatureErrorBoundary featureName="Market Research">` at `App.tsx:132`. 5c does not touch route registration.
- **intelligence** tab JSX: `<TabsContent value="intelligence">` L6525–6914 (`marketData ? <SafeMarketIntelligenceTab .../> + EditHistoryPanels : <Load Data CTA>`; Safe takes ~169 props; Load-Data CTA L6900–6909).
- **analysis** tab JSX: L6916–6928 (renders `<ScoutLeadStream>` with filter props + 3 callbacks; **does no fetching** — data lives inside `ScoutLeadStream`, already legacy).
- **trends** chat renders **out of band** at page L6494–6511 (gated on `activeTab === "trends"`, **above** the `<Tabs>` body): `<ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode}/>` when `scoutResearchContext` is set, else `<ScoutChatWithHistory initialContext={signalsChatContext} editHistory={editHistory} onTabChange={setActiveTab} .../>`. The `TabsContent value="trends"` block (L6930–6933) is an **empty `hidden` placeholder**.
- **Shell chrome reads the data layer** (this is why the hook is shared, not tab-local): status banners (error alert L6322, cache-age alert L6341) read `marketData`/`isRefreshing`/`isInitialLoading`/`isShowingHistoricalData`/cache; the opacity wrapper L6518 + `!isRefreshing` ternary L6523 gate the tab area; the refresh `<Dialog open={isRefreshing}>` L6966 (after `</Tabs>`). These stay in the shell and read from the hook.
- **`editHistory` is cross-tab**: read by the staying **trends** block (L6507 → `ScoutChatWithHistory`) **and** the intelligence content (L6552/6882). It lives in the hook; the shell threads it to both `IntelligenceTab` and `TrendsTab`.
- The 3 analysis handlers (`handleChatWithScout` L401, `handleChatAboutCoverage` L1553, `handleSendToStrategist` L1569) are **cross-tab coupled** (set `scoutResearchContext`/`scoutMode`, call `handleTabChange`, write Strategist `localStorage` + navigate). They are **shell-owned — NOT in the hook** (they touch routing + the scout pair, not the data layer).
- **Refresh trigger is event-driven, not a button:** the in-page refresh `<Button onClick={handleRefresh}>` (L6381–6429) is inside a **JSX comment** (opener L6369, closer L6469) — **dead**. The live path is `handleRefresh` → `handleRefreshRef` fired by a custom-event listener (effect ~L4408–4426 / dispatched by a global header). Move the listener + ref + `handleRefresh` into the hook with the engine; do not resurrect the commented button.
- **Dead code to DROP, not migrate** (inventory): `componentRenderingStatus` (L653 — written L746/799/1028/2357, never read), the commented refresh `Button` block (L6367–6469), the empty `useEffect(()=>{},[competitorData])` (L1708), the fully-commented effect (L2251–2256), and `handleHistoricalReportSelected`'s only callsite (commented L6375 → the fn is dead unless another live caller exists — verify, drop if dead).
- `SafeMarketIntelligenceTab` does **prop-sanitization** (recursive Set-preserve / object→array coerce / JSON round-trip / fn-prop restore / rebuild `*DeletedSections` Sets) + wraps in the generic `@/components/common/ErrorBoundary`. `MarketIntelligenceTab` is a trivial pass-through; its only importer is Safe → both deletable once Safe is gone. Keep `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts` (5d–5h consume/retire).

---

## Task 0: Branch + baseline (inventory already captured)

**Files:** none (verification only).

> Task 0's state/handler inventory + the data-layer inventory are recorded in `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md` + `docs/reviews/24c-frontend-phase-5c-data-layer-inventory.md` + the "Key facts" list above. This task re-establishes a clean branch + green baseline.

- [ ] **Step 1: Branch off latest `master` (5b merged)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
HOOKS=frontend/src/features/market-research/hooks
{ test -d "$HOOKS" && [ -n "$(ls -A "$HOOKS" 2>/dev/null)" ]; } && echo "OK: 5b hooks dir present" || echo "STOP: 5b not merged"
git checkout phase-5c-page-decomposition 2>/dev/null || git checkout -b phase-5c-page-decomposition
git rev-parse --abbrev-ref HEAD   # expect: phase-5c-page-decomposition
```

- [ ] **Step 2: Green baseline** — `cd frontend && npm run preflight` (or the typecheck+lint+test subset for speed). RED before any change → STOP and report. *Note: the 2026-05-31 baseline was green (tsc ✅, lint ✅, vitest 145/145 ✅).*

No commit.

---

## Task 1: Extract the `useMarketResearchData()` data-layer hook (pure move)

**Files:**
- Create: `frontend/src/features/market-research/hooks/useMarketResearchData.ts`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Test: `frontend/src/features/market-research/hooks/__tests__/useMarketResearchData.test.tsx`

> Spec 24 §5 + §9 delta 8. This is the **largest** task and the new decomposition seam. `useMarketResearchData` absorbs the page's **entire market-research data layer** (the "full data+edit hook" boundary). **It is a PURE MOVE**: the page still renders all three tabs inline after this task — only the data-layer `useState`/helpers/effects relocate into the hook, and the page sources them via one `const {...} = useMarketResearchData()` destructure. Behavior must be provably identical at the Task-1 commit. The reviewer audits a **"moved, not modified"** diff (byte-identical modulo the destructure + the hook's `return`).

- [ ] **Step 1: Confirm the hook boundary (what moves vs what stays).** Before writing, list against `MarketResearchPage.tsx`:
  - **MOVES into the hook:** the 6 data `useState`s + initializers (`getInitial*Data`); lifecycle `useState`s (`isInitialLoading`, `isRefreshing`, `error`, `isShowingHistoricalData`, `historicalDataTimestamp`); the 9 raw `fetch` + `buildApiUrl` sites; cascade/timestamp helpers (`isTimestampNewer`, `isDataFresh`, `data: previousContext`); cache (`CACHE_DURATION`, `save*ToLocalStorage`, `getUserCache`, `getUserLocalStorage`, `isCacheValid`); the refresh engine (`fetchMarketData`, `smartRefresh`, `handleRefresh`, `handleRefreshRef`, the custom-event listener effect ~L4408–4426); the `declare global` Window augmentation (L59–65) + every `window.refreshStartTime`/`getAllScoutComponentResponses`/`getScoutResponses` read/write; the per-section edit/expand/`*DeletedSections`/`customMessage`/`showScoutChat`/per-section-loading state + their handlers; `editHistory` + `editHistoryContext` + `marketEntryEditHistory` + the edit handlers (L5791/6041); `returnToCurrentData`; `handleHistoricalReportSelected` (if live); any data-loading `useEffect`s; and the data layer's own context dependency (the auth/`currentUser` hook it reads for cache keys — call it inside the hook).
  - **STAYS in the shell:** routing (`getActiveTabFromPath`/`activeTab`/`activeTabRef`/the sync effect/`handleTabChange`/`useNavigate`/`useLocation`); the scout cross-tab pair (`scoutResearchContext`/`scoutMode`); the 3 analysis handlers (`handleChatWithScout`/`handleChatAboutCoverage`/`handleSendToStrategist`); `signalsChatContext` + its loader; `Layout`; the `Tabs`/`TabsList`/`TabsTrigger` chrome; the shell status banners + opacity-gate + refresh `Dialog` (they **read** the hook but render in the shell); all JSX.
  - **DROPPED, not moved** (inventory): `componentRenderingStatus` (unread) + its 4 writers; the commented refresh `Button` block (L6367–6469); the empty effect L1708; the commented effect L2251–2256; `handleHistoricalReportSelected` if its only caller is the commented L6375. Verify each is truly dead (`grep` for live readers/callers) before deleting; if any is live, keep it and note it.
  > If a symbol you expect to move is read by *staying* shell/routing code in a way that can't be satisfied by the hook's return value (e.g. routing state entangled in a data effect), STOP and report — that is the deep-coupling signal the escape hatch is for.

- [ ] **Step 2: Create `useMarketResearchData.ts`.** Move the "MOVES" set verbatim into the hook. The hook returns one object exposing every value/setter/action the page JSX + shell chrome still reference (data states, lifecycle, `editHistory` + setter, the per-section state + setters, `fetchMarketData`/`smartRefresh`/`handleRefresh`, cache-read helpers the banners call, etc.). Add a header comment:
```ts
// market-research DATA LAYER (Spec 24 §5 / §9 delta 8). Extracted from MarketResearchPage in 5c
// as a STRUCTURAL move — raw fetch + useState + cascade/timestamp + localStorage cache, UNCHANGED.
// NOT the 5b TanStack hook (`useMarketResearch`); 5d–5h convert THIS hook's internals to those.
// Owns the data layer only — NOT routing, the scout cross-tab pair, the analysis handlers, or signalsChatContext.
```
  Keep all logic identical. Move imports with the code. The hook calls whatever auth/user context hook the page used for cache keys.

- [ ] **Step 3: Rewire the page to the hook.** In `MarketResearchPage.tsx`, replace the moved declarations with a single `const { …data, …lifecycle, editHistory, setEditHistory, …perSection, fetchMarketData, smartRefresh, handleRefresh, … } = useMarketResearchData();` destructure (name the destructured members exactly as the old locals so **no JSX changes**). Delete the moved `useState`/helper/effect/`declare global`/`window.*` code and the DROPPED dead code. Leave **all JSX** and the STAYS set untouched. After this step the page renders identically, sourcing data from the hook.

- [ ] **Step 4: Write the hook smoke test (after extraction).** This is a verbatim move, so not test-first. Add `__tests__/useMarketResearchData.test.tsx`: render the hook via RTL `renderHook` (or a tiny harness component) inside the providers it needs (router + auth context); assert it returns the expected shape and reaches a non-crashing initial state (e.g. `isInitialLoading` resolves, `marketData` is null-or-object). **Use a coarse fetch stub** — `vi.spyOn(globalThis, "fetch").mockResolvedValue(<canned envelope>)`, or MSW for *only* the one-or-two sites fired on mount — **not** handlers for all 9 raw `fetch` sites: the smoke test's job is to catch a broken extraction, not to characterize every endpoint (the existing suite + `journeys/04` do that). Standing up 9 handlers for a pure-move guard is disproportionate.

- [ ] **Step 5: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
( lsof -ti tcp:5173 | xargs -r kill ) 2>/dev/null; ( lsof -ti tcp:4173 | xargs -r kill ) 2>/dev/null; true
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx playwright test journeys/04
```
> Task 1 is the largest single change (the whole data layer moves), so it runs the **full** Vitest suite **and** `journeys/04` (with the orphan-server guard — see Task 5 note) to catch any data/refresh regression here, not later. `knip` is **not** run yet (nothing orphaned — the page still imports everything; Safe still present).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/hooks/useMarketResearchData.ts \
        frontend/src/features/market-research/hooks/__tests__/useMarketResearchData.test.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract useMarketResearchData data-layer hook (structural move, no TanStack rewire)"
```

---

## Task 2: Extract `IntelligenceTab` — move the intelligence surface (data via props)

**Files:**
- Create: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Test: `frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx`

> Spec 24 §5, §2.1. **Prerequisite: Task 1.** The intelligence tab is the only genuine market-research tab. `IntelligenceTab` absorbs the intelligence-tab JSX (L6525–6914) and **receives the data it needs as props** from the shell's `useMarketResearchData()` call — it does **not** call the hook itself (single source of truth lives in the shell, so the shell chrome + trends `editHistory` stay consistent). Keep rendering via the **existing `SafeMarketIntelligenceTab`** wrapper (lifted verbatim) — the Safe→`FeatureErrorBoundary` swap is **Task 3's** single concern. This is a **PURE MOVE** ("moved, not modified").

- [ ] **Step 1: Plan the mount smoke test (after extraction, run in Step 4) — not test-first.** A verbatim move has no new behavior to drive; its characterization is the page-level suite + `journeys/04`. After Step 3, add one minimal mount smoke test rendering `<IntelligenceTab {...minimalProps} />` with a router context, asserting the intelligence surface (a known section heading, or the "Load Data" CTA when `marketData` is null) renders without crashing.

- [ ] **Step 2: Define `IntelligenceTab`'s prop interface.** It is the slice of the hook's return that the intelligence subtree (L6525–6914) reads — the `marketData`/section data, the per-section edit/expand state + setters, `editHistory`, `isRefreshing`, the section handlers, `fetchMarketData` (Load-Data CTA), etc. Type it with an explicit `interface IntelligenceTabProps` (it largely mirrors the existing `MarketIntelligenceTabProps` surface Safe already consumes — reuse/compose that type where it fits rather than re-typing 169 fields).

- [ ] **Step 3: Create `IntelligenceTab.tsx` AND its test file** — (a) lift the intelligence-tab JSX subtree (L6525–6914): the `marketData ? <SafeMarketIntelligenceTab .../> + EditHistoryPanels : <Load Data CTA>` branch, rendered via the **existing** `<SafeMarketIntelligenceTab>` (import from `@/features/market-research/components/SafeMarketIntelligenceTab` — Task 3 replaces it). All data/handlers come from `props`. Markup/behavior **identical**. In the page, replace the L6525–6914 subtree with `<IntelligenceTab {...slice} />` where `slice` is built from the shell's hook destructure. Leave the analysis + trends branches + the shell chrome (banners/gate/`Dialog`) in place. (b) Create `__tests__/IntelligenceTab.test.tsx` with the mount smoke test planned in Step 1 — written now that the component + prop surface exist, run in Step 4. (Don't skip the file: it appears in Step 4's `git add`.)

- [ ] **Step 4: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
( lsof -ti tcp:5173 | xargs -r kill ) 2>/dev/null; ( lsof -ti tcp:4173 | xargs -r kill ) 2>/dev/null; true
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx playwright test journeys/04
```
> Full Vitest **plus `journeys/04`** (with the orphan-server kill guard — see Task 5 note): Task 2 extracts the intelligence subtree and rebuilds its ~169-prop surface via `{...slice}`, so a miswired prop is a likely failure mode the Vitest suite may not fully exercise — and the next `journeys/04` otherwise isn't until Task 5, letting a Task-2 regression ride through Tasks 3–4 before surfacing. Running it here catches the miswire at its own commit. `knip` not run (IntelligenceTab still imports Safe — nothing orphaned; Task 3's knip run guards the post-deletion graph).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract IntelligenceTab container (data via props from the shell hook)"
```

---

## Task 3: Replace `SafeMarketIntelligenceTab` with `<FeatureErrorBoundary>` (sanitization preserved); delete dead wrappers

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Create: `frontend/src/features/market-research/components/intelligence/sanitizeIntelligenceProps.ts`
- Test: `frontend/src/features/market-research/components/intelligence/__tests__/sanitizeIntelligenceProps.test.ts`
- Delete: `frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx`
- Delete: `frontend/src/features/market-research/components/MarketIntelligenceTab.tsx`

> Spec 24 §5, §2.3. **Prerequisite: Task 2.** `SafeMarketIntelligenceTab` is **not just an error wrapper** — it performs real recursive prop-sanitization before rendering `MarketIntelligenceSections`. A blind swap drops that. Preserve it by extracting a tested pure function. Because Task 2 kept Safe intact, the sanitization is **never absent from a committed state**.

- [ ] **Step 1: Characterization test for the extracted sanitizer (TDD).** Create `__tests__/sanitizeIntelligenceProps.test.ts` pinning the four behaviors the inline `JSON.parse(JSON.stringify(...))` round-trip is easy to break:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeIntelligenceProps } from "../sanitizeIntelligenceProps";

const base = (over: Record<string, unknown> = {}) =>
  ({ marketSizeDeletedSections: new Set<string>(), ...over }) as unknown as Parameters<typeof sanitizeIntelligenceProps>[0];

describe("sanitizeIntelligenceProps", () => {
  it("preserves a function prop through the JSON round-trip", () => {
    const fn = () => "kept";
    const out = sanitizeIntelligenceProps(base({ onRefreshComponent: fn })) as Record<string, unknown>;
    expect(typeof out.onRefreshComponent).toBe("function");
    expect((out.onRefreshComponent as () => string)()).toBe("kept");
  });
  it("rebuilds *DeletedSections as a Set", () => {
    const out = sanitizeIntelligenceProps(base({ marketSizeDeletedSections: new Set(["a", "b"]) })) as Record<string, unknown>;
    expect(out.marketSizeDeletedSections).toBeInstanceOf(Set);
    expect(out.marketSizeDeletedSections as Set<string>).toEqual(new Set(["a", "b"]));
  });
  it("coerces companyProfile.targetMarkets object → array", () => {
    const out = sanitizeIntelligenceProps(base({ companyProfile: { targetMarkets: { "North America": 1, Europe: 2 } } })) as Record<string, unknown>;
    expect(Array.isArray((out.companyProfile as { targetMarkets: unknown }).targetMarkets)).toBe(true);
  });
  it("keeps industryTrendsRegionalHotspots as an object (not array-coerced)", () => {
    const out = sanitizeIntelligenceProps(base({ industryTrendsRegionalHotspots: { "North America": ["x"] } })) as Record<string, unknown>;
    expect(Array.isArray(out.industryTrendsRegionalHotspots)).toBe(false);
    expect(out.industryTrendsRegionalHotspots).toEqual({ "North America": ["x"] });
  });
});
```
  Run it — it **fails** (`sanitizeIntelligenceProps` doesn't exist yet). Match real `MarketIntelligenceTabProps` field names; adjust the factory if shapes differ while keeping the four assertions.

- [ ] **Step 2: Extract the sanitizer + swap the boundary.** Create `sanitizeIntelligenceProps.ts` exporting `sanitizeIntelligenceProps(props: MarketIntelligenceTabProps): MarketIntelligenceTabProps` containing the **exact** body of the former Safe component (the `checkForObjects`/`fixedProps`/`sanitizeProps`/`functionProps`/`sanitizedProps`/`deletedSectionsKeys` logic — lines 9–127 of the deleted file), returning `sanitizedProps`. Then in `IntelligenceTab`:
```tsx
import { FeatureErrorBoundary } from "@/shared/components";
import { sanitizeIntelligenceProps } from "./sanitizeIntelligenceProps";
// ...
const safeProps = sanitizeIntelligenceProps(intelligenceProps);
return (
  <FeatureErrorBoundary featureName="Market Intelligence">
    {/* preserve the wrapper div MarketIntelligenceTab provided (split-view width + spacing) */}
    <div className={`${safeProps.isSplitView ? "w-3/5" : "flex-1"} transition-all duration-500 space-y-6`}>
      <MarketIntelligenceSections {...safeProps} />
    </div>
  </FeatureErrorBoundary>
);
```
  This folds in the trivial wrapper `<div>` the deleted `MarketIntelligenceTab` provided. **Copy the exact wrapper `className` verbatim from the `MarketIntelligenceTab` source being deleted** — the value shown above is the inventory's expected form, but verify it against the live file (it may have drifted since the inventory snapshot); the source is authoritative. **Boundary granularity:** wrap at the section-composition level (default — one section's crash doesn't blank the whole tab). The route-level `<FeatureErrorBoundary featureName="Market Research">` (App.tsx:132) stays as the outer net; note the distinct `featureName`.

- [ ] **Step 3: Delete `SafeMarketIntelligenceTab` + `MarketIntelligenceTab`.** Confirm no importers first:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'SafeMarketIntelligenceTab' src   # expect: NO output
grep -rn "from \"./MarketIntelligenceTab\"\|from \"@/features/market-research/components/MarketIntelligenceTab\"" src   # expect: NO output
git rm frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx \
       frontend/src/features/market-research/components/MarketIntelligenceTab.tsx
```
  > If either grep returns a live importer, STOP and report. Do **not** delete `MarketIntelligenceSections` or `MarketIntelligenceTabProps.ts`.

- [ ] **Step 4: Green (incl. knip) + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress && npm run test
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/components/intelligence/sanitizeIntelligenceProps.ts
git commit -m "refactor(fe): replace SafeMarketIntelligenceTab with FeatureErrorBoundary (sanitization preserved)"
```

---

## Task 4: Extract the inline `analysis` (lead-stream) tab into the legacy unit

**Files:**
- Create: `frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §5, §7, R5. **Prerequisite: Task 2.** The `analysis` tab renders `ScoutLeadStream` + carries `leadStreamFilters`/`opportunityFilter` state; its 3 handlers are cross-tab coupled. It **stays in legacy** (leave-in-place), annotated → **customers (Phase 7)**. The legacy unit imports **no** feature code, so the coupled coordination stays **shell-owned** and is passed in as **callback props**.

- [ ] **Step 1: Callback prop contract.** `LeadStreamTab` **owns `leadStreamFilters`/`opportunityFilter` internally** (analysis-local — they leave the page with the tab) and receives `onChatWithScout(leads, reportFilter?)`, `onChatAboutCoverage()`, `onSendToStrategist(lead)` as props (the 3 handlers stay shell-owned).

- [ ] **Step 2: Create `LeadStreamTab.tsx` in legacy** containing the lifted `analysis` JSX (the `<ScoutLeadStream …/>` wiring, page L6916–6928) + the `leadStreamFilters`/`opportunityFilter` `useState`s, consuming the 3 handlers from props. Annotate:
```tsx
// HANDOFF → customers (Spec 24 §7). Extracted from MarketResearchPage in 5c; lives in
// legacy until the customers feature (Phase 7) relocates + decomposes it and migrates its
// data layer. Does NOT import feature-internal code (transitional boundary, one-way) —
// cross-tab/nav/Strategist coordination is injected by the feature shell as callback props.
```
  Imports `ScoutLeadStream` from `@/components/market-research/ScoutLeadStream`. Does **not** import `@/features/market-research/*`. Does no fetching (verify; if some GET surfaces, duplicate it as raw `fetch` here per §5 default (i) — do not import a feature hook).

- [ ] **Step 3: Render from the page's `analysis` branch.** Replace the inline `analysis` JSX (L6916–6928) with:
```tsx
<LeadStreamTab
  onChatWithScout={handleChatWithScout}
  onChatAboutCoverage={handleChatAboutCoverage}
  onSendToStrategist={handleSendToStrategist}
/>
```
  imported from `@/components/market-research/lead-stream/LeadStreamTab`. Remove the page's `leadStreamFilters`/`opportunityFilter` `useState`s. **Keep** the 3 `handle*` handlers in the page (shell-owned; finalized in Task 6).

- [ ] **Step 4: Confirm one-way boundary + green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn '@/features/market-research' src/components/market-research/lead-stream   # expect: NO output
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract analysis lead-stream tab into legacy unit with shell-owned callback props (HANDOFF customers)"
```

---

## Task 5: Extract `TrendsTab` (thin router over the out-of-band legacy Scout-chat)

**Files:**
- Create: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §5, §2.1, §9 delta 6. **Prerequisite: Tasks 1, 2, 4.** `trends` renders **Scout chat** (legacy/leaving). `TrendsTab` is a thin router over those legacy components. **The real chat renders OUT OF BAND** (L6494–6511, above the `<Tabs>` body, gated on `activeTab === "trends"`) — **not** in the empty `hidden` `TabsContent value="trends"` (L6930–6933). `TrendsTab` lifts the out-of-band block; the empty placeholder is removed.

- [ ] **Step 1a: Name the `scoutResearchContext` type.** The page declares it as an inline `useState<{…}>` literal (page L392). Add `export interface ScoutResearchContext { /* exact fields from the page L392 generic: leads, opportunity?, icp?, reportTraits? */ }` to `frontend/src/features/market-research/types.ts`; change the page's `useState<…>` to `useState<ScoutResearchContext | null>`. **An identical type already exists in legacy — do not import it.** `ChatWithScout.tsx` defines `ChatWithScoutResearchContext` with the same shape; importing it would point the feature *at* a leaving legacy component (wrong direction). Create the **feature-local `ScoutResearchContext` and accept the duplication**; structural typing lets `TrendsTab` pass a `ScoutResearchContext` into `ChatWithScout`'s `researchContext` prop **with no cast**. Comment the interface as an intentional mirror until `ChatWithScout` is retired.

- [ ] **Step 1b: Create `TrendsTab.tsx`** rendering the lifted out-of-band block. Props: `scoutResearchContext: ScoutResearchContext | null`, `scoutMode: "selected-leads" | "full-list"`, `editHistory` (from the hook, via the shell). Owns `signalsChatContext` internally (Step 1c).
```tsx
import type { ScoutResearchContext } from "@/features/market-research/types";
// trends = Scout chat (Spec 24 §9 delta 6), NOT an emerging-trends view. Feature-owned thin
// router over the LEAVING Scout-chat components (scout / signals). The components it renders are legacy.
interface TrendsTabProps {
  scoutResearchContext: ScoutResearchContext | null;
  scoutMode: "selected-leads" | "full-list";
  editHistory: EditRecord[];
  onTabChange: (tab: string) => void; // = the shell's setActiveTab (match its signature); see Step 1c / Step 2
}
// renders:
//   scoutResearchContext
//     ? <ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode} />
//     : <ScoutChatWithHistory initialContext={signalsChatContext} editHistory={editHistory}
//                             onClearContext={clearSignalsChatContext} onTabChange={...} />
```
  `ChatWithScout` from `@/components/market-research/ChatWithScout`; `ScoutChatWithHistory` from `@/components/signals/ScoutChatWithHistory`. `editHistory` is passed from the shell's hook destructure (it lives in `useMarketResearchData`).

- [ ] **Step 1c: Move `signalsChatContext` into `TrendsTab`.** The `signalsChatContext` `useState` (page L391) + its loader effect (page L414–430, gated on `activeTab === "trends"`) + its clear move **into** `TrendsTab` as internal state (single consumer → relocate, no hoist). The out-of-band block renders **conditionally** (`{activeTab === "trends" ? (<trends>) : (<other>)}`, page L6494) → the subtree **mounts/unmounts** on tab change → the `activeTab === "trends"` guard becomes implicit; **no `isActive` prop needed**. (Defensive fallback: if a future change converts it to always-mounted CSS-hide, re-add an `isActive` prop + keep the guard inside `TrendsTab`.) `onTabChange` (currently `setActiveTab`) is passed from the shell.

- [ ] **Step 2: Route the page's `trends` branch to `<TrendsTab/>`.** The out-of-band block is the **true branch of a ternary** — the live source (verified) is `{activeTab === "trends" ? (<trends block, L6494–6511>) : (<ScrollArea>…the other tabs' content…</ScrollArea>)}` (**not** a bare `{activeTab === "trends" && (…)}`). **Preserve the ternary; replace only its true-branch content** with `<TrendsTab scoutResearchContext={scoutResearchContext} scoutMode={scoutMode} editHistory={editHistory} onTabChange={setActiveTab} />`, leaving the `: (<ScrollArea>…</ScrollArea>)` false branch (the other tabs) intact:
```tsx
{activeTab === "trends" ? (
  <TrendsTab scoutResearchContext={scoutResearchContext} scoutMode={scoutMode} editHistory={editHistory} onTabChange={setActiveTab} />
) : (
  <ScrollArea> … intelligence / analysis tab content … </ScrollArea>
)}
```
  A literal "replace L6494–6511" that swallows the `) : (` would break the ternary or unconditionally render TrendsTab — **locate the ternary's true-branch boundaries in the live file** (the L-numbers are a 2026-05-31 anchor a merge can shift), don't trust the line range blindly. Then **remove the empty `TabsContent value="trends"` placeholder** (L6930–6933), and remove the page's `signalsChatContext` `useState` + loader (moved in 1c). **Verify the trends trigger still navigates once its panel is gone:** the controlled trigger (`value={activeTab}`/`onValueChange={handleTabChange}`) fires regardless of a matching panel, so this *should* be a no-op — confirm in Step 3 that `journeys/04` actually **clicks** the trends (`chatwithscout`) `TabsTrigger` and lands on the scout-chat surface; if it only navigates by URL, add an explicit click→navigate assertion.

- [ ] **Step 3: Green + commit (orphan-server guard — last structural extraction)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
( lsof -ti tcp:5173 | xargs -r kill ) 2>/dev/null; ( lsof -ti tcp:4173 | xargs -r kill ) 2>/dev/null; true
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress && npx playwright test journeys/04
```
> **Orphan-server guard (required).** This repo has a documented false-green: `reuseExistingServer` + a stale `:5173`/`:4173` server → Playwright silently tests the previous build. Kill orphans first; confirm the playwright `webServer` port matches. Task 5 is the **last structural extraction** — all three tab containers now exist. **If `journeys/04` reds and the cause is deep cross-tab coupling, invoke the R1 escape hatch** rather than fix-forward.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/trends/TrendsTab.tsx \
        frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/types.ts \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract TrendsTab router for the out-of-band legacy scout-chat branch"
```
  (Stage `IntelligenceTab.tsx` only if its `editHistory`-prop type changed in this task; otherwise drop it from the `git add`.)

---

## Task 6: Reduce the page to a thin shell; record state decisions

**Files:**
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Create (only if criteria select context over props — they should not): `frontend/src/features/market-research/context/MarketResearchContext.tsx`

> Spec 24 §5 (hoistability + props-vs-context). **Prerequisite: Tasks 1, 2, 4, 5.** Finalize the page's residual state and reduce it to a thin shell.

- [ ] **Step 1: Classify the residual shell state.** After Tasks 1/2/4/5 the page holds: routing (`activeTab` + sync effect + `handleTabChange`); the `useMarketResearchData()` call; the scout cross-tab pair (`scoutResearchContext`/`scoutMode`); the 3 shell-owned `handle*` handlers; the shell chrome (status banners + opacity-gate + refresh `Dialog`) reading the hook.
  - **`activeTab` + routing** → stays URL-derived; no `useParams` normalization (out of scope).
  - **`scoutResearchContext`/`scoutMode`** → passes all three hoistability criteria; **mechanism = shell-`useState` passed as props** to `<TrendsTab>` (read) — the analysis handlers (shell-owned) write them directly. **2 shallow consumers ⇒ props, not context. Do not create `MarketResearchContext`.** Only if implementation reveals threading through >2 levels, fall back to a minimal context and record why in the commit body.
  - **Data layer** → in `useMarketResearchData` (the shell delegates; no data `useState` in the shell body).
  - **Search/filter state** → none remain in the shell (left with `LeadStreamTab`). Record "no shareable feature filter" in the commit body.

- [ ] **Step 2: Reduce the page to a thin shell.** The page now: read `activeTab` from the path → call `useMarketResearchData()` once → render `Layout` + the shell chrome (banners/gate/`Dialog` from the hook) + the tab router routing to `<IntelligenceTab {...slice}/>` / `<LeadStreamTab .../>` (legacy, 3 callbacks) / `<TrendsTab .../>` (scout pair + `editHistory`). Hold the `scoutResearchContext`/`scoutMode` `useState` + the 3 `handle*` handlers. **Removal checklist (makes "thin shell" diff-auditable):** delete anything left behind that only served moved code — (a) imports of symbols that moved into the hook / tab containers (watch destructured/re-exported forms a name-grep misses), (b) helper functions now unreferenced, (c) `useState`/`useEffect`/`useRef` whose only consumers left. Then assert the shell's import block contains **only**: the router (`useNavigate`/`useLocation`), `Layout`, `useMarketResearchData`, the three tab containers, the shared types (`ScoutResearchContext`), the `Tabs` chrome, the shell-chrome UI (alerts/`Dialog`), and whatever the 3 handlers depend on. `tsc`/eslint catch unused *imports*; this targets dead *helpers*/state.

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): thin MarketResearchPage shell; hoist scout cross-tab pair as props (no context — decision recorded)"
```
> Record in the commit body: the per-variable classification; that `scoutResearchContext`/`scoutMode` were hoisted as **props** (2 shallow consumers); that the data layer lives in `useMarketResearchData` (the shell holds no data `useState`); and that `activeTab` stays `location.pathname`-derived.

---

## Task 7: Final preflight + done-when + deltas + handoff

**Files:** `specs/24-…` (§9 delta) as needed.

- [ ] **Step 1: Full preflight + behavioral parity**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
( lsof -ti tcp:5173 | xargs -r kill ) 2>/dev/null; ( lsof -ti tcp:4173 | xargs -r kill ) 2>/dev/null; true
npm run preflight
```
Expected: PASS incl. `journeys/04` for all three URL segments (`marketintelligence`/`leadstream`/`chatwithscout`). **If it reds**, investigate tab-routing/extraction; if the cause is deep coupling, invoke the R1 escape hatch (revert 5c, replan — master §5.7) rather than fix-forward.

- [ ] **Step 2: Done-when (Spec 24 §5 "Done when", round 5 + §9 delta 8 — structural-only, hook-first)**
1. The **page shell** is a thin route-wire + tab router; **no fetch-result/server state in the shell's own `useState`** — the raw-`fetch`/cache machinery moved into **`useMarketResearchData()`** (which the shell delegates to and which still carries the raw `fetch`; 5c does NOT remove raw `fetch` — that completes across 5d–5h converting the hook's internals, confirmed at 24i).
2. The lead-stream tab is an annotated unit in `src/components/market-research/lead-stream/` importing **no** feature code (verified one-way boundary, Task 4); cross-tab/nav coordination injected as shell-owned callback props; its data access lives inside `ScoutLeadStream`.
3. `SafeMarketIntelligenceTab` is gone and `<FeatureErrorBoundary>` replaces it **with prop-sanitization preserved** (Task 3); `MarketIntelligenceTab` is gone; `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts` remain.
4. The props-vs-context decision for `scoutResearchContext`/`scoutMode` is recorded (expected: props).
5. Behavior parity (`journeys/04`) + `npm run preflight` green.

- [ ] **Step 3: Deltas + handoff** — append a Spec 24 §9 note recording: the data layer became the `useMarketResearchData()` hook (the 5d–5h conversion target), the context decision (props, not context), that 5c was structural-only (no TanStack rewire), and confirming `trends`=Scout-chat / `analysis`=lead-stream both route to legacy (only `intelligence` is genuine). Then `/review-impl` → `/synthesize-impl-review` (design-heavy — §10) → controller preflight → merge `phase-5c-page-decomposition` → `master`. **5d–5h read from the now-isolated `useMarketResearchData` + `IntelligenceTab`, converting the hook's raw `fetch` to the 5b hooks section-by-section (each deleting its page-origin `fetch`/cache slice — Spec 24 §6).**

---

## Self-review notes (plan author)

- **Spec coverage (round 5 + §9 delta 8, structural-only hook-first):** data layer → `useMarketResearchData` hook (Task 1 — TD-FE-19, no TanStack); IntelligenceTab fed via props (Task 2); Safe→FeatureErrorBoundary + sanitization preserved (Task 3); inline analysis → legacy + shell-owned callback props + one-way boundary (Task 4); out-of-band trends block + placeholder removal + feature-local `ScoutResearchContext` (Task 5); scout pair hoisted as props, not context, + thin shell (Task 6); §5 "Done when" (Task 7).
- **R1 findings encoded:** event-#1 G1–G5 (data layer raw-`fetch` moved unchanged, `useCompanyProfile` deferred, analysis-handler coupling → shell callbacks, out-of-band trends, Safe sanitization preserved); **event-#2** (data layer shell-coupled → hook-first; dead code dropped not migrated).
- **R1 escape hatch re-armed:** further coupling beyond this hook-first plan → revert 5c + replan; 5a/5b stay merged.
- **Serialization:** Tasks 1, 2, 4, 5, 6 edit the page → strictly serial; Task 3 edits IntelligenceTab + deletions (concurrent-safe after Task 2). Do not run page-editing tasks in parallel.
- **Identifiers for downstream (5d–5h):** `useMarketResearchData` is the data-layer hook carrying the raw `fetch`/cache (the conversion target); sections live under `components/intelligence/<section>/`; `MarketIntelligenceTabProps` is deleted as the last section converts (≤ 5h — 24i confirms); each section sub-phase deletes its page-origin `fetch`/cache slice (Spec 24 §6).
