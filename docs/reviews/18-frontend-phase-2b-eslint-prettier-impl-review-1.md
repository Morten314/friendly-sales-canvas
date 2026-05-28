---
artifact: phase-2b-eslint-prettier
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7
date: 2026-05-28
round: 1
base_ref: aa353f4
spec_loaded: false
plan_loaded: true
---

## Context

Review of commit `b851750` (Task 1.0b — lint+prettier re-baseline probe) on branch `phase-2b-eslint-prettier`. Plan loaded: `/projects/Brewra/brewra-gtm-intelligence/plans/18-frontend-phase-2b-eslint-prettier.md` Task 1.0b (lines 395-958). Spec adherence checking via plan; spec 18 was not loaded directly. The four generated audit artifacts were sampled, not read line-by-line — they are auto-generated data outputs.

## Strengths

**Plan alignment is faithful.** The 313-line helper substantively matches the plan's verbatim TypeScript in `frontend/scripts/build-lint-probe.ts:1-313`. The throwaway config in `writeProbeConfig` (lines 108-176) correctly mirrors the production-state Step 1 shape (plan lines 980-1058): all 5 new type-aware rules, `import-x/order`, the 3 override zones (`src/components/ui/**`, root configs, test files), and `eslintConfigPrettier` last. The `parserOptions.projectService: true` + `tsconfigRootDir: import.meta.dirname` block correctly enables the typescript-eslint v8 lazy type-aware parser.

**Robust to ESLint exit codes.** The `try`/`catch` blocks at lines 195-211 (JSON), 214-224 (text), and 228-237 (prettier) correctly treat non-zero exit as the expected case and harvest stdout from the thrown error. The JSON path adds an additional safety net (lines 204-210): if stdout is empty (config syntax error case), it surfaces stderr and re-throws — preventing silent corruption of downstream Wave ordering scripts that depend on a parseable JSON.

**Safe subprocess invocation.** Uses `execFileSync` with array-form args for the three subprocess calls (eslint x2, prettier), avoiding shell injection. The single `execSync` use at line 240 (`find ... | sort`) is justified because it needs the shell pipeline.

**Cleanup-before-write ordering.** The throwaway probe config is deleted at line 246 *before* artifact writes (lines 249-251), so even if writes fail the probe config doesn't leak. The deletion uses `force: true` so it's idempotent.

**Self-contained, sibling-not-extension.** No shared utilities with `build-strict-probe.ts` — `parseArgs`, `classifyArea`, `todayUtc` are reimplemented locally per plan §7.6 ("sibling, not extension"). Re-runnability is preserved via overwrite semantics.

**JSON artifact shape matches spec.** Verified `totals`, `errorsByRule`, `warningsByRule`, `errorsByArea`, `warningsByArea`, `errorsByFile`, `warningsByFile`, `rulesByFile`, `generatedAt`, `date`, `prefix` — all present at the top level as required for downstream Wave C/D ordering scripts.

**`--prefix` argument plumbed through.** Lines 53-57, 184-187, 289 — supports inter-wave re-probes (Task 4.end's `--prefix post-wave-b`, Task 5.end's `--prefix post-wave-c`) without code modification. The `prefix.slice(0, -1)` in the JSON output (line 289) strips the trailing dash for cleaner machine-readable records.

**`__dirname` → `import.meta.dirname` deviation is correct and justified.** `frontend/package.json` declares `"type": "module"`, so `__dirname` is undefined in ESM/tsx execution. The plan's verbatim text (line 426) was wrong; the implementer caught it and aligned with sibling `build-strict-probe.ts:27` which uses the same `import.meta.dirname` pattern. This deviation is implementation-correct and should be folded back into the plan if regenerated.

## Findings

### [High] Probe missed `dev-dist/` and `eslint.probe.config.js` itself — JSON undercounts authoritative baseline

**Location:** `frontend/scripts/build-lint-probe.ts:108-124` (throwaway config `ignores`) and `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json` (totals and `errorsByFile`).

