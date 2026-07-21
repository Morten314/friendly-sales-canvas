#!/usr/bin/env node
// scripts/with-slot.mjs — R1 (2026-06-03 frontend test-infra speedup)
//
// Cross-worktree, memory-aware semaphore for the HEAVY preflight phases
// (build / vitest / playwright). The box is memory-bound (~7.7GB) but has many
// cores; the team protocol allows ~3 concurrent worktree preflights. The real
// cost is not any single gate — it is several worktrees hitting a heavy phase
// at the SAME wall-clock moment, oversubscribing RAM, swapping, and tipping the
// jsdom `waitFor` tests over their 5s timeout (false-red → re-run). A
// per-process worker cap (already shipped for vitest) can't see across
// processes; this is the GLOBAL analog.
//
// Mechanism: N numbered slots as exclusive-create lock files in a shared dir.
// A heavy phase acquires a free slot before running and releases it after.
// When all slots are held it BLOCKS (polls) rather than failing. It is
// fail-open: if it can't acquire within the timeout it runs anyway (a gate that
// hangs is worse than one that briefly oversubscribes).
//
// Wiring: heavy npm scripts route through it, e.g.
//   "build": "node scripts/with-slot.mjs vite build"
// Solo runs acquire a free slot instantly (~ms overhead), so this is invisible
// when nothing else is running.
//
// When a run had to WAIT for a slot it exports PREFLIGHT_CONTENDED=1 to the
// child, which playwright.config.ts reads to downshift Chromium workers (R4).
//
// Coordinates whatever shares the lock dir's filesystem (i.e. all git worktrees
// of this repo, by default). For truly separate containers/sandboxes that share
// a mount, point PREFLIGHT_LOCK_DIR at that shared path. Cross-container PID
// liveness checks only make sense within one PID namespace — but separate
// containers don't share a filesystem anyway, so the default scope is correct.
//
// Env:
//   PREFLIGHT_SLOTS=<n>            global concurrent heavy phases. Default 2.
//   PREFLIGHT_LOCK_DIR=<path>      override the shared lock dir.
//   PREFLIGHT_ACQUIRE_TIMEOUT_MS   wait cap before fail-open. Default 1200000 (20m).
//   PREFLIGHT_DISABLE_SLOTS=1      bypass entirely (run the command directly).

import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const cmd = process.argv.slice(2);
if (cmd.length === 0) {
  console.error("with-slot: no command given");
  process.exit(2);
}

// Escape hatch: run the command directly with no semaphore.
if (process.env.PREFLIGHT_DISABLE_SLOTS === "1") {
  runAndExit(false);
}

const SLOTS = Math.max(1, Number(process.env.PREFLIGHT_SLOTS) || 2);
const ACQUIRE_TIMEOUT_MS = Number(process.env.PREFLIGHT_ACQUIRE_TIMEOUT_MS) || 20 * 60 * 1000;
const POLL_MS = 500;

function lockDir() {
  if (process.env.PREFLIGHT_LOCK_DIR) return process.env.PREFLIGHT_LOCK_DIR;
  try {
    // git-common-dir is the SHARED .git for all worktrees of this repo. Putting
    // the lock dir INSIDE it keeps locks shared across every worktree while
    // never showing up in any worktree's `git status` (and needs no .gitignore).
    const common = execSync("git rev-parse --git-common-dir", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return join(resolve(common), "preflight-locks");
  } catch {
    return join(process.cwd(), ".preflight-locks");
  }
}

const DIR = lockDir();
mkdirSync(DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but isn't ours — still alive.
    return e.code === "EPERM";
  }
}

// Reap a slot whose owner is gone. PID-liveness is the primary signal (no
// heartbeat needed — a live owner is never reaped regardless of how long its
// phase runs). The 5s age guard avoids racing a half-written lock.
function reapIfDead(slotPath) {
  try {
    const raw = readFileSync(slotPath, "utf8");
    const pid = Number(raw.split("\n")[0]);
    if (pid && pidAlive(pid)) return false;
    const age = Date.now() - statSync(slotPath).mtimeMs;
    if (!pid || age > 5000) {
      rmSync(slotPath, { force: true });
      return true;
    }
  } catch {
    /* already gone */
  }
  return false;
}

function tryAcquire() {
  for (let i = 0; i < SLOTS; i++) {
    const slotPath = join(DIR, `slot-${i}.lock`);
    try {
      // 'wx' = exclusive create: fails if the slot is taken → race-safe; the
      // single winner of slot i holds it.
      writeFileSync(slotPath, `${process.pid}\n${cmd.join(" ")}\n${new Date().toISOString()}\n`, {
        flag: "wx",
      });
      return slotPath;
    } catch {
      reapIfDead(slotPath); // if its owner died, free it for the next poll
    }
  }
  return null;
}

let held = null;
function release() {
  if (held) {
    try {
      rmSync(held, { force: true });
    } catch {
      /* gone */
    }
    held = null;
  }
}

const start = Date.now();
let waited = false;
held = tryAcquire();
while (!held) {
  waited = true;
  if (Date.now() - start > ACQUIRE_TIMEOUT_MS) {
    console.error(
      `with-slot: could not acquire a slot within ${Math.round(
        ACQUIRE_TIMEOUT_MS / 1000,
      )}s — running anyway (fail-open).`,
    );
    break;
  }
  await sleep(POLL_MS);
  held = tryAcquire();
}

runAndExit(waited);

function runAndExit(contended) {
  const env = { ...process.env };
  if (contended) env.PREFLIGHT_CONTENDED = "1";

  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });

  const child = spawn(cmd.join(" "), { stdio: "inherit", shell: true, env });
  child.on("exit", (code, signal) => {
    release();
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });
  child.on("error", (err) => {
    console.error(`with-slot: failed to spawn "${cmd.join(" ")}": ${err.message}`);
    release();
    process.exit(1);
  });
}
