# `market-research` feature

## Purpose

The market-research surface: the routed page + the **intelligence** tab (the five research sections — market entry, regulatory & compliance, competitor landscape, industry trends, market size — composed over the company profile + research data layer). Extracted from `src/pages/MarketResearch.tsx` + `src/components/market-research/` in Phase 5 (master Spec 14 §4; Spec 24).

## Public surface

_Locked in 5i (`index.ts`). Anticipated: research-result/report types + a results-read hook consumed by `signals` (Phase 8). Not finalized while internals are still moving._

## Key files

- `pages/MarketResearchPage.tsx` — routed shell (thin shell + tab router after 5c), wrapped in `<FeatureErrorBoundary>`
- `components/` — the intelligence composition layer (`SafeMarketIntelligenceTab` → `MarketIntelligenceTab` → `MarketIntelligenceSections`) + the five sections (decomposed in 5d–5h) + `EditHistoryPanel`, `MarketDetailDrawer`, `AIPromptingInterface`
- `index.ts` — public re-exports (the cross-feature surface) · `types.ts` — feature-local types
- `contracts.ts`, `hooks/`, `services/` — added in 5b (data layer)

## Dependency notes

- May import: `@/features/market-research/*` (self), `@/shared/*`, `@/components/ui/*`, npm. Transitional (Phases 4b–12): `@/components/*` (incl. the leaving components below + the shared `@/components/market-research/types` `EditRecord` surface), `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`.
- Cross-feature consumers import only via `@/features/market-research` (the index), never a deep path.

## Pending handoffs (leaving components — stay in `src/components/market-research/`, Spec 24 §7)

These belong to **other** features and are NOT part of market-research. They stay annotated (`// HANDOFF → <feature>`) in place; the owning phase relocates + decomposes each. The dir is deleted once empty (≤ Phase 9). Inventory confirmed by 5a import-trace.

| Component(s)                                                                                                  | Target feature | Claiming phase |
| ------------------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| `StrategistWorkspace.tsx`                                                                                     | strategist     | per naming map |
| `lead-stream/*` (`LeadsTable`, `leadData`, `OpportunityDashboard`) + the `analysis`-tab code 5c extracts here | customers      | 7              |
| `EditDropdownMenu.tsx` (used by `customers/SuggestedICPCards`)                                                | customers      | 7              |
| `ScoutChatPanel.tsx`, `ChatWithScout.tsx`                                                                     | scout          | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm`, `ScoutDeploymentDetails`, `ScoutLeadStream`)                    | scout          | per naming map |
| `AddLeadModal.tsx`, `SuggestedCompaniesSection.tsx` (used by `signals/ScoutChatWithHistory`)                  | scout          | per naming map |

`types.ts` (the legacy `src/components/market-research/types.ts`, `EditRecord` et al.) is shared by these moved sections **and** `signals`, so it stays in legacy; the feature imports it transitionally. Promotion to `@/shared/` is Phase 11.

## Dead code (no live importer — deleted in 5i, Spec 24 §7 sweep)

Annotated `// DEAD CODE → delete in 5i` in place, not moved: `CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities` (TD-FE logged in 5a).
