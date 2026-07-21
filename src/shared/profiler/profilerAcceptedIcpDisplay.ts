/**
 * When POST /customer_profile/from_suggested_icp persists an ICP, the API may store
 * placeholders (primaryRegion "global", industry "unknown", empty location[]).
 * We save the rich Profiler suggested-ICP fields at accept time and merge them
 * when rendering Mission Control + Profiler Current ICPs.
 */

import type { UntypedProfilerIcpRecord } from "@/shared/types/escape-hatches";

export const PROFILER_ICP_DISPLAY_KEY = (icpId: string) => `profiler_icp_display_${icpId}`;

/**
 * Untyped backend ICP row. Both API and localStorage shapes are loose records
 * with mixed snake/camel aliases; callers narrow per-field with `??` defaults
 * and `Array.isArray` guards.
 *
 * The exported merge / build helpers cross into `ICPManager.tsx` and
 * `SuggestedICPCards.tsx`, which still consume returned fields under
 * legacy `any` accesses (`merged.primary_region || ...`). Tightening the
 * return to `unknown` cascades into those call sites; until those callers
 * are themselves typed (Wave C continues per area), use the
 * `UntypedProfilerIcpRecord` escape-hatch.
 */
type IcpRecord = UntypedProfilerIcpRecord;
type ApiPayload = Record<string, unknown> | null | undefined;

/** Coerce an unknown to a non-empty string, returning "" otherwise. */
const asString = (v: unknown): string => (v == null ? "" : String(v));
/** Pick the first truthy string-coercible value from a list. */
const firstString = (...vs: unknown[]): string => {
  for (const v of vs) {
    const s = asString(v);
    if (s) return s;
  }
  return "";
};
/** Narrow unknown array to unknown[] (or empty). */
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