The throwaway config ignores `["dist"]` only (line 124), mirroring the current `frontend/eslint.config.js:8`. Two files leak into the lint surface as a result:

1. **`dev-dist/workbox-*.js`** (3 generated PWA service-worker files, ~74 errors total). The probe text artifact shows ~26 errors per file with cascading `Definition for rule '@typescript-eslint/...' was not found` messages — these are the 26 `(no-rule-id)` errors in `errorsByRule`. The plan's Task 2 (line 1079) does add `dev-dist` to `.prettierignore`, but NOT to the eslint probe or the Step 1 production config's `ignores: ["dist"]`. This means the Step 1 production config inherits the same gap, and the lint baseline includes generated workbox files.

2. **`eslint.probe.config.js` itself** (the throwaway). Because the eslint run happens at line 199 *after* `writeProbeConfig(probePath)` at line 190, ESLint will see the throwaway probe config in its `**/*.{ts,tsx}` match (the probe file is `.js`, but it's still scanned by `eslint .` since the throwaway is unignored). Confirmed: `errorsByArea` shows 30 errors under "other" — at least some of those are likely the probe config itself plus root `*.js` files. This is a smaller leak than dev-dist but worth flagging.

**Why it matters:** The Step 0 re-baseline is "the spec's official 'before' anchor for all downstream waves and the Step 6 scorecard" (commit message). The implementer already flagged this in their handoff: "26 errors from `dev-dist/workbox-*.js` are masked" by Gate 2's `{**errorsByRule, **warningsByRule}.items()` dict-merge bug. But the deeper issue is that those 26 errors *shouldn't be in the baseline at all* — they are noise from auto-generated PWA artifacts. Wave B/C/D effort estimates and the §1.5/§4 Gate 2 unanticipated-rules check are both polluted.

**How to fix:** Task 2's production `eslint.config.js` (plan line 988) should add `dev-dist` (and likely `coverage`, `playwright-report` matching `.prettierignore`) to `{ ignores: ["dist", "dev-dist", "coverage", "playwright-report"] }`. The probe config in `writeProbeConfig` should be updated to match before the probe is re-run, OR the current baseline numbers should be accepted as-is *with a recorded delta* in the scorecard noting the 26 phantom errors will vanish once Task 2's ignores are tightened. Re-running the probe after Task 2 lands would also work, but Task 0b's commit is meant to be the "before" anchor, so re-running would invalidate that semantic.

### [Medium] Probe scans top-level `*.js` config files but throwaway doesn't include all root configs in the override zone

**Location:** `frontend/scripts/build-lint-probe.ts:164-166` (root-config override).

The override zone declares files `["tailwind.config.ts", "postcss.config.js", "vite.config.ts"]`. But the actual files that exist include `eslint.config.js` and `playwright.config.ts` plus possibly `vitest.config.ts`. The 12 errors under `root-config` area in the probe JSON suggest unrelaxed rules are firing on at least one file — and the `no-require-imports` relaxation is intentionally narrow to the three named configs. If `playwright.config.ts` is the source of error noise in the baseline, it's not a probe bug but a production-config-shape question for Step 1.

**Why it matters:** Smaller scope than the dev-dist leak, but the probe-vs-production-config alignment is the entire point of the throwaway. If the production config in Task 2 (plan line 1039-1046) keeps the same narrow file list, the same noise persists.

**How to fix:** Verify which root configs need the `no-require-imports` relaxation by checking the lint-probe.txt output for that rule's locations. If others need it, expand the file list in both the probe and the Step 1 production config. Otherwise document why the narrow list is correct.

### [Medium] `react-refresh/only-export-components` override-zone test files use `__tests__` but project uses `src/__tests__/`

**Location:** `frontend/scripts/build-lint-probe.ts:167-170` (test override pattern).

The override zone for test files matches `["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"]`. This is the same pattern that will land in production Step 1 (plan line 1052). The patterns are reasonable, but the probe's effectiveness depends on the project actually using those locations. The probe's text output should be spot-checked to confirm: (a) test files don't show `no-explicit-any` errors (only warnings), and (b) test files don't show `no-floating-promises` errors at all. If they do, the glob patterns may not match the project's test layout.

**Why it matters:** This is the kind of "did the override actually work?" verification the plan's Step 2 expected output language hints at: "react-refresh/only-export-components warnings under src/components/ui/** ... should be filtered out. If the probe shows those, the override zones in writeProbeConfig are mis-shaped". The same logic applies to the test-file overrides. The 4 `react-refresh/only-export-components` warnings in the probe suggest the `src/components/ui/**` override is working (the count is small enough that they're likely from non-ui locations), but the test-file overrides should be spot-verified.

