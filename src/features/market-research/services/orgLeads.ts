import { z } from "zod";

import { heatmapLeadFromV2Lead } from "../lib/marketScoresHeatmap";

import { apiGet } from "@/shared/api/client";
import { pageParams, paginatedSchema } from "@/shared/api/pagination";
import type { HeatmapLead } from "@/shared/lib/leadData";

/**
 * Loose v2 lead row — only `lead_id` is required; the field-picking lives in
 * `heatmapLeadFromV2Lead` (the rows are flexible, per the data-layer rules).
 */
const V2LeadRowSchema = z.object({ lead_id: z.string() }).passthrough();

const PAGE = 500; // /api/v2/leads max page size
const MAX_PAGES = 20; // safety cap (10k leads) so a bad `total` can't loop forever

/**
 * Fetch ALL of an org's leads from `GET /api/v2/leads` through the shared data
 * layer (`apiGet` → JWT injection + the 30/min rate limiter + zod-validated
 * envelope), paging until `total` is reached, and map each to an UNscored
 * `HeatmapLead`. Used by the Scout Lead Stream so discovered/uploaded leads
 * surface regardless of whether a market-scoring run has happened.
 *
 * Replaces an earlier hand-rolled `fetch` that bypassed the data layer and
 * capped at a single 500-row page (impl-review-1 F1).
 */
export async function fetchAllOrgLeads(orgId: string): Promise<HeatmapLead[]> {
  const out: HeatmapLead[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const env = await apiGet(
      `v2/leads?org_id=${encodeURIComponent(orgId)}&${pageParams(PAGE, offset)}`,
      paginatedSchema(V2LeadRowSchema),
    );
    const items = env.items ?? [];
    for (const row of items) {
      const lead = heatmapLeadFromV2Lead(row as Record<string, unknown>);
      if (lead) out.push(lead);
    }
    offset += items.length;
    if (items.length < PAGE || offset >= (env.total ?? out.length)) break;
  }
  return out;
}
