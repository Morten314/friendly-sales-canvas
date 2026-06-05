import {
  FetchSignalsResponseSchema,
  GenerateSignalsBatchResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
} from "../contracts";

/**
 * GET /api/fetch-signals?user_id=&limit=10 — page-only read. Lifted verbatim
 * from SignalsPage; the permissive schema `.parse`s the body at the boundary.
 * The consumer (Task 12) normalizes via `buildSignalCardsFromFetchData`.
 */
export async function fetchSignals(userId: string): Promise<FetchSignalsResponse> {
  const response = await fetch(`/api/fetch-signals?user_id=${userId}&limit=10`);
  if (!response.ok) {
    throw new Error(`Failed to fetch signals: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  return FetchSignalsResponseSchema.parse(await response.json());
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
