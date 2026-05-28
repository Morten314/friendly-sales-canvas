---
artifact: specs/18-frontend-phase-2b-eslint-prettier-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 1
---

## Context

Verified spec claims against the live codebase at commit `80860ba` (post-Phase-2a merge). The spec's §1.3 starting-state table was cross-checked by running the actual eslint output and parsing per-rule counts. The numbers diverge materially — see Critical findings below.

## Findings

### Critical — §1.3 error-origin breakdown is factually wrong; ~103 pre-existing errors are unaccounted for

**Location:** §1.3 table row "Error origin (336)" and §4 Methodology

The spec claims: *"Predominantly `@typescript-eslint/no-explicit-any` … 224 inline `any` sites yield ~330+ violations"* plus *"1× `@typescript-eslint/no-require-imports`."* Implied: ~330 no-explicit-any + ~6 other = 336.

**Actual per-rule breakdown (from `eslint . --format json` at `80860ba`):**

| Rule | Count |
|---|---|
| `no-explicit-any` | 233 |
| `no-empty` | 46 |
| `no-useless-escape` | 16 |
| `ban-types` | 11 |
| `no-unsafe-assignment` | 9 |
| `no-unsafe-return` | 6 |
| `no-empty-object-type` | 3 |
| `no-unsafe-member-access` | 3 |
| `ban-ts-comment` | 2 |
| `no-unused-expressions` | 2 |
| `no-control-regex` | 2 |
| `rules-of-hooks` | 1 |
| `no-case-declarations` | 1 |
| `no-require-imports` | 1 |
| **Total errors** | **336** |

The spec attributes nearly all 336 errors to `no-explicit-any`. In reality, 103 errors (30%) come from 13 other rules the spec never mentions. The entire methodology — Waves B, C, D — only plans fixes for the 5 mandated rules + `import/order`. These 103 pre-existing errors will block the §5 done-when gate ("`npm run lint` returns 0 errors and 0 warnings") unless addressed.

**Required fix:** Either (a) expand scope to enumerate and resolve these pre-existing violations (with corresponding wave/step additions), (b) add override zones for rules the team chooses not to fix now (each logged as TD-FE), or (c) acknowledge in §1.3 that the 336 count includes pre-existing violations from rules outside the 5 mandated set and specify exactly how they'll be handled before `--max-warnings 0` is wired in Step 1.

---

### Critical — §1.3 warning-origin breakdown is factually wrong; 35 `exhaustive-deps` warnings are invisible

**Location:** §1.3 table row "Warning origin (56)"

The spec claims: *"Predominantly `react-refresh/only-export-components` from `src/components/ui/` shadcn primitives; 13× 'unused eslint-disable directive'."*

**Actual breakdown:**

| Rule | Count |
|---|---|
| `react-hooks/exhaustive-deps` | 35 |
| (unused directive — `None`) | 13 |
| `react-refresh/only-export-components` | 8 |
| **Total warnings** | **56** |

`exhaustive-deps` is the dominant warning category (35/56 = 62.5%), not `only-export-components` (8/56 = 14%). The spec's methodology §4 Step 2 plans to silence `only-export-components` via the `src/components/ui/**` override zone (8 warnings handled). Step 3 plans to remove 13 unused directives (13 handled). But the 35 `exhaustive-deps` warnings — the majority — are not addressed by any wave, override zone, or §2.1 scope item.

**Required fix:** The 35 `exhaustive-deps` warnings must be addressed somehow: (a) per-site fixes in a new wave or sub-wave, (b) override zone to downgrade, or (c) explicit out-of-scope deferral with a TD-FE entry and a relaxation of the done-when gate. The spec currently does none of these.

---

### Critical — Done-when gate §5 item 3 is unachievable with the current methodology

**Location:** §5 item 3, §4 Methodology

The spec's definition of done requires:

> `npm run lint` (= `eslint . --max-warnings 0`) returns 0 errors and 0 warnings.

But the methodology only plans fixes for: `no-explicit-any` (Wave C), `no-floating-promises` + `no-misused-promises` (Wave D), `consistent-type-imports` + `import/order` + `no-unused-vars` residue (Wave B), `only-export-components` override (Step 1), and 13 unused directives (Wave B).

That leaves unresolved: 46 `no-empty`, 16 `no-useless-escape`, 11 `ban-types`, 9 `no-unsafe-assignment`, 35 `exhaustive-deps`, 6 `no-unsafe-return`, 3 `no-empty-object-type`, 3 `no-unsafe-member-access`, 2 `ban-ts-comment`, 2 `no-unused-expressions`, 2 `no-control-regex`, 1 `rules-of-hooks`, 1 `no-case-declarations` = **138 violations** that the spec neither fixes nor acknowledges.

The Step 0 probe will surface these — but the spec frames the probe as a "re-baseline" confirming design-time counts, not as a discovery mechanism for unanticipated violation categories. There is no mechanism in the spec for the probe to trigger scope expansion.

