import { useQuery } from "@tanstack/react-query";

import { TenantListSchema, type TenantContract } from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

// Mock tenant list (no backend endpoint exists). Replace only this queryFn body
// with a real fetch through the shared client once an endpoint exists (TD-FE-55).
const MOCK_TENANTS: TenantContract[] = [
  { id: "1", name: "Acme Corporation", domain: "acme.com", logo: "🏢" },
  { id: "2", name: "TechStart Inc", domain: "techstart.io", logo: "🚀" },
  { id: "3", name: "Global Solutions", domain: "globalsolutions.com", logo: "🌍" },
];

export function useTenants(userId: string | null | undefined) {
  return useQuery<TenantContract[]>({
    queryKey: qk.tenants(userId),
    queryFn: async () => TenantListSchema.parse(MOCK_TENANTS),
  });
}
