# Frontend Phase 5c — market-research page decomposition (structural-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **REWRITTEN 2026-05-31 after the R1 escape hatch.** The pre-R1 version of this plan assumed 5b had rewired the page onto TanStack hooks. It had not — 5b's page→hooks rewire was **descoped** (TD-FE-19), and a Task-0 inventory found three more false premises. The spec was reconciled (Spec 24 round 5; §9 delta 7) and **this plan is rewritten to match**: 5c is now **structural-only**. See `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md` for the full findings this rewrite encodes.

**Goal:** Break `MarketResearchPage.tsx` (7,013 LOC, ~76 `useState`, 9 raw `fetch`, 24 `useEffect`) into a thin routed shell + per-tab containers — **without rewiring its data layer**. The page's existing raw-`fetch` + `useState` server-data flow (which is editable/cascade/timestamp state, not plain server cache — TD-FE-19) **moves into `IntelligenceTab` unchanged**; per-section hook conversion is deferred to 5d–5h. Replace the bespoke `SafeMarketIntelligenceTab` wrapper with `<FeatureErrorBoundary>` **while preserving its prop-sanitization**, and **extract the inline `analysis` (lead-stream) tab into the self-contained legacy unit** at `src/components/market-research/lead-stream/` (annotated → customers/Phase 7), injecting its cross-tab/nav/Strategist coordination as **shell-owned callback props** so the legacy unit imports no feature code.

**Architecture:** `MarketResearchPage.tsx` becomes route-wiring + tab-routing + the shared cross-tab state (the `scoutResearchContext`/`scoutMode` pair) + `<FeatureErrorBoundary>` only, delegating each tab to a container:
- `IntelligenceTab` (genuine market-research — the 5-section surface; **carries the moved raw-`fetch`/`useState`/cascade/timestamp/edit-history logic as-is** until 5d–5h convert it section-by-section),
- `TrendsTab` (a thin router rendering the **legacy** Scout-chat components — `trends` is Scout chat, not an emerging-trends view, per the 5a finding; it lifts the **out-of-band** trends block, not an empty `TabsContent`),
- an `analysis` branch that renders the extracted **legacy** `LeadStreamTab` and passes it shell-owned callbacks.

