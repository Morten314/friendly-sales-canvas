---
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: impl-precheck
event: R1 escape hatch invoked (pre-implementation)
decided_by: human (akgaurav@hotmail.com) — "Stop & replan (R1 hatch)"
model: claude-opus-4-8
date: 2026-05-31
branch: phase-5c-page-decomposition (created; no implementation commits)
---

## Summary

Before writing any production code for plan 24c, a Task-0 ground-truth inventory of
`frontend/src/features/market-research/pages/MarketResearchPage.tsx` (7,013 LOC, ~70 `useState`)
was run. It revealed that several load-bearing premises of plan 24c are **false for the current
code**. Per the plan's own R1 escape hatch (Spec 24 §12 / master §5.7 — "if 5c reveals cross-tab
coupling beyond this plan … revert 5c and replan; 5a/5b stay merged"), implementation was halted
and the human elected **Stop & replan**. No 5c implementation commits exist; nothing to revert.

Baseline at halt: `typecheck` ✅, `lint` ✅, `vitest` ✅ (clean green). Branch
`phase-5c-page-decomposition` exists but carries no production changes.

## Verified ground truth (commands + the now-reliable inventory subagent, all markers cleared)

| Fact | Evidence |
|---|---|
| Page LOC | `wc -l` = **7,013** (matches spec §1.2) |
| `useState` | grep `useState` = 88 lines; **~70 actual hooks** (regex-extracted names) |
| 5b hook usage in page | **0** (`useResearchComponent`/`useRegenerateResearch` referenced **zero** times) |
| Server data path | **9 raw `fetch()`** calls via `buildApiUrl` from `@/lib/api`; **no** `apiFetch`/`enhancedApi`/`authenticatedApi`; server data held in ~7 `useState` vars |
| Tab mechanism | **URL-derived** — `getActiveTabFromPath()` (L370–386) maps `location.pathname` last segment (`marketintelligence→intelligence`, `leadstream→analysis`, `chatwithscout→trends`); `activeTab` `useState` seeds from it (L388) + sync effect (L1884–1890); `handleTabChange` (L1863) inverse-maps + `navigate("/your-ai-team/scout/<seg>")` |
| Route | `/your-ai-team/scout/:tab` at `App.tsx:129`; legacy `/market-research` redirects in |
| Page-level error boundary | **Already exists** — `<FeatureErrorBoundary featureName="Market Research">` wraps the page at `App.tsx:132` |
| `MarketIntelligenceTab` deletability | Only importer is `SafeMarketIntelligenceTab.tsx:3` → **deletable** once Safe is removed (keep `MarketIntelligenceSections` + `MarketIntelligenceTabProps.ts`) |
| analysis tab fetching | **None** — only renders `<ScoutLeadStream>` (L6916–6928) with filter props + 3 callbacks; data lives in `ScoutLeadStream` |

## Premises that HOLD (plan is correct here)

