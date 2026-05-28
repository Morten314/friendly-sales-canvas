# Phase 2b — Frontend ESLint Type-Aware + Prettier Scorecard

**Phase:** Spec 18 / plans/18-frontend-phase-2b-eslint-prettier.md
**Branch:** `phase-2b-eslint-prettier` (ready to merge 2026-05-28)
**Spec baseline:** Spec 18 §1.3 design-time figures (392 problems anchor, 233 `no-explicit-any`, 35 `exhaustive-deps`)
**Step 0 re-baseline:** `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json`
**Post-Wave-B re-baseline:** `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.json`
**Post-Wave-C re-baseline:** `docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.json`

## 1. Baseline (Step 0) → Final

| Metric | Baseline | Final | Delta |
|---|---:|---:|---:|
| `eslint . --max-warnings 0` total problems | 1087 | 0 | -1087 |
| ↳ errors | 1035 | 0 | -1035 |
| ↳ warnings | 52 | 0 | -52 |
| `prettier --check .` files needing format | ~all `src/` | 0 | -all |
| Inline `any` count (src/, `:any` / `as any` / `<any>`) | 224 | 21 | -203 |
| `eslint-disable-next-line no-explicit-any` in production | 0 | 0 | 0 |
| `@ts-(ignore|expect-error|nocheck)` count | 5 | 5 | 0 |
| Escape-hatches entries (`Untyped*`) | 6 | 14 | +8 |
| `react-hooks/exhaustive-deps` warnings | 35 | 0 | -35 |

Step 0 re-baseline came in HIGHER than spec design-time anchors (1087 vs 392 problems) because:
- `import-x/order` was newly wired in Step 1 (not in pre-Phase-2b lint config), contributing 503 errors.
- `consistent-type-imports` was newly wired (20 errors).
- The pre-Phase-2b lint config didn't enable type-aware rules; turning them on with `projectService: true` surfaced `no-floating-promises`, `no-misused-promises`, `no-unsafe-*`, etc.
- Several "no-empty", "no-useless-escape", "ban-types" categories surfaced from the now-`--max-warnings 0` posture.

Final state: every Spec 18 §5 done-when item passes (see §10 below).

## 2. Per-Rule Disposition

| Rule | Baseline errors | Final | Wave | Method |
|---|---:|---:|---|---|
| `import-x/order` | 503 | 0 | A→B→C residue | Wave A prettier reflow + Wave B `eslint --fix` auto-fix + 1 residual Wave C touch-up commit. |
| `@typescript-eslint/no-explicit-any` | 232 | 0 | C | Wave C per-file pass: tighten where possible, route the rest through 8 new `Untyped*` escape-hatches entries. |
| `@typescript-eslint/no-misused-promises` | 67 | 0 | D | Wave D JSX-decision (304777d) configured `checksVoidReturn: { attributes: false }` — 57 of 67 sites were JSX attributes (e.g. `onClick={async () => …}`). Remaining 10 fixed manually. |
| `@typescript-eslint/no-floating-promises` | 46 | 0 | D | Per-site fixes (await, `void`, fire-and-forget log on error). |
| `no-empty` | 46 | 0 | B | Auto-fix + manual residue split across `aa5dce4` (market-research components) + `c2d96aa` (MarketResearch.tsx). |
| `@typescript-eslint/no-unused-vars` | 39 | 0 | B | `a13f055` residue commit; `^_` ignore patterns absorbed the intentional ones. |
| `(no-rule-id)` parser errors | 26 | 0 | Step 6 | Pre-existing config-coverage gap: `tsconfig.node.json` only included `vite.config.ts`. Extended `include` to cover `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts`, `scripts/**/*.ts`, `e2e/**/*.ts` (residual fix `35d4d3c`). |
| `@typescript-eslint/consistent-type-imports` | 20 | 0 | B | `eslint --fix` auto-fix (`e33420d`). |
| `no-useless-escape` | 16 | 0 | B | Auto-fix + manual residue (`aa5dce4`). |
| `@typescript-eslint/ban-types` | 11 | 0 | B | `5f27133` (no-empty-object-type residue commit — same `{}` family). |
| `@typescript-eslint/no-unsafe-assignment` | 9 | 0 | C | Resolved as a side-effect of Wave C's per-file `no-explicit-any` cleanup. |
| `@typescript-eslint/no-unsafe-return` | 6 | 0 | C | Same. |
| `@typescript-eslint/no-unsafe-member-access` | 3 | 0 | C | Same. |
| `@typescript-eslint/no-empty-object-type` | 3 | 0 | B | `5f27133`. |
| `@typescript-eslint/no-unused-expressions` | 2 | 0 | B | `23ba411` (cross-area mechanical residue). |
| `no-control-regex` | 2 | 0 | B | `23ba411`. |
| `@typescript-eslint/ban-ts-comment` | 2 | 0 | B | `23ba411` (1 hit in utils.test.ts — `@ts-expect-error` swap for `@ts-ignore`). |
| `react-hooks/rules-of-hooks` | 1 | 0 | D | `b0b64a8` — extracted conditional hook in RegulatoryComplianceSection (Task 6.rules-of-hooks). |
| `no-case-declarations` | 1 | 0 | B | `c2d96aa`. |
| `react-hooks/exhaustive-deps` (warning) | 35 | 0 | D | Per-component fixes (16 commits). Where deps are intentionally narrowed, used `eslint-disable-next-line react-hooks/exhaustive-deps` + one-line rationale (33 such lines total across Wave D + Step 6 — posture rule allowed when intentional). |
| `react-refresh/only-export-components` (warning) | 4 | 0 | Step 6 | New override zone for `src/contexts/**` and `src/components/customers/LeadStream.tsx`. Context modules intentionally co-export their hooks (`useAuth`, `useTenant`, `useSidebar`) alongside the Provider — splitting them is gratuitous file churn for no DX win. |
| `(unused-eslint-disable)` (warning) | 13 | 0 | B | `a08b34c` was the dedicated unused-disable sweep — but found 0 actual unused-disable directives once Wave B's other commits had landed (the residue cleaned itself up incidentally). Commit body documents this honestly. |

