# Spec 24 — Frontend Phase 5: Feature Extraction — market-research

**Status:** Design — round 5 (rounds 1–3 reviews `docs/reviews/24-frontend-phase-5-market-research-design-spec-review-{1,2,3}.md` synthesized at `…-spec-synthesis-{1,2,3}.md`; round 5 reconciles §4/§5 with shipped 5b reality after the 5c R1 escape hatch — see §9 delta 7 / `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md`)
**Date:** 2026-05-30 (rounds 1–4); 2026-05-31 (round 5 — R1 reconciliation)
**Type:** Phase spec (child of master Spec 14 §4 — Phase 5)
**Paired plan:** none yet — sub-plans `24a`…`24i` ship per sub-phase as it begins

---

## §1 Goal and context

### 1.1 Goal

Extract the market-research surface — `src/pages/MarketResearch.tsx` plus the *genuinely market-research* parts of `src/components/market-research/*` — into `src/features/market-research/`, **fully decomposed**: the 7k-LOC page split along its tab structure, the data layer moved onto TanStack Query, and each giant section component broken into single-purpose files. Feature parity is mandatory (behavioral + pixel-level visual). This is the **hardest feature, taken first** by design (master Spec 14 §4, R5/R6) — it surfaces the worst cross-feature coupling early and proves the feature-extraction pattern for Phases 6–12.

### 1.2 Starting state (post-Phase-4, measured 2026-05-30)

| Aspect | Current state |
|---|---|
| Page | `src/pages/MarketResearch.tsx` — **7,013 LOC**, a single `React.memo` component (**≈76 distinct `useState` hooks** — 88 `useState(` tokens incl. the import line + setter-only `const [, setX]` forms; `24c` Task-0 count; the round-1 "49" was an undercount — plus **24 `useEffect`**, `useCallback`/`useRef`). Post-Phase-1 (was 14,956). `MarketResearch_clean.tsx` duplicate **verified absent** (a Phase 1 target — master §4 Phase 5). The `useState` set is dominated by **per-section ephemeral editing state** (editing/expanded/hasEdits/deletedSections/editHistory/customMessage/showScoutChat/loading/error ×5 sections) plus six **editable** data states (see §4 note / TD-FE-19) — not ~76 independent shared variables. |
| Components | `src/components/market-research/` — **21,384 LOC across 33 files**. |
| Giant sections | MarketEntrySection 3,872 · RegulatoryComplianceSection 2,766 · CompetitorLandscapeSection 2,648 · IndustryTrendsSection 1,863 · MarketSizeSection 1,661. |
| Tab structure | The page renders **3 tabs**: `intelligence` (the core — composes the five section components via the `SafeMarketIntelligenceTab`/`MarketIntelligenceTab`/`MarketIntelligenceSections` wrapper layer), `analysis` (**= lead-stream**; `tabIsLeadStream = activeTab === "analysis"`), `trends` (emerging-trends view). `activeTab` is path-derived. |
| Data layer | **9 raw `fetch()` calls** (not even `apiFetch`) resolving to **2 endpoints** (§4.1), **68 `localStorage` refs** behind a hand-rolled 5-min cache (`CACHE_DURATION` at line 246; the load even cache-busts via `?_cb&_r`), 4 `sessionStorage`. **Zero** TanStack Query / `apiFetch` / `useQuery`. Phase 3's adoption never touched this file — its caching layer is the gnarliest in the app. |
| Section data flow | Sections receive tab/search/result state by **prop drilling** through the `MarketIntelligenceTabProps` interface (`MarketIntelligenceTabProps.ts`, 248 LOC). |
| Phase 4 conventions in place | Scaffolder `npm run scaffold:feature -- <name>` (emits `types.ts`/`index.ts`/`README.md`; `pages/`/`components/`/`hooks/`/`services/` on demand). `<FeatureErrorBoundary>` at `src/shared/components/FeatureErrorBoundary.tsx`. Central query-key factory `qk` at `src/shared/api/queryKeys.ts` (array-tuple keys). Shared `client.ts` + single `RateLimiter` + `queryClient.ts` + per-domain `contracts/` at `src/shared/api/`. Dependency-rule lint live; **transitional exception** permits importing from legacy dirs (`src/lib`, `src/utils`, `src/hooks`, `src/contexts`, `src/pages`, `src/components`) through Phase 12. `market-research` is already on the naming map (kebab-case). |
| Safety net (Phase 0) | Behavioral E2E `frontend/e2e/journeys/04-market-research-5-components.spec.ts`; visual-regression snapshots (2% `maxDiffPixelRatio`); `e2e/fixtures/api-mocks.ts` + `e2e/helpers/mask-dynamic.ts`. Vitest + RTL + MSW harness from Phase 0b. |

> LOC are a point-in-time anchor (2026-05-30). Sub-phase plans re-measure from their own start point.

### 1.3 Decisions reached during brainstorming

These are settled (see §13 for the deferred items):

