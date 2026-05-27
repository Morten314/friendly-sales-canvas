---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 5
---

## Context

Round 5. All four prior round findings appear resolved in the current text — the escape-hatch cadence contradiction, ripgrep command syntax, sub-flag count, `@ts-*` posture rule, probe-config redundancy, interim-path TD-FE, `Untyped*` aliasing caveat, informal register, and sub-flag copy-paste. This round focuses on newly discovered issues, including one verified against the live codebase.

## Findings

### [Critical] `npm run typecheck` checks zero files — the done-when gate is non-functional

**Location:** §1.1 line 18, §3 Step 5 line 297, §4 item 3 line 324, §4 item 8 line 330

`package.json` defines `"typecheck": "tsc --noEmit"` — no `-p` flag. This invokes `tsc` against the root `tsconfig.json`, which has `"files": []` and `"references"` but no `"include"`. With zero files in scope, `tsc --noEmit` exits 0 immediately, always. Verified live:

```
$ npx tsc --noEmit; echo $?
0
```

By contrast, `tsc --noEmit -p tsconfig.app.json` returns exit code 2 with 28 errors under the current non-strict baseline — confirming the app config is the functional compilation target.

**Impact:** Every done-when gate that relies on `npm run typecheck` is trivially satisfied:
- §4 item 3: "tsc --noEmit (via npm run typecheck) returns zero errors" — always true.
- §4 item 8: "npm run preflight green" — preflight starts with `npm run typecheck`, which always passes.
- §3 Step 5 verification checklist: "npm run typecheck → 0 errors" — always true.

An implementer could merge the branch with 461+ strict errors still present, and all formal gates would report green.

**Note:** The wave-end checkpoints (§3 Steps 2–4) use `node_modules/.bin/tsc -p tsconfig.app.json --noEmit` — these correctly target the app config. The methodology's intermediate checks work; only the formal done-when and preflight gates are broken.

**Fix:** The spec must require changing the typecheck script to `tsc --noEmit -p tsconfig.app.json` (or another invocation that actually checks `src/`). This is a Phase 2a scope change — it modifies `package.json`'s scripts section. The change should be called out explicitly in §2.1 in scope and land in Step 1b alongside the flag flip, so that subsequent wave-end checkpoints and the Step 5 verification both exercise the same invocation.

### [Medium] Root tsconfig.json override removal is functionally irrelevant — presented as a typecheck requirement

**Location:** §2.1 line 68, §3 Step 1b lines 198–199, §4 item 2 line 322

The spec requires removing four relaxing overrides (`noImplicitAny: false`, etc.) from the root `tsconfig.json`. But `tsconfig.app.json` does not `"extends": "./tsconfig.json"` — it is a self-contained config. The root config's `compilerOptions` affect only files in the root project (currently zero, because `"files": []`). They do not propagate to referenced projects, do not affect `tsc -p tsconfig.app.json`, and do not affect the IDE for `src/` files (VS Code resolves each file to its owning tsconfig, which for `src/**` is `tsconfig.app.json`).

The removal is harmless housekeeping — preventing a future reader from being confused by contradictory settings in the root. But the spec presents it as a functional typecheck requirement on par with the app-config flag flip ("one config edit" in §2.1, paired with the flag flip in Step 1b). This overstates its role and could mislead a plan author into thinking both edits are equally load-bearing.

**Suggestion:** Recast the root-config edit as a housekeeping step. Either:
- Move it to a separate Step 1b sub-commit with an explicit "non-functional — IDE alignment only" note, OR
- Keep it co-committed with the app-config flip but add a note: "This edit does not affect the typecheck gate; tsconfig.app.json is self-contained. The removal prevents IDE confusion if the root config is ever used as a base for a new referenced project."

### [Medium] No mid-phase test-suite health checkpoint

**Location:** §3 Steps 2–4 wave-end checkpoints (lines 230, 273, 291)

The wave-end checkpoints verify only `tsc` error counts. They do not run Vitest or Playwright. The spec states (§3 opening paragraph, line 121) that "Vitest and Playwright continue to pass mid-phase," but this is an assertion, not a verified property.

A Wave A deletion that removes an internal symbol used by a test file (missed by the public-export protection rule because the symbol is not a public export of `src/lib/` etc.) would break tests. The break would be invisible until Step 5's full preflight — potentially 20+ commits later. The residual-fix commit at Step 5 would then carry accumulated test fixes that are hard to review in isolation.

R3 addresses the public-export case, but test files import internal symbols too (e.g., `import { helper } from '../components/Foo'` in a co-located `Foo.test.tsx`). The spec's public-export protection (§2.3 line 98) covers `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/` — but not `src/components/`, `src/pages/`, or `src/services/`.

**Suggestion:** Add a lightweight mid-phase checkpoint at the Wave A→B boundary (or at each wave-end): `npx vitest run` — not the full preflight, just the unit tests. The runtime is typically seconds. This catches test-breaking deletions within one wave rather than accumulating them to the end.

### [Low] Inline-any regex undercounts generic-parameter `any` usage

**Location:** §1.3 line 39, §3 Step 5 line 299, §4 item 6 line 327

The regex `:\s*any\b|as\s+any\b|<any>` captures type annotations (`: any`), type assertions (`as any`), and angle-bracket casts (`<any>`). It does not capture `any` in generic type arguments such as `Record<string, any>`, `Promise<any>`, `Array<any>`, or `Partial<any>`. In these positions, `any` is preceded by `, ` or `<` — neither matched by the three alternatives.

Since the same regex is used for both the §1.3 baseline (238) and the §4 item 6 non-regression gate (≤238), the delta property holds — no net-new `any` of the measured forms can slip through. But the "238 existing inline any types" characterization understates actual `any` prevalence. This is a measurement gap, not a gate gap.

**Suggestion:** Either (a) note the undercount explicitly in §1.3 ("counts `any` in type-annotation, assertion, and cast positions only; does not count generic type arguments — Phase 2b's lint rule covers all positions"), or (b) extend the regex to `\bany\b` minus known false positives (e.g., string literals, comments). Option (a) is simpler and consistent with the spec's delta-only use of the count.

### [Low] Wave C TS2307 re-verification lacks an explicit remediation path

**Location:** §3 Step 4 line 277

Step 4 opens with "a re-verification on the first Step-4 commit that TS2307 residue is 0 (Step 1a's deletes should have eliminated all 15)." If this re-verification fails, the spec doesn't specify what to do. Options include: (a) return to Step 1a's deletion procedure for the surviving file, (b) handle as a Wave C semantic error, or (c) defer with a TD-FE. The spec should state the default — likely (a), since TS2307 ("cannot find module") is a dead-import problem, not a type-narrowing problem.

### [Nit] `tsconfig.node.json` already has `strict: true` — spec doesn't note the asymmetry

**Location:** §1.3

The node config (`tsconfig.node.json`, covering `vite.config.ts`) already has `"strict": true` with `noUnusedLocals: false` and `noUnusedParameters: false`. The app config has `strict: false`. The spec never mentions this asymmetry. Not a functional concern (the node config is out of scope per §2.2), but a reader comparing the two configs might wonder why `vite.config.ts` is already strict while `src/` is not. A one-line note in §1.3 ("`tsconfig.node.json` already carries `strict: true`; Phase 2a does not change it") would preempt the question.
