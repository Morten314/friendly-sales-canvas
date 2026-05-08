# Plan 02 — Monorepo fork (`brewra-gtm-intelligence`)

**Type:** design spec (output of brainstorming on 2026-05-08)
**Status:** awaiting user review → then implementation plan
**Author:** CTO + assistant (brainstorming session)

## Goal

Fork a new monorepo (`brewra-gtm-intelligence`) that lives alongside the two existing repos (`PWA-multi-tenancy`, `backend`) and absorbs both via `git subtree`. The monorepo is the CTO's working environment for AI-native, spec-driven development. The two slow devs (1 FE, 1 BE) continue working in the existing repos at their pace. After 1–2 weeks, full migration: slow devs move to the monorepo, old repos archived, deploy targets flipped.

## Motivation

- **Cross-stack atomicity.** Brewra features routinely span `/api/*` (FastAPI) and the React PWA. Today these ship as two coordinated commits across two repos. AI agents struggle with cross-repo atomicity. A monorepo enables one commit, one PR, one diff for the full change.
- **Spec-driven workflow.** Specs (`/specs/`) and plans (`/plans/`) at the repo root, alongside both stacks, make brainstorm → spec → plan → implementation a first-class flow.
- **Velocity asymmetry.** The CTO operates at AI-native speed (10–100× the slow devs). Forcing a synchronous monorepo migration on the team would either slow the CTO to the team's pace or overwhelm the team. The fork pattern lets the CTO move fast in the monorepo while the team continues unaffected.

## Constraints

- **MVP, 0 live users (as of 2026-05-08).** Brief downtime during cutover is acceptable. Deployment ceremony is not a constraint.
- **Plan 05 reconciliation** of PWA's divergent `development/` and `production/` folder content is scheduled for the week of 2026-05-15. This spec assumes parallel tracker branches in the monorepo for ~1 week, then collapse onto `master` via Plan 05.
- **Sync direction is one-way: slow devs → CTO.** Bidirectional sync between divergent layouts (canvas-at-root inside synthetic branches vs. `/frontend/` in the monorepo) is a quagmire. The CTO's monorepo work doesn't need to ship via the old repos before cutover (MVP, 0 users).
- **Slow devs' actual workflow (verified 2026-05-08):** push to PWA `master` (which has both `development/friendly-sales-canvas/` and `production/friendly-sales-canvas/` folders that have diverged in content) and to backend's `main` branch. **PWA's `develop` and `production` branches are local-only on the CTO's machine** — they are subtree-split outputs from Plan 01 (`development/` folder → `develop` branch with canvas at root; `production/` folder → `production` branch with canvas at root). They serve as private synthetic sources for the monorepo's subtree imports. Backend's `dev` branch is old/stale; ignore.
- **Sync is a 2-stage process (consequence of the above):** stage 1 refreshes PWA's local `develop`/`production` synthetic branches by pulling `origin/master` and re-running `git subtree split` on each folder. Stage 2 subtree-pulls from those refreshed local branches into the monorepo's tracker branches.

## Design at a glance

```
/projects/Brewra/
├── PWA-multi-tenancy/                  ← slow devs continue here (untouched)
├── backend/                            ← slow devs continue here (untouched)
└── brewra-gtm-intelligence/            ← NEW. CTO's monorepo.
    ├── frontend/                          subtree from PWA-multi-tenancy
    ├── backend/                           subtree from backend repo
    ├── scripts/sync.sh                    pull updates from old repos
    ├── specs/                             design specs (this file relocates here post-monorepo-creation)
    ├── plans/                             implementation plans
    ├── docs/                              everything else
    ├── CLAUDE.md, AGENTS.md, BRANCHES.md, README.md, .gitignore
    └── (branches: master, develop, production, pwa-master-history)
```

Slow devs push to old repos. CTO runs `bash scripts/sync.sh` to pull their changes onto monorepo's `develop` and `production` tracker branches. CTO works on `master` (which started from PWA's `develop` + backend), absorbing FE updates by `git merge develop` when ready.

After ~1 week: Plan 05 collapses `develop`/`production` divergence onto `master` via cherry-pick. Slow devs migrate. Old repos archived. Vercel + Render switched to the monorepo.

## Architecture

### What this design IS

- A new git repo on disk at `/projects/Brewra/brewra-gtm-intelligence/`.
- Pushed to GitHub (CTO's personal account `dicemanx` initially; transfer to org later). Backed up from day 1.
- Frontend imported via `git subtree add --prefix=frontend pwa develop` (no `--squash`). Where **`pwa develop` is the LOCAL synthetic branch** in `/projects/Brewra/PWA-multi-tenancy/` produced by Plan 01's `git subtree split` of the `development/friendly-sales-canvas/` folder. Not on PWA origin. Not the same as `pwa origin/develop` (which doesn't exist).
- Backend imported via `git subtree add --prefix=backend backend main` (no `--squash`).
- Three active branches during temp week: `master`, `develop`, `production`. Plus `pwa-master-history` archive.
- One sync script: `scripts/sync.sh` — runs both stages (PWA pre-sync refresh + monorepo subtree pull).

### What this design is NOT

- Not a `git merge` of the two old repos.
- Not a tool-managed monorepo (no Nx, Turbo, pnpm workspaces). Polyglot (Python + TypeScript) doesn't benefit from those tools.
- Not bidirectional sync. `git subtree push` is not part of the workflow.
- Not a per-stack split of CLAUDE.md (single root file for now).

## Branch model (during temp week)

| Branch | Initial state | Policy | Receives subtree pulls? |
|---|---|---|---|
| `master` | from PWA local `develop` (= subtree-split of `development/`) + `backend main` | CTO's working branch. Write freely. | Backend only (`backend/main`). FE updates flow in via `git merge develop`. |
| `develop` | from PWA local `develop` (= subtree-split of `development/`) + `backend main` | Tracker mirror of `development/` folder content. **Only `sync.sh`'s commits land here.** | Yes: `pwa develop` (local synthetic) + `backend main`. |
| `production` | from PWA local `production` (= subtree-split of `production/`) + `backend main` | Tracker mirror of `production/` folder content. **Only `sync.sh`'s commits land here.** | Yes: `pwa production` (local synthetic) + `backend main`. |
| `pwa-master-history` | from `pwa master` (no subtree path rewrite — keeps canvas-nested layout) | Read-only archive. Never write. | No. |

