import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { SignalLeadMapEntry } from "../contracts";
import { fetchSignalLeadMap } from "../services/signals";

import { qk } from "@/shared/api/queryKeys";
import { useAuth } from "@/shared/auth/AuthContext";

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
    retry: false,
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

  return { signalsForLead, leadsForSignal, isLoading: query.isLoading, isError: query.isError };
}
