---
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 2
---

## Context

Round-2 review. Round 1 (`docs/reviews/24f-frontend-phase-5f-competitor-landscape-plan-review-1.md`) was committed at `18dcfcd` and its synthesis was applied ("finalize 24f competitor-landscape plan (round-1 review + synthesis applied)"). This round reviews the resulting plan fresh against spec `specs/24-frontend-phase-5-market-research-design.md` (round 5, 2026-05-31), read in full (334 lines). The plan is 542 lines. This review focuses on actionable gaps and risks not caught or not fully resolved in round 1.

## Findings

### High — Task 4 deletes the read-sync effects but does not account for the edit-write path's re-read fetch at L727

**Location:** Task 4 Step 3 (lines 365–372), Architecture block (line 7)

The plan correctly identifies that `handleCompetitorLandscapeSaveChanges` contains *two* fetches: the `/api/ask` edit-save (L697) and a `/api/market_intelligence` re-read (L727). The plan states the `/ask` write fetch stays, and the re-read is mentioned once: "the `/api/market_intelligence` re-read (L727)" in the architecture block. But in Task 4 Step 3, the **re-read fetch is not explicitly accounted for** in the delete/keep analysis. The grep verification (Step 3 bash) checks for `getUserLocalStorage`/`setUserLocalStorage` but does not verify which `fetch` calls remain. The re-read at L727 is inside the same handler as the edit-write — it re-fetches the full market intelligence payload after a successful save to refresh state. If this re-read is kept as-is, it re-introduces a raw `fetch` the hook was supposed to replace for the read path. If it is deleted, save no longer refreshes the section. The plan needs an explicit decision: keep it (and document it alongside the `/ask` write-path exception) or redirect the post-save refresh through the hook's `refresh`/TanStack invalidation. Currently it falls into a gap between "read path deleted" and "write path kept."

### High — `MarketIntelligenceTabProps` field-removal candidate list (Task N+1 Step 1) mixes data fields with view/state fields that may still be forwarded by the caller

**Location:** Task N+1 Step 1 (lines 429–436)

Step 1 lists `competitorExpanded`, `competitorHasEdits`, `competitorDeletedSections`, `competitorEditHistory`, `competitorLastEditedField`, `competitorCustomMessage` as "candidates" alongside genuine data fields (`competitorData`, `competitor{ExecutiveSummary,...}`). The plan correctly says to keep edit callbacks the container still uses, but several of these view-state fields (`hasEdits`, `expanded`, `deletedSections`, `editHistory`, `customMessage`) are **per-section editing state** that the 5c `useMarketResearchData` hook may still be forwarding. If the container now manages these locally (as the hook-first extraction implies), they should be explicitly confirmed as locally-owned — not left as ambiguous candidates. An incomplete removal that misses a field the parent still passes will type-error; an over-removal that drops a field the container still needs from props will break behavior. The step should enumerate which of these the container now self-manages vs. which it still receives from the parent.

### Medium — Tasks 5–15 are speculatively enumerated from pre-5a line numbers; Task 0 audit may change the count significantly but the plan does not bound the re-plan scope

**Location:** Tasks 5–N (lines 391–416), Task 0 Step 4 (lines 82–133)

The plan explicitly says "reconcile to Task 0" and "the audit wins," which is good. But the concrete task list (Tasks 5–15) is authored from pre-5a/5b/5c line numbers, and 5b/5c may have substantially rewired the component. The reconcile step says "add/drop tasks to match Task 0's confirmed blocks" but does not state what happens if the reconcile produces a materially different decomposition (e.g., fewer blocks due to merged concerns, or more due to newly-discovered seams). Abort criterion 3 covers "changes the **number** of blocks or reveals a seam this plan didn't anticipate," but the threshold for "implies a behavior change not covered by a test" is subjective when the plan is *already* behavior-preserving by design (byte-for-byte markup lift). If the audit finds, say, 14 blocks instead of 12, the plan's abort criterion may fire unnecessarily on a purely mechanical difference. Consider tightening: abort only on *behavior-changing* divergence, not on a different block count that is mechanically decomposable.

### Medium — The hook test (Task 4 Step 1) does not assert on the shape of the resolved `data` — only that it is `toBeDefined`

**Location:** Task 4 Step 1 (lines 304–329)

