# Phase 5c — MarketResearchPage data-layer inventory (read-only)

File: `frontend/src/features/market-research/pages/MarketResearchPage.tsx` (7,013 lines).
Purpose: size the boundary of a future `useMarketResearchData()` hook by mapping every data-layer
symbol to the render scope(s) that consume it. Read-only inventory; no code was changed.

## Render-scope line ranges (verified by reading the file)

| Scope | Range(s) | Notes |
|---|---|---|
| SHELL-CHROME | early-return error/loading L6074–6100 + final `return (` body L6117 onward outside tab blocks; `<Tabs>` opens L6120; `TabsList`/`TabsTrigger` L6473–6488; status banners (cached-data amber L6294–6314, error red L6318–6335, cache-age blue L6339–6360); opacity wrapper + `!isRefreshing` gate L6516–6523; refresh `<Dialog open={isRefreshing}>` L6966–6967 (after `</Tabs>` L6949) | header refresh control block L6362–6432 is **commented out** |
| INTELLIGENCE | `<TabsContent value="intelligence">` L6525–6914 (incl. `<SafeMarketIntelligenceTab …>` L6536 + its 66 props, and the "Load Data" CTA branch L6900–6909) | |
| TRENDS | out-of-band chat gate `activeTab === "trends"` L6494–6511 (`<ChatWithScout>` L6498 / `<ScoutChatWithHistory>` L6501–6509); empty placeholder `<TabsContent value="trends" className="mt-0 hidden">` L6930–6933 | |
| ANALYSIS | `<TabsContent value="analysis">` L6916–6928 (`<ScoutLeadStream>` L6917–6924) | |
| HANDLER/EFFECT | all function/effect bodies (fetch/refresh/cascade/edit handlers, useEffects). Belongs to whichever scope owns the handler. | |

Module-scope helpers live ABOVE the component body: `CACHE_DURATION` L246; `getUserCache` L249,
`setUserCache` L255, `clearUserCache` L265, `clearCompanyProfileCache` L303, `isCacheValid` L324,
`getCachedData` L331. The `declare global { interface Window { … } }` block is L59–65.

---

## CLASSIFICATION TABLE

Legend: CROSS = read/written by ≥2 of {SHELL-CHROME, INTELLIGENCE, TRENDS, ANALYSIS}.
INTEL-LOCAL / TRENDS-LOCAL / ANALYSIS-LOCAL / SHELL-LOCAL = single non-handler scope (+ own handlers/effects).
"Render consumers" lists only JSX-scope reads/writes; handler/effect bodies are summarized separately.

### 1. Server-ish data states

| Symbol | Kind | Def | Render consumers (scope: lines) | Class |
|---|---|---|---|---|
| `marketData` / `setMarketData` | useState | L450 | SHELL `hasAnyValidData` L6071, early-return guard L6074, cache-age banner L6340–6341; SHELL-CHROME opacity gate L6518; INTEL L6526/6529/6539/6611/6618/6620/6700/6712/6788/6800/6810/6818/6900/6904 | **CROSS** |
| `marketIntelligenceData` / setter | useState | L1268 | INTEL only (passed as prop / fed into tab) | INTEL-LOCAL |
| `industryTrendsData` / setter | useState | L1533 | INTEL prop only | INTEL-LOCAL |
| `regulatoryData` / setter | useState | L1651 | INTEL prop only | INTEL-LOCAL |
| `competitorData` / setter | useState | L1704 | INTEL prop only (also dead effect L1708) | INTEL-LOCAL |
| `marketEntryData` / setter | useState | L1846 | INTEL prop only | INTEL-LOCAL |
| `companyProfile` / setter | useState | L1193 | handlers only (fetch/cascade); not read in JSX | HANDLER-LOCAL → folds into INTEL data path |
| `selectedMarket` | useState (no setter) | L440 | drives `MarketDetailDrawer` inside INTEL | INTEL-LOCAL |
| `scoutDeploymentData` | useState (no setter) | L438 | INTEL (`ScoutDeploymentDetails`) | INTEL-LOCAL |

### 2. Load/refresh lifecycle

