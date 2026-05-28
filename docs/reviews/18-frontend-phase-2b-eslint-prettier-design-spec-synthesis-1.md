---
synthesizes_review: docs/reviews/18-frontend-phase-2b-eslint-prettier-design-spec-review-1.md
artifact: specs/18-frontend-phase-2b-eslint-prettier-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 1
---

## Round Recommendation

yes

Reason: Three Critical findings agreed — fixing them opens material new design surface (methodology gains scope for ~138 previously-unaccounted violations) that should be re-reviewed in a round 2.

## Agreed Findings

- **C1 — §1.3 error-origin breakdown is factually wrong.** Verified independently by re-running `eslint . --format json` at commit `80860ba` and parsing per-rule counts. Reviewer's numbers match exactly: 233 `no-explicit-any` + 103 errors from 13 other rules, not the spec's claimed "~330+ no-explicit-any + 1 other". Revising §1.3 with the verified per-rule breakdown.
- **C2 — §1.3 warning-origin breakdown is factually wrong.** Verified independently: 35 `react-hooks/exhaustive-deps` + 13 unused-directive + 8 `react-refresh/only-export-components`. The spec characterized `only-export-components` as "predominant" when it's only 14%. Revising §1.3 with verified breakdown.
- **C3 — Done-when gate §5 item 3 is unachievable with the current methodology.** Confirmed. 103 errors + 35 warnings from outside the 5 mandated rules block `--max-warnings 0` and the methodology had no plan for them. Expanding §2.1 scope to explicitly cover all rules that block lint-green, and expanding §4 methodology so Wave B absorbs auto-fixable other-rule violations (`@typescript-eslint/ban-types` deprecated migration, `no-empty-object-type` fixes), Wave C absorbs the `no-unsafe-*` family (which largely cascades from `no-explicit-any` fixes and resolves as side-effect), and a new Wave D-prime sub-step handles `react-hooks/exhaustive-deps` per-site work. Manual-fix rules (`no-empty` 46, `no-useless-escape` 16, `ban-ts-comment` 2, `no-control-regex` 2, `no-unused-expressions` 2, `rules-of-hooks` 1, `no-case-declarations` 1) land in an expanded Wave B residue commit because each is a small mechanical or one-off fix not warranting its own wave.
- **H1 — `eslint-plugin-import` vs `eslint-plugin-import-x` is a spec-level prerequisite.** Reviewer is right — this affects Step 0's npm install. Resolving in §3 and §4 Step 1 to commit to `eslint-plugin-import-x` (the flat-config-native fork; ESLint 9 + typescript-eslint 8 ecosystem has converged on it). Removing OQ 8 from §7.
- **H2 — Wave C Step 4 checkpoint command will fail under ESLint v9 flat config.** `--no-eslintrc` is a legacy-config-only flag. Replacing the command in §4 Step 4 with a `npm run lint 2>&1 | grep 'no-explicit-any'` form that uses the production config.
- **H3 — `no-explicit-any` count is 233, not "~330+".** Verified. Correcting throughout §1.3, §1.5, §4 Step 4.
- **M2 — §5 done-when item 7 regex misses common `any` patterns (`Function`, spreads, defaults).** Replacing the regex-based gate with an ESLint-based gate: "`npm run lint` reports 0 `no-explicit-any` violations in production code paths." The primary verification is already the `npm run lint` → 0 gate; the regex was a redundant secondary check that introduced false-negative risk. Cleaner to drop.
- **M3 — Wave A split threshold (500 lines) too generous.** Compromise at 250 lines. Reviewer's bisection/revert argument has merit; the `.git-blame-ignore-revs` mechanism handles blame hygiene but doesn't help mid-phase bisection. 250 is well above Phase 2a Wave A's 60 (which was for semantic deletions, not pure formatting) while still allowing meaningful review granularity.
- **M4 — Posture rule 8 fragile across wave boundaries.** Adding a clarifying note in §4 Step 3 that Wave B's `eslint --fix` diffs may include trivial whitespace touching lines Prettier already moved, and refining posture rule 9 to "no non-rule-targeted code changes" rather than "no whitespace changes."
- **M5 — §3.1 Prettier config locked but OQ7 defers validation.** Locking the config in §3.1 fully; removing OQ 7. The plan-stage validation dry-run is a pre-Step-1 sanity check, not a config-changing exercise — adding a sentence in §4 Step 1 that codifies this without leaving the config open.
- **M6 — No contingency for Step 0 probe discovering unexpected rule categories.** Adding an explicit Step 0 categorization gate: if the probe surfaces rule categories not listed in §1.3 contributing ≥20 violations collectively, plan author halts and re-enters a scope decision. This complements the existing Wave D threshold gate.
- **L1 — "ce08615 or successor" ambiguous.** Rephrasing §1.4 to "the `master` HEAD at the time the branch is created."
- **L2 — R10 is not a phase-2b risk.** Removing R10 from §6. Adding a one-line note in §4 Step 1 about the `blame.ignoreRevsFile` local-config requirement (contributor-education concern, not a risk).
- **L3 — Wave D IIFE wrapping readability regression.** Softening the language in §4 Step 5 to recommend named wrappers for non-trivial cases (e.g., a top-level `const handleSubmit = () => { void asyncSubmit(); };` rather than inline `() => { void asyncSubmit(); }` when the wrapper appears multiple times or has surrounding logic).
- **L (16) — §2.3 frozen interfaces lists lint-irrelevant items.** Trimming "Auth flow, rate-limit boundary value, bundle output format" from the frozen-interfaces list. Keeping the items that lint/format could theoretically affect (public exports of `src/lib/*`, visual regression via Playwright snapshots, etc.).
- **N1 — §1.5 heading "Why 5 waves" but 4 waves.** Rephrasing to "Why this structure (single phase, 4 waves)."
- **N2 — Code block language annotations inconsistent.** Standardizing on `js` for JavaScript/config blocks; keeping `jsonc` where the block is JSON-with-comments.
- **N3 — §4 Step 4 area order should be verified against filesystem.** Adding a sentence in §4 Step 0 that the probe artifacts include a directory enumeration that Wave C's plan-stage author validates before ordering commits.

