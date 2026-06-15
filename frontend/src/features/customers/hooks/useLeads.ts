import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchLeads } from "../services/leads";

import { qk } from "@/shared/api/queryKeys";

const PAGE = 50;

/**
 * Real org leads from GET /api/v2/leads, as an offset-paged infinite query
 * (TD-FE-70). Disabled until orgId is known. `getNextPageParam` returns the
 * loaded count until it reaches `total`, then `undefined` (no more pages).
 */
export function useLeads(orgId?: string | null) {
  return useInfiniteQuery({
    queryKey: qk.leads(orgId ?? ""),
    enabled: !!orgId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchLeads(orgId as string, pageParam as number, PAGE),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    retry: false,
  });
}
