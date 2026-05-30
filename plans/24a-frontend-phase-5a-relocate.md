# Frontend Phase 5a — Relocate market-research into `features/` (mechanical, parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the *genuine* market-research surface — `src/pages/MarketResearch.tsx` plus the intelligence-tab composition layer and the five section components — into `src/features/market-research/` with **zero behavioral change**, wrap the routed page in `<FeatureErrorBoundary>`, and annotate the leaving components (lead-stream / Strategist / Scout clusters) in place — so every later sub-phase (5b–5i) operates against one set of import paths.

**Architecture:** A parity-preserving relocation, staged **scaffold → move genuine components (rewrite importers) → move page (rewire App.tsx + wrap boundary) → annotate leavers** as a sequence of commits, each kept green by `tsc --noEmit` + `npm run lint`. Files move with `git mv` (history preserved); content is unchanged except import-path rewrites and additive `// HANDOFF → <feature>` comments on leaving files. The `<Routes>` table, route URLs, and all rendered output stay byte-identical — only the modules behind the route move. **Leaving components are NOT moved** (leave-in-place model, Spec 24 §1.3.5/§7); the relocated page imports any it still renders from `src/components/market-research/` via the Phase-4 transitional legacy-import exception.

**Tech Stack:** React 18 + Vite + TS (strict), `@/` path alias → `src/`, ESLint flat-config (`eslint-plugin-import-x` + 4a resolver + zone/no-cycle rules + transitional legacy-import exception), Vitest + RTL + MSW, Playwright (behavioral journeys; **no MR visual snapshots** — see Conventions), knip `--strict`. GNU `sed`/`grep` (linux).

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §3 (and §1.2, §1.3, §2, §7, §9, §13).

**Prerequisite (hard):** **Phase 4 (plans `21a` + `21b`) must be merged to `master`.** 5a is the first consumer of the feature scaffolder, `<FeatureErrorBoundary>`, the `src/features/` conventions, and the dependency-lint rules. Task 0 Step 2 verifies they are present; if any is missing, stop.

**Conventions for every task:**
- File ops (`mkdir`, `git mv`, `sed`, `grep`, `npm`, `eslint --fix`) run from `frontend/`. `git add`/`git commit` run from the monorepo root `/projects/Brewra/brewra-gtm-intelligence` (so cross-cutting `docs/`/`specs/` paths are includable). There is no root-level `package.json` — all `npm` is in `frontend/`.
- After each rewrite run `npx eslint --fix src` to settle `import-x/order` (the only auto-fixable rule the path swaps disturb), then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` must be green before committing.
- Commit messages: `type(scope):` form; **no `Co-Authored-By` footer**; no `[N/M]`.
- **Visual-parity guard for ALL of Phase 5 is behavioral E2E (`e2e/journeys/04-market-research-5-components.spec.ts`) + Vitest/RTL + `npm run preflight`.** Market-research has **no** pixel visual-regression baseline today (`journeys/04` deliberately omits screenshots — the 7k page's rotating loaders/concurrent fetches are unstable), and Phase 5 does **not** add one (Task 5 logs the deferral as a TD-FE). Do **not** add `toHaveScreenshot` calls for market-research in this phase. The global 2% VR config and the other journeys' snapshots are untouched.

**Abort criteria (whole-branch — report to the controller and halt; do NOT force-push, amend pushed commits, or revert without sign-off):** the per-task STOP conditions handle "fix this step and continue." Abandon the *branch* and escalate when:
1. Phase 4 is not actually merged (Task 0 Step 2 fails).
2. The Task 0 baseline preflight (or its lighter subset) is RED **before any 5a change**.
3. A "genuine" component turns out to be imported by code **outside** market-research in a way that can't be resolved by either moving it + surfacing through `index.ts` or leaving it in place (Task 2 Step 2) — that is a shared-surface question (Phase 11), not 5a's to force.
4. The behavioral E2E `journeys/04` cannot be made green after the move and the cause can't be found after investigation (Task 7 Step 2) — for a mechanical relocation an unexplained behavior change means something genuinely moved that shouldn't have.

A half-migrated tree is recoverable from the last green commit; a force-pushed/amended history is not.

---

## Task 0: Branch + green baseline + pre-move audit

**Files:** none (verification only).

- [ ] **Step 1: Branch off the latest `master`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git pull --ff-only        # ensure Phase 4 is present; skip if it errors offline
git checkout -b phase-5a-relocate
```
> Spec 24 §10: each sub-phase branches from the latest `master` so no long-lived branch accumulates drift. (`phase-5-market-research` is the umbrella working branch; this sub-phase gets its own branch off `master`.)

