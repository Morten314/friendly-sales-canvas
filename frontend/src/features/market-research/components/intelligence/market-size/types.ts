import { z } from "zod";

import type { ResearchComponentResponse } from "../../../contracts";

/** Market-size per-component `data` view-model. The 9 display fields are
 *  confirmed against IntelligenceTab.tsx where it builds the drilled props.
 *  `.passthrough()` tolerates extra backend fields. Note the capital `G` in
 *  `GrowthRate` — that is the real field name the live fetch mapped. */
export const MarketSizeResultSchema = z
  .object({
    executiveSummary: z.string().nullish(),
    tamValue: z.string().nullish(),
    samValue: z.string().nullish(),
    GrowthRate: z.string().nullish(),
    strategicRecommendations: z.array(z.string()).nullish(),
    marketEntry: z.string().nullish(),
    marketDrivers: z.array(z.string()).nullish(),
    // Backend may return numeric index values (e.g. 1.0, 2.5) — coerce to strings.
    marketSizeBySegment: z.record(z.coerce.string()).nullish(),
    growthProjections: z.record(z.coerce.string()).nullish(),
  })
  .passthrough();

export type MarketSizeResult = z.infer<typeof MarketSizeResultSchema>;

/** Narrow a generic component response to the market-size result view-model. */
export function parseMarketSizeResult(
  response: ResearchComponentResponse | undefined,
): MarketSizeResult | undefined {
  if (!response?.data) return undefined;
  return MarketSizeResultSchema.parse(response.data);
}
