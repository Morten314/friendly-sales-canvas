# Branches

This repo is in a **temporary parallel-branch state** during the fork transition. After Plan 05 reconciliation and Brewra-dev migration, this file gets rewritten for the future `master`/`dev`(/`stage`) model.

## Current branches (temp week)

| Branch | Role | Policy |
|---|---|---|
| `master` | Stable trunk. Feature work merges in from short-lived branches. | No direct feature commits — branch off `master`, get review when warranted, merge back. Direct commits reserved for `sync.sh` merges and trivial doc/typo fixes. |
| `develop` | Tracker mirror of PWA `master`'s `development/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `production` | Tracker mirror of PWA `master`'s `production/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `pwa-master-history` | Read-only archive of PWA's `master` (pre-Plan-01 history with original SHAs). | Never write. |

## Discipline rules

- **Feature work happens on a branch off `master`** and merges back after review. Use judgment for when a change warrants review — plan execution, multi-commit refactors, and non-trivial logic generally do; trivial fixes don't. Direct commits to `master` are reserved for `sync.sh`/`git merge develop` and trivial doc/typo fixes. Branch naming is author's judgment; delete after merge.
- `sync.sh` updates `develop`/`production` automatically; if you commit there manually, the next sync may conflict.

## Workflows

**Sync from Brewra devs:** `bash scripts/sync.sh` — pulls latest from old PWA + backend repos onto tracker branches.

**Absorb FE updates into master:** `git checkout master && git merge develop`.

**Backend changes:** if originated in old `backend` repo (Brewra dev pushes to `main`), `sync.sh` propagates to all three monorepo branches automatically. If originated on monorepo's `master` (CTO's branch work merged in), they don't propagate to trackers — they ship via cutover (this is intentional per spec).

## Future state (post-cutover)

After cutover, this file gets rewritten. Tracker branches deleted. Future model:
- `master` — main branch
- `dev` — integration
- (optional) `stage` — pre-production

`pwa-master-history` is retained indefinitely as the long-term archive.