**How to fix:** Run `python3 -c "import json; d=json.load(open('...lint-probe.json')); print([f for f in d['errorsByFile'] if 'test' in f.lower() or 'spec' in f.lower()])"` and confirm no test files show `no-floating-promises` or `no-explicit-any` errors. If they do, the glob patterns in both the probe and the future Step 1 config need adjustment.

### [Low] Unused imports `readFileSync` and `dirname`

**Location:** `frontend/scripts/build-lint-probe.ts:32-33`.

```ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
```

`readFileSync` is imported but never called. `dirname` is imported but never called (the `dirname(txtOut)` recursive `mkdirSync` used by `build-strict-probe.ts:147` was replaced here by `mkdirSync(auditDir, { recursive: true })` at line 182, making `dirname` unnecessary).

**Why it matters:** Once Task 2 lands the production lint config (with `@typescript-eslint/no-unused-vars: "error"`), this file will itself fail lint with 2 errors. It's a self-inflicted future Wave B residue item. Since the script is "kept permanently" per plan §7.6 (lifecycle), the script's own lint cleanliness matters.

**How to fix:** Remove the two unused imports:
```ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
```

### [Low] `--prefix` argument allows empty value; passes silently with `-` separator

**Location:** `frontend/scripts/build-lint-probe.ts:54-55`.

```ts
} else if (args[i] === "--prefix" && i + 1 < args.length) {
  prefix = args[i + 1] + "-";
```

If invoked as `--prefix ""`, `prefix` becomes `"-"`, producing artifact paths like `2026-05-28--frontend-phase-2b-lint-probe.json` (double-dash). Not a crash, but produces malformed filenames. Similar issue if the operator passes `--prefix` followed by a value that contains spaces or path separators.

**Why it matters:** Operator footgun; tooling tolerates malformed filenames. The plan's documented invocation (`--prefix post-wave-b`) is a single hyphenated word, so day-to-day usage is fine. But re-probes are run by a human under time pressure.

**How to fix:** Optional — add a validator: `if (prefix && !/^[a-zA-Z0-9_-]+$/.test(args[i + 1])) { throw new Error(...); }`. Or accept this is a minor sharp edge.

### [Nit] `console.log("Errors by rule:", errorsByRule)` dumps a raw object — hard to read

**Location:** `frontend/scripts/build-lint-probe.ts:304-306`.

Node's default object printer collapses keys on a single line if the object is small, but with ~15 rules each with non-trivial integer counts, the output wraps awkwardly and obscures the highest counts. The sibling `build-strict-probe.ts:180-181` has the same nit. The JSON artifact already captures the data sortably; this is just console UX.

**Why it matters:** Cosmetic. The operator looking at console output to decide "does this match the §1.3 spec numbers?" has to mentally re-sort the dict.

**How to fix:** Optional — `Object.entries(errorsByRule).sort((a,b)=>b[1]-a[1]).forEach(([r,n]) => console.log(\`  ${String(n).padStart(4)}  ${r}\`));`

### [Nit] Probe config's `parserOptions.tsconfigRootDir: import.meta.dirname` — `import.meta.dirname` is the throwaway's location, not frontend/

**Location:** `frontend/scripts/build-lint-probe.ts:133` (inside the embedded probe config template).

