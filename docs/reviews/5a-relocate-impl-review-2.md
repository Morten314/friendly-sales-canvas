---
artifact: phase-5a-relocate
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 2
base_ref: master (effective diff base: 0727ed2, since branch is already merged)
spec_loaded: true
plan_loaded: true
---

## Context

Round 2 is a fresh-eyes re-review of the same commit set as round 1. The branch `phase-5a-relocate` is already merged into `master`; the merge-base equals the branch tip (`80ebec9`), so `master...phase-5a-relocate` yields an empty diff. The effective diff was reconstructed as `0727ed2..80ebec9` (master at time of branch development → branch tip). Spec 24 (`specs/24-frontend-phase-5-market-research-design.md`) and plan 24a (`plans/24a-frontend-phase-5a-relocate.md`) were both loaded for adherence checking.

## Findings

### [Nit] `escape-hatches.ts` line-location comments still reference old paths

**Location:** `frontend/src/lib/types/escape-hatches.ts`

Pre-existing informational comments (e.g. `// src/components/market-research/MarketEntrySection.tsx:2216`) now point at paths that moved to `src/features/market-research/components/`. Zero runtime impact. Flagged in round 1; noting for continuity. Can be updated opportunistically in any later phase that touches this file.

### [Nit] Double error boundary until 5c

**Location:** `frontend/src/App.tsx:132` (outer `FeatureErrorBoundary`) + `frontend/src/features/market-research/components/SafeMarketIntelligenceTab.tsx:6` (inner legacy `ErrorBoundary`)

The page is now wrapped in `FeatureErrorBoundary` at the route level AND the intelligence tab retains its pre-existing `SafeMarketIntelligenceTab → ErrorBoundary` wrapper. Spec §5 explicitly schedules replacing the inner wrapper for 5c, so the double boundary is intentional and temporary. No behavioral issue — the inner boundary catches first, the outer is a safety net for non-intelligence-tab errors. Noting for reviewer awareness.

### [Nit] Feature `types.ts` is empty while legacy `types.ts` holds the shared types

**Location:** `frontend/src/features/market-research/types.ts` (3 lines, empty export) vs `frontend/src/components/market-research/types.ts` (holds `EditRecord`/`TrendSnapshot`/`IndustryTrendsRecommendations`)

The feature's `types.ts` is the scaffolder stub. The actual shared types remain in legacy because `signals` also imports them. Plan Task 0 recorded this as a known shared-surface item, and the README documents it. Correct per plan — promotion to `shared/` is Phase 11.

## Adherence summary (spec §3 "Done when" + plan task mapping)

All 7 done-when criteria verified green:

1. Market-research renders from `features/market-research/`; `src/pages/MarketResearch.tsx` deleted. **Confirmed.**
2. 12 genuine components moved to `features/market-research/components/`; 12 leaving + 8 dead files remain in `src/components/market-research/` with correct annotations. **Confirmed.**
3. Route `/your-ai-team/scout/:tab` unchanged; page wrapped in `<FeatureErrorBoundary>`. **Confirmed.**
4. Scout cluster per-file stay/leave confirmed by import trace (plan Task 0). `ScoutCapabilities` correctly dead (0 importers). **Confirmed.**
5. TD-FE-14 resolved in place; TD-FE-17 (visual baseline) + TD-FE-18 (dead code) logged. **Confirmed.**
6. Spec 24 §9 delta 6 recorded; §3/§11 visual-guard qualification applied; Spec 14 §4 status table updated. **Confirmed.**
7. `knip.json` ignore for `src/shared/components/**` removed. **Confirmed.**

Plan task mapping (all 7 tasks present and correct):
- Task 0: Audit recorded in plan file; MECE classification (12 genuine, 12 leaving, 8 dead, 1 shared). **Confirmed.**
- Task 1: Scaffold (`types.ts`, `index.ts`, `README.md`). Commit `204cafa`. **Confirmed.**
- Task 2: 12 files `git mv`'d with import rewrites; backstop clean. Commit `05b4223`. **Confirmed.**
- Task 3: Page moved + `App.tsx` rewire + `FeatureErrorBoundary` wrap. Commit `94b5393`. **Confirmed.**
- Task 4: Annotations (`HANDOFF`/`DEAD CODE`) + README handoff table. Commits `d409e07`, `5b03026`. **Confirmed.**
- Task 5: `knip.json` + TECH_DEBT.md entries. Commit `a9fb048`. **Confirmed.**
- Task 6: Spec 14 + Spec 24 deltas. Commits `2003f41`, `e5e6c38`, `b75c33f`. **Confirmed.**

Import correctness verified: no stale references to old paths for moved files; all boundary-crossing imports correctly repointed to `@/` absolute paths; co-moving sibling imports kept as relatives; `types.ts` referenced transitionally from legacy per plan.

No spec/plan deviations. No scope creep. No behavioral code changes. Mechanical relocation is faithful to spec and plan.
