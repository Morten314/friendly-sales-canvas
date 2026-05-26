#!/usr/bin/env bash
# Phase 0a NFR baseline capture. Spec 15 §2.4.
# 3-run median for: tsc --noEmit, vite build, vite dev cold start, playwright full suite.
# Runtime: 10-20 minutes on typical dev hardware. Local-only, not CI.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$FRONTEND_DIR/../docs/audits/2026-05-26-frontend-nfr-baseline.json"
RUNS=3

cd "$FRONTEND_DIR"

# ---------- helpers ----------

# median min max <list-of-floats>
median_min_max() {
  python3 -c "
import statistics, sys
vals = sorted(float(x) for x in sys.argv[1:])
print(f'{statistics.median(vals):.3f} {vals[0]:.3f} {vals[-1]:.3f}')
" "$@"
}

# wall-clock seconds for a command
time_cmd() {
  local start end
  start=$(python3 -c 'import time; print(time.time())')
  "$@" > /dev/null 2>&1
  end=$(python3 -c 'import time; print(time.time())')
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

# wall-clock from start until log file contains "ready in", with a 60s timeout
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

# ---------- measurements ----------

echo "[1/4] tsc --noEmit ($RUNS runs, no cache to clear)" >&2
tsc_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npx tsc --noEmit)
  echo "  run $i: ${t}s" >&2
  tsc_times+=("$t")
done

echo "[2/4] vite build ($RUNS runs, cold each run)" >&2
build_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf dist node_modules/.vite
  t=$(time_cmd npm run build)
  echo "  run $i: ${t}s" >&2
  build_times+=("$t")
done

echo "[3/4] vite dev cold start ($RUNS runs)" >&2
dev_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf node_modules/.vite
  t=$(time_dev_start)
  echo "  run $i: ${t}s" >&2
  dev_times+=("$t")
done

echo "[4/4] playwright full suite ($RUNS runs)" >&2
playwright_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test:e2e)
  echo "  run $i: ${t}s" >&2
  playwright_times+=("$t")
done

# ---------- compose JSON ----------

read tsc_med tsc_min tsc_max < <(median_min_max "${tsc_times[@]}")
read build_med build_min build_max < <(median_min_max "${build_times[@]}")
read dev_med dev_min dev_max < <(median_min_max "${dev_times[@]}")
read pw_med pw_min pw_max < <(median_min_max "${playwright_times[@]}")

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

mkdir -p "$(dirname "$OUTPUT_FILE")"
cat > "$OUTPUT_FILE" <<JSON
{
  "captured_at": "$CAPTURED_AT",
  "captured_on": "local-dev-machine",
  "hardware": {
    "os": "$OS_NAME",
    "cpu_model": "$CPU_MODEL",
    "ram_gb": $RAM_GB,
    "node_version": "$NODE_VER",
    "npm_version": "$NPM_VER"
  },
  "tsc_noemit_seconds":          { "median": $tsc_med,   "min": $tsc_min,   "max": $tsc_max },
  "vite_build_seconds":          { "median": $build_med, "min": $build_min, "max": $build_max },
  "vite_dev_start_seconds":      { "median": $dev_med,   "min": $dev_min,   "max": $dev_max },
  "playwright_full_suite_seconds": { "median": $pw_med,    "min": $pw_min,    "max": $pw_max }
}
JSON

echo "" >&2
echo "Wrote $OUTPUT_FILE" >&2
