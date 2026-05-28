# Spec 14 — Frontend Refactoring Master Plan

**Status:** Design — round 4 (rounds 1, 2, and 3 reviews synthesized at `docs/reviews/14-frontend-refactoring-master-plan-design-spec-synthesis-1.md`, `…-synthesis-2.md`, and `…-synthesis-3.md`)
**Date:** 2026-05-26 (round 1), 2026-05-26 (round 2 + round 3 revisions), 2026-05-26 (round 4 revisions)
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

> **Note on staleness.** LOC counts above are the pre-Phase-0 baseline. Phase 1's reduction pass will lower these; later feature phases work from post-Phase-1 counts measured in their own specs. The starting-state table here is a point-in-time anchor, not a continuously-updated reference.

### 1.4 Target principle

**Agents-as-authors with anti-slop discipline.** The codebase becomes a place where agents can read, plan, and write efficiently:

- Small, single-purpose files that fit in agent context
- Strict types as machine-readable contracts
- Predictable per-feature structure so agents know where to look and where to put things
- Comprehensive automated guardrails (typecheck, lint, test, build, visual regression, bundle budget) so agents get fast feedback
- Adversarial review at every artifact (spec, plan, implementation) so slop gets caught before merging
- Humans drive (kick off phases, approve transitions, take final call) — agents do the writing

The two roles are deliberately layered: agents *author* the spec/plan/impl text and code; humans *orchestrate* by directing what gets worked on, adjudicating disagreements between rounds, and approving transitions. "Authors" and "drive" name different acts, not contradictory ones.

### 1.5 Alternatives considered

These were explored before the chosen sequence landed. Each is listed with the reason it was rejected:

- **Big-bang refactor of `src/` in one phase.** Rejected: 75,894 LOC against a non-strict TS config and zero unit tests is too large a single-shot risk. Even with characterization tests + Playwright + visual regression, the diff would be unreviewable. The user-chosen "Foundation-first + LOC-first hybrid" front-loads risk into phases 0–2 instead of one terminal megaphase.
- **Slice-based (one vertical feature top-to-bottom at a time, no foundation phase).** Rejected: skipping the strict-TS-everywhere foundation phase means each feature extracts under different type rules, defeating the agent-readiness goal of uniform machine-readable contracts.
- **Strangler fig (new features land in new structure, old features migrate opportunistically).** Rejected: no new features are planned mid-refactor (per §2.2 "No new product features"), so there's no incoming structure to grow into; perpetual two-shape state defeats the modularization goal.
- **Linear backend-mirror A–L (foundation comes before LOC reduction).** Rejected: strict TS lands in foundation before LOC reduction, so the strict-error storm hits a larger surface. Foundation-first big-bang with a LOC pre-pass was preferred.
- **Risk-tiered parallel-friendly per-feature tracks.** Rejected: contradicts the user's strict-everywhere-up-front choice — that variant did strict TS per-feature, not globally.
- **Foundation-first big-bang (no LOC pre-pass).** Rejected in favor of the chosen hybrid: starting strict TS / lint storm work on the full 75k LOC was correctly identified as inviting unnecessary surface area into Phase 2's error count. Inserting Phase 1's LOC reduction first shrinks the foundation surface.

The chosen sequence (this spec) is foundation-first with LOC reduction inserted as Phase 1.

---

## §2 Scope

### 2.1 In scope

- All code under `frontend/src/`
- `frontend/tsconfig.app.json`, `frontend/tsconfig.json`, `frontend/eslint.config.js`, `frontend/vite.config.ts`, `frontend/package.json`
- New test harness (Vitest + RTL + MSW) and characterization tests
- New local preflight gates (typecheck, lint, test, build, Playwright, visual regression, bundle budget, dead-code check) wired into `npm run preflight`
- LOC reduction passes (two of them — pre-foundation in Phase 1 and post-modularization in Phase 13)
- Per-feature `README.md` files inside `src/features/<feature>/`
- ADRs in `docs/adr/` for non-trivial decisions surfaced during phases
- Agent-callable scripts in `frontend/scripts/` (feature scaffolder, codemods surfaced by Phase 13 audit)
- Watchers in preflight (bundle size, dead code, stale-doc grep)
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
- E2E test suite location: stays centralized at `frontend/e2e/` (not co-located inside `src/features/`)
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
│   ├── ui-patterns/           # OPTIONAL: populated only if Phase 13 surfaces repeated UI patterns (form-row, dialog-shell, etc.) that warrant extraction. Omitted otherwise.
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

The diagram shows one of two possible final states. Phase 9 may split `scout/` and `profiler/` into sibling folders if the extraction reveals sufficient separation; if not, both stay inside `scout/`. The §3.1 diagram is the default — Phase 9's spec decides.

`src/styles/` is **carried forward as-is** from the current layout — no phase between 0 and 11 touches it. Phase 11's spec may decide to restructure it per §8 Q12, but the default disposition is no movement.

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
- **Circular imports between features are forbidden.** The `index.ts`-only rule prevents *deep* coupling but does not prevent *cyclic* coupling — feature A importing from feature B's index.ts while feature B imports from feature A's index.ts is still a cycle. If two features genuinely need each other's types or utilities, the shared surface moves to `src/shared/types/` (or the appropriate `src/shared/*` subfolder). Enforced by `import/no-cycle` from `eslint-plugin-import`, configured in Phase 4 alongside the other features-specific lint rules.
- **Enforcement mechanism:** `eslint-plugin-import`'s `import/no-internal-modules` rule (configured to allow `features/<Y>/index` but not deeper paths) is the preferred enforcement for the "index.ts-only" cross-feature constraint. Zone-level restrictions (e.g., `shared/` may not import from `features/`) are enforced by `import/no-restricted-paths`. A heavier alternative is `dependency-cruiser` if the ESLint rules prove insufficient. Exact tool choice is decided in Phase 4's spec (when `src/features/` exists to be enforced against).

### 3.4 Naming canonicalization

Resolved in Phase 4 spec, but the master plan target uses **kebab-case** throughout (`market-research`, `mission-control`, `customer-profile`). Backend uses snake_case (`customer_profile`, `market_research`); the frontend uses kebab-case per JS convention. A naming map will live in the Phase 4 spec.

---

## §4 Phase sequence

17 phases, executed in order. Each phase ships through a full adversarial cycle (see §5).

### Status

