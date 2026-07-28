import { useMemo } from "react";

import { useRegenerateResearch, useResearchComponent } from "../../../hooks/useMarketResearch";
import { RESEARCH_COMPONENTS } from "../../../services/marketResearch";

import type { UntypedBackendApiResponse } from "./types";

export interface UseRegulatoryComplianceResult {
  regulatoryData: UntypedBackendApiResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
  isRefreshing: boolean;
}

/** Section-data hook for the regulatory-compliance section. Reads the
 *  "regulatory & compliance highlights" component via the 5b TanStack hooks
 *  (memory-only cache) and passes the raw data envelope through unchanged. */
export function useRegulatoryCompliance(
  userId: string,
  orgId: string,
): UseRegulatoryComplianceResult {
  const query = useResearchComponent(userId, orgId, RESEARCH_COMPONENTS.regulatory);
  const regenerate = useRegenerateResearch(userId, orgId);
  const regulatoryData = useMemo(
    () => query.data?.data as unknown as UntypedBackendApiResponse | undefined,
    [query.data],
  );
  return {
    regulatoryData,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => regenerate.mutate(RESEARCH_COMPONENTS.regulatory),
    isRefreshing: regenerate.isPending,
  };
}
