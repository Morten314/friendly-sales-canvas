# Branch model — `develop`

This file lives at the root of the **`develop`** branch of `tech-brewra/PWA-multi-tenancy`. It exists so a fresh clone (when push eventually happens) is self-explanatory.

## Where this branch came from

On 2026-05-05 the PWA repo was refactored from "two parallel canvas folders inside one tree" to "two parallel branches with the canvas at root." The full plan is at `/projects/Brewra/plans/01-pwa-folder-to-branch.md`.

This branch was created via:

```bash
git subtree split --prefix=development/friendly-sales-canvas/ -b develop
```

…starting from the `refactor` branch tip. History is preserved with paths rewritten to root. Initial commit is tagged `develop-initial-2026-05-05`.

## What this branch is

`develop` carries the **dev-canvas content** that was previously at `development/friendly-sales-canvas/` on `master`. It's the gitflow-style integration branch for the development line of the PWA.

Branches in this repo, for orientation:

| Branch | Role |
|---|---|
| `master` | Historical reference. Has both canvas folders nested. Do not commit. |
| `refactor` | Pre-split fallback. Same layout as master. Do not commit. Will be deleted later. |
| **`develop` (this branch)** | Dev canvas at root. Integration branch. |
| `production` | Prod canvas at root. Will become Vercel's deploy source after cutover. |

## What this branch is NOT

- Not a superset of `production`. The two have diverged. Components like `MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*`, `profilerCache.ts` exist **only on `production`** and were intentionally not propagated here.
- Not currently deployed anywhere. Vercel still deploys from `master`'s nested folder until a separate cutover plan runs.

## Maintenance rules (Option C — parallel branches, drift accepted)

1. **Bug fixes in shared code:** apply here, then cherry-pick to `production`. Document on both PRs that the fix has a counterpart.
2. **Dev-only features** stay here. `lead-stream/`, `strategist/`, `OpportunityMatchCard`, `ScoutDeploymentDetails` live only on this branch.
3. **Never `git merge develop → production`.** A merge would delete prod-only features. Releases are done by cherry-pick, not merge.
4. **Never `git merge production → develop`** for the same reason in reverse.
5. Reconciling drift between `develop` and `production` is a deliberate, future effort. Not part of routine work.

## Verification

The post-refactor source/build artifacts on this branch are byte-identical to the pre-refactor snapshot at `/projects/Brewra/safety_net_1/snapshots/`. To re-verify:

```bash
FRONTEND_DEV_DIR=/projects/Brewra/pwa-develop \
  /projects/Brewra/safety_net_1/verify.sh source build
```

## Working tree path

The recommended on-disk path for this branch is `/projects/Brewra/pwa-develop/` (a `git worktree` of the PWA-multi-tenancy repo). Don't try to check out this branch in the original `PWA-multi-tenancy/` working tree — the directory layout differs and switching back and forth is confusing.
