# Spec 24 — Frontend Phase 5: Feature Extraction — market-research

**Status:** Design — round 2 (round 1 review `docs/reviews/24-frontend-phase-5-market-research-design-spec-review-1.md` synthesized at `docs/reviews/24-frontend-phase-5-market-research-design-spec-synthesis-1.md`)
**Date:** 2026-05-30 (round 1 + round 2 revisions)
**Type:** Phase spec (child of master Spec 14 §4 — Phase 5)
**Paired plan:** none yet — sub-plans `24a`…`24i` ship per sub-phase as it begins

---

## §1 Goal and context

### 1.1 Goal

Extract the market-research surface — `src/pages/MarketResearch.tsx` plus the *genuinely market-research* parts of `src/components/market-research/*` — into `src/features/market-research/`, **fully decomposed**: the 7k-LOC page split along its tab structure, the data layer moved onto TanStack Query, and each giant section component broken into single-purpose files. Feature parity is mandatory (behavioral + pixel-level visual). This is the **hardest feature, taken first** by design (master Spec 14 §4, R5/R6) — it surfaces the worst cross-feature coupling early and proves the feature-extraction pattern for Phases 6–12.

### 1.2 Starting state (post-Phase-4, measured 2026-05-30)

| Aspect | Current state |
|---|---|
| Page | `src/pages/MarketResearch.tsx` — **7,013 LOC**, a single `React.memo` component (49 `useState`, 20 `useEffect`, 5 `useCallback`, 2 `useRef`, 0 `useMemo`). Post-Phase-1 (was 14,956). `MarketResearch_clean.tsx` duplicate **verified absent** (a Phase 1 target — master §4 Phase 5). |
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
| 5a | `24a` | Relocate genuine market-research into `features/` — mechanical, parity-preserving, zero logic change |
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
│   │   ├── market-entry/             # MarketEntrySection decomposed (container + sub-components)
│   │   ├── regulatory-compliance/
│   │   ├── competitor-landscape/
│   │   ├── industry-trends/
│   │   └── market-size/
│   └── trends/                       # emerging-trends tab
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
- **Anticipated public surface (non-binding, validated in 5i):** signals (Phase 8) consumes market-research *output*, so the likely `index.ts` surface is the research-result/report types + a results-read hook. 5c–5h keep those exportable (don't bury result types in deeply-private modules); the exact surface is locked in 5i once internals stabilize, informed by Phase 8's needs. No in-phase consumer exists, so the surface is deliberately not finalized early.

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

**Mission:** move the *genuine* market-research surface into `features/market-research/` with zero logic change, so all later decomposition happens in the new location against one set of import paths.

**Actions:**
- `npm run scaffold:feature -- market-research` (emits `types.ts`/`index.ts`/`README.md`).
- Move the page → `pages/MarketResearchPage.tsx`; move the genuine-market-research components → `components/`. **Leaving components stay put** in `src/components/market-research/` (§7) with an in-code `// HANDOFF → <feature>` annotation + a "Pending handoffs" stub in `README.md`. Rewrite imports, leaning on the transitional legacy-import exception (incl. for any leaving component the page still renders).
- Wrap the routed page in `<FeatureErrorBoundary>` (from `src/shared/components/`).
- Update `App.tsx` route imports to the new module paths. **Route URLs unchanged.**

> The `analysis` (lead-stream) tab is inline in the page, so its code rides into the feature *inside* `MarketResearchPage.tsx` in 5a; 5c extracts it back out to the legacy `lead-stream/` unit (§5). 5a does not attempt to separate it.

**Done when:** market-research renders from `features/market-research/`; `src/pages/MarketResearch.tsx` is gone; the genuine components moved; leaving components remain in `src/components/market-research/` annotated; routes resolve; E2E (`journeys/04`) + visual + Vitest + `npm run preflight` green. One reviewable mechanical diff.

---

## §4 Sub-phase 5b — Data layer → TanStack Query

**Mission:** replace the 9 raw fetches + localStorage cache with the Phase 3 data-layer pattern, so section decomposition (5c–5h) targets clean hooks instead of prop-drilled fetch results.

### 4.1 Endpoint inventory (rough; verified live in 5b)

The 9 raw fetches resolve to **2 endpoints** (via the existing `buildApiUrl(...)` builder), not nine:

| Call sites (`MarketResearch.tsx`) | Endpoint | Method | Purpose (approx) |
|---|---|---|---|
| 2115 | `market-research` (cache-busted `?_cb&_r`) | GET | load latest research |
| 2820, 2948, 2981, 3252, 3480, 3759, 4088 | `market-research` | POST | research operations (generate/refresh — incl. competitor, see line 3977), dispatched by request body |
| 2483 | `profile/company?org_id=` | GET | company profile — **already migrated in Phase 3** (`useCompanyProfile`, shared company-profile contract) |

**Implications for 5b:** the seven POSTs share one endpoint distinguished by payload → a small set of typed service fns over `market-research`; the company-profile GET **reuses Phase 3's existing hook/contract**, not a new one. Line/site numbers are a 2026-05-30 anchor; the exact operation set + request/response shapes are verified live (`/docs`/`curl`) per the polyglot rule — 5b's first task.

### 4.2 Actions

- `services/` — one fetch fn per `market-research` operation over the shared `client.ts` + the **existing** shared `RateLimiter` (30/min is a single frozen budget — no second limiter).
- `contracts.ts` — feature-local zod schemas for the `market-research` operations; `.parse` at the fetch boundary, static types via `z.infer`. Shapes verified live (§4.1).
- `hooks/` — `useQuery`/`useMutation` wrappers; query keys added to the central `qk` factory (`src/shared/api/queryKeys.ts`). Company-profile reads route through Phase 3's `useCompanyProfile`.
- Rewire the (still-monolithic) page to consume the hooks; delete the raw `fetch` sites, the `CACHE_DURATION` cache, and the 68 localStorage refs that back it. `sessionStorage` used as primary state (if any survives) is left alone — that's not cache.
- **Prerequisite:** confirm/extend the Phase 0b **MSW** handlers (and `e2e/fixtures/api-mocks.ts`) for the `market-research` operations; missing handlers are 5b work, not assumed-present.
- **ADRs** (in `docs/adr/`): (1) market-research contracts are feature-local; (2) TanStack cache is memory-only for market-research (resolving master §8 Q9).

**Done when:** market-research data comes entirely from TanStack Query (memory-only); no raw `fetch` or localStorage cache remains in the feature; both ADRs merged; behavior + visual parity green; preflight green.

---

## §5 Sub-phase 5c — Page decomposition + state rehoming

**Mission:** break the 7k-LOC page into a thin shell + tab containers and rehome the 49-`useState` soup.

**Actions:**
- `MarketResearchPage.tsx` becomes a thin shell (route wiring + tab routing + `<FeatureErrorBoundary>`), delegating each tab to a container: `IntelligenceTab`, `TrendsTab`, and an `analysis` branch that renders the **legacy** lead-stream unit (below).
- **State rehoming:** server data → TanStack hooks (5b); `activeTab` → stays URL-derived; primary search/filter state → **URL params** (shareable, consistent with `activeTab`); ephemeral state (open dialogs, input drafts) → local `useState` in the decomposed pieces; genuinely-shared coordination → `MarketResearchContext` per the criteria below.
- **Context placement criteria** (precedent for Phases 6–12): `MarketResearchContext` holds *only* state that is **(a)** shared across ≥2 sections/tabs, **(b)** not derivable from URL params, and **(c)** not server state (TanStack owns that). State failing all three stays local `useState`; URL-derivable navigation state goes to URL params. **If nothing meets all three, no context is created.**
- Replace the bespoke `SafeMarketIntelligenceTab` error wrapper with `<FeatureErrorBoundary>`; drop any unused `Safe*` wrappers.
- **Extract the inline `analysis` (lead-stream) tab** out of the page into the legacy `src/components/market-research/lead-stream/` unit (joining the existing lead-stream files), annotated **→ customers (Phase 7)**. The feature's tab router renders it via the transitional exception. This stays in legacy, not the feature (leave-in-place model, §1.3.5/§7); extracting it is what makes the page decomposable.

**Done when:** the page is a thin shell + tab router; no fetch-result or server state held in page `useState`; the lead-stream tab is a self-contained annotated unit in `src/components/market-research/lead-stream/`; parity + preflight green.

---

## §6 Sub-phases 5d–5h — Section decomposition (one per giant section)

**Mission:** break each of the five section components into single-purpose files.

**Per-section pattern (MarketEntry / RegulatoryCompliance / CompetitorLandscape / IndustryTrends / MarketSize):**
- A section container + focused presentational sub-components + a section-data hook (consuming 5b) + local types, under `components/intelligence/<section>/`.
- Replace the section's slice of the `MarketIntelligenceTabProps` prop surface with hook consumption.
- **No hard LOC cap** (master §6) — target single-purpose files that fit in agent context. The exact file breakdown per section is a 5d–5h plan decision.
- Vitest + RTL tests for the section's hook + logic-bearing sub-components (§8).

**Ordering + batching:** largest first (MarketEntry → … → MarketSize), so the worst context-pressure section is done while scaffolding is freshest. Per the §1.4 escape-hatch, the smaller sections may be batched into one sub-plan with per-section commits.

**Done when (each):** the section renders from `components/intelligence/<section>/` as a tree of single-purpose files reading from hooks; the legacy section file is gone; that section's unit tests pass; E2E + visual + preflight green.

---

## §7 Sub-phase 5i — Finalize + handoff annotations

**Mission:** lock the public surface and record what doesn't belong.

**Actions:**
- Define `index.ts` — the minimal public surface other features consume (signals in Phase 8; see §2.2). Everything else stays private.
- Backfill `README.md`: purpose, public surface, key files, dependency notes, **Pending handoffs** table.
- Dead-code sweep within the feature (`knip --strict` clean).

**Leaving components — stay in `src/components/market-research/` (LOC per the §1.2 point-in-time anchor):**

| Component(s) (stay-put under `src/components/market-research/`) | LOC | Target feature | Claiming phase |
|---|---|---|---|
| `StrategistWorkspace.tsx` | 959 | **strategist** | per naming map |
| `lead-stream/*` (LeadsTable 770, leadData 676, OpportunityDashboard 243) + extracted `analysis`-tab code | ~1.7k | **customers** | per naming map |
| `ScoutChatPanel.tsx` 678, `ChatWithScout.tsx` 251 | ~0.9k | **scout** | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm` 134, `ScoutDeploymentDetails` 67, `ScoutLeadStream` 62, `ScoutCapabilities` 46) | ~0.3k | **scout** (candidate) | confirm per-file in 5a |

> Annotations name the **target feature**, not a phase number, because master §4 and the Phase 4b naming map disagree on numbers (§9.4). The claiming phase reads this table before planning (master §4 Phase 5's 5c handoff mechanism). 5a confirms the `Scout*` config cluster's stay/leave per-file by tracing imports. `src/components/market-research/` is **deleted once empty** (≤ Phase 9).

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
2. **Status table (§4).** Mark Phase 5 → in progress now, → done (with date) at final merge. **Verify Phase 3 and Phase 4 rows read "done"** — they are merged — and correct if still "pending" (observed stale in at least one working copy).
3. **Sub-split deviation.** Master §4 Phase 5 sketched 5a/5b/5c; this spec uses 5a–5i because full decomposition was chosen. Record the finer split.
4. **Phase-number reconciliation.** Master §4 overview (signals 8 · scout 9 · settings 10) conflicts with the Phase 4b `features/README.md` naming map (signals 6 · scout 8 · settings 11). Pre-existing drift, surfaced (not caused) by Phase 5. Recommend reconciling the master plan to one source of truth; until then handoffs reference target features by name. Log as a master-plan delta (or `TD-FE-<n>` if not resolved at Phase 5 merge).
5. **Phase 13 boundary (recommendation, not assertion).** Phase 13 **should expect** its market-research pass to narrow to verification + cross-feature dedup + codemod extraction (first-time decomposition done here), **assuming 5d–5h decomposition quality meets Phase 13's standards — Phase 13's spec re-evaluates.** Note in master §4 Phase 13.

---

## §10 Per-phase workflow

- Adversarial cycle per master §5: spec → review-spec → synthesize (loop to nit-or-below) → writing-plans → review-plan → synthesize → impl → review-impl → synthesize → human-approved merge.
- **Sub-plan granularity + incremental merge:** each `24a`…`24i` is its own plan + review + impl, and **merges to `master` incrementally** when green (not one terminal merge). `phase-5-market-research` is the working branch; each sub-phase branches from / re-syncs onto the latest `master` before its merge, so no long-lived branch accumulates weeks of drift (`sync.sh` / other work may land on master between sub-phases). Revert is per sub-phase (master §5.7); the whole phase reverts only if the *phase as a whole* can't reach done.
- Branch in the main repo (per user direction — no separate worktree); surgical commits by path.
- Human checkpoints: approve spec→plan, plan→impl, impl→merge for each sub-phase; controller runs `npm run preflight` immediately before each merge.

---

## §11 Definition of done (phase)

1. `src/features/market-research/` holds the decomposed page + tab router + decomposed sections + hooks/services + `contracts.ts` + `types.ts` + `README.md` + `index.ts`.
2. `src/pages/MarketResearch.tsx` is gone and the genuine market-research components are in the feature; `src/components/market-research/` retains only the annotated leaving components (lead-stream, `StrategistWorkspace`, `ScoutChatPanel` + `Scout*` cluster), which Phases 7/8/9 relocate — the dir is deleted once empty.
3. Data layer is TanStack Query (memory-only); no raw `fetch` or localStorage cache in the feature.
4. Routes resolve to the feature; **URLs unchanged**.
5. Vitest + RTL coverage for the feature's logic-bearing units; `journeys/04` E2E + visual regression green; `npm run preflight` green.
6. Both ADRs (feature-local contracts; memory-only cache) merged.
7. Handoff table authoritative; master Spec 14 deltas applied.

---

## §12 Risks and mitigations

- **R1 — Coupling worse than mapped.** The page is one 7k `React.memo`; hidden cross-tab state may resist clean tab extraction. *Mitigation:* 5a is mechanical (no logic); 5b kills shared server state before structural cuts; if 5c reveals coupling beyond the plan, revert 5c and replan (master §5.7) — earlier sub-phases stay merged.
- **R2 — Data-layer shape drift.** Endpoints lack `response_model`; static contract inference misleads. *Mitigation:* 5b verifies every shape live against a running backend before writing the zod contract (§4.1).
- **R3 — Prop-drilling → hooks blast radius.** Replacing `MarketIntelligenceTabProps` touches every section. *Mitigation:* horizontal sequencing — hooks exist (5b) before sections convert (5d–5h), one section per sub-phase, each independently green.
- **R4 — Visual diffs from incidental Tailwind/markup changes.** *Mitigation:* visual regression at 2% between every sub-phase; class consolidation only when visually neutral; re-baseline only for intentional, reviewed changes.
- **R5 — Leaving-component entanglement.** The `analysis`/lead-stream tab is *inline* in the page, not a clean import. *Mitigation:* 5c extracts it into the legacy `lead-stream/` unit (leave-in-place model); the feature imports it transitionally until Phase 7. Separate-file leavers (`StrategistWorkspace`, `ScoutChatPanel`, `Scout*`) stay untouched in `src/components/market-research/`.
- **R6 — Agent context blow-up on the 7k page / 3.9k sections.** *Mitigation:* extract in narrowly-scoped commits per master R6; E2E + visual are the executable spec the agent verifies against without holding the whole file in context.
- **R7 — Memory-only reload re-fetch (accepted).** Dropping the localStorage cache means results re-fetch on reload, pushing more calls through the 30/min limiter. *Mitigation:* accepted per decision §1.3.4 (ADR records it). The 30/min sufficiency under memory-only is not meaningfully testable pre-launch (0 users) — that measurement is itself the post-launch revisit trigger, consistent with the repo's dropped-NFR-gating posture (master §8 Q3).

---

## §13 Open questions

**Resolved in this spec:** decomposition depth (full); sequencing (relocate→data→decompose); contracts location (feature-local, single file); cache (memory-only); leaving-component model (stay-in-place) + target mapping; query-key placement (central `qk`); context placement criteria (§5); rough endpoint inventory (§4.1).

**Deferred to sub-phase plans:**
- The exact `market-research` operation set + verified-live request/response shapes (`24b`).
- The exact route URL(s) + `:tab` segments as currently configured in `App.tsx` (`24a`/`24c` confirm; they stay frozen).
- The per-section file breakdown inside each `components/intelligence/<section>/` (`24d`–`24h`).
- Whether `MarketResearchContext` is needed at all (per §5 criteria) and, if so, its shape (`24c`).
- The `Scout*` config cluster's per-file stay/leave (`24a`, by import tracing).
- The final `index.ts` public surface (`24i`, once internals are stable, informed by Phase 8).

---

## §14 Companion documents

- Master plan: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 5, §5 workflow, §6 DoD, R5/R6).
- `specs/20-frontend-phase-3-api-data-layer-design.md` — the data-layer pattern 5b consumes (zod, `qk`, `client.ts`, `RateLimiter`, memory-only, `useCompanyProfile`).
- `specs/21-frontend-phase-4-scaffolding-shell-design.md` — scaffolder, `FeatureErrorBoundary`, dependency rules, naming map.
- `frontend/src/features/README.md` — feature conventions + naming map.
- `frontend/e2e/journeys/04-market-research-5-components.spec.ts` — the behavioral safety net.
- `docs/TECH_DEBT.md` (`TD-FE-<n>`), `docs/adr/` (the two Phase 5 ADRs).
- Round 1 review + synthesis: `docs/reviews/24-frontend-phase-5-market-research-design-spec-review-1.md`, `…-synthesis-1.md`.
