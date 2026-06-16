import { useQuery } from "@tanstack/react-query";

import { fetchOwnProfile } from "../services/profile";

import { qk } from "@/shared/api/queryKeys";

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.userProfile(userId ?? ""),
    enabled: !!userId,
    queryFn: () => fetchOwnProfile("user", userId as string),
  });
}
