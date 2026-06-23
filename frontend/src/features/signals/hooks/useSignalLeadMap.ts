import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { SignalLeadMapEntry } from "../contracts";
import { fetchSignalLeadMap } from "../services/signals";

import { qk } from "@/shared/api/queryKeys";
import { useAuth } from "@/shared/auth/AuthContext";

// Exponential-backoff base for the transient-failure retry. Tiny under test so
// the hook's unit tests stay fast/deterministic; ~1s in the app.
const RETRY_BACKOFF_MS = import.meta.env.MODE === "test" ? 1 : 1000;

/**
 * Read-time signal↔lead mapping. Fetches once per (org, user) and exposes two
 * inverse selectors. Quiet (empty) while loading, disabled, or on error.
 */
export function useSignalLeadMap(orgId?: string | null) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";

  const query = useQuery({
    queryKey: qk.signalLeadMap(orgId ?? "", userId),
    enabled: !!orgId && !!userId,
    queryFn: () => fetchSignalLeadMap(userId, orgId as string),
    // Render free-tier cold starts produce transient 502/500s. Retry with backoff
    // so a single hiccup doesn't surface "Could not load matched leads" (S5). A
    // manual "Try again" (retry()) and "Recompute" (refresh()) remain as escapes.
    retry: 2,
    retryDelay: (attempt) => Math.min(RETRY_BACKOFF_MS * 2 ** attempt, 4000),
  });

  const mapping: SignalLeadMapEntry[] = useMemo(() => query.data?.data.mapping ?? [], [query.data]);

  /** Affected leads for a signal (for "Affects N leads"). */
  const leadsForSignal = useCallback(
    (signalId: string) => mapping.find((m) => m.signal_id === signalId)?.leads ?? [],
    [mapping],
  );

  /** Relevant signals for a lead, flattened with this lead's relevance/why. */
  const signalsForLead = useCallback(
    (leadId: string) =>
      mapping
        .filter((m) => m.leads.some((l) => l.lead_id === leadId))
        .map((m) => {
          const ref = m.leads.find((l) => l.lead_id === leadId);
          return {
            signal_id: m.signal_id,
            headline: m.headline,
            relevance: ref?.relevance ?? "low",
            why: ref?.why ?? "",
          };
        }),
    [mapping],
  );

  const queryClient = useQueryClient();

  /**
   * Force-recompute the signal↔lead mapping past the server cache. Routed
   * through fetchQuery (staleTime:0) so the shared query's own state updates:
   * isFetching → success on a good response (which clears a prior error state),
   * or error on failure. A bare setQueryData left a stuck error UI silently.
   * The /signal-lead-map_claude endpoint is deployed; SignalsPage renders a
   * visible "Recompute lead mapping" control wired here.
   */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!orgId || !userId) return false;
    try {
      await queryClient.fetchQuery({
        queryKey: qk.signalLeadMap(orgId, userId),
        queryFn: () => fetchSignalLeadMap(userId, orgId, { refresh: true }),
        staleTime: 0,
      });
      return true;
    } catch (err) {
      console.warn("signal-lead-map recompute failed", err);
      return false;
    }
  }, [orgId, userId, queryClient]);

  /** Plain re-fetch of the cached mapping (no server recompute) — the "Try again" escape for a transient error. */
  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    signalsForLead,
    leadsForSignal,
    isLoading: query.isLoading,
    // True during background refetches too (recompute / retry) — drives the
    // in-flight spinner so the action visibly does something (S6).
    isFetching: query.isFetching,
    isError: query.isError,
    refresh,
    retry,
  };
}
