import { useQuery } from "@tanstack/react-query";

import { fetchOwnProfile } from "../services/profile";

import { qk } from "@/shared/api/queryKeys";

export function useUserProfile(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.userProfile(userId ?? ""),
    enabled: enabled && !!userId,
    queryFn: () => fetchOwnProfile("user", userId as string),
  });
}
