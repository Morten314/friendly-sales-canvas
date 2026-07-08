import type { PendingRecommendedRejectItem, DismissedRecommendedStore } from "../../types";

const PROFILER_PENDING_RECOMMENDED_REJECT_KEY = "profiler_pendingRecommendedRejects";
export const PROFILER_DISMISSED_RECOMMENDED_IDS_KEY = "profiler_dismissedRecommendedIcpIds";

/**
 * Recommended ICPs (and their per-card statuses) are per-user — the backend
 * `ICP_config` store is keyed by user_id — so their client caches are uid-scoped,
 * never global, so one user's recommendations don't leak to another on a shared
 * browser. Customer-Profile / Current ICPs are org-scoped instead (see cacheUtils
 * getOrgLocalStorage); do not conflate the two.
 */
export const profilerRecommendedCacheKey = (userId: string | null | undefined): string =>
  userId ? `profiler_recommendedICPs_${userId}` : "profiler_recommendedICPs";

export const profilerCardStatusesKey = (userId: string | null | undefined): string =>
  userId ? `profiler_cardStatuses_${userId}` : "profiler_cardStatuses";

export function readPendingRecommendedRejects(): PendingRecommendedRejectItem[] {
  try {
    const raw = localStorage.getItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { items?: PendingRecommendedRejectItem[] };
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

function writePendingRecommendedRejects(items: PendingRecommendedRejectItem[]) {
  localStorage.setItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY, JSON.stringify({ items }));
}

export function upsertPendingRecommendedReject(
  icp_id: string,
  user_id: string,
  expiresAt: number,
  icpSnapshot: object,
) {
  const next = readPendingRecommendedRejects().filter((x) => x.icp_id !== icp_id);
  next.push({
    icp_id,
    user_id,
    expiresAt,
    icpSnapshot: JSON.parse(JSON.stringify(icpSnapshot)),
  });
  writePendingRecommendedRejects(next);
}

export function removePendingRecommendedReject(icp_id: string) {
  const next = readPendingRecommendedRejects().filter((x) => x.icp_id !== icp_id);
  writePendingRecommendedRejects(next);
}

function readDismissedRecommendedStore(): DismissedRecommendedStore {
  try {
    const raw = localStorage.getItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as DismissedRecommendedStore;
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

export function readDismissedRecommendedIds(userId: string | undefined): Set<string> {
  if (!userId) return new Set();
  const arr = readDismissedRecommendedStore()[userId];
  return new Set(Array.isArray(arr) ? arr : []);
}

export function recordDismissedRecommendedIcp(userId: string, icpId: string) {
  const store = readDismissedRecommendedStore();
  const prev = store[userId] ?? [];
  if (prev.includes(icpId)) return;
  store[userId] = [...prev, icpId];
  localStorage.setItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY, JSON.stringify(store));
}

export function removeFromProfilerRecommendedCached(
  userId: string | null | undefined,
  icpId: string,
) {
  const key = profilerRecommendedCacheKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    const next = parsed.filter((x: { id?: string }) => String(x?.id) !== String(icpId));
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function filterDismissedFromSuggested<T extends { id: string }>(
  userId: string | undefined,
  refined: T[],
  newSuggestions: T[],
): { refined: T[]; newSuggestions: T[] } {
  const dismissed = readDismissedRecommendedIds(userId);
  if (dismissed.size === 0) return { refined, newSuggestions };
  return {
    refined: refined.filter((x) => !dismissed.has(x.id)),
    newSuggestions: newSuggestions.filter((x) => !dismissed.has(x.id)),
  };
}

export function isRecommendedDeleteNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\b404\b/.test(error.message) || /not found/i.test(error.message);
}