- Tab routing is URL-derived (Task 5's "`activeTab` stays URL-derived" is accurate).
- analysis tab does no MR fetching → the shared-GET edge (§5.1) is moot, as planned.
- A page-level `<FeatureErrorBoundary>` already exists (5a).
- `MarketIntelligenceTab` is deletable in Task 2.
- Legacy import targets exist: `ScoutLeadStream`, `ChatWithScout`, `ScoutChatWithHistory`,
  and the `lead-stream/` dir (`LeadsTable`, `OpportunityDashboard`, `leadData.ts`).

## Premises that are FALSE → drive the replan

### G1 — Server state is NOT on 5b hooks; the page owns a raw-`fetch` + cascade/timestamp-merge data layer (MAJOR)
Plan says (Goal/Architecture/Task 1): "server state is already in TanStack (5b)", IntelligenceTab
"consumes 5b hooks for data", "sections still read 5b hooks". **Reality:** the page uses **0** 5b
hooks and runs its own 9 raw `fetch()` loaders into `useState` (`marketData`, `marketIntelligenceData`,
`industryTrendsData`, `regulatoryData`, `competitorData`, `marketEntryData`, `companyProfile`) with
cascade/timestamp-merge logic (`timestampUtils`, `leadStreamChatContext`). This matches the
descope memory (**TD-FE-19**: "page access is editable-state+cascade+timestamp-merge, not a thin
fetch wrapper; page-rewire descoped to 5c/5d–5h"). The plan and reality disagree on whether 5c
wires hooks. → Replan must pick: **(a) structural-only**, moving the in-page fetch/`useState`
data flow into `IntelligenceTab` unchanged and deferring hook-wiring to 5d–5h, or **(b)** wire hooks
now (much larger; contradicts TD-FE-19).

### G2 — `useCompanyProfile` does not exist; no hooks barrel (MEDIUM)
Plan prerequisite cites "the 5b hooks (`useResearchComponent`/`useRegenerateResearch`,
`useCompanyProfile`)". **Reality:** `hooks/useMarketResearch.ts` exports only `useResearchComponent`
+ `useRegenerateResearch`; **`useCompanyProfile` does not exist** and there is **no `hooks/index.ts`
barrel**. The page fetches `companyProfile` itself. → Fix prerequisite + any hook references.

### G3 — The three analysis handlers are cross-tab coupled (MAJOR — the named R1 trigger)
Plan Task 3: extract analysis into a "self-contained legacy unit" that "never imports feature-internal
hooks" and "keeps its own data access". **Reality:** `handleChatWithScout`/`handleChatAboutCoverage`/
`handleSendToStrategist` (L401, L1553, L1569) read/write **trends** state (`scoutResearchContext`,
`scoutMode`) and call `handleTabChange("trends"/"analysis")` (cross-tab navigation);
`handleSendToStrategist` writes `localStorage["strategistLeadStream"]` and navigates to Strategist.
So the analysis tab is **not** cleanly separable from trends + nav. → Replan must specify how the
legacy `LeadStreamTab` receives these (callbacks injected as props from the shell, keeping the
trends/nav coordination in the feature) without the legacy unit importing the feature — and whether
that "props-in" pattern satisfies the one-way-boundary intent.

### G4 — The `trends` chat renders OUT OF BAND, not inside `TabsContent value="trends"` (MEDIUM)
Plan Task 4 mental model: lift the `trends` `TabsContent` block. **Reality:** `TabsContent
value="trends"` (L6930–6933) is an **empty `hidden` placeholder**; the real chat renders **above**
the Tabs body (~L6490–6511) gated on `activeTab === "trends"` (`<ChatWithScout>` when
`scoutResearchContext` else `<ScoutChatWithHistory>`). → Task 4's extraction target + line refs
must be corrected.

### G5 — `SafeMarketIntelligenceTab` carries prop-sanitization logic, not just an error wrapper (MEDIUM)
Plan Task 2: "replace the bespoke error wrapper with `<FeatureErrorBoundary>`." **Reality:** Safe
also performs real **prop sanitization** before rendering `<MarketIntelligenceTab>` and wraps in the
generic `ErrorBoundary` (`@/components/common/ErrorBoundary`), not a MR-specific one. A blind swap to
`<FeatureErrorBoundary>` would **drop the sanitization** (behavior change). → Replan must preserve
the sanitization (move it into `IntelligenceTab`) or consciously document its removal with rationale.

### G6 — `useState` count + shape (LOW, informational)
~70 hooks (not 49/79). The set is dominated by **per-section ephemeral intelligence state**
(editing/expanded/hasEdits/deletedSections/editHistory/customMessage/showScoutChat/loading/error ×5
sections). This makes Task 1's "lift the intelligence ephemeral state" a very large mechanical move,
and confirms Task 5's expected outcome (little-to-no cross-tab shared state → likely no
`MarketResearchContext`).

## Recommended replan shape (for human confirmation)

Reframe 24c as a **structural-only** decomposition that **preserves the existing in-page
raw-`fetch`/`useState` data layer** (G1a), with these concrete corrections: G2 (prereq/hook refs),
G3 (handler coupling → shell-owned callbacks passed as props into the legacy `LeadStreamTab`), G4
(trends out-of-band render), G5 (preserve prop-sanitization in `IntelligenceTab`). Hook-wiring stays
deferred to 5d–5h (TD-FE-19). This keeps the spec §5 goal (thin shell + tab containers + Safe→FEB +
analysis→legacy) intact while matching reality.

If instead the team wants hooks wired now (G1b), 5c grows substantially and overlaps 5d–5h — a
spec-level decision, not just a plan edit.

## Next step
Revise `plans/24c-...md` per the confirmed direction, then re-run `/review-plan` →
`/synthesize-plan-review` before implementation resumes.
