---
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-02
round: 2
---

## Context

Round 1 flagged one **High** finding (missing `useMarketResearchData()` market-size slice removal) and four Low/Nit findings. This round confirms the R1 High finding is **resolved** — the plan now includes Task 0 Step 6 (inventorying the page-hook slice) and Task 4 Step 2 (removing it, with a documented deferral fallback). No new Critical or High findings.

## Findings

### [Low] Hook test covers empty `orgId` but not empty `userId`

**Location:** Task 2 Step 1 test skeleton (lines 214–237); Task 2 Step 4 (line 282: `userId = currentUser?.uid`)

The test includes a `does not fetch when orgId is empty` case but no corresponding case for when `userId` is `undefined` (when `useAuth()` returns `currentUser: null`). The reference hook implementation passes `userId` directly to `useResearchComponent` with no `enabled` gate. If 5b's `useResearchComponent` does not internally disable on empty `userId`, the query fires with `userId=undefined` and likely 400s.

The plan's Step 3 note (line 278) addresses the `enabled` gating concern for `orgId` only. Add either a second test case (`it("does not fetch when userId is empty", ...)`) or gate the hook with `enabled: !!orgId && !!userId` (consistent with the plan's instruction to pass through 5b's optional `enabled` arg).

### [Low] Task 3 per-carve test scope is narrow — sibling regressions delayed to Task 4/5

**Location:** Task 3 "After each step" block (lines 350–355)

Each carve runs `npx vitest run src/features/market-research/components/intelligence/market-size` — only the section folder. If a carve breaks a shared type or re-export consumed by a sibling section (5d–5g), the regression isn't caught until Task 4 (`npx vitest run src/features/market-research`) or Task 5 (full preflight). The `tsc` + `lint` gate catches import-level breakage, but behavioral regressions in shared utilities would be delayed.

Risk is low (intra-section cut-lines), but a single mid-carve broader test run (e.g., after Step E, the midpoint) would strengthen the net at negligible cost.

### [Low] `useMarketSize` reference implementation is detailed enough to invite verbatim copy despite "illustrative" label

**Location:** Task 2 Step 3 (lines 249–278)

The code block is labeled "illustrative, not copy-paste" and the verification instruction (`grep -n "export" ...`) is present. However, the implementation is complete enough that an executing agent may paste it and skip verification. Two specific mismatches remain possible: (1) `RESEARCH_COMPONENTS` import path, and (2) `enabled` gating on empty `orgId`/`userId` (see finding above). Neither is a plan defect, but the gap between provided code and unverified API is a mechanical-execution trap.

### [Nit] Self-review section restates body content at length

**Location:** "Self-review notes" (lines 480–487)

The self-review re-describes the Architecture paragraph (two data paths, seam inventory, deletion guard) and spec-coverage mapping in similar detail to the body (lines 5–11, 84–120). ~60 lines of mostly redundant context. A brief "verified against live file — see Architecture and seam table" with deltas-only notes would be more scannable.