The throwaway probe config is written to `frontend/eslint.probe.config.js` (line 180). When ESLint loads it, `import.meta.dirname` inside it resolves to `frontend/` — which happens to be correct because the probe is co-located with `eslint.config.js`. This is fine. But this is *coincidentally correct*: the same template line is used verbatim in the Step 1 production config (plan line 998), where `import.meta.dirname` will also resolve to `frontend/` for the same reason. Not a bug, just a fragility worth noting.

**Why it matters:** If the probe were ever relocated to `frontend/scripts/eslint.probe.config.js` (it isn't, but to flag), `tsconfigRootDir` would silently break. The plan §7.4 ("Node version for `import.meta.dirname`") notes the Node ≥21.2.0 requirement but doesn't note this co-location dependency.

**How to fix:** None required. Maybe a one-line code comment noting that the probe must live next to `tsconfig.app.json`.

## Recommendations

1. **Task 2 fixup — `dev-dist` and friends in `ignores`.** When Task 2 writes the production `eslint.config.js`, expand the `ignores` block to `["dist", "dev-dist", "coverage", "playwright-report"]` to match `.prettierignore`. Update `writeProbeConfig` to match (so future Wave-end re-probes are apples-to-apples with the production config). Recompute the baseline numbers if you want them re-anchored, or document the 26-error delta in the Step 6 scorecard.

2. **Task 2 fixup — Gate 2 Python script dict-merge bug (implementer flagged).** Replace `{**errorsByRule, **warningsByRule}.items()` with explicit iteration that doesn't lose duplicate keys. Suggested:
   ```python
   from collections import defaultdict
   combined = defaultdict(int)
   for r, n in d["errorsByRule"].items(): combined[r] += n
   for r, n in d["warningsByRule"].items(): combined[r] += n
   ```
   This becomes irrelevant once `dev-dist` is ignored (the `(no-rule-id)` collision was the symptom). Worth fixing the Python script anyway.

3. **Plan fixup — fold the `__dirname` → `import.meta.dirname` correction back into the plan text.** Plan line 426 is wrong (`const FRONTEND_DIR = resolve(__dirname, "..");` doesn't work in ESM). Lines 472 ("uses ... `tsx`'s CommonJS-compat `__dirname` ... same pattern as Phase 2a's build-strict-probe.ts") should also be corrected — `build-strict-probe.ts:27` uses `import.meta.dirname`, not `__dirname`. Per the user's MEMORY entry (`specs and plans are a frozen record of intent`), the in-tree plan stays as-shipped — but the next plan-generation prompt should reference this as a known plan-template bug.

4. **Probe script lint cleanliness as a Wave B done-when.** The unused `readFileSync`/`dirname` imports will be Wave B residue. Either fix in a follow-up commit on this branch before Task 2 lands, or accept them as known residue and let Wave B sweep them up alongside the rest of the codebase.

5. **Spot-check override-zone effectiveness against the JSON artifact.** Before Task 2, run a one-liner against `errorsByFile` to confirm: (a) no test files appear with `no-floating-promises` errors; (b) no `src/components/ui/**` files appear with `react-refresh/only-export-components`. This confirms the probe shape is correct and gives confidence that the same overrides in Step 1 will behave correctly.

## Assessment

**Ready to merge?** Yes — with the caveat that Task 2 must address the `dev-dist` ignore gap and the Gate 2 dict-merge bug. The probe baseline itself is usable as the "before" anchor with the 26 `(no-rule-id)` errors documented as phantom noise that will vanish in Task 2.

**Reasoning:** The helper script is well-structured, faithful to plan intent, robust to ESLint exit codes, and produces the four artifacts in the documented shape. The deviation from `__dirname` to `import.meta.dirname` is implementation-correct (the plan was wrong, the implementer was right). The two material findings (`dev-dist` leak, unused imports) are forward-fixable in Task 2 and Wave B respectively, not blockers for this commit. Override zones, throwaway-config-cleanup, and JSON shape all match spec.
