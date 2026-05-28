---
synthesizes_review: docs/reviews/19-frontend-phase-2c-preflight-bundle-design-spec-review-2.md
artifact: specs/19-frontend-phase-2c-preflight-bundle-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 2
---

## Round Recommendation

no

Reason: One High (a propagation miss from round 1's revisions) and one Medium (incomplete code block risking a dropped Playwright setting) — both fully addressable in-spec. All remaining items are Low/Nit, also agreed. After this round's revisions, no Critical/High remains.

## Agreed Findings

- **[H] §2.2 still references "0.5%".** Round 1's revisions fixed §1.2 and §1.3 to "1%" but left the §2.2 out-of-scope bullet at "0.5% to 2%." Verified the leftover. Revising §2.2 to "Loosening the threshold from 1% to 2% does not invalidate stricter snapshots." The substantive claim (existing snapshots stay valid) holds either way; the premise needs the round 1 correction propagated.
- **[M] §3.2 code block incomplete.** Verified `frontend/playwright.config.ts:41-45` has three properties inside `toHaveScreenshot`: `maxDiffPixelRatio`, `threshold: 0.2`, `animations: "disabled"`. The spec's snippet shows only `maxDiffPixelRatio`. A plan author following the snippet verbatim would drop the other two and destabilize VR. Revising §3.2 to show the complete intended block with the unchanged `threshold` and `animations` fields preserved, plus a one-line note that only `maxDiffPixelRatio` changes.
- **[L] §3.5 "+5 LOC" for `playwright.config.ts`.** The actual edit is a single-value change (`0.01` → `0.02`). Revising to "~1 LOC changed (single value edit)" — accurate, and avoids implying new boilerplate.
- **[L] §2.3 frozen-interfaces wording.** The composite `preflight` script both reorders and extends (adds `bundle:check`). Revising the frozen-interfaces bullet from "only the composite `preflight` script changes order" to "the composite `preflight` script is reordered and extended with `bundle:check`; individual sub-script definitions are unchanged."
- **[L] §3.3 build rationale precision.** Verified `playwright.config.ts:29` shows `webServer.command: "npm run build && npm run preview …"`. Playwright rebuilds `dist/` itself regardless of the chain's prior `build` step. The explicit `build` exists for `bundle:check`'s sake only, not Playwright's. Revising the §3.3 rationale to attribute the dependency to `bundle:check` alone and noting the double-build is a pre-existing inefficiency outside Phase 2c's scope.
- **[Nit] §7 Q4 redundant.** §3.1 + §3.3 already commit to "consume `dist/` in place." Revising Q4 to mark RESOLVED in-spec (consume `dist/`; the assumption is that the preceding `build` step populates it), to avoid the plan author treating it as still-open.
- **[Nit] §8 reference says "§4.5".** §3.4 already says "§4 Phase 2c block" (corrected during the round 0 self-review). §8 missed the same fix. Revising §8 to match.

## Disagreed Findings

None.

## Deferred Findings

None.

## Severity Disagreements

None. The H1 severity is correct (factual error in spec, propagated from a partial round 1 fix); the rest match their severities.

## Open Questions

None surfaced during this round.
