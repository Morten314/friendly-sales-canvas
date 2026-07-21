import { useMemo } from "react";

import { useRegenerateResearch, useResearchComponent } from "../../../hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "../../../services/marketResearch";

import { parseMarketEntryResult, type MarketEntryResult } from "./types";

export interface UseMarketEntry {
  data: MarketEntryResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  regenerate: () => void;
  isRegenerating: boolean;
}

/** Section-data hook for the market-entry section. Reads the
 *  "market entry & growth strategy" component via the 5b TanStack hooks
 *  (memory-only cache) and narrows the data to the section view-model. */
export function useMarketEntry(userId: string, orgId: string): UseMarketEntry {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.marketEntry, !!orgId);
  const regen = useRegenerateResearch(userId, orgId);
  const data = useMemo(() => parseMarketEntryResult(query.data), [query.data]);
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    regenerate: () => regen.mutate(RESEARCH_COMPONENTS.marketEntry),
    isRegenerating: regen.isPending,
  };
}
