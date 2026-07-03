import { z } from "zod";

// Historical: matched the Tenant shape from the now-retired tenant-context
// module (spec 46 WS1 collapsed the tenant abstraction; TD-FE-55 resolved).
// Mock-derived (no live endpoint exists — spec 20 §3.7); structural, not a drift
// guard.
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  logo: z.string().optional(),
});
export type TenantContract = z.infer<typeof TenantSchema>;

export const TenantListSchema = z.array(TenantSchema);
