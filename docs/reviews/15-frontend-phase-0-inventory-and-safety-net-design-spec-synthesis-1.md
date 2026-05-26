---
synthesizes_review: docs/reviews/15-frontend-phase-0-inventory-and-safety-net-design-spec-review-1.md
artifact: specs/15-frontend-phase-0-inventory-and-safety-net-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 1
---

## Round Recommendation

**no**

Reason: All 3 High findings agreed and being revised; all Medium/Low findings agreed and being revised (with two of them reversing prior brainstorming recommendations the reactor now considers wrong); single Nit disagreement is naming convention inherited from master §5.4. No Critical/High remains after synthesis; revisions reduce design surface (drop tools, drop workflow) rather than open new surface needing a re-review.

## Agreed Findings

- **[H1] CI `setup`/`playwright` cache architecture.** Folding `npm ci` into the `playwright` job and eliminating the `setup` indirection per reviewer's option (b). Single-active-gate scope at 0a doesn't justify cross-job cache plumbing. Will revisit a multi-job structure in Phase 2c when parallel gates land. Revising §2.7.

- **[H2] Proof-of-pipeline smoke test undefined.** Adding explicit test file `frontend/src/test/__tests__/msw-pipeline.test.ts` to §3.3 targets and §8 companion list. The test asserts `fetch('/api/_health')` is intercepted by MSW and returns `{ ok: true }` under jsdom. Revising §3.3 (new row) and §8 (new entry).

- **[H3] Playwright Docker version vs `package.json` sync.** Pinning `@playwright/test` to exact `1.59.1` (remove caret) per reviewer's option (a) — simpler than env-var indirection or preflight check. Cost of forgoing automatic minor bumps for a test framework is essentially zero given deterministic-version need for visual regression. Also adding the coupling to §6 Risks as a residual constraint. Revising §1.3, §2.7, §6.

- **[M1] Three dead-code tools overspecified.** Reducing to **knip only**. This reverses the brainstorming-approved choice of "all three with distinct roles." The reactor now considers that recommendation wrong: `ts-prune` is largely unmaintained, `depcheck` is lightly maintained, and `knip` already covers files + exports + deps. Reconciling three columns in the Tier-2 annex adds Phase-1 triage noise with no actionable gain for a one-time baseline. If Phase 1 hits a knip blind spot, it can add `ts-prune` ad hoc then. Revising §2.2, §2.1 Tier-2 schema (removing the ts-prune column), §8 companion list (removing two raw output files).

- **[M2] Re-baseline workflow heavy for current project state.** Dropping `visual-rebaseline.yml` and `frontend/e2e/REBASELINE.md`. This reverses the brainstorming-approved choice of "PR label `visual-rebaseline`." The reactor now considers that recommendation wrong: CLAUDE.md explicitly states "MVP, 0 live users — optimize for velocity over deployment ceremony; skip ceremony that exists to protect users you don't have yet." A PR-label automation for a single-author repo with zero users is exactly the ceremony CLAUDE.md tells us to skip. Replacing with a 2-line comment block in `playwright.config.ts` documenting `npm run test:e2e:update-snapshots`. Master spec §8 Q2 mentioned PR-label vs commit-message as options — picking neither is also a valid resolution. Revising §2.6, §2.9 (remove done-when item 6), §8 (remove two companion files), §7.1 (resolution of Q2). Adding a note in §6 that the workflow can be reintroduced in Phase 2c if usage justifies.

- **[M3] `rateLimitManager` not a "pure-function survivor".** Renaming §3.3 table header to "stable utility survivors" and adding a one-line note under the table distinguishing the 4 pure-function targets from the 1 stateful target (`rateLimitManager`). The test plan was already correct (`vi.useFakeTimers()`); only the categorization wording changes. Revising §3.3.

- **[M4] knip false-positive handling.** Adding §2.2 documentation of expected false-positive categories: barrel exports, dynamic imports, route configs using lazy loading, Vite plugin transforms, HMR entry points. Phase 1's triage knows to apply skepticism on candidates in those categories. Revising §2.2.

- **[M5] ESLint config description in §1.3.** Updating to "ESLint flat-config v9 extending `js.configs.recommended` and `tseslint.configs.recommended` (with `@typescript-eslint/no-unused-vars` off — most TS rules effectively inert under the non-strict config), plus `react-hooks` and `react-refresh`." Revising §1.3.

