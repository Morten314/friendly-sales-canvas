import { useQuery } from "@tanstack/react-query";

import { fetchCustomerProfileIcps } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/**
 * Current ICPs (GET /api/customer_profile via the shared extractor). Customers
 * keeps its own read — not mission-control's `useICPs` (Spec 26 §4; TD-FE-42).
 * `retry: false` mirrors the single-attempt raw fetch (global default is 1).
 */
export function useCustomerProfile(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.customersProfile(userId, orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchCustomerProfileIcps(userId, orgId),
    retry: false,
  });
}
