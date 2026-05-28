---
artifact: specs/19-frontend-phase-2c-preflight-bundle-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 2
---

## Context

Round 2 review of the post-synthesis revision. Round 1 produced one High, four Medium, three Low, and three Nit findings. The synthesis agreed and revised all High/Medium items. This review checks that the synthesis revisions landed correctly and looks for issues not caught in round 1.

## Findings

### [High] §2.2 still references "0.5%" — round 1 factual error partially uncorrected

**Location:** §2.2 ("Loosening the threshold from 0.5% to 2% does not invalidate stricter snapshots")

The round 1 synthesis revised §1.2 and §1.3 to correctly state the current threshold is 1% (matching `frontend/playwright.config.ts:42` `maxDiffPixelRatio: 0.01`), but §2.2 still says "0.5% to 2%." This is the same factual error from round 1 finding H1, incompletely propagated. The conclusion (existing snapshots remain valid) is correct — loosening from 1% to 2% certainly doesn't invalidate them — but the premise is wrong. Fix §2.2 to read "Loosening the threshold from 1% to 2% does not invalidate stricter snapshots."

### [Medium] §3.2 code block is incomplete — risks dropping existing Playwright settings

**Location:** §3.2 ("Set globally so every screenshot assertion inherits it:")

The spec shows only:

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.02,
  },
},
```

The current `frontend/playwright.config.ts` has three properties inside `toHaveScreenshot`: `maxDiffPixelRatio: 0.01`, `threshold: 0.2`, and `animations: "disabled"`. If a plan author replaces the `expect` block with what the spec shows verbatim, they would drop `threshold: 0.2` (per-pixel color tolerance) and `animations: "disabled"` — both of which affect screenshot stability. The spec should either show the complete block with the unchanged fields included, or add an explicit note that only `maxDiffPixelRatio` changes and the other two properties are retained as-is.

### [Low] §3.5 "+5 LOC" for `playwright.config.ts` is inaccurate

**Location:** §3.5 Files touched ("+5 LOC (`expect.toHaveScreenshot.maxDiffPixelRatio: 0.02`)")

The change to `playwright.config.ts` is a single value edit (`0.01` → `0.02`) on one line. The "+5 LOC" estimate is misleading — it implies 5 lines of new code. If the plan author adds a comment explaining the threshold change, that's +1 or +2 lines, still not 5. Correct to "~1 LOC changed" or remove the LOC estimate for this file.

### [Low] §2.3 "only the composite preflight script changes order" — also adds a new step

**Location:** §2.3 Frozen interfaces ("only the composite `preflight` script changes order")

The proposed chain in §3.3 both reorders existing steps (moves `test` before `build`) AND adds a new step (`bundle:check`). The frozen-interfaces claim that individual script definitions don't change is correct, but saying the composite "changes order" is incomplete — it also extends the chain. Rephrase to "the composite `preflight` script is reordered and extended with `bundle:check`."

### [Low] §3.3 build rationale slightly misleading about Playwright's `dist/` dependency

**Location:** §3.3 Rationale ("build — required before bundle:check and test:e2e (both consume dist/)")

Playwright's `webServer.command` is `npm run build && npm run preview` (`playwright.config.ts:29`). Playwright rebuilds `dist/` itself regardless of whether the explicit `build` step ran. The explicit `build` in the preflight chain is required for `bundle:check` (which reads `dist/`), not for Playwright. The double-build (explicit `build` + Playwright's own build) is an existing pre-existing inefficiency not introduced by this spec, but the rationale should say "required before `bundle:check` (which consumes `dist/`)" rather than attributing the dependency to Playwright as well.

### [Nit] §7 Q4 is redundant given decisions already in §3.1 and §3.3

**Location:** §7 Open questions Q4 ("Should `bundle:check` consume `dist/` in place or run `vite build` itself?")

§3.1 says the comparator walks `frontend/dist/`. §3.3 places `bundle:check` after the explicit `build` step. The answer ("consume `dist/`") is already the spec's design. Q4's own "default is consume `dist/`" confirms this. The question is resolved in-spec and can be removed or marked "resolved — consume `dist/`" to avoid plan-author confusion.

### [Nit] §8 companion reference says "§4.5" but no such section numbering exists

**Location:** §8 Companion documents ("this phase amends §4.5 / §6 / §8")

Spec 14 §4 contains phase blocks (Phase 0, 0a, 0b, 1, 2a, 2b, 2c, 3…14) but they are not numbered §4.1, §4.2, etc. The reference should say "§4 Phase 2c block" (matching §3.4's own language) rather than "§4.5."

### [Nit] LOC estimates in §3.5 are rough — no issue, just noting

**Location:** §3.5 Files touched

The "~150 LOC" for the comparator and "~50 LOC" for the README are plausible but unverifiable at spec time. These are author estimates for sizing, not commitments. No action needed.
