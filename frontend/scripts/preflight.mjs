// frontend/scripts/preflight.mjs
//
// Dependency-aware PARALLEL preflight runner — replaces the serial `&&` chain.
//
// Independent checks run concurrently (bounded by PREFLIGHT_JOBS); `bundle` and
// `e2e` wait for `build`; `build` is prioritised because build -> e2e is the
// longest path. Per-task stdout/stderr is buffered and the FAILING task's tail is
// printed at the end, so a parallel failure stays legible (no interleaved soup).
//
// Fail-fast (default): the first failing task aborts the run — remaining tasks are
// cancelled so you get the verdict immediately instead of waiting for the slowest
// task (e.g. a typo failing typecheck at 20s shouldn't wait ~minutes for vitest).
// Set PREFLIGHT_FAIL_FAST=0 to let every task finish and surface ALL failures.
//
// Usage:
//   node scripts/preflight.mjs            # full merge gate (all 8 checks)
//   node scripts/preflight.mjs verify     # fast inner-loop subset (typecheck+lint+change-scoped tests)
//
// Env:
//   PREFLIGHT_JOBS=<n>      max concurrent tasks. Default leaves headroom so a second
//                           worktree's preflight can run on the same box without
//                           oversubscribing (vitest already caps its own workers at 4).
//   PREFLIGHT_MAX_HEAVY=<n> max concurrent HEAVY phases (build/test/e2e) in this
//                           runner. Default 1 — on the memory-bound box, stacking
//                           two heavy phases is what tips into swap + the flake.
//                           Raise on a dedicated high-RAM box.
//   PREFLIGHT_FAIL_FAST=0   run every task to completion (report all failures).

import { spawn } from "node:child_process";
import os from "node:os";

const profile = process.argv[2] ?? "full";

// Task graph. `script` is the npm script name (defaults to the task name); `deps`
// gates start order.
const ALL = {
  typecheck: { deps: [] },
  lint: { deps: [] },
  format: { deps: [], script: "format:check" },
  test: { deps: [], heavy: true },
  testChanged: { deps: [], script: "test:changed" },
  build: { deps: [], heavy: true },
  bundle: { deps: ["build"], script: "bundle:check" },
  e2e: { deps: ["build"], script: "test:e2e", heavy: true },
  knip: { deps: [] },
};

const PROFILES = {
  full: ["typecheck", "lint", "format", "test", "build", "bundle", "e2e", "knip"],
  verify: ["typecheck", "lint", "testChanged"],
};

const selected = PROFILES[profile];
if (!selected) {
  console.error(`Unknown profile "${profile}". Use one of: ${Object.keys(PROFILES).join(", ")}`);
  process.exit(2);
}

const JOBS =
  Number(process.env.PREFLIGHT_JOBS) || Math.max(2, Math.min(4, Math.floor(os.cpus().length / 4)));
const FAIL_FAST = process.env.PREFLIGHT_FAIL_FAST !== "0";
// R5 (2026-06-03 test-infra speedup): cap concurrently-running HEAVY phases
// (build/test/e2e) within this runner. On the memory-bound box, stacking two
// heavy phases (each multi-hundred-MB + Chromium/jsdom workers) is what tips
// into swap and the waitFor-timeout flake; light checks still fill JOBS freely.
const MAX_HEAVY = Math.max(1, Number(process.env.PREFLIGHT_MAX_HEAVY) || 1);

// Build the live task set (selected tasks + only their in-set deps).
const tasks = new Map();
for (const name of selected) {
  const def = ALL[name];
  tasks.set(name, {
    name,
    script: def.script ?? name,
    deps: def.deps.filter((d) => selected.includes(d)),
    heavy: def.heavy ?? false,
    status: "pending", // pending -> running -> done | skipped | cancelled
    code: null,
    ms: 0,
    out: "",
    child: null,
  });
}

// Priority = number of in-set tasks that depend on me (transitively). Higher first,
// so `build` launches before leaf checks and never starves the critical path.
const priority = (name) => {
  let n = 0;
  for (const t of tasks.values()) if (t.deps.includes(name)) n += 1 + priority(t.name);
  return n;
};

const t0 = Date.now();
const running = new Set();
let aborting = false;
let finished = false;

const depsOf = (t) => t.deps.map((d) => tasks.get(d));
const ready = (t) =>
  t.status === "pending" && depsOf(t).every((d) => d.status === "done" && d.code === 0);
