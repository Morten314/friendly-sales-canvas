import { useQuery } from "@tanstack/react-query";

import { fetchDataSources } from "../services/missionControl";

import { qk } from "@/shared/api/queryKeys";

/** Read the org's data-source documents (GET /api/v2/user-documents). Returns the
 *  raw documents as a bare array; `select` unwraps the `{ items, total }` envelope
 *  so existing consumers of `.data` are unaffected (TD-FE-67). */
export function useDataSources(orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.dataSources(orgId),
    enabled: enabled && !!orgId,
    queryFn: () => fetchDataSources(orgId),
    select: (env) => env.items,
  });
}
