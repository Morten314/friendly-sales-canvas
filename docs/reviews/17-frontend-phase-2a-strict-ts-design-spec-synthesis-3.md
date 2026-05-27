---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-3.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 3
---

## Round Recommendation

no

Reason: All 18 findings agreed and resolved with clarifying / simplifying revisions; no Critical/High residue and no genuinely new design surface opened (the strict sub-flag enumeration documents what the probe already enabled, and the escape-hatch simplification removes design surface rather than adding it).

## Agreed Findings

- **[High] Enumerate the strict sub-flags `strict: true` enables.** Replacing the §1.1 and §3 Step 1b language "`strict: true` implies `strictNullChecks: true`" with the full list: `strict: true` enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`. The 461-error probe ran with `strict: true`, so the baseline already captures errors from all these sub-flags — only the textual narrative undersells the scope. No methodology change required.
- **[High] Escape-hatch `any`s exempt from inline-any regression check.** The regex `:\s*any\b|as\s+any\b|<any>` matches the call-site patterns but not the `= any` syntax used in `src/lib/types/escape-hatches.ts`. This is structurally helpful (escape hatches are tracked separately under DoD item 5) but currently implicit. Adding a sentence to §4 DoD item 6: "Escape-hatch entries in `src/lib/types/escape-hatches.ts` use `= any` syntax not matched by this regex and are tracked separately under item 5."
- **[High] Document `skipLibCheck` and `compilerOptions.types` in the starting state.** Current `tsconfig.app.json` has `skipLibCheck: true` and no explicit `types` array — these affect what third-party type checking surfaces under strict mode. Adding rows to the §1.3 starting-state table for both, with a note that the spec accepts the current state (R10 mitigates the related TS7016 risk separately).
- **[Medium] Wave B batching threshold.** §3 Step 3 currently says "file-by-file" with an afterthought about bundling. Adding a rule analogous to Wave A's 60-line threshold: "Files with ≤3 errors in the same area may be bundled into one commit; files with >3 errors get individual commits."
- **[Medium] Simplify escape-hatch mechanism — drop batch-of-5 cadence.** The "every batch of 5 → another TD-FE" cadence wasn't in the user's Q5 brainstorming choice (which was singular: "auto-raise to 10 and log it as a TD-FE"). I added the cadence in round-2 synthesis. Round 3 correctly notes it's overengineered. Simplifying §3 Step 3 to: one TD-FE registration at the 5th entry capturing the pattern; entries beyond 5 are logged in the file but do not trigger additional TD-FEs; if the count grows materially (~15+), implementer judgment raises a flag to the user — no automatic mechanism. Phase 13 audits all entries.
- **[Medium] Genericize Phase 3 cross-reference in escape-hatch example.** Spec 14 §4 Phase 3 does own central contract types (`src/shared/api/contracts.ts`), but feature-local types land with their feature phase. The example's "Phase 3 owns those" is partially right but glosses over the distinction. Replacing with a generic justification that doesn't pin a specific phase.
- **[Medium] Symmetric wave-end checkpoint language.** The reviewer's explanation of cascades was inverted (cascades produce *lower* net drop, not higher), but the suggestion to flag unexpected outcomes in both directions is sound. Revising §3 Step 2/3/4 checkpoint language to: "Confirm the drop is within ±30 of the wave's target. Materially short suggests cascades or missed errors; materially exceeding suggests unintended fixes from other categories. Either direction warrants investigation."
- **[Medium] Test-file conventions sub-rule.** Adding to §2.4: a brief sub-bullet covering test patterns — mock objects with partial shapes may use `as Partial<T>` or local interfaces; fixtures may keep their existing `any` typing without consuming escape-hatch budget (they're already counted in the 238 inline-any baseline that Phase 2b addresses); unused parameters in test helper signatures follow the `_argName` convention.
- **[Medium] "Build is red" → "typecheck is red".** §3 opening paragraph fix. `vite build` uses esbuild and stays green; only `tsc --noEmit` is red mid-phase. Single text replacement.
- **[Medium] Wave B per-error uncertainty.** Adding to §3 Step 3 a caveat: Wave B requires reading call-site intent and finding correct types — per-error effort is materially higher than Wave A's mechanical deletions or Wave C's small semantic count. Plan-stage budget allocation should reflect this.
- **[Medium] TS2564 / TS2683 absent from baseline — explain.** The probe ran with `strict: true` so `strictPropertyInitialization` and `noImplicitThis` were active; zero errors of those types means the codebase lacks the patterns (function components, not classes). Adding a one-sentence note to §1.3 or §3 Step 4: "TS2564 (`strictPropertyInitialization`) and TS2683 (`noImplicitThis`) are absent from the baseline — the codebase is predominantly function components. If they surface during execution, they belong in Wave C."
- **[Low] 6-check kit inline summary.** Adding a parenthetical list after "Phase 1's 6-check kit" with one-line summaries: `rg <basename>`, `rg "import(.*)['\"].*<basename>"`, `rg "export.*from.*['\"].*<basename>"`, `rg "<basename>"` plain-text, walk `src/App.tsx` route table, scan `frontend/e2e/**` + `frontend/src/**/__tests__/**` + `*.{test,spec}.{ts,tsx}` for imports.
- **[Low] Surprise-inbound default softened.** §3 Step 1a surprise procedure: changing the default from "(c) defer" to "(b) attempt refactor if genuinely trivial (e.g., a single import statement change); otherwise (c) defer." The 'genuinely trivial' bar stays high — when in doubt, defer.
- **[Low] "Linting flags" terminology fix.** Replacing "linting flags" with "strict-mode compiler flags" throughout §1.1 and §3 Step 1b. Note: the current `tsconfig.app.json` has a `/* Linting */` comment above the flag block, but that source-level label is itself imprecise.
- **[Low] Scorecard simplification.** §3 Step 5 scorecard: dropping section 2 (per-area delta table — redundant with the Step 0 JSON which is already committed; the scorecard cites the JSON). Simplifying section 6 (commit-by-commit annotated summary) to a one-paragraph summary referencing `git log master..HEAD` rather than per-commit annotation.
- **[Nit] Bare `_` collision rationale outdated.** TS 4.0+ allows multiple `_` parameters. Replacing §2.4 posture rule 5's "Bare `_` collides when multiple unused parameters appear in one signature" with the documentation rationale alone: "Bare `_` carries no information about what the parameter would have been called; named `_argName` preserves it."
- **[Nit] Visible-UI frozen-interface wording.** §2.3: tightening the "Visible UI — visual regression at `maxDiffPixelRatio 0.01` stays green" bullet to separate contract from validation: "Visible UI is unchanged (validated by visual regression at `maxDiffPixelRatio 0.01` in the preflight chain)." The contract stays in §2.3 — the reviewer's "tautology" framing applies to all frozen-interface entries equally and is rejected on that ground.
- **[Nit] Probe config cleanup.** §3 Step 0: adding "The probe config file is created by the probe script and deleted before the Step 0 commit; only the JSON and TXT artifacts are committed."

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — all assigned severities reasonable on review.)

## Open Questions

(None — all 18 findings categorized and resolved through revisions to the spec.)
