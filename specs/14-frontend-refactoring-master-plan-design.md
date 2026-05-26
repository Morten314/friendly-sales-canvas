# Spec 14 — Frontend Refactoring Master Plan

**Status:** Design — pending user review
**Date:** 2026-05-26
**Type:** Master plan (umbrella spec; each phase will get its own design + plan)
**Paired plan:** _none yet — each phase ships its own plan as it begins_

---

## §1 Goal and context

### 1.1 Goal

Refactor the frontend (`frontend/`, ~75,894 LOC of TypeScript/React) into a modular, strongly-typed, well-tested, AI-native codebase suitable for **agents-as-authors** with humans orchestrating. The work runs as a sequence of 17 phases (0 through 14, with Phase 2 sub-split into 2a/2b/2c). Every phase ships through the same adversarial spec → plan → impl review cycle the backend used through Phases B–L.

### 1.2 Why now

The backend just completed a multi-phase modularization (Phases A–L on `backend/`), converging on a per-feature package layout with cross-cutting `_helpers` flat files. With backend structural work stable and the PWA-to-monorepo cutover effectively done (Brewra devs only work on the monorepo; no incoming churn on `master`), this is the natural window to apply the same discipline to the frontend.

### 1.3 Starting state

| Aspect | Current state |
|---|---|
| Location | `brewra-gtm-intelligence/frontend/`, branch `master` |
| Stack | React 18 + Vite + TypeScript + shadcn/Radix + Tailwind + Firebase + React Router v6 + TanStack Query (installed but unused) |
| Total LOC | 75,894 across `.ts`/`.tsx` files in `src/` |
| Largest files | `pages/MarketResearch.tsx` (14,956), `components/customers/ICPSummaryOpportunity.tsx` (6,925), `pages/MissionControl.tsx` (5,645), `components/mission-control/DataSourcesManager.tsx` (3,747), `components/mission-control/ICPManager.tsx` (3,269), 9 files > 1,500 LOC |
| TS config | Non-strict: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false` |
| Tests | Playwright E2E only (`frontend/e2e/`). No Vitest. No RTL. No MSW. |
| Linting | ESLint flat-config v9, react-hooks plugin, react-refresh. No Prettier config. No type-aware rules. No `knip`. |
| Layout | Flat `src/components/`, `src/pages/`, `src/contexts/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/utils/`. `src/components/ui/` holds shadcn primitives. `src/components/` has weak feature subfolders (`customers/`, `market-research/`, `mission-control/`, `signals/`, `strategist/`). |
| Data layer | Manual `fetch` via three-layer client: `apiFetch` → `enhancedApi` (5-min in-memory map, rate-limit) → `authenticatedApi` (JWT). TanStack Query not used. Three caching layers: `localStorage`, `enhancedApi` map, `sessionStorage`. |
| Build artifacts | Lovable provenance: `lovable-tagger` in `vite.config.ts`. Originally Lovable-generated. |
| Branch model | `master` is trunk (recently shifted from working-branch — commit `adacae4`). Feature work on short-lived branches with review for non-trivial changes, then merge back. |
| Backend coordination | Backend `app/services/` is the reference shape for the frontend's `src/features/` target. See backend Phase K/L specs for the converged pattern. |

### 1.4 Target principle

**Agents-as-authors with anti-slop discipline.** The codebase becomes a place where agents can read, plan, and write efficiently:

- Small, single-purpose files that fit in agent context
- Strict types as machine-readable contracts
- Predictable per-feature structure so agents know where to look and where to put things
- Comprehensive automated guardrails (typecheck, lint, test, build, visual regression, bundle budget) so agents get fast feedback
- Adversarial review at every artifact (spec, plan, implementation) so slop gets caught before merging
- Humans drive (kick off phases, approve transitions, take final call) — agents do the writing

---

## §2 Scope

### 2.1 In scope

- All code under `frontend/src/`
- `frontend/tsconfig.app.json`, `frontend/tsconfig.json`, `frontend/eslint.config.js`, `frontend/vite.config.ts`, `frontend/package.json`
- New test harness (Vitest + RTL + MSW) and characterization tests
- New CI gates (typecheck, lint, test, build, Playwright, visual regression, bundle budget, dead-code check)
- LOC reduction passes (two of them — pre-foundation in Phase 1 and post-modularization in Phase 13)
- Per-feature `README.md` files inside `src/features/<feature>/`
- ADRs in `docs/adr/` for non-trivial decisions surfaced during phases
- Agent-callable scripts in `frontend/scripts/` (feature scaffolder, codemods surfaced by Phase 13 audit)
- Watchers in CI (bundle size, dead code, stale-doc grep)
- Amendments to root `CLAUDE.md`/`AGENTS.md` only where the new structure makes existing guidance stale

### 2.2 Out of scope (non-goals)

- **No backend changes.** API contract is fixed. Per-feature deviations require their own backend spec.
- **No new product features.** Feature parity is mandatory. Agents must not "improve" mid-refactor.
- **No visual redesign.** Pixel-level visual regression must stay green. Tailwind class consolidation is allowed only if visually-neutral.
- **No state-management library swap.** Final composition is AuthContext + TenantContext + TanStack Query (Phase 3). No Redux/Zustand/Jotai migration.
- **No router upgrade.** Stays on `react-router-dom@6`.
- **No PWA/service-worker changes.** `vite-plugin-pwa` config left alone unless a phase has a specific reason and an ADR.
- **No Firebase swap.** Auth stays on Firebase email/password.
- **No mobile/native split.** PWA stays a single web target.
- **No design-system extraction.** shadcn primitives stay as-is. Brand layer extraction is future work.
- **No internationalization scaffolding.**
- **No analytics/observability/feature-flagging work** unless a phase explicitly surfaces it as a blocker.
- **No tracker-branch management.** `develop`/`production` tracker branches are deprecated infrastructure.
- **No duplicate `frontend/AGENTS.md` or `frontend/CLAUDE.md`.** Root files cover the frontend topology section; if a phase surfaces something worth documenting, amend the root files.

Out-of-scope discoveries are logged to `docs/TECH_DEBT.md` as `TD-FE-<n>` entries.

### 2.3 Frozen interfaces

These do not change as a result of this refactor (covered by characterization tests and visual regression):

- HTTP API contract with the backend (request/response shapes, headers, status codes)
- Routes (`/`, `/tenant-selection`, `/your-ai-team/scout/:tab`, `/your-ai-team/strategist/:tab`, `/mission-control`, `/customers`, etc.)
- Auth flow (Firebase email/password → JWT → tenant selection → protected routes)
- Rate-limit boundary value (4 req/min) — implementation moves, value stays
- Existing E2E Playwright suite behavior (the suite itself may be expanded but existing tests must remain green)
- Bundle output format (PWA via vite-plugin-pwa with Workbox)

---

## §3 Architecture target

### 3.1 Target layout

```
frontend/src/
├── features/
│   ├── market-research/
│   │   ├── pages/             # routed page components
│   │   ├── components/        # feature-internal components
│   │   ├── hooks/             # feature-internal hooks
│   │   ├── services/          # feature-specific API/data calls
│   │   ├── types.ts           # feature types
│   │   ├── README.md          # what this feature does, how it's organized
│   │   └── index.ts           # public re-exports for cross-feature consumption
│   ├── mission-control/       # same shape
│   ├── customers/             # same shape
│   ├── signals/               # same shape
│   ├── strategist/            # same shape
│   ├── scout/                 # same shape
│   ├── settings/              # same shape
│   ├── auth/                  # Login + Firebase integration
│   ├── tenant/                # TenantSelection + TenantContext
│   ├── shell/                 # Sidebar, Header, layout, route shell
│   └── README.md              # features-root README: conventions, template, where to look
│
├── shared/                    # cross-cutting (FE analog of backend's _llm_helpers etc.)
│   ├── api/                   # apiFetch, contracts, rate-limit, query client config
│   ├── hooks/                 # cross-feature hooks
│   ├── lib/                   # cross-feature utilities
│   ├── types/                 # cross-feature types + the documented escape-hatches.ts
│   └── README.md
│
├── components/
│   └── ui/                    # shadcn primitives — locked, off-limits to features
│
├── styles/                    # global styles, theme tokens
│
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

