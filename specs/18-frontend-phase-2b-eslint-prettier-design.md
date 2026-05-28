# Spec 18 — Frontend Phase 2b: ESLint type-aware + Prettier

**Status:** Design — round 1
**Date:** 2026-05-28
**Type:** Phase spec (descendant of `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 2b)
**Paired plan:** `plans/18-frontend-phase-2b-eslint-prettier.md` (written next)

---

## §1 Goal and context

### 1.1 Goal

Land ESLint type-aware rules + Prettier across the frontend in one short-lived branch. By end of phase:

- `frontend/eslint.config.js` enables the five mandated rules from master spec §4 Phase 2b: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`. Plus `import/order` from `eslint-plugin-import` and stylistic-rule disabling via `eslint-config-prettier` applied last.
- `frontend/.prettierrc` exists with the §3.1 config; `frontend/.prettierignore` excludes build artifacts and snapshots; `.git-blame-ignore-revs` at the **monorepo root** (`brewra-gtm-intelligence/.git-blame-ignore-revs`) accumulates Wave A's mass-format commit SHAs so `git blame` (and GitHub's blame UI) skip them.
- `npm run lint` (= `eslint . --max-warnings 0`) returns 0 errors and 0 warnings.
- `npm run format:check` (= `prettier --check .`) returns 0 violations.
- `npm run preflight` extends to include lint + format:check.
- All 224 existing inline `any`s either acquire proper types, route through `src/lib/types/escape-hatches.ts` with the same `Untyped*` discipline Phase 2a established, or sit under `eslint-disable-next-line` in test files only (production code uses escape-hatches).
- The 56 existing warnings are resolved — `react-refresh/only-export-components` warnings under `src/components/ui/` (shadcn primitives, locked from Phase 4) silenced via override zone; the 13 "unused eslint-disable directive" warnings removed.
- The `tailwind.config.ts` `no-require-imports` error is resolved via override zone (the `require()` is intentional for Tailwind plugin loading).

The phase is the third of three sub-phases (2a, 2b, 2c) that together implement master spec §4 Phase 2 "Foundation." 2a owned the typecheck flip (merged 2026-05-28). 2b owns lint + Prettier (this spec). 2c owns preflight gates + bundle budget. Each ships on its own branch.

### 1.2 Why now

Master spec §4 places Phase 2b immediately after Phase 2a so the lint storm hits a tree where strict TS is already enforced — strict-mode fixes from Phase 2a (typed callbacks, narrowed return types, deleted dead symbols) reduce the per-rule violation count Phase 2b would otherwise face. Phase 2a merged 2026-05-28; this spec drafts the same day. Phase 1's preflight chain (typecheck + build + Playwright + visual regression + Vitest + `knip --strict`) already in place backstops Phase 2b's changes.

### 1.3 Starting state (Phase 2b anchor)

