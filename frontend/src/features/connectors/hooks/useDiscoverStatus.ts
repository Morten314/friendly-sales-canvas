import { useQuery } from "@tanstack/react-query";

import { fetchApolloDiscoverStatus } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

const STATUS_POLL_MS = 2_500;
const NON_TERMINAL = new Set(["queued", "processing"]);

export function isTerminalStatus(status: string | undefined): boolean {
  return !!status && !NON_TERMINAL.has(status);
}

export function useDiscoverStatus(orgId: string, runId: string | null) {
  return useQuery({
    queryKey: qk.apolloDiscoverStatus(orgId, runId),
    enabled: !!orgId && !!runId,
    queryFn: () => fetchApolloDiscoverStatus(orgId, runId),
    retry: false,
    refetchInterval: (query) =>
      isTerminalStatus(query.state.data?.status) ? false : STATUS_POLL_MS,
  });
}
