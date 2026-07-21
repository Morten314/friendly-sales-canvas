import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchResearchComponent, type ResearchComponentName } from "../services/marketResearch";

import { qk } from "@/shared/api/queryKeys";

/** One research component (read-via-POST). The page hydrates by calling this once per
 *  component; section hooks (5d–5h) wrap it. `userId`/`orgId` come from auth/tenant
 *  context (the backend `MarketRequest` requires `user_id`). */
export function useResearchComponent(
  userId: string,
  orgId: string,
  componentName: ResearchComponentName,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.marketResearchComponent(orgId, componentName),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchResearchComponent(userId, componentName, { orgId }),
  });
}

/** Force-regenerate a component, then write the result straight into its cache. */
export function useRegenerateResearch(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (componentName: ResearchComponentName) =>
      fetchResearchComponent(userId, componentName, { orgId, refresh: true }),
    onSuccess: (data, componentName) => {
      // Populate the cache directly from the mutation result — NOT
      // invalidateQueries. The component's useResearchComponent is mounted and
      // active, so invalidate would mark it stale and fire a SECOND background
      // POST (`refresh:false`) through the 30/min limiter, which can also
      // overwrite the just-regenerated report with a server-stale one. See ADR-0004.
      queryClient.setQueryData(qk.marketResearchComponent(orgId, componentName), data);
    },
  });
}
