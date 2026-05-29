import { z } from "zod";

// Matches the Tenant shape declared in src/contexts/TenantContext.tsx.
// Mock-derived (no live endpoint exists — spec 20 §3.7); structural, not a drift
// guard. Phase 10 re-validates against the real endpoint it introduces.
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  logo: z.string().optional(),
});
export type TenantContract = z.infer<typeof TenantSchema>;

export const TenantListSchema = z.array(TenantSchema);
