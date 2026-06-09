import { useMemo } from "react";

import { useRegenerateResearch, useResearchComponent } from "../../../hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "../../../services/marketResearch";

import { normalizeCompetitorLandscapeData } from "./competitorUiComponents";
import type { UntypedBackendApiResponse } from "./types";

export interface UseCompetitorLandscape {
  data: UntypedBackendApiResponse | undefined;
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
  const data = useMemo(
    () =>
      normalizeCompetitorLandscapeData(
        query.data?.data as unknown as UntypedBackendApiResponse | undefined,
      ),
    [query.data],
  );
  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => regenerate.mutate(RESEARCH_COMPONENTS.competitor),
    isRefreshing: regenerate.isPending,
  };
}
