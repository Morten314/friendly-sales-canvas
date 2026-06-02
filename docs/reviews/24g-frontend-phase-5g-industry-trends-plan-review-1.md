---
artifact: plans/24g-frontend-phase-5g-industry-trends.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 1
---

## Findings

### [High] Page-level `useMarketResearchData` industry-trends fetch not addressed — spec §6 requires removal

**Location:** Task 8 (entire task), Task 9 Done-when item 2

Spec §6 "Done when" states: "the page's raw `fetch` site + cache slice for this section is removed." The spec's §6 explanatory paragraph is explicit: "the actual removal of each section's raw `fetch` site + its slice of the `CACHE_DURATION`/localStorage cache + cascade/timestamp/edit-history handling happens **here**."

The plan replaces the section's *own* dormant `fetchIndustryTrendsData` with `useIndustryTrends` (Task 3), which is correct. But the page-level `useMarketResearchData` hook (created by 5c, holding the verbatim raw-`fetch`/`useState`/cascade/cache machinery) still contains the industry-trends fetch, the `industryTrendsData` state, its cascade `data: previousContext` contribution, and its `CACHE_DURATION`/localStorage slice. Task 8 removes the *prop-passing* from `MarketIntelligenceTabProps` and the importer JSX, but never touches `useMarketResearchData`. After 5g, the page-level hook still fetches and stores industry-trends data — it fires, cascades, and caches into state that is never consumed.

This is orphaned I/O and a spec compliance gap. The plan should either (a) include a step to remove the industry-trends slice from `useMarketResearchData` (and document any cascade dependencies on other sections), or (b) explicitly state why removal is deferred and to which sub-phase, with a recorded `TD-FE` entry. Task 9 Done-when item 2's wording ("no market-research `fetch` remains *in the section*") is carefully scoped to the section file — it's technically true but doesn't satisfy spec §6's "the page's raw `fetch` site + cache slice for this section is removed."

### [Medium] Batching note names wrong section — "5h RegulatoryCompliance" should be "5h MarketSize"

**Location:** Header, "Batching note (Spec §1.4)" paragraph (line 19)

The batching note reads: "the two smaller tail sections (5g IndustryTrends + **5h RegulatoryCompliance**) MAY be batched." Per spec §1.4, 5e = RegulatoryCompliance and 5h = MarketSize. The two smallest tail sections are 5g (1,863 LOC) and 5h (1,661 LOC). The correct text should say "**5h MarketSize**" (or, if the intent was to pair with RegulatoryCompliance, the sub-phase label should be 5e, not 5h). The spec §1.4's own batching escape-hatch text says "IndustryTrends + MarketSize," confirming 5h = MarketSize is the intended pair.

### [Medium] Task 8 Step 5 is a single checklist item with ~400 words of conditional instructions

**Location:** Task 8, Step 5 (line 391)

Step 5 is a single `- [ ]` item containing ~400 words of instructions covering: (1) which data members to remove from `MarketIntelligenceTabProps`, (2) an asymmetric naming caveat (`industryTrendSnapshots` vs `industryTrendsTrendSnapshots`), (3) a grep-first verification requirement, (4) an enumeration of edit-orchestration members to keep, (5) a projection of remaining consumers/slices assuming 5d–5f merged, (6) a caveat to confirm at execution time rather than hard-coding, and (7) a cross-reference to 5h/5i. This is effectively 4–5 sub-steps collapsed into one checkbox. If any part fails, the single checkbox doesn't indicate which. Decompose into sub-steps for reviewability and revert precision.

### [Medium] `useAuth()` availability not verified as a prerequisite

**Location:** Task 8 Step 3 (line 387)

Task 8 Step 3 sources `userId` via `useAuth()` (`currentUser?.uid`). This assumes `useAuth` is importable and callable from within the feature's `industry-trends/` directory. If `useAuth` is a legacy context (e.g. `@/contexts/AuthContext` or similar), it falls under the transitional legacy-import exception — but that should be verified and recorded, not assumed. Consider adding a one-line check to Task 0's seam audit or Task 8's pre-step verification confirming `useAuth` is reachable from the feature's module space.

### [Low] Task 4 "Done when" claims consumption that doesn't happen in Task 4

**Location:** Task 4, "Done when" (line 284)

The done-when says "container/blocks consume them; behavior unchanged." But Task 4 only creates the helper file and tests it — there is no step that wires the container or blocks to consume the extracted helpers. That wiring happens later in Task 7 (block extraction) and Task 8 (container thinning). The done-when should say "helpers unit-tested and green; ready for consumption in Tasks 7–8" or similar.

### [Low] Missed parallelizability: Tasks 3–4 and Tasks 5–6 are independent

**Location:** Task 3 through Task 6

Tasks 3 (hook) and 4 (pure helpers) create new files with no container modifications. Tasks 5 (states + header) and 6 (footer + toolbar) modify the container. The two pairs are independent — Tasks 3–4 don't depend on Tasks 5–6's output and vice versa. The plan runs them serially (3→4→5→6), which is safe but leaves a parallelism opportunity unnoted. A brief "Note: Tasks 3–4 and 5–6 are independent and MAY run in parallel" would help an orchestrating agent.

### [Low] `orgId` sourcing in the importer JSX update left unspecified

**Location:** Task 8 Step 4 (line 389)

Step 4 says "Add `orgId={…}`" with an ellipsis. The implementer must determine where `orgId` originates in the parent's context (likely from `MarketIntelligenceTabProps` or from `useMarketResearchData`). Given the plan's care with naming asymmetric fields elsewhere (`industryTrendSnapshots`), leaving `orgId`'s source unspecified is a gap. A note identifying the source prop or context field would prevent implementer confusion.

### [Nit] Task 1 runs full `npm run test`; later tasks run focused vitest paths

**Location:** Task 1 Step 3 (line 128) vs Task 3 Step 4 (line 244) onward

Task 1 runs `npm run test` (the full suite), while Tasks 3+ run `npx vitest run <specific-path>` (focused). The inconsistency is minor — Task 1 is a relocation that could affect anything, so the full suite is appropriate. But it could confuse an agentic implementer into thinking later tasks should also run the full suite (or that Task 1's approach is the standard). A one-line note explaining the difference would suffice.
