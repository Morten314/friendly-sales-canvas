import { z } from "zod";

import { LeadStreamStatusSchema } from "../contracts";
import type { LeadStreamFileApiRow } from "../types";

import { apiGet } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/user-documents — the org's uploaded data-source documents.
 * Returns the raw document objects; DataSourcesManager maps them to
 * `DataSource[]` (mapping stays in the component this phase — stage 5).
 */
export async function fetchDataSources(orgId: string): Promise<unknown[]> {
  const env = await apiGet(
    `v2/user-documents?org_id=${encodeURIComponent(orgId)}&${firstPageParams(500)}`,
    paginatedSchema(z.unknown()),
  );
  const items = env.items ?? [];
  if (items.length > 0) return items;
  // Passthrough envelope may still carry a legacy v1 `files` array on some paths.
  const legacy = env as { files?: unknown[]; documents?: unknown[]; data?: unknown[] };
  return legacy.files ?? legacy.documents ?? legacy.data ?? [];
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
