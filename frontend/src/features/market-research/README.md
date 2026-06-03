# `market-research` feature

## Purpose

The market-research surface: the routed page + the **intelligence** tab (the five research sections — market entry, regulatory & compliance, competitor landscape, industry trends, market size — composed over the company profile + research data layer). Extracted from `src/pages/MarketResearch.tsx` + `src/components/market-research/` in Phase 5 (master Spec 14 §4; Spec 24).

## Public surface

Locked in 5i (`index.ts`). Cross-feature consumers import only via `@/features/market-research` (the barrel), never a deep path. Anticipated primary consumer: `signals` (Phase 8).

| Export                      | Kind | Source                       | Description                                                                                               |
| --------------------------- | ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ResearchComponentResponse` | type | `contracts.ts`               | The research-component response shape (`{ status, data }`); the data type a cross-feature consumer reads. |
| `useResearchComponent`      | hook | `hooks/useMarketResearch.ts` | Results-read hook; fetches and returns a single research component's data.                                |

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
- `contracts.ts` — Zod schema + `ResearchComponentResponse` type for the backend POST envelope (`{ status, data }`)
- `hooks/useMarketResearch.ts` — `useResearchComponent` hook (public surface); `hooks/useMarketResearchData.ts` — page-level data orchestration (large legacy hook: raw `fetch` + editable-state/cascade + localStorage cache; data-layer migration deferred as tech debt — TD-FE-19, TD-FE-30/31)
- `services/marketResearch.ts` — API call layer (added 5b)
- `types.ts` — feature-local types (`ScoutResearchContext`, etc.)
- `index.ts` — public re-exports (the cross-feature surface)

## Dependency notes

- May import: `@/features/market-research/*` (self), `@/shared/*`, `@/components/ui/*`, npm. Transitional (Phases 4b–12): `@/components/*` (incl. the leaving components below + the shared `@/components/market-research/types` `EditRecord` surface), `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`.
- Cross-feature consumers import only via `@/features/market-research` (the index), never a deep path.

## Pending handoffs (leaving components — stay in `src/components/market-research/`, Spec 24 §7)

These belong to **other** features and are NOT part of market-research. They stay annotated (`// HANDOFF → <feature>`) in place; the owning phase relocates + decomposes each.

| Component(s) (in `src/components/market-research/`)                                                       | Target feature | Claiming phase |
| --------------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| `StrategistWorkspace.tsx`                                                                                 | strategist     | per naming map |
| `lead-stream/*` (`LeadsTable`, `leadData`, `OpportunityDashboard`) incl. the 5c-extracted `LeadStreamTab` | customers      | 7              |
| `EditDropdownMenu.tsx` (sole importer `customers/SuggestedICPCards`)                                      | customers      | 7              |
| `ScoutChatPanel.tsx`, `ChatWithScout.tsx`                                                                 | scout          | per naming map |
| `Scout*` config cluster (`ScoutSettingsForm`, `ScoutDeploymentDetails`, `ScoutLeadStream`)                | scout          | per naming map |
| `AddLeadModal.tsx`, `SuggestedCompaniesSection.tsx` (sole importer `signals/ScoutChatWithHistory`)        | scout          | per naming map |

The `src/components/market-research/` dir is deleted once empty (≤ Phase 9) — that deletion is the claiming phases' job, not 5i's.

`types.ts` (the legacy `src/components/market-research/types.ts`, `EditRecord` et al.) is shared by these moved sections **and** `signals`, so it stays in legacy; the feature imports it transitionally. Promotion to `@/shared/` is Phase 11.