interface ProfilerAcceptedIcpDisplayMeta {
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

function pickIcpNameFromRecord(icp: IcpRecord): string {
  const raw =
    icp.name ?? icp.icp_name ?? icp.icpName ?? icp.title ?? icp.display_name ?? icp.displayName;
  return raw != null ? String(raw).trim() : "";
}

/**
 * Best-effort parse of POST /customer_profile/from_suggested_icp JSON so we can key
 * local display metadata under the persisted profile ICP id (often differs from suggested id).
 */
export function extractPersistedIcpIdFromSuggestedProfileResponse(
  res: unknown,
): string | undefined {
  if (res == null || typeof res !== "object") return undefined;
  const root = res as Record<string, unknown>;
  const d = (root.data as ApiPayload) ?? root;
  if (d == null || typeof d !== "object") return undefined;

  const tryStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  const direct =
    tryStr(d.id) ??
    tryStr(d.icp_id) ??
    tryStr(d.icpId) ??
    tryStr(d.persisted_icp_id) ??
    tryStr(d.customer_profile_icp_id);
  if (direct) return direct;

  const icpObj = d.icp;
  if (icpObj && typeof icpObj === "object") {
    const nested =
      tryStr((icpObj as Record<string, unknown>).id) ??
      tryStr((icpObj as Record<string, unknown>).icp_id) ??
      tryStr((icpObj as Record<string, unknown>).icpId);
    if (nested) return nested;
  }

  const icps = d.icps;
  if (Array.isArray(icps) && icps.length > 0) {
    const last = icps[icps.length - 1];
    const id =
      last && typeof last === "object" ? tryStr((last as Record<string, unknown>).id) : undefined;
    if (id) return id;
  }

  const cp = (d.customer_profile ?? d.customer_profiles) as ApiPayload;
  if (cp && typeof cp === "object") {
    const nested = (cp as Record<string, unknown>).icps;
    if (Array.isArray(nested) && nested.length > 0) {
      const last = nested[nested.length - 1];
      const id =
        last && typeof last === "object" ? tryStr((last as Record<string, unknown>).id) : undefined;
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

/** Backend GET may return `icp_id` (or aliases) while local merge/display key on `id`. */
function resolveCustomerProfileIcpId(icp: IcpRecord): string {
  const candidates = [icp.id, icp.icp_id, icp.customer_profile_icp_id, icp.icpId];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") return String(c).trim();
  }
  return "";
}

/**
 * Merge local accept-time metadata into a customer_profile ICP object (API shape).
 */
export function mergeProfilerAcceptedIcpDisplay(icp: IcpRecord): IcpRecord {
  const resolvedId = resolveCustomerProfileIcpId(icp);
  if (!resolvedId) return icp;
  const icpWithId: IcpRecord = icp.id === resolvedId ? icp : { ...icp, id: resolvedId };
  let meta: ProfilerAcceptedIcpDisplayMeta | null = null;
  try {
    const raw = localStorage.getItem(PROFILER_ICP_DISPLAY_KEY(resolvedId));
    if (raw) meta = JSON.parse(raw) as ProfilerAcceptedIcpDisplayMeta;
  } catch {
    return icpWithId;
  }
  if (!meta) return icpWithId;

  const out: IcpRecord = { ...icpWithId, id: resolvedId };
  let primaryRegion = String(icpWithId.primary_region || icpWithId.primaryRegion || "");
  let location: string[] = Array.isArray(icpWithId.location)
    ? [...(icpWithId.location as string[])]
    : [];
  let industry: string[] = Array.isArray(icpWithId.industry)
    ? [...(icpWithId.industry as string[])]
    : [];
  let companySize: string[] = Array.isArray(icpWithId.company_size)
    ? [...(icpWithId.company_size as string[])]
    : Array.isArray(icpWithId.companySize)
      ? [...(icpWithId.companySize as string[])]
      : [];
  let buyerRole: string[] = Array.isArray(icpWithId.buyer_role)
    ? [...(icpWithId.buyer_role as string[])]
    : Array.isArray(icpWithId.buyerRole)
      ? [...(icpWithId.buyerRole as string[])]
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

export function extractIcpsArrayFromCustomerProfileResponse(profileData: unknown): IcpRecord[] {
  const root =
    profileData && typeof profileData === "object"
      ? (profileData as Record<string, unknown>)
      : null;
  const data =
    (root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null) ??
    root;
  if (!data) return [];
  const profilesPlural = data.customer_profiles as Record<string, unknown> | undefined;
  const profileSingular = data.customer_profile as Record<string, unknown> | undefined;
  const arr = data.icps ?? profilesPlural?.icps ?? profileSingular?.icps ?? [];
  return Array.isArray(arr) ? (arr as IcpRecord[]) : [];
}

/**
 * Merge suggested-card firmographics into a single customer_profile row (API / GET shape).
 * Matches what users get when adding an ICP manually in Mission Control.
 */
export function mergeSuggestedIntoCustomerProfileApiRow(
  existing: IcpRecord,
  suggested: SuggestedIcpCardFields,
): IcpRecord {
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
export function buildCustomerProfileSavePayload(icps: IcpRecord[], orgId: string) {
  return {
    org_id: orgId,
    icps: icps.map((row: IcpRecord) => ({
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

/**
 * Mapped ICP shape returned to localStorage `customerProfile`. Aligns 1:1 with
 * ICPManager's local `ICP` interface, so the same array also flows into the
 * SuggestedICPCards display projection (`name`, `geography`, …).
 */
export interface MappedStoredIcp {
  id: string;
  primaryRegion: string;
  location: unknown[];
  industry: unknown[];
  companySize: unknown[];
  buyerRole: unknown[];
  accountsOnWatchlist: unknown[];
  accountsToAvoid: unknown[];
  fitConfidence: string;
  additionalContext: string;
  status: string;
  createdAt: Date;
}

/** Aligns with ICPManager `loadCustomerProfileFromBackend` → localStorage `customerProfile`. */
export function mapCustomerProfileApiRowsToStoredIcps(icpsData: IcpRecord[]): MappedStoredIcp[] {
  return icpsData.map((icp: IcpRecord): MappedStoredIcp => {
    const merged = mergeProfilerAcceptedIcpDisplay(icp);
    const createdAtRaw = merged.created_at ?? merged.createdAt;
    const createdAt =
      createdAtRaw instanceof Date
        ? createdAtRaw
        : typeof createdAtRaw === "string" || typeof createdAtRaw === "number"
          ? new Date(createdAtRaw)
          : new Date();
    return {
      id: firstString(merged.id, merged.icp_id) || `icp-${Date.now()}-${Math.random()}`,
      primaryRegion: firstString(merged.primary_region, merged.primaryRegion),
      location: asArray(merged.location),
      industry: asArray(merged.industry),
      companySize: asArray(merged.company_size).length
        ? asArray(merged.company_size)
        : asArray(merged.companySize),
      buyerRole: asArray(merged.buyer_role).length
        ? asArray(merged.buyer_role)
        : asArray(merged.buyerRole),
      accountsOnWatchlist: asArray(merged.accounts_on_watchlist).length
        ? asArray(merged.accounts_on_watchlist)
        : asArray(merged.accountsOnWatchlist),
      accountsToAvoid: asArray(merged.accounts_to_avoid).length
        ? asArray(merged.accounts_to_avoid)
        : asArray(merged.accountsToAvoid),
      fitConfidence: firstString(merged.fit_confidence, merged.fitConfidence) || "medium",
      additionalContext: firstString(merged.additional_context, merged.additionalContext),
      status: firstString(merged.status) || "saved",
      createdAt,
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
