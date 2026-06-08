import { useQuery } from "@tanstack/react-query";

import { fetchSignals } from "../services/signals";

import { qk } from "@/shared/api/queryKeys";

/**
 * GET /api/v2/fetch-signals — page-only signals feed read. `retry: false` mirrors
 * the single-attempt raw fetch this lifted from (Phase 8, Task 12 consumer).
 */
export function useFetchSignals(userId: string, enabled = true) {
  return useQuery({
    queryKey: qk.signalsFeed(userId),
    enabled: enabled && !!userId,
    queryFn: () => fetchSignals(userId),
    retry: false,
  });
}
