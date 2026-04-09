/**
 * Session cache for Mission Control so revisiting the page after client-side
 * navigation does not re-hit the same GET endpoints.
 * Backed by sessionStorage so dev HMR / module reload does not drop the cache.
 * Cleared when the browser tab closes; keyed by user + org.
 */

export type MissionControlSessionCacheEntry = {
  userId: string;
  orgId: string;
  /** Last successful GET /api/profile/company JSON body, or null if 404 / empty */
  companyProfileResponse: Record<string, unknown> | null;
  profileLoadCompleted: boolean;
  isCompanyProfileSaved: boolean;
  hasDataSources: boolean;
  customerProfileCheckDone: boolean;
  isCustomerProfileSaved: boolean;
  /** Customer profile (ICP) tab: first load done; JSON snapshot for instant revisit */
  icpManagerLoadCompleted?: boolean;
  icpsSnapshotJson?: string | null;
  /** Data sources tab: first load done; JSON snapshot for instant revisit */
  dataSourcesManagerLoadCompleted?: boolean;
  dataSourcesSnapshotJson?: string | null;
  /** Profiler page: first load done; JSON snapshot (current ICPs + suggested cards + card statuses) */
  profilerPageLoadCompleted?: boolean;
  profilerUiSnapshotJson?: string | null;
  /** Signals page: first load done; JSON snapshot (pre-reject list + API vs fallback flag) */
  signalsPageLoadCompleted?: boolean;
  signalsSnapshotJson?: string | null;
};

const store = new Map<string, MissionControlSessionCacheEntry>();

/** Bump when cache shape or semantics change (invalidates stale sessionStorage). */
const STORAGE_PREFIX = "mc_session_v5:";

function cacheKey(userId: string, orgId: string): string {
  return `${userId}::${orgId}`;
}

function persistEntry(key: string, entry: MissionControlSessionCacheEntry): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota / private mode
  }
}

function readPersisted(key: string): MissionControlSessionCacheEntry | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw) as MissionControlSessionCacheEntry;
  } catch {
    return undefined;
  }
}

export function getMissionControlSessionCache(
  userId: string,
  orgId: string
): MissionControlSessionCacheEntry | undefined {
  const k = cacheKey(userId, orgId);
  let entry = store.get(k);
  if (!entry) {
    entry = readPersisted(k);
    if (entry) {
      store.set(k, entry);
    }
  }
  return entry;
}

/** Called when GET company profile finishes (success or expected 404). Preserves customer-profile fields if already written. */
export function setCompanyProfileSessionCache(
  userId: string,
  orgId: string,
  partial: Pick<
    MissionControlSessionCacheEntry,
    "companyProfileResponse" | "isCompanyProfileSaved" | "hasDataSources"
  > & { profileLoadCompleted: true }
): void {
  const k = cacheKey(userId, orgId);
  const prev = getMissionControlSessionCache(userId, orgId);
  const next: MissionControlSessionCacheEntry = {
    ...(prev ?? {
      userId,
      orgId,
      companyProfileResponse: null,
      profileLoadCompleted: false,
      isCompanyProfileSaved: false,
      hasDataSources: false,
      customerProfileCheckDone: false,
      isCustomerProfileSaved: false,
    }),
    userId,
    orgId,
    companyProfileResponse: partial.companyProfileResponse,
    profileLoadCompleted: true,
    isCompanyProfileSaved: partial.isCompanyProfileSaved,
    hasDataSources: partial.hasDataSources,
    customerProfileCheckDone: prev?.customerProfileCheckDone ?? false,
    isCustomerProfileSaved: prev?.isCustomerProfileSaved ?? false,
  };
  store.set(k, next);
  persistEntry(k, next);
}

/** Merge fields after customer profile GET, saves, or UI events. */
export function mergeMissionControlSessionCache(
  userId: string,
  orgId: string,
  patch: Partial<
    Pick<
      MissionControlSessionCacheEntry,
      | "customerProfileCheckDone"
      | "isCustomerProfileSaved"
      | "isCompanyProfileSaved"
      | "hasDataSources"
      | "icpManagerLoadCompleted"
      | "icpsSnapshotJson"
      | "dataSourcesManagerLoadCompleted"
      | "dataSourcesSnapshotJson"
      | "profilerPageLoadCompleted"
      | "profilerUiSnapshotJson"
      | "signalsPageLoadCompleted"
      | "signalsSnapshotJson"
    >
  >
): void {
  const k = cacheKey(userId, orgId);
  const prev = getMissionControlSessionCache(userId, orgId);
  if (!prev) {
    const created: MissionControlSessionCacheEntry = {
      userId,
      orgId,
      companyProfileResponse: null,
      profileLoadCompleted: false,
      isCompanyProfileSaved: patch.isCompanyProfileSaved ?? false,
      hasDataSources: patch.hasDataSources ?? false,
      customerProfileCheckDone: patch.customerProfileCheckDone ?? false,
      isCustomerProfileSaved: patch.isCustomerProfileSaved ?? false,
      ...patch,
    };
    store.set(k, created);
    persistEntry(k, created);
    return;
  }
  const merged = { ...prev, ...patch };
  store.set(k, merged);
  persistEntry(k, merged);
}
