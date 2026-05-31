# Frontend Phase 5c — market-research page decomposition + state rehoming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the `MarketResearchPage.tsx` (spec §1.2: 7,013 LOC, 49 `useState`; 5a observed ~79 — Task 0's inventory resolves the live count) into a thin routed shell + per-tab containers, rehome the `useState` soup by explicit criteria, replace the bespoke `SafeMarketIntelligenceTab` wrapper with `<FeatureErrorBoundary>`, and **extract the inline `analysis` (lead-stream) tab out of the feature into a self-contained legacy unit** in `src/components/market-research/lead-stream/` (annotated → customers/Phase 7) — leaving the page decomposable for the per-section work in 5d–5h.

**Architecture:** `MarketResearchPage.tsx` becomes route-wiring + tab-routing + `<FeatureErrorBoundary>` only, delegating each tab to a container: `IntelligenceTab` (genuine market-research — the 5-section surface reading from 5b hooks), `TrendsTab` (a thin router rendering the **legacy** Scout-chat components — `trends` is Scout chat, not an emerging-trends view, per the 5a finding), and an `analysis` branch that renders the extracted **legacy** lead-stream unit. State is rehomed by a 3-part test (shared-across-≥2 / not-URL-derivable / not-server-state) — anything failing all three stays `useState`; nav state stays in the URL; server state is already in TanStack (5b). The lead-stream extraction moves the inline `analysis`-tab JSX + its handlers + its filter state into `src/components/market-research/lead-stream/` so a legacy unit never imports feature-internal hooks; the feature's tab router renders it via the transitional exception.

**Tech Stack:** React 18 + TS (strict), React Router (`useParams`/`useNavigate`), TanStack Query (5b hooks), `@/features/shell` (`Layout`), `@/shared/components` (`FeatureErrorBoundary`), Vitest + RTL + MSW, knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §5 (and §1.3.5, §2, §12 R1/R5).

**Prerequisite (hard):** **5b (`plans/24b-frontend-phase-5b-data-layer.md`) merged to `master`.** 5c reads from the 5b hooks (`useResearchComponent`/`useRegenerateResearch`, `useCompanyProfile`; the page hydrates per-component — there is no `useLatestResearch`). Branch off the latest `master`. **R1 escape hatch (Spec 24 §12):** if 5c reveals cross-tab coupling beyond this plan (the page is one `React.memo` — hidden shared state may resist clean tab extraction), revert 5c and replan (master §5.7); 5a/5b stay merged.

**Conventions for every task:** as 24a/24b (npm from `frontend/`; commits from root; `type(scope):`, no `Co-Authored-By`/`[N/M]`; per-task `tsc`+`lint` green). **Visual-parity guard remains behavioral E2E `journeys/04` + Vitest/RTL — no MR pixel VR.**

**Failure handling (every task):** if a task's verification step reds, fix-forward within that task; if it can't be resolved, stop and report to the human — do not silently proceed to the next task. The R1 escape hatch (revert 5c + replan) is reserved for the deep cross-tab-coupling case, not ordinary task failures.

**Task independence:** Task 2 (edits `IntelligenceTab` only) and Task 3 (edits the page + creates `LeadStreamTab`) touch disjoint files with no data dependency — their serial ordering is conventional, not dependency-driven, and they may be reordered or run concurrently if the executor keeps commits surgical (per-path). The converse: the page-editing tasks — **1, 3, 4, and 5 all modify `MarketResearchPage.tsx`** — must stay serial relative to each other; Task 2 is the *only* task disjoint from that chain and therefore the only safely-concurrent one. Do not attempt Tasks 3 ∥ 4 (shared page file → merge conflict).

**Decisions this plan must make (spec §13 defers these to `24c`) — made by the criteria below, recorded in the commit/PR:**
- Whether `MarketResearchContext` exists at all, and its shape (Task 5 criteria).
- Search/filter state → URL vs local + history mode (Task 5 — but note the filters live on the *analysis* tab, which **leaves**; see Task 3).
- The shared-GET edge case for the lead-stream unit (Task 3 — default (i) duplicate; 5a/5b found the analysis tab does no fetching, so likely moot).

