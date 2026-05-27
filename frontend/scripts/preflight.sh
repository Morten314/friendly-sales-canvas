#!/usr/bin/env bash
# Phase 0a preflight script. Spec 15 §2.7.
# Pre-merge quality gate: runs all wired checks with section headers + total
# wall time. The controller agent runs this from frontend/ immediately before
# the user-approved merge step. Green required for merge; red blocks the merge.
#
# At 0a the chain is: typecheck + build + Playwright.
# Each later phase appends one more check to npm run preflight in package.json:
#   0b → + vitest
#   1  → + knip --strict (after Phase 1's dead-code cleanup; currently red — 32 unused files)
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
echo " npm run preflight  (Phase 0a — Spec 15 §2.7)"
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
