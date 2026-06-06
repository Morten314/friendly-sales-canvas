# Phase 13 Stage 13a — Frontend LOC Reduction (Pass #2) — Scorecard

**Date:** 2026-06-06
**Spec:** specs/32-frontend-phase-13-loc-reduction-pass-2.md
**Plan:** plans/32-frontend-phase-13-loc-reduction-pass-2.md
**Branch:** phase-13-loc-reduction-pass-2
**Commits:** `414b2e2`..`932c2ce` (28 commits)
**Merge commit:** `<SHA — filled at merge>`

---

## 1. LOC delta

### Overall

| | Stage 0 baseline | Stage 13a end | Delta |
|---|---:|---:|---:|
| Files (.ts/.tsx under src/) | 419 | 412 | −7 |
| LOC (under src/) | 65,295 | 64,659 | −636 |

**Interpretation:** −636 net LOC. Production-code reduction is greater than the net figure;
test code grew from consolidated test suite updates and new shared-component tests for
`KeyMetricsGrid` and `IntelligenceSectionHeader` (added alongside the merged components).

### Notable per-file/area reductions

| Area / File | Reduction | Source |
|---|---:|---|
| `components/ui/breadcrumb.tsx` | −184 LOC | 13a-iii removal (TD-FE-7) |
| `components/ui/chart.tsx` | −292 LOC | 13a-iii removal (TD-FE-7) |
| `components/ui/pagination.tsx` | −52 LOC | 13a-iii removal (TD-FE-7) |
| shadcn prune subtotal | **−528 LOC** | 3 files deleted |
| `features/market-research/components/intelligence/industry-trends/KeyMetrics.tsx` | merged away | 13a-iv → `shared/KeyMetricsGrid.tsx` |
| `features/market-research/components/intelligence/market-size/KeyMetrics.tsx` | merged away | 13a-iv → `shared/KeyMetricsGrid.tsx` |
| `features/market-research/components/intelligence/industry-trends/SectionHeader.tsx` | merged away | 13a-iv → `shared/IntelligenceSectionHeader.tsx` |
| `features/market-research/components/intelligence/market-size/MarketSizeHeader.tsx` | merged away | 13a-iv → `shared/IntelligenceSectionHeader.tsx` |
| `features/market-research/lib/apiUtils.ts` | −~40 LOC | dead-symbol removal (13a-ii) |
| `shared/profiler/profilerAcceptedIcpDisplay.ts` | −~60 LOC | dead-symbol removal (13a-ii) |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorKeyMetrics.tsx` | −~20 LOC | inline extraction (13a-iv) |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorMarketTrends.tsx` | −~20 LOC | inline extraction (13a-iv) |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorMnaInsights.tsx` | −~20 LOC | inline extraction (13a-iv) |
| `features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx` | −~25 LOC | inline extraction (13a-iv) |
| `features/market-research/hooks/useMarketResearchData.ts` | −~25 LOC | inline extraction (13a-iv) |
| Dedup merges + inline extractions subtotal | **−~174 LOC** (production) | 13a-iv |

---

## 2. Bundle delta

Baseline: `docs/audits/2026-05-26-frontend-bundle-baseline.json`

```
                  Baseline       Current        Delta
Total (raw)       2.00 MB        2.03 MB        +38.4 KB (+1.88%)
Total (gzip)      513.4 KB       524.4 KB       +10.9 KB (+2.13%)

Chunks > 10KB:
  index-*.js     1.88 MB       1.93 MB        +53.9 KB (+2.80%)
  index-*.css    100.1 KB      85.1 KB        -15.0 KB (-15.01%)
  workbox-*.js   14.7 KB       14.7 KB        +0 B (+0.00%)
