#!/usr/bin/env bash
# verify.sh — re-hash current state and diff against the snapshot in ./snapshots/
#
# Usage:
#   ./verify.sh [source|build|openapi|deps|all]   (default: all)
#
# Override paths via env vars after the refactor moves things around:
#   BACKEND_DIR=...      FRONTEND_DEV_DIR=...     FRONTEND_PROD_DIR=...
#   PWA_REPO_DIR=...     OPENAPI_URL=...
#
# Exits non-zero if any category shows a diff.

set -uo pipefail

# Defaults assume invocation from the monorepo root: /projects/Brewra/brewra-gtm-intelligence/
# Overridable via env vars if running from elsewhere or pointing at old repos.
BACKEND_DIR="${BACKEND_DIR:-/projects/Brewra/brewra-gtm-intelligence/backend}"
FRONTEND_DEV_DIR="${FRONTEND_DEV_DIR:-/projects/Brewra/brewra-gtm-intelligence/frontend}"
FRONTEND_PROD_DIR="${FRONTEND_PROD_DIR:-/projects/Brewra/brewra-gtm-intelligence/frontend}"
OPENAPI_URL="${OPENAPI_URL:-https://backend-11kr.onrender.com/openapi.json}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SNAP="$SCRIPT_DIR/snapshots"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAIL=0
mark_fail() { FAIL=1; }

cmp_manifest() {
  local label="$1" snap="$2" current="$3"
  if diff -q "$snap" "$current" > /dev/null 2>&1; then
    echo "  OK    $label"
  else
    echo "  DIFF  $label"
    diff "$snap" "$current" | head -30 | sed 's/^/        /'
    mark_fail
  fi
}

verify_source() {
  echo "=== source manifests ==="
  if [ -d "$BACKEND_DIR/.git" ]; then
    (cd "$BACKEND_DIR" && git ls-files -z | xargs -0 sha256sum | sort -k 2) > "$TMP/backend-source.sha256"
    cmp_manifest "backend-source" "$SNAP/backend-source.sha256" "$TMP/backend-source.sha256"
  else
    echo "  SKIP  backend-source ($BACKEND_DIR is not a git repo)"
  fi
  if [ -d "$FRONTEND_DEV_DIR" ]; then
    (cd "$FRONTEND_DEV_DIR" && git ls-files -z | xargs -0 sha256sum | sort -k 2) > "$TMP/frontend-dev-source.sha256"
    cmp_manifest "frontend-dev-source" "$SNAP/frontend-dev-source.sha256" "$TMP/frontend-dev-source.sha256"
  else
    echo "  SKIP  frontend-dev-source ($FRONTEND_DEV_DIR missing — expected after folder→branch refactor)"
  fi
  if [ -d "$FRONTEND_PROD_DIR" ]; then
    (cd "$FRONTEND_PROD_DIR" && git ls-files -z | xargs -0 sha256sum | sort -k 2) > "$TMP/frontend-prod-source.sha256"
    cmp_manifest "frontend-prod-source" "$SNAP/frontend-prod-source.sha256" "$TMP/frontend-prod-source.sha256"
  else
    echo "  SKIP  frontend-prod-source ($FRONTEND_PROD_DIR missing — expected after folder→branch refactor)"
  fi
}

verify_build() {
  echo "=== build manifests ==="
  for label in dev prod; do
    var="FRONTEND_${label^^}_DIR"
    dir="${!var}"
    if [ ! -d "$dir/dist" ]; then
      echo "  SKIP  frontend-$label-build (no dist/ at $dir — run 'npm run build' first)"
      continue
    fi
    (cd "$dir" && find dist -type f -print0 | xargs -0 sha256sum | sort -k 2) > "$TMP/frontend-$label-build.sha256"
    cmp_manifest "frontend-$label-build" "$SNAP/frontend-$label-build.sha256" "$TMP/frontend-$label-build.sha256"
  done
}

verify_openapi() {
  echo "=== openapi schema ==="
  if ! curl -fsS --max-time 30 "$OPENAPI_URL" -o "$TMP/openapi.json" 2>/dev/null; then
    echo "  SKIP  openapi (fetch failed: $OPENAPI_URL — backend may be sleeping on free Render tier)"
    return
  fi
  if python3 -c "import json,sys; a=json.load(open('$SNAP/backend-openapi.json')); b=json.load(open('$TMP/openapi.json')); sys.exit(0 if a==b else 1)" 2>/dev/null; then
    echo "  OK    openapi (byte-identical)"
  else
    echo "  DIFF  openapi — paths/schemas changed:"
    python3 - <<PY | sed 's/^/        /'
import json
a = json.load(open('$SNAP/backend-openapi.json'))
b = json.load(open('$TMP/openapi.json'))
ap = set(a.get('paths', {}).keys())
bp = set(b.get('paths', {}).keys())
ac = set((a.get('components', {}) or {}).get('schemas', {}).keys())
bc = set((b.get('components', {}) or {}).get('schemas', {}).keys())
print('paths added:  ', sorted(bp - ap))
print('paths removed:', sorted(ap - bp))
print('schemas added:  ', sorted(bc - ac))
print('schemas removed:', sorted(ac - bc))
PY
    mark_fail
  fi
}

verify_deps() {
  echo "=== dependency manifests ==="
  {
    if [ -d "$FRONTEND_DEV_DIR" ]; then
      cd "$FRONTEND_DEV_DIR"
      for f in package.json package-lock.json bun.lockb; do
        [ -f "$f" ] && printf 'fe-dev/%s  %s\n' "$f" "$(sha256sum < "$f" | awk '{print $1}')"
      done
    fi
    if [ -d "$FRONTEND_PROD_DIR" ]; then
      cd "$FRONTEND_PROD_DIR"
      for f in package.json package-lock.json bun.lockb; do
        [ -f "$f" ] && printf 'fe-prod/%s  %s\n' "$f" "$(sha256sum < "$f" | awk '{print $1}')"
      done
    fi
    if [ -d "$BACKEND_DIR" ]; then
      cd "$BACKEND_DIR"
      for f in requirements.txt; do
        [ -f "$f" ] && printf 'backend/%s  %s\n' "$f" "$(sha256sum < "$f" | awk '{print $1}')"
      done
    fi
  } > "$TMP/deps.sha256"
  cmp_manifest "dependency-manifests" "$SNAP/dependency-manifests.sha256" "$TMP/deps.sha256"
}

cmd="${1:-all}"
case "$cmd" in
  source)  verify_source ;;
  build)   verify_build ;;
  openapi) verify_openapi ;;
  deps)    verify_deps ;;
  all)     verify_source; verify_build; verify_openapi; verify_deps ;;
  *)       echo "usage: $0 {source|build|openapi|deps|all}"; exit 2 ;;
esac

echo
if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: all checked categories match snapshot"
  exit 0
else
  echo "RESULT: at least one category diverged from snapshot — review above"
  exit 1
fi