| Symbol | Kind | Def | Render consumers (scope: lines) | Class |
|---|---|---|---|---|
| `isInitialLoading` / setter | useState (lazy) | L607 | SHELL early-returns L6074/6101/6112; SHELL-CHROME opacity gate L6518; INTEL prop L6541 | **CROSS** |
| `isRefreshing` / setter | useState | L615 | SHELL banners-gate L6324/6346, opacity gate L6518, `!isRefreshing` content gate L6523, refresh Dialog L6966; INTEL props L6537/6581. (L6401/6409/6421 reads are inside the COMMENTED block → not live) | **CROSS** |
| `error` / setter | useState | L617 | SHELL only: early-return L6074, error blocks L6318/6324/6331 | SHELL-LOCAL |
| `isShowingHistoricalData` / setter | useState | L444 | **LIVE** SHELL reads: historical-data banner gate L6291, error-banner gate L6326, cache-age banner gate L6348; written in handlers L2014/2195; commented refresh block L6413 (dead). | SHELL-LOCAL |
| `historicalDataTimestamp` / setter | useState | L446 | **LIVE** SHELL: historical banner L6291 + L6300 (`formatTimestamp(...)`) | SHELL-LOCAL |
| `componentRenderingStatus` / setter | useState | L653 | **declaration only (L653–658); no reads, no writes** | DEAD |
| `componentStatus`, `freshDataFlags`, `loadingPhase`, `refreshAttempt`, `validationAttempts`, `consecutiveValidations`, `componentFailureCounts`, `globalTimeoutId` | useState | L621–685 | handler/effect bookkeeping only (most setters with `[, setX]` discard the value) | HANDLER-LOCAL |
| `validationTimeoutRef`, `isValidatingRef`, `isRetryingRef`, `previousUserIdRef`, `activeTabRef` | useRef | L677/680/683/356/389 | handler/effect only | HANDLER-LOCAL |

### 3. Per-section edit / expand / history state

All `*Editing`, `*Expanded`, `*HasEdits`, `*DeletedSections`, `*EditHistory`, `*CustomMessage`,
`show*ScoutChat`, and per-section loading flags are passed **only** into `<SafeMarketIntelligenceTab>`
(props at L6536–6914) and mutated by edit handlers. They are INTEL-LOCAL except where noted.

| Symbol group | Def lines | Class |
|---|---|---|
| `deletedSections`/`hasEdits`/`editHistory`(see CROSS)/`editHistoryContext` | L1422/1432/1426/1430 | mixed — see below |
| `isMarketIntelligenceEditing`/`isMarketIntelligenceExpanded` | L1203/1205 | INTEL-LOCAL |
| Industry Trends: `isIndustryTrendsEditing`, `industryTrendsExpanded`, `industryTrendsHasEdits`, `industryTrendsDeletedSections`, `industryTrendsEditHistory`, `industryTrendsLastEditedField`, `industryTrendsCustomMessage`, `showIndustryTrendsScoutChat`, `isIndustryTrendsLoading` | L1436–1442/1446/1535/1737/1735/1408 | INTEL-LOCAL |
| Regulatory: `isRegulatoryEditing`, `regulatoryExpanded`, `regulatoryHasEdits`, `regulatoryDeletedSections`, `regulatoryEditHistory`, `showRegulatoryScoutChat`, `isRegulatoryPostSave`, `regulatoryCustomMessage`, `isRegulatoryLoading` | L1584–1594/1758/1760/1762/1412 | INTEL-LOCAL |
| Competitor: `isCompetitorEditing`, `competitorExpanded`, `competitorHasEdits`, `competitorDeletedSections`, `competitorEditHistory`, `showCompetitorScoutChat`, `competitorCustomMessage`, `isCompetitorLoading` | L1655–1665/1743/1745/1402 | INTEL-LOCAL |
| Market Size: `showMarketSizeScoutChat`, `marketSizeHasEdits`, `marketSizeLastEditedField`, `marketSizeDeletedSections`, `marketSizeCustomMessage`, `isMarketSizeLoading` | L1712–1722/1396 | INTEL-LOCAL |
| Market Entry: `isMarketEntryEditing`, `marketEntryExpanded`, `marketEntryHasEdits`, `marketEntryDeletedSections`, `marketEntryEditHistory`, `showMarketEntryScoutChat`, `isMarketEntryPostSave`, `marketEntryCustomMessage`, `isMarketEntryEditHistoryOpen`, `isMarketEntryLoading` | L1775–1858/1410 | INTEL-LOCAL |
| `isEditHistoryOpen` | L1428 | INTEL-LOCAL |
| Section error states `marketSizeError`/`competitorError` + discarded `setIndustryTrendsError`/`setMarketEntryError`/`setRegulatoryError` | L1398/1404/1416–1420 | HANDLER-LOCAL |

