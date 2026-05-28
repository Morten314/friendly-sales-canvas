---
synthesizes_review: docs/reviews/phase-2a-strict-ts-impl-review-1.md
artifact: phase-2a-strict-ts
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 1
---

## Round Recommendation

no

Reason: All six findings are Low/Nit/Medium; Finding 1 fixed in commit `2310b7d`, Finding 3 (Medium) is a spec-acknowledged design choice with an explicit Phase 2b backstop, remaining findings are merge-review awareness or deferred cleanups. No actionable Critical/High remains.

## Agreed Findings

- **[Low] Probe undercounted TS7006** — Fixed in commit `2310b7d`. Added explicit `noImplicitAny: true` to the throwaway probe config in `frontend/scripts/build-strict-probe.ts` so the probe forces the override regardless of `tsconfig.app.json`'s state. Re-ran the probe post-fix and verified zero regression against the current strict-clean state. The fix lands in Phase 2a per the reviewer's note that it "should land before Phase 2b uses it for re-baselining."

- **[Low] ~1,100 lines of dead integration logic deleted from MissionControl.tsx** — Acknowledged as a merge-review awareness flag. All deletions were TS6133-flagged ("declared but never read"), preflight (Playwright + visual regression + Vitest + knip) passed on the final commit, and DataSourcesManager owns the live integration logic. No code action; the scorecard already records the Wave A + Wave C MissionControl commits (`3786934`, `10d8ce2`) for merge-review scrutiny. The Playwright + visual regression coverage at `maxDiffPixelRatio 0.01` is the gate.

- **[Nit] Scorecard commit-log snapshot is one commit behind HEAD** — Acknowledged. The embedded `git log --oneline master..HEAD` in `docs/audits/2026-05-28-frontend-phase-2a-strict-ts.md` §5 ends at `31935b3` because the log was captured during scorecard generation. The actual `git log` on the branch is correct. Post-hoc amending or re-committing the scorecard would compound the inconsistency (Finding 1's probe fix at `2310b7d` plus this synthesis would push it further behind). The scorecard is left as the historical snapshot it claims to be; the branch's `git log` is the authoritative current view.

## Disagreed Findings

- **[Nit] Redundant `noImplicitAny: true` alongside `strict: true` in `tsconfig.app.json`** — Disagreed as a finding. Spec 17 §3 Step 1b explicitly establishes this redundancy as intended: "noImplicitAny is part of the strict umbrella; keeping it explicit is defensive and harmless; the spec doesn't strip it." The reviewer's own text correctly notes the spec covers this. The Phase 2a outcome correctly follows the spec; this is not actually a finding against the implementation.

## Deferred Findings

- **[Medium] Escape-hatch entries use `= any` not counted in the inline-any non-regression gate** — Deferred to Phase 2b's `@typescript-eslint/no-explicit-any` lint rule. The reviewer correctly notes Spec 17 §4 item 6 acknowledges this exact gap and explicitly designates Phase 2b's eslint rule as the authoritative backstop. Phase 2a's `rg` regex was never intended to catch the `= any` position; the gate is "non-regression of inline-position any" (the more common form). Trigger: Phase 2b activates `@typescript-eslint/no-explicit-any`, which would catch `type X = any` anywhere in the codebase except the documented escape-hatches file (suppressed via inline eslint-disable in that one file).

- **[Nit] `allowJs: true` retained in composite root `tsconfig.json`** — Deferred to a future cleanup. Spec 17 §2.1 listed exactly four overrides for removal; `allowJs` was not among them, so retaining it is in-scope correct. The reviewer's concern (mildly confusing in a composite root with `"files": []`) is valid but cosmetic. Trigger: a future tsconfig housekeeping pass — likely Phase 2b's broader config cleanup if it touches the root, or whenever a real motivation surfaces (e.g., the root config gains references that DO have files).

## Severity Disagreements

None. The reviewer's severity calibration matches my assessment of each finding's actual impact.

## Open Questions

None.
