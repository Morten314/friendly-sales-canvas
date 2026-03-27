/**
 * Shared helpers for GET/POST /customer_profile (full icps list replace — no per-ICP DELETE API).
 * Uses apiFetch so JWT + user_id are applied — raw fetch caused deletes to not persist on refresh.
 */
import { mergeProfilerAcceptedIcpDisplayIfPlaceholder } from "@/utils/profilerAcceptedIcpDisplay";
import { apiFetch } from "@/lib/api";

type FitConfidence = "high" | "medium" | "low";

/** Backend may use `id` or `_id` (MongoDB); must match delete + POST payloads. */
export function getStableIcpIdFromRaw(raw: unknown): string {
  if (raw == null || typeof raw !== "object") return "";
  const r = raw as Record<string, unknown>;
  const v = r.id ?? r._id ?? r.icp_id;
  return v != null ? String(v) : "";
}

export interface CustomerProfileICP {
  id: string;
  primaryRegion: string;
  location: string[];
  industry: string[];
  companySize: string[];
  buyerRole: string[];
  accountsOnWatchlist: string[];
  accountsToAvoid: string[];
  fitConfidence: FitConfidence;
  additionalContext: string;
  status: "saved";
  createdAt: Date;
}

/** Same extraction paths as ICPManager.loadCustomerProfileFromBackend */
export function extractIcpsArrayFromCustomerProfileJson(responseData: Record<string, unknown>): unknown[] | null {
  const data = (responseData.data ?? responseData) as Record<string, unknown>;
  let icpsData: unknown[] | null = null;

  if (responseData.data && typeof responseData.data === "object") {
    const d = responseData.data as Record<string, unknown>;
    if (Array.isArray(d.icps)) icpsData = d.icps;
    else if (d.customer_profiles && Array.isArray((d.customer_profiles as { icps?: unknown[] }).icps))
      icpsData = (d.customer_profiles as { icps: unknown[] }).icps;
    else if (d.customer_profile && Array.isArray((d.customer_profile as { icps?: unknown[] }).icps))
      icpsData = (d.customer_profile as { icps: unknown[] }).icps;
  }
  if (!icpsData) {
    if (Array.isArray(data.icps)) icpsData = data.icps as unknown[];
    else if (data.customer_profiles && Array.isArray((data.customer_profiles as { icps?: unknown[] }).icps))
      icpsData = (data.customer_profiles as { icps: unknown[] }).icps;
    else if (data.customer_profile && Array.isArray((data.customer_profile as { icps?: unknown[] }).icps))
      icpsData = (data.customer_profile as { icps: unknown[] }).icps;
  }
  return icpsData;
}

export function mapRawIcpsToCustomerProfileICP(icpsData: unknown[]): CustomerProfileICP[] {
  return icpsData.map((raw: unknown) => {
    const icp = raw as Record<string, unknown>;
    const merged = mergeProfilerAcceptedIcpDisplayIfPlaceholder(icp);
    const m = merged as Record<string, unknown>;
    const stableId = String(m.id ?? m._id ?? m.icp_id ?? "").trim();
    return {
      id: stableId || `icp-${Date.now()}-${Math.random()}`,
      primaryRegion: String(m.primary_region || m.primaryRegion || ""),
      location: Array.isArray(m.location) ? (m.location as string[]) : [],
      industry: Array.isArray(m.industry) ? (m.industry as string[]) : [],
      companySize: Array.isArray(m.company_size)
        ? (m.company_size as string[])
        : Array.isArray(m.companySize)
          ? (m.companySize as string[])
          : [],
      buyerRole: Array.isArray(m.buyer_role)
        ? (m.buyer_role as string[])
        : Array.isArray(m.buyerRole)
          ? (m.buyerRole as string[])
          : [],
      accountsOnWatchlist: Array.isArray(m.accounts_on_watchlist)
        ? (m.accounts_on_watchlist as string[])
        : Array.isArray(m.accountsOnWatchlist)
          ? (m.accountsOnWatchlist as string[])
          : [],
      accountsToAvoid: Array.isArray(m.accounts_to_avoid)
        ? (m.accounts_to_avoid as string[])
        : Array.isArray(m.accountsToAvoid)
          ? (m.accountsToAvoid as string[])
          : [],
      fitConfidence: (m.fit_confidence || m.fitConfidence || "medium") as FitConfidence,
      additionalContext: String(m.additional_context || m.additionalContext || ""),
      status: "saved" as const,
      createdAt: m.created_at ? new Date(String(m.created_at)) : m.createdAt ? new Date(String(m.createdAt)) : new Date(),
    };
  });
}

function buildPostBody(userId: string, orgId: string, icps: CustomerProfileICP[]) {
  return {
    user_id: userId,
    org_id: orgId,
    icps: icps.map((icp) => ({
      id: icp.id,
      primary_region: icp.primaryRegion,
      location: Array.isArray(icp.location) ? icp.location : [],
      industry: Array.isArray(icp.industry) ? icp.industry : [],
      company_size: Array.isArray(icp.companySize) ? icp.companySize : [],
      buyer_role: Array.isArray(icp.buyerRole) ? icp.buyerRole : [],
      accounts_on_watchlist: Array.isArray(icp.accountsOnWatchlist) ? icp.accountsOnWatchlist : [],
      accounts_to_avoid: Array.isArray(icp.accountsToAvoid) ? icp.accountsToAvoid : [],
      fit_confidence: icp.fitConfidence || "medium",
      additional_context: icp.additionalContext || "",
      status: icp.status || "saved",
      created_at: icp.createdAt instanceof Date ? icp.createdAt.toISOString() : icp.createdAt,
    })),
  };
}

function customerProfileQuery(userId: string, orgId: string) {
  return `customer_profile?user_id=${encodeURIComponent(userId)}&org_id=${encodeURIComponent(orgId)}`;
}

/**
 * GET full profile, remove one ICP by id, POST updated list. Returns remaining ICPs or throws.
 */
export async function deleteIcpViaCustomerProfilePost(
  orgId: string,
  deleteId: string,
  userId: string,
): Promise<CustomerProfileICP[]> {
  const getRes = await apiFetch(customerProfileQuery(userId, orgId), {
    method: "GET",
  });
  const responseData = (await getRes.json()) as Record<string, unknown>;
  const icpsRaw = extractIcpsArrayFromCustomerProfileJson(responseData) ?? [];
  if (!Array.isArray(icpsRaw)) {
    throw new Error("No ICPs in customer profile response");
  }

  const deleteNorm = String(deleteId).trim();
  const remainingRaw = icpsRaw.filter((raw) => getStableIcpIdFromRaw(raw) !== deleteNorm);
  if (remainingRaw.length === icpsRaw.length) {
    throw new Error("ICP not found in profile");
  }

  const remaining = mapRawIcpsToCustomerProfileICP(remainingRaw);

  await apiFetch(customerProfileQuery(userId, orgId), {
    method: "POST",
    body: buildPostBody(userId, orgId, remaining),
  });

  const verifyRes = await apiFetch(customerProfileQuery(userId, orgId), { method: "GET" });
  const verifyJson = (await verifyRes.json()) as Record<string, unknown>;
  const verifyRaw = extractIcpsArrayFromCustomerProfileJson(verifyJson);
  if (Array.isArray(verifyRaw)) {
    return mapRawIcpsToCustomerProfileICP(verifyRaw);
  }
  return remaining;
}
