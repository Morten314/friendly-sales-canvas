---
artifact: plans/24g-frontend-phase-5g-industry-trends.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 2
---

## Context

Round 2. All 8 findings from round 1 (1 High, 3 Medium, 3 Low, 1 Nit) were addressed: Task 8 Step 6 now explicitly removes the page-level `useMarketResearchData` slice; the batching note corrects "5h MarketSize"; Task 8 Step 5 is decomposed into sub-steps 5a–5e; `useAuth()` reachability is verified in Task 0 Step 5; Task 4 done-when is scoped to "ready for consumption"; a parallelism note covers Tasks 3–4 ‖ 5–6; `orgId` sourcing is specified in Task 8 Step 4; and a test-scope note explains Task 1's full-suite run. This round assesses residual issues.

## Findings

### [Medium] Task 8 atomicity constraint not reconciled with Step 6 cascade deferral path

**Location:** Task 8, Step 8 (line 414) and Step 6 (line 410)

Step 8 states: "Steps 1–7 land together — the prop-surface and page-level removals must be atomic to keep `tsc` green." Step 6 offers a deferral option if cascade coupling is found: "defer this slice's removal to a named sub-phase with a recorded `TD-FE` entry." But the plan does not explicitly state that **committing Steps 1–5+7 without Step 6** is acceptable as a valid partial Task 8 when Step 6 is deferred.

The atomicity rationale (removing interface members without removing consumers would break `tsc`) still holds without Step 6 — Steps 3–5 remove both the `MarketIntelligenceTabProps` data members AND the importer JSX consumer atomically, so skipping Step 6 leaves an orphaned-but-harmless `industryTrendsData` in the page-level hook without a `tsc` error. But an implementer reading the constraint literally ("Steps 1–7 land together") may conclude they cannot commit at all without Step 6, and either (a) unnecessarily revert all of 5g per the R3 escape hatch, or (b) hold the entire Task 8 uncommitted while trying to resolve the cascade.

A sentence like "If Step 6 is deferred, commit Steps 1–5+7 without Step 6; the orphaned page-level slice is harmless to `tsc` and is tracked by the `TD-FE` entry" would close this gap.

### [Low] Task 0 seam audit doesn't front-load the `useMarketResearchData` cascade check

**Location:** Task 0, Step 4 (line 54)

Task 0 audits `IndustryTrendsSection.tsx` seams, which correctly scopes it to the section file. But the plan's riskiest decision point — whether the industry-trends cascade in `useMarketResearchData` is cleanable — is deferred to Task 8 Step 6. A quick `grep -n 'industryTrend\|previousContext\|cascade' src/features/market-research/hooks/useMarketResearchData.ts` in Task 0 Step 4 (alongside the section-file audit) would front-load this discovery, letting the plan author or implementer replan before committing any work. The plan's current structure means up to 7 tasks of work could be at risk of the R3 escape hatch, though the deferral option mitigates the worst case. Low because the plan handles the blocked path correctly; this is about earlier signal.

### [Nit] Task 3 test has a style inconsistency

**Location:** Task 3, Step 1 (lines 213–223)

The first test case uses `waitFor` (async data loading), while the second immediately checks `result.current.regenerate.mutate` without `waitFor`. This is correct — `regenerate` is a synchronous `useMutation` handle — but the style inconsistency could confuse an implementer into thinking the second test is missing an await. A comment like `// mutate handle is synchronous` would clarify.