## Disagreed Findings

- **M1 — Re-enabling `no-unused-vars` is redundant.** Master spec §4 Phase 2b explicitly lists `@typescript-eslint/no-unused-vars` in the mandated rule set. Phase 2b is bound to the master spec's list. The reviewer's runtime-cost concern is valid as a watch-item but does not override the master-spec mandate. The lint-wall-time risk is already captured in §6 R4. The redundancy with `noUnusedLocals` + `noUnusedParameters` is a known trade-off — the lint rule gives editor-visible signal without running `tsc`, which matters for developer feedback loops outside of preflight. Keeping the rule enabled per master spec.

## Deferred Findings

(none — all findings either agreed or disagreed)

## Severity Disagreements

(none — agreed severities match reviewer's assessment)

## Open Questions

- After Wave B's expanded auto-fix scope (covering `ban-types --fix`, etc.) and Wave C's `no-unsafe-*` cascade-resolution, the expected residual count of pre-existing violations may differ from the spec's design-time estimate. Step 0's probe should surface this; if the residual is materially larger than expected, the plan-stage author re-enters Wave D-prime sizing. This is now codified in M6's added gate but the operational handling at execution time is a plan-stage concern.
- The exact list of which "other-rule" violations are auto-fixable vs require manual fixes will be confirmed by the Step 0 probe. The synthesis commits to a structural placement (Wave B auto-fix, Wave C type-cascade, Wave D-prime exhaustive-deps, residue manual fixes) but the precise commit count and area boundaries inside Wave B/D-prime remain plan-stage decisions.