const blocked = (t) =>
  t.status === "pending" && depsOf(t).some((d) => d.status === "done" && d.code !== 0);

// Kill a child's whole process group (npm + its tsc/eslint/vitest/playwright
// grandchildren). `detached: true` makes the child a group leader, so a negative
// pid signals the group. SIGKILL fallback for workers that ignore SIGTERM mid-run
// (vitest under load). The close events that follow drive the run to finish().
function killGroup(child) {
  if (!child) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* group already gone */
  }
  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }, 3000);
}

function abort() {
  if (aborting) return;
  aborting = true;
  for (const t of running) {
    t.cancelled = true;
    killGroup(t.child);
  }
}

function launch(t) {
  t.status = "running";
  running.add(t);
  const start = Date.now();
  process.stdout.write(`▶ ${t.name}\n`);
  // detached: each task leads its own process group, so abort() can kill the whole
  // group (npm + its tsc/eslint/vitest/playwright children), not just the npm shell.
  const child = spawn("npm", ["run", t.script], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
  });
  t.child = child;
  child.stdout.on("data", (d) => (t.out += d));
  child.stderr.on("data", (d) => (t.out += d));
  const done = (code) => {
    if (t.status !== "running") return;
    running.delete(t);
    t.ms = Date.now() - start;
    if (t.cancelled) {
      t.status = "cancelled";
    } else {
      t.status = "done";
      t.code = code;
      process.stdout.write(`${code === 0 ? "✓" : "✗"} ${t.name} (${(t.ms / 1000).toFixed(1)}s)\n`);
      if (code !== 0 && FAIL_FAST) abort();
    }
    schedule();
  };
  child.on("close", done);
  child.on("error", (err) => {
    t.out += `\nfailed to spawn: ${err.message}\n`;
    done(1);
  });
}

function schedule() {
  for (const t of tasks.values()) if (blocked(t)) t.status = "skipped";

  if (!aborting) {
    const queue = [...tasks.values()]
      .filter(ready)
      .sort((a, b) => priority(b.name) - priority(a.name));
    const heavyRunning = () => [...running].filter((t) => t.heavy).length;
    for (const t of queue) {
      if (running.size >= JOBS) break;
      // R5: defer a heavy phase if the heavy budget is full; keep scanning so
      // light checks behind it still launch (don't `break`).
      if (t.heavy && heavyRunning() >= MAX_HEAVY) continue;
      launch(t);
    }
  }

  const remaining = [...tasks.values()].some(
    (t) => t.status === "pending" || t.status === "running",
  );
  if (!remaining || (aborting && running.size === 0)) finish();
}

function finish() {
  if (finished) return;
  finished = true;
  const total = ((Date.now() - t0) / 1000).toFixed(1);

  // Dump the output of any genuinely-failed task so the cause is visible.
  for (const name of selected) {
    const t = tasks.get(name);
    if (t.status === "done" && t.code !== 0) {
      process.stdout.write(
        `\n${"─".repeat(20)} ${t.name} output (exit ${t.code}) ${"─".repeat(20)}\n`,
      );
      process.stdout.write(t.out.split("\n").slice(-50).join("\n").trimEnd() + "\n");
    }
  }

  process.stdout.write(
    `\n${"─".repeat(52)}\npreflight (${profile}) — ${total}s wall, ${JOBS} jobs${FAIL_FAST ? "" : ", no-fail-fast"}\n`,
  );
  let ok = true;
  for (const name of selected) {
    const t = tasks.get(name);
    let mark;
    let detail;
    if (t.status === "done" && t.code === 0) {
      mark = "✓";
      detail = `${(t.ms / 1000).toFixed(1)}s`;
    } else if (t.status === "done") {
      mark = "✗";
      detail = `${(t.ms / 1000).toFixed(1)}s`;
      ok = false;
    } else if (t.status === "skipped") {
      mark = "∅";
      detail = "skipped (build failed)";
      ok = false;
    } else {
      mark = "⊘";
      detail = aborting ? "cancelled (fail-fast)" : "not run";
      ok = false;
    }
    process.stdout.write(`  ${mark} ${name.padEnd(10)} ${detail}\n`);
  }
  process.stdout.write(`${ok ? "✓ PASS" : "✗ FAIL"}\n`);
  process.exit(ok ? 0 : 1);
}

schedule();
