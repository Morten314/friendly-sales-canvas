# Spec 18 — Frontend Phase 2b: ESLint type-aware + Prettier

**Status:** Design — round 2 (round 1 review synthesized at `docs/reviews/18-frontend-phase-2b-eslint-prettier-design-spec-synthesis-1.md`)
**Date:** 2026-05-28 (round 1), 2026-05-28 (round 2 revisions)
**Type:** Phase spec (descendant of `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 2b)
**Paired plan:** `plans/18-frontend-phase-2b-eslint-prettier.md` (written next)

---

## §1 Goal and context

### 1.1 Goal

Land ESLint type-aware rules + Prettier across the frontend in one short-lived branch. By end of phase:

- `frontend/eslint.config.js` enables the five mandated rules from master spec §4 Phase 2b: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`. Plus `import-x/order` from `eslint-plugin-import-x` (the flat-config-native fork — see §3.1.5) and stylistic-rule disabling via `eslint-config-prettier` applied last.
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
| Error origin (336) — verified per-rule | `@typescript-eslint/no-explicit-any` 233 · `no-empty` 46 · `no-useless-escape` 16 · `@typescript-eslint/ban-types` 11 · `@typescript-eslint/no-unsafe-assignment` 9 · `@typescript-eslint/no-unsafe-return` 6 · `@typescript-eslint/no-unsafe-member-access` 3 · `@typescript-eslint/no-empty-object-type` 3 · `@typescript-eslint/no-unused-expressions` 2 · `no-control-regex` 2 · `@typescript-eslint/ban-ts-comment` 2 · `react-hooks/rules-of-hooks` 1 · `no-case-declarations` 1 · `@typescript-eslint/no-require-imports` 1 (in `tailwind.config.ts`). **103 errors come from rules outside the 5 mandated set** — Phase 2b's scope (§2.1) and methodology (§4) cover all of them because `--max-warnings 0` requires it. |
| Warning origin (56) — verified per-rule | `react-hooks/exhaustive-deps` 35 · unused `eslint-disable` directives 13 · `react-refresh/only-export-components` 8. The dominant warning category is `exhaustive-deps` (62.5%), not `only-export-components` (14%) — Phase 2b's scope (§2.1) addresses both. |
| Inline `any` count | 224 (`rg -n ':\s*any\b\|as\s+any\b\|<any>' -g '*.ts' -g '*.tsx' src/`). Same regex as Phase 2a §1.3 — excludes multi-argument generics (`Record<string, any>`, `Map<string, any>`) and other positions the ESLint rule catches. The ESLint `no-explicit-any` rule reports **233 violations** (9 more than the regex), confirming the regex undercounts by ~4%. Step 0 probe re-measures. |
| `@ts-*` suppressions | 5 (unchanged from Phase 2a baseline) |
| Escape-hatches file | `src/lib/types/escape-hatches.ts` present with 6 entries from Phase 2a Wave B. Last TD-FE: TD-FE-9. Phase 2b continues this file; relocation to `src/shared/types/escape-hatches.ts` remains deferred to Phase 4. |
| Prettier installed | No. No `.prettierrc`, no `.prettierignore` (in `frontend/`), no `.git-blame-ignore-revs` (at monorepo root). |
| `eslint-plugin-import-x` installed | No. |
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
- Branch name: `phase-2b-eslint-prettier`, branched off `master` at the `master` HEAD at the time the branch is created (Phase 2a merge commit was `b22ca59`, master spec update was `ce08615`; later `master` advances are absorbed).
- Branch lifecycle: short-lived; deleted after merge per Spec 14 §5.1.

### 1.5 Why this structure (single phase, 4 waves)

The design-time count of `no-explicit-any` violations is **233** (verified by `eslint . --format json` at commit `80860ba`) — comparable to Phase 2a's Wave A (~327 `noUnused*` errors) and well under the 1,500 sub-decomposition trigger. The 4-wave layout (Wave A Prettier per-area, Wave B mechanical lint fixes, Wave C per-site type fixes, Wave D per-site semantic fixes) across 6 steps (Step 0 re-baseline + Step 1 config land + Steps 2–5 waves + Step 6 verify) gives each fix category its own commit cohesion without formal sub-phases.

**Step 0 threshold gates:**
- If the re-baseline probe surfaces `no-floating-promises` + `no-misused-promises` + `react-hooks/exhaustive-deps` combined count above 300, the plan author proposes a sub-decomposition of Wave D (D-i / D-ii by rule or by area). The 300 figure is a starting heuristic — the plan stage validates against actual measurements.
- **If the re-baseline surfaces rule categories not enumerated in §1.3's error/warning rows contributing ≥20 violations collectively, the plan author halts and re-enters a scope decision before continuing.** This catches unanticipated rule diversity beyond the round-1 verified set.

---

## §2 Scope

### 2.1 In scope

- **Install npm dependencies** in `frontend/`: `prettier`, `eslint-plugin-import-x` (the flat-config-native fork; see §3 rationale), `eslint-config-prettier`. Co-commit with the probe artifacts in Step 0 (the probe needs the deps to run). One npm install commit + one probe-artifact commit.
- **Update `frontend/eslint.config.js`** with the configuration target in §3:
  - Five new/re-enabled rules: `@typescript-eslint/no-explicit-any` (already error under current `recommended` — kept explicit), `@typescript-eslint/no-unused-vars` (re-enable from `off`), `@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`.
  - `eslint-plugin-import-x` registered; `import-x/order` configured per §3 alphabetical-grouped form.
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
- **Drive `eslint . --max-warnings 0` to green** by addressing all 336 errors + 56 warnings under the §1.3 verified breakdown. Per-rule disposition:
  - `@typescript-eslint/no-explicit-any` (233) — per-site fix in Wave C. Same posture as Phase 2a §2.4 Wave B/C: proper type when reasonable; escape-hatches entry when not; `eslint-disable-next-line` allowed only in test files (per §3.3 override zone).
  - `@typescript-eslint/no-unsafe-assignment` (9), `no-unsafe-return` (6), `no-unsafe-member-access` (3) — most resolve as side-effect of Wave C's `no-explicit-any` fixes (the rules fire on usage of `any`-typed values; once the upstream is typed, downstream usages narrow). Residual cases (the rule's count after Wave C completes) get individual per-site treatment within Wave C.
  - `@typescript-eslint/ban-types` (11) — Wave B `--fix` sweep (rule is mostly auto-fixable to specific types like `object`, `unknown`).
  - `@typescript-eslint/no-empty-object-type` (3) — Wave B `--fix` sweep where auto-fixable; manual fix otherwise.
  - `@typescript-eslint/no-floating-promises`, `no-misused-promises` (Step 0 counts) — per-site fix in Wave D.
  - `react-hooks/exhaustive-deps` (35 warnings) — per-site fix in Wave D. Each site is one of: add missing dep, wrap in `useCallback`/`useMemo`, use a ref for non-reactive values, or `eslint-disable-next-line react-hooks/exhaustive-deps` with one-line justification (this rule is the documented exception to §2.4 posture rule 10's "production code uses escape-hatches" pattern — the warnings legitimately need per-site judgment; no central abstraction helps).
  - `no-empty` (46), `no-useless-escape` (16), `no-control-regex` (2), `no-unused-expressions` (2), `no-case-declarations` (1), `@typescript-eslint/ban-ts-comment` (2), `react-hooks/rules-of-hooks` (1) — Wave B's manual mechanical residue. Each is a small per-site fix (add a `// intentional` comment for genuinely-empty blocks, remove unnecessary regex escapes, wrap case bodies in braces, etc.). 70 total fixes — comparable to a single area-grouping in Wave A; bundled by area into ~3–5 commits.
  - `@typescript-eslint/no-require-imports` (1, `tailwind.config.ts`) — Wave B / Step 1 override zone in `eslint.config.js`. The `require()` is intentional for Tailwind plugin loading.
  - `react-refresh/only-export-components` (8 warnings under `src/components/ui/`) — Wave B / Step 1 override zone. Shadcn primitives are locked from Phase 4 — restructuring their exports is out of scope.
  - Unused `eslint-disable` directives (13 warnings) — Wave B single commit removing them.
  - `@typescript-eslint/no-unused-vars` re-enable — likely ≤5 new violations after Phase 2a's `noUnused*` cleanup; Wave B residue commit if any.
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

These could be accidentally affected by lint/format changes and are explicitly frozen:

- **Visible UI is unchanged** (validated by visual regression at `maxDiffPixelRatio 0.01` in the preflight chain). Prettier reformatting JSX cannot change rendered output.
- **Existing Playwright behavioral journeys stay green.** Type narrowing and lint fixes must not change runtime control flow.
- **Existing Vitest characterization suite stays green.**
- **Public exports of `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/`.** Signatures may narrow further (when an explicit-any fix tightens a return type), but no rename, no removal, no semantic change. Test imports and e2e fixture imports must continue resolving.
- **`tsconfig.app.json` strict configuration from Phase 2a.** Phase 2b does not modify any TypeScript compiler flags. `typecheck` remains green throughout.
- **Existing 6 escape-hatches entries from Phase 2a.** Phase 2b may add new entries; it does not remove or rename Phase 2a's entries (Phase 13 audits all).
- **Type-level cascades from Wave C narrowing are in scope, not a frozen-interface violation.** Same logic as Phase 2a §2.3 — annotations tighten downstream call sites; cascade-related errors get fixed under the same wave's rules; file-grain commits absorb them. Runtime behavior unchanged.

Items the master spec freezes (HTTP API contract, routes, auth flow, rate-limit boundary, bundle output format) are not in this list because lint/format changes cannot reach them — they're protected by the master spec at a different layer.

### 2.4 Posture rules

When fixing a lint violation, the grain is "what the rule needs to be satisfied," not "what would make the file better." Specifically:

1. **Default fix:** add the proper type or apply the canonical lint-fix. For `no-explicit-any`: type the parameter, return, or assertion. For `consistent-type-imports`: ESLint `--fix` handles the conversion to `import type { ... }`. For `import-x/order`: ESLint `--fix` reorders. For `no-floating-promises`: add `await` if the call is in an async context, `void` prefix if fire-and-forget is intentional, or chain `.then`/`.catch` if neither. For `no-misused-promises`: extract a named wrapper function or use a void-returning arrow wrapper.
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
9. **Auto-fix commits contain only the rule's auto-fix output.** Wave B's per-rule sweeps run `eslint --fix --rule '{<rule>: "error"}'` against a target area; the resulting diff is committed verbatim with no manual edits added. Manual edits belong in Wave C/D. **Note:** Wave B's `--fix` diffs may include trivial whitespace changes on lines Prettier (Wave A) already moved — this is benign and expected. The posture-rule-9 purity check is "no non-rule-targeted code changes" rather than "no whitespace changes."
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

**Config is locked at the spec stage.** A pre-Step-1 sanity dry-run against a representative file (e.g., `src/components/customers/ICPSummaryOpportunity.tsx`) verifies Prettier behaves as expected; the dry-run does not change the config values.

### 3.1.5 `eslint-plugin-import-x` vs `eslint-plugin-import`

Phase 2b uses **`eslint-plugin-import-x`**, the flat-config-native fork. Rationale:

- Phase 2b is on ESLint v9 flat config (no legacy `.eslintrc` chain) and `typescript-eslint@^8.0.1`.
- `eslint-plugin-import@^2.31` added flat-config exports but inherits legacy CommonJS module-resolution paths that fight with `typescript-eslint`'s flat-config import semantics in some setups.
- `eslint-plugin-import-x` is the maintained fork built specifically for flat config; it has converged as the v9-ecosystem default.
- Rule names switch from `import/X` to `import-x/X` (e.g., `import/order` → `import-x/order`). The functionality is the same.

If a plan-stage probe shows `eslint-plugin-import@^2.31` resolves cleanly without parser-resolver conflicts, the plan author may switch back — the difference at end-state is a name prefix. Default: use `import-x`.

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

## §4 Methodology — 4 waves over 6 steps, all-rules-on

Six steps. `eslint .` is red between Step 1 and end of Wave D; `prettier --check .` is red between Step 1 and end of Wave A. `tsc --noEmit` (Phase 2a's gate) stays green throughout — acceptable because `master` stays green; only the phase branch is in flight. `vite build`, Vitest, and Playwright continue to pass mid-phase (esbuild transpiles without linting; tests don't lint).

### Step 0 — Re-baseline at execution start (two commits)

Run a probe against the current `master` state immediately on branch creation, with the new rules wired behind a throwaway config.

**Commit 0a — Install npm deps.** Add `prettier`, `eslint-plugin-import-x`, `eslint-config-prettier` to `frontend/package.json` devDependencies. `package-lock.json` updates. No other edits. Commit subject: `chore(fe): install prettier + eslint-plugin-import-x + eslint-config-prettier`.

**Commit 0b — Run probe + capture artifacts.** Write a throwaway `frontend/eslint.probe.config.js` that:
- Extends the current `eslint.config.js` shape.
- Adds the five new rules + `import-x/order` + `eslint-config-prettier`.
- Adds the §3.3 override zones (so the probe surface matches Step 1's production surface).
- Adds `languageOptions.parserOptions.projectService: true` for type-aware rules.

Run:
- `eslint . --config eslint.probe.config.js --max-warnings 0 --format json > docs/audits/<date>-frontend-phase-2b-lint-probe.json`
- `eslint . --config eslint.probe.config.js --max-warnings 0 > docs/audits/<date>-frontend-phase-2b-lint-probe.txt 2>&1`
- `prettier --check . > docs/audits/<date>-frontend-phase-2b-prettier-probe.txt 2>&1`
- Capture a directory enumeration: `find src components pages -maxdepth 2 -type d | sort > docs/audits/<date>-frontend-phase-2b-area-tree.txt` (so Wave C's plan-stage author validates the §4 Step 4 area order against the actual filesystem before ordering commits).

Generate a `frontend/scripts/build-lint-probe.ts` helper that runs the above and produces a per-rule × per-area roll-up in the JSON (modelled on Phase 2a's `build-strict-probe.ts`). The script may be committed for re-use; the probe config is deleted before commit.

Commit subject: `chore(audits): phase 2b lint+prettier re-baseline`.

**Probe-config lifecycle:** identical to Phase 2a's Step 0 — the helper creates `eslint.probe.config.js`, runs the probe, captures artifacts, then deletes the throwaway. Only the JSON + TXT + helper script land.

**Re-baseline output is the spec's official "before" anchor.** Phase 2a merged today, but any commit between this spec's drafting and execution start may shift counts.

**Step 0 threshold gates** (re-stated from §1.5):
- If `no-floating-promises` + `no-misused-promises` + `react-hooks/exhaustive-deps` combined count exceeds **300**, plan author proposes Wave D sub-decomposition (D-i / D-ii by rule or by area) before continuing.
- If the probe surfaces rule categories not listed in §1.3 contributing ≥**20 violations** collectively, plan author halts and re-enters a scope decision before continuing. This catches rule diversity beyond the round-1 verified set.

### Step 1 — Tool config + format infra (one commit)

Land the production config in one atomic commit:

- **Edit `frontend/eslint.config.js`:**
  - Add `import importX from "eslint-plugin-import-x";` and `import eslintConfigPrettier from "eslint-config-prettier";`.
  - Register `eslint-plugin-import-x` in `plugins` as `"import-x": importX`.
  - Add the five new rules (per §1.1) with `error` severity (test override zone downgrades two; see §3.3).
  - Configure `import-x/order` per §3:
    ```js
    "import-x/order": ["error", {
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
  Contributors who want `git blame` locally to skip Wave A's mass-format commits run the one-time `git config` command above. This is a contributor-education concern, not a phase risk.
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

**Split threshold:** if an area's `prettier --write` diff exceeds **250 line-changes**, split into sub-area commits (by sub-folder or by file group). The threshold is higher than Phase 2a Wave A's 60-line split because Prettier's output is mechanical and doesn't require careful per-line review, but lower than a fully-relaxed threshold to preserve commit-level bisection and revert granularity. One commit per area is the default.

**End-of-wave consolidation commit.** A single follow-up commit appends every Wave A SHA into `.git-blame-ignore-revs` at the monorepo root. Subject: `chore(fe): add Wave A prettier commits to git blame ignore-revs`.

**Wave-end checkpoint:** before starting Wave B, run two checks:

1. **Format verification.** `npm run format:check` → green.
2. **Unit-test health.** `npx vitest run` → green. (Prettier's reformatting shouldn't change semantics but template literal whitespace and chained method indentation can in rare cases. Catching breakage within Wave A is cheaper than at Step 6.)

`eslint .` still red (rules not yet auto-fixed).

### Step 3 — Wave B: Mechanical lint fixes (auto-fix + manual residue, ~6–10 commits)

Apply all mechanical lint fixes — both auto-fixable and small manual ones. Each commit contains only the rule's targeted output (posture rule 9). Wave B's expanded scope absorbs the rule categories §1.3 surfaced beyond the master spec's 5 mandated rules; per-site type fixes go to Wave C, semantic per-site fixes to Wave D.

**Auto-fix commit grain:**

- **`consistent-type-imports`** `--fix` sweep — one batched commit if the diff is small, or per-area if large. Subject: `refactor(fe): apply consistent-type-imports --fix`.
- **`import-x/order`** `--fix` sweep — same shape. Subject: `refactor(fe): apply import-x/order --fix`.
- **`@typescript-eslint/ban-types`** `--fix` sweep — rule is largely auto-fixable to specific types (e.g., `{}` → `object`, `Function` → `(...args: unknown[]) => unknown` or similar context-specific replacement). 11 errors expected, mostly resolved automatically. Subject: `refactor(fe): apply ban-types --fix`.
- **`@typescript-eslint/no-empty-object-type`** `--fix` where auto-fixable; manual fix otherwise. 3 errors. Subject: `refactor(fe): resolve no-empty-object-type`.
- **`@typescript-eslint/no-unused-vars`** residue — re-enabling the rule should surface ≤5 new violations after Phase 2a's `noUnused*` cleanup. Subject: `refactor(fe): resolve no-unused-vars residue` (skipped if zero violations).

**Manual mechanical residue commit grain** (bundled by area, ~3–5 commits):

These rules' violations are small mechanical fixes (not warranting per-file commits like Wave C):
- `no-empty` (46) — add a `// intentional` comment to genuinely-empty blocks; restructure if the empty body indicates dead code.
- `no-useless-escape` (16) — remove unnecessary backslash escapes in regex/strings.
- `no-control-regex` (2) — escape control characters properly or document the intentional use.
- `no-unused-expressions` (2) — fix the expression (likely typos like `foo === bar` instead of `foo = bar`) or remove.
- `no-case-declarations` (1) — wrap case body in braces (`case X: { const foo = ...; }`).
- `@typescript-eslint/ban-ts-comment` (2) — replace `@ts-ignore` with `@ts-expect-error: description` (the rule's preferred form). Note: this is reshaping existing suppressions, not adding new ones; the §5 item 9 count stays at ≤5.
- `react-hooks/rules-of-hooks` (1) — bug fix; restructure the hook call to satisfy ordering rules. **Verify behavior unchanged** (run Vitest + visual regression for the affected component).

Commit grain: bundled by area following Wave A's order. Each commit's subject specifies the area + rule scope, e.g., `refactor(fe): fix no-empty + no-useless-escape in src/components/customers`.

**Unused `eslint-disable` directives commit:** 13 warnings. Single commit removing them. Subject: `refactor(fe): remove unused eslint-disable directives`.

**Per-rule batching:** if a single rule's `--fix` output exceeds **300 line-changes** across the tree, split by area following Wave A's order. Otherwise one commit per rule.

**Wave-end checkpoint:** before starting Wave C, run two checks:

1. **Mechanical-fix verification.** `npm run lint` should now report violations only from the per-site type/semantic rules: `no-explicit-any`, `no-unsafe-*` family, `no-floating-promises`, `no-misused-promises`, `react-hooks/exhaustive-deps`. Verify the residual error categories match the probe artifacts.
2. **Unit-test health.** `npx vitest run` → green.

### Step 4 — Wave C: per-site type fixes (file-by-file commits, ~30–60 commits)

Targets `@typescript-eslint/no-explicit-any` (233 sites verified) and the `no-unsafe-*` cascade family (`no-unsafe-assignment` 9, `no-unsafe-return` 6, `no-unsafe-member-access` 3 = 18 total). The cascade family largely resolves as a side-effect of `no-explicit-any` fixes — when an `any` value is typed at the upstream, downstream usages narrow and the rules stop firing. Per-site treatment is only needed for residual `no-unsafe-*` violations that don't auto-resolve.

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

1. **`no-explicit-any` + `no-unsafe-*` verification.** `npm run lint 2>&1 | grep -E 'no-explicit-any|no-unsafe-' | wc -l` returns 0 outside test paths (or matches the expected residual count from `eslint-disable-next-line` exemptions in test files). The production config is used directly (no `--no-eslintrc` flag — that's a legacy-config option not valid under ESLint v9 flat config).
2. **Unit-test health.** `npx vitest run` → green.

### Step 5 — Wave D: per-site semantic fixes (file-by-file commits)

Targets type-aware semantic rules: `no-floating-promises`, `no-misused-promises` (counts unknown until Step 0 probe), and `react-hooks/exhaustive-deps` (35 warnings). All three require per-site judgment about intent. Same posture as Wave C.

**Fix rules:**

- **`no-floating-promises`:**
  - Async call in async context → `await`.
  - Fire-and-forget intentional → `void` prefix (`void doSomethingAsync()`).
  - Effect cleanup or unmount handler → use `.catch(handleError)` or extract a named async wrapper.
- **`no-misused-promises`:**
  - Promise passed to a non-promise-expecting context (e.g., `setTimeout(asyncFn, ...)`) → extract a named wrapper function rather than an inline IIFE when the wrapped call appears multiple times or has surrounding logic; an inline `() => { void asyncFn(); }` is acceptable for one-off cases but obscures intent at heavier call sites.
  - Async event handler attached to JSX prop (e.g., `<button onClick={asyncFn}>`) → if Step 0 surfaces many of these, the plan stage may configure `no-misused-promises` with `checksVoidReturn: { attributes: false }` to relax for JSX attributes (the runtime behavior is fine in React). Decision recorded in plan stage.
- **`react-hooks/exhaustive-deps`** (35 warnings):
  - Missing dependency → add it to the deps array.
  - Dependency intentionally omitted (e.g., single-shot effect) → restructure with `useCallback`/`useMemo`, use a ref for non-reactive values, or `// eslint-disable-next-line react-hooks/exhaustive-deps` with a one-line justification. **This rule is the documented exception to §2.4 posture rule 10** — exhaustive-deps overrides legitimately need per-site judgment that no shared abstraction helps. Each disable must carry the justification comment in the same commit.

**Escape-hatches:** rarely needed for these rules; fixes are usually mechanical. If a site genuinely needs an escape (e.g., a Promise whose contract can't be tightened), follow Wave C's same policy.

**Commit grain:** file-by-file with the same ≤3/>3 batching threshold as Wave C.

Subject: `fix(fe): resolve floating/misused promises in <file>`, `fix(fe): resolve exhaustive-deps in <file>` (or `<area>` when bundled).

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
- `npm run lint 2>&1 | grep 'no-explicit-any' | wc -l` returns 0 (the primary check — `eslint . --max-warnings 0` is already green per item 3, so this is a redundant sanity check that any residual cases would surface; preferred over a regex-based gate because the regex misses positions like `Function`, `...args: any[]`, type-parameter defaults).
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

1. `frontend/eslint.config.js` enables the five mandated rules + `import-x/order` (from `eslint-plugin-import-x`) + `eslint-config-prettier` (applied last). Type-aware parser config (`projectService`) wired. Override zones for `src/components/ui/`, root configs, and test files present per §3.3.
2. `frontend/.prettierrc` and `frontend/.prettierignore` present in the frontend root. `.git-blame-ignore-revs` present at the **monorepo root** and contains every Wave A commit SHA.
3. `npm run lint` (= `eslint . --max-warnings 0`) returns 0 errors and 0 warnings.
4. `npm run format:check` (= `prettier --check .`) green.
5. `npm run typecheck` still green (Phase 2a's gate not regressed by Phase 2b).
6. `npm run preflight` extended to include lint + format:check, green end-to-end.
7. `npm run lint` reports 0 `no-explicit-any` violations and 0 `no-unsafe-*` violations in production code paths (i.e., `eslint .` over `src/` excluding `src/**/__tests__/**`, `*.{test,spec}.{ts,tsx}`, and explicit `eslint-disable-next-line` exemptions covered by item 8). Unfixable cases are routed through `src/lib/types/escape-hatches.ts` (Phase 2a discipline continues).
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
| R10 | Step 0 probe surfaces rule categories not enumerated in §1.3 contributing significant violation counts beyond the 20-threshold gate. | §1.5 / §4 Step 0's categorization gate halts execution at threshold breach; plan author re-enters scope decision. The round-1 review caught the design-time gap (103 errors + 35 warnings from un-anticipated rules); the gate prevents the same gap from compounding at execution time. |

---

## §7 Open questions deferred to the plan stage

These do not block the spec — each becomes a plan-stage decision documented in `plans/18-frontend-phase-2b-eslint-prettier.md`:

1. **Step 0 re-baseline numbers.** Not known until execution start. Plan records exact post-Phase-2a-merge figures and notes any delta from the design-time anchors (392 problems, 233 no-explicit-any, 35 exhaustive-deps).
2. **Wave A split decisions per area.** Whether any area exceeds the 250-line split threshold; if so, sub-area boundaries.
3. **Wave B batching decisions.** Whether the auto-fix sweeps (`consistent-type-imports`, `import-x/order`, `ban-types`, `no-empty-object-type`) ship in one combined commit each or split by area; whether the manual mechanical residue commits group by rule or by area. Driven by Step 0 diff-size measurement.
4. **Wave C within-pages ordering.** §4 Step 4 lists "small pages first"; plan picks exact small-page order from Step 0 per-file counts (likely error-count ascending).
5. **Wave D `checksVoidReturn` decision.** Whether `no-misused-promises` should configure `checksVoidReturn: { attributes: false }` to relax for JSX attributes. Driven by Step 0's count of JSX-attribute-promise sites.
6. **`build-lint-probe.ts` location and reuse.** Step 0's helper script — extend Phase 2a's `build-strict-probe.ts` or write a sibling. Either lives under `frontend/scripts/` and is committed at Step 0.
7. **Diff size reporting depth.** §4 Step 6 mandates `git diff --stat` in the scorecard. Plan decides whether to also break down by wave for impl-review's convenience, or leave as one aggregate.
8. **TD-FE numbering.** Continues from TD-FE-10 (current next slot) unless Phase 2c's spec preempts.

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
