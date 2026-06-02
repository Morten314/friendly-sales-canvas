import type { CompetitorLandscapeView } from "./types";

import {
  useRegenerateResearch,
  useResearchComponent,
} from "@/features/market-research/hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "@/features/market-research/services/marketResearch";

export interface UseCompetitorLandscape {
  data: CompetitorLandscapeView | undefined;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
  isRefreshing: boolean;
}

/** Section-data hook for the competitor-landscape section. Reads the
 *  "competitor landscape" component via the 5b TanStack hooks (memory-only
 *  cache) and exposes the raw data envelope as the section view-model. The
 *  typed/tested boundary for `uiComponents` is competitorUiComponents.ts. */
export function useCompetitorLandscape(userId: string, orgId: string): UseCompetitorLandscape {
  const query = useResearchComponent(
    userId,
    orgId,
    RESEARCH_COMPONENTS.competitor,
    !!userId && !!orgId,
  );
  const regenerate = useRegenerateResearch(userId, orgId);
  return {
    data: query.data?.data as unknown as CompetitorLandscapeView | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => regenerate.mutate(RESEARCH_COMPONENTS.competitor),
    isRefreshing: regenerate.isPending,
  };
}
