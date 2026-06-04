import { DataSourceListSchema, LeadStreamStatusSchema } from "../contracts";
import type { LeadStreamFileApiRow } from "../types";

import { apiGet } from "@/shared/api/client";

/**
 * GET /api/user-documents — the org's uploaded data-source documents. Backend
 * returns a bare array or `{ documents|files|data }`. Returns the raw document
 * objects; DataSourcesManager maps them to `DataSource[]` (mapping stays in the
 * component this phase — stage 5).
 */
export async function fetchDataSources(orgId: string): Promise<unknown[]> {
  const json = await apiGet(
    `user-documents?org_id=${encodeURIComponent(orgId)}`,
    DataSourceListSchema,
  );
  if (Array.isArray(json)) return json;
  return json.documents ?? json.files ?? json.data ?? [];
}

/** GET /api/leads/stream/status — uploaded lead-stream files + processing stats. */
export async function fetchLeadStreamStatus(
  userId: string,
  orgId: string,
): Promise<LeadStreamFileApiRow[]> {
  const qs = new URLSearchParams({ user_id: userId, org_id: orgId });
  const json = await apiGet(`leads/stream/status?${qs.toString()}`, LeadStreamStatusSchema);
  // Cast: Zod infers `null | undefined` for `.nullish()` fields; the interface
  // uses `string | undefined`. Both describe the same backend shape; the cast is
  // safe — null values pass through identically at runtime.
  if (Array.isArray(json)) return json as LeadStreamFileApiRow[];
  return (json.files ?? []) as LeadStreamFileApiRow[];
}
