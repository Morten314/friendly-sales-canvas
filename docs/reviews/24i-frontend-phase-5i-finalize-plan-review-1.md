# Plan Review 1: `plans/24i-frontend-phase-5i-finalize.md`

**Reviewer:** agent
**Date:** 2026-06-02
**Artifact:** `plans/24i-frontend-phase-5i-finalize.md`
**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §7, §2.2, §9, §11, §13

---

## Finding 1 — CRITICAL: Prerequisite not met (abort criterion 1)

**Task 0 will immediately abort.** 5h has not been merged to `master`. Evidence:

- `components/MarketSizeSection.tsx` remains a monolithic 1,660-LOC file at the feature root — there is no `components/intelligence/market-size/` directory.
- `MarketIntelligenceTabProps.ts` still exists at `features/market-research/components/MarketIntelligenceTabProps.ts` with **3 active importers** (`IntelligenceTab.tsx:9`, `MarketIntelligenceSections.tsx:6`, `sanitizeIntelligenceProps.ts:3`).

This triggers both abort criterion 1 (5a–5h not all merged) and abort criterion 3 (prop interface still present with importers). The plan's prerequisite is explicit: "STOP and finish 5h."

The plan correctly identifies the abort — no revision needed. This is informational: **5h must land before 5i can begin.**

---

## Finding 2 — HIGH: Handoff table in Task 2 is incomplete + contains an error

The example table in Task 2 Step 2 drops three leavers and adds a dead file as a leaver:

**Missing from the plan's table (present in current `README.md`):**
- `EditDropdownMenu.tsx` → customers (sole importer: `customers/SuggestedICPCards`)
- `AddLeadModal.tsx` → scout (sole importer: `signals/ScoutChatWithHistory`)
- `SuggestedCompaniesSection.tsx` → scout (sole importer: `signals/ScoutChatWithHistory`)

**Incorrectly listed as leaver:**
- `ScoutCapabilities.tsx` — confirmed dead by the 5a import trace (zero importers) and annotated `// DEAD CODE → delete in 5i`. Including it in the handoff table contradicts Spec 24 §7 which explicitly classifies it as dead code, not a leaving component.

The plan says "Write the table to match the live dir," but the example table serves as the template and will mislead the implementer.

**Recommendation:** Revise the example table to carry all 6 leaver rows from the current README (StrategistWorkspace, lead-stream cluster, EditDropdownMenu, ScoutChatPanel+ChatWithScout, ScoutSettingsForm+ScoutDeploymentDetails+ScoutLeadStream, AddLeadModal+SuggestedCompaniesSection). Do not include ScoutCapabilities.

---

## Finding 3 — MEDIUM: Task 3 sweep doesn't explicitly cover the 8 dead legacy files

Spec 24 §7 assigns 8 dead files in `src/components/market-research/` to 5i for deletion:
- `CompetitorAnalysis.tsx`, `CompetitorAnalysisDrawer.tsx`, `ComponentStatusLoadingScreen.tsx`, `DataHistoryDialog.tsx`, `EmergingTrends.tsx`, `EmergingTrendsDrawer.tsx`, `RecentMarketResearch.tsx`, `ScoutCapabilities.tsx`

All carry `// DEAD CODE → delete in 5i` annotations.

Task 3's triage bullets cover:
1. Dead leftovers **inside the feature** (`src/features/market-research/`)
2. Leaving components flagged in `src/components/market-research/` → do not delete
3. Anticipated-but-unconsumed `index.ts` exports

None of these address the dead files in the legacy dir. The plan scopes Task 3 as "in-feature dead-code sweep" but the spec's §7 done-when requires "zero `// DEAD CODE` annotations remain" — and those annotations are in the legacy dir.

**Recommendation:** Add a fourth triage bullet: dead files in `src/components/market-research/` with a `// DEAD CODE` annotation → delete (they are not leaving components; they have no target feature per the §7 classification).

---

## Finding 4 — LOW: Task 1 index.ts draft has ambiguous completion signal

Step 3's draft `index.ts` includes the comment:
```ts
// Add the report/result type signals actually consumes once Phase 8's need is known.
```

This could be read as "index.ts is intentionally incomplete." That conflicts with the spec §7 done-when ("`index.ts` complete") and Task 4 Step 3's DoD item 1. The knip note in Step 4 handles zero-importers, so either path works — but the intent should be explicit.

**Recommendation:** Clarify whether this comment is committed as-is (documenting a known gap for Phase 8 to fill) or stripped before commit (index.ts exports only what exists now).

---

## Finding 5 — LOW: Task 0 grep for `fetch(` is overly broad

Task 0 Step 2:
```bash
grep -rn 'fetch(' src/features/market-research && echo "STOP: raw fetch in feature (5b/5c gap)"
```

This will match `useMarketResearchData.ts`, which still contains the verbatim raw-fetch machinery (by design — 5c's structural relocation that 5d–5h progressively convert). Even post-5h-merge, the hook may still hold `fetch` calls until all sections convert. The spec acknowledges this: the zero-raw-fetch gate is "confirmed at 24i phase close" (Task 4), not at Task 0.

**Recommendation:** Move this grep to Task 4 (final verification) or scope it to exclude `useMarketResearchData.ts`.

---

## Disposition

| # | Severity | Verdict | Action |
|---|---|---|---|
| 1 | Critical | Informational — no plan defect | 5h must merge before 5i starts |
| 2 | High | Agree — plan defect | Revise example handoff table in Task 2 Step 2 |
| 3 | Medium | Agree — plan gap | Add dead-legacy-file triage bullet to Task 3 Step 2 |
| 4 | Low | Agree — ambiguity | Clarify index.ts comment disposition |
| 5 | Low | Agree — false-positive risk | Relocate or scope the fetch grep |
