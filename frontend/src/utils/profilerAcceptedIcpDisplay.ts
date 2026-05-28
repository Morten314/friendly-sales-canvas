/**
 * When POST /customer_profile/from_suggested_icp persists an ICP, the API may store
 * placeholders (primaryRegion "global", industry "unknown", empty location[]).
 * We save the rich Profiler suggested-ICP fields at accept time and merge them
 * when rendering Mission Control + Profiler Current ICPs.
 */

export const PROFILER_ICP_DISPLAY_KEY = (icpId: string) => `profiler_icp_display_${icpId}`;

export interface ProfilerAcceptedIcpDisplayMeta {
  regions: string[];
  industry: string;
  companySize: string;
  decisionMakers: string[];
  displayName: string;
}

const isUnknownPlaceholder = (v: string) => v.trim().toLowerCase() === "unknown";
const isGlobalPlaceholder = (v: string) => v.trim().toLowerCase() === "global";

/** True when primary region / geography is empty, global, or an API placeholder. */
const isWeakRegionPlaceholder = (v: string) => {
  const t = v.trim().toLowerCase();
  return t === "" || isGlobalPlaceholder(v) || isUnknownPlaceholder(v);
};

const locationNeedsMetaRegions = (location: string[]): boolean => {
  if (location.length === 0) return true;
  if (location.length === 1 && isUnknownPlaceholder(String(location[0]))) return true;
  return location.every((x) => isUnknownPlaceholder(String(x)));
};

function pickIcpNameFromRecord(icp: any): string {
  const raw =
    icp?.name ??
    icp?.icp_name ??
    icp?.icpName ??
    icp?.title ??
    icp?.display_name ??
    icp?.displayName;
  return raw != null ? String(raw).trim() : "";
}

/**
 * Best-effort parse of POST /customer_profile/from_suggested_icp JSON so we can key
 * local display metadata under the persisted profile ICP id (often differs from suggested id).
 */
export function extractPersistedIcpIdFromSuggestedProfileResponse(res: any): string | undefined {
  if (res == null || typeof res !== "object") return undefined;
  const d = (res as any).data ?? res;
  if (d == null || typeof d !== "object") return undefined;

  const tryStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  const direct =
    tryStr((d as any).icp_id) ??
    tryStr((d as any).icpId) ??
    tryStr((d as any).persisted_icp_id) ??
    tryStr((d as any).customer_profile_icp_id);
  if (direct) return direct;

  const icps = (d as any).icps;
  if (Array.isArray(icps) && icps.length > 0) {
    const last = icps[icps.length - 1];
    const id = last && typeof last === "object" ? tryStr((last as any).id) : undefined;
    if (id) return id;
  }

  const cp = (d as any).customer_profile ?? (d as any).customer_profiles;
  if (cp && typeof cp === "object") {
    const nested = (cp as any).icps;
    if (Array.isArray(nested) && nested.length > 0) {
      const last = nested[nested.length - 1];
      const id = last && typeof last === "object" ? tryStr((last as any).id) : undefined;
      if (id) return id;
    }
  }

  return undefined;
}