Key edit-history symbols broken out:

| Symbol | Def | Consumers | Class |
|---|---|---|---|
| `editHistory` / `setEditHistory` | L1426 | **TRENDS** L6507 (`ScoutChatWithHistory editHistory={editHistory}`); **INTEL** L6552 + L6882; handler writes L4608/5218/6044/6064; handler reads L5791/6041 | **CROSS** |
| `editHistoryContext` / setter | L1430 | INTEL L6885; handler writes L4721/4956/5189/5340/5787 | INTEL-LOCAL |
| `marketEntryEditHistory` / setter | L1785 | INTEL L6893 only | INTEL-LOCAL |
| `deletedSections` / setter | L1422 | INTEL prop; handler writes | INTEL-LOCAL |
| `hasEdits` / setter | L1432 | INTEL prop; handler writes | INTEL-LOCAL |

### 4. Data-layer functions / helpers

| Symbol | Kind | Def | Callers (scope: lines) | Class |
|---|---|---|---|---|
| `fetchMarketData` | async fn | L2025 | SHELL early-return CTA L6081; INTEL Load-Data CTA L6905; handlers L2020/4289 | **CROSS** |
| `smartRefresh` | async fn | L2318 | handlers only L2757 (called by `handleRefresh`); commented refs L2722 | HANDLER-LOCAL |
| `handleRefresh` | fn | L4397 | ref-mirror L4408/4410, event handler L4426; JSX onClick L6393 is **COMMENTED** (dead) | HANDLER-LOCAL (no live JSX consumer) |
| `handleRefreshRef` | useRef | L4408 | handler/effect only | HANDLER-LOCAL |
| `returnToCurrentData` | async fn | L2013 | SHELL historical-data banner L6311; handler L4401 | SHELL-LOCAL |
| `getUserCache` | module fn | L249 | SHELL cache-age banner L6340/6350/6358; handlers | mixed (SHELL + handlers) |
| `setUserCache` | module fn | L255 | handlers only | HANDLER-LOCAL |
| `clearUserCache` | module fn | L265 | handlers only | HANDLER-LOCAL |
| `clearCompanyProfileCache` | module fn | L303 | handlers only | HANDLER-LOCAL |
| `isCacheValid` | module fn | L324 | SHELL cache-age banner L6353; handlers | SHELL + handlers |
| `getCachedData` | module fn | L331 | `marketData` lazy init L451; handlers | HANDLER/init |
| `getInitialMarketIntelligenceData` | fn | L1209 (used L1269) | lazy init for `marketIntelligenceData` | INTEL-LOCAL |
| `getInitialIndustryTrendsData` / `…Regulatory…` / `…Competitor…` / `…MarketEntry…Data` | fns | L1450/1616/1669/1789 (used L1533/1651/1704/1846) | useState lazy initializers only | INTEL-LOCAL |
| `saveMarketIntelligenceToLocalStorage` | useCallback | L1274 | handler writes (L2189/3116/5052…) AND **INTEL inline handlers** L6672/6696/6720 | INTEL + handlers |
| `saveCompetitorDataToLocalStorage` / `saveRegulatoryDataToLocalStorage` / `saveIndustryTrendsDataToLocalStorage` / `saveMarketEntryDataToLocalStorage` | useCallback | L1300/1325/1344/1372 | handler writes only | HANDLER-LOCAL |
| `isDataFresh` | nested fn | L895 (inside an effect/handler) | handler-only (component-status calc) | HANDLER-LOCAL |
| `handleHistoricalReportSelected` | fn | (referenced) | only callsite is the **COMMENTED** `DataHistoryDialog` L6375 → no live consumer | DEAD/HANDLER |
| `getUserLocalStorage` (import) | import L46 | profile read L2463; handlers | HANDLER-LOCAL |
| `isTimestampNewer` / `toUTCTimestamp` / `logTimestampComparison` (import) | import L34 | cascade/timestamp-merge handlers | HANDLER-LOCAL |
| `buildLeadStreamChatContext` / `LEAD_STREAM_CHAT_CONTEXT_KEY` (import) | import L51 | handler/effect | HANDLER-LOCAL |

