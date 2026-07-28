import { z } from "zod";

import type { ResearchComponentResponse } from "../../../contracts";

/** Market-entry per-component `data` view-model. Fields confirmed against the
 *  backend "market entry & growth strategy" prompt schema (research_market_5)
 *  in 5d Task 0 Step 5 (R2 — not inferred). `.passthrough()` tolerates extra
 *  backend fields (e.g. `timeline`). The live fetch mapped the same camelCase names. */
export const MarketEntrySwotSchema = z
  .object({
    strengths: z.array(z.string()).nullish(),
    weaknesses: z.array(z.string()).nullish(),
    opportunities: z.array(z.string()).nullish(),
    threats: z.array(z.string()).nullish(),
  })
  .passthrough();

export const MarketEntryResultSchema = z
  .object({
    executiveSummary: z.string().nullish(),
    entryBarriers: z.array(z.string()).nullish(),
    recommendedChannel: z.union([z.string(), z.record(z.unknown())]).nullish(),
    timeToMarket: z.string().nullish(),
    topBarrier: z.string().nullish(),
    competitiveDifferentiation: z.array(z.string()).nullish(),
    strategicRecommendations: z.array(z.string()).nullish(),
    riskAssessment: z.array(z.string()).nullish(),
    swot: MarketEntrySwotSchema.nullish(),
    swotAnalysis: MarketEntrySwotSchema.nullish(),
  })
  .passthrough();

export type MarketEntryResult = z.infer<typeof MarketEntryResultSchema>;
export type MarketEntrySwot = z.infer<typeof MarketEntrySwotSchema>;

/** Narrow a generic component response to the market-entry result view-model. */
export function parseMarketEntryResult(
  response: ResearchComponentResponse | undefined,
): MarketEntryResult | undefined {
  if (!response?.data) return undefined;
  return MarketEntryResultSchema.parse(response.data);
}
