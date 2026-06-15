import { useQuery } from "@tanstack/react-query";

import { fetchLeads } from "../services/leads";

import { qk } from "@/shared/api/queryKeys";

/** Real org leads from GET /api/v2/leads. Disabled until orgId is known. */
export function useLeads(orgId?: string | null) {
  return useQuery({
    queryKey: qk.leads(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => fetchLeads(orgId as string),
    retry: false,
  });
}
