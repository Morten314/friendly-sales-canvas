// Types for the `market-research` feature.
// Feature-local types live here; promote to src/shared/types/ only when a
// second feature imports them (the >=2-feature rule — see src/shared/README.md).

// Mirrors ChatWithScout's ChatWithScoutResearchContext (legacy/leaving) intentionally —
// the feature owns its own type rather than import from a leaving component; structural
// typing lets a ScoutResearchContext value pass into ChatWithScout's researchContext prop
// with no cast. Remove the duplication when ChatWithScout is retired.
export interface ScoutResearchContext {
  leads: { name: string; company: string; jobTitle: string }[];
  opportunity?: string;
  icp?: string;
  reportTraits?: string[];
}
