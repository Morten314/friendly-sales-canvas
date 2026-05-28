# Frontend Phase 2a — Strict TS Turn-On Scorecard

**Phase:** Spec 17 / plans/17-frontend-phase-2a-strict-ts.md
**Branch:** `phase-2a-strict-ts` (ready to merge 2026-05-28)
**Spec baseline:** Spec 17 §1.3 design-time figures (461 errors at 2026-05-27)
**Step 0 re-baseline:** `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json`
**Post-Wave-A re-baseline:** `docs/audits/2026-05-28-post-wave-a-frontend-phase-2a-strict-probe.json`

## 1. Error count

| | Step 0 re-baseline | Phase end |
|---|---:|---:|
| Total `tsc --noEmit -p tsconfig.app.json` errors | 417 | 0 |

Step 0 re-baseline was 417 (vs spec design-time 461 — drift -44, mostly from Phase 1 cleanup cascades). Post Step-1b the actual strict surface was 443 because the Step 0 probe undercounted TS7006 (the throwaway tsconfig didn't override `tsconfig.app.json`'s explicit `noImplicitAny: false`). Once `tsconfig.app.json` had `noImplicitAny: true` explicit, all 83 TS7006 errors surfaced — matching spec design-time exactly.

Per-code delta and per-area delta available in committed Step 0 + post-Wave-A audit artifacts.

## 2. Files deleted

15 dead shadcn primitives (Step 1a — three batched commits):
- Batch i (commit `89a85fc`): aspect-ratio.tsx, calendar.tsx, carousel.tsx, context-menu.tsx, form.tsx
- Batch ii (commit `2b4b41f`): hover-card.tsx, input-otp.tsx, menubar.tsx, navigation-menu.tsx, radio-group.tsx
- Batch iii (commit `631b14e`): resizable.tsx, slider.tsx, switch.tsx, toggle.tsx, toggle-group.tsx

LOC delta from Step 1a deletions (all 3 batches combined): 15 files changed, 1401 deletions(-)
- Batch i: 5 files changed, 703 deletions(-)
- Batch ii: 5 files changed, 500 deletions(-)
- Batch iii: 5 files changed, 198 deletions(-)

## 3. Escape hatches

Location: `src/lib/types/escape-hatches.ts` (interim — Spec 17 §2.1; relocates to `src/shared/types/escape-hatches.ts` in Phase 4)

6 entries (created during Wave B remediation):
- `UntypedReportState` — setState callback `prev` parameter across 4 market-research files
- `UntypedUiComponent` — `uiComponents.find((comp) =>)` in MarketResearch.tsx
- `UntypedRegulatoryUpdate` — `keyDataPoints[]` (derived from `keyUpdates[]`) in RegulatoryComplianceSection.tsx
- `UntypedVisualDataCard` — `visualDataCards[]` in RegulatoryComplianceSection.tsx
- `UntypedRegionData` — `regionalData[]` in RegulatoryComplianceSection.tsx
- `UntypedReportSection` — MarketEntry report-section arrays (executiveSummary paragraphs, entryBarriers, competitiveDifferentiation, strategicRecommendations, riskAssessment)

TD-FE-9 registered (5+ entries threshold).

## 4. TD-FE entries created during the phase

- TD-FE-9 — Phase 2a escape-hatches threshold reached (6 entries). See `docs/TECH_DEBT.md`.

## 5. Commit summary

Phase 2a executed in 7 wave-shaped steps over 2 days (2026-05-27 → 2026-05-28):
- Step 0: re-baseline probe artifact + helper script
- Step 1a: 3 commits deleting 15 dead shadcn primitives via 6-check kit
- Step 1b: 1 cliff-edge commit flipping 5 strict flags + fixing typecheck script + cleaning root config
- Wave A: 6 area-group sweeps (noUnused* — 313 TS6133 + 12 TS6192), one MarketResearch.tsx redo after over-deletion, residue cleanup
- Wave B: 4 file-grained commits for 83 TS7006 + remediation commit routing 60 new inline `:any` through escape-hatches.ts
- Wave C: 8 file-grained commits for 32 semantic errors (TS18046, TS18047, TS18048, TS2322, TS2339, TS2345) + final residue cleanup
- Step 5: this scorecard

Notable mid-phase incident: a Wave A subagent over-deleted handlers in MarketResearch.tsx that were still referenced in JSX further down the same 14k-line file. The commit was reset and the file re-processed with stricter discipline (search for callers across the file before each deletion). No work lost beyond the bad commit.