### 3.2 Mapping to backend's converged shape

| Frontend element | Backend analog |
|---|---|
| `src/features/<feature>/` | `backend/app/services/<feature>/` (Phase K converged shape) |
| `src/features/<feature>/index.ts` (public re-exports) | `backend/app/services/<feature>/__init__.py` |
| `src/shared/` | `backend/app/services/_llm_helpers.py`, `_neo4j_helpers.py`, `_retrieval.py`, `_claude_budget.py` |
| `src/components/ui/` (shadcn) | (no analog — primitives nobody owns) |
| Per-feature `README.md` | Phase L's per-file scorecard pattern, adapted for forward-looking doc |

### 3.3 Dependency rules

- `features/<X>/` may import from `features/<X>/`, `shared/`, `components/ui/`, npm packages.
- `features/<X>/` may import from `features/<Y>/` **only via** `features/<Y>/index.ts` (the public surface).
- `shared/` may not import from `features/`.
- `components/ui/` may not import from `features/` or `shared/` (it's pure primitives).
- Enforced by ESLint `import/no-restricted-paths` rule once Phase 2b lands.

### 3.4 Naming canonicalization

Resolved in Phase 4 spec, but the master plan target uses **kebab-case** throughout (`market-research`, `mission-control`, `customer-profile`). Backend uses snake_case (`customer_profile`, `market_research`); the frontend uses kebab-case per JS convention. A naming map will live in the Phase 4 spec.

---

## §4 Phase sequence

17 phases, executed in order. Each phase ships through a full adversarial cycle (see §5).

### Overview

| # | Phase | Mission |
|---|---|---|
| 0 | Inventory + full safety net | Audit, lock Playwright, visual regression baselines, Vitest+RTL+MSW setup, characterization tests for top 5 monsters |
| 1 | LOC reduction pass #1 (pre-foundation) | Phase-L-style audit-execute for dead code, dead deps, dead routes, dedup. Backstopped by Phase 0's safety net. |
| 2a | Foundation: strict TS turn-on | Flip `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`. Fix the error storm. |
| 2b | Foundation: ESLint type-aware + Prettier | Upgrade ESLint config, add type-aware rules, `import/order`, `import/no-restricted-paths` (rules from §3.3), Prettier check |
| 2c | Foundation: CI gates + budget | Wire all gates into CI: typecheck, lint, test, build, Playwright, visual regression, bundle budget, `knip` dead-code |
| 3 | API/data layer | Adopt TanStack Query. Collapse 3 caching layers into one. Centralize rate-limit. Define contract types in `src/shared/api/`. |
| 4 | Feature scaffolding | Create `src/features/` skeleton + per-feature template + features-root README. Lock `src/components/ui/` for shadcn only. Establish ADR template. |
| 5 | Feature: market-research | Hardest feature first. Extract `pages/MarketResearch.tsx` + all `components/market-research/*` into `src/features/market-research/`. May sub-split (5a page decomposition, 5b component reshuffling). |
| 6 | Feature: mission-control | `pages/MissionControl.tsx` + DataSourcesManager + ICPManager + components/mission-control/* into `src/features/mission-control/`. |
| 7 | Feature: customers | ICPSummaryOpportunity + SuggestedICPCards + SuggestedICPsGallery + Customers page into `src/features/customers/`. |
| 8 | Feature: signals + strategist | Signals page + components/signals/* + components/strategist/* into `src/features/signals/` and `src/features/strategist/`. |
| 9 | Feature: scout + profiler | ScoutDeployment + scout/profiler-related components (split across mission-control and customers today) into `src/features/scout/`. |
| 10 | Feature: settings + tenant + auth | Login, TenantSelection, Settings, CompanyProfile into `src/features/auth/`, `src/features/tenant/`, `src/features/settings/`. |
| 11 | Layout shell + shared extraction | Sidebar, Header, AuthContext into `src/features/shell/`. Cross-cutting hooks/lib/utils into `src/shared/`. |
| 12 | Small-pages sweep | Calendar, Deals, Insights, Reports, Artifacts, NotFound — batched. Each becomes a small feature folder or moves into the nearest related feature. |
| 13 | LOC reduction pass #2 (post-modularization audit) | Phase-L-proper. With strict types + tests + features in place, systematic per-file audit on the whole tree. Codemods extracted into `frontend/scripts/`. |
| 14 | Agent affordances | Per-feature README backfill, ADR conventions consolidated, agent-callable scripts (feature scaffolder, codemod runner), CI watchers (bundle, dead-code, stale-doc grep). Amend root `AGENTS.md`/`CLAUDE.md` only where the new structure makes existing guidance stale. |

### Phase 0 — Inventory + full safety net

**Mission:** establish the audit baseline and the safety net that every subsequent phase relies on.

**Deliverables:**
- Per-feature LOC scorecard (`docs/audits/<date>-frontend-baseline.md`)
- Dependency graph from `knip` / `ts-prune` / `depcheck` (dead exports, dead files, dead deps)
- Bundle-size baseline captured from `vite build`
- Playwright suite locked green; visual regression snapshots captured for the top screens (market-research, mission-control, customers, signals, scout, settings, login, tenant-selection)
- Vitest + React Testing Library + MSW installed and wired
- Characterization tests for the top 5 monster files (MarketResearch.tsx, ICPSummaryOpportunity.tsx, MissionControl.tsx, DataSourcesManager.tsx, ICPManager.tsx) — DOM-level + behavior-level coverage of their critical paths
- CI workflow file scaffolding (the gates added across Phase 2c are pre-shaped here as TODOs)

**Sub-split trigger:** if spec author judges the scope too large during spec writing, split into 0a (inventory + Playwright/visual lock + bundle baseline) and 0b (Vitest + RTL + MSW + characterization tests). Decision in the Phase 0 spec.

**Done when:** all of the above merged on `master`; CI runs Playwright + visual regression green on every PR.

### Phase 1 — LOC reduction pass #1 (pre-foundation)

**Mission:** shrink the codebase before strict TS + lint hit, so the storm in Phase 2a is smaller.

**Methodology:** mirrors backend Phase L's audit-execute pattern.

- **Stage 1 — Audit.** Read every file under `frontend/src/`. Use `knip` / `ts-prune` / `depcheck` outputs from Phase 0 as starting points. Categorize findings: `execute` (mechanical, safe), `investigate` (needs per-site analysis), `defer` (logged to `TD-FE-<n>`).
- **Stage 2 — Investigation.** For each `investigate` finding, enumerate call sites and read each in full.
- **Stage 3 — Execute.** Apply the `execute` and confirmed-safe `investigate` reductions.

**In-scope opportunities:**
- Dead imports (pure unused symbols)
- Dead exports (unused outside their file)
- Dead files (no inbound import or route reference)
- Dead deps in `package.json`
- Dead routes (not reachable from React Router config or nav)
- Exact-duplicate components (byte-identical or trivially-different)
- Lovable artifacts: `lovable-tagger` from `vite.config.ts` if its tagging output isn't consumed anywhere; Lovable README boilerplate
- `_restore_test.txt` and similar artifacts
- Inline-data-munging blocks that appear ≥3 times

**Out-of-scope deferrals:**
- Behavior changes (must remain pixel-identical and behaviorally identical)
- Type signature changes (Phase 2a's domain)
- Cross-feature dedup that requires moving code into `src/shared/` (Phase 11's domain)
- shadcn primitive consolidation (`src/components/ui/` is locked from Phase 4 onward; if discoveries surface here, log as TD-FE)

**Safety net:** every commit must keep Playwright + visual regression + Vitest characterization green.

**Done when:** audit scorecard merged at `docs/audits/<date>-frontend-loc-pass-1.md`; all `execute` findings applied; LOC delta documented in scorecard.

### Phase 2a — Foundation: strict TS turn-on

**Mission:** flip strict mode on, fix the error storm.

- Update `frontend/tsconfig.app.json`: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Update `frontend/tsconfig.json` similarly (root composite config).
- Fix every error.

**Error-count gate:** during plan-stage of this phase, run `tsc --noEmit` against the post-Phase-1 codebase. If the error count exceeds **1,500**, the plan author must propose a sub-decomposition by feature folder or by error category (e.g., 2a-i null-handling, 2a-ii implicit-any, 2a-iii unused locals) before proceeding to implementation. Below 1,500, execute as one phase.

**Escape hatch:** `src/shared/types/escape-hatches.ts` may hold explicit `any` types with documented justification (one comment per export, naming the call site that needs it). Limit: no more than 10 entries; reviewed every phase.

**Done when:** `tsc --noEmit` green on the whole frontend; no new `any` types introduced (lint rule from 2b will enforce this going forward).

### Phase 2b — Foundation: ESLint type-aware + Prettier

**Mission:** lint and format guardrails.

- Upgrade `eslint.config.js` to use `typescript-eslint` flat-config (already in deps).
- Add type-aware rules: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`.
- Add `eslint-plugin-import` with `import/order` and `import/no-restricted-paths` (rules per §3.3 — `src/shared/` may not import from `src/features/`; cross-feature imports only via `index.ts`).
- Add Prettier with shared config (`.prettierrc`), wire `prettier --check` to lint.
- Add `eslint-plugin-react-hooks/recommended` if not already (it is, but verify rule set is full).

**Done when:** `eslint . --max-warnings 0` green; `prettier --check .` green.

### Phase 2c — Foundation: CI gates + bundle budget

**Mission:** every gate runs on every PR, blocks merge on failure.

- GitHub Actions workflow (or whatever CI the repo uses; spec author to confirm) running: install → typecheck → lint → test (Vitest) → build → Playwright → visual regression → bundle-size budget → `knip` (dead-code).
- Bundle-size budget thresholds set from Phase 0 baseline + agreed headroom (spec author proposes; user approves).
- `knip.json` config locked. Watcher: any new file with no inbound imports fails CI.
- Visual regression diff threshold codified (e.g., max 0.1% pixel delta per screen unless explicitly approved).

**Done when:** all gates green on a representative PR; gates required to merge.

### Phase 3 — API/data layer consolidation

**Mission:** TanStack Query becomes the single source of server-state truth.

- Wire `QueryClient` and `QueryClientProvider` at app root.
- Replace `enhancedApi`'s 5-min in-memory map with TanStack Query's cache.
- Migrate `localStorage` and `sessionStorage` caching usage to TanStack Query persistence (or document why a specific case stays on `localStorage`).
- Centralize rate-limit (4 req/min) into a single fetch-middleware layer used by every `useQuery`/`useMutation`.
- Define API contract types in `src/shared/api/contracts.ts` (hand-written initially; OpenAPI codegen deferred unless surfaced as needed).

**Per-call-site migration:** *not* all in this phase. This phase establishes the infrastructure and migrates the lowest-coupled call sites (auth, tenant, settings). Per-feature TanStack adoption happens inside each feature's extraction phase (5–10), where context is local.

**Done when:** `QueryClientProvider` mounted; `src/shared/api/` exists with contract types and the rate-limited fetcher; auth/tenant/settings paths use TanStack Query.

### Phase 4 — Feature scaffolding

**Mission:** establish the `src/features/` skeleton and conventions.

- Create `src/features/` with per-feature template (`pages/`, `components/`, `hooks/`, `services/`, `types.ts`, `README.md`, `index.ts`).
- Create `src/features/README.md` documenting:
  - the per-feature template
  - dependency rules (§3.3)
  - naming canonicalization (kebab-case)
  - the public-surface convention (cross-feature imports via `index.ts` only)
- Create `src/shared/README.md` documenting promotion criteria (when does a hook/util graduate from a feature to shared?).
- Move `src/components/ui/` to be the locked shadcn home; document its off-limits status.
- Establish ADR template in `docs/adr/0001-adr-template.md` (slim form: context, decision, consequences).
- Create `frontend/scripts/scaffold-feature.sh` (or equivalent) — a script that generates a new feature folder from the template.

**Naming map:** the canonical kebab-case feature names are decided in this phase's spec and listed in `src/features/README.md`.

**Done when:** skeleton exists, README files written, scaffold script working, locked shadcn ui.

### Phase 5 — Feature: market-research

**Mission:** the hardest extraction first.

**Sources moving in:**
- `src/pages/MarketResearch.tsx` (post-Phase-1 LOC, originally 14,956)
- `src/components/market-research/*` (MarketEntrySection 3,719; RegulatoryComplianceSection 2,395; CompetitorLandscapeSection 2,375; IndustryTrendsSection 1,615; MarketSizeSection 1,505; DataHistoryDialog 1,244; LeadStream 1,623 if scout-related stays separate; StrategistWorkspace 810; ScoutChatPanel 655; AIPromptingInterface 490; lead-stream/* etc.)
- Related hooks, services, types

**Destination:** `src/features/market-research/`.

**Likely sub-split (decided in Phase 5 spec):**
- 5a: extract `MarketResearch.tsx` into a tree of page components (header, tab shells, section wrappers) — page-level decomposition only, no logic moves
- 5b: move section components and lift their data into TanStack Query hooks
- 5c: cross-feature concerns (lead-stream, scout chat, strategist workspace) routed to their target features

**Done when:** `src/features/market-research/` populated, old paths empty (or thin re-export shims that the next phase removes), tests + Playwright + visual regression green.

### Phase 6 — Feature: mission-control

**Sources moving in:** `src/pages/MissionControl.tsx` (5,645), `src/components/mission-control/*` (DataSourcesManager 3,747; ICPManager 3,269; others).

**Destination:** `src/features/mission-control/`.

**Likely sub-split:** 6a page decomposition; 6b DataSourcesManager extraction; 6c ICPManager extraction. Decided in Phase 6 spec.

### Phase 7 — Feature: customers

**Sources moving in:** `src/components/customers/*` (ICPSummaryOpportunity 6,925; SuggestedICPCards 2,279; SuggestedICPsGallery 1,037; LeadStream 432), `src/pages/Customers.tsx`.

**Destination:** `src/features/customers/`.

**Coordination:** `ICPSummaryOpportunity` couples to mission-control (which manages ICPs). Phase 7 spec defines the public surface between customers and mission-control.

### Phase 8 — Feature: signals + strategist

**Sources moving in:** `src/pages/Signals.tsx` (1,544), `src/components/signals/*` (ScoutChatWithHistory 439; SignalsContextChat 411), `src/components/strategist/*`.

**Destinations:** `src/features/signals/`, `src/features/strategist/`.

### Phase 9 — Feature: scout + profiler

**Sources moving in:** `src/pages/ScoutDeployment.tsx`, scout/profiler-related components currently split across mission-control and customers (per CLAUDE.md frontend topology note).

**Destination:** `src/features/scout/` (and a `src/features/profiler/` if the spec author decides they're distinct enough).

### Phase 10 — Feature: settings + tenant + auth

**Sources moving in:**
- `src/pages/Login.tsx` + Firebase integration → `src/features/auth/`
- `src/pages/TenantSelection.tsx` + `src/contexts/TenantContext.tsx` → `src/features/tenant/`
- `src/pages/Settings.tsx` + `src/components/settings/*` (CompanyProfile 601) → `src/features/settings/`

### Phase 11 — Layout shell + shared extraction

**Sources moving in:**
- `src/components/layout/Sidebar.tsx` (816), `src/components/layout/Header.tsx` (554) → `src/features/shell/`
- `src/contexts/AuthContext.tsx` → `src/features/shell/` or `src/features/auth/` (decided in spec)
- Cross-cutting hooks (`src/hooks/*`), lib utilities (`src/lib/*` outside the api files moved in Phase 3), utils (`src/utils/*`) → `src/shared/hooks/`, `src/shared/lib/`, `src/shared/types/`

**Done when:** `src/pages/` is empty (or only contains `App.tsx`-routed entry points), `src/components/` contains only `ui/`, `src/contexts/`/`hooks/`/`lib/`/`services/`/`utils/` are gone or redirected.

### Phase 12 — Small-pages sweep

**Sources moving in:** `Calendar.tsx`, `Deals.tsx`, `Insights.tsx`, `Reports.tsx`, `Artifacts.tsx` (666), `NotFound.tsx`.

**Destinations:** each becomes its own small feature folder under `src/features/`, or merges into the nearest related feature (decided per-page in Phase 12 spec).

### Phase 13 — LOC reduction pass #2 (post-modularization audit)

**Mission:** the Phase-L-proper analog. Now that strict TS + tests + features are in place, do the systematic per-file audit.

**Methodology:** same audit-execute pattern as Phase 1, but with broader opportunity categories:

- Categories 1–9 from Phase 1 (still in scope where any remain)
- Near-identical components (differ by props or by a single literal — refactor to base + overlay)
- Near-duplicate hooks (same TanStack Query pattern with one parameter difference — extract)
- Repeated UI patterns (form-row, dialog-shell, table-wrapper) — extract to `src/shared/ui-patterns/` if they're not shadcn primitives
- Inline state-management blocks (same `useState` + `useEffect` triplet ≥3 times) — extract to a hook
- Single-use trivial wrapper components (one-line return) — inline unless they add semantic clarity

**Codemods:** for any pattern that appears in ≥3 places, the audit produces a codemod in `frontend/scripts/codemods/<name>.ts` (using ts-morph or jscodeshift). The codemod runs, then is committed for future re-use.

**Done when:** scorecard at `docs/audits/<date>-frontend-loc-pass-2.md` covers every file; all `execute` and confirmed-safe `investigate` findings applied; codemods committed.

### Phase 14 — Agent affordances

**Mission:** finalize the agent-readiness layer.

- Backfill any missing per-feature `README.md` files (most populated during their phase, this catches gaps)
- Consolidate ADRs: every non-trivial decision made during Phases 0–13 is captured (one ADR per decision)
- Agent-callable scripts in `frontend/scripts/`:
  - `scaffold-feature.sh` (from Phase 4) hardened
  - `codemod-runner.sh` (runs codemods from `scripts/codemods/`)
  - any others surfaced during the journey
- CI watchers added:
  - bundle-size delta watcher (warn on +5%, fail on +10% without override)
  - dead-code watcher (`knip` in --strict mode)
  - stale-doc grep (any reference to `Phase N` outside specs/, plans/, docs/audits/, docs/reviews/ fails — same pattern backend Phase L used for stale docstrings)
- Amend root `AGENTS.md`/`CLAUDE.md` **only where** the new structure makes existing guidance stale. No duplicate `frontend/AGENTS.md`.

**Done when:** every feature has a `README.md`; ADR set is complete; scripts are working; CI watchers gate merges.

---

## §5 Per-phase workflow (anti-slop machinery)

Every phase runs the same adversarial cycle, identical to backend Phases B–L:

```
brainstorm spec    →  review-spec     →  synthesize-spec-review (round N)
                          ↻ loop until clean
                   →  writing-plans   →  review-plan    →  synthesize-plan-review (round N)
                                            ↻ loop until clean
                   →  executing-plans (or subagent-driven-development)
                   →  review-impl     →  synthesize-impl-review (round N)
                                            ↻ loop until clean
                   →  merge to master, delete branch
```

### 5.1 Branch discipline

- Each phase = a short-lived branch off `master`. Naming: `phase-N-<short-name>` (e.g., `phase-1-loc-reduction`, `phase-5-market-research`).
- Direct commits to `master` reserved for trivial typo fixes only.
- Branches deleted after merge.

### 5.2 Review rounds

- Spec, plan, and impl each get **at least one** review round.
- Additional rounds until findings are at `nit` severity or below.
- Backend pattern of "fresh-eyes review" applies: a different agent (or a clean-context agent) does the review than wrote the artifact.

### 5.3 CI gates per phase

- Phases 0, 1: Playwright + visual regression + (from 0b onward) Vitest must be green per commit
- Phase 2a: above + `tsc --noEmit` green at phase end
- Phase 2b: above + ESLint clean + Prettier check
- Phase 2c onward: full gate set (typecheck, lint, test, build, Playwright, visual regression, bundle budget, `knip`)
- No "fix forward" through a hook failure. Revert and re-plan, per backend Phase L methodology.

### 5.4 Artifacts per phase

| Artifact | Location |
|---|---|
| Spec | `specs/<NN>-<phase-name>-design.md` |
| Plan | `plans/<NN>-<phase-name>.md` |
| Spec reviews | `docs/reviews/<phase-name>-spec-review-<round>.md` |
| Spec syntheses | `docs/reviews/<phase-name>-spec-synthesis-<round>.md` |
| Plan reviews | `docs/reviews/<phase-name>-plan-review-<round>.md` |
| Plan syntheses | `docs/reviews/<phase-name>-plan-synthesis-<round>.md` |
| Impl reviews | `docs/reviews/<phase-name>-impl-review-<round>.md` |
| Impl syntheses | `docs/reviews/<phase-name>-impl-synthesis-<round>.md` |
| Audit scorecards (Phases 0, 1, 13) | `docs/audits/<date>-<topic>.md` |
| Tech-debt log | `docs/TECH_DEBT.md` (shared with backend; FE entries use `TD-FE-<n>` prefix) |

### 5.5 Scope discipline

- Each phase has authority to write/edit/refactor inside its scope only.
- Out-of-scope discoveries log to `docs/TECH_DEBT.md` as `TD-FE-<n>`.
- Master plan amendments happen at phase merge: the synthesize-impl-review step includes "update master-plan deltas" as a checklist item. The master spec stays current rather than becoming a historical artifact.

### 5.6 Human-in-the-loop checkpoints

The human orchestrator (user) kicks off each phase, approves transitions between cycle stages where judgment is needed, and takes the final call on disagreements between agent rounds. Specifically:

- Approve spec → plan transition (after spec review converges)
- Approve plan → impl transition (after plan review converges)
- Approve impl → merge (after impl review converges, CI green, visual regression accepted)
- Adjudicate conflicting agent rounds when synthesize step can't reconcile

---

## §6 Definition of done

The master plan is "done" when **all** of these hold on `master`:

1. **Structure.** Every product surface lives under `src/features/<feature>/`. `src/components/` contains only shadcn primitives. `src/shared/` holds documented cross-cutting hooks/lib/types. `src/pages/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/utils/`, `src/contexts/` are gone (their contents redistributed into features or shared).
2. **Decomposition.** Every monster file is decomposed into smaller, single-purpose files. No hard LOC caps mandated up front — sizes emerge from the refactoring. If specific limits prove useful, they're codified by Phase 14, not Phase 4.
3. **Type strictness.** `tsconfig.app.json` has `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. `any` confined to a documented `src/shared/types/escape-hatches.ts` (max 10 entries).
4. **Tests.** Vitest + RTL + MSW running. Every feature has unit tests. The originally-monster files (MarketResearch, MissionControl, ICPSummaryOpportunity, DataSourcesManager, ICPManager) have characterization tests proving behavior preservation. Playwright suite + visual regression green.
5. **Lints.** ESLint flat-config with type-aware rules, `import/order`, `import/no-restricted-paths` (per §3.3). Prettier check. `knip` dead-code gate.
6. **CI.** Typecheck, lint, test, build, Playwright, visual regression, bundle-size budget, `knip` — all required to merge.
7. **Per-feature docs.** Every `src/features/<feature>/` has a `README.md`. `src/features/README.md` documents conventions. ADRs captured in `docs/adr/` for non-trivial decisions made across phases.
8. **LOC trajectory.** Two LOC reduction passes complete (Phases 1 and 13). Final LOC reflects what was safely removable without behavior change — no hard target.
9. **Data layer.** TanStack Query is the single source of server-state truth. Three caching layers collapsed into one. Rate-limit boundary centralized.
10. **Agent affordances.** Per-feature scaffolding script working. Codemods committed for patterns surfaced in Phase 13. Watchers (bundle, dead-code, stale-doc) wired into CI.

A phase is "done" when its spec, plan, impl, and ≥1 review round of each are merged into `master`. The master plan is "done" when Phase 14 is merged.

---

## §7 Risks and sequencing

### R1 — Strict TS error explosion (Phase 2a)
**Mitigation:** Phase 1's LOC pass shrinks the surface first. Phase 2a has a hard error-count gate (1,500) — exceeding it triggers sub-decomposition by feature folder or by error category before execution. Phase 0's characterization tests catch behavior regressions even when types change.

### R2 — Characterization tests miss behavior
**Mitigation:** layered safety net. Unit tests (Vitest + RTL) catch component behavior. MSW catches data-layer behavior. Visual regression catches rendering. Playwright catches user journeys. Manual smoke-test sign-off before merge of any phase that touches behavior.

### R3 — TanStack Query migration cascades
**Mitigation:** Phase 3 is purely "adopt the library + collapse caching + define contracts," not "rewrite every fetch site." Per-feature TanStack adoption happens inside each feature phase (5–10), where context is local. Auth/tenant/settings paths migrate in Phase 3 as the proof-of-pattern.

### R4 — Phase 0 grows too large
**Mitigation:** sub-split trigger documented (0a inventory + Playwright/visual lock; 0b Vitest + RTL + MSW + characterization). Decision deferred to spec author.

### R5 — Feature extraction reveals hidden cross-feature coupling
**Mitigation:** hardest-first ordering — Phase 5 (market-research) surfaces the worst coupling early. Discovered shared utilities populate `src/shared/` from the start, rather than being retroactively pulled. Phase 4's features-root README codifies the public-surface convention so cross-feature imports are explicit from day one.

### R6 — Agent context blow-up on monster files
**Mitigation:** Phase 1 trims first. Phase 0's characterization tests act as an "executable spec" agents can read instead of the full file. For Phase 5 specifically (still ≥10k LOC even after pass #1), the spec directs agents to extract in N commits, each commit narrowly scoped.

### R7 — Master plan staleness as phases land
**Mitigation:** synthesize-impl-review step at each phase merge includes "update master-plan deltas" as a checklist item. The master spec stays current rather than becoming a historical snapshot. Backend Spec 13 set this precedent.

### R8 — Codemod incidents during Phase 13
**Mitigation:** every codemod runs against a dedicated commit (one codemod per commit). Visual regression + Vitest + Playwright must stay green between codemod commits. Rollback granularity is per-codemod.

---

## §8 Open questions deferred to phase specs

These don't block the master plan — each becomes the appropriate phase's spec decision:

1. **Vitest characterization-test methodology** — DOM-level snapshot, behavior-only assertions, or both? → Phase 0 spec
2. **Visual regression tool choice** — Playwright's built-in screenshot diff, or a dedicated tool (Chromatic, Percy, Loki)? → Phase 0 spec
3. **Bundle-size budget value** — measured in Phase 0, codified in Phase 2c
4. **API contract types source** — hand-written, OpenAPI codegen, or zod schemas? → Phase 3 spec
5. **`src/shared/` promotion criteria** — what triggers promotion of a hook/util from a feature into shared? → Phase 4 spec, refined as features land
6. **Feature naming canonicalization** — final kebab-case map (market-research, mission-control, customer-profile, etc.) → Phase 4 spec
7. **ADR template** — MADR, Nygard's classic, or a custom slim form? → Phase 4 spec
8. **CI choice** — confirm GitHub Actions vs other; spec author to verify what the repo currently has → Phase 2c spec
9. **TanStack Query persistence strategy** — `localStorage` plugin or no persistence by default? → Phase 3 spec
10. **`scout` vs `scout + profiler` split** — one feature or two? → Phase 9 spec
11. **Where does `AuthContext` live** — `features/shell/`, `features/auth/`, or `src/shared/`? → Phase 11 spec
12. **`src/styles/`** — stays at root, moves to `src/shared/styles/`, or distributes into features? → Phase 11 spec

---

## §9 Companion documents

- `BRANCHES.md` — branch model (already in repo)
- `docs/TECH_DEBT.md` — tech-debt register (already in repo; will gain `TD-FE-<n>` entries)
- Backend specs `2026-05-12-backend-modularization-design.md` through `12-backend-loc-and-docstring-audit-phase-l-design.md` — proven precedent for the discipline applied here
- Backend Spec 13 (`13-prompt-management-design.md`) — set the precedent for keeping a spec reconciled with implementation post-merge rather than freezing it
