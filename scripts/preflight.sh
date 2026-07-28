#!/usr/bin/env bash
# Phase 1 preflight script. Spec 15 §2.7 / Spec 16 §3 Step 7.
# Pre-merge quality gate: runs all wired checks with section headers + total
# wall time. The controller agent runs this from frontend/ immediately before
# the user-approved merge step. Green required for merge; red blocks the merge.
#
# Current chain (Phase 1): typecheck + build + Playwright + vitest + knip --strict
# Each later phase appends one more check to npm run preflight in package.json:
#   2a → strict-TS typecheck (same `tsc --noEmit` command, against strict config)
#   2b → + eslint . (currently red — 428 errors; 2b lands type-aware rules
#                    + Prettier and tightens/loosens config to be green) + prettier --check .
#   2c → + bundle-budget comparator
#
# Source of truth for the check list is the `preflight` npm script in
# frontend/package.json. This wrapper just calls `npm run preflight` with
# nicer output. To run without the wrapper: `npm run preflight`.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FRONTEND_DIR"

start_total=$(python3 -c 'import time; print(time.time())')

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " npm run preflight  (Phase 1 — Spec 16 §3 Step 7)"
echo "════════════════════════════════════════════════════════════════"
echo ""

npm run preflight

end_total=$(python3 -c 'import time; print(time.time())')
elapsed=$(python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.1f}')" "$end_total" "$start_total")

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " preflight green — ${elapsed}s total"
echo "════════════════════════════════════════════════════════════════"
echo ""