State is rehomed by a 3-part hoistability test (shared-across-≥2 / not-URL-derivable / not-server-state). Tab-nav stays URL-derived via the existing `getActiveTabFromPath(location.pathname)` parsing (5c does **not** normalize it to `useParams` — out of scope). The one genuine cross-tab pair (`scoutResearchContext`/`scoutMode`, written by the analysis handlers, read by the trends chat) passes all three and is **shell-lifted and passed as props** to both `LeadStreamTab` and `TrendsTab` (default mechanism per the §5 criteria — 2 shallow consumers don't warrant a context).

**Tech Stack:** React 18 + TS (strict), React Router (`useNavigate`/`useLocation`), the page's existing `buildApiUrl` + raw `fetch` data layer (unchanged), `@/features/shell` (`Layout`), `@/shared/components` (`FeatureErrorBoundary`), Vitest + RTL + MSW, knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §5 (round 5 — structural-only), with §2.1, §2.3, §12 R1/R5, §9 deltas 6–7.

**Prerequisite (hard):** **5b (`plans/24b-frontend-phase-5b-data-layer.md`) merged to `master`.** 5c does **not** consume the 5b hooks (the page rewire is deferred — TD-FE-19); 5b is a prerequisite only because 5a/5b established the feature's location + the data-layer scaffolding that 5d–5h will later use. Branch off the latest `master`.

**R1 escape hatch (Spec 24 §12 — already exercised once):** the R1 hatch was invoked pre-implementation on 2026-05-31 and resolved by reconciling the spec (round 5) + rewriting this plan — *not* by abandoning 5c. If 5c implementation reveals **further** cross-tab coupling beyond this rewritten plan (e.g. the moved intelligence logic proves inseparable from the analysis/trends state in a way Task 0's inventory missed), revert 5c and replan (master §5.7); 5a/5b stay merged. Do **not** silently fix-forward through a structural surprise of that magnitude.

**Conventions for every task:** as 24a/24b — npm from `frontend/`; commits from repo root; `type(scope):` subjects, **no** `Co-Authored-By`/`[N/M]` suffixes; per-task `tsc`+`lint` green; **surgical commits by path** (never `git add -A`). **Visual-parity guard is behavioral E2E `journeys/04` + Vitest/RTL — there is no MR pixel VR** (TD-FE-17 / §9 delta 6).

**Failure handling (every task):** if a task's verification reds, fix-forward within that task; if it can't be resolved, **stop and report to the human** — do not silently proceed to the next task. The R1 escape hatch (revert 5c + replan) is reserved for the deep cross-tab-coupling case, not ordinary task failures.

**Task independence / serialization:** **Tasks 1, 3, 4, and 5 all modify `MarketResearchPage.tsx`** and must run **strictly serial** in that order. Task 2 (edits `IntelligenceTab` only, plus deletions) is the *only* task disjoint from the page-editing chain and may run concurrently with 3/4/5 if commits stay surgical — but its prerequisite is Task 1 (IntelligenceTab must exist). Do **not** attempt Tasks 3 ∥ 4 (shared page file → merge conflict). The conventional order below (1→2→3→4→5) is the safe default.

**Key facts from Task 0's inventory (carry these forward — do not re-derive):**
- Tab routing is **URL-derived**: `getActiveTabFromPath()` (page L370–386) maps `location.pathname`'s last segment (`marketintelligence→intelligence`, `leadstream→analysis`, `chatwithscout→trends`); `activeTab` `useState` seeds from it (L388) and a sync `useEffect` (L1884–1890) re-derives on `location.pathname` change; `handleTabChange` (L1863) inverse-maps + `navigate("/your-ai-team/scout/<seg>")`. **Not `useParams`.**
- The route is registered at `App.tsx:129` (`/your-ai-team/scout/:tab`) and is **already wrapped** in `<FeatureErrorBoundary featureName="Market Research">` at `App.tsx:132` (the 5a page-level boundary). 5c does not touch the route registration.
- **intelligence** tab JSX: page L6525–6914 (`marketData ? <SafeMarketIntelligenceTab .../> + EditHistoryPanels : <Load Data CTA>`).
- **analysis** tab JSX: page L6916–6928 (renders `<ScoutLeadStream>` with filter props + 3 callbacks; **does no fetching** — data lives inside `ScoutLeadStream`, already in legacy).
- **trends** chat renders **out of band** at page ~L6494–6511 (gated on `activeTab === "trends"`, **above** the `<Tabs>` body): `<ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode}/>` when `scoutResearchContext` is set, else `<ScoutChatWithHistory initialContext={signalsChatContext} .../>`. The `TabsContent value="trends"` block (L6930–6933) is an **empty `hidden` placeholder**.
- The 3 analysis handlers (`handleChatWithScout` L401, `handleChatAboutCoverage` L1553, `handleSendToStrategist` L1569) are **cross-tab coupled**: they set `scoutResearchContext`/`scoutMode`, call `handleTabChange("trends"/"analysis")`, and `handleSendToStrategist` writes `localStorage["strategistLeadStream"]` + navigates to Strategist.
- `SafeMarketIntelligenceTab` does **prop-sanitization** (8 prop defaults) + wraps in the generic `ErrorBoundary` from `@/components/common/ErrorBoundary`. `MarketIntelligenceTab` is a trivial pass-through (`<MarketIntelligenceSections {...props}/>`); its **only importer is Safe** → both are deletable once Safe is gone. Keep `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts` (5d–5h consume/retire them).
- `useCompanyProfile` **exists** at `src/components/settings/useCompanyProfile.ts` (Phase 3); the page does not adopt it — leave that for 5d–5h.

---

## Task 0: Branch + baseline (inventory already captured)

**Files:** none (verification only).

> Task 0's state/handler inventory was completed during the R1 investigation and is recorded in `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md` + the "Key facts" list above. This task now only re-establishes a clean branch + green baseline (the earlier branch may already exist with no commits).

- [ ] **Step 1: Branch off latest `master` (5b merged)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
HOOKS=frontend/src/features/market-research/hooks
{ test -d "$HOOKS" && [ -n "$(ls -A "$HOOKS" 2>/dev/null)" ] && grep -rqs 'useResearchComponent' "$HOOKS"; } \
  && echo "OK: 5b merged" || echo "STOP: 5b not merged (hooks dir empty or known export missing)"
# the branch may already exist from the R1 investigation (no impl commits); reuse or create
git checkout phase-5c-page-decomposition 2>/dev/null || git checkout -b phase-5c-page-decomposition
git rev-parse --abbrev-ref HEAD   # expect: phase-5c-page-decomposition
```

- [ ] **Step 2: Green baseline** — `cd frontend && npm run preflight` (or the typecheck+lint+test subset for speed). RED before any change → STOP and report (do not start Task 1 on a red baseline). *Note: the 2026-05-31 baseline was green (tsc ✅, lint ✅, vitest 145/145 ✅).*

No commit.

---

## Task 1: Extract `IntelligenceTab` — move the intelligence surface **and its data layer** unchanged

**Files:**
- Create: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Test: `frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx`

> Spec 24 §5 (structural-only), §2.1. The intelligence tab is the **only** genuine market-research tab. This is the **largest** task: `IntelligenceTab` absorbs the intelligence-tab JSX **plus the page's market-research data layer** — the 9 raw `fetch` sites, the six editable data `useState`s (`marketData`, `marketIntelligenceData`, `industryTrendsData`, `regulatoryData`, `competitorData`, `marketEntryData`), their cascade/timestamp-merge logic (`isTimestampNewer`, `data: previousContext`), the `CACHE_DURATION` localStorage cache + `save*ToLocalStorage` helpers, the per-section editing/expand/edit-history `useState`s, and the intelligence-only `useEffect`s. **Move it as-is. Do NOT convert any of it to the 5b hooks** — that is 5d–5h (TD-FE-19). `IntelligenceTab` will be large; that is expected and fine (it gets decomposed section-by-section in 5d–5h).

- [ ] **Step 1: Write the failing render test** — mount `<IntelligenceTab>` (with whatever props/providers it ends up needing — at minimum a router context, since it renders nav-aware children) and assert it renders the intelligence surface (e.g. a known section heading or the "Load Data" CTA branch) without crashing. Use MSW for any fetch the moved data layer fires on mount. Run it; confirm it **fails** (component doesn't exist yet).

- [ ] **Step 2: Create `IntelligenceTab.tsx`** — lift, from the page into this container:
  - the `intelligence`-tab JSX subtree (page L6525–6914): the `marketData ? <intelligence content> : <Load Data CTA>` branch, **but render `MarketIntelligenceSections` directly** (not via the deleted Safe/MarketIntelligenceTab wrappers — see Task 2) plus the `EditHistoryPanel`s it composes;
  - **the market-research data layer**: the 9 raw `fetch` sites + `buildApiUrl` calls, the six editable data `useState`s + their initializers (`getInitial*Data`), the cascade/timestamp-merge logic, the `CACHE_DURATION` cache + `save*ToLocalStorage`/`getUserLocalStorage` helpers, the loading/error/refresh `useState`s + `useEffect`s that drive intelligence;
  - the per-section ephemeral `useState`s (editing/expanded/hasEdits/deletedSections/editHistory/customMessage/showScoutChat/loading/error for marketSize, industryTrends, competitor, regulatory, marketEntry) + their handlers.

  Keep all markup and behavior **identical** (behavioral + visual parity via `journeys/04`). The container reads nothing from the shell except what the intelligence surface genuinely needs; it does **not** receive the analysis/trends state. Imports come from the page's existing import set (move them with the code).

- [ ] **Step 3: Replace the page's intelligence branch with `<IntelligenceTab />`** — in `MarketResearchPage.tsx`, replace the L6525–6914 subtree with `<IntelligenceTab />` and remove every `useState`/handler/`useEffect`/helper/import that moved into the container (and now has zero remaining page references). Leave the analysis + trends branches and their state in place (Tasks 3/4). After this step the page still holds: tab routing, the analysis tab + its handlers/filters, the trends out-of-band block + `scoutResearchContext`/`scoutMode`/`signalsChatContext`, and the `Layout` wrapper.

- [ ] **Step 4: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test
```
> Task 1 is the first (and largest) extraction from the monolithic page, so it runs the **full** `npm run test` suite — a tab-routing or render-branch regression surfaces here, not one task later. `knip` is deferred to Tasks 2/3/4 (the page still imports the to-be-removed wrappers until Task 2).
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract IntelligenceTab container (data layer moved as-is, no hook rewire)"
```

---

## Task 2: Replace `SafeMarketIntelligenceTab` with `<FeatureErrorBoundary>` (sanitization preserved); delete dead wrappers

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Create: `frontend/src/features/market-research/components/intelligence/sanitizeIntelligenceProps.ts` (the preserved sanitization helper, lifted from Safe)
- Test: `frontend/src/features/market-research/components/intelligence/__tests__/sanitizeIntelligenceProps.test.ts`
- Delete: `frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx`
- Delete: `frontend/src/features/market-research/components/MarketIntelligenceTab.tsx` (only importer was Safe)

> Spec 24 §5, §2.3. **Prerequisite: Task 1 (IntelligenceTab exists).** The bespoke wrapper is replaced by the shared boundary — **but `SafeMarketIntelligenceTab` is not just an error wrapper**; it performs real recursive prop-sanitization (Set preservation, object→array coercion, render-unsafe-object stringification, function-prop restore) before rendering `MarketIntelligenceSections`. A blind swap drops that. Preserve it by extracting it to a tested pure function.

- [ ] **Step 1: Write a characterization test for the extracted sanitizer (TDD).** Before moving the logic, pin its behavior so the move is provably faithful. Create `__tests__/sanitizeIntelligenceProps.test.ts` asserting the four behaviors that the inline `JSON.parse(JSON.stringify(...))` round-trip is easy to break:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeIntelligenceProps } from "../sanitizeIntelligenceProps";

// Minimal props factory — only the fields the sanitizer touches; cast through unknown
// to MarketIntelligenceTabProps since the test exercises sanitization, not the full shape.
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
  Run it — it **fails** (`sanitizeIntelligenceProps` doesn't exist yet). The exact prop names (`onRefreshComponent`, `companyProfile`, etc.) must match `MarketIntelligenceTabProps`; if the field shapes differ, adjust the factory to real fields while keeping the four assertions.

- [ ] **Step 2: Move the sanitization into `IntelligenceTab` and wrap in `<FeatureErrorBoundary>`.** The former `SafeMarketIntelligenceTab` is **not** a trivial null-default guard — it runs real defensive logic that must be **preserved verbatim**: (a) a `console.error` scan for "problematic objects" (`checkForObjects`), (b) `companyProfile.targetMarkets` object→array coercion, (c) a recursive `JSON.parse(JSON.stringify(fixedProps, replacer))` sanitization where the replacer converts `Set`→array and `JSON.stringify`s render-unsafe objects (`{channel|channelMix|trigger|description}`) while preserving `industryTrendsRegionalHotspots` as an object, (d) function-prop capture-and-restore around that round-trip, and (e) rebuilding the four `*DeletedSections` props back into `Set`s. **Extract this whole block into a local helper** so it's a faithful move, not a rewrite — create `frontend/src/features/market-research/components/intelligence/sanitizeIntelligenceProps.ts` exporting `sanitizeIntelligenceProps(props: MarketIntelligenceTabProps): MarketIntelligenceTabProps` containing the exact body of the former Safe component (lines 9–127 of the deleted file — the `checkForObjects`/`fixedProps`/`sanitizeProps`/`functionProps`/`sanitizedProps`/`deletedSectionsKeys` logic), returning `sanitizedProps`. Then in `IntelligenceTab`:
```tsx
import { FeatureErrorBoundary } from "@/shared/components";
import { sanitizeIntelligenceProps } from "./sanitizeIntelligenceProps";
// ...
// `intelligenceProps` is the MarketIntelligenceTabProps object IntelligenceTab already
// assembles from its state to feed the sections (formerly passed to SafeMarketIntelligenceTab).
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
  This also folds in the trivial wrapper `<div>` that the deleted `MarketIntelligenceTab` provided (split-view width + `space-y-6`), so deleting `MarketIntelligenceTab` in Step 3 loses no markup. **Boundary granularity criterion:** wrap at the section-composition level inside `IntelligenceTab` (default — one section's crash doesn't blank the whole tab, and it isolates failures the route-level 5a boundary would otherwise escalate to a full-feature blank). The route-level `<FeatureErrorBoundary featureName="Market Research">` at `App.tsx:132` stays as the outer net; this is the inner one (note the distinct `featureName` so the two fallbacks are distinguishable). The former Safe wrapped in the generic `@/components/common/ErrorBoundary`; swapping to `<FeatureErrorBoundary>` is the intended §2.3 change — the *sanitization* is what must survive, not that specific boundary component.

- [ ] **Step 3: Delete `SafeMarketIntelligenceTab` and `MarketIntelligenceTab`.** Confirm no remaining importers first, then remove:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'SafeMarketIntelligenceTab' src   # expect: NO output after IntelligenceTab no longer imports it
grep -rn "from \"./MarketIntelligenceTab\"\|from \"@/features/market-research/components/MarketIntelligenceTab\"" src   # expect: NO output (only Safe imported it; Safe is going)
git rm frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx \
       frontend/src/features/market-research/components/MarketIntelligenceTab.tsx
```
  > If either grep returns a live importer you didn't expect, STOP and report — the deletion premise (Task 0: "only importer is Safe") no longer holds. Do **not** delete `MarketIntelligenceSections` or `MarketIntelligenceTabProps.ts` (5d–5h need them).

- [ ] **Step 4: Green (incl. knip — no orphaned exports) + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress && npm run test
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
# the git rm in Step 3 already staged the deletions; stage the IntelligenceTab edit + the new helper explicitly
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/components/intelligence/sanitizeIntelligenceProps.ts
git commit -m "refactor(fe): replace SafeMarketIntelligenceTab with FeatureErrorBoundary (sanitization preserved)"
```

---

## Task 3: Extract the inline `analysis` (lead-stream) tab into the legacy unit

**Files:**
- Create: `frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx` (joins the existing `lead-stream/*` files)
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §5, §7, R5. **Prerequisite: Task 1.** The `analysis` tab is inline in the page (renders `ScoutLeadStream` + carries `leadStreamFilters`/`opportunityFilter` state). Its 3 handlers are **cross-tab coupled** (set `scoutResearchContext`/`scoutMode`, call tab-nav, write Strategist `localStorage` + navigate). Extracting the tab is what makes the page decomposable. It **stays in legacy** (leave-in-place model), annotated → **customers (Phase 7)**. The legacy unit must import **no** feature code, so the coupled coordination stays **shell-owned** and is passed in as **callback props**; `LeadStreamTab` invokes them but owns no cross-tab/nav logic. (Fully severing the coupling is Phase 7's job.) The analysis tab does **no** fetching, so the shared-GET edge case (§5) is moot.

- [ ] **Step 1: Define the callback prop contract.** `LeadStreamTab` receives, as props:
  - `leadStreamFilters` + `setLeadStreamFilters`, `opportunityFilter` + `setOpportunityFilter` — **OR** owns these `useState`s itself (they are analysis-local, not cross-tab; owning them in the legacy unit is cleaner and reduces the prop surface). **Decision: `LeadStreamTab` owns `leadStreamFilters`/`opportunityFilter` internally** (analysis-local state leaves with the tab); they are removed from the page.
  - `onChatWithScout(leads, reportFilter?)`, `onChatAboutCoverage()`, `onSendToStrategist(lead)` — the three handlers, **kept shell-owned** (they touch `scoutResearchContext`/`scoutMode` + tab-nav + Strategist `localStorage`, which are shell concerns) and passed in as props.

- [ ] **Step 2: Create `LeadStreamTab.tsx` in legacy** containing the lifted `analysis`-tab JSX (the `<ScoutLeadStream …/>` wiring, page L6916–6928) and the `leadStreamFilters`/`opportunityFilter` `useState`s, consuming the three handlers from props. Annotate the top:
```tsx
// HANDOFF → customers (Spec 24 §7). Extracted from MarketResearchPage in 5c; lives in
// legacy until the customers feature (Phase 7) relocates + decomposes it and migrates its
// data layer. Does NOT import feature-internal code (transitional boundary, one-way) —
// cross-tab/nav/Strategist coordination is injected by the feature shell as callback props.
```
  It imports `ScoutLeadStream` from its sibling legacy path (`@/components/market-research/ScoutLeadStream`). It does **not** import from `@/features/market-research/*`. It does no fetching (verify; if some GET surfaces, duplicate it as a raw `fetch` here per §5 default (i) — do **not** import a feature hook).

- [ ] **Step 3: Render the legacy unit from the page's `analysis` branch.** In `MarketResearchPage.tsx`, replace the inline `analysis` JSX (L6916–6928) with:
```tsx
<LeadStreamTab
  onChatWithScout={handleChatWithScout}
  onChatAboutCoverage={handleChatAboutCoverage}
  onSendToStrategist={handleSendToStrategist}
/>
```
  imported from `@/components/market-research/lead-stream/LeadStreamTab` (transitional feature→legacy import — allowed). Remove the page's `leadStreamFilters`/`opportunityFilter` `useState`s (they moved into `LeadStreamTab`). **Keep** the three `handle*` handlers in the page (they're shell-owned — they mutate `scoutResearchContext`/`scoutMode` + nav, finalized in Task 5).

- [ ] **Step 4: Confirm one-way boundary + green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn '@/features/market-research' src/components/market-research/lead-stream   # expect: NO output (legacy must not import the feature)
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract analysis lead-stream tab into legacy unit with shell-owned callback props (HANDOFF customers)"
```

---

## Task 4: Extract `TrendsTab` (thin router over the out-of-band legacy Scout-chat)

**Files:**
- Create: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §5, §2.1, §9 delta 6. **Prerequisite: Tasks 1, 3.** `trends` renders **Scout chat** (`ChatWithScout` / `ScoutChatWithHistory`) — both legacy/leaving. `TrendsTab` is a **thin router** over those legacy components (transitional import), not a genuine MR view. **The real trends chat renders OUT OF BAND** (page ~L6494–6511, above the `<Tabs>` body, gated on `activeTab === "trends"`) — **not** in the empty `hidden` `TabsContent value="trends"` (L6930–6933). `TrendsTab` lifts the out-of-band block; the empty placeholder is removed.

- [ ] **Step 1: Create `TrendsTab.tsx`** rendering the lifted out-of-band `trends` block. It receives the shared cross-tab state as props (finalized in Task 5):
```tsx
// trends = Scout chat (Spec 24 §9 delta 6), NOT an emerging-trends view. This is a
// feature-owned thin router over the LEAVING Scout-chat components (scout / signals),
// kept until scout claims the chat surface. The components it renders are legacy.
interface TrendsTabProps {
  scoutResearchContext: /* the page's scoutResearchContext type */ ...;
  scoutMode: "selected-leads" | "full-list";
  signalsChatContext: SignalsChatContext | null;
  onClearSignalsChatContext: () => void; // wraps sessionStorage.removeItem("signalsChatContext") + setSignalsChatContext(null)
}
// renders:
//   scoutResearchContext
//     ? <ChatWithScout fullPage researchContext={scoutResearchContext} mode={scoutMode} />
//     : <ScoutChatWithHistory initialContext={signalsChatContext} onConsumeContext={onClearSignalsChatContext} ... />
```
  `ChatWithScout` imports from `@/components/market-research/ChatWithScout` (legacy/leaving), `ScoutChatWithHistory` from `@/components/signals/ScoutChatWithHistory` (non-MR). Carry the `signalsChatContext` sessionStorage handoff behavior (the `useEffect` at page L414–430 that reads `sessionStorage.getItem("signalsChatContext")` when `activeTab === "trends"`) — decide in Step 2 whether that effect lives in `TrendsTab` (preferred — it's trends-local) or stays in the shell; if it moves, move `signalsChatContext`'s `useState` with it and drop it from the props.

- [ ] **Step 2: Route the page's `trends` branch to `<TrendsTab/>`.** Replace the out-of-band block (L6494–6511) with `<TrendsTab .../>` passing the shared state, and **remove the empty `TabsContent value="trends"` placeholder** (L6930–6933). The page still holds `scoutResearchContext`/`scoutMode` `useState` at this point (rehomed in Task 5). If Step 1 moved `signalsChatContext` + its effect into `TrendsTab`, remove them from the page here.

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress && npx playwright test journeys/04
```
> Task 4 is the **last structural extraction** — all three tab containers now exist and the page is at its most-changed before the Task 5 state finalization. This is the single mid-sub-phase `journeys/04` checkpoint: it isolates any tab-routing/extraction regression (`marketintelligence`/`leadstream`/`chatwithscout` segments) *before* the state rewrite, so a Task 6 preflight red attributes to Task 5 rather than bisecting back through the extractions. (Spec §8's per-sub-phase cadence is still satisfied at Task 6; this run is a bisectability aid, not an added gate.) **If `journeys/04` reds and the cause is deep cross-tab coupling, invoke the R1 escape hatch** rather than fix-forward.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/trends/TrendsTab.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract TrendsTab router for the out-of-band legacy scout-chat branch"
```

---

## Task 5: Rehome the shared cross-tab state; reduce the page to a thin shell

**Files:**
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Create (only if the criteria below select context over props — they should not): `frontend/src/features/market-research/context/MarketResearchContext.tsx`

> Spec 24 §5 (hoistability criteria + props-vs-context). **Prerequisite: Tasks 1, 3, 4.** With all three tab containers extracted, finalize the page's residual state and reduce it to a thin shell. Apply the §5 hoistability test, then choose the hoist mechanism.

- [ ] **Step 1: Apply the §5 hoistability criteria to the page's residual `useState`.** After Tasks 1/3/4, the page should hold only: tab routing (`activeTab` + the sync effect + `handleTabChange`), the shared cross-tab pair (`scoutResearchContext`, `scoutMode`), possibly `signalsChatContext` (unless Task 4 moved it), and the three shell-owned `handle*` handlers. Classify each:
  - **`activeTab` + routing** → stays URL-derived; keep `getActiveTabFromPath(location.pathname)` parsing **as-is** (5c does not normalize to `useParams` — out of scope). Do not duplicate into context.
  - **`scoutResearchContext` / `scoutMode`** → passes all three hoistability criteria (shared across the analysis handlers + the trends chat = ≥2 consumers; not URL-derivable; not server state). **Mechanism: shell-`useState` lifted and passed as props** to `<TrendsTab>` (read) — the analysis handlers (shell-owned) already write them directly. **Two shallow consumers ⇒ props, not context** (per the §5 default). **Do not create `MarketResearchContext`.** If, and only if, implementation reveals the pair must thread through >2 levels of intermediary components, fall back to a minimal context and record why in the commit body.
  - **`signalsChatContext`** → trends-local; if not already moved into `TrendsTab` in Task 4, move it now (it has a single consumer → no hoist needed, just relocate).
  - **Search/filter state** → none remain in the shell (`leadStreamFilters`/`opportunityFilter` left with `LeadStreamTab` in Task 3). The §5 URL-vs-local filter constraint has no shell-level subject; record "no shareable feature filter" in the commit body.

- [ ] **Step 2: Reduce the page to a thin shell.** `MarketResearchPage.tsx` now: read `activeTab` from the path → render `Layout` + the tab router that routes to `<IntelligenceTab/>` / `<LeadStreamTab .../>` (legacy, with the 3 shell-owned callbacks) / `<TrendsTab .../>` (with the shared pair as props); hold the `scoutResearchContext`/`scoutMode` `useState` + the three `handle*` handlers (shell-owned coordination). No fetch-result/server state in the shell's own `useState` (it all moved into `IntelligenceTab` in Task 1). Keep the existing `Tabs`/`TabsList`/`TabsTrigger` chrome that drives navigation.

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
# add context/MarketResearchContext.tsx too ONLY if Step 1's fallback created it (it should not)
git add frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): thin MarketResearchPage shell; hoist scout cross-tab pair as props (no context — decision recorded)"
```
> Record in the commit body: the per-variable classification, that `scoutResearchContext`/`scoutMode` were hoisted as **props** (not context) because they have 2 shallow consumers, and that `activeTab` stays `location.pathname`-derived (no `useParams` normalization — out of scope for structural-only 5c).

---

## Task 6: Final preflight + done-when + deltas + handoff

**Files:** `specs/24-…` (§9 delta) as needed.

- [ ] **Step 1: Full preflight + behavioral parity**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS incl. `journeys/04`. The journey must still pass for all three URL segments (`marketintelligence`/`leadstream`/`chatwithscout`) — tab routing and the intelligence / lead-stream / scout-chat surfaces render the same as before. **If it reds**, investigate tab-routing/extraction; if the cause is deep cross-tab coupling, invoke the R1 escape hatch (revert 5c, replan — master §5.7) rather than fix-forward.

- [ ] **Step 2: Done-when (Spec 24 §5 "Done when", round 5 — structural-only)**
1. The **page shell** is a thin route-wire + tab router; **no fetch-result/server state in the shell's own `useState`** (the raw-`fetch`/cache machinery moved into `IntelligenceTab` — which **still carries it**; 5c does NOT remove raw `fetch` from the feature — that completes across 5d–5h, confirmed at 24i).
2. The lead-stream tab is an annotated unit in `src/components/market-research/lead-stream/` importing **no** feature code (verified one-way boundary, Task 3); cross-tab/nav coordination injected as shell-owned callback props; its own data access lives inside the `ScoutLeadStream` it renders.
3. `SafeMarketIntelligenceTab` is gone and `<FeatureErrorBoundary>` replaces it **with the prop-sanitization preserved** in `IntelligenceTab` (Task 2); `MarketIntelligenceTab` is gone; `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts` remain (for 5d–5h).
4. The props-vs-context decision for `scoutResearchContext`/`scoutMode` is recorded (expected: props, no context).
5. Behavior parity (`journeys/04`) + `npm run preflight` green.

- [ ] **Step 3: Deltas + handoff** — append a Spec 24 §9 note recording: the context decision (props, not context), that 5c was structural-only (no hook rewire — the page raw-`fetch`/cache now lives in `IntelligenceTab` for 5d–5h to convert), and confirming `trends`=Scout-chat / `analysis`=lead-stream both route to legacy (only `intelligence` is genuine). Then `/review-impl` → `/synthesize-impl-review` (design-heavy — warrants a fuller sign-off per §10) → controller preflight → merge `phase-5c-page-decomposition` → `master`. **5d–5h read from the now-isolated `IntelligenceTab`, converting its raw `fetch` to the 5b hooks section-by-section (each deleting its page-origin `fetch`/cache slice — Spec 24 §6).**

---

## Self-review notes (plan author)

- **Spec coverage (round 5, structural-only):** §5 tab containers (Tasks 1, 3, 4) + thin shell (Task 5); **structural-only data move, no hook rewire** (Task 1 — TD-FE-19); Safe→FeatureErrorBoundary **with sanitization preserved** (Task 2); inline analysis extraction to legacy + **shell-owned callback props** for the cross-tab coupling + one-way boundary (Task 3); **out-of-band trends block** + empty-placeholder removal (Task 4); **scout pair hoisted as props, not context** (Task 5); §5 "Done when" (Task 6).
- **R1 findings encoded:** G1 (data layer raw-`fetch`, moved unchanged), G2 (`useCompanyProfile` exists, page adoption deferred to 5d–5h), G3 (analysis-handler coupling → shell-owned callback props), G4 (out-of-band trends render), G5 (Safe sanitization preserved).
- **R1 escape hatch re-armed:** if implementation hits coupling beyond *this* rewritten plan, revert 5c + replan (not fix-forward); 5a/5b stay merged.
- **Serialization:** Tasks 1, 3, 4, 5 all edit the page → strictly serial; Task 2 edits IntelligenceTab + deletions (concurrent-safe after Task 1). Do not run 3 ∥ 4.
- **Identifiers for downstream (24d–24h):** sections live under `components/intelligence/<section>/`; `IntelligenceTab` is the decomposition target carrying the raw `fetch`/cache; `MarketIntelligenceTabProps` is deleted as the last section converts (≤ 5h — 24i confirms); each section sub-phase deletes its page-origin `fetch`/cache slice (Spec 24 §6).
