import { useMutation, useQueryClient } from "@tanstack/react-query";

import { disconnectApollo } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

/** DELETE the org's Apollo credentials, then refresh connection status.
 * Mirrors useDiscover: success invalidates apolloStatus so the tile re-reads `connected`. */
export function useDisconnectApollo(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectApollo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
    },
  });
}