1. **Depth — full decomposition.** Not relocate-only and not relocate-plus-page-split-only. The five giant section components are broken into single-purpose files *within Phase 5* (overlaps Phase 13's mandate — see §9.5).
2. **Sequencing — relocate → data → decompose (horizontal).** Mechanical relocation first (clean landing zone), then the data layer, then structural decomposition reading from clean hooks.
3. **Contracts — feature-local.** Market-research zod contracts live in `src/features/market-research/contracts.ts` — a single file suffices for feature-local scope; Phase 3's per-domain `contracts/` *directory* is for the cross-cutting shared contract surface. A single-feature shape stays in the feature per the ≥2-features promotion rule. Captured as an ADR; sets precedent for Phases 6–12.
4. **Caching — memory-only.** TanStack Query memory cache, no persister; the hand-rolled localStorage cache is retired. Resolves master Spec 14 §8 Q9 toward simplicity + Phase 3 consistency + MVP velocity, accepting reload re-fetch. Captured as an ADR.
5. **Leaving components — stay in place, annotated.** *"Leaving components"* = components that belong to **other** features and will move to them in later phases. They **stay in `src/components/market-research/`** — not pulled into the feature. Per master §4 Phase 5's 5c handoff mechanism, each is annotated with its target feature; the owning phase relocates + decomposes it. `src/components/market-research/` shrinks to only leaving components and is deleted once empty (≤ Phase 9). See §7. (This honors master 5c literally — see §9.1.)
6. **Query keys — extend the central `qk` factory** (Phase 3 convention). **Services/hooks — feature-owned** under `features/market-research/`.

### 1.4 Sub-split (`5a`–`5i`)

| Sub-phase | Plan | Mission |
|---|---|---|
| 5a | `24a` | Relocate genuine market-research into `features/` — mechanical, parity-preserving, no behavioral change |
| 5b | `24b` | Data layer → TanStack Query (memory-only) + feature-local zod contracts + 2 ADRs; retire raw `fetch`/localStorage cache |
| 5c | `24c` | Page decomposition along the 3 tabs + state rehoming; extract inline lead-stream tab to legacy |
| 5d | `24d` | Decompose `MarketEntrySection` (3,872) |
| 5e | `24e` | Decompose `RegulatoryComplianceSection` (2,766) |
| 5f | `24f` | Decompose `CompetitorLandscapeSection` (2,648) |
| 5g | `24g` | Decompose `IndustryTrendsSection` (1,863) |
| 5h | `24h` | Decompose `MarketSizeSection` (1,661) |
| 5i | `24i` | Finalize: `index.ts` public surface, `README.md`, handoff annotations, dead-code sweep |

**Why per-section (5d–5h):** each 1.6k–3.9k section is an independent, agent-context-bounded decomposition; per-section sub-plans keep each plan + review scoped to one section's blast radius (master R6: "extract in N commits, each narrowly scoped to a section"). This was the explicit depth + sequencing decision in brainstorming. **Batching escape-hatch:** the 5d-family plan author *may* batch the smaller sections (e.g., IndustryTrends + MarketSize) into one sub-plan with **per-section commits** (preserving per-section revert); the largest (MarketEntry 3,872) stays its own sub-plan. Batching is a plan-level call, not mandated here.

Each sub-phase is a discrete, independently-green commit series with its own plan + review cycle (§10). A sub-phase that can't reach green reverts to the prior sub-phase commit without unwinding the whole phase (master §5.7).

### 1.5 Scope

**In scope:** everything under `src/pages/MarketResearch.tsx` and the *genuinely market-research* parts of `src/components/market-research/` (the page, the five sections, the intelligence-tab composition layer, the trends view, market-research-only dialogs/drawers/hooks), plus the feature's data layer and the two ADRs.

**Out of scope (frozen interfaces — parity-tested):**
- The HTTP API contract (request/response shapes, headers, status, the 30 req/min rate-limit boundary).
- Route URLs — whatever `App.tsx` maps to MarketResearch (and its `:tab` segments `intelligence`/`analysis`/`trends`) stays byte-identical; only the modules behind them move.
- Visual output — pixel-level visual regression stays green; Tailwind consolidation only if visually neutral.
- The E2E suite location (`frontend/e2e/`, centralized).
- **Leaving components** (other features' code) — not moved, not decomposed; they stay in `src/components/market-research/` annotated (§7).
- Cross-feature dedup that requires `src/shared/` promotion (Phase 11) and global codemod-worthy patterns (Phase 13).

Out-of-scope discoveries are logged to `docs/TECH_DEBT.md` as `TD-FE-<n>`.

---

## §2 Architecture target

### 2.1 Target feature tree

```
src/features/market-research/
├── pages/
│   └── MarketResearchPage.tsx        # thin routed shell + tab router, wrapped in <FeatureErrorBoundary>
├── components/
│   ├── intelligence/                 # intelligence-tab composition + the 5 decomposed sections
│   │   ├── IntelligenceTab.tsx       # intelligence tab container (created by 5c)
│   │   ├── market-entry/             # MarketEntrySection decomposed:
│   │   │   ├── MarketEntrySection.tsx #   section container
│   │   │   └── …                      #   focused sub-components + section hook
│   │   ├── regulatory-compliance/    # (same shape: container + sub-components + hook)
│   │   ├── competitor-landscape/
│   │   ├── industry-trends/
│   │   └── market-size/
│   └── trends/
│       └── TrendsTab.tsx             # `trends`-tab container (created by 5c) — a thin router over the leaving Scout-chat components, NOT an emerging-trends view (§9 delta 6)
├── hooks/                            # useQuery/useMutation wrappers (server state)
├── services/                         # fetch fns over shared client.ts + RateLimiter
├── contracts.ts                      # feature-local zod schemas (.parse at boundary, z.infer types)
├── types.ts                          # feature-local non-contract types
├── README.md                         # purpose, public surface, key files, pending handoffs
└── index.ts                          # public re-exports (the cross-feature surface)
```

**Leaving components are not in this tree.** lead-stream/, `StrategistWorkspace`, `ScoutChatPanel`/`ChatWithScout`, and the `Scout*` cluster stay in `src/components/market-research/` until their owning phase claims them (§7). The feature imports any it renders from there via the transitional legacy-import exception. Directories are created **on demand** (Phase 4 convention) — no empty dirs, no `.gitkeep`. The exact sub-component breakdown inside each section folder is a per-sub-phase plan decision (§13).

### 2.2 Dependency rules + public surface

- `features/market-research/` may import from itself, `shared/`, `components/ui/`, npm, and — under the transitional exception (Phases 4b–12) — legacy dirs (incl. the leaving components still in `src/components/market-research/`). 5a leans on this so it does **not** have to drag cross-cutting helpers into `shared/` now (that's Phase 11).
- Cross-feature consumption is via `index.ts` only; no circular feature deps (if one appears, the shared surface moves to `src/shared/`, not resolved inside this feature).
- **Anticipated public surface (non-binding, validated in 5i):** signals (Phase 8) consumes market-research *output*, so the likely `index.ts` surface is the research-result/report types + a results-read hook. 5c–5h keep those exportable as a guideline; if a section nonetheless buries a result type in a deeply-private module, **5i includes a surface-extraction restructure** (no behavior change) to lift it — the guideline is a default, not an enforced gate. The exact surface is locked in 5i once internals stabilize, informed by Phase 8's needs; no in-phase consumer exists, so it is deliberately not finalized early.

### 2.3 Mapping (old → new)

| Old | New |
|---|---|
| `src/pages/MarketResearch.tsx` | `features/market-research/pages/MarketResearchPage.tsx` (+ tab containers) |
| `src/components/market-research/<Section>Section.tsx` | `features/market-research/components/intelligence/<section>/` (decomposed) |
| `MarketIntelligenceTab(Props)` / `SafeMarketIntelligenceTab` / `MarketIntelligenceSections` | rationalized into `components/intelligence/` (Safe wrapper replaced by `<FeatureErrorBoundary>`) |
| raw `fetch` + localStorage cache | `services/` + `hooks/` + central `qk` extension + memory-only TanStack cache |
| prop-drilled `MarketIntelligenceTabProps` | hook consumption (sections read their own data) |
| **leaving components** (lead-stream, Strategist*, Scout*) | **stay in `src/components/market-research/`**, annotated → owning feature (§7) |

---

## §3 Sub-phase 5a — Relocate (mechanical, parity)

**Mission:** move the *genuine* market-research surface into `features/market-research/` with **no behavioral change** — the handoff annotations, `<FeatureErrorBoundary>` wrapping, and the `Scout*` import-tracing (§7) are additive/non-behavioral — so all later decomposition happens in the new location against one set of import paths.

**Actions:**
- `npm run scaffold:feature -- market-research` (emits `types.ts`/`index.ts`/`README.md`).
- Move the page → `pages/MarketResearchPage.tsx`; move the genuine-market-research components → `components/`. **Leaving components stay put** in `src/components/market-research/` (§7) with an in-code `// HANDOFF → <feature>` annotation + a "Pending handoffs" stub in `README.md`. Rewrite imports, leaning on the transitional legacy-import exception (incl. for any leaving component the page still renders).
- Wrap the routed page in `<FeatureErrorBoundary>` (from `src/shared/components/`).
- Update `App.tsx` route imports to the new module paths. **Route URLs unchanged.**

> The `analysis` (lead-stream) tab is inline in the page, so its code rides into the feature *inside* `MarketResearchPage.tsx` in 5a; 5c extracts it back out to the legacy `lead-stream/` unit (§5). 5a does not attempt to separate it.

**Done when:** market-research renders from `features/market-research/`; `src/pages/MarketResearch.tsx` is gone; the genuine components moved; leaving components remain in `src/components/market-research/` annotated; routes resolve; E2E (`journeys/04`) + Vitest + `npm run preflight` green (visual parity via behavioral E2E + Vitest; **no MR pixel VR** — §9 delta 6 / TD-FE-17). One reviewable mechanical diff.

---

## §4 Sub-phase 5b — Data layer → TanStack Query

**Mission:** replace the 9 raw fetches + localStorage cache with the Phase 3 data-layer pattern, so section decomposition (5c–5h) targets clean hooks instead of prop-drilled fetch results.

### 4.1 Endpoint inventory (rough; verified live in 5b)

The 9 raw fetches resolve to **2 endpoints** (via the existing `buildApiUrl(...)` builder), not nine:

| Call sites (`MarketResearch.tsx`) | Endpoint | Method | Purpose (approx) |
|---|---|---|---|
| 2115 | `market-research` (cache-busted `?_cb&_r`) | GET | load latest research |
| 2820, 2948, 2981, 3252, 3480, 3759, 4088 | `market-research` | POST | research operations (generate/refresh — incl. competitor, see line 3977), dispatched by request body |
| 2483 | `profile/company?org_id=` | GET | company profile — Phase-3 hook (`useCompanyProfile`, `src/components/settings/useCompanyProfile.ts`) **exists but the page has not adopted it** — it still fetches company-profile itself (adoption is a 5d–5h item, §4 amendment) |

**Implications for 5b:** the seven POSTs share one endpoint distinguished by payload → a small set of typed service fns over `market-research`; the company-profile GET **reuses Phase 3's existing hook/contract**, not a new one. Line/site numbers are a **pre-5a anchor** — once 5a relocates the file they shift, so 5b re-identifies sites by searching `fetch(` + `buildApiUrl` in the moved file, not by line number; the exact operation set + request/response shapes are verified live (`/docs`/`curl`) per the polyglot rule — 5b's first task. **All 9 page fetches are market-research-proper** — the round-5 inventory confirmed the `analysis` (lead-stream) tab does **no** page-level fetching (it renders `ScoutLeadStream`, which holds any data access internally and already lives in legacy). The earlier "tag each site by owning tab / exclude the analysis sites" framing resolves to **9 market-research-proper / 0 analysis** and is therefore moot (kept here only as the trace's conclusion, not an action).

### 4.2 Actions

- `services/` — one fetch fn per `market-research` operation over the shared `client.ts` + the **existing** shared `RateLimiter` (30/min is a single frozen budget — no second limiter).
- `contracts.ts` — feature-local zod schemas for the `market-research` operations; `.parse` at the fetch boundary, static types via `z.infer`. Shapes verified live (§4.1).
- `hooks/` — `useQuery`/`useMutation` wrappers; query keys added to the central `qk` factory (`src/shared/api/queryKeys.ts`). Company-profile reads route through Phase 3's `useCompanyProfile`.
- ~~Rewire the (still-monolithic) page to consume the hooks; delete those raw `fetch` sites, the `CACHE_DURATION` cache, and the 68 localStorage refs that back it.~~ **DESCOPED during 5b execution (TD-FE-19 / §4 amendment below) — the page→hooks rewire is NOT done in 5b; it redistributes to 5c (structural relocation into `IntelligenceTab`) + 5d–5h (per-section hook conversion, deleting each section's raw `fetch`/cache slice as it converts).** The page therefore still holds all 9 raw `fetch` sites + the `CACHE_DURATION` localStorage cache after 5b. `sessionStorage` used as primary state (if any survives) is left alone — that's not cache.
- **Prerequisite:** confirm/extend the Phase 0b **MSW** handlers (and `e2e/fixtures/api-mocks.ts`) for the `market-research` operations; missing handlers are 5b work, not assumed-present.
- **ADRs** (in `docs/adr/`): (1) market-research contracts are feature-local; (2) TanStack cache is memory-only for market-research (resolving master §8 Q9).

**Done when (as shipped — amended 2026-05-31, §9 delta 7):** the market-research data layer exists and is tested — feature-local `contracts.ts`, `services/marketResearch.ts`, `hooks/useMarketResearch.ts` (`useResearchComponent` + `useRegenerateResearch`), `qk.marketResearchComponent`, MSW handlers, the `{ status, data }` E2E envelope fix, and both ADRs — so section conversion (5d–5h) targets clean hooks (this satisfies R3). **The page→hooks rewire was descoped during 5b execution and is NOT done here.**

> **§4 amendment (TD-FE-19, logged 2026-05-31).** Plan 24b Task 6 intended to rewire the page and delete the server-data `useState`s, but execution found that premise false: the six data states (`marketData`, `marketIntelligenceData`, `industryTrendsData`, `regulatoryData`, `competitorData`, `marketEntryData`) are **editable UI state, not server caches** — per-component fetchers send `data: previousContext` for cascading, responses are reconciled by timestamp-merge (`isTimestampNewer`), and the states carry ~113 `setX` callsites plus full edit-history. The flat hooks don't model this; deleting the states would destroy edit/cascade/timestamp behavior. So the page **still holds 9 raw `fetch` sites + the `CACHE_DURATION` localStorage cache + `?_cb&_r` cache-busting + `save*ToLocalStorage`**. The page-level raw-`fetch`/cache removal therefore moves to **5c (structural relocation, no rewire)** + **5d–5h (per-section hook conversion, where each section's cascade/timestamp/edit-history slice converts or is consciously dropped per its section plan)**. `24i` confirms zero raw `fetch` + zero `CACHE_DURATION` remain in the feature at phase close. Full record: TD-FE-19; ADR-0004 scope note. **Company-profile** reads still route through the existing Phase-3 `useCompanyProfile` (`src/components/settings/useCompanyProfile.ts`) — that hook exists; the page just hasn't adopted it yet (a 5d–5h adoption, not a new hook to build).

---

## §5 Sub-phase 5c — Page decomposition + state rehoming

**Mission:** break the 7k-LOC page into a thin shell + tab containers and rehome the ~76-`useState` soup. **5c is structural-only** — it relocates JSX + state into tab containers; it does **not** wire the page to the 5b hooks (that rewire was descoped from 5b and distributes into 5d–5h — §4 amendment / TD-FE-19).

**Actions:**
- `MarketResearchPage.tsx` becomes a thin shell (route wiring + tab routing + `<FeatureErrorBoundary>`), delegating each tab to a container: `IntelligenceTab`, `TrendsTab`, and an `analysis` branch that renders the **legacy** lead-stream unit (below).
- **State rehoming (structural, hook-first — R1 event #2, §9 delta 8):** the page's existing **raw-`fetch` + `useState` server-data flow is extracted UNCHANGED into a `useMarketResearchData()` hook** — **not** into `IntelligenceTab`. The data layer is **shell-coupled** (shell status banners, the `isRefreshing` loading-gate + refresh `Dialog`, and the trends tab's `editHistory` all read it), so it cannot live inside one tab; the shell calls the hook **once** and threads slices to the tabs as props. 5c does not convert it to hooks (the six data states are editable/cascade/timestamp state, not plain server cache — §4 amendment; per-section TanStack conversion of the hook's internals is 5d–5h). `activeTab` → stays URL-derived (`getActiveTabFromPath` reads `location.pathname`; **not** `useParams`); ephemeral state (open dialogs, input drafts, interim loading, the per-section editing flags) → local `useState` in the tab container / section that owns it; genuinely-shared coordination → `MarketResearchContext` **or** shell-lifted props per the criteria below. **Search/filter state** follows the URL-vs-local constraint below; its exact treatment is a `24c` decision (§13), not settled here.
- **Cross-tab shared state (the R1 finding — corrects the "no context expected" presumption):** the `analysis`-tab handlers write `scoutResearchContext`/`scoutMode`, which the `trends`-tab chat reads. That pair passes all three hoistability criteria (shared across ≥2 tabs, not URL-derivable, not server state) — so it **must be hoisted out of the page body**, and by the criteria's default (2 consumers, shallow) the expected mechanism is **shell-`useState` lifted and passed as props to both `LeadStreamTab` and `TrendsTab`**, not necessarily a context. The point is that **5c is not expected to land at zero shared state** — this is the cross-tab coupling R1 flagged, handled in-plan rather than via revert; 5c records the props-vs-context call.
- **URL-vs-local constraint:** URL params carry top-level navigation + *simple, shareable* primary filters; ephemeral inputs stay local. Complex or rapidly-changing filter state may stay local or use `replace`-mode history to avoid history pollution (and URL-length/encoding limits). 5c picks per filter once the actual filter shapes are known.
- **Context placement criteria** (precedent for Phases 6–12): the three criteria — **(a)** shared across ≥2 sections/tabs, **(b)** not derivable from URL params, **(c)** not server state (TanStack owns that) — determine whether state may be *hoisted out of a single component at all*; state failing any of them stays local `useState` (or goes to URL params if it's navigation state). For state that **passes all three**, the hoist *mechanism* is a second choice: **lift to the nearest common owner and pass as props** when the consumer set is small and shallow (the default — e.g. the `scoutResearchContext`/`scoutMode` pair, 2 consumers), or **create `MarketResearchContext`** when prop-drilling would span many levels or >2 consumers. **If nothing passes all three, no context AND no hoist — everything stays local.** (So "meets all three" gates *hoistability*, not *context specifically*; context is the heavier of two hoist options.)
- Replace the bespoke `SafeMarketIntelligenceTab` wrapper with `<FeatureErrorBoundary>`; drop any unused `Safe*` wrappers. **Note (R1 finding):** `SafeMarketIntelligenceTab` is **not just an error wrapper** — it performs real **prop-sanitization** before rendering its inner tab (and wraps in a generic error boundary, not an MR-specific one). 5c must **preserve that sanitization** (move it into `IntelligenceTab`) when swapping the boundary, or consciously document its removal with rationale in the plan/commit — a blind swap silently drops behavior. The inner `MarketIntelligenceTab` wrapper is deletable once Safe is gone (its only importer is Safe; keep `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts`, which 5d–5h consume/retire). The 24c plan carries the exact symbol/import-path detail.
- **Extract the inline `analysis` (lead-stream) tab** out of the page into the legacy `src/components/market-research/lead-stream/` unit (joining the existing lead-stream files), annotated **→ customers (Phase 7)**. It **keeps its own raw `fetch` data access** (un-migrated by 5b, per §4.2) — so the legacy unit does not import feature hooks; Phase 7 migrates its data layer when it claims the component. The feature's tab router renders it via the transitional exception. This stays in legacy, not the feature (leave-in-place model, §7); extracting it is what makes the page decomposable.
- **Analysis-handler coupling (R1 finding).** The three handlers (`handleChatWithScout`/`handleChatAboutCoverage`/`handleSendToStrategist`) are **not self-contained**: they write the cross-tab `scoutResearchContext`/`scoutMode`, call the tab-nav helper (`handleTabChange("trends"/"analysis")`), and write Strategist `localStorage` + navigate. 5c keeps that coordination **shell-owned** and passes it **into** the legacy `LeadStreamTab` as **callback props** — the legacy unit renders the lead-stream UI and invokes the callbacks, but imports no feature hook and owns no cross-tab/nav logic. This preserves the one-way boundary (feature→legacy) while honoring the structural-only / leave-in-place posture: severing the coupling fully (self-contained handlers) is **Phase 7's** job when customers claims the component, not 5c's.
- **Shared-GET edge case:** the `analysis` tab does **no** market-research fetching (the 5a/5c traces confirm it only renders `ScoutLeadStream` with filter props + the 3 callbacks; data lives inside `ScoutLeadStream`), so the shared-GET case is **moot** in practice. If one nonetheless surfaces, default **(i)**: duplicate the GET as raw `fetch` in the legacy `lead-stream/` unit (duplication over coupling for transitional code); **(ii)** promote the service fn to `src/shared/` only if duplication proves untenable. 5c decides; default is (i).
- **Trends render shape (R1 finding).** The real `trends` chat renders **out of band** — above the `<Tabs>` body, gated on `activeTab === "trends"` (`<ChatWithScout>` when `scoutResearchContext` is set, else `<ScoutChatWithHistory>`) — **not** inside `TabsContent value="trends"`, which is an empty `hidden` placeholder. `TrendsTab` lifts that out-of-band block (a thin router over the leaving Scout-chat components, §9 delta 6); the empty placeholder is removed.

**Done when:** the **page shell** is a thin route-wire + tab router with **no fetch-result/server state held in the shell's own `useState`** (the raw-`fetch`/cache machinery moved into the `useMarketResearchData()` hook, which the shell delegates to and which still carries the raw `fetch` until its internals convert in 5d–5h — **5c does not remove raw `fetch` from the feature**; that completes across 5d–5h, confirmed at 24i); the lead-stream tab is an annotated unit in `src/components/market-research/lead-stream/` importing no feature hook (cross-tab/nav coordination injected as shell-owned callback props), with any data access living inside the `ScoutLeadStream` it renders (the page itself fetches nothing for this tab — §4.1); `SafeMarketIntelligenceTab` is replaced by `<FeatureErrorBoundary>` with its prop-sanitization preserved (or its removal documented); the props-vs-context decision for the `scoutResearchContext`/`scoutMode` pair is recorded; parity (`journeys/04`) + preflight green.

---

## §6 Sub-phases 5d–5h — Section decomposition (one per giant section)

**Mission:** break each of the five section components into single-purpose files.

**Per-section pattern (MarketEntry / RegulatoryCompliance / CompetitorLandscape / IndustryTrends / MarketSize):**
- A section container + focused presentational sub-components + a section-data hook (consuming 5b) + local types, under `components/intelligence/<section>/`.
- Replace the section's slice of the `MarketIntelligenceTabProps` prop surface with hook consumption. `MarketIntelligenceTabProps.ts` is **deleted when its last consuming section converts** (≤ 5h); 5i's dead-code sweep confirms it is gone.
- **No hard LOC cap** (master §6) — target single-purpose files that fit in agent context. The exact file breakdown per section is a 5d–5h plan decision.
- Vitest + RTL tests for the section's hook + logic-bearing sub-components (§8).
- **Delete the page's raw `fetch`/cache machinery for this section as it converts.** Because 5b's page→hooks rewire was descoped (§4 amendment / TD-FE-19) and 5c only *relocates* the raw data flow into `IntelligenceTab`, the actual removal of each section's raw `fetch` site + its slice of the `CACHE_DURATION`/localStorage cache + cascade/timestamp/edit-history handling happens **here**, when that section adopts `useResearchComponent`/`useRegenerateResearch` (migrating or consciously dropping each behavior per the section plan). This is the deferred half of the data-layer milestone (master Phase 5); 24i's zero-raw-`fetch` / zero-`CACHE_DURATION` gate depends on every section sub-phase doing it.

**Ordering + batching:** largest first (MarketEntry → … → MarketSize), so the worst context-pressure section is done while scaffolding is freshest. Per the §1.4 escape-hatch, the smaller sections may be batched into one sub-plan with per-section commits.

**Done when (each):** the section renders from `components/intelligence/<section>/` as a tree of single-purpose files reading from hooks; the legacy section file is gone; **the page's raw `fetch` site + cache slice for this section is removed** (per the bullet above); that section's unit tests pass; E2E + visual + preflight green.

---

## §7 Sub-phase 5i — Finalize + handoff annotations

**Mission:** lock the public surface and record what doesn't belong.

**Actions:**
- Define `index.ts` — the minimal public surface other features consume (signals in Phase 8; see §2.2). Everything else stays private.
- Backfill `README.md`: purpose, public surface, key files, dependency notes, **Pending handoffs** table.
- Dead-code sweep within the feature (`knip --strict` clean).

**Leaving components — stay in `src/components/market-research/` (LOC anchored to §1.2; this table is reconciled with the 5a whole-dir import trace — see §9 delta 6):**

| Component(s) (stay-put under `src/components/market-research/`) | LOC | Target feature | Claiming phase |
|---|---|---|---|
| `StrategistWorkspace.tsx` | 959 | **strategist** | per naming map |
| `lead-stream/*` (LeadsTable 770, leadData 676, OpportunityDashboard 243) + extracted `analysis`-tab code | ~1.7k | **customers** | per naming map |
| `EditDropdownMenu.tsx` (5a trace: sole importer `customers/SuggestedICPCards`) | 41 | **customers** | per naming map |
| `ScoutChatPanel.tsx` 678, `ChatWithScout.tsx` 251 | ~0.9k | **scout** | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm` 134, `ScoutDeploymentDetails` 67, `ScoutLeadStream` 62) — **5a-confirmed scout** | ~0.26k | **scout** | per naming map |
| `AddLeadModal.tsx` 198, `SuggestedCompaniesSection.tsx` 53 (5a trace: sole importer `signals/ScoutChatWithHistory`) | ~0.25k | **scout** | per naming map |

> Annotations name the **target feature**, not a phase number, because master §4 and the Phase 4b naming map disagree on numbers (§9.4). The claiming phase reads this table before planning (master §4 Phase 5's 5c handoff mechanism). The `Scout*` config cluster's stay/leave **was confirmed per-file by the 5a import trace** (§9 delta 6); `ScoutCapabilities.tsx` (46) had been a scout *candidate* here, but the trace found it has **zero importers** — it is reclassified **dead code** (below), not a scout leaver. `EditDropdownMenu`, `AddLeadModal`, `SuggestedCompaniesSection` were **not** in this table pre-5a — the trace found each is imported only from another feature, so they leave too. `src/components/market-research/` is **deleted once empty** (≤ Phase 9).

**Dead code in legacy found by the 5a trace (zero live importers; deleted in 5i, TD-FE-18 — NOT handoffs, they belong to no feature):** `CompetitorAnalysis` 151, `CompetitorAnalysisDrawer` 333 (only importer is dead `CompetitorAnalysis`), `ComponentStatusLoadingScreen` 366, `DataHistoryDialog` 1258, `EmergingTrends` 108, `EmergingTrendsDrawer` 258 (only importer is dead `EmergingTrends`), `RecentMarketResearch` 142, `ScoutCapabilities` 46. They stay annotated `// DEAD CODE → delete in 5i` until 5i's sweep removes them. (Knip does not flag them: `knip.json` `entry` makes every `src/**` file a production entry, so it never reports unused *files*.)

> **Genuine, not leaving (5a trace):** `AIPromptingInterface.tsx` (500) is genuine market-research (rendered via `MarketDetailDrawer`); 5a moved it into the feature as the **12th** genuine file (the §3-implied 11 + AIPI). `types.ts` (`EditRecord`/`TrendSnapshot`/`IndustryTrendsRecommendations`) is shared by the moved sections **and** `signals`, so it stays in legacy as transitional shared infra — moved files import it via `@/components/market-research/types`; promotion to `shared/` is Phase 11, not a 5a handoff.

**Done when:** `index.ts` + `README.md` complete; handoff table is authoritative; `knip --strict` clean; preflight green.

---

## §8 Testing & safety net (cross-cutting, every sub-phase)

- **Vitest + RTL** for logic-bearing units — data hooks, transforms, interactive components — not every trivial presentational shell. **MSW** backs hook tests with canned API responses (handler coverage confirmed/extended in 5b — §4.2).
- **Behavioral E2E** (`frontend/e2e/journeys/04-market-research-5-components.spec.ts`) + **visual regression** stay green **between every sub-phase** — the primary guard that decomposition preserved behavior. If the journey proves too thin for a given sub-phase, extend it (existing tests must stay green — master §2.3).
- `npm run preflight` (typecheck → lint → format → Vitest → build → bundle:check advisory → Playwright + visual → `knip --strict`) green before each sub-phase merge. No fix-forward through a red preflight (master §5.3).

---

## §9 Master Spec 14 amendments

Applied at sub-phase merges via the synthesize-impl-review "master-plan deltas" step (master §5.5):

1. **Leaving-component model (clarification, not override).** Master §4 Phase 5's 5c directs leaving components to "stay in their current pre-extraction location." Those components are co-located *inside* `src/components/market-research/`; this spec honors 5c literally — they stay there (not pulled into the feature), and the dir empties as Phases 7/8/9 claim them. Recorded because the co-location makes "stay in place" non-obvious (the dir is otherwise vacated). No master override.
2. **Status table (§4) — amendment.** Mark Phase 5 → in progress now, → done (with date) at final merge.
   - *5a-merge action (not itself an amendment):* verify Phase 3 and Phase 4 rows read "done" — they are merged — and correct if still "pending" (observed stale in at least one working copy).
3. **Sub-split deviation.** Master §4 Phase 5 sketched 5a/5b/5c; this spec uses 5a–5i because full decomposition was chosen. Mapping: **master 5a → 5a, master 5b → 5b, master 5c → 5c + 5d–5h + 5i.** Record the finer split.
4. **Phase-number reconciliation.** Master §4 overview (signals 8 · scout 9 · settings 10) conflicts with the Phase 4b `features/README.md` naming map (signals 6 · scout 8 · settings 11). Pre-existing drift, surfaced (not caused) by Phase 5. Recommend reconciling the master plan to one source of truth; until then handoffs reference target features by name. Log as a master-plan delta (or `TD-FE-<n>` if not resolved at Phase 5 merge).
5. **Phase 13 boundary (recommendation, not assertion).** Phase 13 **should expect** its market-research pass to narrow to verification + cross-feature dedup + codemod extraction (first-time decomposition done here), **assuming 5d–5h decomposition quality meets Phase 13's standards — Phase 13's spec re-evaluates.** Note in master §4 Phase 13.
6. **5a findings (recorded at 5a merge).** Confirmed against `App.tsx`: the frozen route is `/your-ai-team/scout/:tab` (segments `marketintelligence`/`leadstream`/`chatwithscout` ↔ internal keys intelligence/analysis/trends), with `/market-research` + `/your-ai-team/scout` redirects — superseding the §1.2 shorthand. The `trends` tab renders **Scout chat** (`ChatWithScout`/`ScoutChatWithHistory`), not an emerging-trends view, and `analysis` renders `ScoutLeadStream`; only the `intelligence` tab is genuine market-research (the §2.1 `trends/TrendsTab` becomes a thin router over leaving Scout-chat — see 5c). **The 5a whole-dir import trace refined the §7 leaving inventory:** (i) the genuine moved set is **12** files (the §7-implied 11 + `AIPromptingInterface`, live via `MarketDetailDrawer`); (ii) **3 leavers not in the §7 table** were found and annotated — `AddLeadModal` + `SuggestedCompaniesSection` → **scout** (importer `signals/ScoutChatWithHistory`), `EditDropdownMenu` → **customers** (importer `customers/SuggestedICPCards`); (iii) the `Scout*` config file `ScoutCapabilities` is **dead** (0 importers), not a live scout leaver — it joins **8 dead files** annotated `// DEAD CODE → delete in 5i` (TD-FE-18) for the §7 5i sweep; (iv) `types.ts` is shared by the moved sections **and** `signals`, so it stays in legacy (moved files import it transitionally via `@/components/market-research/types`; promotion to `shared/` is Phase 11). **Visual parity for all of Phase 5 is behavioral E2E (`journeys/04`) + Vitest/RTL — there is no market-research pixel-VR baseline (TD-FE-17 logged 5a). This supersedes every "visual" / "visual regression" parity-guard assertion in this spec for the market-research surface: §1.2 (safety-net row), §3 & §6 "Done when", §8 (testing/preflight), §11 (phase DoD item 5), and R4.**
7. **5b descope + 5c R1 reconciliation (recorded 2026-05-31).** Spec §4 (rounds 1–4) directed 5b to rewire the page to the new hooks and leave "only the analysis tab's raw `fetch`." During 5b execution that rewire was **descoped** (TD-FE-19): the six data `useState`s are editable/cascade/timestamp state, not plain server cache, so the flat hooks can't replace them without losing behavior. The page therefore still runs 9 raw `fetch` + the `CACHE_DURATION` localStorage cache. When 24c's Task-0 inventory hit this (plus the cross-tab coupling of the `analysis` handlers to `trends`/nav), the **5c R1 escape hatch was invoked pre-implementation** and resolved by **reconciling this spec** (round 5: §1.2, §4 amendment, §5 rewrite, §12 R1/R5, §13) rather than abandoning 5c. Net effect on the master plan: Phase 5's "data layer → hooks" milestone is **delivered across 5b (layer) + 5c (structural relocation) + 5d–5h (page/section rewire)**, not at the 5b boundary — no scope dropped, only resequenced. Findings of record: `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md`.
8. **5c re-cut — hook-first (R1 escape-hatch event #2, recorded 2026-05-31).** Delta 7 / §5 directed the data layer to move into `IntelligenceTab`. When 24c implementation began, a verified data-layer inventory (`docs/reviews/24c-frontend-phase-5c-data-layer-inventory.md`) found the data layer is **shell-coupled** — `marketData`/`isRefreshing`/`isInitialLoading` are read by shell chrome (status banners, the `isRefreshing` loading-gate + refresh `Dialog`) and `editHistory` is read by the **trends** tab (`ScoutChatWithHistory`) — so it **cannot** live inside one tab. The R1 hatch fired again (event #2); no impl commits existed to revert. Resolution (human-decided): **re-sequence hook-first** — extract `useMarketResearchData()` first (shell calls it once, threads slices to the tabs as props), then decompose the tabs. Boundary = **full data+edit hook** (all six data states + lifecycle + the fetch/cache/cascade/refresh engine + the per-section edit/expand state + the cross-tab `editHistory`); dead code is **dropped, not migrated** (`componentRenderingStatus` L653 unread, the commented in-page refresh `Button`, the dead effects L1708/L2251). §5's "moves into `IntelligenceTab`" is superseded by "moves into `useMarketResearchData()`". No master-plan scope change — still structural-only; TanStack conversion of the hook's internals remains 5d–5h. `useMarketResearchData` is distinct from 5b's `useMarketResearch`/`useResearchComponent` (the future TanStack target whose hooks 5d–5h adopt inside it).

---

## §10 Per-phase workflow

- Adversarial cycle per master §5: spec → review-spec → synthesize → writing-plans → review-plan → synthesize → impl → review-impl → synthesize → human-approved merge. **Further review rounds at each stage are the orchestrator's judgement call** (master §5.2), not an automatic loop.
- **Sub-plan granularity + incremental merge:** each `24a`…`24i` is its own plan + review + impl, and **merges to `master` incrementally** when green (not one terminal merge). `phase-5-market-research` is the working branch; each sub-phase branches from / re-syncs onto the latest `master` before its merge, so no long-lived branch accumulates weeks of drift (`sync.sh` / other work may land on master between sub-phases). Revert is per sub-phase (master §5.7); the whole phase reverts only if the *phase as a whole* can't reach done.
- Branch in the main repo (per user direction — no separate worktree); surgical commits by path.
- Human checkpoints: approve spec→plan, plan→impl, impl→merge for each sub-phase; controller runs `npm run preflight` immediately before each merge. **Approval depth is the orchestrator's judgement** (master §5.2) — mechanical sub-phases (5a relocate, 5i finalize) may warrant a lighter sign-off than the design-heavy ones (5b data layer, 5c page decomposition).

---

## §11 Definition of done (phase)

1. `src/features/market-research/` holds the decomposed page + tab router + decomposed sections + hooks/services + `contracts.ts` + `types.ts` + `README.md` + `index.ts`.
2. `src/pages/MarketResearch.tsx` is gone and the genuine market-research components are in the feature; `src/components/market-research/` retains only the annotated leaving components (lead-stream, `StrategistWorkspace`, `ScoutChatPanel` + `Scout*` cluster), which Phases 7/8/9 relocate — the dir is deleted once empty.
3. Data layer is TanStack Query (memory-only); no raw `fetch` or localStorage cache in the feature — **completed across 5d–5h** (5b built the layer; 5c relocates the still-raw page data into `IntelligenceTab`; each section converts to hooks as it decomposes, its cascade/timestamp/edit-history slice migrating or being consciously dropped per its section plan — §4 amendment / TD-FE-19). `24i` confirms zero raw `fetch` + zero `CACHE_DURATION` remain at phase close.
4. Routes resolve to the feature; **URLs unchanged**.
5. Vitest + RTL coverage for the feature's logic-bearing units; `journeys/04` E2E green (visual parity via behavioral E2E; **no MR pixel VR** — §9 delta 6); `npm run preflight` green.
6. Both ADRs (feature-local contracts; memory-only cache) merged.
7. Handoff table authoritative; master Spec 14 deltas applied.

---

## §12 Risks and mitigations

- **R1 — Coupling worse than mapped.** The page is one 7k `React.memo`; hidden cross-tab state may resist clean tab extraction. *Mitigation:* 5a is mechanical (no logic); 5b kills shared server state before structural cuts; if 5c reveals coupling beyond the plan, revert 5c and replan (master §5.7) — earlier sub-phases stay merged. **Invoked 2026-05-31 (pre-implementation):** the 24c Task-0 inventory surfaced (a) 5b's page→hooks rewire was descoped (TD-FE-19), so the page still uses raw `fetch`/`useState`, not the hooks §5 assumed, and (b) the `analysis` handlers are cross-tab-coupled to `trends` + nav. **Resolved by spec reconciliation (this round-5 revision)**, not by abandoning 5c: 5c is reframed structural-only with the rewire distributed to 5d–5h and the analysis coupling handled via shell-owned callback props (§5). Full findings: `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md` (§9 delta 7).
- **R2 — Data-layer shape drift.** Endpoints lack `response_model`; static contract inference misleads. *Mitigation:* 5b verifies every shape live against a running backend before writing the zod contract (§4.1).
- **R3 — Prop-drilling → hooks blast radius.** Replacing `MarketIntelligenceTabProps` touches every section. *Mitigation:* horizontal sequencing — hooks exist (5b) before sections convert (5d–5h), one section per sub-phase, each independently green.
- **R4 — Visual diffs from incidental Tailwind/markup changes.** *Mitigation:* visual regression at 2% between every sub-phase; class consolidation only when visually neutral; re-baseline only for intentional, reviewed changes.
- **R5 — Leaving-component entanglement.** The `analysis`/lead-stream tab is *inline* in the page, not a clean import — and its handlers are coupled to `trends` state + tab-nav + Strategist (R1 finding). *Mitigation:* 5c extracts it into the legacy `lead-stream/` unit (leave-in-place model) and injects the cross-tab/nav/Strategist coordination as **shell-owned callback props** so the legacy unit imports no feature hook (one-way boundary); fully severing that coupling is Phase 7's job when customers claims it. The feature imports the unit transitionally until Phase 7. Separate-file leavers (`StrategistWorkspace`, `ScoutChatPanel`, `Scout*`) stay untouched in `src/components/market-research/`.
- **R6 — Agent context blow-up on the 7k page / 3.9k sections.** *Mitigation:* extract in narrowly-scoped commits per master R6; E2E + visual are the executable spec the agent verifies against without holding the whole file in context.
- **R7 — Memory-only reload re-fetch (accepted).** Dropping the localStorage cache means results re-fetch on reload, pushing more calls through the 30/min limiter. *Mitigation:* accepted per decision §1.3.4 (ADR records it). The 30/min sufficiency under memory-only is not meaningfully testable pre-launch (0 users) — that measurement is itself the post-launch revisit trigger, consistent with the repo's dropped-NFR-gating posture (master §8 Q3).

---

## §13 Open questions

**Resolved in this spec:** decomposition depth (full); sequencing (relocate→data→decompose); contracts location (feature-local, single file); cache (memory-only); leaving-component model (stay-in-place) + target mapping; query-key placement (central `qk`); context placement criteria (§5); rough endpoint inventory (§4.1).

**Deferred to sub-phase plans:**
- The exact `market-research` operation set + verified-live request/response shapes (`24b`).
- The exact route URL(s) + `:tab` segments as currently configured in `App.tsx` (`24a`/`24c` confirm; they stay frozen).
- The per-section file breakdown inside each `components/intelligence/<section>/` (`24d`–`24h`).
- Whether `MarketResearchContext` is created, **or** the shared `scoutResearchContext`/`scoutMode` pair is shell-lifted and passed as props — and the chosen shape (`24c`). Note: the R1 finding established this pair **does** meet the §5 context criteria, so 5c is **not** expected to reach zero shared state; the open question is the mechanism (context vs props), not whether shared state exists.
- **Search/filter state → URL vs local** policy + history mode, per the §5 constraint (`24c`). The only filters (`leadStreamFilters`/`opportunityFilter`) belong to the `analysis` tab and **leave** to the legacy `lead-stream/` unit in 5c, so the feature has no shareable primary filter to URL-encode — the constraint applies only if a genuine intelligence-tab filter surfaces.
- The partition of the 9 fetch sites into market-research-proper vs lead-stream (`24b`, tagged by owning tab); **the page→hooks rewire was descoped from 5b (TD-FE-19) and distributes into 5c (structural relocation) + 5d–5h (per-section hook conversion); lead-stream's data-layer migration is deferred to Phase 7** (customers).
- ~~The `Scout*` config cluster's per-file stay/leave (`24a`, by import tracing).~~ **RESOLVED in 5a** (§9 delta 6): the trace confirmed `ScoutSettingsForm`/`ScoutDeploymentDetails`/`ScoutLeadStream` → **scout**; `ScoutCapabilities` has zero importers → **dead** (TD-FE-18), not a scout leaver. The §7 table is reconciled accordingly.
- The final `index.ts` public surface (`24i`, once internals are stable, informed by Phase 8).

---

## §14 Companion documents

- Master plan: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 5, §5 workflow, §6 DoD, R5/R6).
- `specs/20-frontend-phase-3-api-data-layer-design.md` — the data-layer pattern 5b consumes (zod, `qk`, `client.ts`, `RateLimiter`, memory-only, `useCompanyProfile`).
- `specs/21-frontend-phase-4-scaffolding-shell-design.md` — scaffolder, `FeatureErrorBoundary`, dependency rules, naming map.
- `frontend/src/features/README.md` — feature conventions + naming map.
- `frontend/e2e/journeys/04-market-research-5-components.spec.ts` — the behavioral safety net.
- `docs/TECH_DEBT.md` (`TD-FE-<n>`), `docs/adr/` (the two Phase 5 ADRs).
- Round 1–3 reviews + syntheses: `docs/reviews/24-frontend-phase-5-market-research-design-spec-{review,synthesis}-{1,2,3}.md`.
- 5c R1 escape-hatch findings (round-5 trigger): `docs/reviews/24c-frontend-phase-5c-R1-escape-hatch-findings.md`.
- `docs/TECH_DEBT.md` TD-FE-19 (5b page-rewire deferral) — the root-cause record for the round-5 §4/§5 reconciliation.
