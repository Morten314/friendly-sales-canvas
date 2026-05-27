#!/usr/bin/env bash
# Phase 0 NFR baseline capture. Spec 15 §2.4 (0a) + §3.6 (0b).
# 3-run median for: tsc --noEmit, vite build, vite dev cold start,
# playwright full suite, vitest full suite (added at 0b).
# Runtime: 12-25 minutes on typical dev hardware (0a was 10-20; +2-5 for vitest).
# Local-only, not CI.
#
# The output JSON has TWO layers:
#   - Top-level fields preserved from the 0a anchor (DO NOT overwrite).
#   - "after_phase_0b" sibling key with re-measured values plus the new
#     vitest_full_suite_seconds field. Spec §3.6.
#
# Re-running this script overwrites only the after_phase_0b key. The original
# anchor is read from the existing JSON if present.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$FRONTEND_DIR/../docs/audits/2026-05-26-frontend-nfr-baseline.json"
RUNS=3

cd "$FRONTEND_DIR"

# ---------- helpers ----------

median_min_max() {
  python3 -c "
import statistics, sys
vals = sorted(float(x) for x in sys.argv[1:])
print(f'{statistics.median(vals):.3f} {vals[0]:.3f} {vals[-1]:.3f}')
" "$@"
}

time_cmd() {
  local start end
  start=$(python3 -c 'import time; print(time.time())')
  "$@" > /dev/null 2>&1
  end=$(python3 -c 'import time; print(time.time())')
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

time_dev_start() {
  local logfile="/tmp/phase-0a-vite-dev.$$.log"
  local start end vite_pid elapsed
  local timeout_seconds=60
  start=$(python3 -c 'import time; print(time.time())')
  npx vite --port 5173 > "$logfile" 2>&1 &
  vite_pid=$!
  while ! grep -q "ready in" "$logfile" 2>/dev/null; do
    if ! kill -0 "$vite_pid" 2>/dev/null; then
      cat "$logfile" >&2
      rm -f "$logfile"
      echo "vite exited before ready" >&2
      exit 1
    fi
    elapsed=$(python3 -c "import sys, time; print(time.time() - float(sys.argv[1]))" "$start")
    if python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) > float(sys.argv[2]) else 1)" "$elapsed" "$timeout_seconds"; then
      cat "$logfile" >&2
      kill "$vite_pid" 2>/dev/null || true
      wait "$vite_pid" 2>/dev/null || true
      rm -f "$logfile"
      echo "vite did not become ready within ${timeout_seconds}s" >&2
      exit 1
    fi
    sleep 0.05
  done
  end=$(python3 -c 'import time; print(time.time())')
  kill "$vite_pid" 2>/dev/null || true
  wait "$vite_pid" 2>/dev/null || true
  rm -f "$logfile"
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

# ---------- pre-flight integrity check ----------
# Fail fast if the existing NFR JSON is malformed — otherwise we'd run all 5
# measurements (12-25 minutes) only to crash at the final json.load(). Missing
# file is fine (Phase 0a anchor will simply not exist on a fresh tree).

if [[ -f "$OUTPUT_FILE" ]]; then
  if ! python3 -c "import json; json.load(open('$OUTPUT_FILE'))" 2>/dev/null; then
    echo "ERROR: $OUTPUT_FILE exists but is not valid JSON." >&2
    echo "       Fix or remove the file before re-running this script —" >&2
    echo "       otherwise all $RUNS-run measurements would be discarded at write time." >&2
    exit 1
  fi
  echo "Pre-flight: existing NFR JSON parses cleanly." >&2
else
  echo "Pre-flight: no existing NFR JSON (will write fresh)." >&2
fi

# ---------- measurements ----------

echo "[1/5] tsc --noEmit ($RUNS runs, no cache to clear)" >&2
tsc_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npx tsc --noEmit)
  echo "  run $i: ${t}s" >&2
  tsc_times+=("$t")
done