`pwa develop` and `pwa production` here always mean the **CTO's local synthetic branches** in `/projects/Brewra/PWA-multi-tenancy/`. They are NOT on PWA origin and never will be. Slow devs continue to push only to PWA `master`. The monorepo's `pwa` remote points at the on-disk PWA repo, so subtree commands see those local synthetic branches.

**Why this shape:**

- The CTO's master branch starts from `develop` (not `production`). Reasoning:
  - More recent code in `development/friendly-sales-canvas/` than `production/friendly-sales-canvas/`: develop folder's last code change is 2026-04-18; production folder's is 2026-04-06.
  - Smaller cherry-pick surface for Plan 05: 19 production-folder-only files to merge into master vs. 28 develop-folder-only files the other way.
  - Production-folder-only files are a coherent feature group (`MarketRankings*`, `MarketSegments*`, `SwotAnalysis*`, `TechnologyDrivers*` + drawers, `profilerCache.ts`) — easy to cherry-pick as a unit.
  - Development folder already houses the AI-native-aligned features (`lead-stream/`, `strategist/`, agentic JSON schemas), which is the surface the CTO will extend.
- Backend lives on all three active branches (master, develop, production). Backend changes from the old `backend` repo arrive via subtree pull on each branch independently (sync.sh handles this, sourcing from `backend main`). Backend changes originating in monorepo on `master` do NOT propagate to tracker branches — they ship via cutover.
- `pwa-master-history` exists because PWA's local `develop` history was rewritten by Plan 01's subtree split (new SHAs). The original PWA `master` SHAs (with the canvas-nested layout) only survive on this archive branch in the monorepo.

**Future state (post-cutover):** `master` + `dev` (+ maybe `stage`). Tracker branches deleted. `pwa-master-history` retained as long-term archive.

## Repo creation + initial subtree imports

### Disk location

`/projects/Brewra/brewra-gtm-intelligence/` (sibling to `PWA-multi-tenancy/` and `backend/`).

### GitHub

Create empty repo `brewra-gtm-intelligence` on the org. Push initial scaffolding immediately for backup.

### Initial scaffolding (committed before any subtree adds)

```
brewra-gtm-intelligence/
├── .gitignore             # node_modules, __pycache__, .env, dist, .venv, etc.
├── CLAUDE.md              # see Section: CLAUDE.md / AGENTS.md adaptation
├── AGENTS.md              # ditto
├── README.md              # 1-page orientation
├── BRANCHES.md            # branch model + sync.sh quick-ref
├── specs/.gitkeep
├── plans/.gitkeep
├── docs/.gitkeep
└── scripts/.gitkeep       # sync.sh added in a follow-up commit
```

### Init sequence

```bash
cd /projects/Brewra
git init brewra-gtm-intelligence -b master
cd brewra-gtm-intelligence

# create scaffolding files above
git add -A && git commit -m "initial scaffolding"
git remote add origin <github-url>
git push -u origin master

# point at on-disk old repos as remotes
git remote add pwa     /projects/Brewra/PWA-multi-tenancy
git remote add backend /projects/Brewra/backend
git fetch pwa
git fetch backend

# subtree imports (no --squash → full history preserved).
# 'pwa develop' here = the LOCAL synthetic branch in PWA-multi-tenancy created by Plan 01's
# subtree split of development/friendly-sales-canvas/. Already exists locally; not on PWA origin.
# 'backend main' = backend repo's primary branch (NOT 'master').
git subtree add --prefix=frontend pwa     develop \
  -m "subtree: import frontend from PWA-multi-tenancy@develop (local synthetic from Plan 01)"
git subtree add --prefix=backend  backend main \
  -m "subtree: import backend from backend@main"

# pwa-master-history archive branch
git fetch pwa master:pwa-master-history
git push origin pwa-master-history

# create develop and production tracker branches
# develop: same content as master at this point (master started from pwa develop + backend main)
git branch develop master

# production: needs a separate branch with frontend@production + backend@main.
# 'pwa production' = the LOCAL synthetic branch in PWA-multi-tenancy created by Plan 01's
# subtree split of production/friendly-sales-canvas/. Already exists locally.
# Built in a temporary worktree (option c) for clean subtree metadata.
# See "Production-tracker-branch creation" section below for full mechanic.
git worktree add ../monorepo-production-build --orphan production
( cd ../monorepo-production-build && \
  git commit --allow-empty -m "initialize production tracker branch" && \
  git subtree add --prefix=frontend pwa     production \
    -m "subtree: import frontend from PWA-multi-tenancy@production (local synthetic from Plan 01)" && \
  git subtree add --prefix=backend  backend main \
    -m "subtree: import backend from backend@main" && \
  git checkout master -- CLAUDE.md AGENTS.md README.md BRANCHES.md \
    .gitignore specs/ plans/ docs/ scripts/ && \
  git commit -m "production: align scaffolding with master" )
git push -u origin production
git worktree remove ../monorepo-production-build

# back to master, push everything
git checkout master
git push origin master
git push origin develop

# scripts/sync.sh added in a follow-up commit on master (see Section: Sync workflow)
# tag the fork point AFTER scripts/sync.sh is in place
git tag fork-point-<YYYY-MM-DD>
git push origin fork-point-<YYYY-MM-DD>
```

**Production-tracker-branch creation: chosen mechanic is option (c) — temporary worktree.**

Three approaches were considered during brainstorming. (c) was chosen for the cleanest subtree metadata at the cost of slightly more setup steps. Recording all three here so the rationale is preserved:

- **(a) Orphan branch + subtree adds.** Create `production` with no parent (`git checkout --orphan production`), add empty initial commit, then run `git subtree add` from `pwa production` and `backend main`, then cherry-pick scaffolding from master. Pro: clean subtree metadata. Con: disconnected history root from master (cosmetic), scaffolding cherry-picked rather than shared.
- **(b) `git read-tree`-based subtree swap.** Branch from master, `git rm -rf frontend`, `git read-tree --prefix=frontend/ -u pwa/production`, then manually craft a commit message in the exact format git-subtree expects so future `git subtree pull --prefix=frontend pwa production` works correctly. Pro: shared root with master, history graph looks normal. Con: hand-crafted subtree metadata is fragile — get the format wrong and pulls misbehave silently.
- **(c) Temporary worktree.** ✅ **Chosen.** Build the production branch in a separate `git worktree` with clean `git subtree add` calls (proper metadata recorded by git-subtree itself, no hand-crafting), then bring that branch into the main monorepo. Pro: cleanest subtree metadata, reproducible. Con: extra setup steps; same disconnected-root cosmetic as (a).