- [ ] **Step 2: Confirm Phase 4 conventions landed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/README.md && echo "OK: features README (4a)"
grep -q "scaffold:feature" package.json && echo "OK: scaffolder (4a)"
test -f src/shared/components/FeatureErrorBoundary.tsx && echo "OK: FeatureErrorBoundary (4a)"
grep -q 'src/features/\*\*' eslint.config.js && echo "OK: react-refresh override covers features (4a)"
grep -qE '(^|[^[:alnum:]-])market-research([^[:alnum:]-]|$)' src/features/README.md && echo "OK: market-research on naming map (Phase 5)"
```
Expected: all OK. If any fail, STOP — Phase 4 is not merged (abort criterion 1). (The `market-research` grep is a word-boundary smoke check — a substring like `market-research-foo` won't false-match — but the **authoritative** on-map gate is the scaffolder's own not-on-map warning at Task 1 Step 1; if this grep passes but Task 1 warns, trust the scaffolder.)

- [ ] **Step 3: Green preflight baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end. If RED **before any 5a change**, STOP and report (abort criterion 2). If `test:e2e` is slow, the lighter subset `npm run typecheck && npm run lint && npm run test` is acceptable for the baseline; Task 7's full preflight is the real gate. 5a is a mechanical move, so it cannot plausibly break `build`/`bundle:check` that the subset skips — but if Task 7 then reds on a step that was skipped here, **triage before treating it as a 5a regression:** `git stash` any WIP, `git checkout master`, run that exact step on `master` (e.g. `npm run build`, `npm run bundle:check`, or `npm run test:e2e`), then `git checkout phase-5a-relocate` (and `git stash pop`). If `master` also reds on that step, the failure **pre-existed 5a** — report it, but it is not a 5a regression and not abort-criterion 2. Only a step that is green on `master` and red on the branch is a real 5a regression.

- [ ] **Step 4: Audit — confirm the route + the file inventory (spec §1.2, §13)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== route (FROZEN) ==="; grep -n 'MarketResearch\|your-ai-team/scout\|market-research' src/App.tsx
echo "=== page present ==="; wc -l src/pages/MarketResearch.tsx
echo "=== page _clean duplicate absent (spec §1.2) ==="; test ! -f src/pages/MarketResearch_clean.tsx && echo "OK: absent"
echo "=== components dir inventory ==="; (cd src/components/market-research && wc -l $(find . -type f \( -name '*.ts' -o -name '*.tsx' \) | sort))
```
Expected and record:
- **Route (frozen, must not change):** `App.tsx` imports `MarketResearch` eagerly (≈ line 20: `import MarketResearch from "./pages/MarketResearch";`) and maps it at `path="/your-ai-team/scout/:tab"` inside `<ProtectedRoute requireTenant>` (≈ lines 92–102), with redirects `/market-research` → `/your-ai-team/scout/marketintelligence` and `/your-ai-team/scout` → same. The internal tab keys `intelligence`/`analysis`/`trends` map to URL segments `marketintelligence`/`leadstream`/`chatwithscout` *inside the page* (`getActiveTabFromPath`), **not** in `App.tsx`. None of these URLs change in 5a.
- **Inventory:** ~31 files in `src/components/market-research/`. Classify each against the two lists in Step 5. If a file exists that is on **neither** list, classify it by import-tracing (Step 5's rule) before proceeding.

- [ ] **Step 5: Audit — classify genuine vs leaving (spec §1.3.5, §7)**

Build two lists. **Genuine** (moves into the feature) and **leaving** (stays in `src/components/market-research/`, annotated). The known classification (verify against the Step 4 inventory; reconcile any new file):

**GENUINE — move to `src/features/market-research/components/` (Task 2):**
- The 5 sections: `MarketEntrySection.tsx`, `RegulatoryComplianceSection.tsx`, `CompetitorLandscapeSection.tsx`, `IndustryTrendsSection.tsx`, `MarketSizeSection.tsx`
- Intelligence composition layer: `SafeMarketIntelligenceTab.tsx`, `MarketIntelligenceTab.tsx`, `MarketIntelligenceSections.tsx`, `MarketIntelligenceTabProps.ts`
- MR-only helpers/dialogs the page renders: `EditHistoryPanel.tsx`, `MarketDetailDrawer.tsx`
- **Any remaining file** whose importers are *only* the intelligence surface above (confirm with the grep in Step 6) — these are genuine MR internals and move too.

**LEAVING — stay put, annotate `// HANDOFF → <feature>` (Task 4):**
- `StrategistWorkspace.tsx` → **strategist**
- `lead-stream/` (`LeadsTable.tsx`, `leadData.ts`, `OpportunityDashboard.tsx`) → **customers**
- `ScoutChatPanel.tsx`, `ChatWithScout.tsx` → **scout**
- Scout config cluster: `ScoutSettingsForm.tsx`, `ScoutDeploymentDetails.tsx`, `ScoutLeadStream.tsx`, `ScoutCapabilities.tsx` → **scout** (CONFIRM per-file in Step 6 by tracing — spec §7/§13)

> Not in this dir (do not touch): `ScoutChatWithHistory` and `SignalsChatContext` live in `src/components/signals/`. The page imports them; their paths are unchanged by 5a.

- [ ] **Step 6: Audit — trace the Scout config cluster's stay/leave (spec §7, §13)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for f in ScoutSettingsForm ScoutDeploymentDetails ScoutLeadStream ScoutCapabilities; do
  echo "=== importers of $f ==="
  grep -rln "market-research/$f" src --include=*.ts --include=*.tsx
done
echo "=== external importers of the 'genuine' helpers (should be MR-only) ==="
for f in EditHistoryPanel MarketDetailDrawer SafeMarketIntelligenceTab; do
  echo "--- $f ---"; grep -rln "market-research/$f" src --include=*.ts --include=*.tsx
done
```
Expected and decide:
- **Scout cluster:** if a cluster file is imported **only** by `src/pages/MarketResearch.tsx`'s tab chrome (and not by any genuine intelligence/section file), it **stays** (leaving → scout) — record it on the leaving list. If a file is imported by a genuine section, re-classify it genuine (it is intelligence-internal) and move it in Task 2 instead. Record the per-file decision (spec §13 requires this confirmation here).
- **Genuine helpers:** each should be imported only by market-research code. If `grep` shows an importer **outside** market-research (another page/feature), that helper is a shared-surface question — default: still move it into the feature and **surface it from `index.ts`** so the external importer uses `@/features/market-research` (cross-feature consumption via the public index); if that can't be done cleanly, leave it in `src/components/market-research/` for now and note it for Phase 11. If neither works, STOP (abort criterion 3).

No commit (audit only). Record both finalized lists for Tasks 2 and 4.

---

## Task 0 — RECORDED AUDIT RESULT (filled in at execution, 2026-05-30; whole-dir import-traced)

The full `src/components/market-research/` (33 entries) was import-traced across all of `src` (read-only). Baseline preflight: typecheck/lint/format/test/build/bundle ✅; **`journeys/04` (the 5a market-research behavioral guard) ✅**; the only `test:e2e` red is a **pre-existing** `journeys/06` customers-page `toHaveScreenshot` drift (verified: `frontend/` is byte-identical to `master`, so it pre-dates 5a — report, not abort-criterion-2). MECE classification of all 33:

**GENUINE — move into `features/market-research/components/` (Task 2) — 12 files:**
`MarketEntrySection.tsx`, `RegulatoryComplianceSection.tsx`, `CompetitorLandscapeSection.tsx`, `IndustryTrendsSection.tsx`, `MarketSizeSection.tsx`, `SafeMarketIntelligenceTab.tsx`, `MarketIntelligenceTab.tsx`, `MarketIntelligenceSections.tsx`, `MarketIntelligenceTabProps.ts`, `EditHistoryPanel.tsx`, `MarketDetailDrawer.tsx`, **`AIPromptingInterface.tsx`** (live via `MarketDetailDrawer` → page; the canonical 11 + AIPI).

**LEAVING — stay in `src/components/market-research/`, `// HANDOFF → <feature>` (Task 4) — 12 files:**
- `StrategistWorkspace.tsx` → **strategist** (external importer: `pages/Deals`)
- `ChatWithScout.tsx`, `ScoutChatPanel.tsx`, `ScoutSettingsForm.tsx`, `ScoutDeploymentDetails.tsx`, `ScoutLeadStream.tsx` → **scout**
- `lead-stream/LeadsTable.tsx`, `lead-stream/OpportunityDashboard.tsx`, `lead-stream/leadData.ts` → **customers**
- **Newly found by the trace (not in spec §7 table — log as a §9 delta, Task 6):** `AddLeadModal.tsx` → **scout** (importer `signals/ScoutChatWithHistory`), `SuggestedCompaniesSection.tsx` → **scout** (importer `signals/ScoutChatWithHistory`), `EditDropdownMenu.tsx` → **customers** (importer `customers/SuggestedICPCards`)

**DEAD — zero live importers; stay untouched, log for 5i dead-code sweep (Task 5), NO `HANDOFF` marker — 8 files:**
`CompetitorAnalysis.tsx` (0 importers), `CompetitorAnalysisDrawer.tsx` (only importer is dead `CompetitorAnalysis`), `ComponentStatusLoadingScreen.tsx`, `DataHistoryDialog.tsx`, `EmergingTrends.tsx`, `EmergingTrendsDrawer.tsx` (only importer is dead `EmergingTrends`), `RecentMarketResearch.tsx`, `ScoutCapabilities.tsx` (spec §7 listed it under the Scout cluster "confirm per-file in 5a" — confirmed **dead**, annotate dead not scout). *(knip stays green because `knip.json` `entry` = `src/**/*.{ts,tsx}!` makes every file a production entry, so knip never flags unused files — these survive to 5i.)*

**SHARED — stays (1 file):** `types.ts` (`EditRecord`/`TrendSnapshot`/`IndustryTrendsRecommendations`) — imported by 6 genuine files **and** `signals/ScoutChatWithHistory` (external). Per user decision + spec §2.2, it stays in legacy; moved files import it transitionally via `@/components/market-research/types`; promotion to `shared/` is Phase 11.

> The page (`src/pages/MarketResearch.tsx`) imports exactly **7** MR files, all `@/`-alias form: 3 genuine (`EditHistoryPanel`, `SafeMarketIntelligenceTab`, `MarketDetailDrawer`) + 4 leaving (`ChatWithScout`, `ScoutDeploymentDetails`, `ScoutLeadStream`, `ScoutSettingsForm`). It imports **none** of the 5 sections directly (they render via `SafeMarketIntelligenceTab` → `MarketIntelligenceTab` → `MarketIntelligenceSections`).

---

## Task 1: Scaffold `features/market-research/` (dogfood the 4a scaffolder)

**Files:**
- Create: `frontend/src/features/market-research/{types.ts,index.ts,README.md}` (via the scaffolder)

> Spec 24 §3. `market-research` is already on the naming map (Task 0 Step 2), so no warning.

- [ ] **Step 1: Run the scaffolder**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run scaffold:feature -- market-research
ls src/features/market-research    # expect: README.md  index.ts  types.ts
```
Expected: three files, no `components/`/`pages/`/`hooks/`/`services/` subdirs (created on demand), no not-on-map warning.

- [ ] **Step 2: Verify green and commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsc --noEmit -p tsconfig.app.json   # generated index.ts is `export {}` — must typecheck
npm run lint
npx knip --strict --no-progress
```
Expected: all PASS. (`index.ts` `export {}` + empty `types.ts` → knip sees no unused exports; both are reachable production entries.) **If knip instead flags `index.ts`/`types.ts` as unused files**, the knip `entry`/`project` globs aren't reaching `src/features/**` — verify the Phase-4 `knip.json` `project` glob covers features (a `src/**/*.{ts,tsx}`-style glob; recall knip `--production` entries are an exact used-files set, not a graph walk). 4b already scaffolded `features/shell/` under the same config, so coverage is expected; fix the config if it regressed — do **not** add a `src/features/**` knip ignore to mask it.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research
git commit -m "feat(fe): scaffold features/market-research"
```

---

## Task 2: Move the genuine intelligence surface into the feature (rewrite all importers)

**Files:**
- Move into `frontend/src/features/market-research/components/`: the **12** genuine files (5 sections + 4 composition-layer files + `EditHistoryPanel.tsx` + `MarketDetailDrawer.tsx` + `AIPromptingInterface.tsx`) — see "Task 0 — RECORDED AUDIT RESULT".
- Modify (path swaps only): the page (`src/pages/MarketResearch.tsx`); the 6 moved files with boundary-crossing relative imports; the 2 dead staying files (`CompetitorAnalysisDrawer`, `EmergingTrendsDrawer`) importing moved `AIPromptingInterface`.

> Spec 24 §2.3, §3. Move + repoint-all-importers in ONE commit so `tsc --noEmit` is green at the boundary. The page is still in `src/pages/` after this task; it now imports the genuine components from their feature path (Task 3 moves the page itself). `SafeMarketIntelligenceTab` moves **as-is** here — replacing it with `<FeatureErrorBoundary>` is 5c's job (spec §5), not 5a's.

- [ ] **Step 1: Create the target dir and `git mv` the genuine files**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/market-research/components
# Move each genuine file confirmed in Task 0 Step 5. Example for the canonical set —
# add/remove lines to match the finalized list (do NOT move any leaving-list file):
for f in \
  MarketEntrySection.tsx RegulatoryComplianceSection.tsx CompetitorLandscapeSection.tsx \
  IndustryTrendsSection.tsx MarketSizeSection.tsx \
  SafeMarketIntelligenceTab.tsx MarketIntelligenceTab.tsx MarketIntelligenceSections.tsx \
  MarketIntelligenceTabProps.ts EditHistoryPanel.tsx MarketDetailDrawer.tsx \
  AIPromptingInterface.tsx ; do
  git mv "src/components/market-research/$f" "src/features/market-research/components/$f"
done
ls src/features/market-research/components
```
Expected: **12** files now under `components/` (the finalized GENUINE list — see "Task 0 — RECORDED AUDIT RESULT"). If a `git mv` errors (file not found), the finalized list disagrees with the tree — reconcile against Task 0 before continuing.

- [ ] **Step 2: Repoint imports — the EXACT trace-verified edge list (the dir uses relative `./`/`../`, not `@/` alias)**

> **Reality check (verified at execution, supersedes the original naive sed loop):** the moved files cross-import **almost entirely by relative form** (`./X`, `../X`), not `@/components/market-research/X`. A blunt `@/`-only `sed` would be a near no-op and miss the breakages. The rule: a relative import between **two co-moving files stays valid** (still siblings in the new dir — do **not** touch it); a relative/alias import that crosses the move boundary (moved→staying, or staying/page→moved) **must** be rewritten to an absolute `@/…` path. The complete boundary-crossing edge set below was built by tracing every import; apply exactly these, nothing more.

**(A) In MOVED files — rewrite relative imports that point at STAYING targets → absolute `@/`:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
B=src/features/market-research/components
# → ./types  (types.ts STAYS in legacy — shared with signals)
sed -i 's#from "\./types"#from "@/components/market-research/types"#' \
  "$B/MarketEntrySection.tsx" "$B/RegulatoryComplianceSection.tsx" "$B/MarketSizeSection.tsx" "$B/MarketIntelligenceTabProps.ts"
# MarketIntelligenceSections → ./ScoutChatPanel  (ScoutChatPanel STAYS → scout)
sed -i 's#from "\./ScoutChatPanel"#from "@/components/market-research/ScoutChatPanel"#' "$B/MarketIntelligenceSections.tsx"
# RegulatoryComplianceSection → ../MiniLineChart, ../MiniPieChart  (live at src/components/, STAY)
sed -i 's#from "\.\./MiniLineChart"#from "@/components/MiniLineChart"#; s#from "\.\./MiniPieChart"#from "@/components/MiniPieChart"#' "$B/RegulatoryComplianceSection.tsx"
# SafeMarketIntelligenceTab → ../common/ErrorBoundary  (lives at src/components/common/, STAYS)
sed -i 's#from "\.\./common/ErrorBoundary"#from "@/components/common/ErrorBoundary"#' "$B/SafeMarketIntelligenceTab.tsx"
```
> NOT rewritten (co-moving siblings — relative form stays correct): `SafeMarketIntelligenceTab→./MarketIntelligenceTab,./MarketIntelligenceTabProps`; `MarketIntelligenceTab→./MarketIntelligenceSections,./MarketIntelligenceTabProps`; `MarketIntelligenceSections→./{Competitor,IndustryTrends,MarketEntry,MarketSize,RegulatoryCompliance}Section,./MarketIntelligenceTabProps`; `MarketDetailDrawer→./AIPromptingInterface`. (Absolute `@/components/ui/*`, `@/lib/*`, npm imports in moved files are unaffected by a move — leave them.)

**(B) In the PAGE (still in `src/pages/` this task) — rewrite its 3 `@/`-alias imports of MOVED files; LEAVE the 4 leaving ones:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for f in EditHistoryPanel MarketDetailDrawer SafeMarketIntelligenceTab ; do
  sed -i "s#@/components/market-research/$f\"#@/features/market-research/components/$f\"#g" src/pages/MarketResearch.tsx
done
# LEFT untouched (leaving → transitional exception): ChatWithScout, ScoutDeploymentDetails, ScoutLeadStream, ScoutSettingsForm
```

**(C) In the 2 DEAD staying files — repoint their relative import of moved `AIPromptingInterface` (so `tsc` stays green; they remain dead, logged for 5i):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
sed -i 's#from "\./AIPromptingInterface"#from "@/features/market-research/components/AIPromptingInterface"#' \
  src/components/market-research/CompetitorAnalysisDrawer.tsx src/components/market-research/EmergingTrendsDrawer.tsx
```

**(D) Backstops — three greps, each must be EMPTY:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# 1) No moved-file basename still referenced under the OLD legacy path (alias or relative), anywhere in src:
for f in MarketEntrySection RegulatoryComplianceSection CompetitorLandscapeSection IndustryTrendsSection MarketSizeSection SafeMarketIntelligenceTab MarketIntelligenceTab MarketIntelligenceSections MarketIntelligenceTabProps EditHistoryPanel MarketDetailDrawer AIPromptingInterface ; do
  grep -rn "components/market-research/$f\"" src --include=*.ts --include=*.tsx
done
# 2) No DANGLING relative import inside the moved dir pointing at a file that did NOT move
#    (i.e. a ./X or ../X in components/ whose target isn't a co-moved sibling or a real parent path):
grep -rnE "from \"\.\.?/" src/features/market-research/components --include=*.ts --include=*.tsx \
  | grep -vE "from \"\./(MarketEntrySection|RegulatoryComplianceSection|CompetitorLandscapeSection|IndustryTrendsSection|MarketSizeSection|SafeMarketIntelligenceTab|MarketIntelligenceTab|MarketIntelligenceSections|MarketIntelligenceTabProps|EditHistoryPanel|MarketDetailDrawer|AIPromptingInterface)\""
# 3) Precision: every NEW feature-path occurrence is on an import/export/from line (no sed-corrupted string/comment):
grep -rn '@/features/market-research/components/' src --include=*.ts --include=*.tsx \
  | grep -vE ':[[:space:]]*(import|export)[[:space:]]' | grep -vE '[[:space:]]from[[:space:]]'
```
Expected: **(1) empty**, **(2) empty** (every relative import left in the moved dir resolves to a co-moved sibling), **(3) empty** (a printed line = a string/comment `sed` wrongly touched — restore it by hand; `tsc` can't catch a corrupted string in the "zero behavioral change" contract). The Step 4 `tsc --noEmit` is the final compiler backstop.

- [ ] **Step 3: Settle import order, typecheck, lint**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS. The moved files now sit in `features/**` (react-refresh override covers them); their imports of leaving components resolve via the transitional exception; no `import-x/no-restricted-paths` violation (they import only `@/components/ui`, `@/shared`, legacy dirs, npm, and intra-feature).

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): relocate market-research intelligence surface into features/market-research/components"
```

---

## Task 3: Move the page → `features/market-research/pages/`, wrap the boundary, rewire `App.tsx`

**Files:**
- Move: `frontend/src/pages/MarketResearch.tsx` → `frontend/src/features/market-research/pages/MarketResearchPage.tsx`
- Modify: `frontend/src/App.tsx` (import source + wrap element only)

> Spec 24 §2.1, §3. The page's imports of genuine components already point at `@/features/market-research/components/` (Task 2). The `analysis` (lead-stream) tab is **inline** in this page and rides into the feature *inside* `MarketResearchPage.tsx` — 5c extracts it (spec §3 note, §5). 5a does not separate it.

- [ ] **Step 1: `git mv` the page (history preserved) and rename**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
mkdir -p src/features/market-research/pages
git mv src/pages/MarketResearch.tsx src/features/market-research/pages/MarketResearchPage.tsx
```

- [ ] **Step 2: Fix the page's own import paths if any are relative**

The page uses `@/`-aliased imports throughout (no `./` relatives), so the move requires no in-file path edits. Confirm:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n "from \"\.\.\?/" src/features/market-research/pages/MarketResearchPage.tsx   # expect: NO output (no relative imports)
```
Expected: empty. If any relative import appears, repoint it to its `@/` equivalent before continuing.

- [ ] **Step 3: Rewire `App.tsx` — new import source + wrap in `<FeatureErrorBoundary>`**

Edit `frontend/src/App.tsx`. Change the eager import source (the default export now lives at the feature path) and add the boundary import:

Replace:
```tsx
import MarketResearch from "./pages/MarketResearch";
```
with:
```tsx
import { FeatureErrorBoundary } from "@/shared/components";
import MarketResearchPage from "@/features/market-research/pages/MarketResearchPage";
```

Then in the `<Route path="/your-ai-team/scout/:tab" …>` element, wrap the page (keeping `<ProtectedRoute requireTenant>` and the route path **unchanged**):
```tsx
<Route
  path="/your-ai-team/scout/:tab"
  element={
    <ProtectedRoute requireTenant>
      <FeatureErrorBoundary featureName="Market Research">
        <MarketResearchPage />
      </FeatureErrorBoundary>
    </ProtectedRoute>
  }
/>
```
Leave every other route, the `/market-research` and `/your-ai-team/scout` redirects, and provider nesting **byte-for-byte unchanged** — only this import block and this one element change.

Sanity-check the hand edit:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -c 'features/market-research/pages/MarketResearchPage' src/App.tsx   # expect: 1
grep -c './pages/MarketResearch"' src/App.tsx                            # expect: 0 (no stale import)
grep -n 'FeatureErrorBoundary' src/App.tsx                               # expect: import + the wrap
git diff src/App.tsx                                                      # eyeball: only the import block + the one route element changed
```

- [ ] **Step 4: Settle order, typecheck, lint, knip**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npx knip --strict --no-progress
```
Expected: all PASS. `src/pages/MarketResearch.tsx` is gone; the page is reached via `App.tsx` → feature path; genuine components reached via the page; `FeatureErrorBoundary` now has a production consumer (relevant to Task 5's knip-ignore removal). **If knip flags anything**, it is most likely the now-consumed `FeatureErrorBoundary` interacting with the 4a ignore — defer the fix to Task 5 (which removes that ignore) only if the flag is exactly that; otherwise investigate.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): route market-research from features/market-research/pages; wrap in FeatureErrorBoundary"
```

---

## Task 4: Annotate the leaving components + README "Pending handoffs" stub

**Files:**
- Modify (additive comments only): each leaving file in `frontend/src/components/market-research/` confirmed in Task 0.
- Modify: `frontend/src/features/market-research/README.md` (replace the scaffolder stub).

> Spec 24 §3, §7. Pure annotation — no behavior change. Each leaving file gets an in-code handoff marker naming its **target feature** (not a phase number — spec §7/§9.4); the README records the pending handoffs.

- [ ] **Step 1: Add `// HANDOFF → <feature>` to each leaving file**

For each leaving file, insert a comment block at the very top (above the first import). Example for `StrategistWorkspace.tsx`:
```tsx
// HANDOFF → strategist (Spec 24 §7). This component is NOT part of market-research;
// it stays here until the strategist feature phase relocates + decomposes it.
```
Apply the matching target per Task 0's finalized **12-file LEAVING** list (the example comment 2nd line names the owning feature):
- `StrategistWorkspace.tsx` → `// HANDOFF → strategist`
- `lead-stream/LeadsTable.tsx`, `lead-stream/leadData.ts`, `lead-stream/OpportunityDashboard.tsx` → `// HANDOFF → customers`
- `EditDropdownMenu.tsx` → `// HANDOFF → customers` *(newly found — sole importer `customers/SuggestedICPCards`)*
- `ScoutChatPanel.tsx`, `ChatWithScout.tsx`, `ScoutSettingsForm.tsx`, `ScoutDeploymentDetails.tsx`, `ScoutLeadStream.tsx` → `// HANDOFF → scout`
- `AddLeadModal.tsx`, `SuggestedCompaniesSection.tsx` → `// HANDOFF → scout` *(newly found — sole importer `signals/ScoutChatWithHistory`)*

> **`ScoutCapabilities.tsx` is NOT here** — it is **dead** (0 importers), so it gets a dead-code marker, not a HANDOFF. The 8 DEAD files (`CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities`) each get a top-of-file marker:
> ```tsx
> // DEAD CODE → delete in 5i (Spec 24 §7 dead-code sweep). No live importer as of Phase 5a (TD-FE logged).
> ```
> `types.ts` gets **no** marker (it is live shared infra, stays for the transitional `@/components/market-research/types` imports until Phase 11).

Confirm every remaining file in the dir carries either a `HANDOFF →` or a `DEAD CODE →` marker (only `types.ts` is intentionally unmarked):
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rLE 'HANDOFF →|DEAD CODE →' src/components/market-research --include=*.ts --include=*.tsx
```
Expected: **only `src/components/market-research/types.ts`**. If a genuine file (a moved one) shows up here, it failed to move in Task 2 — reconcile. Any other unmarked file means a leaver/dead file was missed.

- [ ] **Step 2: Write the feature `README.md` (purpose + pending-handoffs stub)**

Overwrite `frontend/src/features/market-research/README.md`:

````markdown
# `market-research` feature

## Purpose

The market-research surface: the routed page + the **intelligence** tab (the five research sections — market entry, regulatory & compliance, competitor landscape, industry trends, market size — composed over the company profile + research data layer). Extracted from `src/pages/MarketResearch.tsx` + `src/components/market-research/` in Phase 5 (master Spec 14 §4; Spec 24).

## Public surface

_Locked in 5i (`index.ts`). Anticipated: research-result/report types + a results-read hook consumed by `signals` (Phase 8). Not finalized while internals are still moving._

## Key files

- `pages/MarketResearchPage.tsx` — routed shell (thin shell + tab router after 5c), wrapped in `<FeatureErrorBoundary>`
- `components/` — the intelligence composition layer + the five sections (decomposed in 5d–5h)
- `index.ts` — public re-exports (the cross-feature surface) · `types.ts` — feature-local types
- `contracts.ts`, `hooks/`, `services/` — added in 5b (data layer)

## Dependency notes

- May import: `@/features/market-research/*` (self), `@/shared/*`, `@/components/ui/*`, npm. Transitional (Phases 4b–12): `@/components/*` (incl. the leaving components below), `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`.
- Cross-feature consumers import only via `@/features/market-research` (the index), never a deep path.

## Pending handoffs (leaving components — stay in `src/components/market-research/`, Spec 24 §7)

These belong to **other** features and are NOT part of market-research. They stay annotated in place; the owning phase relocates + decomposes each. The dir is deleted once empty (≤ Phase 9).

| Component(s) | Target feature | Claiming phase |
|---|---|---|
| `StrategistWorkspace.tsx` | strategist | per naming map |
| `lead-stream/*` (`LeadsTable`, `leadData`, `OpportunityDashboard`) + the `analysis`-tab code 5c extracts here | customers | 7 |
| `EditDropdownMenu.tsx` (used by `customers/SuggestedICPCards`) | customers | 7 |
| `ScoutChatPanel.tsx`, `ChatWithScout.tsx` | scout | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm`, `ScoutDeploymentDetails`, `ScoutLeadStream`) | scout | per naming map |
| `AddLeadModal.tsx`, `SuggestedCompaniesSection.tsx` (used by `signals/ScoutChatWithHistory`) | scout | per naming map |

**Dead code (no live importer — deleted in 5i, Spec 24 §7 sweep; TD-FE logged):** `CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities`.
````

- [ ] **Step 3: Verify format and commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check    # or: npx prettier --check src/features/market-research/README.md src/components/market-research
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS (run `npm run format` if `format:check` flags the new comments/README, then re-check).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "docs(fe): annotate market-research leaving components; record pending handoffs in feature README"
```

---

## Task 5: Close TD-FE-14 (knip ignore) + log the deferred-MR-visual-baseline TD-FE

**Files:**
- Modify: `frontend/knip.json`
- Modify: `docs/TECH_DEBT.md`

> Phase 4a (Plan 21a Task 3) added `"src/shared/components/**"` to `knip.json`'s `ignore` with **TD-FE-14**, whose pull-forward trigger is "Phase 5 imports `FeatureErrorBoundary`." Task 3 did exactly that, so 5a closes TD-FE-14. Separately, log the Phase-5 decision to **not** build a market-research visual-regression baseline.

- [ ] **Step 1: Remove the now-unneeded knip ignore**

`FeatureErrorBoundary` now has a production consumer (`App.tsx`, Task 3). Edit `frontend/knip.json` — drop `"src/shared/components/**"` from the `ignore` array, leaving `"src/components/ui/**"`:
```json
  "ignore": ["src/components/ui/**"],
```
(Other keys — `$schema`, `entry`, `project`, `ignoreDependencies` — unchanged.)

- [ ] **Step 2: Verify knip is still green without the ignore**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --strict --no-progress
```
Expected: PASS — `FeatureErrorBoundary` + its `index.ts` re-export are now reached from `App.tsx`. **If knip reds** reporting `FeatureErrorBoundary` unused, the Task 3 wrap didn't land — fix Task 3 before re-removing the ignore (do not re-add the ignore to mask it).

- [ ] **Step 3: Mark TD-FE-14 resolved and log the new MR-visual TD-FE**

First capture the **execution date** and the next free TD-FE number — substitute both into the entries below; do **not** hard-code either (this plan may execute on a date other than its authoring date):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
date +%F                                                                # ← use this date in both entries below
grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1   # highest existing → next free = +1
```

Mark TD-FE-14 resolved **in place** (append a resolution line to its entry — do not delete it; do not reformat surrounding markdown, per the "no prettier on TECH_DEBT" rule). Add under TD-FE-14:
```markdown

**Resolved:** <execution date — the `date +%F` output above> (Plan 24a Phase 5a, Task 5). Phase 5 wraps the market-research route in `FeatureErrorBoundary` (`App.tsx`); `"src/shared/components/**"` removed from `knip.json` `ignore` and `knip --strict` stays green.
```

Then append a new entry (use the next free number — shown here as `TD-FE-NN`):
```markdown

---

## TD-FE-NN — market-research has no visual-regression baseline (Phase 5 guards with behavioral E2E + Vitest)

**Date logged:** <execution date — the `date +%F` output above>
**Origin:** Plan 24a Phase 5a (plans/24a-frontend-phase-5a-relocate.md), Task 5.

**Current state:**
The behavioral E2E `e2e/journeys/04-market-research-5-components.spec.ts` deliberately omits pixel screenshots (the 7k-LOC page's rotating loading messages + concurrent independent fetches make full-page snapshots unstable without much heavier mocking). The global 2% `maxDiffPixelRatio` VR config and other journeys' snapshots exist, but **market-research has no VR baseline**. Spec 24 §1.2/§8/R4 assumed 2% VR was the primary parity guard "between every sub-phase"; it is not available for this surface.

**What it should be:**
Phase 5 (5a–5i) guards visual parity with behavioral E2E (`journeys/04`) + Vitest/RTL + `npm run preflight` only — no MR pixel VR. Re-establish a market-research visual-regression baseline **after** Phase 5, once decomposition (5c–5h) has produced stable, individually-mockable components for which screenshot comparison is practical (the `journeys/04` author's "reinstated post-refactor" intent).

**Pull-forward trigger:**
Post-Phase-5, when the decomposed tab/section components are stable enough to snapshot — or earlier if a visual regression slips through behavioral coverage.

**Owner:** TBD.
```

Then append a **second** new entry (next free number after the visual one — `TD-FE-MM = NN+1`) recording the dead code the 5a trace surfaced, so 5i's sweep has a concrete worklist:
```markdown

---

## TD-FE-MM — market-research dead code (8 files, no live importer) awaiting the 5i sweep

**Date logged:** <execution date — the `date +%F` output above>
**Origin:** Plan 24a Phase 5a (plans/24a-frontend-phase-5a-relocate.md), Task 0 import trace.

**Current state:**
The 5a whole-dir import trace found 8 files in `src/components/market-research/` with **zero live importers** (knip does not flag them because `knip.json` `entry` makes every `src/**` file a production entry): `CompetitorAnalysis.tsx`, `CompetitorAnalysisDrawer.tsx` (only importer is dead `CompetitorAnalysis`), `ComponentStatusLoadingScreen.tsx`, `DataHistoryDialog.tsx`, `EmergingTrends.tsx`, `EmergingTrendsDrawer.tsx` (only importer is dead `EmergingTrends`), `RecentMarketResearch.tsx`, `ScoutCapabilities.tsx`. They are annotated `// DEAD CODE → delete in 5i` in place (Task 4).

**What it should be:**
5a is mechanical/parity, so it does **not** delete them (deletion is Spec 24 §7's 5i dead-code-sweep scope). 5i deletes all 8 and confirms `knip --strict` + `tsc` stay green.

**Pull-forward trigger:**
Spec 24 §7 (sub-phase 5i). Earlier only if one of these files is found to be a build/parity liability before 5i.

**Owner:** TBD.
```

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/knip.json docs/TECH_DEBT.md
git commit -m "chore(fe): close TD-FE-14 knip ignore (FeatureErrorBoundary consumed); log deferred MR visual baseline"
```

---

## Task 6: Spec 24 + master Spec 14 deltas (5a branch)

**Files:**
- Modify: `specs/24-frontend-phase-5-market-research-design.md`
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

> Spec 24 §9 (deltas applied at sub-phase merges) + §2 status amendment. Dedicated `docs(spec-…):` commits, separate from code. Record what 5a's contact with the live code revealed; correct only the **living** sections, do not rewrite frozen narrative.

- [ ] **Step 1: Master Spec 14 — status + Phase-3/4 row check (spec §9.2)**

In `specs/14-frontend-refactoring-master-plan-design.md` §4 status table: mark **Phase 5 → in progress**. Verify the **Phase 3** and **Phase 4 (4a/4b)** rows read "done" (they are merged) and correct them if they still say "pending" (observed stale in at least one working copy — spec §9.2). The §4 **status-table cells are metadata (mutable)** — updating a status value is in scope here; only the surrounding Phase-narrative *prose* is frozen. Do not touch that narrative prose.

- [ ] **Step 2: Spec 24 — record the route/tab reality + make the visual-guard amendment self-consistent (spec §9, §13)**

**(a)** Append a dated note to Spec 24 §9 (master-deltas) capturing what 5a confirmed against the code (these correct factual assumptions the spec made before filesystem verification; they do not change scope):
```markdown

6. **5a findings (recorded at 5a merge).** Confirmed against `App.tsx`: the frozen route is `/your-ai-team/scout/:tab` (segments `marketintelligence`/`leadstream`/`chatwithscout` ↔ internal keys intelligence/analysis/trends), with `/market-research` + `/your-ai-team/scout` redirects — superseding the §1.2 shorthand. The `trends` tab renders **Scout chat** (`ChatWithScout`/`ScoutChatWithHistory`), not an emerging-trends view, and `analysis` renders `ScoutLeadStream`; only the `intelligence` tab is genuine market-research (the §2.1 `trends/TrendsTab` becomes a thin router over leaving Scout-chat — see 5c). **The 5a whole-dir import trace refined the §7 leaving inventory:** (i) the genuine moved set is **12** files (the §7-implied 11 + `AIPromptingInterface`, live via `MarketDetailDrawer`); (ii) **3 leavers not in the §7 table** were found and annotated — `AddLeadModal` + `SuggestedCompaniesSection` → **scout** (importer `signals/ScoutChatWithHistory`), `EditDropdownMenu` → **customers** (importer `customers/SuggestedICPCards`); (iii) the `Scout*` config file `ScoutCapabilities` is **dead** (0 importers), not a live scout leaver — it joins **8 dead files** annotated `// DEAD CODE → delete in 5i` (TD-FE logged) for the §7 5i sweep; (iv) `types.ts` is shared by the moved sections **and** `signals`, so it stays in legacy (moved files import it transitionally; promotion to `shared/` is Phase 11). **Visual parity for all of Phase 5 is behavioral E2E (`journeys/04`) + Vitest/RTL — there is no market-research pixel-VR baseline (TD-FE logged 5a). This supersedes every "visual" / "visual regression" parity-guard assertion in this spec for the market-research surface: §1.2 (safety-net row), §3 & §6 "Done when", §8 (testing/preflight), §11 (phase DoD item 5), and R4.**
```

**(b)** A §9 note alone leaves the formal completion gates self-contradicting (they still literally say "visual"). So **qualify the "visual" token in place** at the two gates this plan's own checklist actually walks — Spec 24 **§3 "Done when"** and **§11 Definition-of-done item 5** — so a downstream reviewer checking 5a/phase "done" against the literal spec text sees the amended criterion, not a phantom unmet "visual":
- **§3 "Done when":** change `… E2E (\`journeys/04\`) + visual + Vitest + \`npm run preflight\` green.` → `… E2E (\`journeys/04\`) + Vitest + \`npm run preflight\` green (visual parity via behavioral E2E + Vitest; **no MR pixel VR** — §9 delta 6 / TD-FE).`
- **§11 item 5:** change `… \`journeys/04\` E2E + visual regression green; …` → `… \`journeys/04\` E2E green (visual parity via behavioral E2E; **no MR pixel VR** — §9 delta 6); …`.

Leave §4 & §6 "Done when" untouched here — each is a later sub-phase's gate (5b, 5d–5h), and those plans echo the phase-wide decision at their own merges; the §9 note above already records the supersession so none is ambiguous in the meantime.

**(c)** Reconcile the **§7 authoritative leaving table** with the 5a trace (the table the claiming phases read before planning, per §7's own note). The §9 delta 6 *records* the findings narratively, but the §7 table itself was pre-trace — so update it in place: add the 3 newly-found leavers (`EditDropdownMenu` → customers; `AddLeadModal`, `SuggestedCompaniesSection` → scout) with LOC + importer; drop `ScoutCapabilities` from the scout config-cluster row and reclassify it **dead**; add a dead-code paragraph listing the 8 zero-importer files (TD-FE-18) and a note that `AIPromptingInterface` moved as the 12th genuine file and `types.ts` stays as transitional shared infra. Drop the "(candidate) / confirm per-file in 5a" qualifier now that the trace confirmed it. (This makes the operational table self-consistent with delta 6 instead of contradicting it.)

- [ ] **Step 3: Verify format and commit (two commits)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check ../specs/24-frontend-phase-5-market-research-design.md ../specs/14-frontend-refactoring-master-plan-design.md || true
```
(If Prettier covers `../specs`, fix with `--write`; otherwise these are outside the frontend Prettier scope — no action.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): mark Phase 5 in progress; confirm Phase 3/4 done"
git add specs/24-frontend-phase-5-market-research-design.md
git commit -m "docs(spec-24): record 5a route/tab-semantics findings + Phase-5 visual-guard decision"
```

---

## Task 7: Final preflight + done-when verification + handoff

**Files:** none (verification only).

- [ ] **Step 1: Full preflight on the branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict).

- [ ] **Step 2: Behavioral parity — `journeys/04` green (spec §8)**

The Playwright run inside Step 1 includes `e2e/journeys/04-market-research-5-components.spec.ts` — the primary behavioral guard that the relocation preserved behavior (login → `/your-ai-team/scout/marketintelligence` → auto-fetch fires; not redirected to `/login`). Confirm it passed. **If it failed**, investigate the move (a missed import rewrite, a wrong route element edit) — a mechanical relocation must not change behavior; fix and re-run. If the cause is unclear after investigation, STOP and report (abort criterion 4).

- [ ] **Step 3: Diff-shape sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-5a-relocate
```
Expected: history-preserving renames (`R`) under `frontend/src/features/market-research/{pages,components}`; small import-line edits in consumer files + `App.tsx`; additive `// HANDOFF` comments on the leaving files (still under `src/components/market-research/`); new feature `README.md`/`index.ts`/`types.ts`; `knip.json`, `docs/TECH_DEBT.md`, `specs/14`, `specs/24` edits. **No** product-code rewrites, **no** route/UI changes, **no** leaving file moved/deleted.

- [ ] **Step 4: Walk the done-when (spec §3 "Done when")**

Confirm each, fixing any gap before declaring done:
1. Market-research renders from `features/market-research/`; `src/pages/MarketResearch.tsx` is gone (Tasks 2–3).
2. The genuine components moved; leaving components remain in `src/components/market-research/`, annotated (Tasks 2, 4).
3. The routed page is wrapped in `<FeatureErrorBoundary>`; routes resolve; **URLs unchanged** (Task 3).
4. The Scout cluster's per-file stay/leave was confirmed by tracing (Task 0 Step 6).
5. TD-FE-14 closed; MR-visual-baseline TD-FE logged (Task 5).
6. `journeys/04` (behavioral E2E) + Vitest + `npm run preflight` green (Steps 1–2) — this **is** the amended §3 "Done when" (visual parity via behavioral E2E + Vitest; **no MR pixel VR**, per the Task 6 §3 + §9 amendment), not a silently-dropped "visual" criterion. One reviewable mechanical diff.
7. Spec 24 + master deltas applied (Task 6).

- [ ] **Step 5: Hand off for review + merge**

Per Spec 24 §10: `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below; **approval depth is the orchestrator's call** — 5a is mechanical, so it may warrant a lighter sign-off). Then the controller runs `npm run preflight` once more and, on green, merges `phase-5a-relocate` → `master`. **5b must not begin until 5a is merged** (5b re-identifies fetch sites in the *moved* file). Flag for the reviewer: the finalized genuine/leaving split (Task 0) and any genuine-helper that had to be surfaced through `index.ts` for an external importer (Task 2 Step 2 / abort criterion 3).

---

## Self-review notes (plan author)

- **Spec coverage:** §3 actions — scaffold (Task 1), move genuine (Task 2), move page + boundary + App.tsx (Task 3), annotate leavers + README stub (Task 4); §3 "Done when" (Task 7 Step 4); §7 leaving table + Scout-cluster tracing (Tasks 0/4); §9 deltas (Task 6); §13 deferred route/Scout confirmations (Task 0). The `analysis`/lead-stream inline tab is **intentionally not separated** in 5a (rides inside `MarketResearchPage.tsx`) per spec §3 note — 5c extracts it.
- **Greenness:** every commit leaves `tsc --noEmit` + `lint` green. Genuine moves repoint all importers in the same commit (Task 2); the page move is its own commit with the App.tsx rewire (Task 3); annotations + knip + deltas are additive (Tasks 4–6).
- **Encoded findings flagged for review:** (a) the spec's tab model diverges from code — `trends` = Scout chat, `analysis` = ScoutLeadStream, only `intelligence` is genuine MR (recorded as a §9 delta, shapes 5c); (b) MR has no VR baseline — Phase-5 visual guard is behavioral E2E + Vitest (TD-FE logged); (c) the Scout cluster stay/leave is import-traced live (Task 0 Step 6), not assumed.
- **TD-FE numbering:** 5a closes TD-FE-14 and logs exactly one new entry (deferred MR visual baseline) at the next free number — read `docs/TECH_DEBT.md` at execution time (do not hard-code).
