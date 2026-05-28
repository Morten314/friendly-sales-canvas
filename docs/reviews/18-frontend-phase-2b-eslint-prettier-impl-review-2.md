---
artifact: phase-2b-eslint-prettier (Wave B, 8 commits d833810..b8f0006)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7
date: 2026-05-28
round: 2
base_ref: d833810 (Wave A end-of-wave checkpoint)
spec_loaded: false
plan_loaded: true
---

## Context

Wave B (plan Tasks 4.prep through 4.end) of Phase 2b, branch `phase-2b-eslint-prettier`. Reviewed 8 new commits on top of Wave A checkpoint `d833810`. Plan file `plans/18-frontend-phase-2b-eslint-prettier.md` lines 1753-2250 is the authoritative section. Spec 18 was referenced via plan citations rather than re-loaded.

Gate verification performed live:
- `tsc --noEmit -p tsconfig.app.json` → PASS (no output)
- `vitest run` → PASS (6 files / 83 tests / 40.92s)
- `npx prettier --check .` → **FAIL** (1 file: `src/components/market-research/RegulatoryComplianceSection.tsx`)
- `npx eslint .` → 406 errors / 51 warnings / 457 problems (per re-probe artifact); all 8 Wave B target rules at 0

## Findings

### [High] Prettier gate is RED on HEAD, contradicting commit-message claims

**Location:** `frontend/src/components/market-research/RegulatoryComplianceSection.tsx` lines ~27-32 (introduced by commit `a08b34c` / Task 4.7)

The Task 4.7 commit `a08b34c` ("wave B unused-disable sweep + stale import-order residue") left two consecutive blank lines after the new `import type { EditRecord } from "./types";`:

```
+import MiniLineChart from "../MiniLineChart";
+import MiniPieChart from "../MiniPieChart";
+
+import type { EditRecord } from "./types";
+
+
 import { Badge } from "@/components/ui/badge";
```

Prettier disallows consecutive blank lines, and current `npx prettier --check .` reports this file as non-conformant. The post-Wave-B re-probe artifact `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-prettier-probe.txt` already captured this failure (`[warn] src/components/market-research/RegulatoryComplianceSection.tsx`).

Both `e33420d` ("Gate matrix: build/vitest/typecheck/prettier all GREEN") and `b8f0006` (re-probe commit) leave the impression Wave B ended green. The implementer's report to the operator says "no format regression". This is incorrect: a regression was introduced by `a08b34c` itself and the re-probe captured it but it was not surfaced in the implementer's residual claim.

Impact: low (1 file, trivial to `prettier --write`) but the gate-status veracity matters for the scorecard (Task 7.2) and for Wave C's "begin from green" precondition.

**Recommended action before Wave C:** run `cd frontend && npx prettier --write src/components/market-research/RegulatoryComplianceSection.tsx` and commit as a Wave B touch-up (`fix(fe): restore prettier-conformance on RegulatoryComplianceSection`), then update the re-probe artifact or note the post-fix state in Wave C's prep notes.

### [Medium] `dev-dist/workbox-*.js` files lint at error severity (15 total: 11 ban-types + ~12 no-rule-id)

**Location:** `frontend/dev-dist/workbox-54d0af47.js`, `workbox-6856d41d.js`, `workbox-e755d862.js`

The post-Wave-B lint probe shows all 11 of the 11 residual `@typescript-eslint/ban-types` errors come from the auto-generated `dev-dist/workbox-*.js` files (3-4 each), plus 4 no-rule-id parser errors per file (12 total). The `.prettierignore` correctly excludes `dev-dist`, but the ESLint config does not (verified: `eslint.config.js` does not ignore `dev-dist`).

The implementer's residual breakdown attributes these 11 to "ban-types (Wave C)". They are build artifacts — Wave C shouldn't fix them; the eslint config should ignore them, the same way the prettier config does. This is a config bug, not a Wave C item. Suggest adding `"dev-dist/**"` to `eslint.config.js` ignores during Wave C prep (Task 5.prep) so the residual count reflects real source-tree issues.

If left, the scorecard (Task 7.2) will misreport `ban-types` as a real source-code item.

### [Low] Task 4.7 framing is honest but the file actually has a residual rule violation

**Location:** Commit `a08b34c`; residual visible in post-Wave-B re-probe `rulesByFile["src/pages/MarketResearch.tsx"]`

The implementer's documented deviation #2 ("Task 4.7 found ZERO actual unused-disable directives") is supported by the commit body, which is admirably honest. However the commit also reordered imports in `src/pages/MarketResearch.tsx` and the post-Wave-B probe still shows 5 `import-x/order` errors *in that same file*. The implementer's residual notes flag this as "5 import-x/order residue (auto-fixable; Wave C cleanup)". Looking at the diff: the `a08b34c` pass moved the upper import block but left the lower block (`toUTCTimestamp`, `buildApiUrl`, `logApiCallResult`, `buildLeadStreamChatContext`, `useToast`) un-reordered. Either eslint --fix needed a second pass on this file, or there's an ordering cycle the autofixer can't settle.

