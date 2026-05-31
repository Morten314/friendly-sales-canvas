---
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 3
---

## Context

Round 3 review. Rounds 1–2 identified 18 findings total; the plan has been substantially revised. The current version addresses all round-2 findings: Task 6 Step 1 gained incremental compile guidance, `useRegenerateResearch` now uses `setQueryData` instead of `invalidateQueries`, the §9 delta now captures the §4.1 GET→POST correction, Task 6 Step 3b was added to correct E2E mock envelopes + add render assertions, Task 4 Step 5 gained an explicit vitest run, and ADR git-add commands use slug globs instead of hardcoded numbers. This review assesses the current plan text against the full checklist and spot-verifies claims against the codebase.

The source spec (`specs/24-frontend-phase-5-market-research-design.md` §4) was read in full. The shared `client.ts` was confirmed: `apiPost(endpoint, body, schema)` matches the plan's service-fn signature, and `rateLimiter` is integrated at `apiRequest` (line 18). The moved page exists at `src/features/market-research/pages/MarketResearchPage.tsx` with 9 `fetch(` sites and 68 `localStorage` refs, matching the plan's anchors. ADR directory contains only `0001`/`0002`.

## Findings

### [High] Plan claims all 5 sections self-fetch `market-research`; CompetitorLandscapeSection does not

**Location:** Architecture paragraph ("Scope note"), line 7: "the five section components *also* self-fetch the same `market-research` endpoint + keep their own localStorage cache"; Task 0 Step 3 final paragraph: "expected: MarketEntry/Regulatory/Competitor/IndustryTrends/MarketSize all self-fetch `market-research` + cache — those convert in 5d–5h"

Codebase verification shows CompetitorLandscapeSection.tsx calls `/api/ask` (line 697) and `/api/market_intelligence` (line 727) — not `market-research`. Only 4 of 5 sections call `apiFetchJson("market-research")`: IndustryTrendsSection (line 341), MarketEntrySection (line 2152), RegulatoryComplianceSection (line 609), MarketSizeSection (line 488).

The page itself does fetch competitor data via `market-research` POST (MarketResearchPage.tsx line 3252) and passes it as props — that page-level fetch is correctly in 5b's scope. The issue is the claim about section-internal fetches: the CompetitorLandscape 5f plan will encounter `/api/ask` and `/api/market_intelligence` endpoints with different request/response shapes, not the `market-research` contract 5b creates. Downstream 5f should not assume it can swap `apiFetchJson("market-research")` for `fetchResearchComponent` because CompetitorLandscape never calls that endpoint.

Recommendation: correct the claim to "4 of 5 sections self-fetch `market-research`; CompetitorLandscapeSection calls `/api/ask` and `/api/market_intelligence` instead." Flag this for the 5f plan so it performs its own endpoint analysis rather than assuming the 5b data layer covers its self-fetches.

### [Low] Task 3 Step 2 verification does not actually test the new MSW handlers

**Location:** Task 3 Step 2 ("Verify the harness still loads + commit")

The step runs `npx vitest run src/features/market-research`, which executes the contracts test from Task 2. That test does `Schema.parse(payload)` against a hardcoded fixture — it does not use MSW. The new MSW handlers are therefore untested until Task 4's service tests consume them. If a handler has a syntax error or returns a wrong shape, Task 3 passes despite the handler being broken, and the failure surfaces in Task 4 instead (where the cause is less obvious).

Not a blocking issue: Task 4 will catch handler problems, and the handlers are test infrastructure, not production code. But the verification step's description ("contracts test stays green") is misleading — it confirms nothing about the handlers. Consider either (a) adding a trivial smoke test in Task 3 that exercises the handler, or (b) changing the verification description to "existing tests still pass; handlers are first exercised in Task 4."

### [Low] `userId` excluded from query key — cache serves wrong-user data if userId changes without orgId change

**Location:** Task 5 Step 3, `useMarketResearch.ts` implementation; Task 5 Step 1, `qk` extension

The query key is `["market-research", "component", orgId, componentName]` — keyed on `orgId` + `componentName` but not `userId`. The POST body includes `user_id`. If a different user operates under the same `orgId` (e.g., re-login, multi-user org), TanStack serves cached data fetched with the previous `user_id` without re-POSTing. The response would be the same backend data (the endpoint is org-scoped and doesn't validate auth), so the practical risk is near zero at MVP (0 users, no auth enforcement per AGENTS.md). But the cache keying is technically wrong if user-scoping ever becomes real.

Recommendation: note this in ADR-0004 as an accepted limitation (consistent with the repo's "no real auth" posture), or add `userId` to the key. The latter would cause cache eviction on re-login (acceptable, since memory-only means re-fetch anyway).

### [Nit] Self-review note claims "the 5a E2E mock's envelope was `{ component_name, status, result, cached }`" — describes the wrong mock

**Location:** Self-review notes, paragraph 3: "Corrects the round-1 assumption — copied from the 5a E2E mock — that the envelope was `{ component_name, status, result, cached }`"

This is accurate for `e2e/fixtures/api-mocks.ts`, which does use that fabricated shape. But the "5a E2E mock" could be read as the mock 5a *introduced*, when in fact `api-mocks.ts` pre-dates 5a. Minor phrasing nit — the plan body correctly identifies both mock sources (Task 6 Step 3b).

### [Nit] Task 4 Step 3 combines "run it red" and "implement" into a single checkbox

**Location:** Task 4 Step 3 ("Run it red, then Step 4: implement")

The step text says "Step 3: Run it red, then Step 4: implement" but the checkbox is a single `- [ ]` covering both actions. Every other task splits red/green into separate checkboxes (Task 2 Steps 2/3, Task 5 Steps 3/4). This means a partially-completed Step 3 (test red, implementation not started) has no tracking granularity. Cosmetic — the agent will discover the split from the subtext.
