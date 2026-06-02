# Frontend Phase 5i — market-research finalize + handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the market-research feature's public surface (`index.ts`), backfill `README.md`, run the in-feature dead-code sweep (`knip --strict` clean), confirm the handoff table is authoritative and `MarketIntelligenceTabProps.ts` is gone, and apply the remaining Spec 24 / master Spec 14 deltas — closing Phase 5.

**Architecture:** A finalize-and-document sub-phase, almost entirely additive/confirmatory. The only behavior-adjacent change is the **optional surface-extraction restructure** (Spec 24 §2.2): if a section buried a research-result/report type in a deeply-private module, lift it so `index.ts` can export the anticipated cross-feature surface (signals/Phase 8) — a no-behavior-change move, gated by the same parity checks. Everything else is `index.ts`/`README.md` writing, a knip sweep, and spec-delta commits.

**Tech Stack:** React 18 + TS (strict), knip `--strict --no-progress`, Vitest + RTL, Playwright behavioral journeys (`journeys/04`), ESLint/Prettier.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §7 (and §2.2, §9, §11 Definition of done, §13).

**Prerequisite (hard):** **5a–5h all merged to `master`** — the page is a thin shell (5c), all five sections are decomposed under `components/intelligence/<section>/` (5d–5h), the data layer is TanStack-only (5b), and `MarketIntelligenceTabProps.ts` was deleted by 5h. Branch off the latest `master` (`git checkout -b phase-5i-finalize`).

**Conventions for every task:** as 24a–24h (npm from `frontend/`; commits from repo root; `type(scope):`, no `Co-Authored-By`/`[N/M]`; per-task `tsc`+`lint` green). **Visual-parity guard remains behavioral E2E `journeys/04` + Vitest/RTL — no MR pixel VR.**