The hook test verifies `result.current.data` is defined and `refresh` is a function, but does not assert that the resolved `CompetitorLandscapeView` contains the expected fields (`executiveSummary`, `uiComponents`, etc.). This is the plan's only integration point between the 5b data layer and this section's read path. Given abort criterion 4 (the hook's `data` may not supply the fields the section renders), the test should assert at least the four scalar fields + `uiComponents` exist on the resolved data — otherwise a silent shape mismatch passes the test but breaks the section at render time. The MSW handler note says "extend it to echo a realistic payload," but the test itself does not verify that payload is correctly mapped.

### Medium — The `orgId` default of `"brewra"` is accepted without flagging as a hardcoded tenant ID

**Location:** Task 4 Step 3 (line 365)

The plan instructs: "the live `orgId` default is `"brewra"` — keep behavior." The AGENTS.md notes that "Multi-tenancy is enforced by `WHERE l.org_id = $org_id` in Cypher and `{"org_id": ...}` in Mongo, nothing more." Hardcoding `"brewra"` as the default orgId means a user with no org context silently operates as Brewra's tenant. This is a pre-existing behavior (not introduced by this plan), but the plan explicitly preserves it without flagging it as a TD-FE candidate. Since 5f is already touching the org/user resolution, a one-line `TD-FE` entry is warranted.

### Medium — No stated regression signal for Task 2 (types extraction)

**Location:** Task 2 (lines 194–238)

Task 2 extracts types into `types.ts` and runs `tsc` + `lint`, but has no Vitest run or behavioral check. The verification is purely "compiles + lints." While type extraction is low-risk, the step changes the import graph and could introduce a circular import (the `types.ts` file imports nothing, but re-pointing the section to import from `./types` is a structural change). The `knip` check is absent from this task's gate (it appears in Tasks 3, 4, N+2 but not Task 2). Adding `npx knip --strict --no-progress` would catch an accidental orphan of the old inline types.

### Low — Task 0 Step 1 checks for 5c merge but not for 5d/5e merge

**Location:** Task 0 Step 1 (lines 50–58)

The prerequisite states "5c merged to `master`" and the branch check verifies `24c`. But the plan also says "Branch off the latest `master` (5e merged)" — implying 5d and 5e are expected to have merged. The bash check only greps for `phase-5c|24c`, not for 5d/5e. If 5d or 5e failed to merge, the `intelligence/` directory structure and the sibling section patterns (which 5f is told to "mirror") may not exist. The plan should verify that at least one sibling section directory (e.g., `market-entry/` or `regulatory-compliance/`) exists under `intelligence/` as evidence that the per-section decomposition pattern has been established.

### Low — The `CompetitorLandscapeView` type uses `unknown[]` for `uiComponents` but the extractors expect typed structures

**Location:** Task 2 Step 1 (lines 219–225)

`uiComponents?: unknown[]` in `CompetitorLandscapeView` means the hook resolves to `unknown[]` for the raw parsed components. The extractors in `competitorUiComponents.ts` (Task 3) will cast/assert on this array. This is architecturally consistent with the 5b tolerant `.passthrough()` approach, but the gap between `unknown[]` and the typed extractors is a runtime trust boundary with no schema enforcement. A comment in `types.ts` acknowledging this (or a `z.custom<UiComponent>().passthrough()` guard in the hook) would make the boundary explicit. This is a minor defensive-coding note, not a blocking issue.

### Low — Parallelizability: Tasks 5–15 are serial by default but some could run in parallel

**Location:** Tasks 5–15 (lines 391–416)

All 11 extraction tasks touch the same container file (`CompetitorLandscapeSection.tsx`), making true parallelism impossible without merge conflicts. The plan is correct to serialize them. However, the `competitorUiComponents.ts` extraction (Task 3) and the `useCompetitorLandscape.ts` hook (Task 4) could potentially be parallelized *if* the hook does not depend on the extractors being factored out first. The plan says "the container keeps the initialization/sync `useState` initializers but calls these pure extractors" (Task 3 description), and Task 4 Step 3 says "read from `cl.data` via the Task 3 extractors." So Task 4 *does* depend on Task 3. The serialization is correct. No finding here — just confirmation that the dependency is real, not accidental.

### Nit — The plan references line numbers from the pre-5a file throughout (L84, L2648, L697, L727, etc.) alongside disclaimers that they are anchors

**Location:** Throughout (Architecture, Task 0 Step 4 confirmed structure, render-block list)

The line numbers are useful for traceability but will diverge after 5a/5b/5c relocation and any intervening edits. The plan acknowledges this multiple times ("a pre-5a anchor," "line numbers shift after relocation," "re-confirm against the merged tree"). This is fine — the Task 0 audit is the live verification. No action needed; noted for completeness.

### Nit — The Section-copy note is well-placed but could be a single sentence in the conventions block

**Location:** Section-copy note (lines 137–139)

The three-paragraph note about keeping display strings inline is clear and correct. It could be consolidated into a single sentence in the "Conventions for every task" block (line 21) to avoid being skipped by an executor who treats it as non-normative. Purely editorial.
