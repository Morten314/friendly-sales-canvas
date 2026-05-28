#!/usr/bin/env tsx
/**
 * build-lint-probe.ts — Phase 2b lint+prettier probe helper.
 *
 * Creates a throwaway eslint.probe.config.js that extends the current
 * eslint.config.js shape with the Phase 2b rule additions + override
 * zones, runs `eslint . --max-warnings 0 --format json|text` and
 * `prettier --check .`, captures four artifacts, then deletes the
 * throwaway config. Sibling to scripts/build-strict-probe.ts (Phase 2a).
 *
 * Artifacts:
 *   - docs/audits/<date>-frontend-phase-2b-lint-probe.json
 *   - docs/audits/<date>-frontend-phase-2b-lint-probe.txt
 *   - docs/audits/<date>-frontend-phase-2b-prettier-probe.txt
 *   - docs/audits/<date>-frontend-phase-2b-area-tree.txt
 *
 * Re-runnable: subsequent invocations overwrite all four artifacts.
 *
 * Usage (run from frontend/):
 *   npx tsx scripts/build-lint-probe.ts [--date YYYY-MM-DD] [--prefix LABEL]
 *
 * --prefix is used by inter-wave re-probes (e.g., --prefix post-wave-b for
 * Task 4.end's Wave-B-end re-probe).
 * If --date is omitted, defaults to today's UTC date.
 *
 * Spec 18 §4 Step 0 / Task 4.end / Task 5.end. (Wave A end-of-wave does
 * not run a committed re-probe — post-Wave-A re-probing is optional
 * local-only sanity, per synthesis-2 M1.)
 */

import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const REPO_DIR = resolve(FRONTEND_DIR, "..");

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseArgs(): { date: string; prefix: string } {
  const args = process.argv.slice(2);
  let date = todayUtc();
  let prefix = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && i + 1 < args.length) {
      date = args[i + 1];
      i++;
    } else if (args[i] === "--prefix" && i + 1 < args.length) {
      prefix = args[i + 1] + "-";
      i++;
    }
  }
  return { date, prefix };
}

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
}

function classifyArea(absPath: string): string {
  const rel = absPath.replace(FRONTEND_DIR + "/", "").replace(/\\/g, "/");
  // Match top-level + first sub-folder
  if (rel.startsWith("src/")) {
    const m = rel.match(/^src\/([^/]+)(?:\/([^/]+))?/);
    if (!m) return "src (loose)";
    const top = m[1];
    const sub = m[2];
    if (top === "pages") return "pages";
    if (top === "lib") return "lib";
    if (top === "hooks") return "hooks";
    if (top === "utils") return "utils";
    if (top === "services") return "services";
    if (top === "contexts") return "contexts";
    if (top === "styles") return "styles";
    if (top === "components") {
      if (!sub) return "components (loose)";
      return `components/${sub}`;
    }
    // Fallback: return raw top-level dir name (e.g., src/types, src/constants).
    // Probe is informational, not gate-enforcing, so an unknown sub-tree is fine.
    return top;
  }
  if (rel.startsWith("e2e/")) return "e2e";
  if (rel.startsWith("scripts/")) return "scripts";
  if (rel.match(/^(vite|tailwind|postcss|playwright)\.config\.(ts|js)$/)) {
    return "root-config";
  }
  return "other";
}

function writeProbeConfig(probePath: string): void {
  // The probe extends the production-state Step 1 config shape. We write
  // it inline rather than dynamically extending eslint.config.js because
  // the probe runs BEFORE Step 1 has edited that file.
  const content = `// Throwaway probe config — deleted by build-lint-probe.ts before exit.
// Mirrors the Step 1 production config shape so the probe surface
// matches what Step 1 will land.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "coverage", "playwright-report"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "import-x/order": ["error", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      }],
    },
  },
  // Override zones (Spec 18 §3.3)
  { files: ["src/components/ui/**"], rules: {
    "react-refresh/only-export-components": "off",
  } },
  { files: ["tailwind.config.ts", "postcss.config.js", "vite.config.ts"], rules: {
    "@typescript-eslint/no-require-imports": "off",
  } },
  { files: ["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"], rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-floating-promises": "off",
  } },
  // eslint-config-prettier must come LAST
  eslintConfigPrettier
);
`;
  writeFileSync(probePath, content, "utf-8");
}

