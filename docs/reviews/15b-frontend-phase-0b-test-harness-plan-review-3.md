---
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 3
---

## Context

Round 3 is a full re-pass after Rounds 1 and 2. All prior findings have been verified against the current plan text and source code. Round 2's seven findings are all resolved in the current plan version (confirmed below). Source verification: all five characterization target files were read, `isRateLimitError` covers exactly 12 phrases matching the plan's test array, `@vitejs/plugin-react-swc` is present in `package.json`, `sanitizeAnswerText` is exported from `utils.ts`, `loginAsTestUser` in `e2e/helpers/login.ts` calls `installApiMocks` internally, and `num(undefined)` returns `0` in `marketScoresHeatmap.ts`.

## Prior-round resolution status

| Round 2 finding | Resolution |
|---|---|
| M — isRateLimitError covers only 6/12 phrases | **Resolved.** Plan's test array (Task 6 Step 1, lines 1394–1407) now lists all 12 phrases matching source `rateLimitManager.ts:130-142`. |
| M — measure-baselines.sh crashes on malformed JSON | **Resolved.** Plan's script (Task 10 Step 1, lines 1843–1858) includes a pre-flight integrity check that validates existing JSON before starting measurements. |
| L — logfile name diverges from Phase 0a | **Resolved.** Plan uses `/tmp/phase-0a-vite-dev.$$.log` (line 1812), matching Phase 0a's convention. |
| L — No overall time budget | **Resolved.** Plan-level abort criterion #3 (line 15) specifies a 90-minute ceiling excluding Task 10's measurement window. |
| L — Redundant installApiMocks calls in gap journeys | **Resolved.** Gap journey specs now call only `loginAsTestUser` (which internally calls `installApiMocks`); the redundant `installApiMocks` + `installCatchAllApiMock` calls are removed. |
| N — Redundant em-dash assertion | **Resolved.** Plan now tests U+2015 (horizontal bar) explicitly (line 1128). |
| N — Round 1 severity reassessment | Not applicable to this round. |

## Findings

### [Low] "Eleven commits" in Architecture header is factually wrong — actual count is 10

**Location:** Line 7 — `Architecture:` paragraph: "Eleven commits on one branch, ordered by dependency."

The task breakdown produces exactly 10 commits: Tasks 1–6 (1 + 5), Tasks 7–8 (2), Task 9 (1), Task 10 (1) = 10. Task 11 is verification-only with no commit. The Task 11 Step 1 verification output (lines 2061–2072) correctly shows 10 expected commits. An agent that checks the Architecture header against the task list will see a mismatch. The header should read "Ten commits." Not execution-blocking — Task 11 Step 1 is authoritative — but the prose error could cause unnecessary re-verification or confusion about a missing commit.

### [Low] Gap journeys lack explicit page-element visibility assertions required by spec §3.4

**Location:** Task 7 Step 1 and Task 8 Step 1 — gap journey spec file content (lines 1535–1544, 1626–1635)

Spec §3.4 states each gap journey should "assert the page heading or a recognizable element is visible." The plan's code checks only `expect(page).not.toHaveURL(/\/login/)` before the screenshot. This confirms the user wasn't redirected to login, but does not confirm the page rendered any content. The screenshot comparison (`toHaveScreenshot`) does implicitly verify visual content, but spec §3.4 asks for an explicit behavioral assertion. Adding a single `await expect(page.getByRole('heading', { level: 1 })).toBeVisible()` (or equivalent) after the navigation would satisfy the spec requirement and provide a faster-failing signal than waiting for the screenshot diff.

### [Low] `node:path` import in vitest.config.ts deviates from spec §3.1 without acknowledgment

**Location:** Task 1 Step 3 — `frontend/vitest.config.ts` content (line 211)

Spec §3.1 provides `import path from 'path'`. The plan uses `import path from 'node:path'`. Both work identically on Node 22 and the `node:` prefix is more idiomatic for ESM, but the plan's "Spec adherence vs code reality" header section (lines 25–31) does not mention this deviation. The three documented deviations there are all about behavioral differences; this is a stylistic one. Still, an agent comparing the plan's code against the spec character-for-character will flag it, and the lack of acknowledgment means there's no guidance on whether to match the spec or the plan.