| Phase | Status | Merged |
|---|---|---|
| 0a — Inventory | done | 2026-05-26 |
| 0b — Test harness + characterization + gap journeys | done | 2026-05-27 |
| 1 — LOC reduction pass #1 | done | 2026-05-27 |
| 2a — Strict TS turn-on | done | 2026-05-28 |
| 2b — ESLint type-aware + Prettier | done | 2026-05-28 |
| 2c — Preflight gates + bundle budget | pending | — |
| 3 — API/data layer consolidation | pending | — |
| 4 — Feature scaffolding + shell extraction | pending | — |
| 5 — Feature: market-research | pending | — |
| 6 — Feature: mission-control | pending | — |
| 7 — Feature: customers | pending | — |
| 8 — Feature: signals + strategist | pending | — |
| 9 — Feature: scout + profiler | pending | — |
| 10 — Feature: settings + tenant + auth | pending | — |
| 11 — Shared utility extraction | pending | — |
| 12 — Small-pages sweep | pending | — |
| 13 — LOC reduction pass #2 | pending | — |
| 14 — Agent affordances | pending | — |

*Status reflects merge state to `master`. Update at merge time only. Phase descriptions below are intentionally not amended after a phase ships — they're a frozen record of intent per CLAUDE.md "Spec-driven flow."*

### Overview

