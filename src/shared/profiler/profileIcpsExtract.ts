import { z } from "zod";

/** ICPs may live on GET /profile/company as customer_profiles.icps (org-scoped) or on GET /customer_profile. */
export function extractIcpsDataFromFlexibleApiResponse(
  responseData: Record<string, unknown>,
): unknown[] {
  const data = (responseData.data as Record<string, unknown> | undefined) || responseData;
  let icpsData: unknown[] | null = null;

  if (responseData.data && typeof responseData.data === "object") {
    const d = responseData.data as Record<string, unknown>;
    if (Array.isArray(d.icps)) {
      icpsData = d.icps;
    } else if (
      d.customer_profiles &&
      typeof d.customer_profiles === "object" &&
      Array.isArray((d.customer_profiles as { icps?: unknown[] }).icps)
    ) {
      icpsData = (d.customer_profiles as { icps: unknown[] }).icps;
    } else if (
      d.customer_profile &&
      typeof d.customer_profile === "object" &&
      Array.isArray((d.customer_profile as { icps?: unknown[] }).icps)
    ) {
      icpsData = (d.customer_profile as { icps: unknown[] }).icps;
    }
  }

  if (!icpsData) {
    if (Array.isArray(data.icps)) {
      icpsData = data.icps;
    } else if (
      data.customer_profiles &&
      typeof data.customer_profiles === "object" &&
      Array.isArray((data.customer_profiles as { icps?: unknown[] }).icps)
    ) {
      icpsData = (data.customer_profiles as { icps: unknown[] }).icps;
    } else if (
      data.customer_profile &&
      typeof data.customer_profile === "object" &&
      Array.isArray((data.customer_profile as { icps?: unknown[] }).icps)
    ) {
      icpsData = (data.customer_profile as { icps: unknown[] }).icps;
    }
  }

  return Array.isArray(icpsData) ? icpsData : [];
}

const stringList = z.union([z.array(z.string()), z.string()]).optional();

/** Real (but tolerant) contract for a Current-ICP row. Every field optional and
 *  aliased snake↔camel because the backend emits both; `.passthrough()` keeps
 *  report-block extras the downstream `any` consumers still read (TD-FE-42). */
export const IcpRowSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    icp_id: z.union([z.string(), z.number()]).optional(),
    icpId: z.union([z.string(), z.number()]).optional(),
    customer_profile_icp_id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    icp_name: z.string().optional(),
    icpName: z.string().optional(),
    title: z.string().optional(),
    industry: stringList,
    company_size: stringList,
    companySize: stringList,
    buyer_role: stringList,
    buyerRole: stringList,
    location: stringList,
    primary_region: z.string().optional(),
    primaryRegion: z.string().optional(),
    fit_confidence: z.string().optional(),
    fitConfidence: z.string().optional(),
    status: z.string().optional(),
    additional_context: z.string().optional(),
    additionalContext: z.string().optional(),
    accounts_on_watchlist: z.array(z.unknown()).optional(),
    accounts_to_avoid: z.array(z.unknown()).optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
    createdAt: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type IcpRow = z.infer<typeof IcpRowSchema>;

/**
 * Source of truth for Current ICPs matches Swagger: GET /profile/company?user_id=&org_id=
 * (customer_profiles.icps), then legacy GET /customer_profile?org_id=.
 */
export async function fetchIcpsRowsForOrg(uid: string, orgId: string): Promise<IcpRow[]> {
  const companyUrl = `/api/profile/company?user_id=${encodeURIComponent(uid)}&org_id=${encodeURIComponent(orgId)}`;
  try {
    const companyRes = await fetch(companyUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (companyRes.ok) {
      const json = (await companyRes.json()) as Record<string, unknown>;
      const rows = IcpRowSchema.array().parse(extractIcpsDataFromFlexibleApiResponse(json));
      if (rows.length > 0) return rows;
    }
  } catch {
    /* try legacy */
  }
  try {
    const legacyUrl = `/api/customer_profile?org_id=${encodeURIComponent(orgId)}`;
    const legacyRes = await fetch(legacyUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (legacyRes.ok) {
      const json = (await legacyRes.json()) as Record<string, unknown>;
      return IcpRowSchema.array().parse(extractIcpsDataFromFlexibleApiResponse(json));
    }
  } catch {
    /* empty */
  }
  return [];
}
