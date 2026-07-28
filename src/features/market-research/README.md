# `market-research` feature

## Purpose

The market-research surface: the routed page + the **intelligence** tab (the five research sections — market entry, regulatory & compliance, competitor landscape, industry trends, market size — composed over the company profile + research data layer). Extracted from `src/pages/MarketResearch.tsx` + `src/components/market-research/` (master Spec 14 §4; Spec 24).

## Public surface

Locked in 5i (`index.ts`). Cross-feature consumers import only via `@/features/market-research` (the barrel), never a deep path. Anticipated primary consumer: `signals`.

| Export                      | Kind   | Source                       | Description                                                                                                |
| --------------------------- | ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `marketResearchRoutes`      | routes | `routes.tsx`                 | The feature's route registry array (mounted by `src/app/routes.tsx`), wrapped in `<FeatureErrorBoundary>`. |
| `ResearchComponentResponse` | type   | `contracts.ts`               | The research-component response shape (`{ status, data }`); the data type a cross-feature consumer reads.  |
| `useResearchComponent`      | hook   | `hooks/useMarketResearch.ts` | Results-read hook; fetches and returns a single research component's data.                                 |

## Key files

- `pages/MarketResearchPage.tsx` — routed shell (thin shell + tab router after 5c), wrapped in `<FeatureErrorBoundary>`
- `components/intelligence/IntelligenceTab.tsx` — intelligence tab root; owns `sanitizeIntelligenceProps.ts` (prop normalisation)
- `components/MarketIntelligenceSections.tsx` — composes the five section components
- `components/intelligence/market-entry/MarketEntrySection.tsx` — market-entry section (5d); owns `useMarketEntry.ts`, sub-components, `types.ts`
- `components/intelligence/regulatory-compliance/RegulatoryComplianceSection.tsx` — regulatory & compliance section (5e); owns `useRegulatoryCompliance.ts`, sub-components, `regulatoryHelpers.ts`, `types.ts`
- `components/intelligence/competitor-landscape/CompetitorLandscapeSection.tsx` — competitor landscape section (5g); owns `useCompetitorLandscape.ts`, sub-components, `competitorUiComponents.ts`, `types.ts`
- `components/intelligence/industry-trends/IndustryTrendsSection.tsx` — industry trends section (5f); owns `useIndustryTrends.ts`, sub-components, `industryTrends.ts`, `states.tsx`, `types.ts`
- `components/intelligence/market-size/MarketSizeSection.tsx` — market size section (5h); owns `useMarketSize.ts`, sub-components, `marketSize.ts`, `states.tsx`, `types.ts`
- `components/trends/TrendsTab.tsx` — trends tab shell (5c extract)
- `components/EditHistoryPanel.tsx`, `components/MarketDetailDrawer.tsx`, `components/AIPromptingInterface.tsx` — shared panel/drawer UI used across sections
- `components/MiniLineChart.tsx`, `components/MiniPieChart.tsx` — chart micro-components (relocated)
- `components/ScoutLeadStream.tsx` — lead-stream UI entrypoint (relocated from legacy `components/market-research/`; TD-FE-63)
- `components/lead-stream/LeadStreamTab.tsx`, `LeadsTable.tsx`, `OpportunityDashboard.tsx` — lead-stream tab panels (relocated)
- `lib/leadStreamChatContext.ts` — sole-consumer lead-stream chat context util (relocated from legacy `utils/`; TD-FE-62)
- `lib/leadStreamHeatmapSession.ts`, `lib/marketScoreDescriptions.ts`, `lib/marketScoresHeatmap.ts` — score/heatmap libs + tests (relocated)
- `lib/timestampUtils.ts`, `lib/apiUtils.ts` — single-consumer utilities (relocated from legacy `utils/`)
- `contracts.ts` — Zod schema + `ResearchComponentResponse` type for the backend POST envelope (`{ status, data }`)
- `hooks/useMarketResearch.ts` — `useResearchComponent` hook (public surface); `hooks/useMarketResearchData.ts` — page-level data orchestration (large legacy hook: raw `fetch` + editable-state/cascade + localStorage cache; data-layer migration deferred as tech debt — TD-FE-19, TD-FE-30/31)
- `services/marketResearch.ts` — API call layer (added 5b)
- `types.ts` — feature-local types (`ScoutResearchContext`, etc.)
- `index.ts` — public re-exports (the cross-feature surface)

## Dependency notes

- May import: `@/features/market-research/*` (self), `@/shared/*`, `@/components/ui/*`, npm.
- Legacy `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*` imports have been drained — the feature now imports from `@/shared/*`, `@/components/ui/*`, and same-feature relatives.
- Cross-feature consumers import only via `@/features/market-research` (the index), never a deep path.