| Aspect | State as of Phase 2a merge (2026-05-28) |
|---|---|
| Source LOC | 59,651 across 142 `.ts`/`.tsx` files under `frontend/src/` (post-Phase-2a count; down from Phase 1's 67,469 due to dead-shadcn deletes + Wave A `noUnused*` cleanup) |
| `tsconfig.app.json` | Strict: `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all `true` (per Phase 2a) |
| Current ESLint config | `tseslint.configs.recommended` extended; `eslint-plugin-react-hooks` recommended rules; `react-refresh/only-export-components` as `warn`; `@typescript-eslint/no-unused-vars` explicitly OFF |
| Current `eslint .` baseline | **392 problems (336 errors, 56 warnings)** under the existing config |
| Error origin (336) | Predominantly `@typescript-eslint/no-explicit-any` (already in `tseslint.configs.recommended` as `error` — 224 inline `any` sites yield ~330+ violations after counting positions the regex misses); 1× `@typescript-eslint/no-require-imports` in `tailwind.config.ts` |
| Warning origin (56) | Predominantly `react-refresh/only-export-components` from `src/components/ui/` shadcn primitives; 13× "unused eslint-disable directive" (Phase 2a's strict cleanup obviated some prior `eslint-disable` comments) |
| Inline `any` count | 224 (`rg -n ':\s*any\b\|as\s+any\b\|<any>' -g '*.ts' -g '*.tsx' src/`). Same regex as Phase 2a §1.3 — excludes multi-argument generics (`Record<string, any>`, `Map<string, any>`) that this phase's `@typescript-eslint/no-explicit-any` lint rule does cover. The ESLint count may exceed 224 once those positions are factored in; Step 0 probe re-measures. |
| `@ts-*` suppressions | 5 (unchanged from Phase 2a baseline) |
| Escape-hatches file | `src/lib/types/escape-hatches.ts` present with 6 entries from Phase 2a Wave B. Last TD-FE: TD-FE-9. Phase 2b continues this file; relocation to `src/shared/types/escape-hatches.ts` remains deferred to Phase 4. |
| Prettier installed | No. No `.prettierrc`, no `.prettierignore` (in `frontend/`), no `.git-blame-ignore-revs` (at monorepo root). |
| `eslint-plugin-import` installed | No. |
| `eslint-config-prettier` installed | No. |
| `typescript-eslint` version | `^8.0.1` — supports `projectService` for type-aware rules. |
| Current `lint` script | `eslint .` (no `--max-warnings` flag — Phase 2b tightens to `--max-warnings 0`) |
| Current `typecheck` script | `tsc --noEmit -p tsconfig.app.json` (Phase 2a fix in place) |
| Current `preflight` chain | `npm run typecheck && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress` |
| Preflight wrapper script | None. `frontend/scripts/preflight.sh` is referenced in Phase 1 Spec 16 §3 Step 7 docs but the package.json `preflight` script is the source of truth (per the wrapper's own head comment). |
| Knip config | `frontend/knip.json` present (entry patterns + ignore for `src/components/ui/**` + `tailwindcss-animate`/`tsx` ignore-deps). Phase 2b does not modify. |
| Existing TD-FE entries | TD-FE-1 through TD-FE-9 from Phases 1 and 2a. Next slot: TD-FE-10. |

### 1.4 Numbering and branch

- Spec NN = 18 (Phase 2a used NN=17; next slot per CLAUDE.md numbering rule).
- Branch name: `phase-2b-eslint-prettier`, branched off `master` at the post-Phase-2a commit (`ce08615` or successor).
- Branch lifecycle: short-lived; deleted after merge per Spec 14 §5.1.

### 1.5 Why 5 waves (no sub-split)

The design-time count of `no-explicit-any` violations (~330) is the largest single workload, comparable to Phase 2a's Wave A (~327 `noUnused*` errors). Per-rule sub-decomposition would mirror the wave structure already. The 5-wave layout — Step 0 + Wave A (Prettier per-area) + Wave B (auto-fix lint sweep) + Wave C (`no-explicit-any` per-site) + Wave D (`no-floating-promises` + `no-misused-promises` per-site) + Step 5 (verify) — gives each rule category its own commit cohesion without formal sub-phases.

**Step 0 threshold gate:** if the re-baseline probe surfaces `no-floating-promises` + `no-misused-promises` combined count above 300, the plan author proposes a sub-decomposition of Wave D (D-i / D-ii by area or by rule). The 300 figure is a starting heuristic — the plan stage validates against actual measurements.

---

## §2 Scope

### 2.1 In scope

- **Install npm dependencies** in `frontend/`: `prettier`, `eslint-plugin-import`, `eslint-config-prettier`. Co-commit with the probe artifacts in Step 0 (the probe needs the deps to run). One npm install commit + one probe-artifact commit.
- **Update `frontend/eslint.config.js`** with the configuration target in §3:
  - Five new/re-enabled rules: `@typescript-eslint/no-explicit-any` (already error under current `recommended` — kept explicit), `@typescript-eslint/no-unused-vars` (re-enable from `off`), `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`.
  - `eslint-plugin-import` registered; `import/order` configured per §3 alphabetical-grouped form.
  - `eslint-config-prettier` applied last in the `extends` chain.
  - Type-aware parser config (`projectService: true`).
  - Override zones for `src/components/ui/**`, root config files, and test files per §3.3.
  - `eslint-plugin-react-hooks` `recommended` rules verified present (per master spec §4 Phase 2b explicit ask).
- **Add `.prettierrc`** at `frontend/` root with §3.1 config.
- **Add `.prettierignore`** at `frontend/` root excluding `dist/`, `dev-dist/`, `node_modules/`, `playwright-report/`, `e2e/**/*-snapshots/**`, `coverage/`.
- **Add `.git-blame-ignore-revs`** at the **monorepo root** (`brewra-gtm-intelligence/.git-blame-ignore-revs`, initialized empty with header comment; Wave A's SHAs append in a single commit at end of Wave A). The file lives at the repo root (where `.git/` is) so GitHub's blame UI honors it automatically. Local `git blame` requires contributors to run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once.
- **Edit `frontend/package.json`**:
  - Tighten `lint` script: `"lint": "eslint . --max-warnings 0"`.
  - Add `"format": "prettier --write ."`.
  - Add `"format:check": "prettier --check ."`.
  - Extend `preflight` to include lint + format:check immediately after typecheck: `"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress"`.
- **Per-site fix all 224+ inline `any`s** (the regex-matched count plus any multi-argument-generic positions Step 0's probe surfaces). Same posture as Phase 2a §2.4 Wave B/C: proper type when reasonable; escape-hatches entry when not; `eslint-disable-next-line` allowed only in test files (per §3.3 override zone).
- **Resolve the 56 warnings:**
  - `react-refresh/only-export-components` warnings under `src/components/ui/`: silenced via override zone in `eslint.config.js`. Shadcn primitives are locked from Phase 4 — restructuring their exports is out of scope.
  - 13 "unused eslint-disable directive" warnings: each directive removed in a dedicated commit (`refactor(fe): remove unused eslint-disable directives`).
- **Resolve `tailwind.config.ts` `no-require-imports`** via the root-config override zone in §3.3. The `require()` is intentional for Tailwind plugin loading.
- **Final scorecard** merged at `docs/audits/<date>-frontend-phase-2b-eslint-prettier.md` per §4 Step 6.

### 2.2 Out of scope (deferred)

- **Features-specific dependency rules.** `import/no-internal-modules`, `import/no-restricted-paths` — Phase 4 (when `src/features/` exists to enforce against). Master spec §3.3 + §4 Phase 4 own this.
- **`tseslint.configs.recommendedTypeChecked` broader bundle.** Adds ~15 type-aware rules beyond the five mandated. Explicitly out-of-scope per brainstorming decision; the spec keeps the master spec list as-is.
- **`eslint-plugin-react`, `eslint-plugin-jsx-a11y`.** Explicitly out-of-scope per brainstorming decision.
- **Bundle-size budget, NFR thresholds, preflight-chain wall-time gates.** Phase 2c's domain.
- **Feature folder restructuring (`src/features/`, `src/shared/`).** Phases 4–10.
- **TanStack Query adoption, three-cache collapse, rate-limit centralization.** Phase 3.
- **Relocation of escape-hatches.** Master spec §4 Phase 2a's `src/shared/types/escape-hatches.ts` target — Phase 4 relocates when it creates `src/shared/`. Phase 2b continues the interim `src/lib/types/escape-hatches.ts` path. TD-FE-9 already registers the relocation deferral; Phase 2b does not duplicate the registration.
- **shadcn primitive restructuring** beyond the override-zone silence of `react-refresh/only-export-components`. Phase 4 owns `src/components/ui/` formally.
- **Behavior changes, opportunistic refactoring beyond what a lint-rule fix mechanically requires.** Posture rules in §2.4 pin this.
- **`tsconfig.node.json` flag changes.** Phase 2a deferred this; Phase 2b also defers.
- **Restructuring `e2e/`, `scripts/`, root configs.** Phase 2b lints them (no scope narrowing) but does not restructure.

Out-of-scope discoveries are logged to `docs/TECH_DEBT.md` as `TD-FE-<n>` entries (numbering continues from TD-FE-10).

### 2.3 Frozen interfaces

These do not change as a result of Phase 2b (covered by Phase 0b's characterization tests and Phase 0a's visual regression):

- HTTP API contract with the backend.
- Routes.
- Visible UI is unchanged (validated by visual regression at `maxDiffPixelRatio 0.01` in the preflight chain).
- Auth flow, rate-limit boundary value (4 req/min), bundle output format.
- Existing Playwright behavioral journeys stay green.
- Existing Vitest characterization suite stays green.
- **Public exports of `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/`.** Signatures may narrow further (when an explicit-any fix tightens a return type), but no rename, no removal, no semantic change. Test imports and e2e fixture imports must continue resolving.
- **`tsconfig.app.json` strict configuration from Phase 2a.** Phase 2b does not modify any TypeScript compiler flags. `typecheck` remains green throughout.
- **Existing 6 escape-hatches entries from Phase 2a.** Phase 2b may add new entries; it does not remove or rename Phase 2a's entries (Phase 13 audits all).
- **Type-level cascades from Wave C narrowing are in scope, not a frozen-interface violation.** Same logic as Phase 2a §2.3 — annotations tighten downstream call sites; cascade-related errors get fixed under the same wave's rules; file-grain commits absorb them. Runtime behavior unchanged.

### 2.4 Posture rules

When fixing a lint violation, the grain is "what the rule needs to be satisfied," not "what would make the file better." Specifically:

1. **Default fix:** add the proper type or apply the canonical lint-fix. For `no-explicit-any`: type the parameter, return, or assertion. For `consistent-type-imports`: ESLint `--fix` handles the conversion to `import type { ... }`. For `import/order`: ESLint `--fix` reorders. For `no-floating-promises`: add `await` if the call is in an async context, `void` prefix if fire-and-forget is intentional, or chain `.then`/`.catch` if neither. For `no-misused-promises`: restructure handler signature to wrap in IIFE or void wrapper.
2. **Acceptable narrowing refactor:** if the fix needs a type guard, `typeof` narrow, user-defined predicate, non-null assertion on a value with known initial, extracting a typed local, or `as Foo` cast where the runtime shape is provable from call-site context — that's in scope. Same as Phase 2a §2.4 rule 2. **For catch blocks:** `catch (e: any)` becomes `catch (e: unknown)` plus narrowing (`if (e instanceof Error)`). When in doubt, narrow rather than cast.
3. **Out-of-scope refactor encountered:** if a lint violation reveals a deeper design problem (e.g., a generic `any` that would need restructuring across 10 call sites), one of:
   - escape-hatch the immediate site via `src/lib/types/escape-hatches.ts` (per §4 Wave C policy), OR
   - log a `TD-FE-<n>` entry capturing the deferral, OR
   - abort the phase per Spec 14 §5.7 if the discovery invalidates the spec.
   Do not refactor opportunistically.
4. **Behavior unchanged.** Lint-rule fixes are type/import/format-only edits. If you find yourself rewriting logic to satisfy a rule, stop — that's option 3 territory.
5. **Underscore convention.** Continues from Phase 2a §2.4 rule 5. `@typescript-eslint/no-unused-vars` is configured with `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'` per §3.4. Bare `_` is also honored by the rule but the `_argName` form is preferred for new fixes; pre-existing bare `_` parameters are not retroactively renamed.
6. **Test-file conventions.** Test code (`src/**/__tests__/**`, `src/**/*.{test,spec}.{ts,tsx}`, `e2e/**`) is in scope for lint, with the relaxed rules in §3.3: `no-explicit-any` becomes `warn` (allowing `eslint-disable-next-line` for legitimate mock typing); `no-floating-promises` is off (Vitest awaits everything that matters). Over-typing test mocks beyond what the assertion requires is out of scope per posture rule 3.
7. **No new `@ts-*` suppressions.** Continues Phase 2a §2.4 rule 7. The §5 done-when gate (item 9: `@ts-*` count ≤5) enforces this. Existing 5 suppressions remain for now; revisited only if a phase-specific reason surfaces.
8. **Prettier commits contain only formatting.** Wave A's per-area commits run `prettier --write <area>` and nothing else. Mixing logic edits into a Wave A commit is a posture violation — split into a separate commit before merging. This preserves the `.git-blame-ignore-revs` invariant: any SHA listed there is a pure-formatting commit.
9. **Auto-fix commits contain only the rule's auto-fix output.** Wave B's per-rule sweeps run `eslint --fix --rule '{<rule>: "error"}'` against a target area; the resulting diff is committed verbatim with no manual edits added. Manual edits belong in Wave C/D.
10. **`eslint-disable-next-line` is allowed only in test files** (per §3.3 override zone). Production code under `src/` (excluding `__tests__/` and `*.{test,spec}.{ts,tsx}`) routes any unfixable `no-explicit-any` through `src/lib/types/escape-hatches.ts`. The §5 done-when gate (item 8) verifies this.

---

## §3 Configuration target

This section defines the end-state configuration that Step 1 lands. Methodology in §4 references back here.

### 3.1 Prettier config

```jsonc
// frontend/.prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Rationale per option:
- `singleQuote: false` — shadcn-generated code in `src/components/ui/` uses double quotes throughout; flipping doubles the Wave A diff with no net value.
- `printWidth: 100` — more permissive than Prettier's default 80; matches the prevailing line length in the codebase and the backend's `pyproject.toml` `line_length = 100` for `black`.
- `trailingComma: "all"` — modern JS standard; minimizes diff churn on future edits.
- `arrowParens: "always"` — already the prevailing style in `src/`.
- `endOfLine: "lf"` — repo standard; prevents Windows-checkout drift.

The plan stage may adjust these before Step 1 if a quick `prettier --check` dry-run against a representative file (e.g., `src/components/customers/ICPSummaryOpportunity.tsx`) shows a smaller-diff alternative.

### 3.2 ESLint type-aware parser config

```js
// eslint.config.js (excerpt)
languageOptions: {
  ecmaVersion: 2020,
  globals: globals.browser,
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
},
```

`projectService: true` is the modern typescript-eslint v8 API. It lazy-loads project info per file, avoiding the "file not in project" error that bites test files and root config files under the older `project: true` form. The two type-aware rules (`no-floating-promises`, `no-misused-promises`) require this; the three syntactic rules (`no-explicit-any`, `no-unused-vars`, `consistent-type-imports`) work without it but coexist fine.

### 3.3 Override zones

```js
// eslint.config.js (overrides at end of config array, after the main block)

// shadcn primitives — locked from Phase 4. only-export-components is by design.
{ files: ["src/components/ui/**"], rules: {
    "react-refresh/only-export-components": "off",
} },

// Root config files using CommonJS require() or other Node-style patterns.
{ files: ["tailwind.config.ts", "postcss.config.js", "vite.config.ts"], rules: {
    "@typescript-eslint/no-require-imports": "off",
} },

// Test files — relaxed for mock typing and intentional fire-and-forget.
{ files: ["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"], rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-floating-promises": "off",
} },
```

The test-file relaxation downgrades `no-explicit-any` to `warn` (rather than `off`) so violations remain visible in editors but do not block `--max-warnings 0`. To allow specific cases past `--max-warnings 0`, tests use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a one-line justification. The §5 done-when gate (item 8) confirms `eslint-disable-next-line` for `no-explicit-any` is confined to test paths.

### 3.4 `no-unused-vars` interaction with TypeScript

`@typescript-eslint/no-unused-vars` is currently OFF in the existing config (intentional — Phase 2a's `noUnusedLocals` + `noUnusedParameters` from `tsconfig.app.json` catch unused symbols at compile time, making the lint rule redundant). Phase 2b re-enables it per master spec §4 Phase 2b's explicit list. Configuration:

```js
"@typescript-eslint/no-unused-vars": ["error", {
  argsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
  caughtErrorsIgnorePattern: "^_",
}],
```

The `^_` patterns honor the `_argName` convention Phase 2a established. After Phase 2a's Wave A cleanup, the re-enabled rule should surface few or zero new violations — the rule provides editor-visible signal even if the compiler already catches the same cases.

### 3.5 Lint scope

`eslint .` runs against:
- `src/**/*.{ts,tsx}` (app code, including tests under the override zone)
- `e2e/**/*.ts` (Playwright tests — already in scope per current `eslint .` invocation; tests under the override zone)
- `scripts/**/*.ts`
- Root configs (`vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`) — already lints them today; under the root-config override zone

Phase 2b does not narrow this scope. The `eslint.config.js` `ignores: ["dist"]` rule from the existing config is preserved; `.prettierignore` excludes the same plus snapshot directories.

---

## §4 Methodology — 5 waves, all-rules-on

Six steps. `eslint .` is red between Step 1 and end of Wave D; `prettier --check .` is red between Step 1 and end of Wave A. `tsc --noEmit` (Phase 2a's gate) stays green throughout — acceptable because `master` stays green; only the phase branch is in flight. `vite build`, Vitest, and Playwright continue to pass mid-phase (esbuild transpiles without linting; tests don't lint).

### Step 0 — Re-baseline at execution start (two commits)

Run a probe against the current `master` state immediately on branch creation, with the new rules wired behind a throwaway config.

**Commit 0a — Install npm deps.** Add `prettier`, `eslint-plugin-import`, `eslint-config-prettier` to `frontend/package.json` devDependencies. `package-lock.json` updates. No other edits. Commit subject: `chore(fe): install prettier + eslint-plugin-import + eslint-config-prettier`.

**Commit 0b — Run probe + capture artifacts.** Write a throwaway `frontend/eslint.probe.config.js` that:
- Extends the current `eslint.config.js` shape.
- Adds the five new rules + `import/order` + `eslint-config-prettier`.
- Adds the §3.3 override zones (so the probe surface matches Step 1's production surface).
- Adds `languageOptions.parserOptions.projectService: true` for type-aware rules.

Run:
- `eslint . --config eslint.probe.config.js --max-warnings 0 --format json > docs/audits/<date>-frontend-phase-2b-lint-probe.json`
- `eslint . --config eslint.probe.config.js --max-warnings 0 > docs/audits/<date>-frontend-phase-2b-lint-probe.txt 2>&1`
- `prettier --check . > docs/audits/<date>-frontend-phase-2b-prettier-probe.txt 2>&1`

Generate a `frontend/scripts/build-lint-probe.ts` helper that runs the above and produces a per-rule × per-area roll-up in the JSON (modelled on Phase 2a's `build-strict-probe.ts`). The script may be committed for re-use; the probe config is deleted before commit.

Commit subject: `chore(audits): phase 2b lint+prettier re-baseline`.

**Probe-config lifecycle:** identical to Phase 2a's Step 0 — the helper creates `eslint.probe.config.js`, runs the probe, captures artifacts, then deletes the throwaway. Only the JSON + TXT + helper script land.

**Re-baseline output is the spec's official "before" anchor.** Phase 2a merged today, but any commit between this spec's drafting and execution start may shift counts. If the re-baseline `no-floating-promises` + `no-misused-promises` combined count exceeds **300**, the plan author halts and re-enters a sub-decomposition decision for Wave D (D-i / D-ii by area or by rule) before continuing.

### Step 1 — Tool config + format infra (one commit)

Land the production config in one atomic commit:

- **Edit `frontend/eslint.config.js`:**
  - Add `import importPlugin from "eslint-plugin-import";` and `import eslintConfigPrettier from "eslint-config-prettier";`.
  - Register `eslint-plugin-import` in `plugins`.
  - Add the five new rules (per §1.1) with `error` severity (test override zone downgrades two; see §3.3).
  - Configure `import/order` per §3:
    ```js
    "import/order": ["error", {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      alphabetize: { order: "asc", caseInsensitive: true },
    }],
    ```
  - Add `languageOptions.parserOptions.projectService: true` + `tsconfigRootDir`.
  - Apply `eslintConfigPrettier` as the LAST config in the export array (overrides stylistic rules).
  - Add the three override zones from §3.3.
  - Verify `eslint-plugin-react-hooks` `recommended` rules are still spread (already present in existing config; just verify nothing dropped).
- **Add `frontend/.prettierrc`** with §3.1 contents.
- **Add `frontend/.prettierignore`:**
  ```
  dist
  dev-dist
  node_modules
  playwright-report
  coverage
  e2e/**/*-snapshots/**
  package-lock.json
  ```
- **Add `.git-blame-ignore-revs`** at the monorepo root (`brewra-gtm-intelligence/.git-blame-ignore-revs`) initialized with:
  ```
  # Pure-formatting commits to ignore in git blame.
  # See https://git-scm.com/docs/git-config#Documentation/git-config.txt-blameignoreRevsFile
  # Locally: git config blame.ignoreRevsFile .git-blame-ignore-revs
  # GitHub honors this file automatically.
  ```
- **Edit `frontend/package.json`:**
  - `"lint": "eslint . --max-warnings 0"`
  - `"format": "prettier --write ."`
  - `"format:check": "prettier --check ."`
  - `"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress"`

Commit subject: `chore(fe): wire eslint type-aware rules + prettier config`.

After Step 1, `npm run lint` and `npm run format:check` are both red. `npm run typecheck` stays green. Vitest and Playwright continue to pass.

### Step 2 — Wave A: Prettier per-area mass-format (~10–14 commits)

Apply `prettier --write` per area, low-impact areas first. Each commit contains only formatting changes (posture rule 8).

**Suggested area order (mirrors Phase 2a Wave A):**

1. `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/`, `src/styles/` (light counts, broad blast radius)
2. `src/components/ui/` (shadcn primitives)
3. `src/components/layout/`, `src/components/signals/`, `src/components/strategist/`, `src/components/settings/`, `src/components/customers/`
4. `src/components/market-research/`
5. `src/components/mission-control/`
6. `src/pages/` — small pages first, then `MissionControl.tsx`, `MarketResearch.tsx` last
7. `e2e/`, `scripts/`, root configs (`vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`)

Each commit:
- Runs `prettier --write <area>`.
- Subject: `style(fe): prettier format <area>` (or `<area>/<sub-area>` if split per the split-threshold below).
- Contains no other changes.

**Split threshold:** if an area's `prettier --write` diff exceeds **500 line-changes**, split into sub-area commits (by sub-folder or by file group). The threshold is higher than Phase 2a Wave A's 60-line split because Prettier's output is mechanical and large diffs are inherent. One commit per area is the default.

**End-of-wave consolidation commit.** A single follow-up commit appends every Wave A SHA into `.git-blame-ignore-revs` at the monorepo root. Subject: `chore(fe): add Wave A prettier commits to git blame ignore-revs`.

**Wave-end checkpoint:** before starting Wave B, run two checks:

1. **Format verification.** `npm run format:check` → green.
2. **Unit-test health.** `npx vitest run` → green. (Prettier's reformatting shouldn't change semantics but template literal whitespace and chained method indentation can in rare cases. Catching breakage within Wave A is cheaper than at Step 6.)

`eslint .` still red (rules not yet auto-fixed).

### Step 3 — Wave B: Auto-fix lint sweep (~3–6 commits)

Apply mechanical auto-fixes by rule. Each commit contains only the rule's `--fix` output (posture rule 9).

**Commit grain:**

- **`consistent-type-imports`** auto-fix sweep — one batched commit if the diff is small, or per-area if large. Subject: `refactor(fe): apply consistent-type-imports --fix`.
- **`import/order`** auto-fix sweep — same shape. Subject: `refactor(fe): apply import/order --fix`.
- **`no-unused-vars`** residue — `npm run typecheck` already catches most unused symbols (Phase 2a baseline); re-enabling the lint rule should surface ≤5 new violations, likely zero. Fixed in a residue commit if any. Subject: `refactor(fe): resolve no-unused-vars residue`.
- **13 unused `eslint-disable` directives** removed — single commit. Subject: `refactor(fe): remove unused eslint-disable directives`.

**Per-rule batching:** if a single rule's `--fix` output exceeds **300 line-changes** across the tree, split by area following Wave A's order. Otherwise one commit per rule.

**Wave-end checkpoint:** before starting Wave C, run two checks:

1. **Auto-fix verification.** `npm run lint` should now report violations only from the manual-fix rules: `no-explicit-any`, `no-floating-promises`, `no-misused-promises`, and possibly residual `no-unused-vars` if any. Verify the residual error categories match the probe artifacts.
2. **Unit-test health.** `npx vitest run` → green.

### Step 4 — Wave C: `no-explicit-any` per-site (file-by-file commits, ~30–60 commits)

Targets all `no-explicit-any` violations (~330 sites — the regex-matched 224 inline `any`s plus multi-argument-generic positions the regex missed plus any new sites Wave A's Prettier reformatting exposed).

**Fix rules (per §2.4 posture):**

- **React event handlers:** `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`, etc.
- **Array callbacks (`.map`, `.filter`, `.reduce`):** propagate source element type.
- **Object destructuring on weakly-typed data:** type the parameter; create local `interface` or `type` if non-trivial. **Do not** create centralized API contract types (Phase 3's domain).
- **Catch blocks:** `catch (e: any)` → `catch (e: unknown)` + narrowing (`if (e instanceof Error)`).
- **Generic placeholders (`Promise<any>`, `useState<any>`, `Array<any>`):** concrete type or `unknown`.
- **Multi-argument generics (`Record<string, any>`, `Map<string, any>`):** swap `any` for `unknown` if the value is genuinely opaque; concrete type otherwise.
- **Last resort → escape-hatch via `src/lib/types/escape-hatches.ts`.**

**Escape-hatches policy:** continues Phase 2a's pattern. Each new entry needs `// TODO(phase-13):`, `Untyped*` type-name prefix, call-site reference, one-line justification. **5th-new-entry TD-FE registration** — the existing file has 6 entries from Phase 2a; Phase 2b counts its own 5th *new* entry as the trigger. The new TD-FE (likely TD-FE-10) captures Phase 2b's pattern. Entries past 5-new are logged without further TD-FEs. Master spec line 298 puts post-hoc audit on Phase 13.

**Commit grain:** file-by-file with the same batching threshold as Phase 2a Wave B: files with ≤3 errors in the same area may be bundled into one commit; files with >3 errors get individual commits.

**Suggested order:**

1. `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/` (light counts, broad blast radius — fix cleanly first).
2. `src/components/` — small areas first (signals, strategist, settings, layout), then larger (customers, market-research sections, mission-control sub-components).
3. `src/pages/` — small pages first (Settings, TenantSelection, Login, Calendar, Reports, Artifacts, Signals, Deals, Insights, NotFound), then `MissionControl.tsx`, then `MarketResearch.tsx` last.

Subject: `refactor(fe): type <file>` (or `refactor(fe): type <area>` when bundled).

**Wave-end checkpoint:** before starting Wave D, run two checks:

1. **`no-explicit-any` verification.** `npx eslint . --rule '{"@typescript-eslint/no-explicit-any": "error"}' --no-eslintrc --quiet 2>&1 | grep -c 'error'` returns 0 outside test paths (or matches the expected residual count from `eslint-disable-next-line` in tests).
2. **Unit-test health.** `npx vitest run` → green.

### Step 5 — Wave D: `no-floating-promises` + `no-misused-promises` per-site

Type-aware rules. Count unknown until Step 0 probe. Same per-site posture as Wave C.

**Fix rules:**

- **`no-floating-promises`:**
  - Async call in async context → `await`.
  - Fire-and-forget intentional → `void` prefix (`void doSomethingAsync()`).
  - Effect cleanup or unmount handler → wrap in IIFE or use `.catch(handleError)`.
- **`no-misused-promises`:**
  - Promise passed to a non-promise-expecting context (e.g., `setTimeout(asyncFn, ...)`) → wrap in arrow `() => { void asyncFn(); }`.
  - Async event handler attached to JSX prop (e.g., `<button onClick={asyncFn}>`) → if Step 0 surfaces many of these, the plan stage may configure `no-misused-promises` with `checksVoidReturn: { attributes: false }` to relax for JSX attributes (the runtime behavior is fine in React). Decision recorded in plan stage.

**Escape-hatches:** rarely needed for these rules; fixes are usually mechanical. If a site genuinely needs an escape, follow Wave C's same policy.

**Commit grain:** file-by-file with the same ≤3/>3 batching threshold as Wave C.

Subject: `fix(fe): resolve floating/misused promises in <file>` (or `<area>` when bundled).

**Wave-end checkpoint:** before Step 6, run two checks:

1. **Full lint verification.** `npm run lint` → 0 errors and 0 warnings.
2. **Unit-test health.** `npx vitest run` → green.

### Step 6 — Verify done-when and write scorecard (one commit; two if residual fixes are needed)

**Verification checklist** (run before writing the scorecard; if any fails, a residual-fix commit lands first):

- `npm run lint` → 0 errors and 0 warnings.
- `npm run format:check` → green.
- `npm run typecheck` → green (Phase 2a's gate not regressed).
- `npm run preflight` → green end-to-end.
- `src/lib/types/escape-hatches.ts` — every entry (Phase 2a's 6 + Phase 2b's additions) carries `// TODO(phase-13):`, `Untyped*` prefix, call-site reference, justification. If Phase 2b added 5+ new entries, a `TD-FE-<n>` (likely TD-FE-10) registration exists capturing the Phase 2b pattern.
- `rg -n ':\s*any\b|as\s+any\b|<any>|Record<[^>]*, any>|Map<[^>]*, any>' -g '*.ts' -g '*.tsx' -g '!src/lib/types/escape-hatches.ts' -g '!src/**/__tests__/**' -g '!src/**/*.{test,spec}.{ts,tsx}' src/ | wc -l` returns 0. (Production code has no inline `any`; escape-hatches.ts uses `= any` syntax not matched by the regex; test files are excluded — see next check.)
- `rg -n 'eslint-disable.*no-explicit-any' -g '*.ts' -g '*.tsx' src/` returns hits only in test paths (`__tests__/`, `*.{test,spec}.{ts,tsx}`).
- `rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx' src/ | wc -l` returns ≤5 (no regression from Phase 2a baseline).
- `.git-blame-ignore-revs` contains every Wave A commit SHA (verify by `git log --grep='^style(fe): prettier format' --format=%H` matches the file's contents).

**Residual-fix commit (only if checklist fails):** small fixes addressing whatever check went red. Subject: `fix(fe): residual phase 2b verification fixes`. Re-run the checklist after.

**Scorecard commit** (always written): `docs/audits/<date>-frontend-phase-2b-eslint-prettier.md` with:

1. **Probe baseline → final counts** per rule. Step 0 JSON cited; scorecard does not duplicate it as a table.
2. **Files touched per wave.** Counts only (LOC deltas per area for Wave A; per-file counts for Waves C/D).
3. **Escape-hatches delta:** Phase 2a final (6) → Phase 2b final (N). List of new `Untyped*` types with justifications.
4. **TD-FE entries created during the phase:** IDs and one-line summaries.
5. **Commit summary:** one-paragraph wave-by-wave narrative. `git log --oneline master..HEAD` attached verbatim.
6. **Diff size:** `git diff --stat master..HEAD` verbatim. Wave A's mass-format commits called out separately (they dominate the diff). The `.git-blame-ignore-revs` aggregation makes Wave A's diff effectively invisible to future blame.

Scorecard commit subject: `docs(audits): phase 2b eslint+prettier scorecard`.

---

## §5 Definition of done

The phase is "done" when **all** of these hold on `phase-2b-eslint-prettier` immediately before merge:

1. `frontend/eslint.config.js` enables the five mandated rules + `import/order` + `eslint-config-prettier` (applied last). Type-aware parser config (`projectService`) wired. Override zones for `src/components/ui/`, root configs, and test files present per §3.3.
2. `frontend/.prettierrc` and `frontend/.prettierignore` present in the frontend root. `.git-blame-ignore-revs` present at the **monorepo root** and contains every Wave A commit SHA.
3. `npm run lint` (= `eslint . --max-warnings 0`) returns 0 errors and 0 warnings.
4. `npm run format:check` (= `prettier --check .`) green.
5. `npm run typecheck` still green (Phase 2a's gate not regressed by Phase 2b).
6. `npm run preflight` extended to include lint + format:check, green end-to-end.
7. No inline `any` (matched by `:\s*any\b|as\s+any\b|<any>|Record<[^>]*, any>|Map<[^>]*, any>`) survives in production code under `src/` excluding `src/lib/types/escape-hatches.ts` and test paths. Unfixable cases are routed through `escape-hatches.ts` (which uses `= any` syntax not matched by the regex); test files may carry `eslint-disable-next-line` exemptions (covered by item 8).
8. `eslint-disable-next-line @typescript-eslint/no-explicit-any` count outside `src/**/__tests__/**` and `*.{test,spec}.{ts,tsx}` is 0 (production code routes through escape-hatches).
9. `@ts-*` suppression count ≤5 (Phase 2a baseline preserved; no new suppressions from 2b).
10. New escape-hatches entries (if any) each carry `// TODO(phase-13):`, `Untyped*` prefix, call-site reference, justification. If 5+ new entries land, a fresh `TD-FE-<n>` (likely TD-FE-10) captures the Phase 2b pattern.
11. Scorecard merged at `docs/audits/<date>-frontend-phase-2b-eslint-prettier.md` per §4 Step 6.

The master plan's row for Phase 2b (Spec 14 §4) updates to `done` with the merge date — handled by `synthesize-impl-review` per Spec 14 §5.5.

---

## §6 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Step 0 probe surfaces `no-floating-promises` + `no-misused-promises` combined count above 300. | Plan author re-enters Wave D sub-decomposition (D-i / D-ii by area or by rule). Threshold re-validated at plan stage against actual numbers. |
| R2 | Per-site `no-explicit-any` fix balloons `escape-hatches.ts` beyond expected size (~30+ new entries). | Phase 2a's 5th-new-entry TD-FE pattern handles this — single TD-FE captures the structural signal. Implementer raises the pattern to user if accumulation grows to ~30+ — judgment call, no automatic trigger. Master spec line 298 puts post-hoc audit on Phase 13. |
| R3 | Wave A's Prettier mass-format breaks an area boundary (e.g., a shared file imported across areas surfaces formatting drift between commits). | Per-area commits use exact directory boundaries; no file lives in two areas. Wave A's final `.git-blame-ignore-revs` aggregation commit confirms all area-commits land before any lint work begins. |
| R4 | Type-aware lint rules slow `eslint .` materially (multi-minute lint defeats the agent-readiness goal). | `projectService: true` is the lazy-loaded API specifically designed for this. Step 0 measures lint wall-time; if it exceeds 60s on the full tree, plan stage decides whether to scope the type-aware rules to non-test files only, or downgrade them to per-feature when features land (Phase 5+). |
| R5 | Wave C `unknown` narrowing in catch blocks cascades — fixing `catch (e: any)` to `catch (e: unknown)` surfaces TS errors at every `.message` / `.code` access. | Same-commit fix; file-grain absorbs cascades. If a single catch-block fix cascades across many files, the file-by-file commit grain isolates the work; escape-hatch only if the cascade reveals an out-of-scope refactor per §2.4 posture rule 3. |
| R6 | Wave A's Prettier commits conflict with active Brewra-dev work in `master` (merge conflicts surface during the phase). | Branch off current `master` at the post-Phase-2a commit. The orchestrator confirms no uncommitted in-flight work before branch creation. Per master spec §1.3 and project memory, Brewra devs sync from old repos via `sync.sh`; the controller agent (CTO) coordinates timing if a sync is pending. |
| R7 | The 56 existing warnings include categories not foreseen here (e.g., test-file specifics that don't fit §3.3 override zones). | Step 0 probe enumerates every warning by rule × file. Plan stage refines override zones if Step 0 surfaces categories §3.3 missed. |
| R8 | `eslint-config-prettier` conflict — Prettier and ESLint have stylistic rules that overlap; without `eslint-config-prettier` applied last, lint and format fight. | `eslint-config-prettier` is in §2.1 Step 1's required install list and is configured last in the `extends` chain. Step 0 probe verifies no conflicts surface in the violation set. |
| R9 | Wave D `no-misused-promises` flags legitimate fire-and-forget patterns in JSX event handlers as errors (e.g., `<button onClick={asyncSubmit}>`). | Per-site fix with `void` wrapper is the default convention. If Step 0 surfaces many such cases, plan stage configures `no-misused-promises` with `checksVoidReturn: { attributes: false }` to relax for JSX attributes only (the runtime is fine in React). Decision documented in plan. |
| R10 | A future contributor's local `git blame` doesn't honor `.git-blame-ignore-revs` because they haven't set `blame.ignoreRevsFile`. | The header comment in `.git-blame-ignore-revs` documents the local-config command. GitHub UI honors the file automatically. Phase 14 (agent affordances) may add a one-time setup script to set the config; not in Phase 2b's scope. |

---

## §7 Open questions deferred to the plan stage

These do not block the spec — each becomes a plan-stage decision documented in `plans/18-frontend-phase-2b-eslint-prettier.md`:

1. **Step 0 re-baseline numbers.** Not known until execution start. Plan records exact post-Phase-2a-merge figures and notes any delta from the design-time 392-problem count + 224-inline-any anchor.
2. **Wave A split decisions per area.** Whether any area exceeds the 500-line split threshold; if so, sub-area boundaries.
3. **Wave B batching decisions.** Whether `consistent-type-imports` and `import/order` ship in one combined commit each or split by area. Driven by Step 0 diff-size measurement.
4. **Wave C within-pages ordering.** §4 Step 4 lists "small pages first"; plan picks exact small-page order from Step 0 per-file counts (likely error-count ascending).
5. **Wave D `checksVoidReturn` decision.** Whether `no-misused-promises` should configure `checksVoidReturn: { attributes: false }` to relax for JSX. Driven by Step 0's count of JSX-attribute-promise sites.
6. **`build-lint-probe.ts` location and reuse.** Step 0's helper script — extend Phase 2a's `build-strict-probe.ts` or write a sibling. Either lives under `frontend/scripts/` and is committed at Step 0.
7. **Prettier config validation.** Whether a quick dry-run against a representative file (e.g., `ICPSummaryOpportunity.tsx`) shows a smaller-diff alternative to §3.1's choices. Plan stage validates before Step 1 lands the production `.prettierrc`.
8. **`eslint-plugin-import` flat-config integration.** Plugin's flat-config support varies by version. Plan stage confirms `eslint-plugin-import@^2.31` (which added flat-config exports) vs `eslint-plugin-import-x` (the flat-config-native fork) — picks whichever resolves cleanly with `typescript-eslint@^8.0.1` + `eslint@^9.9.0`.
9. **Diff size reporting depth.** §4 Step 6 mandates `git diff --stat` in the scorecard. Plan decides whether to also break down by wave for impl-review's convenience, or leave as one aggregate.
10. **TD-FE numbering.** Continues from TD-FE-10 (current next slot) unless Phase 2c's spec preempts.

---

## §8 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan (§4 Phase 2b row updates to `done` at merge; §5.3 preflight Phase 2b row; §6 done-when items 5 and 6 apply)
- `specs/17-frontend-phase-2a-strict-ts-design.md` — Phase 2a spec (proven precedent for wave methodology, escape-hatches policy, scorecard format, posture rules)
- `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` — Phase 0 spec (the safety net Phase 2b relies on)
- `specs/16-frontend-phase-1-loc-reduction-design.md` — Phase 1 spec (the 6-check-kit template; TD-FE numbering convention)
- `docs/audits/2026-05-28-frontend-phase-2a-strict-ts.md` — Phase 2a scorecard (escape-hatches starting state with 6 entries; lint warning origin)
- `docs/audits/2026-05-26-frontend-baseline.md` — Phase 0a baseline (initial lint state context)
- `docs/TECH_DEBT.md` — TD-FE register (next slot TD-FE-10)
- Backend Spec 5 / Spec 12 — adjacent precedent for category-wave methodology in foundation phases