echo "[2/5] vite build ($RUNS runs, cold each run)" >&2
build_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf dist node_modules/.vite
  t=$(time_cmd npm run build)
  echo "  run $i: ${t}s" >&2
  build_times+=("$t")
done

echo "[3/5] vite dev cold start ($RUNS runs)" >&2
dev_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf node_modules/.vite
  t=$(time_dev_start)
  echo "  run $i: ${t}s" >&2
  dev_times+=("$t")
done

echo "[4/5] playwright full suite ($RUNS runs)" >&2
playwright_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test:e2e)
  echo "  run $i: ${t}s" >&2
  playwright_times+=("$t")
done

echo "[5/5] vitest full suite ($RUNS runs, no persistent cache to clear)" >&2
vitest_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test)
  echo "  run $i: ${t}s" >&2
  vitest_times+=("$t")
done

# ---------- compose JSON ----------

read tsc_med tsc_min tsc_max < <(median_min_max "${tsc_times[@]}")
read build_med build_min build_max < <(median_min_max "${build_times[@]}")
read dev_med dev_min dev_max < <(median_min_max "${dev_times[@]}")
read pw_med pw_min pw_max < <(median_min_max "${playwright_times[@]}")
read vt_med vt_min vt_max < <(median_min_max "${vitest_times[@]}")

# Hardware metadata
OS_NAME="$(uname -srm)"
if [[ "$(uname)" == "Darwin" ]]; then
  CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'unknown')"
  RAM_GB="$(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))"
else
  CPU_MODEL="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | sed 's/.*: //' || uname -m)"
  RAM_GB="$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))"
fi
NODE_VER="$(node --version)"
NPM_VER="$(npm --version)"
CAPTURED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Read existing 0a anchor from disk (preserve verbatim) and merge in the
# after_phase_0b sibling. Python handles the JSON merge atomically.
mkdir -p "$(dirname "$OUTPUT_FILE")"
python3 - "$OUTPUT_FILE" "$CAPTURED_AT" "$OS_NAME" "$CPU_MODEL" "$RAM_GB" \
  "$NODE_VER" "$NPM_VER" \
  "$tsc_med" "$tsc_min" "$tsc_max" \
  "$build_med" "$build_min" "$build_max" \
  "$dev_med" "$dev_min" "$dev_max" \
  "$pw_med" "$pw_min" "$pw_max" \
  "$vt_med" "$vt_min" "$vt_max" <<'PYEOF'
import json, sys, os
(_, path, captured_at, os_name, cpu_model, ram_gb, node_ver, npm_ver,
 tsc_med, tsc_min, tsc_max,
 build_med, build_min, build_max,
 dev_med, dev_min, dev_max,
 pw_med, pw_min, pw_max,
 vt_med, vt_min, vt_max) = sys.argv

existing = {}
if os.path.exists(path):
    with open(path) as f:
        existing = json.load(f)

after_phase_0b = {
    "captured_at": captured_at,
    "captured_on": "local-dev-machine",
    "hardware": {
        "os": os_name,
        "cpu_model": cpu_model,
        "ram_gb": int(ram_gb),
        "node_version": node_ver,
        "npm_version": npm_ver,
    },
    "tsc_noemit_seconds":             {"median": float(tsc_med),   "min": float(tsc_min),   "max": float(tsc_max)},
    "vite_build_seconds":             {"median": float(build_med), "min": float(build_min), "max": float(build_max)},
    "vite_dev_start_seconds":         {"median": float(dev_med),   "min": float(dev_min),   "max": float(dev_max)},
    "playwright_full_suite_seconds":  {"median": float(pw_med),    "min": float(pw_min),    "max": float(pw_max)},
    "vitest_full_suite_seconds":      {"median": float(vt_med),    "min": float(vt_min),    "max": float(vt_max)},
}
existing["after_phase_0b"] = after_phase_0b

with open(path, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
PYEOF

echo "" >&2
echo "Wrote $OUTPUT_FILE (added after_phase_0b sibling key)" >&2
