import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rejectRecommendedIcp, deleteCurrentIcp } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/** DELETE a recommended ICP (the network half of the optimistic reject flow). */
export function useRejectSuggestedIcp(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => rejectRecommendedIcp(userId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersSuggestedIcps(userId) });
    },
  });
}

/** DELETE an accepted/current ICP; invalidate the current-ICP read. */
export function useDeleteCurrentIcp(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => deleteCurrentIcp(orgId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
    },
  });
}
