import { z } from "zod";
import type { ZodType } from "zod";

import {
  ApolloDiscoverResponseSchema,
  ApolloDiscoverStatusSchema,
  ApolloStatusSchema,
  ApolloWarmupSchema,
  DisconnectResponseSchema,
  type ApolloDiscoverResponse,
  type ApolloDiscoverStatus,
  type ApolloStatus,
  type ApolloWarmup,
  type DisconnectResponse,
} from "../contracts";
import type { ApolloConnectErrorShape, DiscoverMode } from "../types";

import { apiGet, apiRequest } from "@/shared/api/client";
import { buildApiUrl } from "@/shared/api/transport";

/** GET /api/connectors/apollo/status — connection + credit summary for the org. */
export async function fetchApolloStatus(orgId: string): Promise<ApolloStatus> {
  return apiGet(
    `connectors/apollo/status?org_id=${encodeURIComponent(orgId)}`,
    ApolloStatusSchema as ZodType<ApolloStatus>,
  );
}

/** GET /api/connectors/apollo/warmup — ICP readiness gate for the org/user pair. */
export async function fetchApolloWarmup(orgId: string, userId: string): Promise<ApolloWarmup> {
  return apiGet(
    `connectors/apollo/warmup?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`,
    ApolloWarmupSchema as ZodType<ApolloWarmup>,
  );
}

export interface StartDiscoverArgs {
  orgId: string;
  userId: string;
  mode: DiscoverMode;
  icpId?: string;
  maxLeads?: number;
}

/** Typed error for the discover enqueue path so the tile can branch on the documented codes. */
export class ApolloDiscoverError extends Error {
  httpStatus: number;
  code?: string;
  detail?: string;
  constructor(opts: { httpStatus: number; code?: string; detail?: string }) {
    super(opts.detail || `Apollo discovery failed (${opts.httpStatus})`);
    Object.setPrototypeOf(this, ApolloDiscoverError.prototype);
    this.name = "ApolloDiscoverError";
    this.httpStatus = opts.httpStatus;
    this.code = opts.code;
    this.detail = opts.detail;
  }
}

/**
 * POST /api/connectors/apollo/discover — enqueue a discovery run.
 *
 * Uses raw fetch (not apiPost) so the documented error codes — 409 `discovery_in_progress`,
 * 422 `icp_underspecified` — can be parsed from the JSON body and surfaced to the user,
 * mirroring the connect path (G1: apiPost throws a generic Error and drops the body). Success
 * is still zod-validated.
 */
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
  const res = await fetch(buildApiUrl("connectors/apollo/discover"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON error body — leave parsed empty */
    }
    throw new ApolloDiscoverError({
      httpStatus: res.status,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
    });
  }
  return ApolloDiscoverResponseSchema.parse(await res.json());
}

/** GET /api/connectors/apollo/discover/status — poll run progress. `runId` may be null to fetch latest. */
export async function fetchApolloDiscoverStatus(
  orgId: string,
  runId: string | null,
): Promise<ApolloDiscoverStatus> {
  const q = runId
    ? `org_id=${encodeURIComponent(orgId)}&run_id=${encodeURIComponent(runId)}`
    : `org_id=${encodeURIComponent(orgId)}`;
  return apiGet(
    `connectors/apollo/discover/status?${q}`,
    ApolloDiscoverStatusSchema as ZodType<ApolloDiscoverStatus>,
  );
}

// ─── Connect + Export ────────────────────────────────────────────────────────

export class ApolloConnectError extends Error implements ApolloConnectErrorShape {
  httpStatus: number;
  code?: string;
  detail?: string;
  missing_section?: string;
  constructor(shape: ApolloConnectErrorShape) {
    super(shape.detail || `Apollo connect failed (${shape.httpStatus})`);
    Object.setPrototypeOf(this, ApolloConnectError.prototype);
    this.name = "ApolloConnectError";
    this.httpStatus = shape.httpStatus;
    this.code = shape.code;
    this.detail = shape.detail;
    this.missing_section = shape.missing_section;
  }
}

export interface ConnectApolloArgs {
  orgId: string;
  userId: string;
  apiKey: string;
}

const ConnectOkSchema = z.object({ connected: z.boolean(), status: z.string() }).passthrough();

/**
 * POST /api/connectors/apollo/connect — save + verify an Apollo API key.
 *
 * Uses raw fetch (not apiPost) so the error JSON body ({code, missing_section}) can be
 * parsed and surfaced as a typed ApolloConnectError (G1). The connect modal branches on
 * `code` to deep-link the user to the right fix (profile_incomplete, master_key_required, etc.).
 */
export async function connectApollo(
  args: ConnectApolloArgs,
): Promise<{ connected: boolean; status: string }> {
  const res = await fetch(buildApiUrl("connectors/apollo/connect"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: args.orgId, user_id: args.userId, api_key: args.apiKey }),
  });
  if (!res.ok) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON error body — leave parsed empty */
    }
    throw new ApolloConnectError({
      httpStatus: res.status,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
      missing_section:
        typeof parsed.missing_section === "string" ? parsed.missing_section : undefined,
    });
  }
  return ConnectOkSchema.parse(await res.json());
}

/**
 * Build a proxied URL for the leads export endpoint (G2).
 *
 * The export endpoint returns raw bytes (CSV or JSON), not a JSON envelope, so we
 * build a URL here rather than using apiGet+zod. Tasks downstream trigger a browser
 * download by assigning this URL to an anchor or calling fetch() directly.
 */
export function apolloLeadsExportUrl(orgId: string, format: "json" | "csv"): string {
  return buildApiUrl(
    `connectors/apollo/leads/export?org_id=${encodeURIComponent(orgId)}&format=${format}`,
  );
}

/** DELETE /api/connectors/apollo/connect — remove stored Apollo credentials for the org. */
export async function disconnectApollo(orgId: string): Promise<DisconnectResponse> {
  return apiRequest(
    `connectors/apollo/connect?org_id=${encodeURIComponent(orgId)}`,
    DisconnectResponseSchema,
    { method: "DELETE" },
  );
}