NB: the `save*ToLocalStorage` callbacks, the five `getInitial*Data` builders, `isDataFresh` (L895),
and `handleHistoricalReportSelected` DO exist. `handleHistoricalReportSelected` is only referenced
from the commented-out `DataHistoryDialog` (L6375), so it has no live consumer. Cache writes go
through `setUserCache` (L255), `setUserLocalStorage` (import L47), and the `save*ToLocalStorage`
callbacks. `saveMarketIntelligenceToLocalStorage` is the one save-helper with live INTEL JSX
callers (inline onChange handlers at L6672/6696/6720), so it is INTEL-consumed, not handler-only.

### 5. Constants / window-globals

| Symbol | Def | Reads/Writes | Class |
|---|---|---|---|
| `CACHE_DURATION` | L246 | `isCacheValid` L328 only | module const (handler) |
| `Window.refreshStartTime` | declared L61 | written L1894, L2320, cleared L2837/2843/2846/2849/2862/2867/3036; never read in this file | HANDLER-LOCAL (cross-component signal) |
| `Window.getAllScoutComponentResponses` | declared L62 | written L2762/2815; cleared — read by other components (debug/console) | HANDLER-LOCAL |
| `Window.getScoutResponses` | declared L63 | written L2810/2814; cleared L3037 | HANDLER-LOCAL |
| `caches` (browser CacheStorage) | — | L2039–2044 fetch handler | HANDLER-LOCAL |

### 6. useEffects (data-relevant)

All data/load/cache/sync effects sit in handler bodies (L413, 456, 483, 536, 546, 691, 1727, 1750,
1767, 1883, 1894, 1921, 2221, 2260, 4222, 4343, 4375, 4412). The mount-only bootstrap effect
(L4222–4339, deps `[]`) calls `fetchMarketData`/`smartRefresh` and wires the window globals; the
user-switch effect (L455–) clears per-user cache and resets `marketData`. The commented-out effect
at L2251–2256 (`competitorData`/`isRefreshing`) is dead. These effects read/write the CROSS symbols
above and therefore must move WITH the hook (boundary A) or be split (boundary B).

---

## Boundary A vs B

### (A) Full data + edit hook — categories 1–6
Everything: 6 server data states + companyProfile + 2 view-only (selectedMarket, scoutDeploymentData);
full lifecycle (~20 states/refs incl. dead `componentRenderingStatus` and the validation bookkeeping);
all ~55 per-section edit/expand/history/customMessage/loading states; all data fns
(`fetchMarketData`, `smartRefresh`, `handleRefresh`, `returnToCurrentData`, 6 cache helpers,
4 `getInitial*Data`); constants + 3 window globals; ~18 effects.

- Symbol count: **~110 stateful/fn symbols** (≈ 70 useState + ~6 useRef + ~10 helper fns + ~18 effects + constants/globals).
- Rough line span: the data+handler region runs roughly **L240–L5870** (helpers L240–350, state L356–1858,
  fetch/cascade/edit handlers L1883–5872), i.e. **~5,000 lines** of logic would migrate into the hook,
  leaving the JSX (L6074–6967) in the page.

### (B) Minimal shared hook — CROSS symbols only
Only the symbols crossing ≥2 render scopes; all INTEL-LOCAL edit/expand/history state stays in
`IntelligenceTab`; SHELL-LOCAL (`error`, `returnToCurrentData`, cache-age banner helpers) and
TRENDS/ANALYSIS-LOCAL stay put.

CROSS members:
- `marketData` / `setMarketData` (L450)
- `isInitialLoading` / setter (L607)
- `isRefreshing` / setter (L615)
- `editHistory` / `setEditHistory` (L1426)
- `fetchMarketData` (L2025) — and transitively `smartRefresh` (L2318) + the cache helpers it relies on,
  because the SHELL and INTEL "Load Data" CTAs both call `fetchMarketData`.

- Symbol count: **5 directly-shared symbols** (4 state + 1 fn), pulling in `smartRefresh` + cache
  read helpers (`getUserCache`, `isCacheValid`, `getCachedData`) + the bootstrap/user-switch effects
  as their implementation → **~8–10 symbols**.
