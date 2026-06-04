import {
  CustomerProfileResponseSchema,
  SuggestedIcpsResponseSchema,
  type SuggestedIcpsResponse,
} from "../contracts";

import { apiFetch, apiFetchJson, buildApiUrl, buildIcpUrl } from "@/lib/api";
import {
  buildCustomerProfileSavePayload,
  extractIcpsArrayFromCustomerProfileResponse,
  fetchIcpsRowsForOrg,
  mergeSuggestedIntoCustomerProfileApiRow,
  type SuggestedIcpCardFields,
} from "@/shared/profiler";

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

/** POST /api/customer_profile/from_suggested_icp — persist an accepted ICP. */
export function acceptSuggestedIcp(userId: string, orgId: string, icpId: string): Promise<unknown> {
  return apiFetchJson("customer_profile/from_suggested_icp", {
    method: "POST",
    body: { user_id: userId, org_id: orgId, icp_id: icpId },
  });
}

/**
 * Firmographics save after accept (parity port of
 * `persistAcceptedSuggestedIcpToBackend`): GET full profile → merge suggested
 * fields into the target row → POST the full icps[]. Returns ok/!ok; never throws.
 */
export async function saveAcceptedIcpFirmographics(options: {
  orgId: string;
  suggested: SuggestedIcpCardFields;
  targetIcpId: string;
}): Promise<boolean> {
  const { orgId, suggested, targetIcpId } = options;
  const profileUrl = buildApiUrl(`customer_profile?org_id=${encodeURIComponent(orgId)}`);
  try {
    const profileRes = await fetch(profileUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!profileRes.ok) return false;
    // Parse at the boundary with the permissive customer_profile contract
    // (Spec 26 §4). This is also the consumer that keeps
    // `CustomerProfileResponseSchema` from being a dead export under knip.
    const profileData = CustomerProfileResponseSchema.parse(await profileRes.json());
    const icpsData = extractIcpsArrayFromCustomerProfileResponse(profileData);
    if (!icpsData.length) return false;
    const idx = icpsData.findIndex((row) => String(row.id) === String(targetIcpId));
    if (idx < 0) return false;
    const nextIcps = [...icpsData];
    nextIcps[idx] = mergeSuggestedIntoCustomerProfileApiRow(icpsData[idx], suggested);
    const saveRes = await fetch(profileUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCustomerProfileSavePayload(nextIcps, orgId)),
    });
    return saveRes.ok;
  } catch {
    return false;
  }
}

/** DELETE /api/icp/recommended/{id} — reject/dismiss a recommended ICP. */
export function rejectRecommendedIcp(userId: string, icpId: string): Promise<Response> {
  return apiFetch(
    `icp/recommended/${encodeURIComponent(icpId)}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

/** DELETE /api/customer_profile/icp/{id} — delete an accepted/current ICP. */
export function deleteCurrentIcp(orgId: string, icpId: string): Promise<Response> {
  return apiFetch(
    `customer_profile/icp/${encodeURIComponent(icpId)}?org_id=${encodeURIComponent(orgId)}`,
    { method: "DELETE" },
  );
}
