// Public surface for the `connectors` feature (Apollo discovery + lead source).
// Cross-feature consumers import from "@/features/connectors", never a deep path.
export { ApolloTile } from "./components/ApolloTile";
export { useApolloUnlockToast } from "./hooks/useApolloUnlockToast";
export {
  LEAD_SOURCE_OPTIONS,
  filterLeadsBySource,
  normalizeLeadSource,
  type LeadSource,
  type LeadSourceFilter,
} from "./lib/leadSource";
export { UnverifiedBadge } from "./components/UnverifiedBadge";
export { LeadSourceBadge } from "./components/LeadSourceBadge";