### [Nit] `heatmapLeadFromUnknownRow` edge case missing `ratings`/`totalScore` field assertions

**Location:** Task 4 Step 1 — test case "returns '—' as company when no company field resolves" (line 972)

The test passes `{ lead_id: 'lead_5' }` with no score fields. `num(undefined)` returns `0`, so `mapMarketScoresRowToHeatmapLead` would produce `totalScore: 0.0` and all `ratings` entries as `'Low'`. The test only asserts `company` and `name` are `'—'`, leaving the score-derived fields uncharacterized for this edge case. If a Phase 1+ refactor changes `num`'s fallback from `0` to `NaN` or throws, this test would not catch the regression. The other test cases exercise the score-mapping paths thoroughly, so the gap is narrow — but for a characterization test whose purpose is to lock *all reachable behavior*, the omission is worth noting.

---

## Checklist Coverage Summary

| Dimension | Assessment | Notes |
|---|---|---|
| **Sequencing and dependencies** | Correct. Task 0→1→[2–8]→9→10→11. No forward references. Task 9 depends on Tasks 1–6 for `npm run test` to pass and Tasks 7–8 for `test:e2e` to pass with the new journeys. | No change from prior rounds. |
| **Risk front-loading** | Good. Riskiest item (harness install + MSW proof-of-pipeline) is Task 1. Stateful characterization (rateLimitManager) is Task 6, before preflight chain (Task 9). The dep install failure in Task 1 Step 1 surfaces before any code is written. | No change. |
| **Decomposition for reviewability** | Strong. One commit per survivor file. Gap journeys separate from characterization. Preflight chain extension separate from both. NFR measurement separate. Task 11 is commit-free verification. | No change. |
| **Recovery strategy** | Good. Per-task STOP conditions (Tasks 0/1/6/7/8/9/10/11). Plan-level abort criteria with explicit thresholds (2 debug attempts per task, 3 preflight fix attempts, 90-minute wall-time ceiling). Bug-handling decision tree for gap journeys (small fix vs TD-FE). | No change. |
| **Kill criteria / abort conditions** | Present and explicit. Three plan-level escalations plus per-task STOP conditions. The 90-minute ceiling (excluding Task 10) is a reasonable guardrail. | No change. |
| **Verification per step** | Strong. Every task runs its test in isolation. Task 4 has a midpoint full-suite regression check. Task 11 runs full preflight end-to-end. Gap journeys have idempotency checks (run twice, confirm snapshot matches itself). Source-verified: all characterization assertions match current code behavior. | Confirmed via source verification. |
| **Hidden prerequisites** | All stated: Node 22, npm 10, Phase 0a merged, Playwright browsers. `@vitejs/plugin-react-swc` (needed by `vitest.config.ts`) confirmed present at `package.json:80`. Python 3 for `measure-baselines.sh` is implicit but standard on all target platforms. `@testing-library/jest-dom/vitest` import path is valid for `@testing-library/jest-dom@^6` (confirmed: the `/vitest` subpath was added in v6). | No new gaps found. |
| **Drift from spec** | Three documented spec drifts in plan header (rateLimitManager cap 30 vs 4, `utils.ts` dual export, `marketScoreDescriptions` lookup shape). All acknowledged with explicit resolutions. Coverage map table (lines 2153–2161) matches spec §3.7 done-when 1-on-1. No scope creep beyond spec. Two additional minor deviations noted above (`node:path` import, gap journey visibility assertions). | Minor additions. |
| **Parallelizability** | Explicitly documented (lines 8–9). Tasks 2–6 mutually independent. Tasks 7–8 must serialize relative to each other (shared `api-mocks.ts`). Tasks 9–11 sequential. Rationale for each constraint is stated. | No change. |
| **Overengineering** | Minimal. The `logTimestampComparison` no-op test (Task 2) is defensible — it locks the "this function must remain a no-op" contract. The `@testing-library/react` + `user-event` installs are unused but spec-mandated baseline. The 12-phrase `isRateLimitError` fan-out (Task 6) is proportional to the function's surface. The only arguably excessive element is the full `measure-baselines.sh` replacement (173 lines) where a surgical append would suffice — but the plan includes a drift guard and justifies the full replacement as preserving the 0a anchor. | No change. |