- **[M6] `src/services/api.ts` vs `src/lib/api*.ts` clarity in §1.5.** Updating the §1.5 line to enumerate both paths: "`src/services/api.ts` (a single file separate from the three-layer client) and the `src/lib/api.ts`/`authenticatedApi.ts`/`enhancedApi.ts` trio — all deferred to Phase 3." Revising §1.5.

- **[M7] NFR script runtime unstated.** Adding "Expected runtime: 10–20 minutes on typical dev hardware. Run locally, not in CI." to §2.4. Revising §2.4.

- **[L1] Bundle baseline gzip extraction approach.** Adding to §2.3: "Per-chunk gzip sizes extracted via the `gzip-size` npm package in a small post-build script (`frontend/scripts/capture-bundle-baseline.ts`). Vite's `reportCompressedSize` output isn't structured enough for JSON capture." The companion-documents §8 gains the script file. Revising §2.3, §8.

- **[L2] Tier-2 ripgrep column naming.** Renaming "inbound-ref count" to "static inbound-ref count (rg)" with note in §2.1 prose that this count is a lower bound (misses dynamic `import()`, barrel re-exports, lazy route configs); the `knip` dead-file flag is the authoritative signal. Revising §2.1.

- **[L3] Gap journey coverage map.** Adding an explicit coverage map at the top of §3.4: existing journeys cover login/tenant-selection (01), csv-upload (02), signals (03), market-research (04 — also navigates to `/your-ai-team/scout/marketintelligence`), icp-create (05). Stubs cover insights/reports/calendar/agent-hub/artifacts. Gaps: `/customers`, `/settings`. `/your-ai-team/strategist/:tab` excluded because Strategist has no backend (CLAUDE.md: it's a sessionStorage-driven sequence builder); a load test would be redundant with the existing `04` journey that exercises the same auth path. Revising §3.4.

- **[L4] Vitest `globals: true` stylistic concern.** Flipping to `globals: false`. Test files import `describe`, `it`, `expect` from `'vitest'` explicitly. Consistent with the "agents-as-authors" principle of explicit, machine-readable code (master §1.4). Cost is one extra import line per test file. Revising §3.1 config snippet.

- **[L5] NFR hardware metadata structure.** Restructuring the JSON example in §2.4 to use explicit fields: `{"os": "Linux 6.x or macOS …", "cpu": "<model string>", "ram_gb": <int>, "node_version": "...", "npm_version": "..."}` instead of the free-text `hardware_note`. Revising §2.4.

- **[N1] §1.3 maxDiffPixels/maxDiffPixelRatio wording.** Tightening the parenthetical at §2.5 line 136 to make the unit change explicit: `(was maxDiffPixels: 100 — an absolute count; now maxDiffPixelRatio: 0.01 — a ratio)`. Revising §2.5.

- **[N2] §8 companion list only names timestampUtils as example test file.** Expanding §8 to list all 5 characterization test files explicitly: `timestampUtils.test.ts`, `marketScoreDescriptions.test.ts`, `marketScoresHeatmap.test.ts`, `utils.test.ts`, `rateLimitManager.test.ts`. Revising §8.

## Disagreed Findings

- **[N3] Review artifact naming convention verbose.** The naming convention is inherited from master spec §5.4: "Review and synthesis filenames derive from the spec's or plan's filename. The base is the spec/plan file's basename without `.md`, with `-review-N.md` or `-synthesis-N.md` appended." Backend specs 11, 12, 13 and the master spec 14 itself all follow this convention. Adopting an abbreviated form for Phase 0 reviews alone would create inconsistency across the repo's review corpus. Leaving as is.

## Deferred Findings

- **[L6] Re-baseline workflow needs write permissions.** Moot — resolved by [M2] dropping the workflow entirely. No action.

## Severity Disagreements

None. The reviewer's severity assignments are accepted.

## Open Questions

1. The reactor reversed two brainstorming-approved recommendations in [M1] and [M2]. If the user disagrees with either reversal, they should push back during synthesis review — both reductions remove design surface but also remove options that the user explicitly chose. The reactor's reasoning is that the original recommendations underweighted (a) the MVP/pre-launch project state called out in CLAUDE.md and (b) tooling-overlap diminishing returns. If the user wants either retained, restore the original spec text.

2. The reviewer's plan-readiness assessment named H1, H2, and M1 as the three blockers. All three are addressed in this round. The spec should be plan-ready after revisions land.
