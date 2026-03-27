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

export function saveProfilerAcceptedIcpDisplayMeta(icpId: string, meta: ProfilerAcceptedIcpDisplayMeta): void {
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
export function copyProfilerDisplayMetaToProfileId(suggestedIcpId: string, profileIcpId: string): void {
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
  const pr = String(icp?.primary_region ?? icp?.primaryRegion ?? "").trim().toLowerCase();
  const ind = Array.isArray(icp?.industry) ? icp.industry : [];
  const singleUnknown =
    ind.length === 1 && String(ind[0]).trim().toLowerCase() === "unknown";
  return pr === "global" && singleUnknown;
}

/**
 * Apply Profiler display merge only for placeholder rows. Mission Control loads normal ICPs
 * unchanged so manual geography/location are not mixed with suggested-ICP localStorage meta.
 */
export function mergeProfilerAcceptedIcpDisplayIfPlaceholder(icp: any): any {
  if (!icp?.id) return icp;
  if (!isProfilerPlaceholderIcp(icp)) return icp;
  return mergeProfilerAcceptedIcpDisplay(icp);
}

/**
 * Merge local accept-time metadata into a customer_profile ICP object (API shape).
 */
export function mergeProfilerAcceptedIcpDisplay(icp: any): any {
  if (!icp?.id) return icp;
  let meta: ProfilerAcceptedIcpDisplayMeta | null = null;
  try {
    const raw = localStorage.getItem(PROFILER_ICP_DISPLAY_KEY(icp.id));
    if (raw) meta = JSON.parse(raw);
  } catch {
    return icp;
  }
  if (!meta) return icp;

  const out = { ...icp };
  let primaryRegion = String(icp.primary_region || icp.primaryRegion || "");
  let location = Array.isArray(icp.location) ? [...icp.location] : [];
  let industry = Array.isArray(icp.industry) ? [...icp.industry] : [];
  let companySize = Array.isArray(icp.company_size)
    ? [...icp.company_size]
    : Array.isArray(icp.companySize)
      ? [...icp.companySize]
      : [];
  let buyerRole = Array.isArray(icp.buyer_role)
    ? [...icp.buyer_role]
    : Array.isArray(icp.buyerRole)
      ? [...icp.buyerRole]
      : [];

  // Location column: fill from suggested regions when API left location empty
  if (location.length === 0 && Array.isArray(meta.regions) && meta.regions.length > 0) {
    location = [...meta.regions];
  }

  // Geography: replace meaningless "global" with the first suggested region
  if (isGlobalPlaceholder(primaryRegion) && Array.isArray(meta.regions) && meta.regions.length > 0) {
    primaryRegion = meta.regions[0];
  }

  out.primary_region = primaryRegion;
  out.primaryRegion = primaryRegion;
  out.location = location;

  if (industry.length === 1 && isUnknownPlaceholder(String(industry[0])) && meta.industry) {
    industry = [meta.industry];
  }
  out.industry = industry;

  if (companySize.length === 1 && isUnknownPlaceholder(String(companySize[0])) && meta.companySize) {
    companySize = [meta.companySize];
  }
  out.company_size = companySize;
  out.companySize = companySize;

  if (buyerRole.length === 1 && isUnknownPlaceholder(String(buyerRole[0])) && meta.decisionMakers?.length) {
    buyerRole = [...meta.decisionMakers];
  }
  out.buyer_role = buyerRole;
  out.buyerRole = buyerRole;

  return out;
}
