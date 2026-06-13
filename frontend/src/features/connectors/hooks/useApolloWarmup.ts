import { useQuery } from "@tanstack/react-query";

import { fetchApolloWarmup } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

const WARMUP_POLL_MS = 30_000; // low-frequency; only while connected-and-locked (G3/G4)

/** Read ICP readiness gate for the org/user pair (GET /api/connectors/apollo/warmup).
 *
 * Polls every 30 s while connected AND `unlocked == false`.
 * Stops polling once the backend reports `unlocked: true` (G3 predicate). */
export function useApolloWarmup(
  orgId: string,
  userId: string,
  opts: { connected: boolean } = { connected: true },
) {
  return useQuery({
    queryKey: qk.apolloWarmup(orgId, userId),
    enabled: opts.connected && !!orgId && !!userId,
    queryFn: () => fetchApolloWarmup(orgId, userId),
    retry: false,
    // Poll only until unlocked; once unlocked, stop (predicate evaluated each tick).
    refetchInterval: (query) => (query.state.data?.unlocked ? false : WARMUP_POLL_MS),
  });
}
