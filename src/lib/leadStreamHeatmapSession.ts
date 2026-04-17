import type { HeatmapLead } from "@/components/market-research/lead-stream/leadData";

const PREFIX = "leadStreamMarketScores_v1";

export function leadStreamHeatmapCacheKey(userId: string, orgId: string): string {
  return `${PREFIX}:${userId}:${orgId}`;
}

/** Returns `null` if nothing cached; empty array means a prior refresh returned zero rows. */
export function readLeadStreamHeatmapFromSession(
  userId: string,
  orgId: string
): HeatmapLead[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(leadStreamHeatmapCacheKey(userId, orgId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as HeatmapLead[];
  } catch {
    return null;
  }
}

export function writeLeadStreamHeatmapToSession(
  userId: string,
  orgId: string,
  leads: HeatmapLead[]
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(leadStreamHeatmapCacheKey(userId, orgId), JSON.stringify(leads));
  } catch (e) {
    console.warn("Lead stream heatmap session cache write failed:", e);
  }
}
