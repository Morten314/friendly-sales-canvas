import { useQuery } from "@tanstack/react-query";

import { fetchSuggestedIcps } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/**
 * Recommended ICPs (GET /icp). Returns the raw permissive response; the
 * consumer applies `normalizeIcpGetResponse` + `mapApiICPToSuggested`
 * (icpMapping.ts). `refresh` is forwarded to the service; the consumer calls
 * `refetch()` when the header Refresh fires. `retry: false` for raw-fetch parity.
 */
export function useSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: qk.customersSuggestedIcps(userId),
    enabled: (opts.enabled ?? true) && !!userId,
    queryFn: () => fetchSuggestedIcps(userId, { refresh: opts.refresh }),
    retry: false,
  });
}
