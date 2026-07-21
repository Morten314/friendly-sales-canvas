import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchApolloDiscoverStatus } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

const STATUS_POLL_MS = 2_500;
const NON_TERMINAL = new Set(["queued", "processing"]);

export function isTerminalStatus(status: string | undefined): boolean {
  return !!status && !NON_TERMINAL.has(status);
}

export function useDiscoverStatus(orgId: string, runId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.apolloDiscoverStatus(orgId, runId),
    enabled: !!orgId && !!runId,
    queryFn: () => fetchApolloDiscoverStatus(orgId, runId),
    retry: false,
    refetchInterval: (q) => (isTerminalStatus(q.state.data?.status) ? false : STATUS_POLL_MS),
  });

  // When a run reaches a terminal status, the cached apolloStatus (last_discovery_at /
  // icp_changed_since_last_discovery) is stale; invalidate it so the next discover click
  // re-evaluates the re-discovery guard / keep-replace prompt from fresh fields rather than
  // the enqueue-time snapshot (which would silently skip both prompts within a session).
  const status = query.data?.status;
  useEffect(() => {
    if (orgId && isTerminalStatus(status)) {
      void queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
    }
  }, [status, orgId, queryClient]);

  return query;
}
