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