- Rough line span: the shared surface itself is small (~5 declarations), but `fetchMarketData` +
  `smartRefresh` + their effects are large (L2025–3040 ≈ 1,000 lines). Realistic hook body
  **~1,000–1,200 lines** if it owns the fetch/refresh machinery; **~150 lines** if the hook only
  owns the 4 state cells + thin fetch trigger and the cascade stays in the page.

Recommendation signal: the only true cross-boundary leaf state is `marketData`, `isInitialLoading`,
`isRefreshing`, `editHistory` (+ the `fetchMarketData` entry point). Everything else is INTEL-LOCAL or
handler-internal. Boundary B is viable and far smaller; the edit machinery does NOT need to be shared.

---

## CROSS symbols — exact consumer lines per scope

| Symbol | SHELL-CHROME | INTELLIGENCE | TRENDS | ANALYSIS |
|---|---|---|---|---|
| `marketData` | L6071, L6074, L6340–6341, L6518 | L6526/6529/6539/6611/6618/6620/6700/6712/6788/6800/6810/6818/6900/6904 | — | — |
| `isInitialLoading` | L6074, L6101, L6112, L6518 | L6541 | — | — |
| `isRefreshing` | L6324, L6346, L6518, L6523, L6966 | L6537, L6581 | — | — |
| `editHistory` | — | L6552, L6882 | L6507 | — |
| `fetchMarketData` | L6081 (early-return error CTA) | L6905 (Load-Data CTA) | — | — |

`editHistory` confirmed CROSS exactly as expected: TRENDS L6507 + INTELLIGENCE L6552/6882.
`marketData`, `isRefreshing`, `isInitialLoading` confirmed CROSS (SHELL banners/gates + INTELLIGENCE),
exactly as expected.

---

## Ambiguities

- `getUserCache` / `isCacheValid` (module-scope fns): consumed by the SHELL cache-age banner AND by
  handlers/init. They are pure helpers (no React state) so "scope" is fuzzy — they would live wherever
  `marketData` caching lives (the hook), and the SHELL banner would call hook-returned values instead.
- `companyProfile` (L1193): only handlers read/write it; never in JSX. It is part of the INTEL data
  fetch chain but technically HANDLER-LOCAL. Classed as folding into the data path.
- `isShowingHistoricalData` / `historicalDataTimestamp` (L444/446): correction to first-pass note —
  these ARE live in SHELL (historical-data amber banner L6291–6315 reads both; the banner's
  "Return to Current" button calls `returnToCurrentData` L6311; the error/cache banners also gate on
  `!isShowingHistoricalData` L6326/6348). SHELL-LOCAL. The L6413 read is the commented refresh block.
- `componentRenderingStatus` (L653): **DEAD** — declared, never read or written. Flag for deletion,
  not migration.

## Surprises / live-vs-commented refresh controls

- **The in-content refresh `<Button onClick={handleRefresh}>` (L6368–6390, inside `{/* … */}` at
  L6366–6432) is COMMENTED OUT.** The `onClick={handleRefresh}` at L6393, and the `isRefreshing`
  reads at L6401/6409/6421, are all inside that JSX comment — NOT live consumers. Comment markers:
  opener `{/*` L6366, two explanatory `//`-style notes L6362/6364, closer `*/}` L6432.
- **There is no live in-page refresh control.** The comment says refresh "moved to header," but no
  live `handleRefresh` JSX `onClick` exists in this file — `handleRefresh` is invoked only via
  `handleRefreshRef` from a window/custom-event listener (L4426). So `handleRefresh`/`smartRefresh`
  have **zero live JSX consumers**; the live refresh trigger is an event listener, not a button here.
- **Two live `fetchMarketData()` JSX onClicks exist** and they straddle the boundary: SHELL
  early-return error state L6081 and INTELLIGENCE "Load Data" CTA L6905 → this is what makes
  `fetchMarketData` CROSS.
- The `<TabsContent value="trends">` placeholder (L6930–6933) is `className="mt-0 hidden"` and empty;
  the real trends UI is the out-of-band `activeTab === "trends"` block at L6494–6511. So the TRENDS
  scope's only data consumer is `editHistory` (L6507) + view state `scoutResearchContext`/`scoutMode`/
  `signalsChatContext` (TRENDS-LOCAL).
- The `competitorData` effect at L1708 is an empty no-op `useEffect(() => {}, [competitorData])`, and
  the L2251–2256 effect is fully commented — both dead.
