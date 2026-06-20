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
import type { CompanyProfileResponse } from "@/shared/api/contracts";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/fetch-signals?user_id=&limit=10&offset=0 — page-only read.
 * Parses the v2 paginated envelope and re-wraps to { signals, total } for
 * consumers. The consumer (Task 12) normalizes via `buildSignalCardsFromFetchData`.
 */
export async function fetchSignals(
  userId: string,
): Promise<FetchSignalsResponse & { signals: unknown[]; total: number }> {
  const env = await apiGet(
    `v2/fetch-signals?user_id=${encodeURIComponent(userId)}&${firstPageParams(10)}`,
    paginatedSchema(z.unknown()),
  );
  return { signals: env.items ?? [], total: env.total ?? 0 };
}

/**
 * POST /api/generate-signals-batch_claude — page-only. The firmographics `data`
 * block is now sourced from the org's real company profile (Settings → Company
 * Profile) rather than the old hardcoded SaaS/example.com placeholders. A null
 * profile (none saved yet, or query not resolved) sends empty fields — never the
 * dummy values — so signals are generated against the org's actual business.
 * `component_name: "test"` remains a fixed probe label (a separate concern from
 * the firmographics, unrelated to company-profile personalisation).
 */
export async function generateSignalsBatch(
  userId: string,
  profile: CompanyProfileResponse | null,
): Promise<GenerateSignalsBatchResponse> {
  return apiPost(
    "generate-signals-batch_claude",
    {
      user_id: userId,
      component_name: "test",
      data: {
        industry: profile?.industry ?? "",
        companySize: profile?.companySize ?? "",
        companyUrl: profile?.companyUrl ?? profile?.website ?? "",
        strategicGoals: profile?.strategicGoals ?? "",
        primaryGTMModel: profile?.primaryGTMModel ?? profile?.gtmModel ?? "",
        revenueStage: profile?.revenueStage ?? "",
        keyBuyerPersona: profile?.keyBuyerPersona ?? "",
        targetMarkets: profile?.targetMarkets ?? [],
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
