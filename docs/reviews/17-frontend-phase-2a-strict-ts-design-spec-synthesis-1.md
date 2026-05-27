---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-1.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: All 12 findings agreed and resolved by spec revisions; remaining changes are mechanical / clarifying with no new design surface opened.

## Agreed Findings

- **[High] Escape-hatch hard cap contradicts master plan delegation.** Revising §3 Step 3, §1.1 bullet 5, §4 item 5, and §5 R2 to soften the hard-cap behavior from auto-abort to **user checkpoint** (consistent with master spec §5.6 human-in-the-loop). At the 10th escape-hatch entry, Phase 2a halts and asks the user to choose between (a) raise the cap further (spec amended at merge), (b) defer remaining hatch sites as TD-FE entries, or (c) abort per Spec 14 §5.7. Auto-abort at 10 was an extrapolation beyond the user's Q5 brainstorming choice (which specified soft cap 5 → auto-raise to 10 with TD-FE; did not specify behavior at 10) and beyond master spec line 298's intent (which says "Phase 13's audit re-evaluates every entry"). Adding rationale for the 5/10 thresholds against the 83-implicit-any baseline: 5 ≈ 6% of TS7006 (a reasonable buffer for genuinely hard cases); 10 ≈ 12% (the structural signal that semantic work was under-scoped).
- **[Medium] Wave C error count "~51" → "~36".** §3 Step 4 heading sum-check: 8+7+8+5+2+4+2 = 36. The 15 TS2307s are eliminated in Step 1a. Revising heading and any propagated counts.
- **[Medium] "Six strict flags in tsconfig.app.json" → "five flipped in app + four overrides removed in composite root."** Verified against the measured file: `tsconfig.app.json` has 5 explicit linting flags (`strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`); `strictNullChecks` is only in `tsconfig.json` composite root. `strict: true` implies `strictNullChecks: true`, so end-state has 6 effective strict flags but the textual operation is 5+4. Revising §1.1, §2.1, §3 Step 1b.
- **[Medium] LOC anchor disagrees with Phase 1 scorecard.** Spec said 67,475; scorecard records 67,469. Aligning §1.3 to the scorecard's 67,469. Step 0 re-baseline replaces this anchor at execution time anyway.
- **[Medium] Step 5/Step 6 boundary confusion.** Collapsing into one step: "Step 5 — Verify done-when and write scorecard (one commit)." The scorecard content includes the verification results. Removes the ambiguity about "one commit or two."
- **[Medium] Escape-hatch path deviation not flagged.** §2.1 mentions Phase 4 relocation but doesn't call it a deliberate divergence from Spec 14 §4. Adding explicit phrasing: "The interim location `src/lib/types/escape-hatches.ts` deviates from Spec 14 §4 Phase 2a's `src/shared/types/escape-hatches.ts` because `src/shared/` doesn't exist until Phase 4 — Phase 4 relocates."
- **[Low] `useRef<T>(null)` pattern under strictNullChecks.** Adding a sub-bullet to §2.4 posture rule 2: "For `useRef<T>(null)` where the ref is assigned post-mount, guard with `if (ref.current != null)` before access. Use `.current!` only when the lifecycle guarantees non-null (e.g., a ref used inside an `onClick` that's only attached after a render where the ref was assigned). When in doubt, guard."
- **[Low] Circular-import risk from Wave B type additions.** Adding to §3 Step 3 fix rules: "When importing a type from another module to satisfy an implicit-any fix, use `import type { ... } from '...'` — erased at compile time, avoids runtime circular-dependency issues. If a circular type import is unavoidable, inline the type locally instead."
- **[Low] Existing bare `_` parameters.** Clarifying §2.4 posture rule 5: "TypeScript honors bare `_` as 'intentionally unused' for `noUnusedParameters`, so pre-existing bare `_` parameters in the codebase do **not** surface as TS6133 errors and are not retroactively renamed by this phase. The `_argName` convention applies to new fixes added during Wave A."
- **[Low] TS7016 third-party declaration gaps.** Adding R10 to §5: "Third-party type declaration gaps (TS7016) surface during execution. Not in design-time baseline (0 TS7016 in 461). Mitigation: Step 0 re-baseline catches; per-case fix is installing the corresponding `@types/*` package or adding a local `.d.ts` shim."
- **[Nit] Escape-hatch naming.** Keeping the `EscapeHatch*` type prefix (deliberately ugly, signals temporariness via namespace) and adding `// TODO(phase-13): replace with proper type` to the §3 Step 3 example. Greppability comes from the comment marker; the type name retains its namespace role.
- **[Nit] §1.3 table strictNullChecks listing.** Same root cause as the Medium flag-count finding. Updating the §1.3 "Current `tsconfig.app.json`" row to list only the 5 flags actually present, with a footnote noting that `strictNullChecks` is implied (and overridden to `false` by `tsconfig.json`).

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — all assigned severities reasonable on review.)

## Open Questions

(None — all 12 findings categorized and resolved through revisions to the spec.)
