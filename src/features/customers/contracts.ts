import { z } from "zod";

import { resolveLeadFields } from "@/shared/lib/leadData";

/**
 * A single recommended-ICP item from GET /icp — kept opaque (shape varies).
 * Module-local (not exported): only the response schema below references it, so
 * exporting it would be an unused export under `knip --strict`.
 */
const suggestedIcpItemSchema = z.object({}).passthrough();

/**
 * GET /icp response. The backend may return a bare array, or an object wrapping
 * the list under `data` / `payload` / `result` / `icps` / `suggestedICPs` /
 * `results` / `items` / `recommendations` / `profiles`, or a single root object.
 * All optional + `.passthrough()` so `.parse` never throws on a real response;
 * `normalizeIcpGetResponse` (icpMapping.ts) resolves which shape it actually is.
 */
export const SuggestedIcpsResponseSchema = z.union([
  z.array(suggestedIcpItemSchema),
  z
    .object({
      data: z.unknown().nullish(),
      payload: z.unknown().nullish(),
      result: z.unknown().nullish(),
      icps: z.array(suggestedIcpItemSchema).nullish(),
      suggestedICPs: z.array(suggestedIcpItemSchema).nullish(),
      results: z.array(suggestedIcpItemSchema).nullish(),
      items: z.array(suggestedIcpItemSchema).nullish(),
      recommendations: z.array(suggestedIcpItemSchema).nullish(),
      profiles: z.array(suggestedIcpItemSchema).nullish(),
    })
    .passthrough(),
]);
export type SuggestedIcpsResponse = z.infer<typeof SuggestedIcpsResponseSchema>;

/**
 * GET/POST /api/customer_profile. The row shape varies and is consumed via the
 * shared `@/shared/profiler` extractors; kept opaque + passthrough so `.parse`
 * validates the envelope without constraining rows. Consumed at the boundary by
 * `saveAcceptedIcpFirmographics` (T13) — keep it referenced so it is not a dead
 * export under `knip --strict`.
 */
export const CustomerProfileResponseSchema = z
  .object({
    icps: z.array(z.object({}).passthrough()).nullish(),
    data: z.unknown().nullish(),
  })
  .passthrough();

// ── Lead Stream (GET /api/v2/leads) ──────────────────────────────────────────

/** Raw v2 lead node (flexible). Only the fields we read are declared; the rest pass through. */
export const RawLeadSchema = z
  .object({
    lead_id: z.string(),
    source: z.string().nullish(),
    company_name: z.string().nullish(),
    company: z.string().nullish(),
    lead_name: z.string().nullish(),
    name: z.string().nullish(),
    email_status: z.string().nullish(),
  })
  .passthrough();

export type RawLead = z.infer<typeof RawLeadSchema>;

/** Display shape for the customers Lead Stream. */
export interface CustomerLead {
  id: string;
  name: string;
  company: string;
  source: string | null;
  emailStatus: string | null;
  title: string | null;
  seniority: string | null;
}

export function mapRawLead(raw: RawLead): CustomerLead {
  const fields = resolveLeadFields(raw as unknown as Record<string, unknown>);
  const company = fields.company || "—";
  return {
    id: raw.lead_id,
    name: fields.name || company,
    company,
    title: fields.title || null,
    seniority: fields.seniority || null,
    source: raw.source ?? null,
    emailStatus: raw.email_status ?? null,
  };
}
