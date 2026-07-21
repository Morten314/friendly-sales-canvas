import { z } from "zod";

import {
  CustomerProfileResponseSchema,
  SuggestedIcpsResponseSchema,
  type SuggestedIcpsResponse,
} from "../contracts";

import { apiPost } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";
import { apiFetch, apiFetchJson, buildApiUrl } from "@/shared/api/transport";
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

/** Canonical backend component_name values for POST `/icp-research_claude`. */
export const ICP_RESEARCH_COMPONENTS = {
  summary: "icp summary & market opportunity",
  buyerMap: "buyer map & roles, pain points, triggers",
  competitive: "competitive overlap & buying signals",
  regulatory: "regulatory, compliance & recommended icp",
} as const;
export type IcpResearchComponentName =
  (typeof ICP_RESEARCH_COMPONENTS)[keyof typeof ICP_RESEARCH_COMPONENTS];

const IcpResearchComponentSchema = z
  .object({
    status: z.string(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

/** Fetch one ICP research component (POST `/icp-research_claude`). */
export function fetchIcpResearchComponent(
  userId: string,
  componentName: IcpResearchComponentName,
  opts: { orgId?: string; data?: Record<string, unknown>; refresh?: boolean } = {},
): Promise<z.infer<typeof IcpResearchComponentSchema>> {
  return apiPost(
    "icp-research_claude",
    {
      user_id: userId,
      ...(opts.orgId !== undefined && { org_id: opts.orgId }),
      component_name: componentName,
      data: opts.data ?? {},
      refresh: opts.refresh ?? false,
    },
    IcpResearchComponentSchema,
  );
}

/** Run all four ICP research components in sequence (Profiler refresh / deep-dive). */
export async function runIcpResearchRefreshCascade(userId: string, orgId?: string): Promise<void> {
  let previousContext: Record<string, unknown> = {};
  for (const componentName of Object.values(ICP_RESEARCH_COMPONENTS)) {
    const response = await fetchIcpResearchComponent(userId, componentName, {
      orgId,
      data: previousContext,
      refresh: true,
    });
    previousContext = { ...previousContext, ...response.data };
  }
}

/**
 * Recommended ICPs read — GET /api/v2/icp (Spec 34 Task 4). Routes through
 * `buildApiUrl` → `/api` proxy (no longer direct-host). Decodes the v2
 * paginated envelope and re-wraps to `{ suggestedICPs: items }` before the
 * schema parse; the consumer normalizes (`normalizeIcpGetResponse`) + maps
 * (`mapApiICPToSuggested`).
 */
export async function fetchSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean; orgId?: string } = {},
): Promise<SuggestedIcpsResponse & { total: number }> {
  const params = new URLSearchParams({ user_id: userId });
  if (opts.refresh) params.set("refresh", "true");
  if (opts.orgId) params.set("org_id", opts.orgId);
  const res = await fetch(buildApiUrl(`v2/icp?${params.toString()}&${firstPageParams(500)}`), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `GET /icp failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }
  const env = paginatedSchema(z.unknown()).parse(await res.json());
  return {
    ...SuggestedIcpsResponseSchema.parse({ suggestedICPs: env.items }),
    total: env.total,
  };
}

/** Refresh with fallback: if regenerate fails, load the last cached list instead. */
export async function fetchSuggestedIcpsWithRefreshFallback(
  userId: string,
  orgId: string,
  refresh: boolean,
): Promise<{ data: SuggestedIcpsResponse; usedCachedFallback: boolean }> {
  if (!refresh) {
    return { data: await fetchSuggestedIcps(userId, { orgId }), usedCachedFallback: false };
  }
  try {
    return {
      data: await fetchSuggestedIcps(userId, { orgId, refresh: true }),
      usedCachedFallback: false,
    };
  } catch {
    return {
      data: await fetchSuggestedIcps(userId, { orgId, refresh: false }),
      usedCachedFallback: true,
    };
  }
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
