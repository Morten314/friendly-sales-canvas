import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveAcceptedIcpFirmographics } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";
import type { SuggestedIcpCardFields } from "@/shared/profiler";

/** Firmographics save after accept; invalidate the current-ICP read on success. */
export function useSaveCustomerProfile(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { suggested: SuggestedIcpCardFields; targetIcpId: string }) =>
      saveAcceptedIcpFirmographics({
        orgId,
        suggested: vars.suggested,
        targetIcpId: vars.targetIcpId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
      void queryClient.invalidateQueries({ queryKey: qk.icps(orgId) });
    },
  });
}
