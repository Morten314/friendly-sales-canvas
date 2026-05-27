---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 3
---

## Findings

### [High] `strict: true` enables more sub-flags than the spec acknowledges

**Location:** §1.1, line 16 — "`strict: true` implies `strictNullChecks: true`"

The spec discusses only `strictNullChecks` as the transitive implication of `strict: true`, but `strict: true` also enables `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and `alwaysStrict`. The 461-error baseline was produced by the Step 0 probe config which sets `strict: true`, so the count is accurate — errors from all sub-flags are captured. But the textual narrative repeatedly frames the change as "six strict-mode behaviors" (§1.1, §3 Step 1b line 180) when it is actually seven (the five explicit flags plus all six `strict` sub-flags, with overlap on `noImplicitAny`). This creates a risk that implementers or reviewers underestimate what `strict: true` turns on. The spec should either enumerate all `strict` sub-flags or replace the `strictNullChecks`-specific language with "`strict: true` enables all strict sub-flags."

### [High] Escape-hatch `any`s are invisible to the regression check

**Location:** §3 Step 3, escape-hatch example (line 237) — `export type UntypedLeadFilter = any;`; §4 DoD item 6 (line 309) — regex `:\s*any\b|as\s+any\b|<any>`

The escape-hatch pattern uses `type UntypedX = any;` syntax. The done-when regression check regex matches `: any`, `as any`, and `<any>` — but not `= any`. Every escape-hatch entry adds `any` to the codebase that the regression check cannot see. The DoD says "inline any count ≤238" without stating that escape-hatch `any`s are exempt from this count. Since escape-hatch entries are tracked separately in their own file with mandatory formatting, the implicit exemption is defensible, but it must be stated explicitly. Otherwise an impl-review could flag a ≤238 pass as misleading when the escape-hatch file contains 10+ `any`s.

**Suggestion:** Add a sentence to §4 DoD item 6: "Escape-hatch entries in `src/lib/types/escape-hatches.ts` are exempt from this count; they are tracked separately under DoD item 5." Alternatively, amend the regex to also match `= any\b` so the check is comprehensive and the count is honest.

### [High] No discussion of `skipLibCheck` or `compilerOptions.types`

**Location:** §3 Step 1b (lines 178–183) — flag flip details

The spec is exhaustive about which flags change in `tsconfig.app.json` and `tsconfig.json` but does not mention `skipLibCheck` or `compilerOptions.types`. If `skipLibCheck: true` is currently set (common in Vite-generated configs), it suppresses type-checking of `.d.ts` files, which could hide errors from third-party type declarations that strict mode would otherwise surface. Similarly, an explicit `types` array in `compilerOptions` limits which `@types/*` packages are included. R10 (TS7016 "could not find declaration file") acknowledges the risk of missing `@types/*` packages but doesn't address whether `skipLibCheck` masks them. The Step 0 probe config inherits from `tsconfig.app.json`, so the 461 count would reflect the effective `skipLibCheck` state — but the spec should document what that state is and whether it's intended to remain.

**Suggestion:** Add a row to the §1.3 starting-state table for `skipLibCheck` and `compilerOptions.types` values, or add a note to Step 0 confirming the probe inherits whatever `skipLibCheck` is currently set and the spec considers that acceptable.

### [Medium] Wave B "file-by-file" commit grain lacks a batching threshold

**Location:** §3 Step 3, lines 245–251 — "Commit grain: file-by-file"

Wave A uses area-based commits with a 60-line split threshold (line 208). Wave C uses file-by-file commits (line 269). Wave B says "file-by-file" but then notes "or `refactor(fe): type <area>` when a batch of small files in one area is bundled" (line 251) — an afterthought, not a rule. With 83 TS7006 errors potentially spread across 40+ files (many with 1–2 errors each), strictly file-by-file commits could produce 30–40 commits for Wave B alone. This is excessive for review and bisect purposes, and inconsistent with Wave A's pragmatic area-based approach.

**Suggestion:** Add a batching threshold for Wave B analogous to Wave A's 60-line rule. For example: "Files with ≤3 errors in the same area may be bundled into one commit; files with >3 errors get individual commits."

### [Medium] Escape-hatch batch-of-5 TD-FE mechanism is overengineered

**Location:** §3 Step 3, escape-hatches policy (lines 227–243)

The escape-hatch mechanism specifies: soft cap of 5, TD-FE registration at the 5th entry, another TD-FE at every subsequent batch of 5 (entries 10, 15, 20…), no hard cap, no phase halt. This is a multi-layered policy apparatus for what is essentially "if you need `any`, put it in a file and document why." Given the 461-error surface and the spec's own estimate that escape hatches will be rare (the default state is "empty or absent"), the batch-of-5 TD-FE trigger adds process overhead without proportional practical benefit. The mechanism reads like it was designed for a phase that would produce dozens of escape hatches — but if that happens, the phase has a deeper problem that TD-FE tracking won't solve.

**Suggestion:** Simplify to: "Document each escape-hatch entry with `// TODO(phase-13):` and call-site reference. If the count exceeds 10, raise a flag to the user for pattern review. Phase 13 audits all entries." Remove the batch-of-5 TD-FE cadence.

### [Medium] Escape-hatch example cross-references Phase 3 incorrectly

**Location:** §3 Step 3, escape-hatch example (lines 234–236) — "Phase 3 owns those"

The example comment says "Phase 3 owns those" referring to backend contract types. Per the master spec (Spec 14) and this spec's own §2.2, Phase 3 is "TanStack Query adoption, three-cache collapse, rate-limit centralization" — not backend contract type creation. If the example is meant to be illustrative only, this is a nit. But if an implementer reads it as a factual cross-reference, they may defer typing to a phase that won't do the work.

**Suggestion:** Either correct the cross-reference to whichever phase actually owns contract types (likely Phase 3's TanStack Query work would create query-key types, but that's not "backend contract types"), or make the example clearly hypothetical by using `<phase>` or a more generic justification.

### [Medium] Wave-end checkpoints only check for "short" drops, not "high" (cascades)

**Location:** §3 Step 2, lines 212 — "confirm the count dropped by approximately 327"; §3 Step 3, line 253 — "confirm a further drop of approximately 83"

The checkpoints check whether the error count dropped by the expected amount and flag if the drop is "materially short" (off by >30). They do not flag if the drop is *materially higher* than expected, which would indicate that Wave A/B fixes introduced new errors (cascading strict errors from narrowing). The spec acknowledges cascades exist (R4, §2.3 frozen interfaces) but the checkpoint only guards one direction.

**Suggestion:** Add symmetric language: "If the drop is materially short OR materially exceeds the expected count (suggesting cascade), pause to investigate."

### [Medium] Test-file-specific guidance absent from posture rules

**Location:** §2.4 posture rules (lines 99–109); §5 R8 (line 328)

R8 acknowledges that test files are in scope for strict errors. But the posture rules in §2.4 are written for application code. Test files have distinct patterns: mock objects with partial shapes, `any`-typed fixtures, unused parameters in test helper signatures, intentionally incomplete type assertions. The escape-hatch and `_argName` conventions apply, but test-specific guidance would prevent an implementer from over-typing test mocks or creating escape-hatch entries for what is normal test code.

**Suggestion:** Add a brief "Test file conventions" sub-section to §2.4, or add a row to the §2.4 list: "Test-file mocks and fixtures may use explicit `any` for partial shapes without consuming the escape-hatch budget; add `// TODO(phase-2b):` if the mock should be typed later."

### [Medium] §3 opening says "Build is red" but only typecheck is red

**Location:** §3, line 115 — "Build is red between Step 1b and end of Step 4"

`vite build` transpiles via esbuild without typechecking, so the build stays green. Only `tsc --noEmit` (i.e., `npm run typecheck`) is red. The sentence later clarifies "Vitest and Playwright continue to run mid-phase (esbuild transpiles without typechecking)" — which directly contradicts "Build is red." An implementer skimming the methodology intro could unnecessarily avoid running `vite build` mid-phase.

**Suggestion:** Replace "Build is red" with "`tsc --noEmit` is red" or "`npm run typecheck` is red."

### [Medium] Wave B carries highest per-error uncertainty but reads as equally mechanical

**Location:** §3 Step 3 (lines 214–253)

Wave A (delete unused symbols) is mechanical. Wave C (36 semantic stragglers) is small. Wave B (83 implicit-any annotations) requires understanding the intent of each untyped parameter and finding the correct type — often by reading upstream/downstream code, checking API contracts, or examining component props. The spec presents all three waves as equally deterministic, but Wave B is where surprises cluster. The 1,500-error sub-decomposition trigger (R1) won't fire here (83 is well under), but per-error complexity in Wave B is materially higher than Wave A.

**Suggestion:** Add a note to §3 Step 3 acknowledging higher per-error uncertainty and suggesting that implementers budget disproportionately more time per Wave B error than per Wave A error.

### [Medium] No mention of `strictPropertyInitialization` error class

**Location:** §3 Step 4, error code list (line 255)

The error code histogram at §1.3 includes no TS2564 ("Property has no initializer and is not definitely assigned in the constructor") entries. This is a `strict: true` sub-flag (`strictPropertyInitialization`). If the probe ran with `strict: true`, TS2564 errors should have appeared for any class with uninitialized properties — but they're absent. This could mean (a) the codebase has no such patterns (plausible for a React function-component codebase), or (b) the probe config was subtly different. The spec should explicitly note the absence and confirm it's expected, so that an implementer who encounters TS2564 during execution knows it's a deviation from the baseline rather than a new category.

**Suggestion:** Add a note to §1.3 or §3 Step 4: "TS2564 (strictPropertyInitialization) and TS2683 (noImplicitThis) are absent from the baseline. If they surface during execution, they belong in Wave C."

### [Low] 6-check kit for dead-shadcn deletions cross-references Spec 16 without inline summary

**Location:** §3 Step 1a (lines 149–173)

Each batch commit "applies Phase 1's 6-check kit." The kit is defined in Spec 16 (Phase 1). For plan-readiness, an implementer must cross-reference another spec to find the exact commands. Including a one-line summary of each check (e.g., `rg -l "basename" src/`) would make the spec more self-contained without duplicating the full kit.

**Suggestion:** Add a parenthetical after "Phase 1's 6-check kit" with the one-liner for each check, or defer explicitly to the plan stage to extract them.

### [Low] Surprise-inbound procedure defaults to defer; small refactors should be attempted first

**Location:** §3 Step 1a, surprise-inbound procedure (lines 175)

The default for a surprise inbound is (c) defer with TD-FE. But option (b) "refactoring the inbound to remove the dependency" could be trivial in some cases (e.g., replacing a shadcn `Calendar` with native `<input type="date">`). Always deferring without attempting (b) for simple cases accumulates TD-FE entries unnecessarily.

**Suggestion:** Change the default to "attempt (b) if the refactor is ≤10 lines; otherwise default to (c)."

### [Low] "Five linting flags" terminology is inaccurate

**Location:** §1.1 (line 16), §3 Step 1b (line 179)

`strict` is a compiler mode, not a linting flag. `noUnusedLocals` and `noUnusedParameters` are style/lint flags. `noImplicitAny` is a type-checking flag. `noFallthroughCasesInSwitch` is a control-flow analysis flag. Grouping them all as "linting flags" mischaracterizes what `strict: true` does. This is a terminology nit that could confuse readers who expect "linting" to mean ESLint-style rules.

**Suggestion:** Use "strict-mode compiler flags" or "typecheck flags" instead of "linting flags."

### [Low] Scorecard has 7 sections — potentially disproportionate effort for the phase's scale

**Location:** §3 Step 5, scorecard (lines 285–295)

The scorecard requires: error count delta, per-area delta table, deleted-file LOC deltas, escape-hatch inventory, TD-FE entries, commit-by-commit annotated summary, and diff-size breakdown with dead-shadcn carve-out. For a phase that should take 1–2 days of implementation, producing this scorecard is non-trivial. Sections 2 (per-area delta table) and 6 (commit-by-commit annotated summary) in particular require effort disproportionate to their review value.

**Suggestion:** Keep sections 1, 3, 4, 5, 7. Drop section 2 (redundant with Step 0 JSON) and simplify section 6 to a summary paragraph rather than per-commit annotation.

### [Nit] Bare `_` explanation is slightly imprecise about TS behavior

**Location:** §2.4 posture rule 5, line 109 — "TypeScript honors bare `_` as 'intentionally unused' for `noUnusedParameters`"

This is correct for a single `_` parameter. But TypeScript also allows multiple `_` in the same parameter list without error (since TS 4.0). The spec says bare `_` "collides when multiple unused parameters appear in one signature" (line 109), which is outdated — TS 4.0+ allows repeated `_`. The `_argName` convention is still better for documentation, but the collision justification is wrong.

**Suggestion:** Replace the collision justification with "named `_argName` preserves the documentation of what the parameter would have been called."

### [Nit] Frozen-interfaces "visible UI" constraint is a validation, not a constraint

**Location:** §2.3 (line 90) — "Visible UI — visual regression at maxDiffPixelRatio 0.01 stays green"

Type-only edits shouldn't change visible UI. If visual regression catches a difference, it means the type change inadvertently altered runtime behavior, violating the posture rules. Listing "visible UI" as a frozen interface is listing a tautology: "if you don't change behavior, behavior doesn't change." The value is in the validation (running the regression), not in the constraint itself.

**Suggestion:** Move this from "frozen interfaces" to the Step 5 verification checklist (where it already lives as `npm run preflight` green).

### [Nit] Step 0 re-baseline probe config cleanup not specified

**Location:** §3 Step 0 (lines 117–142)

The spec says the probe config is "not committed; built and removed in Step 0" (line 124). But who builds it, and who removes it? The `build-strict-probe.ts` script (open question 6) presumably handles this, but the cleanup step isn't in the spec. This is minor since the plan stage will detail it, but worth noting.

**Suggestion:** Add to Step 0: "The probe config file is created by the probe script and deleted before the Step 0 commit."
