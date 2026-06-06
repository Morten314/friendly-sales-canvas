import type { HeatmapLead } from "@/shared/lib/leadData";

const PREFIX = "leadStreamMarketScores_v1";

function leadStreamHeatmapCacheKey(userId: string, orgId: string): string {
  return `${PREFIX}:${userId}:${orgId}`;
}

function readFromStorage(storage: Storage | undefined, key: string): HeatmapLead[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    // Legacy: `[]` was often saved while scoring returned no rows yet — that made the table stay empty
    // (because `[] ?? sample` does not fall back). Treat as cache miss.
    if (parsed.length === 0) {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
      return null;
    }
    return parsed as HeatmapLead[];
  } catch {
    return null;
  }
}

/**
 * Last successful POST /leads/market-scores rows, keyed by user + org.
 * Uses `localStorage` so data survives tab close, browser restart, and re-login (same account).
 * On first read after upgrade, copies from legacy `sessionStorage` if present.
 */
export function readLeadStreamHeatmapFromSession(
  userId: string,
  orgId: string,
): HeatmapLead[] | null {
  if (typeof window === "undefined") return null;
  const key = leadStreamHeatmapCacheKey(userId, orgId);

  const fromLocal = readFromStorage(window.localStorage, key);
  if (fromLocal !== null) return fromLocal;

  const fromSession = readFromStorage(
    typeof sessionStorage !== "undefined" ? sessionStorage : undefined,
    key,
  );
  if (fromSession !== null) {
    writeLeadStreamHeatmapToSession(userId, orgId, fromSession);
    try {
      sessionStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    return fromSession;
  }

  return null;
}

export function writeLeadStreamHeatmapToSession(
  userId: string,
  orgId: string,
  leads: HeatmapLead[],
): void {
  if (typeof window === "undefined") return;
  const key = leadStreamHeatmapCacheKey(userId, orgId);
  try {
    if (leads.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(leads));
    }
  } catch (e) {
    console.warn("Lead stream heatmap local cache write failed:", e);
  }
  try {
    sessionStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
