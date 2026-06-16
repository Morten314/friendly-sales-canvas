import { useQuery } from "@tanstack/react-query";

import { fetchOwnProfile } from "../services/profile";

import { qk } from "@/shared/api/queryKeys";

export function useAgentProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.agentProfile(userId ?? ""),
    enabled: !!userId,
    queryFn: () => fetchOwnProfile("agent_name", userId as string),
  });
}
