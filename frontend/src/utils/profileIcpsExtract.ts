/** ICPs may live on GET /profile/company as customer_profiles.icps (org-scoped) or on GET /customer_profile. */
export function extractIcpsDataFromFlexibleApiResponse(
  responseData: Record<string, unknown>
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

/**
 * Source of truth for Current ICPs matches Swagger: GET /profile/company?user_id=&org_id=
 * (customer_profiles.icps), then legacy GET /customer_profile?org_id=.
 */
export async function fetchIcpsRowsForOrg(uid: string, orgId: string): Promise<unknown[]> {
  const companyUrl = `/api/profile/company?user_id=${encodeURIComponent(uid)}&org_id=${encodeURIComponent(orgId)}`;
  try {
    const companyRes = await fetch(companyUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (companyRes.ok) {
      const json = (await companyRes.json()) as Record<string, unknown>;
      const rows = extractIcpsDataFromFlexibleApiResponse(json);
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
      return extractIcpsDataFromFlexibleApiResponse(json);
    }
  } catch {
    /* empty */
  }
  return [];
}
