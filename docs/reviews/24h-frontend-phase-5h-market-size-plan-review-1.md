---
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 1
---

## Findings

### [High] Plan doesn't address removing market-size data slice from `useMarketResearchData()` — spec §6 compliance gap

**Location:** Task 2 and Task 4; spec §6 ("Delete the page's raw fetch/cache machinery for this section as it converts") and spec §5 ("5d–5h progressively replace its *internals* section-by-section, each section adopting the 5b TanStack hooks and deleting its raw-fetch/cache slice")

The plan correctly removes the section's *internal* `fetchMarketSizeData` load path (Task 2 Step 4) and cuts the prop-drilling surface (Task 4). However, the page-level `useMarketResearchData()` hook — which 5c created to hold the verbatim raw-fetch/useState/cache machinery — still contains a market-size data state that fetches, caches, and reconciles market-size data. After 5h, that fetch fires but its output goes nowhere (Task 4 stops the composition layer from passing those props). This is dead code that wastes an API call per page load/refresh and will likely block 5i's "zero raw `fetch`" gate (spec §11 item 3 / spec §7).

The plan never mentions `useMarketResearchData()` or discusses whether its market-size slice should be removed, neutralized (disable the fetch), or explicitly deferred to 5i with rationale. Spec §6 is unambiguous: "the actual removal of each section's raw fetch site + its slice of the CACHE_DURATION/localStorage cache + cascade/timestamp/edit-history handling happens *here*." If the sibling 5d–5g plans also didn't touch `useMarketResearchData()`, that's a systemic pattern worth calling out — but 5h is the *last* section, making this the last chance for per-section cleanup before the 5i gate.

**Recommendation:** Add a step (likely in Task 2 or Task 4) that either (a) removes the market-size data state + fetch from `useMarketResearchData()`, or (b) explicitly defers it to 5i with a documented reason (e.g., "the hook is monolithic — removal only feasible after all five sections convert, addressed in 5i"). If (b), append a note to the Task 5 §9 delta so 5i knows to expect it.

### [Low] Task 3 sub-component carves run narrow vitest scope — sibling-section regressions caught only at Task 4/5

**Location:** Task 3 "After each step" code block (line 333–337); Task 4 Step 4 (line 384)

Each Task 3 carve runs `npx vitest run src/features/market-research/components/intelligence/market-size` — only the market-size folder. If a carve inadvertently breaks a shared type, import, or re-export consumed by a sibling section (5d–5g), the regression isn't caught until Task 4 (`npx vitest run src/features/market-research`) or Task 5 (full preflight). The per-carve `tsc` + `lint` catches import-level breakage, but behavioral regressions (e.g., a shared utility function's output changing) would be delayed.

The actual risk is low — the carves are intra-section cut-lines — but a single mid-carve broader test run (e.g., after Step E, the midpoint) would strengthen the safety net at negligible cost.

### [Low] `useMarketSize` hook implementation provided as reference code may not match 5b's actual API

**Location:** Task 2 Step 3 (lines 235–258); Task 2 Step 3 note (line 260)

The plan provides a complete `useMarketSize.ts` implementation, but the exact export names, signatures, and `enabled` parameter handling depend on 5b's current state. The plan instructs the implementer to `grep -n "export"` to verify (line 260) — which is good. However, the provided code block is detailed enough that an agent might copy it verbatim and skip verification. Two specific mismatches to watch:

1. `RESEARCH_COMPONENTS` is imported from `services/marketResearch.ts` — if 5b exports it from a different module, the import path is wrong.
2. The hook passes no `enabled` flag to `useResearchComponent`, but Task 2 Step 1's test expects the query to be disabled when `orgId` is empty. If 5b's `useResearchComponent` doesn't internally gate on empty `orgId`, the test fails and the implementer must add `enabled: !!orgId`.

Neither is a plan defect — the verification instruction is present — but the gap between provided code and unverified API is a trap for agents executing the plan mechanically.

### [Low] Task 3 Steps D–J lack TDD test skeletons (unlike the hook test)

**Location:** Task 3 Steps A–J (lines 308–330)

Task 2 provides a full test skeleton for the hook (Step 1, lines 199–221). Task 3 Steps A, E, F, G, H, I are marked "TDD" but only describe what the test should assert in prose (e.g., "RTL test asserts add/remove mutates the local list and save fires the callback"). The implementer must infer the full test structure (render setup, user interaction simulation, assertion pattern) from these descriptions alone. For Steps E (KeyMetricsCards) and H/I (map→table transforms), the data-shaping logic is non-trivial enough that a test skeleton would reduce ambiguity and execution risk.

This is consistent with how the sibling plans may have handled it and doesn't block execution — just increases implementer judgment calls.

### [Low] Task 4 Step 1 defers `refreshKey`/`onDataRefresh` replacement decision to "match sibling pattern"

**Location:** Task 4 Step 1 (line 355)

The plan says: "or replace `refreshKey`/`onDataRefresh` with the hook's own refresh if the parent no longer coordinates it (decide from how 5d–5g handled it; match the sibling pattern)." This defers a concrete design decision to execution time. The implementer must read one or more sibling plans (or their shipped code) to determine whether to keep or replace these props. Acceptable for an agentic executor (it can grep the sibling section code), but worth noting as a decision point that isn't pre-resolved.

### [Nit] Self-review section duplicates Architecture + spec-coverage content from the body

**Location:** "Self-review notes" (lines 439–446)

The self-review notes restate the Architecture paragraph (two distinct data paths, seam inventory, deletion guard) and spec-coverage mapping in similar detail to what's already in the body (lines 5–11, 84–120). This adds ~60 lines of mostly redundant context. A brief "verified against live file — see Architecture paragraph and seam table for details" with deltas-only notes would be more scannable for a reviewer comparing claims to body text.
