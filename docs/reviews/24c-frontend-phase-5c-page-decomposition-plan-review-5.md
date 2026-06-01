---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 5
---

## Context

Round 5 reviews the **delta-8 hook-first rewrite** of plan 24c. Rounds 1–2 critiqued the pre-R1 plan (stale); rounds 3–4 critiqued the delta-7 into-`IntelligenceTab` plan (superseded by event #2). All seven findings from round 3 and all six findings from round 4 were addressed in this rewrite: Task 1 is now a pure data-layer hook move (not IntelligenceTab), Task 3 is cleanly separated from Task 2, the `ScoutResearchContext` type duplication is acknowledged with rationale, the orphan-server guard is present in Tasks 1/5/7, the "moved, not modified" review expectation is stated, the Task 6 removal checklist is explicit, and the `signalsChatContext` internalization is pre-decided. This round concentrates on newly surfaced issues in the delta-8 text. Reviewed against Spec 24 §5 (round 5), §9 delta 8, the R1 findings document, and live source verification of all referenced paths/types/routes.

## Findings

### [Medium] Task 2 verification skips `journeys/04` despite extracting the primary market-research surface

**Location:** Task 2 Step 4 — `npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run test` (no `journeys/04`).

Task 2 extracts the intelligence tab JSX (~390 lines, L6525–6914) into a dedicated container — the **only genuine market-research tab** and the plan's most user-visible surface. Yet its green gate is tsc+lint+vitest only. The plan's central safety claim throughout is behavioral parity via `journeys/04` (Tasks 1, 5, and 7 all run it). If the extraction miswires a prop in the `{...slice}` construction (a likely failure mode given the ~169-prop surface), only vitest catches it — and the existing vitest suite may not exercise the full intelligence rendering path. The next `journeys/04` run is Task 5, meaning a Task-2 regression could persist through two commits before surfacing. The plan's own note acknowledges Task 2 runs "Full Vitest (a tab-render regression surfaces here)" but this is an assertion about coverage, not a guarantee. Add `journeys/04` to Task 2's green gate (with the orphan-server kill guard, as in Tasks 1/5/7), or explicitly justify its omission with a concrete argument for why vitest alone is sufficient.

### [Medium] Task 5 Step 2 doesn't explicitly preserve the `{activeTab === "trends"}` guard when replacing the out-of-band block

**Location:** Task 5 Step 2 — "Replace the out-of-band block (L6494–6511) with `<TrendsTab .../>`."

The out-of-band block at L6494–6511 is wrapped in `{activeTab === "trends" && ( ... )}`. Step 2 instructs replacing the entire block with `<TrendsTab .../>`. A literal reading means the `activeTab` guard is removed too, causing TrendsTab to render unconditionally (on every tab). Step 1c explains the guard "becomes implicit" because TrendsTab mounts/unmounts on tab change — but that reasoning only holds if the guard IS preserved. The instruction should say explicitly: "Inside the `{activeTab === "trends" && ( ... )}` wrapper, replace the inner content with `<TrendsTab .../>`" (preserving the guard), or state that the shell's tab-router conditional replaces it (and show the resulting JSX structure). Without this, an agentic implementer performing a literal block replacement loses the conditional.

### [Low] Task 2's IntelligenceTab test file has no explicit write step

**Location:** Task 2 Steps 1–4.

Step 1 says "Plan the mount smoke test (after extraction, run in Step 4)." Steps 2–3 are prop interface + component creation. Step 4 is green+commit. The test file `IntelligenceTab.test.tsx` appears in the `git add` of Step 4 but no step explicitly says "write the test file." The writing is implied to happen between Steps 3 and 4 (or as part of Step 3's creation), but for an agentic executor following steps literally, the test file could be missed. Add a brief "Step 3.5" or fold the test writing into Step 3: "Create both `IntelligenceTab.tsx` and `__tests__/IntelligenceTab.test.tsx`."

### [Low] Task 5 Step 1b `TrendsTabProps` interface sketch omits `onTabChange`

**Location:** Task 5 Step 1b — the `TrendsTabProps` interface lists `scoutResearchContext`, `scoutMode`, `editHistory` but not `onTabChange`.

Step 2's JSX passes `onTabChange={setActiveTab}` to TrendsTab, and Step 1c states "onTabChange (currently setActiveTab) is passed from the shell." The interface sketch is incomplete — `onTabChange: (tab: string) => void` (or matching the shell's type) must be present. This is a minor spec-implementation gap that an implementer would catch via tsc, but the plan's interface sketch should match the props it later passes.

### [Low] Plan has no secondary abort criteria beyond the R1 coupling trigger

**Location:** "Failure handling (every task)" (line 28) + "R1 escape hatch" (line 24).

The plan's explicit "abandon the plan" trigger is limited to the R1 escape hatch (deep cross-coupling surprises). For ordinary task failures, the instruction is "stop and report to the human" — acceptable per review criteria. But given this plan's history (R1 fired twice, both requiring replan), there's no guidance for the human on when continued fix-forward is no longer productive. Consider adding a secondary abort signal: e.g., "if ≥2 non-coupling tasks require human intervention for unexpected failures, reassess whether the hook-first approach is viable." This doesn't change the plan's execution; it gives the human a decision framework.

### [Nit] Task 3 Step 2 hardcodes a `className` from inventory rather than instructing source verification

**Location:** Task 3 Step 2 — `` className={`${safeProps.isSplitView ? "w-3/5" : "flex-1"} transition-all duration-500 space-y-6`} ``.

This className is specified from the inventory's recollection of `MarketIntelligenceTab`'s wrapper. The instruction should say "copy the exact className from the `MarketIntelligenceTab` source being deleted" rather than hardcoding it in the plan. If the source has drifted since the inventory was captured, the plan's hardcoded value would be stale.

### [Nit] Task 1 Step 4 smoke test may need disproportionate MSW setup for a pure-move task

**Location:** Task 1 Step 4 — "MSW stubbing only the fetches it fires on mount."

The hook fires up to 9 raw `fetch` sites. Provisioning MSW handlers for all 9 is significant setup for a smoke test on a pure-move extraction whose correctness is primarily verified by the existing suite + `journeys/04`. Consider using a coarser mock (`vi.spyOn(globalThis, 'fetch').mockResolvedValue(...)`) or deferring the hook test until the hook's interface stabilizes post-Task-6.
