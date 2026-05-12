# Brewra GTM Intelligence Monorepo Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `brewra-gtm-intelligence` monorepo locally and on GitHub. Populate four branches (`master`, `develop`, `production`, `pwa-master-history`) via `git subtree` imports from the existing `PWA-multi-tenancy` and `backend` repos (no `--squash` — full history preserved). Install `scripts/sync.sh`. Migrate plans, specs, analyses, and `safety_net_1` from `/projects/Brewra/` parent into the monorepo. Adapt `CLAUDE.md` and `AGENTS.md` for the monorepo. Delete the parent `CLAUDE.md` and `AGENTS.md`.

**Architecture:** Fork pattern via `git subtree`. Old repos remain independent and continue to serve as the Brewra devs' workspaces during a temp window of ~1–2 weeks. The `production` tracker branch is built in a temporary `git worktree` (option c from spec) for clean subtree metadata. The `sync.sh` script enables ongoing devs→CTO syncs during temp week.

**Tech Stack:** git (subtree, worktree, tags, fetch); bash; GitHub (CLI or web).

**Spec:** `/projects/Brewra/plans/02-monorepo-fork-spec.md` — read it before starting.

**Out of scope (future plans):**
- Plan 05 (PWA `develop`/`production` reconciliation onto `master`)
- Cutover (Vercel/Render reconfig, Brewra-dev onboarding, old-repo archival)

---

## Date convention

Throughout this plan, `<TODAY>` is the actual execution date in `YYYY-MM-DD` format. For the current planned execution, **`<TODAY>` = `2026-05-08`**.

## Repo branch reality (verified 2026-05-08)

Before executing, agents must understand the current branch state:

