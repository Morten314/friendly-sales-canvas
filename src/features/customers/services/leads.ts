import { RawLeadSchema, mapRawLead, type CustomerLead } from "../contracts";

import { apiGet } from "@/shared/api/client";
import { pageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/leads?org_id=&limit=50&offset=<n> — one offset page of an org's
 * leads. Returns `{ items, total }` so callers can drive an infinite pager
 * (TD-FE-70); `total` is the true DB count from the v2 envelope (TD-FE-67).
 */
export async function fetchLeads(
  orgId: string,
  offset = 0,
  limit = 50,
): Promise<{ items: CustomerLead[]; total: number }> {
  const env = await apiGet(
    `v2/leads?org_id=${encodeURIComponent(orgId)}&${pageParams(limit, offset)}`,
    paginatedSchema(RawLeadSchema),
  );
  return { items: (env.items ?? []).map(mapRawLead), total: env.total ?? 0 };
}