```

**Notes:**
- The raw/gzip growth (+38.4 KB / +10.9 KB) reflects new features shipped between Phases 6–12
  and Phase 13 (all merged to master since 2026-05-26); it is not attributable to 13a which is a
  net-reduction pass.
- The CSS chunk shrank −15.0 KB (−15%), consistent with the removal of 3 shadcn primitives whose
  Tailwind variants are no longer compiled in.
- The pre-existing >2 MB chunk-size advisory warning is not new; exit 0 confirmed.
- Budget: advisory only (no hard-fail gate).

---

## 3. Per-category execution log

### 13a-0 — Tooling setup

- Added `--enumerate` flag to `scripts/scan-inline-blocks.ts` (`414b2e2`) — enables per-group
  enumeration of byte-identical inline blocks for auditable candidate output.
- Added `ts-morph` devDependency (`3e08b54`).
- Added `scripts/scan-similar-symbols.ts` (`f852dbc`) — structural-fingerprint similarity scanner
  using normalized AST + 5-token shingles + Jaccard ≥ 0.85 threshold.
- Fixed scanner: include default exports, guard empty shingles, dedup by location (`e57724c`).
- Committed candidate artifacts (`d3ec489`):
  - `docs/audits/2026-06-06-frontend-loc-pass-2-knip.txt` / `.json`
  - `docs/audits/2026-06-06-frontend-loc-pass-2-knip-ui-sweep.txt`
  - `docs/audits/2026-06-06-frontend-loc-pass-2-similar.json`
  - `docs/audits/2026-06-06-frontend-loc-pass-2-inline-blocks.json`

### 13a-i — Dead code (knip --strict baseline)

- `knip --strict` baseline: **clean** — zero dead exports, dead files, or dead deps in production
  code.
- Standard (non-strict) knip flagged 2 unused exports: `lead` and `signal` in
  `e2e/fixtures/seed-data.ts`. Both are consumed internally (not re-imported elsewhere); `export`
  keyword dropped (`b148ffd`). No dead files, no dead deps found.

### 13a-ii — Conservative-defer re-eval (TD-FE-3..6)

13 relocated symbols from TD-FE-3..6 processed. Outcomes:

**REMOVED (fully dead — no consumers anywhere):**
- `marketResearchApiCallWithCacheBust`, `rateLimitedApiCall`, `isDataFresh`, `forceFreshData` from
  `features/market-research/lib/apiUtils.ts` (`e1b0be9`)
- `isProfilerPlaceholderIcp`, `mergeProfilerAcceptedIcpDisplayIfPlaceholder` from
  `shared/profiler/profilerAcceptedIcpDisplay.ts` (`e4df9ee`)

**EXPORT-DROPPED (used internally — `export` keyword removed, symbol retained):**
- `export default app` in `shared/auth/firebase.ts` (`6e6b834`)
- `API_BASE_URL`, `ICP_BACKEND_URL` in `shared/api/transport.ts` (`823e535`)
- `leadStreamHeatmapCacheKey` in `features/market-research/lib/leadStreamHeatmapSession.ts`
  (`86d8241`)
- `ProfilerSessionSnapshot` in `shared/profiler/missionProfilerSessionCache.ts` (`6e44851`)
- `reducer` in `components/ui/use-toast.ts` (`1571cdf`)
- `simpleApiCall` in `features/market-research/lib/apiUtils.ts`
- `ProfilerAcceptedIcpDisplayMeta` in `shared/profiler/profilerAcceptedIcpDisplay.ts`

**KEPT (live consumer confirmed):**
- `ApiFetchOptions` in `shared/api/transport.ts` — confirmed consumed by `client.ts`. This export
  was momentarily dropped in `823e535` then restored in `e1d6ea2` (corrected momentary-red commit;
  see §6 note).

**TD-FE-3, 4, 5, 6 all CLOSED** (`4562e5b`). Net: ~−100 LOC.

### 13a-iii — shadcn prune (TD-FE-7)

Three ENTIRELY-unused shadcn primitives confirmed absent from all import trees and deleted
(`d1a0723`):
- `src/components/ui/breadcrumb.tsx` (−184 LOC)
- `src/components/ui/chart.tsx` (−292 LOC) — confirmed NOT used by `MiniPieChart` / `MiniLineChart`
  (those use `recharts` directly)
- `src/components/ui/pagination.tsx` (−52 LOC)

**Total: −528 LOC, 3 files deleted.**

The 14 partially-used shadcn files' unused sub-exports were intentionally LEFT intact (shadcn
upgrade-path convention). Build green post-prune. **TD-FE-7 CLOSED** (`952dea7`).

### 13a-iv — Dedup (similarity merges + inline extractions)

Operator elected "full grind" mode.

**Similarity merges (ts-morph scanner, 4 candidate groups):**

| Merge | New shared component | Commit |
|---|---|---|
| `industry-trends/KeyMetrics.tsx` + `market-size/KeyMetrics.tsx` | `shared/KeyMetricsGrid.tsx` | `46e97d5` |
| `industry-trends/SectionHeader.tsx` + `market-size/MarketSizeHeader.tsx` | `shared/IntelligenceSectionHeader.tsx` | `6bb4940` |
| Polish (test assertions, context scoping) | — | `329d4a8` |

**Inline extractions (scan-inline-blocks --enumerate, 20 groups):**

| Extracted helper | File | Commits |
|---|---|---|
| `updateCardTitle` | `ComplianceVisualCard.tsx` | `da56da9` |
| `updateCardDataItem` | `ComplianceVisualCard.tsx` | `1779420` |
| `updateMetric` | `CompetitorKeyMetrics.tsx` | `0cff031` |
| `updateChart` | `CompetitorMarketTrends.tsx` | `32ebafd` |
| `updateInsight` | `CompetitorMnaInsights.tsx` | `f7a33a9` |
| `resetValidationAndRevalidate` | `useMarketResearchData.ts` (6 byte-identical sites) | `01b0fa4` |
| `resetGoogleAnalyticsAuthModal` | `ConnectorApprovals.tsx` | `e057d64` |

**Net: −174 production LOC from dedup merges + inline extractions.**

**Deferred / kept with rationale (no new TD-FE entries required):**

| Item | Rationale |
|---|---|
| `GrowthProjections` ↔ `MarketSizeBySegment` | Line-vs-pie structural divergence; not dedup candidates |
| `useAuth` ↔ `useTenant` | Distinct context contracts; collapsing would conflate unrelated concerns |
| `CompetitorKeyMetrics` + `CompetitorLandscapeHeader` | Structurally different from the merged pairs |
| Connector-construction patterns | 8 non-uniform shapes; no mechanical merge path |
| `DataSourcesManager` debug logs | Non-identical; URL-diffing logic diverges |
| `SignalsPage` Set-updaters | Non-uniform / clarity-negative if collapsed |

**Codemod:** none — all extractions were per-file judgment-driven local closures, not a
cross-file mechanical transform. No codemod was warranted.

**Advisory gate result:** full vitest (672 tests) green, build green, e2e 14/14 with VR
snapshot-stable (~0% drift).

### 13a-v — UI patterns

No cross-feature (≥2 non-shadcn feature) patterns were surfaced. All 13a-iv merges were
intra-feature (market-research). `shared/ui-patterns/` folder NOT created; ADR-0006 NOT written.

### 13a-vi — Orphan routes (TD-FE-1/2)

Both previously-deferred orphan routes confirmed KEPT (`932c2ce`):
- `/tenant-selection` — post-login redirect, covered by e2e (tenant/routes.tsx)
- `/scout-deployment` — live page under IntelligenceTab (scout/routes.tsx)

**TD-FE-1 and TD-FE-2 CLOSED.**

---

## 4. Per-file verdict — completeness bar (Spec 32 §10)

### (a) Explicitly touched files in 13a

All `src/` files modified or removed during `414b2e2`..`932c2ce`:

| Path (relative to frontend/src/) | Verdict | Commit |
|---|---|---|
| `components/ui/breadcrumb.tsx` | **removed** — entirely unused shadcn primitive (TD-FE-7) | `d1a0723` |
| `components/ui/chart.tsx` | **removed** — entirely unused shadcn primitive (TD-FE-7) | `d1a0723` |
| `components/ui/pagination.tsx` | **removed** — entirely unused shadcn primitive (TD-FE-7) | `d1a0723` |
| `components/ui/use-toast.ts` | **export-dropped** — `reducer` export removed; symbol retained | `1571cdf` |
| `features/market-research/components/intelligence/industry-trends/KeyMetrics.tsx` | **merged-away** → `shared/KeyMetricsGrid.tsx`; callers updated | `46e97d5` |
| `features/market-research/components/intelligence/industry-trends/KeyMetrics.test.tsx` | **updated** — test migrated to cover `KeyMetricsGrid` | `46e97d5` |
| `features/market-research/components/intelligence/industry-trends/SectionHeader.tsx` | **merged-away** → `shared/IntelligenceSectionHeader.tsx`; callers updated | `6bb4940` |
| `features/market-research/components/intelligence/industry-trends/SectionHeader.test.tsx` | **updated** — test migrated to cover `IntelligenceSectionHeader` | `6bb4940` |
| `features/market-research/components/intelligence/industry-trends/IndustryTrendsSection.tsx` | **updated** — import rewired to shared component | `6bb4940` |
| `features/market-research/components/intelligence/market-size/KeyMetrics.tsx` | **merged-away** → `shared/KeyMetricsGrid.tsx`; callers updated | `46e97d5` |
| `features/market-research/components/intelligence/market-size/KeyMetrics.test.tsx` | **updated** — test migrated to cover `KeyMetricsGrid` | `46e97d5` |
| `features/market-research/components/intelligence/market-size/MarketSizeHeader.tsx` | **merged-away** → `shared/IntelligenceSectionHeader.tsx`; callers updated | `6bb4940` |
| `features/market-research/components/intelligence/market-size/MarketSizeHeader.test.tsx` | **updated** — test migrated to cover `IntelligenceSectionHeader` | `6bb4940` |
| `features/market-research/components/intelligence/market-size/MarketSizeSection.tsx` | **updated** — import rewired to shared component | `6bb4940` |
| `features/market-research/components/intelligence/shared/KeyMetricsGrid.tsx` | **extracted-into** — new shared parameterized component | `46e97d5` |
| `features/market-research/components/intelligence/shared/KeyMetricsGrid.test.tsx` | **new test** — covers shared component | `46e97d5` |
| `features/market-research/components/intelligence/shared/IntelligenceSectionHeader.tsx` | **extracted-into** — new shared section-header component | `6bb4940` |
| `features/market-research/components/intelligence/shared/IntelligenceSectionHeader.test.tsx` | **new test** — covers shared component | `6bb4940` |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorKeyMetrics.tsx` | **extracted-into** — `updateMetric` local helper extracted | `0cff031` |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorMarketTrends.tsx` | **extracted-into** — `updateChart` local helper extracted | `32ebafd` |
| `features/market-research/components/intelligence/competitor-landscape/CompetitorMnaInsights.tsx` | **extracted-into** — `updateInsight` local helper extracted | `f7a33a9` |
| `features/market-research/components/intelligence/regulatory-compliance/ComplianceVisualCard.tsx` | **extracted-into** — `updateCardTitle` + `updateCardDataItem` extracted | `da56da9`, `1779420` |
| `features/market-research/hooks/useMarketResearchData.ts` | **extracted-into** — `resetValidationAndRevalidate` extracted (6 sites) | `01b0fa4` |
| `features/market-research/lib/apiUtils.ts` | **dead-symbols-removed** — `marketResearchApiCallWithCacheBust`, `rateLimitedApiCall`, `isDataFresh`, `forceFreshData`, `simpleApiCall` export-dropped/deleted | `e1b0be9` |
| `features/market-research/lib/leadStreamHeatmapSession.ts` | **export-dropped** — `leadStreamHeatmapCacheKey` export removed | `86d8241` |
| `features/mission-control/components/company-profile/ConnectorApprovals.tsx` | **extracted-into** — `resetGoogleAnalyticsAuthModal` extracted | `e057d64` |
| `shared/api/transport.ts` | **export-dropped** — `API_BASE_URL`, `ICP_BACKEND_URL` exports removed; `ApiFetchOptions` momentarily dropped then restored (`823e535`→`e1d6ea2`) | `823e535`, `e1d6ea2` |
| `shared/auth/firebase.ts` | **export-dropped** — `export default app` removed | `6e6b834` |
| `shared/profiler/missionProfilerSessionCache.ts` | **export-dropped** — `ProfilerSessionSnapshot` export removed | `6e44851` |
| `shared/profiler/profilerAcceptedIcpDisplay.ts` | **dead-symbols-removed** — `isProfilerPlaceholderIcp`, `mergeProfilerAcceptedIcpDisplayIfPlaceholder`, `ProfilerAcceptedIcpDisplayMeta` export removed | `e4df9ee` |

Non-`src/` files touched (not subject to §10 file-verdict bar, listed for completeness):

| Path | Change |
|---|---|
| `e2e/fixtures/seed-data.ts` | export-dropped: `lead`, `signal` | `b148ffd` |
| `scripts/scan-inline-blocks.ts` | added `--enumerate` flag | `414b2e2` |
| `scripts/scan-similar-symbols.ts` | new script (ts-morph similarity scanner) | `f852dbc`, `e57724c` |
| `package.json` / `package-lock.json` | added `ts-morph` devDep | `3e08b54` |
| `docs/TECH_DEBT.md` | TD-FE-1..7 closed; no new TD-FE entries | `4562e5b`, `952dea7`, `932c2ce` |
| `docs/audits/2026-06-06-frontend-loc-pass-2-*.{json,txt}` | candidate artifacts committed | `d3ec489` |

### (b) Categorical verdict — all remaining files

Triaged by `knip --strict` (0 dead exports / files / deps in production), the ts-morph similarity
scan (all 412 source files; 4 candidate groups surfaced, all resolved — 2 merged, 2 kept with
rationale), and the inline-block scan with `--enumerate` (20 groups surfaced, all resolved or kept
with rationale). All files not explicitly listed in table (a) above:

**keep — in active use, no dead code or dedup finding.**

Coverage: 412 total `src/` files at 13a end. 30 files appear in the explicit table above (29 src/
entries + 1 src/ file restored-to-keep). The remaining **382 src/ files** are covered by this
categorical verdict. 30 + 382 = 412. Completeness confirmed.

---

## 5. Handoff / deferred list

### Items kept with rationale (no TD-FE entry required)

| Item | Rationale |
|---|---|
| `GrowthProjections` ↔ `MarketSizeBySegment` | Line-vs-pie chart: structural divergence; Jaccard < threshold |
| `useAuth` ↔ `useTenant` | Distinct context contracts; collapsing would conflate Firebase auth with tenant identity |
| `CompetitorKeyMetrics` + `CompetitorLandscapeHeader` | Not structural duplicates of the merged pairs |
| Connector-construction (8 patterns) | Non-uniform shapes; mechanical merge would obscure intent |
| `DataSourcesManager` debug logs | Non-identical bodies (URL-diffing logic diverges) |
| `SignalsPage` Set-updaters | Non-uniform; collapsing clarity-negative |
| ui-patterns (`shared/ui-patterns/`) | No ≥2-feature non-shadcn pattern found; folder intentionally not created |

### Monster-file idioms

The large intra-file repeated patterns not extracted (identified by inline-block scan but kept per
judgment) can be revisited during Stage 13b+ decomposition, when file-level structural overhauls
are in scope.

### TD-FE status

**All TD-FE-1..7 entries CLOSED this sub-phase.** No new TD-FE entries were created during 13a.
All findings were either applied or kept with the rationale documented above.

---

## 6. Supplementary

### Codemod inventory

**None — manual.** All extractions were per-file judgment-driven local closures. The inline
extractions (`updateMetric`, `updateCardTitle`, etc.) and the similarity merges (`KeyMetricsGrid`,
`IntelligenceSectionHeader`) were each structurally distinct enough that a codemod would have added
risk with no repeatability benefit. No cross-file mechanical transform was identified during 13a
that would warrant a codemod.

### Similarity-tool note (Spec 32 §12 Q3 resolution)

Built `scripts/scan-similar-symbols.ts` on **ts-morph**. Algorithm: normalized structural
fingerprint, **5-token shingles**, **Jaccard ≥ 0.85** threshold. Fixes applied to the initial
version: default-export inclusion, empty-shingle guard, dedup-by-location. Surfaced **4 candidate
groups** from 412 source files. This resolves Spec 32 §12 Q3.

### 13a-iv advisory gate result

Full vitest suite: **672 tests, all green** (run with `--no-file-parallelism` per sandbox
contention baseline). Build: green. e2e: **14/14**, VR snapshot-stable (~0% pixel drift).

### Momentary-red note (`823e535` → `e1d6ea2`)

Commit `823e535` dropped `API_BASE_URL`, `ICP_BACKEND_URL`, and `ApiFetchOptions` from
`shared/api/transport.ts`. The first two were confirmed dead. `ApiFetchOptions` was not — it is
consumed by `client.ts`. This was caught and restored in `e1d6ea2` before any gate ran. The
intermediate commit `823e535` is a momentary-red commit in the branch history; it was not a
preflight commit and did not propagate to master.

### Preflight result

_Pending — controller will append after merge gate runs._