| # | Phase | Mission |
|---|---|---|
| 0 | Inventory + full safety net | Audit, lock Playwright, visual regression baselines, Vitest+RTL+MSW setup, characterization tests for stable utilities + behavioral E2E for monster-file routes (not monster-file internals) |
| 1 | LOC reduction pass #1 (pre-foundation) | Phase-L-style audit-execute for dead code, dead deps, dead routes, dedup. Backstopped by Phase 0's safety net. |
| 2a | Foundation: strict TS turn-on | Flip `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`. Fix the error storm. |
| 2b | Foundation: ESLint type-aware + Prettier | Upgrade ESLint config, add type-aware rules, `import/order`, Prettier check. Features-specific dependency rules deferred to Phase 4 (where `src/features/` exists to enforce against). |
| 2c | Foundation: preflight gates + budget | Wire all gates into `npm run preflight`: typecheck, lint, test, build, Playwright, visual regression, bundle budget, `knip` dead-code |
| 3 | API/data layer | Adopt TanStack Query. Collapse 3 caching layers into one. Centralize rate-limit. Define contract types in `src/shared/api/`. |
| 4 | Feature scaffolding + shell extraction | Create `src/features/` skeleton + per-feature template + features-root README. Lock `src/components/ui/` for shadcn only. Establish ADR template. **Extract shell** (Sidebar, Header, AuthContext, route shell) into `src/features/shell/` — features render inside the shell, so it lands before Phase 5. Define `<FeatureErrorBoundary>` component. Wire features-specific lint rules (deferred from Phase 2b). |
| 5 | Feature: market-research | Hardest feature first. Extract `pages/MarketResearch.tsx` + all `components/market-research/*` into `src/features/market-research/`. May sub-split (5a page decomposition, 5b component reshuffling). |
| 6 | Feature: mission-control | `pages/MissionControl.tsx` + DataSourcesManager + ICPManager + components/mission-control/* into `src/features/mission-control/`. |
| 7 | Feature: customers | ICPSummaryOpportunity + SuggestedICPCards + SuggestedICPsGallery + Customers page into `src/features/customers/`. |
| 8 | Feature: signals + strategist | Signals page + components/signals/* + components/strategist/* into `src/features/signals/` and `src/features/strategist/`. |
| 9 | Feature: scout + profiler | ScoutDeployment + scout/profiler-related components (split across mission-control and customers today) into `src/features/scout/`. |
| 10 | Feature: settings + tenant + auth | Login, TenantSelection, Settings, CompanyProfile into `src/features/auth/`, `src/features/tenant/`, `src/features/settings/`. |
| 11 | Shared utility extraction | Promote hooks, lib, types used by ≥2 features into `src/shared/`. (Shell extraction moved earlier to Phase 4 — see Phase 11 §.) |
| 12 | Small-pages sweep | Calendar, Deals, Insights, Reports, Artifacts, NotFound — batched. Each becomes a small feature folder or moves into the nearest related feature. |
| 13 | LOC reduction pass #2 (post-modularization audit) | Phase-L-proper. With strict types + tests + features in place, systematic per-file audit on the whole tree. Codemods extracted into `frontend/scripts/`. |
| 14 | Agent affordances | Per-feature README backfill, ADR conventions consolidated, agent-callable scripts (feature scaffolder, codemod runner), preflight watchers (bundle, dead-code, stale-doc grep). Amend root `AGENTS.md`/`CLAUDE.md` only where the new structure makes existing guidance stale. |

### Phase 0 — Inventory + full safety net

**Mission:** establish the audit baseline and the safety net that every subsequent phase relies on.

**Deliverables:**
- Per-feature LOC scorecard (`docs/audits/<date>-frontend-baseline.md`)
- Dependency graph from `knip` / `ts-prune` / `depcheck` (dead exports, dead files, dead deps)
- Bundle-size baseline captured from `vite build`
- **NFR baselines** measured and recorded: `vite build` wall time, `vite` dev-server cold start time, `tsc --noEmit` wall time (against current non-strict config), Playwright full-suite wall time. **Preflight wall time:** captured at Phase 0 as *informational* only — the chain at Phase 0 covers only a subset of checks, so its duration is not the post-foundation anchor. The actual budget anchor for preflight wall time is re-measured in Phase 2c after all checks are wired into the chain. Phase 2c's spec sets the preflight duration budget against its own measurement, not Phase 0's.
- Playwright suite locked green; visual regression snapshots captured for the top screens (market-research, mission-control, customers, signals, scout, settings, login, tenant-selection).
- **Visual regression default:** Playwright's built-in screenshot diff (since the Playwright suite already exists). Heavier tools (Chromatic, Percy, Loki) deferred to post-MVP unless surfaced as needed during Phase 0 spec writing. **Threshold range: 0.5–1.0% pixel delta per screen** — Phase 0's spec selects the exact value within this range. An explicit re-baseline workflow handles accepted intentional UI changes.
- Vitest + React Testing Library + MSW installed and wired.
- **Characterization tests — refocused target.** Build tests against (a) the stable utility code in `src/lib/`, `src/hooks/`, `src/utils/` (these survive the refactor structurally; tests retain value), and (b) behavioral E2E coverage of the user-visible journeys the monster files participate in (these survive because routes and behavior are frozen interfaces per §2.3). **Do not** build deep characterization tests against the internal structure of the monster files themselves (MarketResearch.tsx, ICPSummaryOpportunity.tsx, MissionControl.tsx, DataSourcesManager.tsx, ICPManager.tsx) — those tests would be tied to internals that Phase 5+ extractions will rearrange anyway. The safety net for monster-file refactors is: behavioral E2E (Playwright) + visual regression + the unit tests built up during each feature extraction phase.
- Preflight script scaffolding (`frontend/scripts/preflight.sh` + `npm run preflight` chain in `frontend/package.json`); each later phase appends its checks to the chain in the same commit that installs the tool.

**Sub-split trigger:** if spec author judges the scope too large during spec writing, split into 0a (inventory + NFR baselines + Playwright/visual lock + bundle baseline) and 0b (Vitest + RTL + MSW + behavioral-coverage + utility-targeted characterization tests). Decision in the Phase 0 spec.

**Done when:** all of the above merged on `master`; `npm run preflight` runs Playwright + visual regression locally and is required to pass before any merge to `master` (§5.3).

### Phase 1 — LOC reduction pass #1 (pre-foundation)

**Mission:** shrink the codebase before strict TS + lint hit, so the storm in Phase 2a is smaller.

**Methodology:** mirrors backend Phase L's audit-execute pattern.

- **Stage 1 — Audit (tooling-driven candidate list).** Run `knip` + `ts-prune` + `depcheck` + targeted `rg`/`ast-grep` queries against the full `src/` tree. The combined outputs are the candidate list. Categorize each candidate: `execute` (mechanical, safe — the tool's confidence is high and the pattern is well-known), `investigate` (needs per-site analysis), `defer` (logged to `TD-FE-<n>`). The agent does *not* "read every file"; the tooling produces the candidates and the agent reads only `investigate` items in full.
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

**Error-count gate:** during plan-stage of this phase, run `tsc --noEmit` against the post-Phase-1 codebase. If the error count exceeds **1,500**, the plan author must propose a sub-decomposition by feature folder or by error category (e.g., 2a-i null-handling, 2a-ii implicit-any, 2a-iii unused locals) before proceeding to implementation. Below 1,500, execute as one phase. **Threshold rationale:** 1,500 is a starting heuristic — roughly the error surface where an agent without sub-decomposition can maintain consistent error-category focus across a single plan. Phase 2a's spec author validates against the actual post-Phase-1 error count and adjusts if measurements suggest a different cutoff.

**Escape hatch:** `src/shared/types/escape-hatches.ts` may hold explicit `any` types with documented justification — each entry requires (a) a comment explaining why it exists, and (b) a reference to the call site that needs it. **No hard cap up front:** Phase 2a's own spec sets an initial cap based on the actual error count surfaced during planning; Phase 13's audit re-evaluates every entry and removes the no-longer-needed ones. The number 10 was a placeholder in round 1 — drop the predetermined cap.

**Done when:** `tsc --noEmit` green on the whole frontend; no new `any` types introduced (lint rule from 2b will enforce this going forward).

### Phase 2b — Foundation: ESLint type-aware + Prettier

**Mission:** lint and format guardrails.

- Upgrade `eslint.config.js` to use `typescript-eslint` flat-config (already in deps).
- Add type-aware rules: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`.
- Add `eslint-plugin-import` with `import/order` only at this stage. **Features-specific dependency rules (§3.3) are NOT enforced here** — `src/features/` doesn't exist yet, so the rules would be vacuous. Those rules land in Phase 4 (when the skeleton exists) and become enforceable from Phase 5 onward.
- Add Prettier with shared config (`.prettierrc`), wire `prettier --check` into the lint step.
- Verify the existing `eslint-plugin-react-hooks` config includes all `recommended` rules; add any missing.

**Done when:** `eslint . --max-warnings 0` green; `prettier --check .` green.

### Phase 2c — Foundation: preflight gates + bundle budget

**Mission:** every gate runs as part of `npm run preflight`, blocks merge on failure.

- `npm run preflight` chain in `frontend/package.json` (and `frontend/scripts/preflight.sh` wrapper) runs: typecheck → lint → test (Vitest) → build → Playwright → visual regression → bundle-size budget → `knip --strict` (dead-code). Local-only; no GitHub Actions.
- Bundle-size budget thresholds set from Phase 0 baseline + agreed headroom (spec author proposes; user approves). Comparator script committed to `frontend/scripts/check-bundle-budget.ts`.
- **NFR thresholds set from Phase 0 baselines + agreed headroom.** Budgets cover: `tsc --noEmit` cold wall time, Vitest full-suite wall time, preflight total wall time. Round-2 ballparks (refined by Phase 2c spec against actual numbers): typecheck cold ≤ 30s, Vitest full ≤ 60s, preflight total ≤ 8 min. The ballparks are starting anchors, not fixed mandates — Phase 2c's spec sets the actual budget values from Phase 0 measurements. Slow feedback loops defeat the agent-readiness goal, so these NFRs are first-class gates, not nice-to-haves.
- `knip.json` config locked. Watcher: any new file with no inbound imports fails preflight (via `knip --strict`).
- Visual regression diff threshold codified at the exact value chosen in Phase 0 (within the 0.5–1.0% range). A "re-baseline approved" workflow exists for accepted intentional UI changes: the author runs `npm run test:e2e:update-snapshots` locally and commits the refreshed PNGs as a deliberate change (no CI-side automation).

**Done when:** `npm run preflight` green on the phase branch immediately before merge; gates required to pass for any merge to `master`.

### Phase 3 — API/data layer consolidation

**Mission:** TanStack Query becomes the single source of server-state truth.

- Wire `QueryClient` and `QueryClientProvider` at app root.
- Replace `enhancedApi`'s 5-min in-memory map with TanStack Query's cache.
- Migrate `localStorage` and `sessionStorage` **caching** usage to TanStack Query persistence (or document why a specific case stays on `localStorage`). Features using `sessionStorage` as a primary data store — explicitly Strategist's `sessionStorage.strategistContext` per root `CLAUDE.md` — are **out of scope** for this migration; they hold persistent state, not cache.
- Centralize rate-limit (4 req/min) into a single fetch-middleware layer used by every `useQuery`/`useMutation`.
- Define API contract types in `src/shared/api/contracts.ts` (hand-written initially; OpenAPI codegen deferred unless surfaced as needed). API infrastructure is unambiguously shared (every feature consumes it); Phase 4's promotion criteria formalize the general rule that this placement already follows.
- **`src/services/` disposition.** Identify every file under `src/services/` and assign each to a destination: API-related services move to `src/shared/api/` as part of this phase; feature-local services move with their feature in Phases 5–10. The disposition list lives in the Phase 3 spec so later phases can claim their items.

**Per-call-site migration:** *not* all in this phase. This phase establishes the infrastructure and migrates the lowest-coupled call sites (auth, tenant, settings). Per-feature TanStack adoption happens inside each feature's extraction phase (5–10), where context is local.

**Done when:** `QueryClientProvider` mounted; `src/shared/api/` exists with contract types and the rate-limited fetcher; auth/tenant/settings paths use TanStack Query.

### Phase 4 — Feature scaffolding + shell extraction

**Mission:** establish the `src/features/` skeleton, the shell that features render inside, and the conventions every later feature phase consumes.

**Scaffolding deliverables:**
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

**Shell extraction deliverables (folded in from former Phase 11 — see §4 sequencing note):**
- Extract `src/components/layout/Sidebar.tsx` (816), `src/components/layout/Header.tsx` (554), and the route shell into `src/features/shell/`. Extract `src/contexts/AuthContext.tsx` into `src/features/shell/` or `src/features/auth/` — Phase 4 spec decides (see §8 Q1).
- The shell is the app frame features render inside; pulling it before Phase 5 avoids forcing features to create local layout adapters that get unwound later.
- `src/contexts/TenantContext.tsx` stays where it is for now — it moves with `src/features/tenant/` in Phase 10. AuthContext's final home (shell vs auth) is a Phase 4 spec decision (see §8 Q1).

**Error-boundary deliverable:**
- Define a feature-scoped `<FeatureErrorBoundary>` component in `src/features/shell/` (or `src/shared/components/` — Phase 4 spec decides). From Phase 5 onward, each feature's top-level routed component is wrapped in this boundary. Prevents one feature's runtime error from crashing the whole app.
- **Unit tests** for `<FeatureErrorBoundary>` verifying: (a) catches and renders fallback for thrown errors in children, (b) does not intercept errors outside its subtree, (c) logs error information for debugging. The boundary's whole purpose is fault isolation; an untested one defeats the goal.

**Lint deliverables (the features-specific dependency rules deferred from Phase 2b):**
- Add `import/no-internal-modules` (or `dependency-cruiser` if richer rules are needed — Phase 4 spec decides) configured to allow `features/<Y>/index` but not deeper paths.
- Add `import/no-restricted-paths` zone rules: `shared/` may not import from `features/`; `components/ui/` may not import from `features/` or `shared/`.
- Rules are dormant until Phase 5 produces the first feature, but they're in place so the first extraction trips violations immediately.

**Naming map:** the canonical kebab-case feature names are decided in this phase's spec and listed in `src/features/README.md`.

**Done when:** skeleton exists, README files written, scaffold script working, locked shadcn ui, shell extracted into `src/features/shell/`, error boundary component defined, dependency-rule lint configured.

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
- 5c: **handoff annotation, not a code move.** Components identified as not belonging in market-research (lead-stream → likely customers or its own feature; scout chat panels → scout; strategist workspace → strategist) **stay in their current pre-extraction location** (under `src/components/<area>/`). Phase 5 spec enumerates each component's exact current path. The Phase 5 spec records each such component with its intended target feature. The owning future-phase (7, 8, 9) claims and moves them when it runs. Phase 5 does *not* create transient staging folders; the only invariant is that the Phase 5 spec is the source of truth for what's leaving market-research and where it lands.

**Per-phase deliverables (apply to Phases 5 through 12 unless noted):**
- **TanStack Query migration of this feature's fetch sites.** Convert the feature's manual `apiFetch`/`enhancedApi` calls to `useQuery`/`useMutation` per the patterns established in Phase 3. Server state for this feature lives in TanStack Query's cache, not in `enhancedApi`'s 5-min map.
- **Route update.** Update route definitions in `App.tsx` (or wherever routes are configured) to point to the new feature location (`src/features/market-research/pages/...`). Frozen route URLs (§2.3) do not change; only the imported modules behind them do.
- **Error-boundary wrapping.** The feature's top-level routed component is wrapped in `<FeatureErrorBoundary>` (defined in Phase 4).
- **Per-feature `README.md`** populated with the feature's purpose, public surface (re-exports from `index.ts`), key files, and dependency notes.

**Key risks / coupling points (market-research):**
- Cross-feature couplings: lead-stream (likely belongs in `customers/` or its own feature), scout chat panels (belong in `scout/`), strategist workspace (belongs in `strategist/`). Phase 5 spec must explicitly call which components leave market-research vs stay; failing to disentangle here pushes mess into Phases 8–9.
- `MarketResearch_clean.tsx` duplicate noted in PWA-multi-tenancy may still exist; Phase 1's LOC pass should have removed it, but Phase 5 spec should verify before extraction.
- Large prop surfaces: section components currently consume tab state, search query state, and result data via prop drilling. Phase 5 spec decides whether to lift these into TanStack Query / URL state or feature-local context.

**Done when:** `src/features/market-research/` populated, old paths empty (or thin re-export shims that the next phase removes), per-feature `README.md` exists, route imports resolve to the new feature, TanStack Query is the data layer, tests + Playwright + visual regression green.

### Phase 6 — Feature: mission-control

**Sources moving in:** `src/pages/MissionControl.tsx` (5,645), `src/components/mission-control/*` (DataSourcesManager 3,747; ICPManager 3,269; others).

**Destination:** `src/features/mission-control/`.

**Likely sub-split:** 6a page decomposition; 6b DataSourcesManager extraction; 6c ICPManager extraction. Decided in Phase 6 spec.

**Key risks / coupling points:**
- ICPManager owns ICP CRUD that `customers/` features will consume — defines the public surface `mission-control/index.ts` exposes for Phase 7.
- DataSourcesManager couples to `_helpers`-style cross-cutting upload utilities — Phase 6 spec decides whether to extract these into `src/shared/` immediately or defer to Phase 11.
- Profiler functionality currently lives split between mission-control and customers (per root `CLAUDE.md`) — Phase 6 spec decides what stays vs migrates to `scout/profiler` in Phase 9.

**Profiler disposition (coordination artifact):** Phase 6's spec includes a dedicated "Profiler disposition" section listing each profiler-related component with: current location, interim home (mission-control vs stay-put), intended final home (scout/profiler or other). Phase 7's spec amends this section as customers-side profiler decisions land. Phase 9's spec reads the section before planning and resolves any open items. This is the concrete handoff mechanism that replaces the vague "Phase N spec coordinates" wording.

**Per-phase deliverables:** see Phase 5's deliverables block (TanStack migration, route update, error-boundary wrapping, per-feature README).

### Phase 7 — Feature: customers

**Sources moving in:** `src/components/customers/*` (ICPSummaryOpportunity 6,925; SuggestedICPCards 2,279; SuggestedICPsGallery 1,037; LeadStream 432), `src/pages/Customers.tsx`.

**Destination:** `src/features/customers/`.

**Key risks / coupling points:**
- `ICPSummaryOpportunity` (the largest customers component at 6,925 LOC) couples to mission-control's ICP CRUD. The Phase 7 spec consumes the public surface defined in Phase 6's `mission-control/index.ts`.
- Profiler functionality lives split between mission-control and customers — Phase 7 spec coordinates with Phase 9 (scout + profiler) on what migrates where.
- `LeadStream` (432 LOC here) duplicates name with market-research's `LeadStream` (1,623 LOC) — Phase 1's LOC pass may have surfaced these as candidates for shared extraction; Phase 7 spec confirms whether they're truly duplicates or independent components with shared name.

**Per-phase deliverables:** see Phase 5's deliverables block.

### Phase 8 — Feature: signals + strategist

**Sources moving in:** `src/pages/Signals.tsx` (1,544), `src/components/signals/*` (ScoutChatWithHistory 439; SignalsContextChat 411), `src/components/strategist/*`.

**Destinations:** `src/features/signals/`, `src/features/strategist/`.

**Key risks / coupling points:**
- `ScoutChatWithHistory` (lives in signals, moves here) and `ProfilerChatWithHistory` (per CLAUDE.md, ~90% the same component) — by Phase 8, `ProfilerChatWithHistory` is already inside `src/features/mission-control/` or `src/features/customers/` from Phases 6/7. Phase 8 lacks authority to modify those feature surfaces (§5.5 scope discipline). **Phase 8 extracts `ScoutChatWithHistory` into `src/features/signals/` and records the dedup opportunity as a handoff annotation** (same pattern as Phase 5's 5c) — listing where `ProfilerChatWithHistory` lives and what surface a shared chat-history primitive should expose. **Phase 9 (scout + profiler) owns the actual deduplication** — it has authority over both scout and profiler surfaces and coordinates with mission-control/customers via their `index.ts` public surfaces. The shared primitive lands in `src/shared/` (which exists from Phase 4 onward), not `src/features/scout/` (which doesn't exist until Phase 9 itself).
- Strategist has no backend (per CLAUDE.md — it's a sessionStorage-driven sequence builder); Phase 8 spec confirms the data-layer contract doesn't change and tests preserve the `strategistContext` sessionStorage shape.
- Signals consumes from multiple data sources (market-research, scout) — its public surface defines what `signals/index.ts` exports for cross-feature use.

**Per-phase deliverables:** see Phase 5's deliverables block.

### Phase 9 — Feature: scout + profiler

**Sources moving in:** `src/pages/ScoutDeployment.tsx`, scout/profiler-related components currently split across mission-control and customers (per CLAUDE.md frontend topology note).

**Destination:** `src/features/scout/` (and a sibling `src/features/profiler/` if the spec author decides they're distinct enough — §3.1 note).

**Key risks / coupling points:**
- Scout and Profiler share ~80% of backend code per CLAUDE.md, differentiated only by prompt persona. The frontend may or may not share the same structural pattern — Phase 9 spec evaluates whether to keep them as one feature with two persona modes vs split into siblings.
- `ProfilerChatWithHistory` ↔ `ScoutChatWithHistory` deduplication — **Phase 9 owns this dedup work**, reading Phase 8's handoff annotation that records `ScoutChatWithHistory`'s current location and the proposed shared surface. The shared chat-history primitive lands in `src/shared/` (or inside `src/features/scout/` if Phase 9 decides scout should own it). Phase 9 coordinates with mission-control/customers via their `index.ts` public surfaces to refactor `ProfilerChatWithHistory` call sites without reaching into their internals.
- Profiler is currently split between `/mission-control` and `/customers` routes (CLAUDE.md) — Phase 9 resolves the Profiler disposition section started in Phase 6 and amended in Phase 7. **Precondition:** Phase 9's spec author reads Phase 6 and Phase 7 specs' Profiler disposition sections before planning.
- `lovable-tagger` and related Lovable artifacts may still be present in scout-adjacent files; Phase 1 may have caught them but Phase 9 spec verifies before extraction.

**Per-phase deliverables:** see Phase 5's deliverables block.

### Phase 10 — Feature: settings + tenant + auth

**Sources moving in:**
- `src/pages/Login.tsx` + Firebase integration → `src/features/auth/`
- `src/pages/TenantSelection.tsx` + `src/contexts/TenantContext.tsx` → `src/features/tenant/`
- `src/pages/Settings.tsx` + `src/components/settings/*` (CompanyProfile 601) → `src/features/settings/`

**Key risks / coupling points:**
- AuthContext currently lives at `src/contexts/AuthContext.tsx` and was extracted in Phase 4 into `src/features/shell/` (or `src/features/auth/` per Phase 4 spec decision — §8 Q1). Phase 10's `auth/` feature reuses whichever location was chosen; it does not re-extract. **If Phase 4 placed AuthContext in `shell/`**, Phase 10's auth feature spans two folders: Login + Firebase integration in `src/features/auth/`, context in `src/features/shell/`. Login calls AuthContext methods, so the cross-folder coupling must be mediated by `shell/index.ts`'s public surface — Phase 10 spec confirms `shell/index.ts` exports enough auth surface that `auth/` doesn't reach into shell internals.
- TenantContext + TenantSelection page form a tight pair — Phase 10 spec confirms they ship together rather than splitting context (in `tenant/`) from page (anywhere else).
- Firebase email/password integration touches multiple files (auth callbacks, JWT manager); Phase 10 spec maps the full Firebase surface area before extraction.
- Settings consumes the company profile API — Phase 10 spec confirms the API contract types live in `src/shared/api/` (from Phase 3) rather than being defined locally.

**Per-phase deliverables:** see Phase 5's deliverables block.

### Phase 11 — Shared utility extraction

**Mission:** with all major features extracted (Phases 5–10), identify cross-cutting code that genuinely belongs in `src/shared/` rather than inside any single feature. Phase 12's small-pages sweep follows after; any additional shared utilities surfaced there are pulled into `src/shared/` at the time Phase 12 needs them.

**Note on Phase 11's narrowed scope:** Shell extraction (Sidebar, Header, AuthContext, route shell) was moved to Phase 4 (see §4 sequencing rationale). Phase 11 now focuses exclusively on **shared utility extraction** — promoting hooks, lib utilities, and types that multiple features depend on into `src/shared/`. The promotion criteria documented in `src/shared/README.md` (per Phase 4) drive these decisions.

**Sources moving in:**
- Cross-cutting hooks (whatever remains under `src/hooks/*` after features absorbed their feature-local hooks) → `src/shared/hooks/`
- Lib utilities (`src/lib/*` outside the api files moved in Phase 3) → `src/shared/lib/`
- Utils (`src/utils/*`) → `src/shared/lib/` or `src/shared/hooks/` depending on shape
- Types depended on by multiple features → `src/shared/types/`

**Key risks / coupling points:**
- Premature shared extraction creates wrong abstractions. Phase 11 only promotes when a utility is *demonstrated* to be used by ≥2 features after Phases 5–10. Single-feature utilities stay inside their feature.
- Features that need a "shared" utility before Phase 11 land it in their feature folder and let Phase 11 promote — do not pre-extract.

**Per-phase deliverables (lighter than Phases 5–10 — no feature extraction):**
- Verify `src/pages/` is empty (or only contains `App.tsx`-routed entry points).
- Verify `src/components/` contains only `ui/`.
- Verify `src/contexts/`/`hooks/`/`lib/`/`services/`/`utils/` are gone or redirected. Any remaining file is justified in the Phase 11 spec or moved.
- Route imports all resolve to feature folders (no `src/pages/*` references remain in `App.tsx`).

**Done when:** the above verifications pass; `src/shared/` is populated with the genuinely-shared utilities discovered in Phases 5–10. Phase 12 handles any additional shared-utility surface inline as it runs (per the description text above).

### Phase 12 — Small-pages sweep

**Sources moving in:** `src/pages/Calendar.tsx`, `src/pages/Deals.tsx`, `src/pages/Insights.tsx`, `src/pages/Reports.tsx`, `src/pages/Artifacts.tsx` (666 LOC), `src/pages/NotFound.tsx`. (Equivalently: every page under `src/pages/` not claimed by Phases 5–10.)

**Destinations:** each becomes its own small feature folder under `src/features/`, or merges into the nearest related feature (decided per-page in Phase 12 spec).

**Per-phase deliverables:** see Phase 5's deliverables block (TanStack migration where the page has data fetching; route update; error-boundary wrapping; per-feature README). Small pages may not need all of these — Phase 12 spec applies per-page judgment.

### Phase 13 — LOC reduction pass #2 (post-modularization audit)

**Mission:** the Phase-L-proper analog. Now that strict TS + tests + features are in place, do the systematic per-file audit.

**Methodology:** same audit-execute pattern as Phase 1, but with broader opportunity categories:

- Categories 1–9 from Phase 1 (still in scope where any remain)
- Near-identical components (differ by props or by a single literal — refactor to base + overlay)
- Near-duplicate hooks (same TanStack Query pattern with one parameter difference — extract)
- Repeated UI patterns (form-row, dialog-shell, table-wrapper) — extract to `src/shared/ui-patterns/` if they're not shadcn primitives
- Inline state-management blocks (same `useState` + `useEffect` triplet ≥3 times) — extract to a hook
- Single-use trivial wrapper components (one-line return) — inline unless they add semantic clarity

**Codemods (selective, not auto-mandated):** the ≥3-occurrence threshold is a *candidacy signal* for codemod treatment, not an automatic mandate. A pattern earns a codemod only when it is (a) **likely to recur** in future feature work or future codebase changes, and (b) **mechanically transformable** (the transformation is structural enough that a script can apply it correctly). Ad-hoc one-off patterns that happen to appear 3+ times are fixed manually — building a codemod for a pattern that may never appear again is wasted tooling. When the audit decides yes, codemods land in `frontend/scripts/codemods/<name>.ts` (using ts-morph or jscodeshift) with a documented invocation and a test case (input → expected output). The codemod runs against the codebase as part of Phase 13, then stays committed for future re-use.

**Codemod test approach:** Vitest + filesystem fixtures under `frontend/scripts/codemods/__tests__/` — each codemod has an `input.ts` and `expected.ts` pair; the test reads input, applies the codemod, compares against expected. AST-based codemods don't fit the DOM-oriented Vitest+RTL pattern; this filesystem-fixture approach is lightweight enough not to need a separate harness. Phase 13's spec finalizes the exact pattern.

**Done when:** scorecard at `docs/audits/<date>-frontend-loc-pass-2.md` covers every file; all `execute` and confirmed-safe `investigate` findings applied; codemods committed.

### Phase 14 — Agent affordances

**Mission:** finalize the agent-readiness layer.

- Backfill any missing per-feature `README.md` files (most populated during their phase, this catches gaps)
- Consolidate ADRs: every non-trivial decision made during Phases 0–13 is captured (one ADR per decision)
- Agent-callable scripts in `frontend/scripts/`:
  - `scaffold-feature.sh` (from Phase 4) hardened
  - `codemod-runner.sh` (runs codemods from `scripts/codemods/`)
  - any others surfaced during the journey
- Preflight watchers added (each runs as part of `npm run preflight`):
  - bundle-size delta watcher (warn on +5%, fail on +10% without override)
  - dead-code watcher (`knip` in --strict mode)
  - stale-doc grep (any reference to `Phase N` outside specs/, plans/, docs/audits/, docs/reviews/ fails — same pattern backend Phase L used for stale docstrings). **Default regex:** `\b[Pp]hase[- ]?\d+[a-z]?\b` (matches "Phase 5", "phase-5", "Phase 2a", "phase 12"). **Allowlist mechanism:** `.stale-doc-allowlist.txt` at repo root lists path patterns where phase references are legitimate (e.g., this spec, the master spec amendments, ADRs that name the phase that triggered them). The allowlist is expected to be non-trivial in size — Phase 14's spec should evaluate whether an inverted approach (scan only `src/` files, not docs/specs/plans) is more maintainable than maintaining a large allowlist. Phase 14's spec finalizes the regex and the allowlist policy.
- Amend root `AGENTS.md`/`CLAUDE.md` **only where** the new structure makes existing guidance stale. No duplicate `frontend/AGENTS.md`.

**Done when:** every feature has a `README.md`; ADR set is complete; scripts are working; preflight watchers (bundle, dead-code, stale-doc) gate merges via `npm run preflight`.

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

### 5.3 Preflight gates per phase

There is no GitHub Actions CI in this repo. The pre-merge quality gate is `npm run preflight` in `frontend/`, run locally by the controller agent immediately before the user-approved merge step (§5.6). Each phase extends the preflight chain by appending its phase's checks; later phases' chains are supersets of earlier phases'.

- Phase 0a: preflight = typecheck + Playwright + visual regression + build (`tsc --noEmit && vite build && playwright test`). Lint deferred to Phase 2b (the existing `eslint .` script is red at 0a with 428 errors, mostly `@typescript-eslint/no-explicit-any`; 2b is the phase that tightens/loosens the lint config to be green).
- Phase 0b: above + Vitest (`npm run test`)
- Phase 1: above + `knip --strict` (deferred to Phase 1 because Phase 0a's dead-code baseline shows 32 unused files; `--strict` becomes meaningful only after Phase 1's cleanup pass)
- Phase 2a: above + strict-TS-aware typecheck (the same `tsc --noEmit` command, against the strict-mode config landed by 2a)
- Phase 2b: above + lint (`eslint .`, with `--max-warnings 0`) + Prettier check (`prettier --check`). 2b's spec decides whether to (a) tighten the config and fix the existing 428 errors, (b) relax the rules that triggered them, or (c) some mix. Either way, lint must be green at the end of 2b.
- Phase 2c onward: above + bundle-budget comparator (`tsx scripts/check-bundle-budget.ts` against the baseline JSON from Phase 0a)

**Preflight failure = no merge.** If preflight goes red, the controller reports which check failed and does not merge. The user decides whether to fix on the branch and re-run, or abort the phase. No "fix forward" through a failed preflight, and no override (the script does not have a `--force` flag, by design).

The pre-shaped `frontend/scripts/preflight.sh` wrapper + `npm run preflight` chain in `frontend/package.json` are the source of truth. As each phase lands its tooling, that phase's plan appends to the chain in the same commit that installs the tool.

### 5.4 Artifacts per phase

Review and synthesis filenames derive from the spec's or plan's filename. The base is the spec/plan file's basename without `.md`, with `-review-N.md` or `-synthesis-N.md` appended (where `N` is the round number). This matches the precedent set by Spec 14 itself (`14-frontend-refactoring-master-plan-design-spec-review-1.md`) and backend specs.

| Artifact | Location |
|---|---|
| Spec | `specs/<NN>-<phase-name>-design.md` |
| Plan | `plans/<NN>-<phase-name>.md` |
| Spec reviews | `docs/reviews/<NN>-<phase-name>-design-spec-review-<round>.md` |
| Spec syntheses | `docs/reviews/<NN>-<phase-name>-design-spec-synthesis-<round>.md` |
| Plan reviews | `docs/reviews/<NN>-<phase-name>-plan-review-<round>.md` |
| Plan syntheses | `docs/reviews/<NN>-<phase-name>-plan-synthesis-<round>.md` |
| Impl reviews | `docs/reviews/<NN>-<phase-name>-impl-review-<round>.md` |
| Impl syntheses | `docs/reviews/<NN>-<phase-name>-impl-synthesis-<round>.md` |
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
- Approve impl → merge (after impl review converges). Controller then runs `npm run preflight` locally per §5.3; green proceeds with `git merge` + `git push origin master`, red blocks the merge and reports the failing check.
- Adjudicate conflicting agent rounds when synthesize step can't reconcile

### 5.7 Abort and revert protocol

Not every phase will land cleanly. The protocol for when a phase branch cannot reach its done-when state:

- **Trigger conditions:** (a) the implementation diverges substantially from the plan and the plan's assumptions have been invalidated (e.g., Phase 5 discovers market-research's coupling is far worse than the spec described); (b) `npm run preflight` can't be made green within bounded effort and the failures point to a deeper design problem rather than mechanical bugs; (c) implementation cost has clearly exceeded the spec's expected scope (≥2× by reasonable measure) without convergence.
- **Action:** revert the branch (do not merge partial progress). Log findings as `TD-FE-<n>` entries in `docs/TECH_DEBT.md` capturing what was discovered. Open a follow-on revised spec (round 2 of the phase) addressing what the failure revealed.
- **Human checkpoint:** the human orchestrator (user) confirms the abort decision. Agents propose; humans approve. This is not a unilateral agent decision.
- **No "fix forward" through a failed phase.** Per §5.3, the rule against fixing forward through hook failures extends to phase-level: a phase that cannot finish does not ship partial. The cost of reverting is much smaller than the cost of merging half-broken structural work into `master`.
- **Sub-phase granularity.** Within a sub-split phase (e.g., Phase 5's 5a/5b/5c, Phase 6's 6a/6b/6c), each sub-phase is a discrete commit (or commit series) that leaves the codebase in a green state. If a sub-phase fails, revert to the last green sub-phase commit and replan the remainder — the full phase doesn't need to revert. The abort/revert protocol above triggers only when the *phase as a whole* can't reach done.

---

## §6 Definition of done

The master plan is "done" when **all** of these hold on `master`:

1. **Structure.** Every product surface lives under `src/features/<feature>/`. `src/components/` contains only shadcn primitives. `src/shared/` holds documented cross-cutting hooks/lib/types. `src/pages/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/utils/`, `src/contexts/` are gone (their contents redistributed into features or shared).
2. **Decomposition.** Every monster file is decomposed into smaller, single-purpose files. No hard LOC caps mandated up front — sizes emerge from the refactoring. If specific limits prove useful, they're codified by Phase 14, not Phase 4.
3. **Type strictness.** `tsconfig.app.json` has `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. `any` confined to a documented `src/shared/types/escape-hatches.ts` — each entry requires documented justification and a call-site reference. Phase 2a's spec sets the initial count cap from actual error measurements; Phase 13's audit re-evaluates every entry. No hard cap mandated by the master plan.
4. **Tests.** Vitest + RTL + MSW running. Every feature has unit tests. Stable utilities under `src/shared/` have characterization tests carried forward from Phase 0. Behavioral E2E coverage (Playwright) for the user journeys the originally-monster files participate in is green. Visual regression green at the threshold set in Phase 0.
5. **Lints.** ESLint flat-config with type-aware rules, `import/order`, `import/no-restricted-paths` (per §3.3). Prettier check. `knip` dead-code gate.
6. **Preflight.** `npm run preflight` runs typecheck + lint + Vitest + Playwright + visual regression + build + bundle-size budget + `knip --strict` and is required to pass before any `git merge` to `master`. Local-only (no GitHub Actions); the controller agent runs it as part of the user-approved merge step (§5.3, §5.6).
7. **Per-feature docs.** Every `src/features/<feature>/` has a `README.md`. `src/features/README.md` documents conventions. ADRs captured in `docs/adr/` for non-trivial decisions made across phases.
8. **LOC trajectory.** Two LOC reduction passes complete (Phases 1 and 13). Final LOC reflects what was safely removable without behavior change — no hard target.
9. **Data layer.** TanStack Query is the single source of server-state truth. Three caching layers collapsed into one. Rate-limit boundary centralized.
10. **Agent affordances.** Per-feature scaffolding script working. Codemods committed for patterns surfaced in Phase 13. Watchers (bundle, dead-code, stale-doc) wired into `npm run preflight`.

A phase is "done" when its spec, plan, impl, and ≥1 review round of each are merged into `master`. The master plan is "done" when Phase 14 is merged.

---

## §7 Risks and sequencing

### R1 — Strict TS error explosion (Phase 2a)
**Mitigation:** Phase 1's LOC pass shrinks the surface first. Phase 2a has an error-count threshold (1,500) for sub-decomposition trigger — exceeding it requires the plan author to propose a sub-decomposition by feature folder or by error category before execution (the phase still proceeds, just with finer-grained sub-phases). "Gate" terminology is reserved for preflight checks that actually block merge. Behavioral E2E + visual regression (locked in Phase 0) catch behavior regressions even when type signatures change, without requiring deep characterization tests against monster-file internals.

### R2 — Characterization tests miss behavior
**Mitigation:** layered safety net. Unit tests (Vitest + RTL) catch component behavior. MSW catches data-layer behavior. Visual regression catches rendering. Playwright catches user journeys. Manual smoke-test sign-off before merge of any phase that touches behavior.

### R3 — TanStack Query migration cascades
**Mitigation:** Phase 3 is purely "adopt the library + collapse caching + define contracts," not "rewrite every fetch site." Per-feature TanStack adoption happens inside each feature phase (5–10), where context is local. Auth/tenant/settings paths migrate in Phase 3 as the proof-of-pattern.

### R4 — Phase 0 grows too large
**Mitigation:** sub-split trigger documented (0a inventory + Playwright/visual lock; 0b Vitest + RTL + MSW + characterization). Decision deferred to spec author.

### R5 — Feature extraction reveals hidden cross-feature coupling
**Mitigation:** hardest-first ordering — Phase 5 (market-research) surfaces the worst coupling early. Discovered shared utilities populate `src/shared/` from the start, rather than being retroactively pulled. Phase 4's features-root README codifies the public-surface convention so cross-feature imports are explicit from day one.

### R6 — Agent context blow-up on monster files
**Mitigation:** Phase 1 trims first. Behavioral E2E tests (Playwright) and visual regression act as the "executable spec" agents can verify against without reading the full file. For Phase 5 specifically (still ≥10k LOC even after pass #1), the spec directs agents to extract in N commits, each commit narrowly scoped to a section of the monster file. The structural decomposition is the agent's path through the file, not a single-shot read.

### R7 — Master plan staleness as phases land
**Mitigation:** synthesize-impl-review step at each phase merge includes "update master-plan deltas" as a checklist item. The master spec stays current rather than becoming a historical snapshot. Backend Spec 13 set this precedent.

### R8 — Codemod incidents during Phase 13
**Mitigation:** every codemod runs against a dedicated commit (one codemod per commit). Visual regression + Vitest + Playwright must stay green between codemod commits. Rollback granularity is per-codemod.

---

## §8 Open questions deferred to phase specs

These don't block the master plan — each becomes the appropriate phase's spec decision:

1. **Vitest test methodology for stable utilities** — behavior-only assertions vs DOM snapshots vs both? → Phase 0 spec
2. **Visual regression exact threshold** — within the 0.5–1.0% default range, what's the precise value? Re-baseline workflow details (local-only via `npm run test:e2e:update-snapshots`; no CI-side automation). → Phase 0 spec
3. **Bundle-size and NFR budget values** — measured in Phase 0, codified in Phase 2c. Round-2 ballparks (typecheck cold ≤ 30s, Vitest full ≤ 60s, preflight total ≤ 8 min) are anchors, not fixed mandates.
4. **API contract types source** — hand-written, OpenAPI codegen, or zod schemas? → Phase 3 spec
5. **`src/shared/` promotion criteria** — what triggers promotion of a hook/util from a feature into shared? → Phase 4 spec, refined as features land
6. **Feature naming canonicalization** — final kebab-case map (market-research, mission-control, customer-profile, etc.) → Phase 4 spec
7. **ADR template** — MADR, Nygard's classic, or a custom slim form? → Phase 4 spec
8. **CI choice — RESOLVED:** no external CI in this repo. Pre-merge quality gate is the local `npm run preflight` chain run by the controller agent (§5.3). No GitHub Actions, no other runner.
9. **TanStack Query persistence strategy** — `localStorage` plugin or no persistence by default? → Phase 3 spec
10. **`scout` vs `scout + profiler` split** — one feature or two? → Phase 9 spec
11. **Where does `AuthContext` live** — extracted in Phase 4 into `features/shell/` or `features/auth/`? → Phase 4 spec (now the phase that owns shell extraction)
12. **`src/styles/`** — stays at root, moves to `src/shared/styles/`, or distributes into features? → Phase 11 spec
13. **Feature-error-boundary location** — `src/features/shell/` (alongside the shell) or `src/shared/components/`? → Phase 4 spec
14. **Phase 11 standalone vs absorbed** — with shell extraction moved to Phase 4, the narrowed Phase 11 (shared utility extraction only) could fold into the Phase 13 cleanup audit. → Decided based on what Phases 5–10 surface as shared
15. **Codemod candidacy criteria** — Phase 13 produces codemods only for patterns that are "likely to recur" and "mechanically transformable" — what does the spec author use to decide? → Phase 13 spec, with examples from Phases 5–12 work to ground the criteria
16. **Lint rule for `index.ts`-only enforcement** — `import/no-internal-modules` (preferred) vs `dependency-cruiser` for richer rules? → Phase 4 spec

---

## §9 Companion documents

- `BRANCHES.md` — branch model (already in repo)
- `docs/TECH_DEBT.md` — tech-debt register (already in repo; will gain `TD-FE-<n>` entries)
- Backend specs `2026-05-12-backend-modularization-design.md` through `12-backend-loc-and-docstring-audit-phase-l-design.md` — proven precedent for the discipline applied here
- Backend Spec 13 (`13-prompt-management-design.md`) — set the precedent for keeping a spec reconciled with implementation post-merge rather than freezing it
