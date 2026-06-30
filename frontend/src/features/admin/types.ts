import { z } from "zod";

// GET /admin/orgs — confirmed shape from Task 1 step 8.
export const AdminOrgSummarySchema = z
  .object({
    org_id: z.string(),
    org_name: z.string().nullable().optional(),
    user_count: z.number().default(0),
    user_ids: z.array(z.string()).default([]),
  })
  .passthrough();
export type AdminOrgSummary = z.infer<typeof AdminOrgSummarySchema>;
export const AdminOrgListSchema = z.array(AdminOrgSummarySchema);

// GET /admin/health
export const HealthProbeSchema = z.object({
  name: z.string(),
  status: z.string(),
  detail: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
});
export const SystemHealthSchema = z.object({ probes: z.array(HealthProbeSchema) });
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type HealthProbe = z.infer<typeof HealthProbeSchema>;

// GET /api/v2/registration items + POST /registration
export const RegistrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  timestamp: z.string(),
});
export type Registration = z.infer<typeof RegistrationSchema>;

// POST /org, POST /connect_org, GET /org?user_id= — loosely typed (extra="allow").
export const OrgResponseSchema = z
  .object({
    status: z.string().optional(),
    user_id: z.string().nullable().optional(),
    org_id: z.string().nullable().optional(),
    org_name: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough();
export type OrgResponse = z.infer<typeof OrgResponseSchema>;
