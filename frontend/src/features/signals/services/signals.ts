import { z } from "zod";
import type { ZodType } from "zod";

import {
  GenerateSignalsBatchResponseSchema,
  SignalLeadMapResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
  type SignalLeadMapResponse,
} from "../contracts";

import { apiGet, apiPost } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/fetch-signals?user_id=&limit=10&offset=0 — page-only read.
 * Parses the v2 paginated envelope and re-wraps to { signals } for consumers.
 * The consumer (Task 12) normalizes via `buildSignalCardsFromFetchData`.
 */
export async function fetchSignals(userId: string): Promise<FetchSignalsResponse> {
  const env = await apiGet(
    `v2/fetch-signals?user_id=${encodeURIComponent(userId)}&${firstPageParams(10)}`,
    paginatedSchema(z.unknown()),
  );
  return { signals: env.items };
}

/**
 * POST /api/generate-signals-batch_claude — page-only. The body shape is lifted
 * verbatim from SignalsPage (a hardcoded `component_name: "test"` probe with a
 * fixed firmographics `data` block and `refresh: true`).
 */
export async function generateSignalsBatch(userId: string): Promise<GenerateSignalsBatchResponse> {
  return apiPost(
    "generate-signals-batch_claude",
    {
      user_id: userId,
      component_name: "test",
      data: {
        industry: "SaaS",
        companySize: "50-200 employees",
        companyUrl: "https://example.com",
        strategicGoals: "Market expansion",
        primaryGTMModel: "Direct sales",
        revenueStage: "Growth",
        keyBuyerPersona: "CTO",
        targetMarkets: ["North America", "Europe"],
      },
      refresh: true,
    },
    GenerateSignalsBatchResponseSchema,
  );
}

/**
 * POST /api/signal-lead-map_claude — one read-time mapping over the org's
 * newest-50 signals × leads. `refresh` forces a recompute past the cache.
 */
export async function fetchSignalLeadMap(
  userId: string,
  orgId: string,
  opts: { refresh?: boolean } = {},
): Promise<SignalLeadMapResponse> {
  return apiPost(
    "signal-lead-map_claude",
    { user_id: userId, org_id: orgId, refresh: opts.refresh ?? false },
    SignalLeadMapResponseSchema as ZodType<SignalLeadMapResponse>,
  );
}
