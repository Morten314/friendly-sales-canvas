import { SuggestedIcpsResponseSchema, type SuggestedIcpsResponse } from "../contracts";

import { buildIcpUrl } from "@/lib/api";
import { fetchIcpsRowsForOrg } from "@/shared/profiler";

/**
 * Current ICPs read — GET /api/customer_profile via the shared extractor (same
 * source Mission Control uses). Returns RAW rows; the container maps them with
 * `mapCustomerProfileICPToExisting`. Customers keeps its OWN read and does NOT
 * adopt mission-control's `useICPs` (Spec 26 §4; overlap tracked TD-FE-42).
 */
export function fetchCustomerProfileIcps(userId: string, orgId: string): Promise<unknown[]> {
  return fetchIcpsRowsForOrg(userId, orgId);
}

/**
 * Recommended ICPs read — GET /icp. Parity-critical: `buildIcpUrl` resolves to
 * the DIRECT backend host (not the `/api` proxy), so we raw-`fetch` that exact
 * URL. The permissive schema `.parse`s the body at the boundary; the consumer
 * normalizes (`normalizeIcpGetResponse`) + maps (`mapApiICPToSuggested`).
 */
export async function fetchSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<SuggestedIcpsResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(buildIcpUrl(params.toString()), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /icp failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return SuggestedIcpsResponseSchema.parse(json);
}