## 3. Files Touched per Wave

| Wave | Files touched (in that wave's diff) |
|---|---:|
| Step 0 | 8 (install + probe artifacts + helper script) |
| Step 1 | 6 (eslint.config.js, .prettierrc, .prettierignore, .git-blame-ignore-revs, package.json, knip.json) |
| Wave A | 200 (mass prettier format across `src/`, `e2e/`, `scripts/`, root configs) |
| Wave B | 110 (mechanical residue across multiple rules) |
| Wave C | 47 (per-file `no-explicit-any` + `no-unsafe-*` cascade) |
| Wave D | 29 (per-site semantic fixes) |
| Step 6 | 23 (residual fix: 1 tsconfig + 1 eslint config + 21 e2e/scripts touched by `eslint --fix` once they entered project coverage) |

## 4. Escape-Hatches Delta

Pre-Phase-2b: 6 entries (Phase 2a baseline — TD-FE-9).
Post-Phase-2b: 14 entries (+8 added during Wave C).

New `Untyped*` entries (Phase 2b additions, all annotated with `// TODO(phase-13):`, call-site reference, and one-line justification per Spec 17 §3 Step 3 policy):

1. `UntypedProfilerIcpRecord` — customer_profile ICP record consumed by mission-control + customers components.
2. `UntypedBackendProfile` — UserProfile / AgentProfile / CompanyProfile prop shapes.
3. `UntypedBackendDocument` — DataSourcesManager document-list consumer.
4. `UntypedBackendApiResponse` — generic untyped backend API envelopes (MarketResearch.tsx state + callback params + transform inputs).
5. `UntypedCascadeContext` — `previousContext` bag passed between sequential market-research component fetchers.
6. `UntypedLead` — strategist lead-stream + Chat-with-Scout lead handoff callbacks.
7. `UntypedVisualDataCardRaw` — regulatory visualDataCards raw shape pre-UI transform.
8. `UntypedBackendSignal` — raw signal objects from `/api/generate-signals-batch` and `/api/signals` consumed by `buildSignalCardsFromFetchData` and inline console.log mappings on Signals.tsx.

All 8 share the same pattern: backend response/payload shapes consumed by FE before contract types are written — exactly the precedent Phase 2a set with TD-FE-9.

## 5. TD-FE Entries Created

- **TD-FE-10** — Phase 2b escape-hatches threshold reached (8 new entries; 14 total). Origin: Spec 18 Wave C. Documented in `docs/TECH_DEBT.md`. Pull-forward trigger: Phase 13 audit / backend contract typing (Phase ~10+).

No other TD-FE entries created (no new out-of-scope discoveries beyond the documented escape-hatches pattern).

## 6. Plan-Stage Decisions

Per Spec 18 §7 open questions:

1. **Step 0 re-baseline numbers (§7.1).** Actual: 1087 problems / 1035 errors / 52 warnings — *higher* than spec design-time 392 anchor. Driver: spec anchored on pre-Phase-2b lint config; the new config (type-aware + `import-x/order` + `consistent-type-imports` + `--max-warnings 0`) surfaced 695 additional issues.
2. **Wave A split decisions per area (§7.2).** Split into 16 area-groups; deviated from plan's plain "per-area" guidance by sub-splitting:
   - `src/components/market-research/` into `lead-stream/` + root files (large area).
   - `src/pages/` into 3 commits: small pages bundle + Signals.tsx + MissionControl.tsx + MarketResearch.tsx (large area).
   - All `src/components/` subdirs each got their own commit.
   - One judgment call: `market-research` was split into `lead-stream/` + root files; the `market-research` *section files* (e.g. `MarketSizeSection.tsx`) were NOT isolated like the `src/pages/` files were. Documented as a Wave A reviewer minor finding; acceptable since these files all share the same parent dir and were touched together post-Wave-A as well.
3. **Wave B batching decisions (§7.3).** Auto-fix sweep ran as 1 combined commit (`e33420d`), not split by area. Manual residue commits split by rule × area: `5f27133` (empty-object-type), `a13f055` (unused-vars), `23ba411` (cross-area low-volume), `aa5dce4` (market-research no-empty), `c2d96aa` (MarketResearch.tsx no-empty + case-decl), `a08b34c` (unused-disable sweep + import-order residue). 8 commits total (vs plan's flexible range).
4. **Wave C within-pages ordering (§7.4).** Picked ascending-error-count order per Step 0 per-file counts (lib/utils/services first, then small components, then pages, then large monoliths last).
5. **Wave D `checksVoidReturn` decision (§7.5).** **APPLIED.** Decision committed as `304777d` ("chore(fe): relax no-misused-promises for JSX attributes") — 57 of 67 baseline `no-misused-promises` errors were JSX-attribute sites (`onClick={async () => …}`, `onSubmit={asyncHandler}`). Relaxing only JSX attributes lets the rule keep catching unintentional non-JSX cases (the remaining 10 were fixed manually).
6. **`build-lint-probe.ts` location (§7.6).** `frontend/scripts/build-lint-probe.ts` (sibling to `build-strict-probe.ts` — same idiom as Phase 2a).
7. **Diff size reporting depth (§7.7).** Broken down per wave (see §9 below) for impl-review convenience.
8. **TD-FE numbering (§7.8).** Continued from TD-FE-10 as planned.

## 7. Additional Deviations and Notes

- **Task 1.0a — `eslint-plugin-import-x` version pin.** Plan called for the latest `4.x`. Pinned to `~4.15.0` because `4.16.2` had a peer-dep conflict with `@typescript-eslint/utils@8.56.0` (the only version that supports the lazy `projectService` API). 4.16.2 will be reachable when typescript-eslint bumps; not a blocker.
- **Task 2 — eslint ignores deviated from plan.** Plan said `ignores: ["dist"]`; actual: `["dist", "dev-dist", "coverage", "playwright-report"]`. Driven by Task 1.0b reviewer's [High] finding (dev-dist workbox files were generating 11 ban-types + 12 no-rule-id parser noise into the baseline).
- **Wave A `marketScoreDescriptions.test.ts` marked `.prettierignore`d.** Prettier wraps multi-line `expect(...)` such that an above-line `@ts-expect-error` directive no longer targets the type-error-bearing call. The file was added to `.prettierignore` with a 3-line comment explaining the constraint. Revisit when the test is rewritten to be whitespace-insensitive.
- **Step 6 surfaced 30 lint problems hidden during Wave D.** Root cause: `tsconfig.node.json` only included `vite.config.ts`, so `projectService` had no project for 26 files outside `src/` (e2e, scripts, configs). The Wave D Part 2 reviewer had flagged this as "[Low] 38 (no-rule-id) parser errors are largely a `parserOptions.project` scope issue, not Wave D triage" but the fix wasn't applied during Wave D. Fix landed in residual commit `35d4d3c` (Step 6): extended `tsconfig.node.json` `include` + added react-refresh override zone for context modules + auto-fix sweep of newly-included files + 4 manual touch-ups (unused imports + 1 explicit any in `scripts/build-audit-scorecard.ts`).
- **`react-hooks/exhaustive-deps` disable directives.** 33 `eslint-disable-next-line react-hooks/exhaustive-deps` directives across Wave D + Step 6, each with a one-line justification on the preceding line. This is allowed by posture rule 10 (intentional dep narrowing is documented at the disable site, not centralized).

## 8. Commit Summary

**78 commits on `phase-2b-eslint-prettier` (post-merge HEAD = `35d4d3c`).**

Wave-by-wave narrative:
- Pre-Step-0 docs (10 commits): spec rounds 1-3, plan rounds 1-2, spec/plan review + synthesis pairs.
- Step 0 (2 commits): install deps + lint+prettier probe baseline.
- Step 1 (1 commit): wire eslint type-aware rules + prettier config + scripts + .git-blame-ignore-revs scaffold.
- Wave A (17 commits): Prettier per-area mass-format (16 area-groups) + 1 aggregation commit (`d833810`) adding all Wave A SHAs to `.git-blame-ignore-revs`.
- Wave B (8 commits): auto-fix sweep + 4 manual residue commits + 1 unused-disable sweep + post-Wave-B re-probe + post-Wave-B touch-ups + 1 docs(reviews) commit for Wave A/B impl reviews.
- Wave C (20 commits): per-file type-tighten across `src/` (ascending-error-count order) + 1 residual import-x/order commit + post-Wave-C re-probe.
- Wave D (20 commits): JSX-decision config relax + 16 per-component fix commits + rules-of-hooks fix + Wave-D-end prettier residual touch-up.
- Step 6 (1 commit): residual fix (this scorecard is committed in a follow-up commit, not counted here).

## 9. Diff Size

Aggregate `git diff --shortstat master..HEAD`:

```
232 files changed, 32595 insertions(+), 25518 deletions(-)
```

Per-wave breakdown:

| Wave | Commits | Files | Insertions | Deletions |
|---|---:|---:|---:|---:|
| Step 0 | 2 | 8 | 3320 | 7 |
| Step 1 | 1 | 6 | 81 | 9 |
| Wave A | 17 | 200 | 20380 | 23898 |
| Wave B | 8 | 110 | 1800 | 548 |
| Wave C | 20 | 47 | 1865 | 539 |
| Wave D | 20 | 29 | 655 | 560 |
| Step 6 | 1 | 23 | 66 | 29 |
| **Total** | **69** | **232** | **32595** | **25518** |

(69 = sum of code-changing commits; the other 9 pre-Step-0 docs commits don't touch code.)

Wave A's diff dominates (mechanical formatting; ~20k insertions, ~24k deletions). The `.git-blame-ignore-revs` aggregation makes Wave A's diff invisible to future `git blame` (GitHub honors automatically; local users need `git config blame.ignoreRevsFile .git-blame-ignore-revs`).

## 10. Verification

All Spec 18 §5 done-when items verified at HEAD before merge:

| # | Item | Status | Value |
|---|---|---|---|
| 1 | `frontend/eslint.config.js` has 5 rules + `import-x/order` + 3 override zones + `eslint-config-prettier` last + `projectService: true` | PASS | All present (verified by `grep`). |
| 2 | `.prettierrc` + `.prettierignore` at `frontend/`; `.git-blame-ignore-revs` at monorepo root with all Wave A SHAs | PASS | All 3 files present. 16 Wave A SHAs in blame-revs (verified by SHA-presence loop). |
| 3 | `npm run lint` returns 0 errors / 0 warnings | PASS | `npm run lint` exit 0. |
| 4 | `npm run format:check` green | PASS | "All matched files use Prettier code style!" |
| 5 | `npm run typecheck` green | PASS | `tsc --noEmit -p tsconfig.app.json` exit 0. |
| 6 | `npm run preflight` green end-to-end (typecheck + lint + format:check + build + playwright + vitest + knip) | PASS | All 7 sub-commands green; full chain exit 0 (~7 min total). |
| 7 | 0 `no-explicit-any` and 0 `no-unsafe-*` in production paths | PASS | 0 hits via `npx eslint . | grep (no-explicit-any | no-unsafe-)` excluding tests/e2e. |
| 8 | `eslint-disable-next-line @typescript-eslint/no-explicit-any` count in production paths is 0 | PASS | 0 hits via `rg eslint-disable-next-line.*no-explicit-any` excluding tests. (The file-level `eslint-disable @typescript-eslint/no-explicit-any` in `src/lib/types/escape-hatches.ts:18` is the escape-hatches file's intentional self-disable, not a `next-line` disable.) |
| 9 | `@ts-*` suppression count ≤5 | PASS | 5 (unchanged from Phase 2a baseline). All 5 in `__tests__/` files for `typeof` guard exercise or coercion check. |
| 10 | New escape-hatches entries each have `TODO(phase-13)` + `Untyped*` prefix + call-site + justification; TD-FE-N entry if 5+ new | PASS | 8 new entries (14 total); each has all 4 required annotations; TD-FE-10 captures the Phase 2b pattern. |
| 11 | Scorecard merged at `docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md` | PASS | This file. |

The master plan's row for Phase 2b (Spec 14 §4) updates to `done` with the merge date — handled by `synthesize-impl-review` per Spec 14 §5.5.
