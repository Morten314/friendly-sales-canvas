# safety_net_1 — Pre-Refactor Snapshot & Guidelines

This folder is the **safety net for the upcoming structural refactor** of the Brewra codebase. It does not contain tests. It contains a frozen, hashable record of "what the codebase looked like and built into" right now, plus the script and checklist needed to verify that the refactor changed location-of-things without changing behavior-of-things.

The accompanying analysis backup at `/projects/Brewra_codebase_analysis/` (sibling of `/projects/Brewra/`) preserves the `claude-analysis/` and `detailed-analysis/` folders, which are not in any git repo and would be lost if the parent directory were rearranged.

## Why this safety net exists

Two structural problems will be addressed (in order):

1. **Folder→branches, inside the frontend repo.** `PWA-multi-tenancy/development/friendly-sales-canvas/` and `PWA-multi-tenancy/production/friendly-sales-canvas/` have diverged in source. The plan is to consolidate them into branches of one tree instead of parallel folders.
2. **Two repos→monorepo.** `backend/` and `PWA-multi-tenancy/` will be combined into a single repo with two top-level folders.

Both refactors are **git operations on file location, not behavior changes**. The right safety net for that is not a test suite (the codebase has zero test infrastructure on either side, and bolting it on under refactor pressure produces shallow tests that pass without catching anything). The right safety net is:

- **Hash everything** that should not change (source file content, build output, dependency lockfiles, API schema).
- **Snapshot what state we started from** (git SHAs, branches, remotes, uncommitted edits) so we can always reconstruct the starting point.
- **Re-hash after the refactor** and confirm everything matches. If anything differs, we know exactly what — file-by-file.

## What's inside

```
safety_net_1/
├── GUIDELINES.md                      # this file
├── SMOKE_CHECKLIST.md                 # manual smoke test for critical user flows
├── verify.sh                          # re-hash current state and diff vs snapshot
├── build-logs/                        # raw output of the npm builds (kept for forensics)
│   ├── frontend-dev-build.log
│   ├── frontend-prod-build.log
│   └── frontend-prod-install.log
└── snapshots/
    ├── git-state-backend.md           # backend repo HEAD/branch/remote/uncommitted
    ├── git-state-pwa.md               # PWA repo HEAD/branch/remote/uncommitted
    ├── backend-source.sha256          # SHA256 of every git-tracked backend file (paths repo-root-relative)
    ├── frontend-dev-source.sha256     # SHA256 of every git-tracked file under dev frontend (paths canvas-root-relative)
    ├── frontend-prod-source.sha256    # SHA256 of every git-tracked file under prod frontend (paths canvas-root-relative)
    ├── frontend-dev-build.sha256      # SHA256 of every file in dev `dist/` after `npm run build`
    ├── frontend-prod-build.sha256     # SHA256 of every file in prod `dist/` after `npm run build`
    ├── dependency-manifests.sha256    # SHA256 of package.json/lock files + requirements.txt (logical keys, not paths)
    ├── backend-openapi.json           # /openapi.json pulled from prod backend
    └── tool-versions.md               # node/npm/python/git versions at snapshot time
```

**Why paths are relative, not absolute.** Source manifests use paths relative to the project root (e.g., `src/App.tsx`, not `/projects/Brewra/.../src/App.tsx`). After the folder→branch refactor, the canvas folder becomes the repo root on each branch, and these relative paths are unchanged. The dependency manifest uses logical keys (`fe-dev/package.json`) for the same reason. This means the **same snapshot is reusable post-refactor** — you don't regenerate it.

## How to use this during the refactor

### Step 0 — before doing anything

Confirm the snapshot is current:

```bash
./verify.sh all
```

Should print `RESULT: all checked categories match snapshot` and exit 0. If anything diverges, **stop** — something has changed since the snapshot was taken, and the safety net is no longer the baseline you think it is. Decide whether to refresh the snapshot or revert the unintended change.

### Step 1 — do the refactor in a worktree or branch

Never touch the live tree. Use `git worktree add` (or a throwaway branch) so you can abandon the work at any moment. The `using-git-worktrees` skill in this environment helps.

