import { useMutation, useQueryClient } from "@tanstack/react-query";

import { acceptSuggestedIcp } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/** POST from_suggested_icp, then invalidate the current-ICP read (Spec 26 §4). */
export function useAcceptSuggestedIcp(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => acceptSuggestedIcp(userId, orgId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
      void queryClient.invalidateQueries({ queryKey: qk.icps(orgId) });
    },
  });
}
