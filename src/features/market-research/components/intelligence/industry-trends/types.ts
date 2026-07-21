import { z } from "zod";

import type { ResearchComponentResponse } from "../../../contracts";
import type { TrendSnapshot, IndustryTrendsRecommendations } from "../../types";

// Re-export the shared trio from the legacy types directory.
// These are consumed by MarketIntelligenceSectionsProps and its sections; do not fork them.
export type { EditRecord, TrendSnapshot, IndustryTrendsRecommendations } from "../../types";

/** Industry-trends per-component `data` view-model.
 *  Fields confirmed against the section's inline IndustryTrendsData and the live fetch
 *  mapping in useMarketResearchData.ts. `.passthrough()` tolerates extra backend fields. */
export const IndustryTrendsTrendSnapshotSchema = z
  .object({
    title: z.string().nullish(),
    metric: z.string().nullish(),
    type: z.enum(["growth", "performance", "adoption"]).nullish(),
  })
  .passthrough();

export const IndustryTrendsRecommendationsSchema = z
  .object({
    primaryFocus: z.string().nullish(),
    marketEntry: z.string().nullish(),
  })
  .passthrough();

export const IndustryTrendsVisualChartsSchema = z
  .object({
    aiAdoptionTrends: z.array(z.string()).nullish(),
    technologyBudgetAllocation: z.record(z.coerce.string()).nullish(),
  })
  .passthrough();

export const IndustryTrendsResultSchema = z
  .object({
    executiveSummary: z.string().nullish(),
    aiAdoption: z.string().nullish(),
    cloudMigration: z.string().nullish(),
    regulatory: z.string().nullish(),
    risks: z.array(z.string()).nullish(),
    trendSnapshots: z.array(IndustryTrendsTrendSnapshotSchema).nullish(),
    recommendations: IndustryTrendsRecommendationsSchema.nullish(),
    strategicRecommendations: IndustryTrendsRecommendationsSchema.nullish(),
    regionalHotspots: z.record(z.coerce.string()).nullish(),
    visualCharts: IndustryTrendsVisualChartsSchema.nullish(),
    timestamp: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();

export type IndustryTrendsResult = z.infer<typeof IndustryTrendsResultSchema>;

/** Section-private composite used internally and as the data-prop bag. */
export interface IndustryTrendsData {
  executiveSummary: string;
  aiAdoption: string;
  cloudMigration: string;
  regulatory: string;
  timestamp?: string | number;
  trendSnapshots: TrendSnapshot[];
  regionalHotspots: { [key: string]: string };
  strategicRecommendations: IndustryTrendsRecommendations;
  recommendations?: IndustryTrendsRecommendations;
  risks: string[];
  visualCharts: {
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: { [key: string]: string };
  };
}

/** Section-private visual charts shape. */
export interface VisualChartsData {
  aiAdoptionTrends: string[];
  technologyBudgetAllocation: Record<string, string>;
}

/** Narrow a generic component response to the industry-trends result view-model. */
export function parseIndustryTrends(
  response: ResearchComponentResponse | undefined,
): IndustryTrendsResult | undefined {
  if (!response?.data) return undefined;
  return IndustryTrendsResultSchema.parse(response.data);
}