Recommended fix: re-run `npx eslint src/pages/MarketResearch.tsx --fix` once more during Wave C prep. If it doesn't settle in a single pass, this is the ESLint bug worth a note in the scorecard ("import-x/order is non-idempotent on MarketResearch.tsx").

### [Low] 38 `(no-rule-id)` parser errors are largely a `parserOptions.project` scope issue, not Wave D triage

**Location:** `e2e/**`, `scripts/**`, `playwright.config.ts`, `tailwind.config.ts`, `vitest.config.ts`, `dev-dist/workbox-*.js`

The implementer's residual claim places 38 `(no-rule-id)` parser errors in "Wave D triage". Breakdown from the probe JSON `rulesByFile`:
- 12 in `dev-dist/workbox-*.js` (3 files × 4 each) — handled by the eslint-ignore fix in the previous finding
- ~20 in `e2e/**` (fixtures, helpers, journeys, stubs)
- ~5 in `scripts/**` (build-audit-scorecard, build-lint-probe, build-strict-probe, capture-bundle-baseline, scan-inline-blocks)
- 1 each in `playwright.config.ts`, `tailwind.config.ts`, `vitest.config.ts`

These are the typical "TSConfig project does not include this file" parser errors from `@typescript-eslint`. They are config-layer issues (the type-aware ESLint setup's `parserOptions.projectService` or `project` doesn't extend to these tsconfig.node-style files / e2e tests). They are NOT Wave D semantic violations. Worth flagging this in Task 5.prep so Wave D doesn't expend cycles on them.

### [Low] `aa5dce4` is reasonably scoped but split decision feels arbitrary

**Location:** Commits `aa5dce4` + `c2d96aa` (both no-empty in market-research/)

The implementer split market-research no-empty fixes into two commits:
- `aa5dce4` (21 no-empty + 16 no-useless-escape) — covers `src/components/market-research/*.tsx` (4 files)
- `c2d96aa` (23 no-empty + 1 no-case-declarations in `src/pages/MarketResearch.tsx` — 1 file)

This is defensible since `MarketResearch.tsx` is the 227KB monolith and gets its own commit per the plan's "high-volume single-file" pattern. The split is fine, but a one-line cross-reference in `c2d96aa`'s body ("split from aa5dce4 because MarketResearch.tsx is the page-level monolith") would have made the commit-pair more obviously intentional. Minor polish.

### [Nit] `23ba411` "cross-area" commit bundles 4 unrelated rules across 4 files

**Location:** Commit `23ba411`

The implementer's documented deviation #1 explains this. The commit bundles:
- `no-unused-expressions` (LeadStream.tsx)
- `no-empty` (SuggestedICPCards.tsx — 1 file from customers/)
- `no-control-regex` (DataSourcesManager.tsx — mission-control/)
- `ban-ts-comment` (utils.test.ts — lib/__tests__/)

The plan §4 Step 3 Wave B prescribes "per-area" commits but acknowledges low-volume bundling is acceptable when each area has only 1-2 violations. With 2 violations each across 4 rules across 4 files, a single cross-area commit avoids 4 micro-commits. Reasonable choice; the body is detailed enough to allow targeted git-blame queries per area. No issue.

### [Nit] `marketScoreDescriptions.test.ts` IS in Wave B diff (touched by eslint --fix), contrary to expectation

**Location:** `frontend/src/lib/__tests__/marketScoreDescriptions.test.ts` — modified by commit `e33420d`

The user's check item #4 asked to confirm this file was untouched. `git log d833810..HEAD -- frontend/src/lib/__tests__/marketScoreDescriptions.test.ts` shows it WAS touched by `e33420d`. This is fine — the file is in `.prettierignore` (Wave A scope) but NOT in `.eslintignore` (Wave B scope), so eslint --fix legitimately applied import-order / type-import fixes to it. The test still passes (vitest green). The user's expectation in the prompt was incorrect; no actual issue.

## Per-Check Verification Summary

