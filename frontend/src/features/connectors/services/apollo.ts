import { apiGet, apiPost } from "@/shared/api/client";
import {
  ApolloDiscoverResponseSchema,
  ApolloDiscoverStatusSchema,
  ApolloStatusSchema,
  ApolloWarmupSchema,
  type ApolloDiscoverResponse,
  type ApolloDiscoverStatus,
  type ApolloStatus,
  type ApolloWarmup,
} from "../contracts";
import type { DiscoverMode } from "../types";

/** GET /api/connectors/apollo/status — connection + credit summary for the org. */
export async function fetchApolloStatus(orgId: string): Promise<ApolloStatus> {
  return apiGet(`connectors/apollo/status?org_id=${encodeURIComponent(orgId)}`, ApolloStatusSchema);
}

/** GET /api/connectors/apollo/warmup — ICP readiness gate for the org/user pair. */
export async function fetchApolloWarmup(orgId: string, userId: string): Promise<ApolloWarmup> {
  return apiGet(
    `connectors/apollo/warmup?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`,
    ApolloWarmupSchema,
  );
}

export interface StartDiscoverArgs {
  orgId: string;
  userId: string;
  mode: DiscoverMode;
  icpId?: string;
  maxLeads?: number;
}

/** POST /api/connectors/apollo/discover — enqueue a discovery run. Throws on non-2xx (incl. 409). */
export async function startApolloDiscover(
  args: StartDiscoverArgs,
): Promise<ApolloDiscoverResponse> {
  const body: Record<string, unknown> = {
    org_id: args.orgId,
    user_id: args.userId,
    mode: args.mode,
  };
  if (args.icpId) body.icp_id = args.icpId;
  if (typeof args.maxLeads === "number") body.max_leads = args.maxLeads;
  return apiPost("connectors/apollo/discover", body, ApolloDiscoverResponseSchema);
}

/** GET /api/connectors/apollo/discover/status — poll run progress. `runId` may be null to fetch latest. */
export async function fetchApolloDiscoverStatus(
  orgId: string,
  runId: string | null,
): Promise<ApolloDiscoverStatus> {
  const q = runId
    ? `org_id=${encodeURIComponent(orgId)}&run_id=${encodeURIComponent(runId)}`
    : `org_id=${encodeURIComponent(orgId)}`;
  return apiGet(`connectors/apollo/discover/status?${q}`, ApolloDiscoverStatusSchema);
}
