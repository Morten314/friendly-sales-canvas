import { useMemo } from "react";

import { useRegenerateResearch, useResearchComponent } from "../../../hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "../../../services/marketResearch";

import { parseMarketSizeResult, type MarketSizeResult } from "./types";

export interface UseMarketSize {
  data: MarketSizeResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  regenerate: () => void;
  isRegenerating: boolean;
}

/** Section-data hook for the market-size section. Reads the
 *  "market size & opportunity" component via the 5b TanStack hooks
 *  (memory-only cache) and narrows the data to the section view-model. */
export function useMarketSize(userId: string, orgId: string): UseMarketSize {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketSize, !!orgId);
  const regen = useRegenerateResearch(userId, orgId);
  const data = useMemo(() => parseMarketSizeResult(query.data), [query.data]);
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    regenerate: () => regen.mutate(RESEARCH_COMPONENTS.marketSize),
    isRegenerating: regen.isPending,
  };
}