### Spec Compliance (user-requested checks)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | 8 commits in order | PASS | `git log d833810..HEAD --oneline` matches exactly |
| 2 | Each commit is no-logic-change | PASS (sampled) | All inspected diffs are import re-ordering, type-import conversion, `_`-prefix renames in catch params, intentional-comment additions, regex backslash drops, ternary→if/else in LeadStream, case-brace wrap in MarketResearch, `interface X {}` → `type X =`. No identifier renames of public symbols, no expression semantics changes, no JSX changes |
| 3a | e33420d body matches plan template | PASS | Body documents the split-path infeasibility (ESLint 9 flat-config rule-override issue) honestly; rule counts (20 / 503 / 11 / 3) provided; explains 9-file prettier touch-up |
| 3b | No Co-Authored-By footer | PASS | `git log --format='%H %s%n%b%n---' | grep Co-Authored-By` returns nothing; no Claude references either |
| 4 | Wave B target rules at 0 | PASS | All 8 (no-empty, no-useless-escape, no-control-regex, no-unused-expressions, no-case-declarations, ban-ts-comment, no-unused-vars, no-empty-object-type) = 0 errors + 0 warnings per probe JSON |
| 5 | 4 re-probe artifacts | PASS | All 4 present at `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-{area-tree,lint-probe,lint-probe.json,prettier-probe}.{txt,json}`; commit `b8f0006` adds exactly these |
| 6 | Prettier still green | **FAIL** | 1 file (`RegulatoryComplianceSection.tsx`) non-conformant; introduced by `a08b34c` and captured in re-probe artifact but commit message claims green |
| 7 | typecheck green | PASS | `tsc --noEmit -p tsconfig.app.json` exit 0 |
| 8 | `.git-blame-ignore-revs` unchanged | PASS | `git diff d833810..HEAD -- .git-blame-ignore-revs` empty |

### Code Quality (user-requested checks)

- **23ba411 grouping**: Reasonable. See Nit finding.
- **aa5dce4 / c2d96aa scope**: Reasonable. See Low finding.
- **Task 4.6 residue commit count (3)**: Within plan's expected 3-5 range. Good.
- **Task 4.7 honesty**: Honest framing. Body accurately disclaims that no unused-directive fix was needed and re-attributes the 3 reordered files to consistent-type-imports / import-x/order residue from Wave A. See Low finding for the secondary issue (5 import-x/order still residual in MarketResearch.tsx after this commit).
- **5 residual import-x/order**: All 5 are in `src/pages/MarketResearch.tsx`. Re-running `eslint --fix` on this single file should resolve. Wave C cleanup deferral is acceptable.
- **38 (no-rule-id)**: NOT Wave D semantic violations — they're config-layer parser scope issues (e2e, scripts, config files, dev-dist). See Medium + Low findings.
- **marketScoreDescriptions.test.ts**: TOUCHED by eslint --fix (e33420d) — vitest still green. See Nit finding.

## Recommendations

### For Wave C immediate prep (Task 5.prep)

1. **Apply the prettier touch-up** to `RegulatoryComplianceSection.tsx` as a separate small commit before Wave C starts. Take the 3-second `prettier --write` hit; the Wave C precondition assumes a clean prettier baseline.
2. **Add `dev-dist/**` to `eslint.config.js` ignores** (or merge with the existing ignore pattern). This drops 11 ban-types errors and 12 no-rule-id parser noise from Wave C's scope, leaving a cleaner per-file targeting list.
3. **Re-run `npx eslint src/pages/MarketResearch.tsx --fix`** to clear the 5 residual import-x/order errors. If it doesn't settle in one pass, that's a known issue worth noting in the scorecard.
4. **Re-run the lint probe after the above three cleanups** so Wave C's per-file plan starts from a corrected residual set: expect ~390 errors / 51 warnings (down from 406/51).

### For Wave D triage (Task 6.prep)

1. The 38 `(no-rule-id)` are not Wave D semantic items. Audit the eslint config's `parserOptions.projectService` (or `project`) coverage. Either:
   - Add the missing tsconfig.node references for e2e, scripts, config files, OR
   - Add those file globs to the type-aware lint ignore (lint them with the non-type-aware preset).
   The right call depends on whether we want type-aware rules on test/config code. Worth a brief decision in Task 5.prep before Wave D begins.

### For Task 7.2 scorecard

1. Record the prettier regression introduced + fixed within Wave B as a known process gap (a08b34c didn't run `prettier --check` after its own changes).
2. Note that the implementer's residual count of 406 errors is correct but ~25 of them (11 ban-types + 12 no-rule-id in `dev-dist`, + 2-3 more) are config-noise rather than source-tree work. The "real" Wave C/D target count is closer to 380.
3. Honestly characterize Task 4.7's outcome: zero unused-directives existed; the slot did productive incidental work (3 files of import-order settled) plus one regression (the double-blank-line that broke prettier).

## Assessment

**Ready for Wave C?** Yes, with the small prettier-conformance fix and the dev-dist eslint-ignore added during Task 5.prep.

**Reasoning:** All 8 Wave B target rules are confirmed CLEARED (errors AND warnings = 0 per probe JSON), typecheck and vitest are green, and the per-commit no-logic-change posture holds across all 8 commits sampled. The single prettier regression is mechanical and trivial. The 38 no-rule-id parser errors and 11 dev-dist ban-types items are config-layer issues that should be cleared in Task 5.prep rather than during Wave C per-file work — addressing them upfront keeps Wave C's residual count honest. The implementer's documented deviations (combined eslint --fix vs split, cross-area residue bundling, Task 4.7's zero-unused-directives finding) are all sensible and honestly reported.
