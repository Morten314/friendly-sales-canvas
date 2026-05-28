#!/usr/bin/env tsx
/**
 * build-strict-probe.ts — Phase 2a strict-TS probe helper.
 *
 * Creates a throwaway tsconfig.strict-probe.json that extends tsconfig.app.json
 * with the five Phase 2a strict-mode flags forced to true, runs tsc --noEmit
 * against it, parses the diagnostic output, and writes two artifacts:
 *   - docs/audits/<date>-frontend-phase-2a-strict-probe.json (machine-readable)
 *   - docs/audits/<date>-frontend-phase-2a-strict-probe.txt  (raw tsc output)
 *
 * The throwaway probe config is deleted before exit; it never enters the
 * working tree's tracked state. Re-runnable: subsequent invocations overwrite
 * both artifacts.
 *
 * Usage (run from frontend/):
 *   npx tsx scripts/build-strict-probe.ts [--date YYYY-MM-DD]
 *
 * If --date is omitted, defaults to today's UTC date.
 *
 * Spec 17 §3 Step 0. Open question §6.6 — implemented as a sibling script.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const REPO_DIR = resolve(FRONTEND_DIR, "..");

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseArgs(): { date: string } {
  const args = process.argv.slice(2);
  let date = todayUtc();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && i + 1 < args.length) {
      date = args[i + 1];
      i++;
    }
  }
  return { date };
}

interface Diagnostic {
  file: string;
  line: number;
  col: number;
  code: string; // e.g. "TS6133"
  message: string;
}

function parseDiagnostics(raw: string): Diagnostic[] {
  // Format: <file>(<line>,<col>): error TS<code>: <message>
  const re = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;
  const out: Diagnostic[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = re.exec(line);
    if (!m) continue;
    out.push({
      file: m[1].replace(/\\/g, "/"),
      line: parseInt(m[2], 10),
      col: parseInt(m[3], 10),
      code: m[4],
      message: m[5],
    });
  }
  return out;
}

function classifyArea(file: string): string {
  // file is relative to frontend/ (e.g. "src/components/market-research/Foo.tsx")
  const m = file.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "other";
  const top = m[1];
  const sub = m[2];
  if (top === "pages") return "pages";
  if (top === "lib") return "lib";
  if (top === "hooks") return "hooks";
  if (top === "utils") return "utils";
  if (top === "services") return "services";
  if (top === "contexts") return "contexts";
  if (top === "components") {
    if (!sub || /\.[jt]sx?$/.test(sub)) return "components (loose)";
    return `components/${sub}`;
  }
  return top;
}

function main(): void {
  const { date } = parseArgs();
  const probePath = resolve(FRONTEND_DIR, "tsconfig.strict-probe.json");
  const jsonOut = resolve(
    REPO_DIR,
    "docs",
    "audits",
    `${date}-frontend-phase-2a-strict-probe.json`,
  );
  const txtOut = resolve(REPO_DIR, "docs", "audits", `${date}-frontend-phase-2a-strict-probe.txt`);

  // 1) Write the throwaway probe config.
  // noImplicitAny is set explicitly even though strict:true enables it umbrellally,
  // because tsconfig.app.json's own explicit noImplicitAny:<value> would otherwise
  // win over the strict umbrella per TS option precedence — which made the
  // pre-Step-1b probe under-count TS7006.
  const probeConfig = {
    extends: "./tsconfig.app.json",
    compilerOptions: {
      strict: true,
      noImplicitAny: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
  };
  writeFileSync(probePath, JSON.stringify(probeConfig, null, 2) + "\n", "utf-8");

  // 2) Run tsc --noEmit -p tsconfig.strict-probe.json. Non-zero exit is the
  //    expected case (errors present); we still want stdout.
  let raw = "";
  try {
    raw = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "tsc"),
      ["--noEmit", "-p", "tsconfig.strict-probe.json"],
      { cwd: FRONTEND_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    raw = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 3) Delete the throwaway config before doing anything else (so even a parse
  //    failure below doesn't leak it into the working tree).
  rmSync(probePath, { force: true });

  // 4) Write raw output.
  mkdirSync(dirname(txtOut), { recursive: true });
  writeFileSync(txtOut, raw, "utf-8");

  // 5) Parse + classify.
  const diags = parseDiagnostics(raw);

  const errorsByFile: Record<string, number> = {};
  const errorsByArea: Record<string, number> = {};
  const errorsByCode: Record<string, number> = {};
  const detailsByFile: Record<string, Diagnostic[]> = {};

  for (const d of diags) {
    errorsByFile[d.file] = (errorsByFile[d.file] ?? 0) + 1;
    const area = classifyArea(d.file);
    errorsByArea[area] = (errorsByArea[area] ?? 0) + 1;
    errorsByCode[d.code] = (errorsByCode[d.code] ?? 0) + 1;
    (detailsByFile[d.file] ??= []).push(d);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    date,
    totalErrors: diags.length,
    errorsByCode,
    errorsByArea,
    errorsByFile,
    detailsByFile,
  };

  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n", "utf-8");

  // 6) Console summary.
  console.log(`Total errors: ${diags.length}`);
  console.log("By code:", errorsByCode);
  console.log("By area:", errorsByArea);
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${txtOut}`);
}

main();