function main(): void {
  const { date, prefix } = parseArgs();
  const probePath = resolve(FRONTEND_DIR, "eslint.probe.config.js");
  const auditDir = resolve(REPO_DIR, "docs", "audits");
  mkdirSync(auditDir, { recursive: true });

  const jsonOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-lint-probe.json`);
  const txtOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-lint-probe.txt`);
  const prettierOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-prettier-probe.txt`);
  const areaTreeOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-area-tree.txt`);

  // 1) Write the throwaway probe config.
  writeProbeConfig(probePath);

  // 2) Run eslint --format json. Non-zero exit is the expected case
  //    (violations present); we still want stdout.
  let rawJson = "";
  try {
    rawJson = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "eslint"),
      [".", "--config", "eslint.probe.config.js", "--format", "json"],
      {
        cwd: FRONTEND_DIR,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    rawJson = e.stdout ?? "";
    if (!rawJson) {
      // ESLint sometimes fails before producing JSON (e.g., config syntax error).
      // Surface stderr to the human runner.
      console.error("ESLint JSON probe produced no stdout. stderr:");
      console.error(e.stderr ?? "(no stderr)");
      throw err;
    }
  }

  // 3) Run eslint --format text (human-readable summary in the .txt artifact).
  let rawText = "";
  try {
    rawText = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "eslint"),
      [".", "--config", "eslint.probe.config.js"],
      {
        cwd: FRONTEND_DIR,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    rawText = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 4) Run prettier --check .
  let prettierRaw = "";
  try {
    prettierRaw = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "prettier"),
      ["--check", "."],
      {
        cwd: FRONTEND_DIR,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    prettierRaw = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 5) Capture area tree.
  const areaTree = execSync(`find src components pages -maxdepth 2 -type d 2>/dev/null | sort`, {
    cwd: FRONTEND_DIR,
    encoding: "utf-8",
  });

  // 6) Delete throwaway probe config.
  rmSync(probePath, { force: true });

  // 7) Write artifacts.
  writeFileSync(txtOut, rawText, "utf-8");
  writeFileSync(prettierOut, prettierRaw, "utf-8");
  writeFileSync(areaTreeOut, areaTree, "utf-8");

  // 8) Parse JSON + roll up.
  const results = JSON.parse(rawJson) as EslintFileResult[];

  const errorsByRule: Record<string, number> = {};
  const warningsByRule: Record<string, number> = {};
  const errorsByArea: Record<string, number> = {};
  const warningsByArea: Record<string, number> = {};
  const errorsByFile: Record<string, number> = {};
  const warningsByFile: Record<string, number> = {};
  const rulesByFile: Record<string, Record<string, number>> = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of results) {
    const area = classifyArea(file.filePath);
    const relFile = file.filePath.replace(FRONTEND_DIR + "/", "");
    if (file.errorCount) errorsByFile[relFile] = file.errorCount;
    if (file.warningCount) warningsByFile[relFile] = file.warningCount;
    totalErrors += file.errorCount;
    totalWarnings += file.warningCount;
    for (const m of file.messages) {
      const rule = m.ruleId ?? "(no-rule-id)";
      if (m.severity === 2) {
        errorsByRule[rule] = (errorsByRule[rule] ?? 0) + 1;
        errorsByArea[area] = (errorsByArea[area] ?? 0) + 1;
      } else if (m.severity === 1) {
        warningsByRule[rule] = (warningsByRule[rule] ?? 0) + 1;
        warningsByArea[area] = (warningsByArea[area] ?? 0) + 1;
      }
      (rulesByFile[relFile] ??= {})[rule] = (rulesByFile[relFile]?.[rule] ?? 0) + 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    date,
    prefix: prefix ? prefix.slice(0, -1) : null,
    totals: { errors: totalErrors, warnings: totalWarnings, problems: totalErrors + totalWarnings },
    errorsByRule,
    warningsByRule,
    errorsByArea,
    warningsByArea,
    errorsByFile,
    warningsByFile,
    rulesByFile,
  };

  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n", "utf-8");

  // 9) Console summary.
  console.log(
    `Total problems: ${totalErrors + totalWarnings} (${totalErrors} errors, ${totalWarnings} warnings)`,
  );
  console.log("Errors by rule:", errorsByRule);
  console.log("Warnings by rule:", warningsByRule);
  console.log("Errors by area:", errorsByArea);
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${txtOut}`);
  console.log(`Wrote ${prettierOut}`);
  console.log(`Wrote ${areaTreeOut}`);
}

main();