- **PWA (`/projects/Brewra/PWA-multi-tenancy/`):**
  - On origin: `master` (Brewra-dev workspace; contains `development/friendly-sales-canvas/` and `production/friendly-sales-canvas/` folders that have diverged), `feature/panels` (a Brewra dev's WIP — ignore until merged).
  - **Local-only on the CTO's machine: `develop`, `production`** — synthetic branches produced by Plan 01's subtree splits of `development/` and `production/` folders respectively. These are NOT on PWA origin and are NOT to be pushed there.
- **backend (`/projects/Brewra/backend/`):**
  - Primary branch: **`main`** (NOT `master`).
  - On origin: `main` + `dev` (stale, ignore).

The fork pattern uses PWA's local synthetic `develop` and `production` branches as subtree-import sources, and backend's `main` branch.

## Pre-execution checklist

Verify all of these are true before starting Task 1:

- [ ] CTO has push access to GitHub for repo creation. Plan uses CTO's personal account `dicemanx/brewra-gtm-intelligence`; transfer to org later.
- [ ] `/projects/Brewra/PWA-multi-tenancy/` exists, is a git repo, and has local-only `develop` and `production` branches (Plan 01 outputs).
- [ ] `/projects/Brewra/backend/` exists, is a git repo, has `main` branch.
- [ ] `/projects/Brewra/plans/02-monorepo-fork-spec.md` exists and you have read it.
- [ ] No critical work in flight from Brewra devs (the next ~1–2 hours of monorepo creation should not race with their pushes).

If any of these fail, stop and resolve before proceeding.

---

## Task 1: Tag old repos at fork moment

Establish recovery anchors on the old repos so we can roll back to "before Plan 02" cleanly.

**Files:**
- No working-tree changes. Tag operations on `/projects/Brewra/PWA-multi-tenancy` and `/projects/Brewra/backend`.

- [ ] **Step 1: Verify PWA repo working tree is clean**

Run:
```bash
git -C /projects/Brewra/PWA-multi-tenancy status
git -C /projects/Brewra/PWA-multi-tenancy branch -v --no-abbrev
```
Expected: working tree clean. Branches present include `master`, `develop`, `production` (local synthetic), and possibly `refactor`. If WT dirty: stop, resolve.

- [ ] **Step 2: Push Plan 01 tags to PWA origin (idempotent)**

Plan 01's tags were never pushed to origin. Push them now as recovery anchors. Includes `pre-refactor-2026-05-05` (the Plan 01 baseline anchor — was also missing from origin despite Plan 01 documentation suggesting otherwise).

Run:
```bash
git -C /projects/Brewra/PWA-multi-tenancy push origin \
  pre-refactor-2026-05-05 \
  develop-initial-2026-05-05 \
  production-initial-2026-05-05
```
Expected: three `* [new tag]` lines. If any "already exists on origin": fine, continue.

- [ ] **Step 3: Verify all three tags on PWA origin**

Run:
```bash
git -C /projects/Brewra/PWA-multi-tenancy ls-remote --tags origin | grep -E '(pre-refactor|develop-initial|production-initial)'
```
Expected: three lines (one per tag).

- [ ] **Step 4: Create `pre-monorepo-fork-<TODAY>` tag on PWA at master tip**

Tag is placed on PWA `master` — that's where the Brewra devs actually push. Anchors "what Brewra devs see at fork moment." (Recovery of synthetic develop/production state is via `develop-initial-2026-05-05` and `production-initial-2026-05-05` tags pushed in Step 2.)

Run:
```bash
git -C /projects/Brewra/PWA-multi-tenancy tag pre-monorepo-fork-<TODAY> master
git -C /projects/Brewra/PWA-multi-tenancy push origin pre-monorepo-fork-<TODAY>
```
Expected: `* [new tag]` line.

- [ ] **Step 5: Verify backend repo working tree is clean and bring local `main` up to date**

Backend's primary branch is `main` (not `master`). Local `main` may be behind origin if Brewra devs have pushed; fast-forward it before tagging.

Run:
```bash
git -C /projects/Brewra/backend status
git -C /projects/Brewra/backend branch -v --no-abbrev
git -C /projects/Brewra/backend checkout main
git -C /projects/Brewra/backend pull --ff-only origin main
```
Expected: WT clean, `main` branch present and now at origin/main tip. If pull fails with non-fast-forward: stop, resolve manually (CTO has divergent local commits).

- [ ] **Step 6: Create `pre-monorepo-fork-<TODAY>` tag on backend at main tip**

Run:
```bash
git -C /projects/Brewra/backend tag pre-monorepo-fork-<TODAY> main
git -C /projects/Brewra/backend push origin pre-monorepo-fork-<TODAY>
```
Expected: `* [new tag]` line.

- [ ] **Step 7: Final verification — both new tags on both origins**

Run:
```bash
echo "=== PWA tag ==="
git -C /projects/Brewra/PWA-multi-tenancy ls-remote --tags origin pre-monorepo-fork-<TODAY>
echo "=== backend tag ==="
git -C /projects/Brewra/backend ls-remote --tags origin pre-monorepo-fork-<TODAY>
echo "=== verify backend tag SHA matches origin/main ==="
git -C /projects/Brewra/backend rev-parse origin/main
```
Expected: each origin shows one SHA + tag line for `pre-monorepo-fork-<TODAY>`. Backend tag SHA should match `origin/main` SHA.

No commit needed for this task — only tags created on remotes.

---

## Task 2: Create empty GitHub repo

Reserve the GitHub URL before doing local work. Easier to push to a pre-existing empty repo than to create one mid-flow.

**Files:**
- Created on GitHub: empty repo `dicemanx/brewra-gtm-intelligence` (CTO's personal account; transfer to org later per spec).

- [ ] **Step 1: Verify gh CLI auth, or use web fallback**

Run:
```bash
gh auth status
```
If logged in as `dicemanx`: proceed to Step 2.
If auth invalid (token expired): re-auth interactively with `gh auth login -h github.com`, OR use Option B (web) in Step 2.

- [ ] **Step 2: Create the empty repo on GitHub**

**Option A (GitHub CLI):**
```bash
gh repo create dicemanx/brewra-gtm-intelligence --private --description "Brewra GTM Intelligence monorepo (frontend + backend)"
```
Expected: `✓ Created repository dicemanx/brewra-gtm-intelligence on GitHub`.

**Option B (web):** go to github.com/new, set:
- Owner: `dicemanx`
- Repository name: `brewra-gtm-intelligence`
- Visibility: Private
- **Do NOT** check "Add a README", "Add .gitignore", or "Choose a license" — repo must be empty so first push from local creates the initial state.

- [ ] **Step 3: Verify the repo exists and is empty**

Run:
```bash
gh repo view dicemanx/brewra-gtm-intelligence --json name,isEmpty
```
Expected: JSON output with `"isEmpty": true`. If `isEmpty` is `false`, the repo was created with auto-content — delete it and recreate empty.

- [ ] **Step 4: Note the clone URL**

Run:
```bash
gh repo view dicemanx/brewra-gtm-intelligence --json sshUrl,url
```
Expected: SSH URL like `git@github.com:dicemanx/brewra-gtm-intelligence.git` and HTTPS URL. Use the SSH URL throughout (substitute as `<REPO-URL>` in subsequent steps).

---

## Task 3: Initialize local monorepo with scaffolding

Create the local repo with initial scaffolding files. The actual content (frontend, backend) comes in Task 4 via subtree imports. This task lays the foundation.

**Files:**
- Create: `/projects/Brewra/brewra-gtm-intelligence/.gitignore`
- Create: `/projects/Brewra/brewra-gtm-intelligence/README.md`
- Create: `/projects/Brewra/brewra-gtm-intelligence/BRANCHES.md`
- Create: `/projects/Brewra/brewra-gtm-intelligence/specs/.gitkeep`
- Create: `/projects/Brewra/brewra-gtm-intelligence/plans/.gitkeep`
- Create: `/projects/Brewra/brewra-gtm-intelligence/docs/.gitkeep`
- Create: `/projects/Brewra/brewra-gtm-intelligence/scripts/.gitkeep`
- (CLAUDE.md and AGENTS.md are deferred to Task 11 — they need full content, not placeholders.)

- [ ] **Step 1: Verify the target directory does not already exist**

Run:
```bash
ls /projects/Brewra/brewra-gtm-intelligence 2>/dev/null && echo "ALREADY EXISTS - STOP" || echo "ok, does not exist"
```
Expected: `ok, does not exist`. If directory exists: stop, investigate (could be a previous failed attempt; rename or remove only after verifying nothing important is in it).

- [ ] **Step 2: Initialize the repo with `master` as default branch**

Run:
```bash
cd /projects/Brewra
git init brewra-gtm-intelligence -b master
cd brewra-gtm-intelligence
```
Expected: `Initialized empty Git repository in /projects/Brewra/brewra-gtm-intelligence/.git/`. Working dir is now the new monorepo.

- [ ] **Step 3: Create `.gitignore`**

Create file `/projects/Brewra/brewra-gtm-intelligence/.gitignore` with content:

```
# Node / JS / Vite
node_modules/
dist/
dev-dist/
.vite/
*.log
npm-debug.log*

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Environment / secrets
.env
.env.local
.env.*.local
*.key
*.pem
.aws/
.gcloud/

# Editor / OS
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo

# Build / coverage / temp
coverage/
.coverage
.turbo/
.next/
.cache/

# OS-specific
*.tmp
*.temp
```

- [ ] **Step 4: Create `README.md`**

Create file `/projects/Brewra/brewra-gtm-intelligence/README.md` with content:

```markdown
# Brewra GTM Intelligence

B2B GTM/sales-intelligence PWA. Frontend (React/Vite/TypeScript) + backend (FastAPI/Python) in one repo.

## Layout

- `/frontend/` — React PWA (subtree imported from PWA-multi-tenancy)
- `/backend/` — FastAPI service (subtree imported from backend repo)
- `/specs/` — design specs (output of brainstorming)
- `/plans/` — implementation plans (output of plan-writing)
- `/docs/` — analyses and reference docs
- `/scripts/` — automation (`sync.sh`, `safety_net/`)
- `/CLAUDE.md`, `/AGENTS.md` — agent context
- `/BRANCHES.md` — branch model + sync workflow

## Branches

This repo is in a **temporary parallel-branch state** during fork transition (~1–2 weeks). See `BRANCHES.md` for the temp model and `scripts/sync.sh` for syncing Brewra-dev work from old repos.

## Common commands

```bash
# frontend
cd frontend && npm install && npm run dev

# backend
cd backend && pip install -r requirements.txt && python main.py

# sync Brewra-dev work from old repos (temp week only)
bash scripts/sync.sh
```

See `CLAUDE.md` for full agent guidance.
```

- [ ] **Step 5: Create `BRANCHES.md`** (initial version — fuller content added in Task 11)

Create file `/projects/Brewra/brewra-gtm-intelligence/BRANCHES.md` with content:

```markdown
# Branches

This repo is in a **temporary parallel-branch state** during the fork transition. After Plan 05 reconciliation and Brewra-dev migration, this file gets rewritten for the future `master`/`dev`(/`stage`) model.

## Current branches (temp week)

| Branch | Role | Policy |
|---|---|---|
| `master` | CTO's working branch. AI-native development happens here. | Write freely. |
| `develop` | Tracker mirror of PWA `master`'s `development/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `production` | Tracker mirror of PWA `master`'s `production/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `pwa-master-history` | Read-only archive of PWA's `master` (pre-Plan-01 history with original SHAs). | Never write. |

## Discipline rule

Only `master` gets your hand-typed commits. `sync.sh` updates `develop`/`production` automatically; if you commit there manually, the next sync may conflict.

## Workflows

**Sync from Brewra devs:** `bash scripts/sync.sh` — pulls latest from old PWA + backend repos onto tracker branches.

**Absorb FE updates into master:** `git checkout master && git merge develop`.

**Backend changes:** if originated in old `backend` repo (Brewra dev pushes to `main`), `sync.sh` propagates to all three monorepo branches automatically. If originated on monorepo's `master`, they don't propagate to trackers — they ship via cutover (this is intentional per spec).

## Future state (post-cutover)

After cutover, this file gets rewritten. Tracker branches deleted. Future model:
- `master` — main branch
- `dev` — integration
- (optional) `stage` — pre-production

`pwa-master-history` is retained indefinitely as the long-term archive.
```

- [ ] **Step 6: Create the empty subdirectory placeholders**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
mkdir -p specs plans docs scripts
touch specs/.gitkeep plans/.gitkeep docs/.gitkeep scripts/.gitkeep
```

- [ ] **Step 7: Stage and commit the scaffolding**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add .gitignore README.md BRANCHES.md specs/.gitkeep plans/.gitkeep docs/.gitkeep scripts/.gitkeep
git commit -m "initial scaffolding: gitignore, README, BRANCHES, empty dirs"
```
Expected: `[master (root-commit) <SHA>] initial scaffolding: gitignore, README, BRANCHES, empty dirs`.

- [ ] **Step 8: Add origin remote and push**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git remote add origin <REPO-URL>
git push -u origin master
```
Expected: branch `master` pushed and tracking set up.

- [ ] **Step 9: Verify repo on GitHub now has the scaffolding**

Run:
```bash
gh repo view dicemanx/brewra-gtm-intelligence --json defaultBranchRef
```
Expected: `defaultBranchRef.name == "master"`.

---

## Task 4: Subtree-import frontend (from PWA local `develop`) and backend (from `main`) onto master

Bring the actual content into the monorepo via `git subtree add` (no `--squash` — full history preserved per spec).

**Files:**
- Modify: `/projects/Brewra/brewra-gtm-intelligence/` — adds `/frontend/` (entire tree) and `/backend/` (entire tree).

- [ ] **Step 1: Add `pwa` and `backend` remotes pointing at on-disk repos**

Using on-disk paths (not GitHub URLs) for subtree imports — faster, no network round-trip.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git remote add pwa     /projects/Brewra/PWA-multi-tenancy
git remote add backend /projects/Brewra/backend
```

- [ ] **Step 2: Verify remotes**

Run:
```bash
git remote -v
```
Expected output includes:
```
backend  /projects/Brewra/backend (fetch)
backend  /projects/Brewra/backend (push)
origin   <REPO-URL> (fetch)
origin   <REPO-URL> (push)
pwa      /projects/Brewra/PWA-multi-tenancy (fetch)
pwa      /projects/Brewra/PWA-multi-tenancy (push)
```

- [ ] **Step 3: Fetch from both upstream remotes**

Run:
```bash
git fetch pwa
git fetch backend
```
Expected: branch and tag info from both. No errors.

- [ ] **Step 4: Subtree-import frontend from `pwa develop`** (no `--squash`)

Run:
```bash
git subtree add --prefix=frontend pwa develop \
  -m "subtree: import frontend from PWA-multi-tenancy@develop"
```
Expected: `Added dir 'frontend'` and a merge commit. Length of output depends on PWA's history — many "..." lines as commits import.

- [ ] **Step 5: Verify `/frontend/` contents match PWA's `develop`**

Run:
```bash
diff -rq /projects/Brewra/brewra-gtm-intelligence/frontend /projects/Brewra/PWA-multi-tenancy 2>&1 | grep -v 'Only in /projects/Brewra/PWA-multi-tenancy: \.git$' | head -20
```
Wait — the comparison must be against PWA's `develop` checkout, not `refactor`. Switch PWA to `develop` first if not already there. Actually the simpler verification:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git ls-tree -r --name-only HEAD -- frontend/ | head -10
git log -1 --format="%H" HEAD -- frontend/
```
Expected: tree contents from `pwa/develop`. Top-level files like `frontend/package.json`, `frontend/src/`, `frontend/BRANCHES.md`, etc.

- [ ] **Step 6: Verify `git log --follow` traces frontend file history**

Pick any file that exists in PWA's pre-fork history. `frontend/src/main.tsx` is a safe bet.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --follow --oneline frontend/src/main.tsx | head -10
```
Expected: 5+ commits in the history including pre-fork SHAs. If only 1–2 commits show, `--squash` was applied accidentally — abort and redo Step 4.

- [ ] **Step 7: Subtree-import backend from `backend main`** (no `--squash`)

Backend's primary branch is `main`, not `master`. The `backend` remote points at the on-disk backend repo whose local `main` is now in sync with origin (per Task 1 Step 5).

Run:
```bash
git subtree add --prefix=backend backend main \
  -m "subtree: import backend from backend@main"
```
Expected: `Added dir 'backend'` and a merge commit.

- [ ] **Step 8: Verify backend contents and history**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git ls-tree -r --name-only HEAD -- backend/ | head -10
git log --follow --oneline backend/main.py | head -10
```
Expected: backend tree present (`backend/main.py`, `backend/api.py`, `backend/services.py`, `backend/requirements.txt`, etc.). `git log --follow` returns multiple commits.

- [ ] **Step 9: Push master with both subtrees**

Run:
```bash
git push origin master
```
Expected: push succeeds. May take a moment given the imported history. If it fails due to size limits: investigate, may need to push in stages or use Git LFS for large blobs (unlikely at this codebase size).

- [ ] **Step 10: Final sanity check on master**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline -5
ls -la
```
Expected: `frontend/` and `backend/` directories visible. Recent commits show "subtree: import frontend..." and "subtree: import backend..." merge commits, plus the initial scaffolding commit.

---

## Task 5: Create the `develop` tracker branch

Trivial — `develop` initial state is identical to master (both = PWA-local-develop + backend-main).

**Files:**
- No working-tree changes. Branch creation only.

- [ ] **Step 1: Create `develop` branch from current `master` tip**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git branch develop master
```
Expected: no output (success). `develop` now points at the same commit as `master`.

- [ ] **Step 2: Verify**

Run:
```bash
git branch -v --no-abbrev
```
Expected: `master` and `develop` listed, both at the same commit SHA.

- [ ] **Step 3: Push `develop` to origin**

Run:
```bash
git push -u origin develop
```
Expected: branch pushed and tracking set up.

---

## Task 6: Create the `production` tracker branch via worktree (option c)

Build the `production` branch in a separate `git worktree` so the main repo's checkout remains clean. Inside the worktree, use clean `git subtree add` calls so subtree metadata is recorded correctly by git-subtree itself.

**Files:**
- Working area: `/projects/Brewra/monorepo-production-build/` (created and removed during this task — not the final monorepo location).
- Resulting branch in `/projects/Brewra/brewra-gtm-intelligence/`: new `production` branch, pushed to origin.

- [ ] **Step 1: Verify the worktree path is available**

Run:
```bash
ls /projects/Brewra/monorepo-production-build 2>/dev/null && echo "EXISTS - STOP" || echo "ok"
```
Expected: `ok`. If exists from a previous attempt: investigate before continuing.

- [ ] **Step 2: Create the worktree on a new orphan branch**

Requires git ≥ 2.42 for the `--orphan` flag (Ubuntu 22.04's stock 2.34.1 does not support it). Verify with `git --version`; if older, upgrade via `sudo add-apt-repository ppa:git-core/ppa -y && sudo apt update && sudo apt install git -y`.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git worktree add --orphan -b production /projects/Brewra/monorepo-production-build
```
Expected: `Preparing worktree (new branch 'production')`. Worktree directory created with `production` branch checked out.

**Note on syntax:** in git 2.54+, `--orphan` is a flag without a positional branch argument — the branch name must be passed via `-b`. Older invocations like `git worktree add <path> --orphan production` will fail with "option '--orphan' and commit-ish cannot be used together" because `production` gets parsed as a commit-ish. The `--orphan -b <name> <path>` form is the portable invocation.

- [ ] **Step 3: Switch to the worktree directory**

Run:
```bash
cd /projects/Brewra/monorepo-production-build
git status
```
Expected: `On branch production` and "No commits yet".

- [ ] **Step 4: Create the empty initial commit**

Subtree-add requires a current commit. The empty commit provides one.

Run:
```bash
git commit --allow-empty -m "initialize production tracker branch"
```
Expected: `[production (root-commit) <SHA>] initialize production tracker branch`.

- [ ] **Step 5: Subtree-add frontend from `pwa production` (no `--squash`)**

Run:
```bash
git subtree add --prefix=frontend pwa production \
  -m "subtree: import frontend from PWA-multi-tenancy@production"
```
Expected: `Added dir 'frontend'` and merge commit. Output longer due to history import.

- [ ] **Step 6: Subtree-add backend from `backend main` (no `--squash`)**

Run:
```bash
git subtree add --prefix=backend backend main \
  -m "subtree: import backend from backend@main"
```
Expected: `Added dir 'backend'` and merge commit.

- [ ] **Step 7: Pull scaffolding files in from `master`**

Bring `CLAUDE.md`, `AGENTS.md`, etc. onto `production` so it has the same project conventions as `master`. (CLAUDE.md/AGENTS.md don't exist yet on master — they're created in Task 11. We'll backfill them onto production then.)

Run:
```bash
git checkout master -- README.md BRANCHES.md .gitignore specs/ plans/ docs/ scripts/
git status
```
Expected: `git status` shows new files staged: README.md, BRANCHES.md, .gitignore, and the empty subdirs.

- [ ] **Step 8: Commit the scaffolding alignment**

Run:
```bash
git commit -m "production: align scaffolding with master"
```
Expected: `[production <SHA>] production: align scaffolding with master`.

- [ ] **Step 9: Verify production branch contents**

Run:
```bash
ls -la
git ls-tree --name-only HEAD | sort
```
Expected: top-level entries match master's: `.gitignore`, `BRANCHES.md`, `README.md`, `backend/`, `docs/`, `frontend/`, `plans/`, `scripts/`, `specs/`.

- [ ] **Step 10: Verify subtree metadata works (this is the load-bearing check for option c)**

Run:
```bash
git subtree pull --prefix=frontend pwa production --dry-run 2>&1 | head -5 || echo "(dry-run not supported on this git version - try direct check)"
git log --grep="git-subtree-dir: frontend" --grep="git-subtree-dir: backend" --all -1 --format="%H %s"
```
Expected: at minimum, the `git log --grep` finds commits with `git-subtree-dir:` annotations in their messages. This proves subtree metadata is recorded. Without correct metadata, future `sync.sh` pulls will misbehave.

- [ ] **Step 11: Push `production` to origin**

Run:
```bash
git push -u origin production
```
Expected: branch pushed.

- [ ] **Step 12: Return to main monorepo and remove the worktree**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git worktree remove /projects/Brewra/monorepo-production-build
```
Expected: worktree directory removed. `git worktree list` shows only the main repo.

- [ ] **Step 13: Verify production branch is reachable from main monorepo**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git branch -v --no-abbrev
git log --oneline production -5
```
Expected: `production` listed in branches; `git log` shows the production-tracker commits including subtree adds.

---

## Task 7: Create `pwa-master-history` archive branch

Mirror PWA's `master` branch into the monorepo as a read-only archive. This preserves the original (pre-Plan-01) PWA history with original SHAs.

**Files:**
- New branch in monorepo. No working-tree changes (this branch is never checked out for editing).

- [ ] **Step 1: Fetch PWA's `master` ref into a new local branch**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git fetch pwa master:pwa-master-history
```
Expected: `* [new branch]      master     -> pwa-master-history`.

- [ ] **Step 2: Verify the branch points at PWA master's tip**

Run:
```bash
git log -1 --format="%H %s" pwa-master-history
cd /projects/Brewra/PWA-multi-tenancy && git log -1 --format="%H %s" master
```
Expected: both commands return the same SHA and subject — confirming `pwa-master-history` is identical to PWA's `master`.

- [ ] **Step 3: Verify the canvas-nested layout is preserved on this branch**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git ls-tree --name-only pwa-master-history | sort
```
Expected: top-level entries include `development/` and `production/` directories (the pre-Plan-01 nested canvas layout). NOT `frontend/` (that's only on master/develop).

- [ ] **Step 4: Push `pwa-master-history` to origin**

Run:
```bash
git push -u origin pwa-master-history
```
Expected: branch pushed.

---

## Task 8: Install `scripts/sync.sh`

Add the sync script to the monorepo. Content from spec's "scripts/sync.sh" section.

**Files:**
- Create: `/projects/Brewra/brewra-gtm-intelligence/scripts/sync.sh`
- Modify: existing `scripts/.gitkeep` removed (no longer needed once a real file exists)

- [ ] **Step 1: Switch back to `master` branch**

`scripts/sync.sh` lives on master (the working branch).

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git status
```
Expected: clean working tree on master.

- [ ] **Step 2: Create `scripts/sync.sh`**

Create file `/projects/Brewra/brewra-gtm-intelligence/scripts/sync.sh` with content (verbatim from spec — 2-stage script):

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
    master       <- origin/master (Brewra-dev work)
    develop      = subtree-split(development/friendly-sales-canvas/)
    production   = subtree-split(production/friendly-sales-canvas/)

  Monorepo tracker branches updated:
    develop      <- pwa/develop    + backend/main
    production   <- pwa/production + backend/main
    master       <- backend/main   (frontend stays put)

  To absorb Brewra devs' frontend updates into your master working branch:
    git checkout master
    git merge develop -m "merge: absorb FE updates from devs"

EOF
```

- [ ] **Step 3: Make `sync.sh` executable**

Run:
```bash
chmod +x /projects/Brewra/brewra-gtm-intelligence/scripts/sync.sh
```

- [ ] **Step 4: Remove the placeholder `.gitkeep`**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
rm -f scripts/.gitkeep
```

- [ ] **Step 5: Stage and commit `sync.sh`**

`sync.sh`'s own preflight requires a clean working tree, so the script must be committed *before* it can be dry-run.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add scripts/sync.sh
git rm -f scripts/.gitkeep 2>/dev/null || true
git status
git commit -m "scripts: add sync.sh for devs->CTO syncs from old repos"
```
Expected: clean commit. `git status` should show only `scripts/sync.sh` staged plus the `.gitkeep` deletion.

- [ ] **Step 6: Run sync.sh in dry-run mode to verify it works end-to-end**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
bash scripts/sync.sh --dry-run
```
Expected output sequence (color codes may show as escape sequences if terminal doesn't support them):
- "Preflight" section with `ok monorepo WT clean`, `ok old repos found at /projects/Brewra/PWA-multi-tenancy and /projects/Brewra/backend`, `ok PWA WT clean`, `ok monorepo remotes pwa, backend configured`, `ok monorepo branches master, develop, production present`, `ok starting on monorepo='master' / pwa='...'`
- "Stage 1 — PWA pre-sync" header followed by `(dry-run)` lines for the PWA checkout, fetch, ff-only merge, branch deletes, and two `git subtree split` calls
- "Stage 2 — monorepo sync" header followed by `(dry-run) git fetch pwa --prune` etc.
- "Monorepo branch: develop" section with `(dry-run) git checkout develop`, then `(dry-run) git subtree pull --prefix=frontend pwa develop` and `(dry-run) git subtree pull --prefix=backend backend main`
- Same for "Monorepo branch: production" and "Monorepo branch: master"
- "Sync complete" summary block listing PWA local refresh state and monorepo tracker updates

If preflight fails with "monorepo WT not clean": you skipped Step 5 — commit first. Other failures: most likely a missing remote or branch — double-check Task 4–6 completed correctly.

- [ ] **Step 7: Push master**

Run:
```bash
git push origin master
```

---

## Task 9: Tag `fork-point-<TODAY>`

Tag the monorepo at the moment everything is in place — recovery anchor for the fork.

**Files:**
- New tag on origin: `fork-point-<TODAY>`.

- [ ] **Step 1: Confirm we're on master with sync.sh committed**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git log --oneline -5
```
Expected: clean WT on master. Recent commits: scaffolding, subtree imports, sync.sh.

- [ ] **Step 2: Create and push the tag**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git tag fork-point-<TODAY>
git push origin fork-point-<TODAY>
```
Expected: `* [new tag]` line.

- [ ] **Step 3: Verify the tag is on origin**

Run:
```bash
git ls-remote --tags origin fork-point-<TODAY>
```
Expected: one SHA + tag line.

---

## Task 10: Migrate plans, specs, and analyses from `/projects/Brewra/` parent

Move the existing plans (Plan 01, the spec for this Plan 02) and analysis directories from `/projects/Brewra/` into the monorepo. Triage redundant analysis dirs.

**Files:**
- Modify: `/projects/Brewra/plans/01-pwa-folder-to-branch.md` (move into monorepo's `/plans/`)
- Modify: `/projects/Brewra/plans/02-monorepo-fork-spec.md` (move into monorepo's `/specs/`)
- Modify: `/projects/Brewra/plans/02-monorepo-fork-plan.md` (this file — move into monorepo's `/plans/`)
- Modify: `/projects/Brewra/analysis/` (move into monorepo's `/docs/analysis/`)
- Modify: `/projects/Brewra/claude-analysis/`, `/projects/Brewra/detailed-analysis/`, `/projects/Brewra/PWA-multi-tenancy/analysis/`, `/projects/Brewra/backend/analysis/` (triage)

- [ ] **Step 1: Inventory what's at the parent level**

Run:
```bash
ls /projects/Brewra/plans/
ls /projects/Brewra/analysis/ 2>/dev/null
ls /projects/Brewra/claude-analysis/ 2>/dev/null
ls /projects/Brewra/detailed-analysis/ 2>/dev/null
ls /projects/Brewra/PWA-multi-tenancy/analysis/ 2>/dev/null
ls /projects/Brewra/backend/analysis/ 2>/dev/null
```
Note what exists vs what's missing. Use this inventory to drive the next steps.

- [ ] **Step 2: Move the spec into `/specs/`**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
mv /projects/Brewra/plans/02-monorepo-fork-spec.md specs/02-monorepo-fork-spec.md
rm -f specs/.gitkeep
```

- [ ] **Step 3: Move the plans (01 and 02)**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
mv /projects/Brewra/plans/01-pwa-folder-to-branch.md plans/01-pwa-folder-to-branch.md
mv /projects/Brewra/plans/02-monorepo-fork-plan.md plans/02-monorepo-fork-plan.md
rm -f plans/.gitkeep
```

- [ ] **Step 4: Verify the source `plans/` dir at parent is now empty**

Run:
```bash
ls /projects/Brewra/plans/
```
Expected: should now be empty (or just `dry-run-merge/` if that subdir existed previously and was unrelated). If unexpected files: inspect before continuing.

- [ ] **Step 5: Remove the now-empty parent `plans/` dir**

Run:
```bash
rmdir /projects/Brewra/plans 2>&1 || echo "not empty - inspect contents"
```
Expected: no output (success). If "not empty": inspect what's left and decide whether to move or delete.

- [ ] **Step 6: Move the canonical `analysis/` directory**

Per spec, `/projects/Brewra/analysis/` is the most thorough set and goes in as the primary `/docs/analysis/`.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
mv /projects/Brewra/analysis docs/analysis
rm -f docs/.gitkeep
ls docs/analysis/
```
Expected: file listing of the moved analysis docs (`PRODUCT_SPECIFICATION.md`, `ARCHITECTURE_DOCUMENT.md`, `DESIGN_SYSTEM.md`, `README.md`, etc.).

- [ ] **Step 7: Triage `claude-analysis/`** (per spec: keep unique content under `/docs/analysis/legacy/`, drop redundant duplicates)

Compare contents:
```bash
ls /projects/Brewra/claude-analysis/ 2>/dev/null
diff -q /projects/Brewra/claude-analysis/ /projects/Brewra/brewra-gtm-intelligence/docs/analysis/ 2>/dev/null | head -20
```

If `claude-analysis/` exists and has unique content not in `analysis/`:
```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/docs/analysis/legacy
mv /projects/Brewra/claude-analysis /projects/Brewra/brewra-gtm-intelligence/docs/analysis/legacy/claude-analysis
```

If contents are duplicates of `analysis/`:
```bash
rm -rf /projects/Brewra/claude-analysis
```

If unsure: move to legacy/ to preserve, then prune later.

- [ ] **Step 8: Triage `detailed-analysis/`** (same pattern)

```bash
ls /projects/Brewra/detailed-analysis/ 2>/dev/null
```

Repeat the diff-and-decide pattern from Step 7. Move unique content to `docs/analysis/legacy/detailed-analysis/`, delete if duplicate.

- [ ] **Step 9: Note the per-repo analyses inside subtreed content**

`/projects/Brewra/PWA-multi-tenancy/analysis/` and `/projects/Brewra/backend/analysis/` (if they exist) are inside the Brewra devs' workspaces — DO NOT touch them. They're separate from the monorepo. They'll be subsumed when those repos are eventually archived (post-cutover, future plan).

If they have unique content the CTO wants in the monorepo, copy (don't move) into `docs/analysis/legacy/`:
```bash
[ -d /projects/Brewra/PWA-multi-tenancy/analysis ] && \
  cp -r /projects/Brewra/PWA-multi-tenancy/analysis /projects/Brewra/brewra-gtm-intelligence/docs/analysis/legacy/pwa-analysis
[ -d /projects/Brewra/backend/analysis ] && \
  cp -r /projects/Brewra/backend/analysis /projects/Brewra/brewra-gtm-intelligence/docs/analysis/legacy/backend-analysis
```

- [ ] **Step 10: Stage and commit the migrated content**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/ plans/ docs/
git status
git commit -m "migrate plans, specs, and analyses from parent dir"
```
Expected: commit shows added files under `specs/`, `plans/`, `docs/`. The empty `.gitkeep` removals also captured if previously tracked.

- [ ] **Step 11: Push**

Run:
```bash
git push origin master
```

---

## Task 11: Migrate `safety_net_1` from parent

Move the verification snapshots and `verify.sh` script. Update `verify.sh`'s hardcoded paths to point at the monorepo's `/frontend/` and `/backend/`.

**Files:**
- Modify: `/projects/Brewra/safety_net_1/` (move into `/scripts/safety_net/`)
- Modify: `/projects/Brewra/brewra-gtm-intelligence/scripts/safety_net/verify.sh` (update default paths)

- [ ] **Step 1: Inspect what's in `safety_net_1`**

Run:
```bash
ls /projects/Brewra/safety_net_1/
ls /projects/Brewra/safety_net_1/snapshots/ 2>/dev/null
```
Expected: `verify.sh` plus a `snapshots/` directory with `*.sha256` and possibly `backend-openapi.json` files.

- [ ] **Step 2: Move the directory**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
mv /projects/Brewra/safety_net_1 scripts/safety_net
ls scripts/safety_net/
```
Expected: same files now under `scripts/safety_net/`.

- [ ] **Step 3: Update `verify.sh`'s hardcoded path defaults**

Open `/projects/Brewra/brewra-gtm-intelligence/scripts/safety_net/verify.sh`.

Find the variable defaults block (around lines 15–18 in the original):
```bash
BACKEND_DIR="${BACKEND_DIR:-/projects/Brewra/backend}"
FRONTEND_DEV_DIR="${FRONTEND_DEV_DIR:-/projects/Brewra/PWA-multi-tenancy/development/friendly-sales-canvas}"
FRONTEND_PROD_DIR="${FRONTEND_PROD_DIR:-/projects/Brewra/PWA-multi-tenancy/production/friendly-sales-canvas}"
OPENAPI_URL="${OPENAPI_URL:-https://backend-11kr.onrender.com/openapi.json}"
```

Replace with:
```bash
# Defaults assume invocation from the monorepo root: /projects/Brewra/brewra-gtm-intelligence/
# Overridable via env vars if running from elsewhere or pointing at old repos.
BACKEND_DIR="${BACKEND_DIR:-/projects/Brewra/brewra-gtm-intelligence/backend}"
FRONTEND_DEV_DIR="${FRONTEND_DEV_DIR:-/projects/Brewra/brewra-gtm-intelligence/frontend}"
FRONTEND_PROD_DIR="${FRONTEND_PROD_DIR:-/projects/Brewra/brewra-gtm-intelligence/frontend}"
OPENAPI_URL="${OPENAPI_URL:-https://backend-11kr.onrender.com/openapi.json}"
```

(Both `FRONTEND_DEV_DIR` and `FRONTEND_PROD_DIR` point at the same `/frontend/` because in the monorepo's `master` branch there's only one frontend tree. The two-frontend-dirs distinction was a pre-Plan-01 concept.)

Use the `Edit` tool with old_string and new_string matching the exact block above.

- [ ] **Step 4: Verify `verify.sh` is still executable**

Run:
```bash
ls -l /projects/Brewra/brewra-gtm-intelligence/scripts/safety_net/verify.sh
```
Expected: permissions include `x` (executable). If not:
```bash
chmod +x /projects/Brewra/brewra-gtm-intelligence/scripts/safety_net/verify.sh
```

- [ ] **Step 5: Smoke-test `verify.sh` (optional but recommended)**

Run from monorepo root:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
bash scripts/safety_net/verify.sh deps 2>&1 | head -20
```
Expected: runs without "command not found" errors. May report `DIFF` if dependency manifests have changed since the snapshot was taken — that's fine. The snapshots are pre-fork; small drift expected.

- [ ] **Step 6: Stage and commit**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add scripts/safety_net/
git commit -m "migrate safety_net_1 from parent; update verify.sh path defaults for monorepo layout"
git push origin master
```

---

## Task 12: Adapt `CLAUDE.md` and `AGENTS.md` for the monorepo

Create monorepo-specific `CLAUDE.md` and `AGENTS.md` based on the parent versions but:
- Replace "Repository Layout" section with monorepo tree.
- Replace "PWA branch model (post 2026-05-05 folder→branch refactor)" section with **Monorepo Branch Model**.
- Update path references throughout (parent paths → monorepo paths).
- Add new **AI-Native Development** section.
- Update "Common Commands" to use `cd frontend` / `cd backend`.
- Update "Pre-existing Analyses" to point to `/docs/analysis/`.

**Files:**
- Create: `/projects/Brewra/brewra-gtm-intelligence/CLAUDE.md`
- Create: `/projects/Brewra/brewra-gtm-intelligence/AGENTS.md`

- [ ] **Step 1: Read the parent `CLAUDE.md` and `AGENTS.md`**

Use the `Read` tool to load:
- `/projects/Brewra/CLAUDE.md`
- `/projects/Brewra/AGENTS.md`

Hold both in context while writing the new versions.

- [ ] **Step 2: Create the monorepo `CLAUDE.md`**

Use the `Write` tool to create `/projects/Brewra/brewra-gtm-intelligence/CLAUDE.md`.

Structure: copy the parent `CLAUDE.md` verbatim, then make these modifications:

1. **Replace "Repository Layout" section** with:
```markdown
## Repository Layout

This is the **brewra-gtm-intelligence monorepo** — a single repo containing the React PWA at `/frontend/` and the FastAPI backend at `/backend/`. Plus design specs, plans, docs, and automation at the root level.

```
brewra-gtm-intelligence/
├── frontend/                # React/Vite/TypeScript PWA (subtree from PWA-multi-tenancy)
├── backend/                 # FastAPI Python service (subtree from backend repo)
├── scripts/
│   ├── sync.sh              # pull Brewra-dev work from old repos (temp week only)
│   └── safety_net/          # verification snapshots + verify.sh
├── specs/                   # design intent (output of brainstorming)
├── plans/                   # execution intent (output of plan-writing)
├── docs/
│   └── analysis/            # the most thorough product/architecture analyses
├── CLAUDE.md, AGENTS.md     # agent context (this file is one of them)
├── BRANCHES.md              # branch model + sync workflow quick-ref
├── README.md
└── .gitignore
```

The two stacks share only an HTTP contract. They live in one repo so cross-cutting changes (API + FE consumer) ship as atomic commits.
```

2. **Replace "PWA branch model (post 2026-05-05 folder→branch refactor)" section** with:

```markdown
## Monorepo Branch Model (during temp week ending ~2026-05-22)

This repo is in a temporary parallel-branch state during the fork transition. After Plan 05 reconciliation and Brewra-dev migration, this section gets rewritten for the future `master`/`dev`(/`stage`) model.

| Branch | Role | Policy |
|---|---|---|
| `master` | CTO's working branch. AI-native development happens here. | Write freely. Force-push allowed (solo). |
| `develop` | Tracker mirror of PWA `master`'s `development/` folder + backend's `main`. | **Only `sync.sh`'s commits land here.** No hand-typed commits. |
| `production` | Tracker mirror of PWA `master`'s `production/` folder + backend's `main`. | Same: only `sync.sh` writes. |
| `pwa-master-history` | Read-only archive of PWA's `master` at fork moment (canvas-nested layout preserved). | Never write. |

**Discipline rule:** only `master` gets your hand-typed commits. `sync.sh` updates `develop`/`production` automatically; manual commits there will conflict with the next sync.

**Sync workflow (Brewra devs → CTO):**
```bash
bash scripts/sync.sh                         # pulls latest from old PWA + backend repos
git checkout master && git merge develop     # absorb FE updates into master (manual, when ready)
```

`sync.sh` is robust (preflight checks, dry-run mode, restores caller's branch, reports per-pull diffs). Read its head comment for usage.

**Backend changes during temp week:**
- Originating in old `backend` repo (Brewra dev pushes to `main`): `sync.sh` propagates to all three monorepo branches automatically.
- Originating on monorepo's `master` (CTO writes): do NOT propagate to tracker branches. They ship via cutover. Per spec, this is intentional.

**Future state (post-cutover):** `master` + `dev` (+ optional `stage`). Tracker branches deleted. `pwa-master-history` retained as long-term archive.
```

3. **Update "Polyglot Repo Practices" section** — change paths:
   - `PWA-multi-tenancy/development/friendly-sales-canvas/` → `frontend/`
   - "sibling `backend/`" → "nested `/backend/`"
   - "Run tooling from the correct subdir" rule still applies; emphasize `cd frontend` and `cd backend`.

4. **Update "Common Commands" section**:

```markdown
## Common Commands

### Backend (`/backend/`)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000   # how Render runs it (render.yaml)
python main.py                                # local: binds 127.0.0.1:8000
```

(Test framework status, hardcoded URLs in `test_*.py`, etc. — same as before.)

### Frontend (`/frontend/`)

```bash
cd frontend
npm i
npm run dev          # vite dev server on port 5175 (NOT 8080)
npm run build
npm run lint
```

### Sync workflow (temp week)

```bash
bash scripts/sync.sh             # full sync (develop, production, master)
bash scripts/sync.sh --dry-run   # preview without changes

git checkout master
git merge develop                # absorb Brewra-dev FE updates into master
```
```

5. **Add a new section after "Architecture: Big Picture"**:

```markdown
## AI-Native Development

This repo is structured for AI-native development: cross-cutting tasks (changes spanning both stacks) land as **atomic commits**, and work flows through a **spec → plan → implementation** pipeline.

- **Cross-stack atomicity.** A feature touching both `/frontend/` and `/backend/` ships as one commit (or one PR), reviewable as one diff. Don't split FE/BE changes across separate commits "because the codebases are different" — that's the polyrepo habit, not the monorepo rule.
- **Spec-driven flow.**
  1. Idea → brainstorm → `/specs/YYYY-MM-DD-feature-X-design.md` (design intent)
  2. Spec → plan-write → `/plans/NN-feature-X.md` (execution intent, ordered steps)
  3. Plan → commits referencing the plan in commit messages
- **Spec and plan persist** — canonical record of *why* and *how*. Don't delete after execution; agents reference them.
- **Sync workflow** (during temp week only): `bash scripts/sync.sh` pulls Brewra-dev changes from old repos. `git merge develop` on master absorbs FE updates. After cutover (Plan 05 + Plan 06), this section is removed.
```

6. **Update "Gotchas" section** — change path references:
   - `api.py:155-161` → `backend/api.py:155-161`
   - `services.py: search_signals_scout` → `backend/services.py: search_signals_scout`
   - `vite.config.ts:13-30` → `frontend/vite.config.ts:13-30`
   - etc. — every code-location reference gets prefixed with `backend/` or `frontend/`.

7. **Update "Pre-existing Analyses" section** — change pointer:
   - `/projects/Brewra/analysis/...` → `/docs/analysis/...`
   - References to `claude-analysis/`, `detailed-analysis/`, `PWA-multi-tenancy/analysis/`, `backend/analysis/` → if any survived migration: `/docs/analysis/legacy/...`
   - Frontend integration guides (`API_INTEGRATION_GUIDE.md`, `JWT_INTEGRATION_GUIDE.md`, etc.) → currently still inside `/frontend/` (don't hoist during temp week per spec).
   - Backend self-authored guides (`API_DOCUMENTATION.md`, etc.) → currently still inside `/backend/`.

8. **Keep verbatim from parent:**
   - Business State (MVP, pre-launch) — unchanged content.
   - Architecture: Big Picture — unchanged content (just verify path prefixes).
   - Auth reality check — unchanged.

- [ ] **Step 3: Verify the new CLAUDE.md is well-formed**

Run:
```bash
wc -l /projects/Brewra/brewra-gtm-intelligence/CLAUDE.md
head -50 /projects/Brewra/brewra-gtm-intelligence/CLAUDE.md
```
Expected: ~150–250 lines (similar to parent's length). Top of file shows the new "Repository Layout" section with monorepo tree.

- [ ] **Step 4: Create the monorepo `AGENTS.md`**

Same content as `CLAUDE.md`. Per the existing parent pattern, AGENTS.md is a structurally aligned sibling — same sections, same content. Use the `Write` tool to create `/projects/Brewra/brewra-gtm-intelligence/AGENTS.md` with identical content to `/projects/Brewra/brewra-gtm-intelligence/CLAUDE.md`.

```bash
cp /projects/Brewra/brewra-gtm-intelligence/CLAUDE.md /projects/Brewra/brewra-gtm-intelligence/AGENTS.md
```

(Or use the `Write` tool with the same content.)

- [ ] **Step 5: Stage and commit on master**

`git checkout master -- <files>` in Step 6 reads from master's index, so the new files must be committed on master *before* being backfilled to production.

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git add CLAUDE.md AGENTS.md
git commit -m "docs: monorepo CLAUDE.md and AGENTS.md (adapted from parent)"
git push origin master
```

- [ ] **Step 6: Backfill `CLAUDE.md` and `AGENTS.md` onto `production` branch**

The `production` branch was created in Task 6 with master's scaffolding files at the time, but `CLAUDE.md` and `AGENTS.md` didn't exist yet on master then. Bring them onto production now:

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout production
git checkout master -- CLAUDE.md AGENTS.md
git commit -m "production: backfill CLAUDE.md and AGENTS.md from master"
git push origin production
git checkout master
```

---

## Task 13: Delete parent `CLAUDE.md` and `AGENTS.md`

Per spec: parent files have no audience post-fork. Brewra devs don't use agentic dev.

**Files:**
- Delete: `/projects/Brewra/CLAUDE.md`
- Delete: `/projects/Brewra/AGENTS.md`

- [ ] **Step 1: Verify the monorepo versions are in place and pushed**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
ls -l CLAUDE.md AGENTS.md
git ls-tree origin/master -- CLAUDE.md AGENTS.md
```
Expected: both files exist locally and on origin. If either is missing on origin: stop, push first, then continue.

- [ ] **Step 2: Delete the parent files**

Run:
```bash
rm /projects/Brewra/CLAUDE.md
rm /projects/Brewra/AGENTS.md
```

- [ ] **Step 3: Verify they're gone**

Run:
```bash
ls /projects/Brewra/CLAUDE.md 2>&1 | grep -q "No such file" && echo "ok, CLAUDE.md gone" || echo "STILL EXISTS"
ls /projects/Brewra/AGENTS.md 2>&1 | grep -q "No such file" && echo "ok, AGENTS.md gone" || echo "STILL EXISTS"
```
Expected: both `ok, ... gone`.

No commit — these aren't in any git repo (parent dir is not a repo).

---

## Task 14: Verify all acceptance criteria

Per spec: 11 acceptance criteria. Run each verification.

- [ ] **Step 1: Acceptance #1 — monorepo exists locally and on GitHub**

Run:
```bash
ls /projects/Brewra/brewra-gtm-intelligence/.git >/dev/null && echo "ok local" || echo "MISSING local"
gh repo view dicemanx/brewra-gtm-intelligence --json name | grep -q '"name":"brewra-gtm-intelligence"' && echo "ok github" || echo "MISSING github"
```
Expected: both `ok` lines.

- [ ] **Step 2: Acceptance #2 — all four branches present, all on origin**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git branch -v --no-abbrev
git ls-remote --heads origin | grep -E 'master|develop|production|pwa-master-history' | sort
```
Expected: 4 local branches; 4 origin branches with matching SHAs.

- [ ] **Step 3: Acceptance #3 — required tags on origin**

Run:
```bash
echo "=== monorepo ==="
cd /projects/Brewra/brewra-gtm-intelligence && git ls-remote --tags origin fork-point-<TODAY>

echo "=== PWA ==="
cd /projects/Brewra/PWA-multi-tenancy && git ls-remote --tags origin pre-monorepo-fork-<TODAY>

echo "=== backend ==="
cd /projects/Brewra/backend && git ls-remote --tags origin pre-monorepo-fork-<TODAY>
```
Expected: each command returns one SHA + tag line.

- [ ] **Step 4: Acceptance #4 — `git log --follow frontend/<file>` returns full pre-fork history**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --follow --oneline frontend/src/main.tsx | wc -l
```
Expected: 5 or more commits. If 1–2: `--squash` was applied accidentally; investigate.

- [ ] **Step 5: Acceptance #5 — `git log --follow backend/<file>` returns full pre-fork history**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --follow --oneline backend/main.py | wc -l
```
Expected: 5 or more commits.

- [ ] **Step 6: Acceptance #6 — `bash scripts/sync.sh --dry-run` runs cleanly from a fresh state**

Verify on a fresh `git status`:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
bash scripts/sync.sh --dry-run
echo "exit code: $?"
```
Expected: exit code 0. Output shows preflight passing, dry-run commands for each branch, "Sync complete" summary.

- [ ] **Step 7: Acceptance #7 — parent CLAUDE.md and AGENTS.md deleted**

Run:
```bash
ls /projects/Brewra/CLAUDE.md 2>&1
ls /projects/Brewra/AGENTS.md 2>&1
```
Expected: both `No such file or directory`.

- [ ] **Step 8: Acceptance #8 — monorepo's CLAUDE.md, AGENTS.md, BRANCHES.md, README.md populated**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
for f in CLAUDE.md AGENTS.md BRANCHES.md README.md; do
  if [ -s "$f" ]; then echo "ok $f ($(wc -l < $f) lines)"; else echo "MISSING OR EMPTY: $f"; fi
done
```
Expected: 4 `ok` lines.

- [ ] **Step 9: Acceptance #9 — spec and Plan 01 present in monorepo**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
ls -l specs/02-monorepo-fork-spec.md
ls -l plans/01-pwa-folder-to-branch.md
ls -l plans/02-monorepo-fork-plan.md
```
Expected: 3 files exist. The spec also lives at `/specs/`, the original Plan 01 and this Plan 02 at `/plans/`.

- [ ] **Step 10: Acceptance #10 — `/docs/analysis/` populated**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
ls docs/analysis/ | head -20
```
Expected: list of analysis files (`PRODUCT_SPECIFICATION.md`, `ARCHITECTURE_DOCUMENT.md`, etc.). Not empty.

- [ ] **Step 11: Acceptance #11 — `/scripts/safety_net/` populated**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
ls scripts/safety_net/
ls scripts/safety_net/snapshots/ 2>/dev/null
```
Expected: `verify.sh` exists. `snapshots/` directory has the SHA256 manifests and possibly `backend-openapi.json`.

- [ ] **Step 12: Final smoke test — push everything that's pending**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git push origin master develop production pwa-master-history --tags 2>&1 | tail -20
```
Expected: WT clean. Push reports "Everything up-to-date" or pushes any pending commits/tags.

- [ ] **Step 13: Document completion**

Add a completion note to the monorepo by updating the README's status:

Edit `/projects/Brewra/brewra-gtm-intelligence/README.md`. Find the "## Branches" section's first sentence:
```markdown
This repo is in a **temporary parallel-branch state** during fork transition (~1–2 weeks).
```

Replace with:
```markdown
This repo is in a **temporary parallel-branch state** during fork transition. Forked from old repos on <TODAY>; cutover scheduled when Plan 05 reconciliation is complete (~1–2 weeks from <TODAY>).
```

Commit:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add README.md
git commit -m "docs: stamp fork date in README"
git push origin master
```

---

## Done

The monorepo is created. Brewra devs continue working in the old PWA-multi-tenancy and backend repos. CTO's AI-native work happens in `brewra-gtm-intelligence/` on `master`.

**Next steps (separate plans, not part of Plan 02):**

1. **Run `bash scripts/sync.sh` regularly** during the temp week to keep tracker branches current with Brewra-dev work.
2. **Plan 05** — brainstorm/spec/plan for `develop`/`production` reconciliation onto `master`.
3. **Cutover plan** — Vercel/Render reconfig, Brewra-dev onboarding, old-repo archival. Gated on Plan 05 completion.

**Recovery path if anything went wrong during Plan 02 execution:**

- See spec's "Rollback hierarchy" section.
- Most extreme: `rm -rf /projects/Brewra/brewra-gtm-intelligence/`, delete the GitHub repo, and you're back to the pre-fork state. Old repos are untouched throughout.
- Tags `pre-monorepo-fork-<TODAY>` (on PWA + backend origins) anchor the fork moment for any later forensics.
