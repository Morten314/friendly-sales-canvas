// Public surface for the `market-research` feature.
// Cross-feature consumers (signals) import from "@/features/market-research", never a deep path.
export type { ResearchComponentResponse } from "./contracts";
export { useResearchComponent } from "./hooks/useMarketResearch";
export { marketResearchRoutes } from "./routes";