**Required fix:** Either the methodology gains a wave/step for pre-existing violations, or the done-when gate is relaxed to "0 errors and 0 warnings from the 5 mandated rules + import/order" (with remaining violations tracked separately), or Step 0's charter is expanded to include a categorization gate that may trigger scope revision.

---

### High — §7 Open Question 8 (`eslint-plugin-import` vs `eslint-plugin-import-x`) is a spec-level prerequisite, not a plan-stage detail

**Location:** §7 OQ 8, §2.1, §4 Step 1

The choice between `eslint-plugin-import` and the flat-config-native fork `eslint-plugin-import-x` affects:
- The `npm install` in Step 0 (different package name)
- The `eslint.config.js` import and plugin registration in Step 1
- The probe script in Step 0

This is not a "plan-stage decision" — it's a prerequisite for Step 0. Deferring it means the plan author must resolve it before writing the plan, which is the same as resolving it now.

**Suggestion:** Resolve in the spec. The flat-config ecosystem has converged on `eslint-plugin-import-x` for ESLint 9 flat configs; recommend it (or justify staying with `eslint-plugin-import@^2.31`).

---

### High — Wave C Step 4 checkpoint verification command will fail

**Location:** §4 Step 4, Wave-end checkpoint item 1

The checkpoint specifies:

```
npx eslint . --rule '{"@typescript-eslint/no-explicit-any": "error"}' --no-eslintrc --quiet
```

`--no-eslintrc` disables all config loading, including the TypeScript parser and plugin registration. This command will crash with "Cannot read config" or "parser not found" errors. It needs either `--config eslint.config.js` or should just use the production config (which already has the rule as `error`).

**Suggestion:** Replace with `npx eslint . --rule '{"@typescript-eslint/no-explicit-any": "error"}' --quiet` (dropping `--no-eslintrc`) or simply `npx eslint . | grep 'no-explicit-any'` if the production config already has the rule enabled.

---

### High — `no-explicit-any` count is 233, not "~330+" as claimed

**Location:** §1.3 table row "Error origin (336)", §1.3 "Inline `any` count" row

The spec says "224 inline `any` sites yield ~330+ violations after counting positions the regex misses." The actual `no-explicit-any` count is **233** — 9 more than the regex's 224, not 106+ more. The "~330+" figure overstates the Wave C workload by ~40%.

This affects the §1.5 wave-size justification ("comparable to Phase 2a's Wave A (~327 `noUnused*` errors)") — they're comparable at 233, but the spec's narrative of a 330+ monster wave is inflated.

**Suggestion:** Correct to 233 (acknowledging the Step 0 re-baseline may shift this slightly). The methodology is still valid, just smaller than framed.

---

### Medium — §3.4 re-enabling `no-unused-vars` is editorially acknowledged as redundant but provides no value

**Location:** §3.4

The spec explicitly states: *"Phase 2a's `noUnusedLocals` + `noUnusedParameters` from `tsconfig.app.json` catch unused symbols at compile time, making the lint rule redundant."* It then re-enables the rule anyway because *"the rule provides editor-visible signal even if the compiler already catches the same cases."*

This adds runtime cost to `eslint .` (every variable-binding node must be checked) for zero new information. The `--max-warnings 0` gate already passes through typecheck, which catches these. If the motivation is editor integration, that's a local IDE concern, not a CI gate.

