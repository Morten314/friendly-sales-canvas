import { useQuery } from "@tanstack/react-query";

import { fetchDataSources } from "../services/missionControl";

import { qk } from "@/shared/api/queryKeys";

/** Read the org's data-source documents (GET /api/user-documents). Returns the
 *  raw documents; the data-sources component maps them to DataSource[] (stage 5). */
export function useDataSources(orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.dataSources(orgId),
    enabled: enabled && !!orgId,
    queryFn: () => fetchDataSources(orgId),
  });
}
