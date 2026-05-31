---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 2
---

## Context

Round 2 review. Round 1 findings (9 items, 2 High / 3 Medium / 3 Low / 1 Nit) were synthesized and the plan was revised to incorporate all agreed findings. This review evaluates the revised plan text. The synthesis disagreed with one finding (E2E timing, round-1 F5); that disagreement is acknowledged below but the concern is re-examined against the revised task structure.

## Findings

### [Medium] E2E parity guard still deferred to Task 6 — regression surface widens across Task 5

**Location:** Task 6 Step 1: `npm run preflight`; Tasks 1–5 verification steps (each runs `npm run test` but not Playwright)

Round 1 F5 flagged this and the synthesis disagreed, arguing spec §8 mandates E2E "between every sub-phase" (5a/5b/5c boundaries), not between tasks within 5c, and that Task 6's preflight satisfies that requirement. That reading of the spec is correct. However, from a plan-quality standpoint, the gap between Task 4 (last structural cut into a 7k `React.memo`) and Task 6 (preflight) includes Task 5 (state rehoming + context decision + thin-shell reduction) — the most judgment-laden task. If Task 3 or Task 4 introduced a tab-routing regression in the `chatwithscout` or `leadstream` URL segments, that regression would not surface until *after* Task 5 has rewritten the page's state management, making the regression harder to bisect. Running `npx playwright test journeys/04` after Task 4 (when all three tab containers are extracted and the page structure is at its most changed) would catch extraction regressions before the state-rehoming layer is added. Cost: one Playwright run. The synthesis's argument that Tasks 4 and 6 are "immediately adjacent" understates the gap — Task 5 is a non-trivial rewrite between them.

### [Low] Tasks 3 and 4 share MarketResearchPage.tsx — not noted alongside the independence callout

**Location:** "Task independence" note (line 19)

The plan correctly identifies that Tasks 2 and 3 can run concurrently (disjoint files). It does not note that Tasks 3 and 4 *cannot* run concurrently — both modify `MarketResearchPage.tsx` — which is the other half of the parallelizability picture. An executor reading only the independence note and the file lists might attempt Tasks 3 || 4 and encounter merge conflicts on the shared page file. A single sentence (e.g., "Tasks 3 and 4 both edit MarketResearchPage.tsx and must remain serial") would close this.

### [Low] `MarketIntelligenceSections` treatment in Task 1 is ambiguous

**Location:** Task 1 Step 2: "composes `MarketIntelligenceSections` (or its successor)"

The parenthetical "or its successor" leaves the executor with an ad-hoc choice. The spec §2.3 says the composition layer is "rationalized into `components/intelligence/`," but 5c doesn't decompose sections (5d–5h do). If `MarketIntelligenceSections` is imported as-is from its current post-5a location, say so explicitly. If it should be renamed or re-exported as part of IntelligenceTab's creation, specify that. The current phrasing implies the executor decides, which is a minor but avoidable decision point in the highest-risk task.

### [Low] Task 2 conditional deletion of `MarketIntelligenceTab` requires an unstated determination

**Location:** Task 2 Step 2: "Remove SafeMarketIntelligenceTab and any now-orphaned thin wrapper (MarketIntelligenceTab if it only existed to feed Safe)"

The parenthetical "if it only existed to feed Safe" requires the executor to determine `MarketIntelligenceTab`'s role at execution time. This determination could be made during Task 0's inventory (which currently does not cover this component's role). Adding a line to Task 0 Step 3's grep set (e.g., `echo "=== MarketIntelligenceTab importers ==="; grep -rn 'MarketIntelligenceTab' src`) would give the executor the data needed to resolve the conditional before reaching Task 2.

### [Nit] Inconsistent `knip --strict` usage across deletion-adjacent tasks

**Location:** Task 2 Step 3 and Task 5 Step 3 run `knip --strict`; Tasks 3 and 4 do not

Tasks 3 and 4 both remove imports and state from `MarketResearchPage.tsx`. If any removed import was the sole consumer of an export in another module, the orphan surfaces only at Task 5's knip run — three tasks later. This is low risk (knip catches it before the sub-phase merges), but inconsistent with Task 2's immediate knip check after a file deletion. Adding `npx knip --strict --no-progress` to Task 3 and Task 4 verification would make orphan detection immediate.
