import { RawLeadSchema, mapRawLead, type CustomerLead } from "../contracts";

import { apiGet } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/** GET /api/v2/leads?org_id=&limit=50&offset=0 — first page of an org's leads. */
export async function fetchLeads(orgId: string): Promise<CustomerLead[]> {
  const env = await apiGet(
    `v2/leads?org_id=${encodeURIComponent(orgId)}&${firstPageParams(50)}`,
    paginatedSchema(RawLeadSchema),
  );
  return (env.items ?? []).map(mapRawLead);
}