**Abort criteria (whole-branch — halt + report):** (1) any of 5a–5h not merged (Task 0). (2) Task 0 baseline RED before any change. (3) `MarketIntelligenceTabProps.ts` still exists or still has importers (5h didn't complete) — that is 5h's job; STOP and finish 5h, do not delete it here as an afterthought. (4) `knip --strict` surfaces dead code that is actually a missed handoff or a real bug rather than a removable leftover — investigate, don't blindly delete.

---

## Task 0: Branch + baseline + completeness audit

**Files:** none (verification only).

- [ ] **Step 1: Branch off latest `master` (5a–5h merged)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
git checkout -b phase-5i-finalize
```

- [ ] **Step 2: Confirm 5a–5h landed (spec §11)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test -f src/features/market-research/pages/MarketResearchPage.tsx && echo "OK: page (5a/5c)"
test -d src/features/market-research/hooks && echo "OK: hooks (5b)"
test -f src/features/market-research/contracts.ts && echo "OK: contracts (5b)"
for s in market-entry regulatory-compliance competitor-landscape industry-trends market-size; do
  test -d "src/features/market-research/components/intelligence/$s" && echo "OK: $s (5d–5h)" || echo "MISSING: $s"
done
test ! -f src/features/market-research/components/MarketIntelligenceTabProps.ts && echo "OK: MarketIntelligenceTabProps deleted (5h)" || echo "STOP: prop interface still present — finish 5h"
grep -rn 'MarketIntelligenceTabProps' src && echo "STOP: prop interface still imported" || echo "OK: no MarketIntelligenceTabProps importers"
# Informational only here — the hard zero-raw-fetch gate is at phase close (Task 4 Step 3, per spec §11).
# This may legitimately still match useMarketResearchData.ts if 5h *deferred* its slice removal (24h abort-3 fallback) — see Task 4.
grep -rn 'fetch(' src/features/market-research && echo "INFO: raw fetch still present — must be zero by Task 4 (confirm 5h removed, not deferred, its slice)" || echo "OK: no raw fetch in feature"
```
Expected: all OK; the `MarketIntelligenceTabProps` `STOP` grep prints nothing. If any section dir is missing or the prop interface survives, the corresponding sub-phase is incomplete (abort 1/3). The `fetch(` line is **informational** — a non-empty result is not an abort here, but it must reach zero by Task 4 (if it does not, 5h deferred its slice removal and 24i must remove it — see Task 4 Step 3).

- [ ] **Step 3: Green baseline** — `cd frontend && npm run preflight`. RED before any change → STOP (abort 2).

No commit.

---

## Task 1: Define the public surface (`index.ts`)

**Files:**
- Modify: `frontend/src/features/market-research/index.ts` (replace the scaffolder `export {}`)
- Possibly modify (surface-extraction restructure, spec §2.2): a section module that buried a result/report type — lift it so it is exportable, **no behavior change**.

> Spec 24 §2.2, §7. The minimal cross-feature surface other features consume. The **anticipated** consumer is `signals` (Phase 8), which reads market-research *output* — so the likely surface is the research-result/report types + a results-read hook. No in-phase consumer exists, so the surface is locked **here** (informed by Phase 8's needs), deliberately not earlier.

- [ ] **Step 1: Enumerate the candidate public surface**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== result/report types ==="; grep -rn 'export type\|export interface' src/features/market-research/contracts.ts src/features/market-research/types.ts
echo "=== read hooks ==="; grep -rn 'export function use' src/features/market-research/hooks
```
The likely surface: the research-report types from `contracts.ts` (`ResearchComponentResponse`, any report type) + the results-read hook (`useResearchComponent`). Keep it minimal — everything else stays private.

- [ ] **Step 2: Surface-extraction restructure (only if needed)** — if a result/report type a future consumer needs is buried in a deeply-private section module, move it to `contracts.ts`/`types.ts` (or re-export through the section's local index) so `index.ts` can expose it without a deep path. Pure type/identifier move, no runtime change. If nothing is buried, skip.

- [ ] **Step 3: Write `index.ts`**
```ts
// Public surface for the `market-research` feature.
// Cross-feature consumers (signals, Phase 8) import from "@/features/market-research", never a deep path.
export type { ResearchComponentResponse } from "./contracts";
export { useResearchComponent } from "./hooks/useMarketResearch";
```
**`index.ts` exports only what exists now — it is complete at this commit, not a stub with a deferred TODO** (matches spec §7 / Task 4 DoD item 1 "index.ts complete"). Do **not** leave an "add the type signals will consume later" comment in the file: Phase 8 adds its required export when its need is known, via its own change. If a genuinely-anticipated-but-currently-unconsumed export *must* ship now (e.g. to lock the surface), that is the TD-FE path of Step 4 (logged, not a bare TODO), not an open comment. Adjust the exported set to the real surface (do not over-export internals; the dependency-lint forbids deep cross-feature imports, so anything a consumer needs must be here).

- [ ] **Step 4: Green (incl. knip + react-refresh) + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress
```
> knip note: with no in-feature consumer yet, an export with zero importers can flag under `--strict`. The `src/**/*.{ts,tsx}!` entry pattern (knip production mode) treats feature files as used, but an exported symbol that nothing imports may still flag. If `index.ts` re-exports flag as unused, this mirrors the Phase-4 `FeatureErrorBoundary` situation — prefer **not** adding a knip ignore; instead keep `index.ts` to exactly what is needed and, if a genuinely-anticipated-but-unconsumed export must stay, log a TD-FE (next free number) noting it is consumed by Phase 8, rather than editing `knip.json`. Record which path you took.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "feat(fe): define market-research public surface (index.ts)"
```

---

## Task 2: Backfill `README.md`

**Files:**
- Modify: `frontend/src/features/market-research/README.md`

> Spec 24 §7, §11. Purpose, public surface, key files, dependency notes, and the authoritative **Pending handoffs** table (5a seeded a stub; finalize it).

- [ ] **Step 1: Rewrite `README.md`** with: Purpose; **Public surface** (the exact `index.ts` exports from Task 1, with one-line each); **Key files** (`pages/MarketResearchPage.tsx`, `components/intelligence/IntelligenceTab.tsx` + the five `components/intelligence/<section>/`, `components/trends/TrendsTab.tsx`, `hooks/`, `services/`, `contracts.ts`, `types.ts`); **Dependency notes** (self / `@/shared` / `@/components/ui` / npm; transitional legacy imports; cross-feature only via `index.ts`); and the **Pending handoffs** table below.

- [ ] **Step 2: Make the handoff table authoritative (spec §7)** — confirm each leaving component still in `src/components/market-research/` and its target feature, by listing the dir:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
echo "=== still-leaving components ==="; ls -R src/components/market-research
echo "=== each carries a HANDOFF marker ==="; grep -rL 'HANDOFF →' src/components/market-research --include=*.ts --include=*.tsx
```
Expected: only leaving components remain (StrategistWorkspace → strategist; `lead-stream/*` incl. the 5c-extracted `LeadStreamTab` → customers; `EditDropdownMenu` → customers; ScoutChatPanel/ChatWithScout → scout; the `Scout*` config cluster → scout; `AddLeadModal`/`SuggestedCompaniesSection` → scout); every file carries a `HANDOFF →` marker. **`ScoutCapabilities.tsx` is NOT a leaver — it is `// DEAD CODE` (zero importers, deleted in Task 3); do not list it here.** Write the table to match the live dir (the example below is the current authoritative set, confirmed against `README.md` + importer traces; LOC per the §1.2 anchor):

| Component(s) (in `src/components/market-research/`) | Target feature | Claiming phase |
|---|---|---|
| `StrategistWorkspace.tsx` | strategist | per naming map |
| `lead-stream/*` (`LeadsTable`, `leadData`, `OpportunityDashboard`) incl. the 5c-extracted `LeadStreamTab` | customers | 7 |
| `EditDropdownMenu.tsx` (sole importer `customers/SuggestedICPCards`) | customers | 7 |
| `ScoutChatPanel.tsx`, `ChatWithScout.tsx` | scout | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm`, `ScoutDeploymentDetails`, `ScoutLeadStream`) | scout | per naming map |
| `AddLeadModal.tsx`, `SuggestedCompaniesSection.tsx` (sole importer `signals/ScoutChatWithHistory`) | scout | per naming map |

> The dir is **deleted once empty** (≤ Phase 9) — that deletion is the claiming phases' job, not 5i's.

- [ ] **Step 3: Format + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check   # or npx prettier --check src/features/market-research/README.md
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/README.md
git commit -m "docs(fe): backfill market-research README (public surface, key files, handoff table)"
```

---

## Task 3: In-feature dead-code sweep (`knip --strict` clean)

**Files:**
- Possibly delete: dead modules/exports the sweep surfaces inside the feature.

> Spec 24 §7, §11. Two removal duties: (a) the first-time decomposition (5c–5h) may leave orphaned helpers, unused exports, or a stray `Safe*` wrapper inside the feature; and (b) the 8 `// DEAD CODE → delete in 5i` files in the legacy `src/components/market-research/` dir are 5i's to delete (spec §7 done-when: zero `// DEAD CODE` annotations remain). Sweep both — but distinguish a removable leftover / annotated dead file from a missed handoff or a real consumer.

- [ ] **Step 1: Run the strict sweep**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --strict --no-progress
```

- [ ] **Step 2: Triage each finding**
- **Dead leftover** inside `src/features/market-research/` (an export nothing imports, a helper orphaned by decomposition) → delete it; re-run knip.
- **A `// DEAD CODE`-annotated legacy file** in `src/components/market-research/` (zero live importers, no target feature per spec §7) → **delete it.** These are 5i's explicit responsibility: the 8 files annotated `// DEAD CODE → delete in 5i` (currently `CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities` — verify the live set with `grep -rln 'DEAD CODE' src/components/market-research`). Spec §7 done-when requires **zero `// DEAD CODE` annotations remain**. Delete each; re-run knip + the importer grep to confirm nothing referenced them.
- **A leaving component flagged** (in `src/components/market-research/`, carrying a `HANDOFF →` marker — distinct from `DEAD CODE` above) → do **not** delete; it is consumed by the page's transitional render or awaits its claiming phase. If knip flags it as unused, confirm the page/tab still renders it; if genuinely now-unrendered, that is a finding for the claiming phase — note it, don't delete (abort 4).
- **An anticipated-but-unconsumed `index.ts` export** (Task 1) → handle per Task 1 Step 4 (keep minimal; TD-FE if it must stay), not by deleting a real intended surface.

- [ ] **Step 3: Green + commit (only if something was removed)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint && npx tsc --noEmit -p tsconfig.app.json && npx knip --strict --no-progress && npm run test
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "chore(fe): delete market-research dead code (8 legacy DEAD CODE files + knip --strict clean)"
```
(The 8 annotated legacy dead files are always removed here; if the in-feature sweep additionally found nothing, the commit still stands for the legacy deletions. Record knip's final clean state either way.)

---

## Task 4: Spec 24 + master Spec 14 deltas (phase close) + final verification

**Files:**
- Modify: `specs/24-frontend-phase-5-market-research-design.md` (status → done)
- Modify: `specs/14-frontend-refactoring-master-plan-design.md` (§4 status, §9 deltas, §4 Phase 13 note, phase-number reconciliation)

> Spec 24 §9, §11. Apply the master-plan deltas accumulated across 5a–5h that belong at the phase close.

- [ ] **Step 1: Master Spec 14 deltas (spec §9)**
  - §4 status table: **Phase 5 → done** (with date).
  - §9.3 sub-split deviation: record master `5a→5a, 5b→5b, 5c→5c+5d–5h+5i` (the finer split actually used).
  - §9.4 phase-number reconciliation: master §4 (signals 8 · scout 9 · settings 10) vs `features/README.md` naming map (signals 6 · scout 8 · settings 11). Recommend reconciling to one source of truth; until then handoffs reference target features **by name**. If unresolved at this merge, log `TD-FE-<next>` instead.
  - §9.5 Phase 13 boundary: note master §4 Phase 13 **should expect** its market-research pass to narrow to verification + cross-feature dedup + codemod extraction (first-time decomposition done here), assuming 5d–5h quality meets Phase 13's standards (Phase 13's spec re-evaluates).

- [ ] **Step 2: Spec 24 status → done** — mark Spec 24 (and its §2 status amendment) done with date; confirm the §9 notes from 5a/5b/5c are present (route reality, no-analysis-fetches, visual-guard decision, context decision).

- [ ] **Step 3: Full preflight + Phase-level done-when (spec §11)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
# Hard zero-raw-fetch / zero-localStorage-cache gate (spec §11 places it at phase close, not Task 0):
grep -rn 'fetch(' src/features/market-research && echo "STOP: raw fetch remains in feature" || echo "OK: zero raw fetch"
grep -rn 'CACHE_DURATION\|localStorage' src/features/market-research && echo "STOP: cache machinery remains" || echo "OK: no localStorage cache"
```
> **If the `fetch(`/cache grep is non-empty**, 5h *deferred* its `useMarketResearchData()` market-size slice removal to 5i (the 24h abort-3 documented-deferral fallback). 5i must then complete that removal *here* before the gate passes: source the section's display data from `useMarketSize`/5b, drop or migrate the cascade/timestamp/edit-history per spec §6, delete the slice, and re-run the grep. This is the only behavior-bearing work 5i may inherit; if it is more than a slice removal, STOP and escalate (it means 5d–5h left more than one slice — see §9 systemic note).
>
Confirm each (spec §11):
1. `src/features/market-research/` holds page + tab router + decomposed sections + hooks/services + `contracts.ts` + `types.ts` + `README.md` + `index.ts`.
2. `src/pages/MarketResearch.tsx` gone; only `HANDOFF →`-annotated leaving components remain in `src/components/market-research/` — **zero `// DEAD CODE` annotations** (`grep -rn 'DEAD CODE' src/components/market-research` prints nothing; Task 3 deleted all 8).
3. Data layer is TanStack (memory-only); no raw `fetch`/localStorage cache in the feature (the grep gate above is green).
4. Routes resolve to the feature; URLs unchanged.
5. Vitest + RTL coverage for logic-bearing units; `journeys/04` green; `npm run preflight` green.
6. Both ADRs (0003 feature-local contracts; 0004 memory-only cache) merged.
7. Handoff table authoritative; master Spec 14 deltas applied.

- [ ] **Step 4: Commit deltas + handoff**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): mark Phase 5 done; record sub-split, phase-number, and Phase-13 deltas"
git add specs/24-frontend-phase-5-market-research-design.md
git commit -m "docs(spec-24): mark Phase 5 done"
```
Then `/review-impl` → `/synthesize-impl-review` (5i is mechanical/confirmatory — lighter sign-off per §10) → controller preflight → merge `phase-5i-finalize` → `master`. **Phase 5 is done.** Hand the **Pending handoffs** table to Phases 7 (customers — lead-stream incl. its deferred data-layer migration), 8 (signals — consumes the new `index.ts` surface; strategist), and 9 (scout) as their pre-planning input.

---

## Self-review notes (plan author)

- **Spec coverage:** §7 index.ts + README + authoritative handoff table (6 live leaver rows; `ScoutCapabilities` excluded as dead) + dead-code sweep incl. deletion of the 8 `// DEAD CODE` legacy files so zero annotations remain (Tasks 1–3); §2.2 anticipated surface + surface-extraction restructure (Task 1); §9 all deltas incl. phase-number reconciliation + Phase-13 boundary (Task 4); §11 phase Definition-of-done incl. the hard zero-raw-`fetch`/zero-cache gate placed at phase close (Task 4 Step 3, not Task 0); §13 final `index.ts` surface locked here informed by Phase 8.
- **Guards:** `MarketIntelligenceTabProps` deletion is 5h's job — 5i only *confirms* it (abort 3); the knip sweep distinguishes removable leftovers / annotated dead files from `HANDOFF →` leaving components / anticipated surface (abort 4), and avoids `knip.json` edits (prefer minimal surface or a TD-FE). `index.ts` is complete-at-commit (no deferred-TODO comment). The Task 0 `fetch(` grep is informational; the hard gate is Task 4 — and if 5h *deferred* its slice removal, Task 4 Step 3 inherits and completes that one slice removal before the gate passes (escalate if it is more than one slice).
- **Visual guard:** behavioral E2E + Vitest only (no MR pixel VR) — consistent across 5a–5i; the post-Phase-5 MR-VR re-establishment remains the 5a-logged TD-FE.
- **Handoff:** the table is the authoritative input for Phases 7/8/9; the empty-dir deletion (≤ Phase 9) is the claiming phases' job, not 5i's.