### Step 2 — after the refactor, point verify.sh at the new layout

Override the path env vars when the structure has changed. Example for the post-folder→branch state on the `develop` branch checkout:

```bash
FRONTEND_DEV_DIR=/path/to/checked-out-dev-branch \
FRONTEND_PROD_DIR=/path/to/checked-out-prod-branch \
./verify.sh source
```

For the post-monorepo state:

```bash
BACKEND_DIR=/path/to/monorepo/backend \
FRONTEND_DEV_DIR=/path/to/monorepo/frontend \
./verify.sh source build deps
```

### Step 3 — rebuild and re-verify the dist

`./verify.sh build` only works after you've actually run `npm run build` in the new location. The dist hashes must match — if they don't, the deployed artifact would change, which means user-visible behavior would change. Either revert or investigate.

### Step 4 — re-pull OpenAPI

`./verify.sh openapi` pulls `https://backend-11kr.onrender.com/openapi.json` and compares. Backend code will not change during these structural refactors, so this should always match. If it doesn't, someone deployed something else mid-refactor — pause and figure out what.

### Step 5 — manual smoke test

Run through `SMOKE_CHECKLIST.md` against the deployed preview (Vercel/Render preview deploys, not local dev). Hashes prove the artifact is identical; the smoke test proves the artifact still actually works end-to-end (catches issues in deploy config, env vars, proxy paths — things that aren't in the artifact itself).

## TODOs

### Done (this snapshot)
- [x] Backed up `claude-analysis/` and `detailed-analysis/` to `/projects/Brewra_codebase_analysis/` (verified by hash match)
- [x] Captured `git rev-parse HEAD` + branch + remote for both repos
- [x] Recorded uncommitted file lists (modified analysis docs in both repos — see git-state-*.md)
- [x] Hashed every git-tracked file in `backend/` (27 files)
- [x] Hashed every git-tracked file in `development/friendly-sales-canvas/` (255 files)
- [x] Hashed every git-tracked file in `production/friendly-sales-canvas/` (246 files)
- [x] Built dev frontend (`npm run build`, exit 0, 5.54s, 15 dist files, 2.2 MiB)
- [x] Built prod frontend (`npm run build`, exit 0, 5.78s, 15 dist files, 2.1 MiB)
- [x] Hashed both `dist/` outputs
- [x] Pulled `/openapi.json` from prod backend (44 paths, 27 schemas)
- [x] Hashed `package.json`, `package-lock.json`, `bun.lockb` (FE) and `requirements.txt` (BE)
  - Dev and prod have **byte-identical** dep manifests — only source has diverged
- [x] Captured node/npm/python/git versions
- [x] Wrote and sanity-checked `verify.sh` (passes against current state, exits 0)

### Before you start the refactor (human action)

- [ ] **Push or stash uncommitted changes** in both repos. The snapshot records them as "modified" but does not save their content. If you blow them away during the refactor, they're gone.
  - `backend/`: 2 modified files in `analysis/`
  - `PWA-multi-tenancy/`: 3 modified files in `analysis/`
- [ ] **Tag the current HEAD on both remotes** (`git tag pre-refactor-2026-05-05 && git push --tags` from inside each repo). Tags are cheap insurance; if anything goes sideways you can always reset to the tag.
- [ ] **Confirm Render and Vercel deploy configs are documented** — `render.yaml` is in the backend repo; the frontend deploy is via `vercel.json` + Vercel dashboard settings. The dashboard settings are not in the snapshot. Take a screenshot or copy them out.
- [ ] **Write down which dev/prod components win** for the divergent files (`MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*` only in prod; `lead-stream/`, `strategist/`, `OpportunityMatchCard`, `ScoutDeploymentDetails` only in dev). The folder→branch refactor cannot infer this — it's a product decision.

### After the folder→branch refactor

- [ ] Run `./verify.sh source` against each branch checkout — every file from the original folder must hash-match on its corresponding branch.
- [ ] Run `npm run build` on each branch and `./verify.sh build` — `dist/` must be byte-identical to the snapshot.
- [ ] Deploy preview to Vercel from the new branch structure; smoke test before flipping production.
- [ ] Run through `SMOKE_CHECKLIST.md`.

### After the repo merge

- [ ] Run `./verify.sh all` with `BACKEND_DIR` / `FRONTEND_DEV_DIR` / `FRONTEND_PROD_DIR` pointed at the new monorepo paths.
- [ ] Confirm Render still builds the backend (`render.yaml` + working dir).
- [ ] Confirm Vercel still builds the frontend (working dir + build command).
- [ ] Smoke test again.

## Important explanations and caveats

**This snapshot does not protect against deploy config errors.** If Render or Vercel point at the wrong path after the refactor, `verify.sh` will pass (the artifact is fine) but the deployed product will break. That's why Step 5 (smoke test on a preview deploy) is non-negotiable.

**The proxy URL is hardcoded.** `vite.config.ts:13-30` and `vercel.json` hardcode `https://backend-11kr.onrender.com`. After the refactor those files must still exist, in the right place, with the right contents. The source manifest catches content changes; it doesn't tell you whether the build pipeline still finds the file.

**Backend behavior is not exercised.** The OpenAPI schema confirms the **shape** of the API surface, not that the code still runs. Before the monorepo refactor, ensure the backend has been deployed at least once recently and is responding to a real request. After the refactor, verify it still deploys cleanly.

**`backend/backend.env` and `backend/config.py`** are in the source manifest and contain hardcoded credential fallbacks (per CLAUDE.md). The snapshot is local only — do not commit `safety_net_1/snapshots/backend-source.sha256` to a public repo without first confirming this is acceptable. It's hashes, not contents, but the file list itself confirms `.env` is tracked.

**Render free tier sleeps.** If `verify.sh openapi` fails with a timeout, the backend may just be cold-starting. Hit `/docs` in a browser to wake it, then retry. The script `SKIP`s on fetch failure rather than failing — that's deliberate, but the consequence is you must verify openapi manually if it skips.

**`bun.lockb` is binary.** It's hashed but not human-diffable. If only `bun.lockb` changes and `package-lock.json` doesn't, someone touched the bun lockfile out-of-band — investigate.

**TypeScript is intentionally non-strict** in this codebase (`strict: false`, `noImplicitAny: false`). Don't tighten it during the refactor — that's a behavior change, however benign-looking, and it'll add diff noise that hides real regressions.

**Dev and prod share dependencies.** All three of `package.json`, `package-lock.json`, `bun.lockb` are byte-identical between the dev and prod canvas folders. Only source has diverged. This is a useful confirmation that the upcoming reconciliation is purely a code merge, not a dependency reconciliation.

## What this safety net does NOT cover

- **Behavioral correctness of the existing code.** If the code was buggy before the snapshot, it will still be buggy after. Hashes confirm "same as before," not "correct."
- **Runtime data.** Neo4j, MongoDB, Pinecone, S3 contents. Out of scope for a structural refactor.
- **The Render / Vercel dashboard config.** `render.yaml` is captured (it's in the backend repo). Vercel project settings are not — back those up manually.
- **Live JWT secrets, API keys.** Hashes of `config.py` and `backend.env` are in the snapshot; the contents themselves are not duplicated here.
- **CI/CD.** No CI is wired up that I can see. If you add some during the refactor, that's a behavior change worth a separate review.
- **Anything in `node_modules/` or `__pycache__/`.** Those are derived; the lockfiles + `requirements.txt` are the canonical inputs and they're hashed.

## When to refresh this snapshot

Refresh it whenever:
- You merge other work into either repo before starting the refactor (the baseline has shifted).
- You decide to refactor a different aspect of the codebase later (snapshot a new safety_net_2/).

Don't refresh it mid-refactor. The whole point is that the snapshot is a fixed baseline.

To refresh, the simplest path is to `rm -rf safety_net_1/` and recreate it from the procedure recorded in this file (or rerun the same commands from your shell history).
