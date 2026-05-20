# Plan 05 — PWA develop/production parallel-branch reconciliation

**Status:** not yet specified (concept only)
**Target window:** week of 2026-05-15
**Predecessors:** Plan 01 (folder→branch subtree split), Plan 02 (monorepo fork), Plan 03 (characterization tests), Plan 04 (monorepo merge — brainstormed 2026-05-08, also unspecified)

## Scope

Collapse the PWA's parallel `develop`/`production` synthetic branches into a single trunk. End the dual-folder, dual-branch model and migrate to a standard `master` + `dev` (+ optionally `stage`) layout.

## What "synthetic" and "parallel" mean here

### The two synthetic branches

The PWA repo on GitHub (`tech-brewra/PWA-multi-tenancy`) only really has one branch: `master`. Inside `master`, the Brewra devs maintain two parallel folders that represent two different versions of the same app:

```
PWA-multi-tenancy/  (origin/master)
├── development/friendly-sales-canvas/   ← work-in-progress code
└── production/friendly-sales-canvas/    ← what's actually deployed
```

When the CTO works locally, `git subtree split` turns each folder into an actual git branch:

- `development/friendly-sales-canvas/` → local branch `develop`
- `production/friendly-sales-canvas/` → local branch `production`

These branches **do not exist on origin** — they are carved out of `master` on the CTO's machine only. They are "synthetic" because no one pushed them; they are derived projections of two folders that happen to live side-by-side inside `master`.

### Why "parallel"

The two folders (and therefore the two synthetic branches) have diverged content. They evolve in parallel, with the Brewra dev team occasionally promoting work from `development/` to `production/` inside master. The monorepo has to track both as separate subtree imports:

- `frontend/` on monorepo `develop` ← PWA local `develop`
- `frontend/` on monorepo `production` ← PWA local `production`

That dual import is why `brewra-gtm-intelligence` has both a `develop` and a `production` long-lived branch today.

## Why reconcile

The dual-folder model is awkward — two living versions of the same app, two subtree imports, two long-lived monorepo branches. It was always intended as a temporary bridge while the Brewra dev workflow caught up to a standard branching model.

## What reconciliation looks like

1. **Pick a canonical state for `frontend/`.** Likely direction: merge production-only features forward into develop's refactored architecture, because develop is the direction of travel (the Brewra devs recently refactored "market intelligence and lead stream separated from scout page").

2. **Production-only features that need porting forward** (from the diff between `develop` and `production` frontends, as of 2026-05-12):
   - `/deals` route — Strategist page with card-based deals UI (`Deals.tsx`, ~400 lines)
   - "Strategist" sidebar nav item linking to `/deals`
   - 4 market-intelligence drawer pairs: `MarketRankings`+`MarketRankingDrawer`, `MarketSegments`+`MarketSegmentsDrawer`, `SwotAnalysis`+`SwotAnalysisDrawer`, `TechnologyDrivers`+`TechnologyDriversDrawer` — verify whether these are still desired or were intentionally retired in the develop refactor
   - `src/lib/profilerCache.ts` — likely a caching utility supporting one of the above
   - Note: develop's `MarketResearch.tsx` has a dangling `MarketRankings` import even though the file is absent — flag for the Brewra dev team

3. **Drop the parallel folders inside PWA `master`.** Leave one canonical app at the root.

4. **Drop the local subtree-split branches** (`develop`, `production`) — no longer needed.

5. **Collapse monorepo `develop` and `production` branches** into the new `dev` branch.

## End state

- PWA repo: single `master` trunk, one app at the root (no `development/` or `production/` folders).
- Monorepo: `master` (clean trunk) + `dev` (active integration) + optionally `stage` (pre-prod). No more `develop`/`production` parallel branches.
- Subtree-split mechanism retired.

## Design constraint

Anything that interacts with the PWA branch model (CI configs, deploy targets, branch protection, agent rules) should bias toward the future `master` / `dev` / `stage` shape, not the current `develop` / `production` parallel model. Treat any complexity needed solely to support the parallel-branch state as throwaway.

## Open questions for the Plan 05 spec

- Are the production-only market-intelligence drawers (MarketRankings, MarketSegments, SwotAnalysis, TechnologyDrivers) still desired, or were they intentionally retired in the develop refactor?
- Sequencing: collapse monorepo branches first, or collapse PWA folders first? (Subtree-pull mechanics make this non-trivial.)
- How does the Brewra dev team transition from pushing into `development/` and `production/` folders to pushing into a single trunk?
- Does `stage` get created at the same time, or deferred?

## History

- Original setup (Plan 01, 2026-05-05): the Brewra devs were already pushing both `development/` and `production/` folders into PWA `master` before the CTO joined. Plan 01 was the workaround — let them keep doing that, but locally project each folder as a branch so the monorepo could subtree-pull cleanly.
- 2026-05-08 (Plan 04 monorepo-merge brainstorming): CTO confirmed the parallel-branch state is intentionally short-lived; downstream design should not over-invest in supporting it long-term.
- 2026-05-12 (this doc): captured Plan 05 scope, breakdown of "synthetic branches" terminology, and production-only feature inventory as input for the eventual spec.
