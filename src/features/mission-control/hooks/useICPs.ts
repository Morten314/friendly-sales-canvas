import { useQuery } from "@tanstack/react-query";

import { qk } from "@/shared/api/queryKeys";
import { fetchIcpsRowsForOrg } from "@/shared/profiler";

/**
 * Read the org's ICP rows (GET /api/profile/company → /api/customer_profile,
 * shaped by the shared extractor). Returns the RAW rows; consumers map them via
 * the `@/shared/profiler` helpers (parity with the customers consumer). ICP
 * writes (CRUD) stay raw `fetch` this phase — deferred (TD-FE, finalize).
 */
export function useICPs(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.icps(orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchIcpsRowsForOrg(userId, orgId),
  });
}
