import { useQuery } from "@tanstack/react-query";

import { fetchLeadStreamStatus } from "../services/missionControl";

import { qk } from "@/shared/api/queryKeys";

/** Read uploaded lead-stream files + processing stats (GET /api/leads/stream/status). */
export function useLeadStreamStatus(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.leadStreamStatus(userId, orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchLeadStreamStatus(userId, orgId),
  });
}