---

## Task 0: Branch + baseline + state/handler inventory

**Files:** none (verification only).

- [ ] **Step 1: Branch off latest `master` (5b merged)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
HOOKS=frontend/src/features/market-research/hooks
{ test -d "$HOOKS" && [ -n "$(ls -A "$HOOKS" 2>/dev/null)" ] && grep -rqs 'useResearchComponent' "$HOOKS"; } \
  && echo "OK: 5b merged" || echo "STOP: 5b not merged (hooks dir empty or known export missing)"
git checkout -b phase-5c-page-decomposition
```

- [ ] **Step 2: Green baseline** — `cd frontend && npm run preflight` (or subset). RED before any change → STOP.

- [ ] **Step 3: Inventory the page's state, handlers, and tab branches**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/pages/MarketResearchPage.tsx
echo "=== useState ==="; grep -cn 'useState' "$P"; grep -n 'useState' "$P"
echo "=== tab routing ==="; grep -n 'getActiveTabFromPath\|activeTab\|setActiveTab\|TabsContent value=' "$P"
echo "=== analysis/lead-stream handlers + state ==="; grep -n 'handleChatWithScout\|handleChatAboutCoverage\|handleSendToStrategist\|leadStreamFilters\|opportunityFilter\|ScoutLeadStream' "$P"
echo "=== trends (scout chat) branch ==="; grep -n 'ChatWithScout\|ScoutChatWithHistory\|scoutResearchContext\|"trends"' "$P"
echo "=== Safe* wrappers ==="; grep -rn 'Safe' src/features/market-research src/components/market-research
echo "=== MarketIntelligenceTab role (pre-resolves Task 2's deletion conditional) ==="; grep -rn 'MarketIntelligenceTab' src
```
Record three classification buckets for the `useState` set (5a anchor: ~79): **server** (already on hooks after 5b — should be gone/going), **ephemeral UI** (dialogs, drafts, expand toggles, interim loading), **cross-tab/section shared coordination** (e.g. `scoutResearchContext`, refresh orchestration). Note that `leadStreamFilters` + `opportunityFilter` + the three `handle*` handlers belong to the **analysis** tab (they leave in Task 3), and `scoutResearchContext`/`signalsChatContext` (sessionStorage-backed) feed the **trends** Scout-chat branch (leaves with TrendsTab's legacy targets).

No commit.

---

## Task 1: Extract `IntelligenceTab` (the genuine market-research surface)

**Files:**
- Create: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Test: `frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx`

> Spec 24 §2.1, §5. The intelligence tab is the **only** genuine market-research tab. `IntelligenceTab` owns the 5-section composition (today `SafeMarketIntelligenceTab` → `MarketIntelligenceTab` → `MarketIntelligenceSections`). Move the intelligence-tab JSX + its ephemeral state out of the page into this container; sections still read 5b hooks (they fully convert in 5d–5h).

- [ ] **Step 1: Write the failing render test** — mount `<IntelligenceTab>` inside `QueryClientProvider` + MSW; assert it renders the section surface (e.g. a known section heading) without crashing.

- [ ] **Step 2: Create `IntelligenceTab.tsx`** — lift the `TabsContent value="intelligence"` subtree + the intelligence-only ephemeral `useState` (expand toggles, edit/dialog state) from the page into this container. It composes `MarketIntelligenceSections` **imported as-is** from its current (post-5a) location — 5c does **not** rename, re-export, or decompose it (section decomposition is 5d–5h) — and consumes 5b hooks for data. Keep markup identical (behavioral + visual parity via `journeys/04`).

- [ ] **Step 3: Replace the page's intelligence branch with `<IntelligenceTab />`**; remove the lifted state from the page.

- [ ] **Step 4: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test
```
> Task 1 is the first extraction from the monolithic page, so it runs the **full** `npm run test` suite (not just the intelligence-scoped subset) — a tab-routing or render-branch regression surfaces here, not one task later.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx \
        frontend/src/features/market-research/components/intelligence/__tests__/IntelligenceTab.test.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract IntelligenceTab container from market-research page"
```

---

## Task 2: Replace `SafeMarketIntelligenceTab` with `<FeatureErrorBoundary>`; drop unused `Safe*`

**Files:**
- Modify: `frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx`
- Delete: `frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx` (+ `MarketIntelligenceTab.tsx` if it was only Safe's inner shell)

> Spec 24 §5, §2.3. The bespoke error wrapper is replaced by the shared boundary. CLAUDE.md gotcha: only `SafeMarketIntelligenceTab` of the three `Safe*` wrappers is in active paths — confirm before deleting any other.

- [ ] **Step 1: Wrap the intelligence content in `<FeatureErrorBoundary>`** inside `IntelligenceTab` (or rely on the page-level boundary from 5a if a single boundary suffices — decide per the error-isolation granularity you want; **criterion:** choose a section-level boundary in `IntelligenceTab` when independent section failures should be isolated (default — one section's crash doesn't blank the tab); choose page-level only when the sections share enough state that isolating one adds no real resilience).

- [ ] **Step 2: Remove `SafeMarketIntelligenceTab`** and any now-orphaned thin wrapper (`MarketIntelligenceTab` if it only existed to feed Safe — resolve from Task 0 Step 3's `MarketIntelligenceTab` importer grep: if its only importer was `SafeMarketIntelligenceTab`, delete it too; otherwise keep). Confirm no remaining importer:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'SafeMarketIntelligenceTab' src   # expect: NO output after removal
git rm src/features/market-research/components/SafeMarketIntelligenceTab.tsx
```

- [ ] **Step 3: Green (incl. knip — no orphaned exports) + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress && npm run test
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
# the `git rm` in Step 2 already staged the deletion(s); stage the IntelligenceTab edit explicitly
git add frontend/src/features/market-research/components/intelligence/IntelligenceTab.tsx
git commit -m "refactor(fe): replace SafeMarketIntelligenceTab with FeatureErrorBoundary"
```

---

## Task 3: Extract the inline `analysis` (lead-stream) tab into the legacy unit

**Files:**
- Create: `frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx` (joins the existing `lead-stream/*` files)
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx` (render the legacy unit via the transitional exception)

> Spec 24 §1.3.5, §5, §7, R5. The `analysis` tab is inline in the page (it renders `ScoutLeadStream` + carries `leadStreamFilters`/`opportunityFilter` state + the `handleChatWithScout`/`handleChatAboutCoverage`/`handleSendToStrategist` handlers). Extracting it is what makes the page decomposable. It **stays in legacy** (leave-in-place model), annotated → **customers (Phase 7)**, and **keeps its own data access** so the legacy unit never imports feature hooks. 5a/5b found the analysis tab does **no** market-research fetching, so the shared-GET edge case (§5.1) is almost certainly moot — default (i) (duplicate any GET it needs as raw `fetch`) applies only if one surfaces.

- [ ] **Step 1: Create `LeadStreamTab.tsx` in legacy** containing the lifted `analysis`-tab JSX (`<ScoutLeadStream …/>` wiring), the `leadStreamFilters`/`opportunityFilter` `useState`, and the three `handle*` handlers. Annotate the top:
```tsx
// HANDOFF → customers (Spec 24 §7). Extracted from MarketResearchPage in 5c; lives in
// legacy until the customers feature (Phase 7) relocates + decomposes it and migrates its
// data layer. Does NOT import feature-internal hooks (transitional boundary, one-way).
```
It imports `ScoutLeadStream` from its sibling legacy path and the chat/strategist context utils it already used. If it needs the latest-research GET (it should not — verify), duplicate it as a raw `fetch` here (default (i)); do **not** import `@/features/market-research/hooks/*`.

- [ ] **Step 2: Render the legacy unit from the page's `analysis` branch**
In `MarketResearchPage.tsx`, replace the inline `analysis` JSX + handlers + filter state with `<LeadStreamTab />` imported from `@/components/market-research/lead-stream/LeadStreamTab` (transitional legacy import — feature → legacy is allowed). Remove the lifted state/handlers from the page.

- [ ] **Step 3: Confirm one-way boundary + green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn '@/features/market-research' src/components/market-research/lead-stream   # expect: NO output (legacy must not import the feature)
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/market-research/lead-stream/LeadStreamTab.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract analysis lead-stream tab into legacy lead-stream unit (HANDOFF customers)"
```

---

## Task 4: Extract `TrendsTab` (thin router over legacy Scout-chat)

**Files:**
- Create: `frontend/src/features/market-research/components/trends/TrendsTab.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §2.1, §5. `trends` renders **Scout chat** (`ChatWithScout` / `ScoutChatWithHistory`) — both legacy/leaving (scout / signals). `TrendsTab` is therefore a **thin router** over those legacy components (transitional import), not a genuine MR view. This is the last *mechanical* extraction; the judgment-laden residual-state rehoming + context decision is split out into Task 5 so each half has a single reviewer-verifiable scope.

- [ ] **Step 1: Create `TrendsTab.tsx`** rendering the lifted `trends` branch: `ChatWithScout` (from `@/components/market-research/ChatWithScout`, legacy/leaving) when `scoutResearchContext` is present, else `ScoutChatWithHistory` (from `@/components/signals/ScoutChatWithHistory`, non-MR). Carry the `scoutResearchContext`/`signalsChatContext` sessionStorage handoff with it. Annotate that its rendered components are leaving (scout) — `TrendsTab` itself is a feature-owned router, kept until scout claims the chat surface.

- [ ] **Step 2: Route the page's `trends` branch to `<TrendsTab/>`** and remove the lifted trends JSX from the page. (The page still holds residual `useState` at this point — it is rehomed and the shell finalized in Task 5.)

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress && npx playwright test journeys/04
```
> Task 4 is the **last structural extraction** — all three tab containers now exist and the page is at its most-changed before the Task 5 state rewrite. This is the single mid-sub-phase `journeys/04` checkpoint: it isolates any tab-routing/extraction regression (`marketintelligence`/`leadstream`/`chatwithscout` segments) *before* state rehoming, so a Task 6 preflight red can be attributed to Task 5 rather than bisected back through the extractions. (Spec §8's per-sub-phase cadence is still satisfied at Task 6; this run is a plan-quality bisectability aid, not an added gate.)
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/components/trends/TrendsTab.tsx \
        frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): extract TrendsTab router for the legacy scout-chat branch"
```

---

## Task 5: Rehome residual state + decide `MarketResearchContext`; reduce page to thin shell

**Files:**
- Create (only if criteria met): `frontend/src/features/market-research/context/MarketResearchContext.tsx`
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §2.1, §5. With all three tab containers extracted (Tasks 1, 3, 4), apply the state-rehoming criteria to whatever `useState` remains in the page, decide whether `MarketResearchContext` exists, and reduce the page to a thin shell. This is the judgment half of the old combined task — reviewed independently of the TrendsTab extraction.

- [ ] **Step 1: Apply the state-rehoming criteria to the page's residual `useState`** (Spec 24 §5 — precedent for Phases 6–12):
  - **server state** → already TanStack (5b); none should remain in page `useState`. If any does, route it to a hook.
  - **`activeTab`** → stays URL-derived (`getActiveTabFromPath`/`useParams`); do not duplicate into context.
  - **ephemeral** (dialogs, drafts, interim loading) → local `useState` in the decomposed piece that owns it (`IntelligenceTab`/`TrendsTab`/sections).
  - **`MarketResearchContext`** holds *only* state that is **(a)** shared across ≥2 sections/tabs, **(b)** not derivable from URL, **(c)** not server state. **If nothing meets all three, create no context** (delete the on-demand `context/` dir). Most cross-tab state has left (lead-stream filters → Task 3; scout-chat context → TrendsTab), so the expected outcome is *no context* or a minimal one (e.g. an intelligence-tab "refresh all sections" coordinator). Record the decision + the per-variable classification in the commit body.
  - **Search/filter URL-vs-local:** the only filters (`leadStreamFilters`/`opportunityFilter`) left with the analysis tab (Task 3), so the feature has no shareable primary filter to URL-encode. If a genuine intelligence-tab filter exists, apply the §5 URL-vs-local constraint (URL for simple shareable filters; local or `replace`-mode for complex/rapid). Record per filter.

- [ ] **Step 2: Reduce the page to a thin shell** — `MarketResearchPage.tsx` now: read `:tab` → route to `<IntelligenceTab/>` / `<LeadStreamTab/>` (legacy) / `<TrendsTab/>`; render `Layout`; the 5a `<FeatureErrorBoundary>` wrap stays at the route. No fetch-result/server state in page `useState`.

- [ ] **Step 3: Green + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test && npx knip --strict --no-progress
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
# stage the page; add context/MarketResearchContext.tsx as well if Step 1 created it
git add frontend/src/features/market-research/pages/MarketResearchPage.tsx
git commit -m "refactor(fe): thin MarketResearchPage shell; rehome residual state (context decision recorded)"
```

---

## Task 6: Final preflight + done-when + deltas + handoff

**Files:** `specs/24-…` (§9 delta) as needed.

- [ ] **Step 1: Full preflight + behavioral parity**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS incl. `journeys/04`. The journey must still pass for all three URL segments (`marketintelligence`/`leadstream`/`chatwithscout`) — tab routing and the lead-stream/scout-chat surfaces render the same as before. **If it reds**, investigate the tab-routing/extraction; if the cause is deep cross-tab coupling, invoke the R1 escape hatch (revert 5c, replan — master §5.7) rather than fix-forward.

- [ ] **Step 2: Done-when (spec §5 "Done when")**
1. The page is a thin shell + tab router; no fetch-result/server state in page `useState`.
2. The lead-stream tab is a self-contained annotated unit in `src/components/market-research/lead-stream/` (carrying its own data access; one-way boundary verified Task 3).
3. The feature's own modules have no raw `fetch` (the legacy lead-stream unit it renders may); `SafeMarketIntelligenceTab` is gone.
4. The `MarketResearchContext` decision (created-or-not + why) is recorded.
5. Behavior parity (`journeys/04`) + `npm run preflight` green.

- [ ] **Step 3: Deltas + handoff** — append a Spec 24 §9 note recording the context decision and confirming `trends`=Scout-chat / `analysis`=lead-stream both route to legacy (only `intelligence` is genuine). Then `/review-impl` → `/synthesize-impl-review` (design-heavy — warrants a fuller sign-off per §10) → controller preflight → merge `phase-5c-page-decomposition` → `master`. **5d–5h read from the now-clean `IntelligenceTab` + 5b hooks.**

---

## Self-review notes (plan author)

- **Spec coverage:** §5 tab containers (Tasks 1, 3, 4) + thin shell (Task 5); state rehoming criteria + context decision (Task 5); URL-vs-local filter constraint (Task 5 — noting filters leave with analysis); Safe→FeatureErrorBoundary (Task 2); inline analysis extraction to legacy + one-way boundary + shared-GET default (Task 3); §5 "Done when" (Task 6).
- **Divergences encoded (from 5a):** `trends` = Scout chat (TrendsTab is a thin legacy router, not an emerging-trends view); `analysis` = lead-stream with no fetches (shared-GET edge moot); only `intelligence` is genuine MR.
- **R1 escape hatch wired:** if tab extraction hits coupling beyond plan, revert 5c + replan (not fix-forward); 5a/5b stay merged.
- **Identifiers for downstream (24d–24h):** sections live under `components/intelligence/<section>/` and read 5b hooks via `IntelligenceTab`; `MarketIntelligenceTabProps` is deleted as the last section converts (≤ 5h — 24i confirms).
