import { useMutation, useQueryClient } from "@tanstack/react-query";

import { startApolloDiscover, type StartDiscoverArgs } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

export function useDiscover(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: StartDiscoverArgs) => startApolloDiscover(args),
    onSuccess: () => {
      // a queued run changes status; refetch so the tile flips to Running
      void queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
    },
  });
}