**Suggestion:** Either keep `no-unused-vars` as `off` (matching Phase 2a's deliberate choice) and remove it from the 5 mandated rules, or justify the runtime cost with a concrete editor-integration requirement. If kept, at minimum acknowledge the lint-wall-time risk in §6.

---

### Medium — §5 done-when item 7 regex misses common `any` patterns

**Location:** §5 item 7

The regex `:\s*any\b|as\s+any\b|<any>|Record<[^>]*, any>|Map<[^>]*, any>` does not cover:
- `Function` type (often used as an `any` equivalent: `Function`, `() => void` for untyped callbacks)
- Spread positions: `...args: any[]`
- Generic type arguments beyond Record/Map: `SomeType<any>`, `Promise<any>` (the `<any>` arm matches but only if `any` is the sole type arg)
- Type parameter defaults: `T = any`

The `no-explicit-any` ESLint rule catches all of these — but the done-when regex gate doesn't. If the intent is to have a secondary validation independent of ESLint config, the regex is a false-negative-prone proxy. If the intent is just a sanity check, note its limitations.

**Suggestion:** Either expand the regex, or replace the done-when gate with "ESLint reports 0 `no-explicit-any` violations in production code" (which is what Step 6's verification already checks via `npm run lint` → 0). The regex gate adds complexity without rigor.

---

### Medium — §4 Step 2 Wave A split threshold (500 lines) is 8x Phase 2a's (60 lines) with weak justification

**Location:** §4 Step 2 "Split threshold"

Phase 2a Wave A split at 60 line-changes. This spec splits at 500. The justification: *"Prettier's output is mechanical and large diffs are inherent."* But large diffs are exactly why smaller commits are valuable — they're easier to review, bisect, and revert. A 500-line pure-formatting commit is hard to meaningfully review; a 60-line one is tractable.

**Suggestion:** Lower to 150–200 lines. The `.git-blame-ignore-revs` mechanism already handles blame hygiene, so commit count is not a burden. Review tractability should be the threshold driver.

---

### Medium — §2.4 posture rule 8 ("Prettier commits contain only formatting") is fragile across wave boundaries

**Location:** §2.4 posture rule 8, §4 Step 2 vs Step 3

Wave A reformats files. Wave B auto-fixes import ordering and type imports. If Prettier reformats a line that Wave B would also touch (e.g., an import statement), the line numbers shift between waves. This is not a correctness issue (Wave B runs after Wave A's format is stable) but the spec should note that Wave B's `eslint --fix` will produce diff output that may partially overlap with Wave A's formatting — and the posture rule 9 ("auto-fix commits contain only the rule's auto-fix output") may be difficult to verify if Prettier already moved those lines.

**Suggestion:** Add a note in §4 Step 3 acknowledging that Wave B's `eslint --fix` diffs may include trivial whitespace changes on lines Prettier touched, and that the posture-rule-9 purity check is "no non-import/no-type-annotation changes" rather than "no whitespace changes."

---

### Medium — §3.1 Prettier config is specified as the target but OQ7 defers validation to plan stage

**Location:** §3.1, §7 OQ 7

§3.1 provides a concrete Prettier config with rationale. §7 OQ 7 says the plan stage may adjust it if a dry-run shows a smaller-diff alternative. If the plan stage changes `singleQuote` to `true` (for example), the spec and plan will disagree on what the target config is. This isn't a "plan-stage detail" — it's a spec-level design choice.

**Suggestion:** Either lock the config in the spec (remove OQ 7) or frame §3.1 as a recommended starting point that the plan stage validates and finalizes (with the spec recording the final choice before execution).

---

### Medium — No contingency for Step 0 probe discovering unexpected rule categories

**Location:** §4 Step 0

The probe is framed as confirming the spec's design-time counts. But as this review demonstrates, the actual violation landscape has categories the spec doesn't anticipate. Step 0's §4 description says the probe "re-measures" and checks the Wave D threshold (300 combined) — but has no gate for "are there significant violation categories the spec didn't plan for?"

**Suggestion:** Add a Step 0 gate: if the probe surfaces violation categories not listed in §1.3 that collectively exceed N violations (suggest N=20), the plan author halts and re-enters a scope decision before continuing.

---

### Low — §1.4 branch-off commit "ce08615 or successor" is ambiguous

**Location:** §1.4

The spec says "branched off `master` at the post-Phase-2a commit (`ce08615` or successor)." If `master` advances between spec drafting and execution (e.g., a `sync.sh` merge), "successor" could be any commit. The intent is clear (branch off post-Phase-2a master) but a more precise formulation would be "the `master` HEAD at the time the branch is created."

---

### Low — §6 Risk R10 (git blame not honoring .git-blame-ignore-revs locally) is not a Phase-2b risk

**Location:** §6 R10

R10 describes a contributor-education issue, not a phase-execution risk. It doesn't threaten the phase's done-when gate or methodology. It belongs in a contributor guide or onboarding doc, not in the spec's risk table.

---

### Low — §4 Step 5 Wave D "no-misused-promises" IIFE wrapping is a readability regression

**Location:** §4 Step 5 "Fix rules" > `no-misused-promises`

The spec suggests: *"Promise passed to a non-promise-expecting context (e.g., `setTimeout(asyncFn, ...)`) → wrap in arrow `() => { void asyncFn(); }`."* This is correct for satisfying the rule but produces less-readable code than alternatives (e.g., extracting the async call into a named function). For `setTimeout` specifically, the IIFE pattern obscures the intent. Consider recommending named wrappers for non-trivial cases.

---

### Low — §2.3 frozen interfaces list includes items that lint/format cannot affect

**Location:** §2.3

"Auth flow, rate-limit boundary value (4 req/min), bundle output format" are frozen by this phase — but ESLint and Prettier changes cannot alter auth flow, rate-limit values, or bundle output format. Including them in the frozen-interfaces list adds noise. The list should include only things that the phase *could* accidentally change.

---

### Nit — §1.5 heading says "Why 5 waves" but the methodology has 4 waves (A–D) across 6 steps

**Location:** §1.5

Steps 0, 1, and 6 are not waves. The heading is slightly misleading.

---

### Nit — Code block language annotations are inconsistent

**Location:** §3.1 (`jsonc`), §3.2–3.4 (`js`)

Minor formatting inconsistency. Not consequential.

---

### Nit — §4 Step 4 suggested area order lists "signals, strategist, settings, layout" but directory structure should be verified

**Location:** §4 Step 4 "Suggested order" item 2

The listed areas may not exactly match the filesystem. Step 0's probe should confirm area boundaries before Wave C begins. The spec already implies this but could be explicit.