**Sketch of (c)'s mechanic** (full sequence is plan-writing's job — this is design intent):

```bash
# from inside the main monorepo, after master + develop + initial scaffolding exist
git worktree add ../monorepo-production-build --orphan production
cd ../monorepo-production-build
git commit --allow-empty -m "initialize production tracker branch"
git subtree add --prefix=frontend pwa     production \
  -m "subtree: import frontend from PWA-multi-tenancy@production (local synthetic)"
git subtree add --prefix=backend  backend main \
  -m "subtree: import backend from backend@main"

# pull scaffolding files in from master to align the branch with monorepo conventions
git checkout master -- CLAUDE.md AGENTS.md README.md BRANCHES.md \
  .gitignore specs/ plans/ docs/ scripts/
git commit -m "production: align scaffolding with master"

# back to main worktree, push the branch
cd ../brewra-gtm-intelligence
git push -u origin production
git worktree remove ../monorepo-production-build
```

**Acceptance for the production tracker branch creation step:**

1. `production` branch exists locally and on origin.
2. `/frontend/` contents match `pwa production` (local synthetic) at the moment of import.
3. `/backend/` contents match `backend main` at the moment of import.
4. Scaffolding files (CLAUDE.md, AGENTS.md, README.md, BRANCHES.md, .gitignore, scripts/) match master.
5. `git subtree pull --prefix=frontend pwa production --dry-run` works without errors (proves subtree metadata is recorded correctly).
6. `git subtree pull --prefix=backend backend main --dry-run` works without errors.

### Tag the fork moment

In the monorepo: `fork-point-<YYYY-MM-DD>` (after all subtree adds + scripts/sync.sh).
In each old repo: `pre-monorepo-fork-<YYYY-MM-DD>` (push to origin).

## Sync workflow + scripts/sync.sh

### Two-stage sync (consequence of corrected branch reality)

Slow devs push to PWA `master` (where the divergent `development/` and `production/` folders live) and to backend's `main`. The monorepo's tracker branches need updates from these. Because PWA's `develop` and `production` synthetic branches are local-only and produced via subtree split (not direct slow-dev work), **stage 1 of sync refreshes them**, then **stage 2 pulls into the monorepo**.

### How content flows

| Stage | Source | Lands on | Mechanism |
|---|---|---|---|
| **Stage 1 (PWA pre-sync)** | PWA origin/master | PWA local `master` | `git pull --ff-only origin master` in `/projects/Brewra/PWA-multi-tenancy/` |
| **Stage 1 (re-split)** | PWA local master's `development/friendly-sales-canvas/` folder | PWA local `develop` (synthetic) | delete local `develop`; `git subtree split --prefix=development/friendly-sales-canvas/ -b develop` |
| **Stage 1 (re-split)** | PWA local master's `production/friendly-sales-canvas/` folder | PWA local `production` (synthetic) | delete local `production`; `git subtree split --prefix=production/friendly-sales-canvas/ -b production` |
| **Stage 2** | PWA local `develop` (synthetic) | monorepo `develop` | `git subtree pull --prefix=frontend pwa develop` |
| **Stage 2** | PWA local `production` (synthetic) | monorepo `production` | `git subtree pull --prefix=frontend pwa production` |
| **Stage 2** | `backend main` | monorepo `master`, `develop`, `production` | `git subtree pull --prefix=backend backend main` per branch |
| **Manual, after sync** | monorepo `develop` | monorepo `master` | `git checkout master && git merge develop` |

`master` does **not** receive frontend subtree pulls. Frontend updates arrive via `git merge develop`, which is the CTO's "absorb slow-dev FE work into my branch" lever.

