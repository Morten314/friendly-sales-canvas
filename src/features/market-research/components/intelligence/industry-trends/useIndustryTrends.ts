import { useMemo } from "react";

import { useRegenerateResearch, useResearchComponent } from "../../../hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "../../../services/marketResearch";

import { parseIndustryTrends, type IndustryTrendsResult } from "./types";

export interface UseIndustryTrends {
  data: IndustryTrendsResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  regenerate: () => void;
  isRegenerating: boolean;
}

/** Section-data hook for the industry-trends section. Reads the
 *  "industry trends report" component via the 5b TanStack hooks and narrows
 *  the data to the section view-model. */
export function useIndustryTrends(userId: string, orgId: string): UseIndustryTrends {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.industryTrends, !!orgId);
  const regen = useRegenerateResearch(userId, orgId);
  const data = useMemo(() => parseIndustryTrends(query.data), [query.data]);
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    regenerate: () => regen.mutate(RESEARCH_COMPONENTS.industryTrends),
    isRegenerating: regen.isPending,
  };
}
