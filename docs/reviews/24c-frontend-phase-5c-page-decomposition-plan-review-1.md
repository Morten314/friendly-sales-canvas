---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 1
---

## Findings

### [High] No stated recovery strategy for non-R1 mid-task failures

**Location:** Tasks 1–4 commit steps (e.g., Task 1 Step 4, Task 3 Step 3)

The plan has an explicit abort path only for the R1 coupling case (prerequisite section + Task 5 Step 1: "revert 5c and replan"). But there is no stated recovery for other failure modes: what happens when Task 3 Step 3's green check fails? The implicit assumption is fix-forward, but it is never stated. The review checklist minimum is "report to human and wait" — the plan is silent beyond "green + commit." A single sentence in the conventions block (e.g., "If a task's verification step reds, fix-forward within the task; if unresolvable, report and wait for human direction") would close this gap.

### [High] Task 1 verification is narrow — regression in tab routing surfaces late

**Location:** Task 1 Step 4: `npx vitest run src/features/market-research/components/intelligence`

Task 1 runs vitest only on the intelligence subdirectory. Tasks 2–4 each run `npm run test` (full suite). If the IntelligenceTab extraction breaks tab routing or the page's render branches (the first structural cut into a 7k-LOC `React.memo`), the full vitest suite won't catch it until Task 2, and the behavioral E2E (`journeys/04`) — the primary parity guard — won't run until Task 5. Given that Task 1 is the *first* extraction from a monolithic page, this is the highest-risk single step. Consider running the full `npm run test` (or at minimum the market-research-scoped suite) in Task 1 Step 4 as well.

### [Medium] Tasks 2 and 3 are independent but serialized without acknowledgment

**Location:** Tasks 2 and 3 (sequential, no dependency noted)

Task 2 modifies `IntelligenceTab.tsx` (created in Task 1) and deletes `SafeMarketIntelligenceTab`. Task 3 creates `LeadStreamTab.tsx` and modifies `MarketResearchPage.tsx`. These touch disjoint file sets and have no data dependency. The plan serializes them without noting their independence, which unnecessarily blocks Task 3 behind Task 2. For a subagent-driven execution, calling out this parallelizability would allow concurrent work. Serial is still safe (and simpler), but the plan should state that the ordering is arbitrary/conventional, not dependency-driven.

### [Medium] Task 4 mixes two scopes: structural extraction and analytical state decision

**Location:** Task 4 heading and Step 2

Task 4 does two distinct things: (1) extract `TrendsTab` (a structural extraction similar to Tasks 1 and 3), and (2) rehome all residual `useState` + decide whether `MarketResearchContext` exists (an analytical/decision task that requires reasoning about the full inventory). The extraction is mechanical; the state rehoming requires judgment. These are different concerns. Separating them into Task 4a (TrendsTab extraction) and Task 4b (state rehoming + context decision) would give each a single reviewer-verifiable scope and allow the TrendsTab extraction to be reviewed independently before the state decision is made against the residual.

### [Medium] Behavioral E2E (`journeys/04`) deferred to Task 5 — the primary parity guard runs last

**Location:** Task 5 Step 1: `npm run preflight`

The spec identifies `journeys/04` as the primary parity guard (§8: "Behavioral E2E … stay green **between every sub-phase**"). Within this plan, Tasks 1–4 each run `npm run test` but not `journeys/04`. The E2E only runs in Task 5's full preflight. If Task 1 breaks the `chatwithscout` or `leadstream` URL segments, that regression isn't caught until all four extraction tasks are committed. Running `npx playwright test journeys/04` after Task 4 (when the page is fully decomposed into three tab containers) would catch regressions one task earlier than Task 5 and still avoids the overhead of running E2E after every individual task.

### [Low] `git add -A frontend/src` could stage unintended files

**Location:** Commit steps in Tasks 1–4

Every commit uses `git add -A frontend/src`, which stages *all* changes under `frontend/src/` including any unrelated modifications (test artifacts, temp files from the inventory grep, unrelated edits). More precise `git add` paths (listing the specific files created/modified in that task) would be safer and more reviewable.

### [Low] Task 0 5b-merged sentinel check is fragile

**Location:** Task 0 Step 1: `test -f frontend/src/features/market-research/hooks/useMarketResearch.ts`

The sentinel file `useMarketResearch.ts` is used to confirm 5b is merged. If 5b renames or restructures this hook (e.g., splits it into per-operation hooks), the check silently reports "STOP: 5b not merged" even when 5b is present. A more robust check would verify the hook *directory* exists and contains files, or grep for a known export name.

### [Low] Task 2 Step 1 defers a design decision without decision criteria

**Location:** Task 2 Step 1: "decide per the error-isolation granularity you want; default: a section-level boundary in IntelligenceTab"

The plan explicitly provides criteria for the `MarketResearchContext` decision (Task 4 Step 2) and the shared-GET edge case (Task 3). But Task 2 Step 1's error-boundary granularity is left as "decide … default: section-level" without criteria for when to choose page-level vs. section-level. Since this is a minor structural choice with low blast radius, this is low severity — but it's inconsistent with the plan's otherwise thorough decision-criteria approach.

### [Nit] Goal section says "~7k-LOC" while spec §1.2 says "7,013 LOC"

**Location:** Plan Goal line 5: "~7k-LOC `MarketResearchPage.tsx`"

The spec's precise anchor is 7,013. The plan's tilde-approximate is acceptable (the count may have drifted through 5a/5b), but the plan also states "49–79 `useState` soup" — the spec says 49. Task 0 Step 3's inventory will resolve the actual count, so this is cosmetic, not substantive.