**Re-split mechanics (Plan 01 didn't use `--rejoin`):** every re-split is a full rebuild. For this repo size, ~5–20 minutes total per sync. Splits are deterministic — same source produces same SHAs — so unchanged folders re-emerge with the same branch tips.

**Why delete-and-recreate instead of `git subtree split` to existing branch:** `git subtree split -b <name>` doesn't update an existing branch cleanly. Deleting first guarantees clean recreation. Cost: any commits the CTO accidentally added to PWA's local develop/production are lost. This is fine — discipline rule says don't commit there.

### Backend cherry-pick policy (during temp week)

- **Backend changes originating in old `backend` repo (slow dev pushes to `main`):** sync.sh handles. Same commit appears on monorepo's master/develop/production via three independent subtree pulls.
- **Backend changes originating in monorepo on master (CTO writes them):** do **NOT** propagate to tracker branches automatically. Default policy: **don't bother** — these ship at cutover. If a backend change must run in PWA-deployed land before cutover (rare given MVP/0-users), the CTO commits it to old `backend` repo additionally. Manual dual-commit, low frequency.

### `scripts/sync.sh`

Full content (committed in a follow-up commit after the initial scaffolding + subtree adds):

```bash
#!/usr/bin/env bash
# scripts/sync.sh — refresh PWA local synthetic branches, then pull updates into monorepo.
#
# Two stages:
#   Stage 1 (PWA pre-sync):  pull origin/master into PWA local; re-split development/ and
#                            production/ folders into local develop and production branches.
#   Stage 2 (monorepo sync): subtree-pull from PWA local develop/production and backend main
#                            onto monorepo's tracker branches.
#
# Usage:
#   bash scripts/sync.sh             # full 2-stage sync
#   bash scripts/sync.sh --dry-run   # show what would happen, change nothing
#
# Assumes: run from monorepo root; remotes 'pwa' and 'backend' configured (point at on-disk
#          old repos); branches 'master','develop','production' exist locally; working trees
#          (both monorepo AND PWA local repo) clean.

set -euo pipefail

# ---------- config (override via env vars if old repos relocate) ----------
PWA_DIR="${PWA_DIR:-/projects/Brewra/PWA-multi-tenancy}"
BACKEND_DIR="${BACKEND_DIR:-/projects/Brewra/backend}"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# ---------- output helpers ----------
log_step()  { echo; printf '\033[34m==>\033[0m %s\n' "$*"; }
log_stage() { echo; echo; printf '\033[1;35m###  %s  ###\033[0m\n' "$*"; }
log_ok()    { printf '\033[32m  ok \033[0m %s\n' "$*"; }
log_warn()  { printf '\033[33m  warn\033[0m %s\n' "$*"; }
log_err()   { printf '\033[31m  err \033[0m %s\n' "$*" >&2; }

ORIGINAL_BRANCH=""
ORIGINAL_PWA_BRANCH=""
SCRIPT_FAILED=0

# Restore caller's branches on exit (success or failure), unless WTs are dirty.
cleanup() {
  if [ "$DRY_RUN" = "1" ]; then return; fi

  # Monorepo restoration
  if [ -n "$ORIGINAL_BRANCH" ]; then
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
      log_warn "monorepo WT not clean — leaving on current branch (started on '$ORIGINAL_BRANCH')"
    else
      current=$(git rev-parse --abbrev-ref HEAD)
      [ "$current" != "$ORIGINAL_BRANCH" ] && {
        log_step "Returning monorepo to '$ORIGINAL_BRANCH'"
        git checkout "$ORIGINAL_BRANCH" 2>&1 | sed 's/^/       /'
      }
    fi
  fi

  # PWA restoration
  if [ -n "$ORIGINAL_PWA_BRANCH" ] && [ -d "$PWA_DIR/.git" ]; then
    if ! git -C "$PWA_DIR" diff --quiet 2>/dev/null || ! git -C "$PWA_DIR" diff --cached --quiet 2>/dev/null; then
      log_warn "PWA WT not clean — leaving on current branch (started on '$ORIGINAL_PWA_BRANCH')"
    else
      current=$(git -C "$PWA_DIR" rev-parse --abbrev-ref HEAD)
      [ "$current" != "$ORIGINAL_PWA_BRANCH" ] && {
        log_step "Returning PWA to '$ORIGINAL_PWA_BRANCH'"
        git -C "$PWA_DIR" checkout "$ORIGINAL_PWA_BRANCH" 2>&1 | sed 's/^/       /'
      }
    fi
  fi

  [ "$SCRIPT_FAILED" = "1" ] && log_err "sync.sh failed — inspect output above"
}
trap cleanup EXIT
trap 'SCRIPT_FAILED=1' ERR

# ---------- preflight ----------
log_stage "Preflight"

git rev-parse --git-dir >/dev/null 2>&1 || { log_err "not inside a git repo"; exit 1; }

if ! git diff --quiet || ! git diff --cached --quiet; then
  log_err "monorepo WT not clean — commit or stash before sync"
  git status --short | sed 's/^/       /'
  exit 1
fi
log_ok "monorepo WT clean"

[ -d "$PWA_DIR/.git" ] || { log_err "PWA repo not found at $PWA_DIR (set PWA_DIR env var if elsewhere)"; exit 1; }
[ -d "$BACKEND_DIR/.git" ] || { log_err "backend repo not found at $BACKEND_DIR"; exit 1; }
log_ok "old repos found at $PWA_DIR and $BACKEND_DIR"

if ! git -C "$PWA_DIR" diff --quiet || ! git -C "$PWA_DIR" diff --cached --quiet; then
  log_err "PWA WT not clean at $PWA_DIR — commit or stash before sync"
  git -C "$PWA_DIR" status --short | sed 's/^/       /'
  exit 1
fi
log_ok "PWA WT clean"

for remote in pwa backend; do
  git remote get-url "$remote" >/dev/null 2>&1 || {
    log_err "monorepo remote '$remote' not configured"
    exit 1
  }
done
log_ok "monorepo remotes pwa, backend configured"

for branch in master develop production; do
  git show-ref --verify --quiet "refs/heads/$branch" || {
    log_err "monorepo branch '$branch' missing locally"
    exit 1
  }
done
log_ok "monorepo branches master, develop, production present"

ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ORIGINAL_PWA_BRANCH=$(git -C "$PWA_DIR" rev-parse --abbrev-ref HEAD)
log_ok "starting on monorepo='$ORIGINAL_BRANCH' / pwa='$ORIGINAL_PWA_BRANCH'"

# ---------- STAGE 1: PWA pre-sync ----------
log_stage "Stage 1 — PWA pre-sync (refresh local develop/production from origin/master)"

if [ "$DRY_RUN" = "1" ]; then
  echo "       (dry-run) git -C $PWA_DIR checkout master"
  echo "       (dry-run) git -C $PWA_DIR fetch origin master"
  echo "       (dry-run) git -C $PWA_DIR merge --ff-only origin/master"
  echo "       (dry-run) git -C $PWA_DIR branch -D develop production (if exist)"
  echo "       (dry-run) git -C $PWA_DIR subtree split --prefix=development/friendly-sales-canvas/ -b develop"
  echo "       (dry-run) git -C $PWA_DIR subtree split --prefix=production/friendly-sales-canvas/ -b production"
  log_ok "stage 1 dry-run complete"
else
  log_step "PWA: checkout master + fast-forward from origin"
  git -C "$PWA_DIR" checkout master 2>&1 | sed 's/^/       /'
  git -C "$PWA_DIR" fetch origin master 2>&1 | sed 's/^/       /'

  pre_master=$(git -C "$PWA_DIR" rev-parse master)
  origin_master=$(git -C "$PWA_DIR" rev-parse origin/master)

  if [ "$pre_master" = "$origin_master" ]; then
    log_ok "PWA master already at origin/master ($pre_master) — no upstream changes"
  else
    if ! git -C "$PWA_DIR" merge --ff-only origin/master 2>&1 | sed 's/^/       /'; then
      log_err "PWA master not fast-forwardable from origin/master"
      log_err "  local master:  $pre_master"
      log_err "  origin master: $origin_master"
      log_err "Resolve manually (rebase, force-pull, etc.) before re-running sync.sh"
      exit 1
    fi
    new_master=$(git -C "$PWA_DIR" rev-parse master)
    n=$(git -C "$PWA_DIR" rev-list --count "${pre_master}..${new_master}")
    log_ok "PWA master fast-forwarded: $n new commit(s)"
  fi

  log_step "PWA: re-split development/ and production/ folders"

  pre_dev_tip=$(git -C "$PWA_DIR" rev-parse develop 2>/dev/null || echo "")
  pre_prod_tip=$(git -C "$PWA_DIR" rev-parse production 2>/dev/null || echo "")

  # Delete and re-create. Plan 01 didn't use --rejoin, so re-splits are full rebuilds;
  # they're deterministic, so unchanged folders re-emerge with the same SHAs.
  git -C "$PWA_DIR" branch -D develop 2>/dev/null || true
  git -C "$PWA_DIR" branch -D production 2>/dev/null || true

  log_step "PWA: subtree-split development/friendly-sales-canvas/ -> develop"
  git -C "$PWA_DIR" subtree split --prefix=development/friendly-sales-canvas/ -b develop 2>&1 | tail -3 | sed 's/^/       /'
  new_dev_tip=$(git -C "$PWA_DIR" rev-parse develop)
  if [ "$pre_dev_tip" = "$new_dev_tip" ]; then
    log_ok "PWA develop: no changes ($new_dev_tip)"
  elif [ -z "$pre_dev_tip" ]; then
    log_ok "PWA develop: created at $new_dev_tip"
  else
    log_ok "PWA develop: $pre_dev_tip -> $new_dev_tip"
  fi

  log_step "PWA: subtree-split production/friendly-sales-canvas/ -> production"
  git -C "$PWA_DIR" subtree split --prefix=production/friendly-sales-canvas/ -b production 2>&1 | tail -3 | sed 's/^/       /'
  new_prod_tip=$(git -C "$PWA_DIR" rev-parse production)
  if [ "$pre_prod_tip" = "$new_prod_tip" ]; then
    log_ok "PWA production: no changes ($new_prod_tip)"
  elif [ -z "$pre_prod_tip" ]; then
    log_ok "PWA production: created at $new_prod_tip"
  else
    log_ok "PWA production: $pre_prod_tip -> $new_prod_tip"
  fi
fi

# ---------- STAGE 2: monorepo sync ----------
log_stage "Stage 2 — monorepo sync (subtree-pull from PWA local + backend main)"

log_step "Fetching from monorepo's pwa and backend remotes"
if [ "$DRY_RUN" = "1" ]; then
  echo "       (dry-run) git fetch pwa --prune"
  echo "       (dry-run) git fetch backend --prune"
else
  git fetch pwa --prune 2>&1 | sed 's/^/       /'
  git fetch backend --prune 2>&1 | sed 's/^/       /'
fi
log_ok "fetched"

# ---------- subtree-pull primitive ----------
sync_subtree() {
  local prefix="$1" remote="$2" upstream_branch="$3" label="$4"

  if [ "$DRY_RUN" = "1" ]; then
    printf '       (dry-run) git subtree pull --prefix=%s %s %s\n' \
      "$prefix" "$remote" "$upstream_branch"
    return 0
  fi

  local pre_sha post_sha
  pre_sha=$(git rev-parse HEAD)

  if ! git subtree pull --prefix="$prefix" "$remote" "$upstream_branch" \
       -m "sync: ${label} <- ${remote}/${upstream_branch}" 2>&1 | sed 's/^/       /'; then
    log_err "subtree pull failed (prefix=$prefix remote=$remote branch=$upstream_branch)"
    log_err "resolve conflicts under $prefix/, commit, then re-run sync.sh"
    return 1
  fi

  post_sha=$(git rev-parse HEAD)
  if [ "$pre_sha" = "$post_sha" ]; then
    log_ok "$label: up-to-date"
  else
    local n; n=$(git rev-list --count "${pre_sha}..${post_sha}")
    log_ok "$label: pulled $n new commit(s)"
  fi
}

# ---------- per-branch sync ----------
sync_one_branch() {
  local branch="$1"; shift
  log_step "Monorepo branch: $branch"
  if [ "$DRY_RUN" = "1" ]; then
    echo "       (dry-run) git checkout $branch"
  else
    git checkout "$branch" 2>&1 | sed 's/^/       /'
  fi
  while [ "$#" -gt 0 ]; do
    IFS=':' read -r p r b l <<< "$1"
    sync_subtree "$p" "$r" "$b" "$l"
    shift
  done
}

# ---------- main ----------
sync_one_branch develop \
  "frontend:pwa:develop:frontend" \
  "backend:backend:main:backend"

sync_one_branch production \
  "frontend:pwa:production:frontend" \
  "backend:backend:main:backend"

sync_one_branch master \
  "backend:backend:main:backend"

# ---------- summary ----------
log_stage "Sync complete"
cat <<EOF

  PWA local refreshed:
    master       <- origin/master (slow-dev work)
    develop      = subtree-split(development/friendly-sales-canvas/)
    production   = subtree-split(production/friendly-sales-canvas/)

  Monorepo tracker branches updated:
    develop      <- pwa/develop    + backend/main
    production   <- pwa/production + backend/main
    master       <- backend/main   (frontend stays put)

  To absorb slow-devs' frontend updates into your master working branch:
    git checkout master
    git merge develop -m "merge: absorb FE updates from devs"

EOF
```

**Robustness features:**

- `set -euo pipefail` + ERR trap: any failure stops with a clear marker.
- Preflight checks: git repo, clean WT, remotes configured, branches exist. Fail fast.
- Original-branch restoration via EXIT trap: returns CTO to wherever they were, even on failure (skipped if WT dirty so conflict resolution isn't clobbered).
- Pre/post SHA comparison per pull: reports "up-to-date" vs "pulled N commits" per subtree.
- `--dry-run` mode: prints commands without execution.
- Conflict guidance: error message names the prefix and tells CTO to resolve and re-run.
- Re-run safety: if a conflicted pull leaves WT dirty, next preflight blocks instead of compounding.

**Out of scope for sync.sh:**

- Auto-running `git merge develop` on master (kept manual; CTO may not always want FE updates absorbed immediately).
- Per-branch flags (`--only develop`). Edit the script if needed.
- Push after sync. CTO decides when to push.

### Sync frequency

CTO's call. Sensible default: once per slow-dev push cycle (~daily during temp week with 2 slow devs at MVP velocity). Alternative: "before each work session" — run sync.sh, decide whether to merge develop into master.

## Branch protection during temp week

Convention only — solo dev + MVP doesn't justify GitHub branch-protection rules.

### Monorepo branches

| Branch | Discipline rule |
|---|---|
| `master` | CTO writes freely. Force-push allowed. |
| `develop` | Only `sync.sh`'s commits. No hand-typed commits. |
| `production` | Only `sync.sh`'s commits. No hand-typed commits. |
| `pwa-master-history` | Never write. Pure archive. |

### PWA local repo (out-of-monorepo, but consequential)

| Branch | Discipline rule |
|---|---|
| `master` | Only fast-forward pulls from origin (slow-dev work). No CTO commits. |
| `develop` (local synthetic) | **Will be deleted and re-created on every sync.sh run.** Don't commit here — anything you add is destroyed. |
| `production` (local synthetic) | Same as `develop` — deleted and re-created. Don't commit here. |
| `refactor`, `backend_refactor`, etc. | CTO's analysis branches; orthogonal to sync workflow; safe to use freely. |

`sync.sh`'s preflight catches dirty WT (in both monorepo and PWA local) but won't catch unpushed accidental commits on tracker branches. Discipline rule: only the monorepo's `master` gets your hand-typed commits.

## Cutover endgame (week 2)

Sequence when ready to migrate the slow devs:

1. **Freeze + final sync.** Tell slow devs: "stop pushing for the next hour." They push any in-flight work, then CTO runs `bash scripts/sync.sh` one last time. Tracker branches reflect final state of old repos.

2. **Plan 05 — reconciliation on `master`.** Cherry-pick production-exclusive files from `production` tracker branch onto `master`:
   - `frontend/src/components/market-research/{MarketRankings,MarketRankingDrawer,MarketSegments,MarketSegmentsDrawer,SwotAnalysis,SwotAnalysisDrawer,TechnologyDrivers,TechnologyDriversDrawer}.tsx`
   - `frontend/src/lib/profilerCache.ts`
   - Selected production-only docs (review the list — some likely stale: `DEBUG_INSTALL_ISSUE`, `TROUBLESHOOTING`)
   - Resolve integration conflicts (likely some — routing/menus need to know about both feature groups)
   - Plan 05 has its own brainstorm/spec/plan when ready. The **cutover phase** (this section, executed separately from the monorepo-creation phase of Plan 02) gates on Plan 05 producing a `master` containing everything. Plan 02's monorepo-creation phase itself does NOT gate on Plan 05 — it can run today.

3. **Communicate cutover.** Tell slow devs:
   - "Stop pushing to PWA-multi-tenancy and backend — final state captured."
   - "Clone `brewra-gtm-intelligence`, branch off `master`."
   - Onboard them on the new flow (feature branches → PR to `master`, instead of direct commits to `develop`/`production`).

4. **Deploy reconfig.**
   - **Vercel:** new project → connect to `brewra-gtm-intelligence`, Root Directory = `frontend`, production branch = `master`. Verify deploy works.
   - **Render:** new service → connect to `brewra-gtm-intelligence`, Root Directory = `backend`. Verify boot.
   - Both natively support monorepo root directories.
   - Disable old project/service only after new deploys verified working. ~30 min each. Brief downtime acceptable per business state.

5. **Tag the cutover.**
   ```bash
   # in monorepo
   git tag cutover-<YYYY-MM-DD> && git push origin cutover-<YYYY-MM-DD>

   # in each old repo
   cd /projects/Brewra/PWA-multi-tenancy
   git tag pre-monorepo-cutover-<YYYY-MM-DD> && git push origin pre-monorepo-cutover-<YYYY-MM-DD>
   cd /projects/Brewra/backend
   git tag pre-monorepo-cutover-<YYYY-MM-DD> && git push origin pre-monorepo-cutover-<YYYY-MM-DD>
   ```

6. **Archive old repos.**
   - GitHub: mark `PWA-multi-tenancy` and `backend` as **Archived** (read-only). History preserved; nobody can push.
   - Local clones survive on disk indefinitely.
   - `pwa-master-history` branch in monorepo provides in-repo access to PWA's pre-Plan-01 SHAs.

7. **Clean up monorepo tracker branches** (optional, no rush):
   - `develop`, `production`: served their purpose. Delete after ~1–2 weeks post-cutover (in case a slow dev needs to look up "where did X go") then delete.
   - `pwa-master-history`: keep indefinitely.

8. **Future branch model takes over.** `master` + `dev` (+ maybe `stage`). Branch `dev` off `master`; re-establish workflow (feature branches → PR to `dev` → release-time merge to `master`, or whatever). Outside Plan 02's scope.

### Estimated cutover duration

- Smooth path: half a day.
- With Plan 05 conflicts: ~1–2 days for cherry-picks, then a few hours for everything else.
- Main timing variable: slow devs' availability to validate the migration.

## Directory structure inside the monorepo

### Root layout

```
brewra-gtm-intelligence/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── BRANCHES.md
├── .gitignore
├── frontend/                    subtree from PWA-multi-tenancy
├── backend/                     subtree from backend repo
├── scripts/
│   ├── sync.sh
│   └── safety_net/              moved from /projects/Brewra/safety_net_1/
├── specs/                       design intent (this file relocates here at monorepo creation)
├── plans/                       execution intent
└── docs/                        everything else
    └── analysis/                moved from /projects/Brewra/analysis/
```

### Three doc dirs, three lifecycles

- **`/specs/`** — design intent. Output of brainstorming. Inputs to `/plans/`. Frozen-ish; updated when design changes.
- **`/plans/`** — execution intent. Output of plan-writing. Updated as plans evolve mid-execution.
- **`/docs/`** — everything else. Reference material, analyses, integration guides. Loose structure.

Spec-driven flow:

1. Brainstorm → `/specs/YYYY-MM-DD-feature-X-design.md`
2. Plan-write → `/plans/NN-feature-X.md`
3. Implement → commits referencing the plan
4. After execution: spec and plan persist as design+execution record.

### What moves from `/projects/Brewra/` parent

| From parent | To monorepo | Notes |
|---|---|---|
| `plans/01-pwa-folder-to-branch.md` | `/plans/` | Move as-is. |
| `plans/02-monorepo-fork-spec.md` (this file) | `/specs/` | Relocate at monorepo creation; rename to date-prefixed form. |
| `analysis/` (most thorough set per CLAUDE.md) | `/docs/analysis/` | Primary reference. |
| `claude-analysis/`, `detailed-analysis/`, `PWA-multi-tenancy/analysis/`, `backend/analysis/` | Triage: keep unique content under `/docs/analysis/legacy/`, drop redundant duplicates | CLAUDE.md says these are "mostly superseded." One-time prune. |
| `safety_net_1/` (verify.sh + snapshots) | `/scripts/safety_net/` | Verification tool; conceptually a script. Snapshots stay. **Note:** `verify.sh`'s hardcoded default paths (`/projects/Brewra/backend`, `/projects/Brewra/PWA-multi-tenancy/...`) reference the parent layout. Plan-writing must update these defaults to point at the monorepo's `/backend/` and `/frontend/`, or document the env-var override pattern that's already supported. |
| `CLAUDE.md`, `AGENTS.md` | Adapted into monorepo's `/CLAUDE.md`, `/AGENTS.md`; **parent files DELETED** | Slow devs don't use agents; parent files have no remaining audience post-fork. |

### What does NOT move

- Sibling repos (`PWA-multi-tenancy/`, `backend/`) — slow devs' workspaces. Archived at cutover.
- Frontend's root `.md` docs (`CRM_API_INTEGRATION_GUIDE.md`, `JWT_INTEGRATION_GUIDE.md`, `SCOUT_API_REQUEST_SCHEMAS.md`, etc.) — these subtree-import into `/frontend/` along with the canvas. **Leave them in `/frontend/` during temp week** so subtree pulls stay clean. Optional post-cutover hoist to `/docs/` if desired.
- Backend's self-authored guides at its root (`API_DOCUMENTATION.md`, etc.) — same: stay in `/backend/` during temp week, optional hoist post-cutover.

**Why we don't hoist subtree contents during temp week:** every file moved out of `/frontend/` or `/backend/` is a file that won't subtree-pull cleanly anymore. Slow devs' updates to those root-level docs need to land somewhere; if hoisted, the subtree pull can't update both copies automatically.

## CLAUDE.md / AGENTS.md adaptation

Both files get the same treatment (aligned siblings). Monorepo versions are an adaptation of the parent versions, not a rewrite.

### Preserved from parent (paths updated)

- **Polyglot Repo Practices** — all rules apply. Paths: `PWA-multi-tenancy/development/friendly-sales-canvas/` → `frontend/`; sibling `backend/` → nested `/backend/`.
- **Business State (MVP, pre-launch)** — verbatim.
- **Common Commands** — same commands, prefix with `cd frontend` / `cd backend`.
- **Architecture: Big Picture** — verbatim.
- **Auth reality check** — verbatim.
- **Gotchas** — same list, paths updated (e.g., `api.py:155-161` → `backend/api.py:155-161`).
- **Pre-existing Analyses** — pointer updated to `/docs/analysis/`.

### Replaced

- **Repository Layout** — rewritten for monorepo tree.
- **PWA branch model** — replaced by **Monorepo Branch Model** section: branch table (see "Branch model during temp week" above), `bash scripts/sync.sh` usage, the "only `master` gets hand-typed commits" rule, future state callout (post-cutover rewrite).

### New section: AI-Native Development

Skeleton (actual prose written during plan execution):

> This repo is structured for AI-native development: cross-cutting tasks (changes spanning both stacks) land as **atomic commits**, and work flows through a **spec → plan → implementation** pipeline.
>
> - **Cross-stack atomicity.** A feature touching both `/frontend/` and `/backend/` ships as one commit (or one PR), reviewable as one diff. Don't split FE/BE changes across separate commits "because the codebases are different" — that's the polyrepo habit, not the monorepo rule.
> - **Spec-driven flow.**
>   1. Idea → brainstorm → `/specs/YYYY-MM-DD-feature-X-design.md` (design intent)
>   2. Spec → plan-write → `/plans/NN-feature-X.md` (execution intent, ordered steps)
>   3. Plan → commits referencing the plan
> - **Spec and plan persist** — canonical record of *why* and *how*. Don't delete after execution.
> - **Sync workflow** (during temp week only): `bash scripts/sync.sh` pulls slow-dev changes from old repos. `git merge develop` on master absorbs FE updates. Removed from CLAUDE.md after cutover.

### Single root CLAUDE.md (no per-stack split)

Single root file matches the parent pattern and is simpler for MVP. Splitting into `/frontend/CLAUDE.md` + `/backend/CLAUDE.md` is a future option when each stack accumulates enough specific rules.

### Parent CLAUDE.md / AGENTS.md fate

**Removed at monorepo creation.** Slow devs don't use agentic dev; parent files have no audience after fork. No pointer files; no temp-week retention.

## Recovery anchors + rollback strategy

### Recovery anchors

| Anchor | Where | Purpose |
|---|---|---|
| `pre-refactor-2026-05-05` | PWA repo, on origin (pushed 2026-05-08) | Pre-Plan-01 state of PWA. Originally local-only; pushed during Plan 02 Task 1. |
| `develop-initial-2026-05-05`, `production-initial-2026-05-05` | PWA repo, on origin (pushed 2026-05-08) | First commits on PWA's local synthetic branches post-Plan-01. Originally local-only; pushed during Plan 02 Task 1. |
| `pre-monorepo-fork-2026-05-08` | PWA repo (at master tip) + backend repo (at main tip), on origin | State of each old repo at fork moment. Created during Plan 02 Task 1. |
| `fork-point-2026-05-08` | Monorepo, on origin | Tagged after subtree adds + scripts/sync.sh, before any CTO work. |
| `pwa-master-history` branch | Monorepo | PWA's master at fork moment (canvas-nested layout preserved). Recovery anchor for "what slow devs see." |
| `cutover-<YYYY-MM-DD>` | Monorepo, on origin | Tagged at cutover (future). |
| `pre-monorepo-cutover-<YYYY-MM-DD>` | PWA repo + backend repo, on origin | Tagged at cutover before old repos archived (future). |
| Old repos on origin | GitHub | Independent and complete throughout temp week. Archived at cutover, never deleted. |

### Rollback hierarchy (cheap → nuclear)

**Level 1 — local mistake on `master`.** `git reflog` + `git reset --hard <sha>` or `git revert`. Minutes.

**Level 2 — accidental commit on tracker branch.** `git reset --hard <last-clean-sync-commit>` on the affected branch. Re-run sync.sh. Minutes.

**Level 3 — subtree pull conflict, unfixable mid-operation.** WT dirty with markers. Find pre-pull SHA from sync.sh log or reflog. `git reset --hard <pre-pull-sha>`. Investigate why upstream conflicts (probably an accidental tracker commit). ~30 min.

**Level 4 — fundamental issue with the monorepo.** Nuke local clone (`rm -rf brewra-gtm-intelligence/`). If GitHub state also wrong: delete GitHub repo, recreate, redo Plan 02 from `pre-monorepo-fork-<YYYY-MM-DD>` anchors. Slow devs unaffected. Half a day.

**Level 5 — cutover deploy fails.** Old projects/services not disabled until new ones verified (per cutover step 4). Investigate new. Re-attempt cutover when fixed. Slow devs back to "stop pushing" → "resume pushing." Hours to days.

**Level 6 — full retreat: monorepo doesn't fit, abandon Plan 02.** Old repos un-archived if archived. Slow devs continue. CTO's monorepo work cherry-picked back into old repos manually, or abandoned. Pre-cutover: ~1 week of CTO work lost. Post-cutover: much higher cost (re-onboarding, deploy reverse-flip).

### Key invariant

**Old repos remain independently complete throughout temp week.** They never depend on monorepo state. Every commit on `pwa master`, `backend main` is fully self-sufficient.

Therefore: **at any point in temp week, "delete the monorepo (and PWA's local synthetic develop/production branches) and continue with old repos" is a valid escape hatch.** Free option. (PWA's local synthetic branches are easily reproducible by re-running Plan 01's subtree splits if ever needed.)

Post-cutover, this invariant softens (old repos archived, monorepo canonical). Recovery becomes cherry-pick-from-monorepo-back-into-archived-repos. `pre-monorepo-cutover-<YYYY-MM-DD>` tags make finding "last clean polyrepo state" trivial.

### Out of scope for rollback design

- Automated rollback scripts. Manual recovery is fine for rare scenarios.
- Pre-cutover dry-runs of Plan 05. That's Plan 05's brainstorm/spec.
- Off-site backups beyond GitHub origin. GitHub is durable enough.

## Out of scope for Plan 02

- **Plan 03 (frontend code cleanup)** — the unused/duplicate cruft listed in CLAUDE.md (`SafeChatWithScout copy.tsx`, `MarketResearch_clean.tsx`, `_restore_test.txt`, ICPManager.tsx commented code, etc.). Separate plan.
- **Plan 05 (develop/production reconciliation)** — gated dependency for cutover step 2. Separate brainstorm/spec/plan.
- **Future branch model post-cutover** — `master` + `dev` + maybe `stage`. Re-established post-cutover, separate decision.
- **Per-stack CLAUDE.md split** — single root file for now; revisit when each stack accumulates enough specific rules.
- **Vercel / Render specific build configs** — covered at high level in cutover step 4; full deploy plan can be a sub-plan if needed.
- **CI / lint / test surface unification** — neither stack has tests wired up today; making them AI-friendly is a separate plan.
- **OpenAPI codegen for FE-BE type safety** — explicitly mentioned as a future possibility in monorepo (one CI step), but deferred.

## Open questions / dependencies

- **Plan 05 timing.** Spec assumes Plan 05 happens within ~1 week of monorepo creation. If Plan 05 slips significantly, Plan 02's tracker branches grow stale and backend cherry-pick burden compounds. Re-evaluate after 2 weeks if Plan 05 not complete.
- **Slow-dev availability for cutover.** Half-day to two-day cutover requires their availability for validation. Schedule explicitly.
- **GitHub repo:** Plan 02 uses CTO's personal account `dicemanx/brewra-gtm-intelligence` initially. Transfer to org later via GitHub's "Transfer ownership" (preserves history, issues, PRs, and remote URLs via redirect). Slow-dev onboarding at cutover should happen against whichever origin is canonical at that moment.
- **Re-split mechanics resolved (Plan 01 didn't use `--rejoin`).** Re-splits in `sync.sh` stage 1 are full rebuilds. Deterministic — same source produces same SHAs — so unchanged folders re-emerge with the same branch tips. Cost per sync: 5–20 min for repo of this size. Acceptable.
- **Existing PWA local synthetic branches.** Plan 01 already produced `develop` and `production` branches on the CTO's PWA local repo. Plan 02 uses these as initial subtree-add sources. Future syncs delete-and-recreate them — any commits the CTO accidentally added (e.g., Plan 01's BRANCHES.md commits on those branches) are lost on first re-sync. This is acceptable per the "discipline rule: don't commit to PWA's local develop/production."

## Acceptance criteria

Plan 02 is "done" when:

1. `/projects/Brewra/brewra-gtm-intelligence/` exists locally and at `<github-org>/brewra-gtm-intelligence` on GitHub.
2. Branches present: `master`, `develop`, `production`, `pwa-master-history` (all pushed to origin).
3. Tags present (on origin): `fork-point-<YYYY-MM-DD>` (monorepo), `pre-monorepo-fork-<YYYY-MM-DD>` (both old repos).
4. `git log --follow frontend/<any-file>` returns full pre-fork history (verifying no `--squash`).
5. `git log --follow backend/<any-file>` returns full pre-fork history.
6. `bash scripts/sync.sh --dry-run` runs cleanly from a fresh clone.
7. `/projects/Brewra/CLAUDE.md` and `/projects/Brewra/AGENTS.md` deleted.
8. Monorepo's `/CLAUDE.md`, `/AGENTS.md`, `/BRANCHES.md`, `/README.md` populated per design.
9. `/specs/02-monorepo-fork-spec.md` (this file, relocated) and `/plans/01-pwa-folder-to-branch.md` present in monorepo.
10. `/docs/analysis/` populated from parent `analysis/` set.
11. `/scripts/safety_net/` populated from parent `safety_net_1/`.

What "done" does NOT include (handled by Plan 05 / cutover, not Plan 02):

- Tracker branches deleted.
- Old repos archived on GitHub.
- Vercel / Render deploy targets switched.
- Slow devs onboarded onto monorepo.
