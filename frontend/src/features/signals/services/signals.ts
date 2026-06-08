import { z } from "zod";

import {
  GenerateSignalsBatchResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
} from "../contracts";

import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";

/**
 * GET /api/v2/fetch-signals?user_id=&limit=10&offset=0 — page-only read.
 * Parses the v2 paginated envelope and re-wraps to { signals } for consumers.
 * The consumer (Task 12) normalizes via `buildSignalCardsFromFetchData`.
 */
export async function fetchSignals(userId: string): Promise<FetchSignalsResponse> {
  const response = await fetch(`/api/v2/fetch-signals?user_id=${userId}&${firstPageParams(10)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch signals: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  const env = paginatedSchema(z.unknown()).parse(await response.json());
  return { signals: env.items };
}

/**
 * POST /api/generate-signals-batch — page-only. The body shape is lifted
 * verbatim from SignalsPage (a hardcoded `component_name: "test"` probe with a
 * fixed firmographics `data` block and `refresh: true`).
 */
export async function generateSignalsBatch(userId: string): Promise<GenerateSignalsBatchResponse> {
  const response = await fetch("/api/generate-signals-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate signals: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  return GenerateSignalsBatchResponseSchema.parse(await response.json());
}
