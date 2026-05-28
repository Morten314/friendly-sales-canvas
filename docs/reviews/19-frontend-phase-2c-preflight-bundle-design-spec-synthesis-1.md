---
synthesizes_review: docs/reviews/19-frontend-phase-2c-preflight-bundle-design-spec-review-1.md
artifact: specs/19-frontend-phase-2c-preflight-bundle-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 1
---

## Round Recommendation

no

Reason: One High and four Medium findings, all agreed and revised in-spec; remaining items are Low/Nit, also acted on. No Critical/High remains after this round.

## Agreed Findings

- **[H] VR threshold factual error.** Verified `frontend/playwright.config.ts:42` reads `maxDiffPixelRatio: 0.01` (1%). Revising §1.2 ("captured against a 1% pixel-delta threshold"), §1.3 resolution 3 ("Up from Phase 0's 1%, which sits at the top of master Spec 14's 0.5–1.0% range; 2% widens past it — a 2× loosening, not 4×"), and §3.4 amendment description to match (the deviation is from 1% to 2%, still outside the mandated range).
- **[M] Hash length assumption.** Verified the baseline JSON contains `index-CqIc-MII.css` (hash includes hyphen). Revising §3.1 to describe the matcher as stripping the variable-length hash via Vite's `[name]-[hash][ext]` pattern (glob-based, not fixed-length). Exact regex stays deferred to the plan per §7 Q2.
- **[M] `bundle:rebaseline` ambiguity.** Revising §3.1 to state explicitly that `bundle:rebaseline` runs `vite build && tsx scripts/capture-bundle-baseline.ts` — delegates to the existing script rather than reimplementing the JSON shape. Removes the ambiguity between (a) delegation and (b) reimplementation.
- **[M] Standalone error-case handling.** Revising §3.1 to add an "Error handling" sub-bullet covering: missing `dist/` (actionable error, exit non-zero), missing or malformed baseline JSON (actionable error, exit non-zero), empty `chunks` array (handled gracefully, prints zeros). Advisory exit-0 applies to the comparator-success path; infrastructure errors are not advisory. DoD item 6 remains as written; the script's standalone mode is now fully spec'd.
- **[M] R1 "single-chunk reality" imprecise.** Revising §6 R1 to "single large JS chunk plus small ancillaries (CSS, workbox, sw.js — 5 chunks total)" and explicitly noting the matcher handles all `*-[hash].{js,css}` files, not just `index-*.js`.
- **[L] Spec 14 §6 DoD item 6 amendment wording.** Revising §3.4 to specify: remove "bundle-size budget" from §6 item 6's "required to pass" enumeration; add a separate line that the bundle comparator runs advisory in `npm run preflight` (does not gate). Resolves the "advisory check trivially satisfies 'required to pass'" ambiguity.
- **[L] `--no-progress` flag.** Revising §1.2 and §3.3 to include `--no-progress` in the `knip --strict` invocations, matching `frontend/package.json` actual.
- **[L] `bundle:check` placement forward-compat note.** Revising §3.3 to add a sentence noting that the `build → bundle:check → test:e2e` ordering means a future hard-fail toggle would block Playwright on bundle regression — Phase 14's hardening, if it lands, starts from this ordering.

## Disagreed Findings

- **[Nit] `frontend/scripts/README.md` scope is thin.** The reviewer noted no strong preference. Keeping the README as a standalone file is the author's judgment: it's a discoverable location for the two re-baseline conventions (bundle + VR) that don't naturally live inside `capture-bundle-baseline.ts` (bundle-only) or `playwright.config.ts` (VR-only). Centralizing keeps the conventions findable when a future agent searches for "re-baseline" without knowing which script owns which.

## Deferred Findings

None. All findings either revise in-spec or are no-action.

## Severity Disagreements

- **[L → Nit] `bundle:check` placement forward-compat note.** Agree with the finding; it's a one-sentence addition, not a substantive design concern. Acting on it because the cost is trivial, but treating as Nit-equivalent for prioritization. The reviewer's Low is defensible (it does relate to a downstream phase's design surface).

## Open Questions

None surfaced during this round of evaluation. The plan-author-deferred items in §7 of the spec are unchanged.
