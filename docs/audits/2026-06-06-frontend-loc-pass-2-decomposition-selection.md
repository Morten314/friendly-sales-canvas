# Frontend Phase 13 — Decomposition Selection (Stage SELECT)

**Date:** 2026-06-06
**Inputs:** the 13a scorecard (`docs/audits/2026-06-06-frontend-loc-pass-2.md`, merged to master at `a61b332`) and the post-dedup file ranking.
**Resolves:** Spec 32 §12 Q1 (which monster files to decompose). This is the authority the decomposition sub-phases (13b…13N) consume.

---

## Post-dedup ranking (top 15, `src/` excl. `components/ui/`)

```
6034  src/features/market-research/hooks/useMarketResearchData.ts
3497  src/features/mission-control/components/data-sources/DataSourcesManager.tsx
3048  src/features/mission-control/components/company-profile/ConnectorApprovals.tsx
──────────────────────────  ← natural cliff (~2,000 LOC gap)
1078  src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
1000  src/features/market-research/components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx
 981  src/features/market-research/components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx
 960  src/features/strategist/components/StrategistWorkspace.tsx
 952  src/features/mission-control/components/icp/IcpWizard.tsx
 899  src/features/market-research/components/intelligence/market-size/MarketSizeSection.tsx
 837  src/features/signals/pages/SignalsPage.tsx
 829  src/features/market-research/pages/MarketResearchPage.tsx
 797  src/features/shell/components/Sidebar.tsx
 773  src/features/market-research/components/lead-stream/LeadsTable.tsx
 682  src/features/market-research/components/scout-chat/ScoutChatPanel.tsx
 681  src/features/customers/components/lead-stream/LeadStream.tsx
```

## Cut rationale (Spec 32 §5.1 — LOC primary, similarity-hit count secondary, complexity a qualitative flag)

The ranking has one decisive cliff: the top 3 files are all **>3,000 LOC**, then there is a **~2,000-LOC gap** down to a dense cluster of healthy ~1,000-LOC files (1078, 1000, 981, 960, 952, 899 …). LOC is the primary ranking signal and the cliff is unambiguous, so the decomposition set is **exactly the three files above the cliff**.

**The set is NOT extended into the ~1,000-LOC tier.** Those files are within a normal size band; extending would balloon the phase into 10+ sub-phases for diminishing returns and is out of proportion to the §5 goal (cut the *monster* files). If a future pass wants to address the ~1,000-LOC tier it can be scoped separately. All three selected files also carry repeated-block density (inline-scan groups landed in each of them in 13a-iv), reinforcing the LOC signal.

This is **behavior-preserving structural splitting only** (Spec 32 §5.2): move cohesive chunks into sibling sub-modules/sub-components/sub-hooks; no logic changes, no fetch rewrites; the public surface (export / route entry) is unchanged. The workstream is LOC-neutral overall (LOC is redistributed; the win is per-file size, not net LOC).

---

## Selected decomposition set (ordered)

Sequenced **lowest-risk first** to establish the behavior-preserving extraction pattern before the most delicate file; the 6,034-LOC hook is sequenced **last** and flagged defer-if-unsafe per Spec 32 §5.3.

### 13b — `DataSourcesManager.tsx` (3,497 LOC) — **risk: LOW–MEDIUM**
- **Shape:** one monolithic `const DataSourcesManager: React.FC` (~35 hook calls). No sub-components extracted yet.
- **Why split:** largest pure-UI component; the data-sources management surface.
- **Seam direction (indicative — final seams mapped in the sub-phase):** the connector-list table → `components/data-sources/ConnectorTable.tsx`; the upload dialog → `UploadDialog.tsx`; the per-source status reducer/helpers → `dataSourceStatus.ts`; the repeated connector-construction blocks (8 variants, kept in 13a-iv) → a connector factory/helper. Inline groups #14 (debug logs) / #15 (URL-reload diffing) live here (kept in 13a-iv) and may be tidied opportunistically.
- **Risk note:** pure component → behavior-preserving JSX-subtree extraction. **VR-sensitive** — preserve emitted markup exactly (component-level ~0% drift).

### 13c — `ConnectorApprovals.tsx` (3,048 LOC) — **risk: MEDIUM**
- **Shape:** one monolithic component with the **highest state complexity in the tree (~64 hook calls)**. Multiple connector-type sections + the Google-Analytics auth-modal flow.
- **Why split:** second-largest UI component; a tangle of per-connector-type approval logic + modal state.
- **Seam direction (indicative):** per-connector-type approval sections → sub-components; the GA auth-modal flow → its own component/hook (the `resetGoogleAnalyticsAuthModal` helper extracted in 13a-iv is an early seam); the 8 connector-construction variants → a factory.
- **Risk note:** very stateful (64 hooks) → extracted units must take clean prop/arg interfaces with no shared mutable closure that breaks on extraction. VR-sensitive.

### 13d — `useMarketResearchData.ts` (6,034 LOC) — **risk: HIGH — sequence LAST, may DEFER**
- **Shape:** one giant `export function useMarketResearchData(activeTabRef)` (~108 hook calls; cache management, fresh-data/validation tracking, loading-phase tracking, per-component data fetch, editable state). Returns a large object at the bottom.
- **Why split:** by far the largest file in the tree.
- **Constraint:** pervasive **editable-state ↔ `useQuery` coupling (TD-FE-19/21)**. Attempt **structural sub-hook/module splits only** (cohesive slices — e.g. cache, validation/fresh-data tracking, loading-phase tracking) that leave that coupling untouched. **No data-layer rewrite.**
- **Defer flag (Spec 32 §5.3 / plan Task J Step 6):** if no behavior-safe structural seam exists, **defer the file** — log a new `TD-FE` entry ("useMarketResearchData decomposition deferred — no behavior-safe structural seam; data-layer coupling must be resolved first"), revert the branch, and record the deferral in the final scorecard handoff. **Do not force.**

---

## Execution model (per Spec 32 §5.3 / §7 / §8)

- Each selected file is **its own branch** off `master` (`phase-13b-data-sources-manager`, `phase-13c-connector-approvals`, `phase-13d-use-market-research-data`), **its own merge** with full `npm run preflight` as the merge gate + operator approval.
- Sub-phases run **serially** (Phase 13 is solo). Decomposition is behavior-preserving; the §8 advisory (`npm run test` + `npm run test:e2e`, component-level ~0% VR drift) runs before each sub-phase's final commit.
- Each extraction is **one chunk per commit** (`npm run verify` proves the interface holds after each), repeated until the parent is a thin orchestrator; add focused seam tests where coverage is thin.

## Open decision for the operator
Approve this set + ordering before any decomposition branch is cut (Spec 32 SELECT checkpoint). Options the operator may adjust: include/exclude `useMarketResearchData` (13d) given its HIGH risk + defer-likelihood; extend into the ~1,000-LOC tier (not recommended); or re-order.
