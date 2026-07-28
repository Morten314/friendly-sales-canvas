import { z } from "zod";

import { LeadStreamStatusSchema } from "../contracts";
import type { LeadStreamFileApiRow } from "../types";

import { apiGet } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/user-documents — the org's uploaded data-source documents.
 * Returns `{ items, total }` from the v2 envelope; `useDataSources` selects
 * `items` so its `.data` stays a bare array for existing consumers (TD-FE-67).
 */
export async function fetchDataSources(
  orgId: string,
): Promise<{ items: unknown[]; total: number }> {
  const env = await apiGet(
    `v2/user-documents?org_id=${encodeURIComponent(orgId)}&${firstPageParams(500)}`,
    paginatedSchema(z.unknown()),
  );
  const items: unknown[] = env.items ?? [];
  return { items, total: env.total ?? 0 };
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