`git log --oneline master..HEAD`:
```
31935b3 refactor(fe): delete unused handleHistoricalReportSelected
d3423ba refactor(fe): tighten types in pages/MarketResearch.tsx (Wave C)
ff4eee7 refactor(fe): tighten types in jwt.ts
9fec56b refactor(fe): tighten types in ICPManager.tsx
cb7f919 refactor(fe): tighten types in DataSourcesManager.tsx
4d28203 refactor(fe): tighten types in IndustryTrendsSection.tsx
613552a refactor(fe): tighten types in MarketSizeSection.tsx
10d8ce2 refactor(fe): tighten types in MissionControl.tsx
3a5d808 refactor(fe): tighten types in ProfileDialog.tsx
8c818e8 refactor(fe): route Wave B inline any through escape-hatches + register TD-FE-9
a594aea refactor(fe): type MarketResearch.tsx (Wave B noImplicitAny)
2fac80b refactor(fe): type MarketEntrySection.tsx (Wave B noImplicitAny)
f7288e5 refactor(fe): type RegulatoryComplianceSection.tsx (Wave B noImplicitAny)
1e81fb8 refactor(fe): type CompetitorLandscapeSection.tsx (Wave B noImplicitAny)
1f33136 chore(audits): phase 2a post-wave-a re-baseline
f951926 refactor(fe): wave A residue cleanup across feature files
8815a2d refactor(fe): remove unused symbols in pages/MarketResearch.tsx
3786934 refactor(fe): remove unused symbols in pages/MissionControl.tsx
cf71cdb refactor(fe): remove unused symbols in pages (small pages bundle)
46450dd refactor(fe): remove unused symbols in components/mission-control
af1f68c refactor(fe): remove unused symbols in components/market-research (large sections)
530a6e6 refactor(fe): remove unused symbols in components/market-research (mid-sized sections)
0220005 refactor(fe): remove unused symbols in components/market-research (small files)
0eb78e4 refactor(fe): remove unused symbols in components/{layout,signals,strategist,settings,customers}
0920da1 refactor(fe): remove unused symbols in lib/hooks/utils/services/contexts
fa30a83 chore(fe): enable strict typescript flags
631b14e chore(fe): remove dead shadcn primitives (batch iii)
2b4b41f chore(fe): remove dead shadcn primitives (batch ii)
89a85fc chore(fe): remove dead shadcn primitives (batch i)
8df4423 fix(audits): classifyArea buckets loose component files correctly
539b05b chore(audits): phase 2a strict ts re-baseline
```

## 6. Diff size

Aggregate:
```
67 files changed, 5193 insertions(+), 4432 deletions(-)
```

Per-wave breakdown:
- Step 0 (probe helper + artifacts + classifyArea fix): 3 files changed, 3762 insertions(+)
- Step 1a (3 shadcn batches): 15 files changed, 1401 deletions(-)
- Step 1b (flag flip + script fix + root cleanup): 3 files changed, 7 insertions(+), 11 deletions(-)
- Wave A (Groups 1+3+4+5+6 commits + MarketResearch redo + residue): 41 files changed, 1207 insertions(+), 2859 deletions(-)
- Wave B (4 typing commits + remediation): 6 files changed, 161 insertions(+), 76 deletions(-)
- Wave C (8 typing commits + final residue): 10 files changed, 60 insertions(+), 89 deletions(-)
- Step 5 (scorecard): 1 file changed

The 15 dead-shadcn deletions are called out separately so the reviewable-code surface is visible without arithmetic. The Step 0 insertion spike is audit JSON artifacts, not source code.

## 7. Verification

All Step 5.1 done-when checks pass:
- [x] `npm run typecheck` → 0 errors (EXIT:0 confirmed)
- [x] escape-hatches.ts shape valid (6 entries, 6 `// TODO(phase-13):` entry markers, 6 `export type Untyped*` declarations; file header contains 1 additional `// TODO(phase-13):` in its own rules list — grep count 7 is expected)
- [x] inline `any` count: 224 (baseline 238; delta -14 — Wave A removed unused symbols that carried implicit any annotations)
- [x] `@ts-*` suppression count: 5 (baseline 5; no change)
- [x] `npm run preflight` green (typecheck + build + 13 e2e tests + 83 unit tests + knip --strict; full chain exited 0)