export function saveProfilerAcceptedIcpDisplayMeta(
  icpId: string,
  meta: ProfilerAcceptedIcpDisplayMeta,
): void {
  try {
    localStorage.setItem(PROFILER_ICP_DISPLAY_KEY(icpId), JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
}

export function removeProfilerAcceptedIcpDisplayMeta(icpId: string): void {
  try {
    localStorage.removeItem(PROFILER_ICP_DISPLAY_KEY(icpId));
  } catch {
    /* ignore */
  }
}

/** Copy saved accept-time meta from suggested ICP id to persisted customer_profile id (often a new UUID). */
export function copyProfilerDisplayMetaToProfileId(
  suggestedIcpId: string,
  profileIcpId: string,
): void {
  if (!suggestedIcpId || !profileIcpId || suggestedIcpId === profileIcpId) return;
  try {
    const raw = localStorage.getItem(PROFILER_ICP_DISPLAY_KEY(suggestedIcpId));
    if (!raw) return;
    localStorage.setItem(PROFILER_ICP_DISPLAY_KEY(profileIcpId), raw);
  } catch {
    /* ignore */
  }
}

/** True when API stored Profiler placeholders (global + unknown industry). */
export function isProfilerPlaceholderIcp(icp: any): boolean {
  const pr = String(icp?.primary_region ?? icp?.primaryRegion ?? "")
    .trim()
    .toLowerCase();
  const ind = Array.isArray(icp?.industry) ? icp.industry : [];
  const singleUnknown = ind.length === 1 && String(ind[0]).trim().toLowerCase() === "unknown";
  return pr === "global" && singleUnknown;
}

/**
 * Legacy helper: merge only when API used the classic global + unknown placeholder shape.
 * Prefer {@link mergeProfilerAcceptedIcpDisplay} for Customer Profile / Current ICPs.
 */
export function mergeProfilerAcceptedIcpDisplayIfPlaceholder(icp: any): any {
  const hasId = icp?.id ?? icp?.icp_id ?? icp?.customer_profile_icp_id;
  if (!hasId) return icp;
  if (!isProfilerPlaceholderIcp(icp)) return icp;
  return mergeProfilerAcceptedIcpDisplay(icp);
}

/** Backend GET may return `icp_id` (or aliases) while local merge/display key on `id`. */
function resolveCustomerProfileIcpId(icp: any): string {
  const candidates = [icp?.id, icp?.icp_id, icp?.customer_profile_icp_id, icp?.icpId];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") return String(c).trim();
  }
  return "";
}

/**
 * Merge local accept-time metadata into a customer_profile ICP object (API shape).
 */
export function mergeProfilerAcceptedIcpDisplay(icp: any): any {
  const resolvedId = resolveCustomerProfileIcpId(icp);
  if (!resolvedId) return icp;
  const icpWithId = icp?.id === resolvedId ? icp : { ...icp, id: resolvedId };
  let meta: ProfilerAcceptedIcpDisplayMeta | null = null;
  try {
    const raw = localStorage.getItem(PROFILER_ICP_DISPLAY_KEY(resolvedId));
    if (raw) meta = JSON.parse(raw);
  } catch {
    return icpWithId;
  }
  if (!meta) return icpWithId;

  const out = { ...icpWithId, id: resolvedId };
  let primaryRegion = String(icpWithId.primary_region || icpWithId.primaryRegion || "");
  let location = Array.isArray(icpWithId.location) ? [...icpWithId.location] : [];
  let industry = Array.isArray(icpWithId.industry) ? [...icpWithId.industry] : [];
  let companySize = Array.isArray(icpWithId.company_size)
    ? [...icpWithId.company_size]
    : Array.isArray(icpWithId.companySize)
      ? [...icpWithId.companySize]
      : [];
  let buyerRole = Array.isArray(icpWithId.buyer_role)
    ? [...icpWithId.buyer_role]
    : Array.isArray(icpWithId.buyerRole)
      ? [...icpWithId.buyerRole]
      : [];

  const existingName = pickIcpNameFromRecord(icpWithId);
  if (meta.displayName && (!existingName || isUnknownPlaceholder(existingName))) {
    out.name = meta.displayName;
  }

  // Location: fill from suggested regions when API left it empty or stored "unknown"
  if (
    locationNeedsMetaRegions(location) &&
    Array.isArray(meta.regions) &&
    meta.regions.length > 0
  ) {
    location = [...meta.regions];
  }

  // Primary region: replace global / unknown / empty with the first suggested region
  if (
    isWeakRegionPlaceholder(primaryRegion) &&
    Array.isArray(meta.regions) &&
    meta.regions.length > 0
  ) {
    primaryRegion = meta.regions[0];
  }

  out.primary_region = primaryRegion;
  out.primaryRegion = primaryRegion;
  out.location = location;

  if (meta.industry) {
    const industryEmptyOrUnknown =
      industry.length === 0 || (industry.length === 1 && isUnknownPlaceholder(String(industry[0])));
    if (industryEmptyOrUnknown) {
      industry = [meta.industry];
    }
  }
  out.industry = industry;

  if (meta.companySize) {
    const sizeEmptyOrUnknown =
      companySize.length === 0 ||
      (companySize.length === 1 && isUnknownPlaceholder(String(companySize[0])));
    if (sizeEmptyOrUnknown) {
      companySize = [meta.companySize];
    }
  }
  out.company_size = companySize;
  out.companySize = companySize;

  if (meta.decisionMakers?.length) {
    const rolesEmptyOrUnknown =
      buyerRole.length === 0 ||
      (buyerRole.length === 1 && isUnknownPlaceholder(String(buyerRole[0])));
    if (rolesEmptyOrUnknown) {
      buyerRole = [...meta.decisionMakers];
    }
  }
  out.buyer_role = buyerRole;
  out.buyerRole = buyerRole;

  return out;
}

/** Fields from a Profiler suggested ICP card used to overwrite placeholder customer_profile rows. */
export interface SuggestedIcpCardFields {
  name: string;
  regions: string[];
  industry: string;
  companySize: string;
  decisionMakers: string[];
  confidenceScore: "High" | "Medium" | "Low";
  segment?: string;
}

export function extractIcpsArrayFromCustomerProfileResponse(profileData: any): any[] {
  const data = profileData?.data ?? profileData;
  if (!data || typeof data !== "object") return [];
  const arr =
    (data as any).icps ??
    (data as any).customer_profiles?.icps ??
    (data as any).customer_profile?.icps ??
    [];
  return Array.isArray(arr) ? arr : [];
}

/**
 * Merge suggested-card firmographics into a single customer_profile row (API / GET shape).
 * Matches what users get when adding an ICP manually in Mission Control.
 */
export function mergeSuggestedIntoCustomerProfileApiRow(
  existing: any,
  suggested: SuggestedIcpCardFields,
): any {
  const regions = Array.isArray(suggested.regions) ? suggested.regions : [];
  const primary = regions[0] || existing.primary_region || existing.primaryRegion || "";
  const fit =
    suggested.confidenceScore === "High"
      ? "high"
      : suggested.confidenceScore === "Low"
        ? "low"
        : "medium";
  const existingCtx = String(
    existing.additional_context ?? existing.additionalContext ?? "",
  ).trim();
  const segmentLine = suggested.segment ? `Segment: ${suggested.segment}` : "";
  const additional_context = [existingCtx, segmentLine].filter(Boolean).join("\n");

  return {
    ...existing,
    name: suggested.name,
    primary_region: primary,
    primaryRegion: primary,
    location: regions.length ? regions : existing.location || [],
    industry: suggested.industry ? [suggested.industry] : existing.industry || [],
    company_size: suggested.companySize ? [suggested.companySize] : existing.company_size || [],
    companySize: suggested.companySize ? [suggested.companySize] : existing.companySize || [],
    buyer_role:
      Array.isArray(suggested.decisionMakers) && suggested.decisionMakers.length
        ? suggested.decisionMakers
        : existing.buyer_role || [],
    buyerRole:
      Array.isArray(suggested.decisionMakers) && suggested.decisionMakers.length
        ? suggested.decisionMakers
        : existing.buyerRole || [],
    fit_confidence: fit,
    fitConfidence: fit,
    additional_context,
    additionalContext: additional_context,
  };
}

/** Same POST body shape as ICPManager `saveCustomerProfileToBackend`. */
export function buildCustomerProfileSavePayload(icps: any[], orgId: string) {
  return {
    org_id: orgId,
    icps: icps.map((row: any) => ({
      id: row.id ?? row.icp_id,
      primary_region: row.primary_region ?? row.primaryRegion ?? "",
      location: Array.isArray(row.location) ? row.location : [],
      industry: Array.isArray(row.industry) ? row.industry : [],
      company_size: Array.isArray(row.company_size)
        ? row.company_size
        : Array.isArray(row.companySize)
          ? row.companySize
          : [],
      buyer_role: Array.isArray(row.buyer_role)
        ? row.buyer_role
        : Array.isArray(row.buyerRole)
          ? row.buyerRole
          : [],
      accounts_on_watchlist: Array.isArray(row.accounts_on_watchlist)
        ? row.accounts_on_watchlist
        : Array.isArray(row.accountsOnWatchlist)
          ? row.accountsOnWatchlist
          : [],
      accounts_to_avoid: Array.isArray(row.accounts_to_avoid)
        ? row.accounts_to_avoid
        : Array.isArray(row.accountsToAvoid)
          ? row.accountsToAvoid
          : [],
      fit_confidence: row.fit_confidence || row.fitConfidence || "medium",
      additional_context: row.additional_context || row.additionalContext || "",
      status: row.status || "saved",
      created_at:
        row.created_at ||
        (row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt) ||
        new Date().toISOString(),
    })),
  };
}

/** Aligns with ICPManager `loadCustomerProfileFromBackend` → localStorage `customerProfile`. */
export function mapCustomerProfileApiRowsToStoredIcps(icpsData: any[]): any[] {
  return icpsData.map((icp: any) => {
    const merged = mergeProfilerAcceptedIcpDisplay(icp);
    return {
      id: merged.id || merged.icp_id || `icp-${Date.now()}-${Math.random()}`,
      primaryRegion: merged.primary_region || merged.primaryRegion || "",
      location: Array.isArray(merged.location) ? merged.location : [],
      industry: Array.isArray(merged.industry) ? merged.industry : [],
      companySize: Array.isArray(merged.company_size)
        ? merged.company_size
        : Array.isArray(merged.companySize)
          ? merged.companySize
          : [],
      buyerRole: Array.isArray(merged.buyer_role)
        ? merged.buyer_role
        : Array.isArray(merged.buyerRole)
          ? merged.buyerRole
          : [],
      accountsOnWatchlist: Array.isArray(merged.accounts_on_watchlist)
        ? merged.accounts_on_watchlist
        : Array.isArray(merged.accountsOnWatchlist)
          ? merged.accountsOnWatchlist
          : [],
      accountsToAvoid: Array.isArray(merged.accounts_to_avoid)
        ? merged.accounts_to_avoid
        : Array.isArray(merged.accountsToAvoid)
          ? merged.accountsToAvoid
          : [],
      fitConfidence: merged.fit_confidence || merged.fitConfidence || "medium",
      additionalContext: merged.additional_context || merged.additionalContext || "",
      status: merged.status || "saved",
      createdAt: merged.created_at
        ? new Date(merged.created_at)
        : merged.createdAt
          ? new Date(merged.createdAt)
          : new Date(),
    };
  });
}

/** Resolve persisted profile row id after accept (response body, diff, or suggested id). */
export function resolveAcceptedPersistedIcpId(
  persistedFromResponse: string | undefined,
  idsBefore: Set<string>,
  idsAfter: string[],
  suggestedId: string,
): string | undefined {
  if (persistedFromResponse?.trim()) return persistedFromResponse.trim();
  const newOnes = idsAfter.filter((id) => !idsBefore.has(id));
  if (newOnes.length === 1) return newOnes[0];
  if (idsAfter.includes(suggestedId)) return suggestedId;
  return newOnes[0];
}
