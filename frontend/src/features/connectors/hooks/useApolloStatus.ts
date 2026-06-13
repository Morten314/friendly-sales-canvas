import { useQuery } from "@tanstack/react-query";

import { fetchApolloStatus } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

/** Read Apollo connection + credit summary (GET /api/connectors/apollo/status). */
export function useApolloStatus(orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.apolloStatus(orgId),
    enabled: enabled && !!orgId,
    queryFn: () => fetchApolloStatus(orgId),
    retry: false,
  });
}
