/**
 * Pure uiComponents parsing + trend-data helper for CompetitorLandscapeSection.
 *
 * All functions are array-in / typed-array-out with no side-effects.
 * Logic lifted verbatim from CompetitorLandscapeSection.tsx — do not "improve" here;
 * the goal is a tested, behaviour-preserving extraction.
 */

import type {
  DataPoint,
  MnaInsight,
  Metric,
  RegionShare,
  SwotEntity,
  TrendChart,
  UntypedBackendApiResponse,
} from "./types";

// ── normalizeUiComponents ────────────────────────────────────────────────────

/**
 * Normalise a raw `uiComponents` array from the backend:
 * - JSON-parse string entries (drop unparseable ones)
 * - Pass object entries through unchanged
 * - Return [] for non-array input
 */
export function normalizeUiComponents(
  components: UntypedBackendApiResponse[],
): UntypedBackendApiResponse[] {
  if (!Array.isArray(components)) return [];
  return components
    .map((comp: UntypedBackendApiResponse) => {
      if (typeof comp === "string") {
        try {
          return JSON.parse(comp);
        } catch (_e) {
          return null;
        }
      }
      return comp;
    })
    .filter((comp: UntypedBackendApiResponse) => comp !== null);
}

// ── per-type extractors ──────────────────────────────────────────────────────

/** Extract `dataPoints` from the `report` component. */
export function extractDataPoints(components: UntypedBackendApiResponse[]): DataPoint[] {
  const reportComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "report",
  );
  return reportComponent?.dataPoints || [];
}

/**
 * Extract `tags` (competitor names) from the `section` component.
 * Note: the `section` component is also used for `metrics` — this extractor
 * returns only `tags`.
 */
export function extractCompetitorTags(components: UntypedBackendApiResponse[]): string[] {
  const sectionComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "section",
  );
  return sectionComponent?.tags || [];
}

/** Extract `regions` from the `marketShareCharts` component. */
export function extractRegions(components: UntypedBackendApiResponse[]): RegionShare[] {
  const marketShareComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "marketShareCharts",
  );
  return marketShareComponent?.regions || [];
}

/**
 * Extract and normalise `entities` from the `swotAnalysis` component.
 * Backfills missing `opportunities` and `threats` to `[]` for backwards
 * compatibility (mirrors the `?? []` guard in the original useState init).
 */
export function extractSwotEntities(components: UntypedBackendApiResponse[]): SwotEntity[] {
  const swotComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "swotAnalysis",
  );
  const entities = swotComponent?.entities || [];
  // Ensure backward compatibility by adding opportunities and threats if missing
  return entities.map((entity: SwotEntity) => ({
    ...entity,
    opportunities: entity.opportunities || [],
    threats: entity.threats || [],
  }));
}

/**
 * Extract `headlines` from the `news` component.
 *
 * Returns `null` (not `[]`) when the component is absent or has no headlines,
 * so the caller can apply its own 3-level fallback chain:
 *   newsComponent?.headlines ?? competitorData?.fundingNews ?? fundingNews ?? []
 */
export function extractHeadlines(components: UntypedBackendApiResponse[]): string[] | null {
  const newsComponent = components.find((comp: UntypedBackendApiResponse) => comp?.type === "news");
  const apiHeadlines = newsComponent?.headlines;
  return apiHeadlines && apiHeadlines.length > 0 ? apiHeadlines : null;
}

/** Extract `features` from the `featureComparison` component. */
export function extractFeatures(components: UntypedBackendApiResponse[]): string[] {
  const featureComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "featureComparison",
  );
  return featureComponent?.features || [];
}

/** Extract `tools` from the `featureComparison` component. */
export function extractTools(components: UntypedBackendApiResponse[]): Record<string, string[]> {
  const featureComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "featureComparison",
  );
  return featureComponent?.tools || {};
}

/**
 * Extract and normalise `insights` from the `mnaInsights` component.
 *
 * The backend may send insights as:
 *   - A JSON string (outer level): parsed to an array
 *   - An array of objects: used directly
 *   - An array where individual items are JSON strings: each item parsed
 *
 * Entries that have neither `label` nor `description` are filtered out.
 */
export function extractMnaInsights(components: UntypedBackendApiResponse[]): MnaInsight[] {
  const mnaComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "mnaInsights",
  );
  let insights = mnaComponent?.insights;
  if (typeof insights === "string") {
    try {
      insights = JSON.parse(insights);
    } catch (_e) {
      insights = null;
    }
  }
  if (!insights || !Array.isArray(insights)) return [];
  return insights
    .map((insight: UntypedBackendApiResponse) => {
      if (typeof insight === "string") {
        try {
          return JSON.parse(insight);
        } catch (_e) {
          return null;
        }
      }
      return insight;
    })
    .filter(
      (insight: UntypedBackendApiResponse) => insight && (insight.label || insight.description),
    );
}

/** Extract `charts` from the `marketTrends` component. */
export function extractTrendCharts(components: UntypedBackendApiResponse[]): TrendChart[] {
  const trendsComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "marketTrends",
  );
  return trendsComponent?.charts || [];
}

/**
 * Extract `metrics` from the `section` component.
 * Note: the `section` component is also used for `tags` — this extractor
 * returns only `metrics`.
 */
export function extractMetrics(components: UntypedBackendApiResponse[]): Metric[] {
  const sectionComponent = components.find(
    (comp: UntypedBackendApiResponse) => comp?.type === "section",
  );
  return sectionComponent?.metrics || [];
}

// ── normalizeCompetitorLandscapeData ─────────────────────────────────────────

/**
 * Flatten the heterogeneous competitor-landscape API envelope into the scalar
 * fields the section reads. Mirrors the extraction chain in fetchCompetitorData
 * (useMarketResearchData.ts) so hook-first rendering matches the legacy fetcher.
 */
export function normalizeCompetitorLandscapeData(
  apiData: UntypedBackendApiResponse | undefined,
): UntypedBackendApiResponse | undefined {
  if (!apiData) return undefined;

  const competitorLandscapeData = (apiData.competitorLandscape ?? {}) as UntypedBackendApiResponse;

  let uiComponentsData: UntypedBackendApiResponse = {};
  if (Array.isArray(apiData.uiComponents)) {
    const reportComponent = apiData.uiComponents.find(
      (comp: UntypedBackendApiResponse) => comp?.type === "report",
    );
    if (reportComponent) {
      uiComponentsData = reportComponent;
    }
  }

  const executiveSummary =
    competitorLandscapeData.executiveSummary ||
    uiComponentsData.executiveSummary ||
    apiData.executiveSummary ||
    "";

  const topPlayerShare =
    competitorLandscapeData.topPlayers ||
    competitorLandscapeData.topPlayerShare ||
    uiComponentsData.topPlayerShare ||
    apiData.topPlayerShare ||
    "";

  const emergingPlayers =
    competitorLandscapeData.emergingPlayers ||
    uiComponentsData.emergingPlayers ||
    apiData.emergingPlayers ||
    "";

  const fundingNewsRaw =
    competitorLandscapeData.recentMoves ||
    competitorLandscapeData.fundingNews ||
    uiComponentsData.fundingNews ||
    apiData.fundingNews ||
    [];

  return {
    ...apiData,
    executiveSummary,
    topPlayerShare,
    emergingPlayers,
    fundingNews: Array.isArray(fundingNewsRaw) ? fundingNewsRaw : [],
    uiComponents: apiData.uiComponents || [],
  };
}

// ── generateTrendData ────────────────────────────────────────────────────────

/**
 * Turn x-axis labels into deterministic chart data points.
 *
 * Uses a deterministic growth formula (no randomness) so the same inputs
 * always produce the same chart, regardless of render order.
 *
 * Signature matches the call site: `generateTrendData(chart.xAxis, index)`.
 */
export function generateTrendData(
  xAxis: string | string[],
  chartIndex: number,
): { name: string; value: number }[] {
  const labels = Array.isArray(xAxis) ? xAxis : [xAxis];
  const baseValue = 25 + chartIndex * 5; // Different starting point per chart
  const growthRate = 12 + chartIndex * 3; // Different growth rate per chart

  return labels.map((label, index) => {
    // Deterministic value based on index (no randomness for consistency)
    const value = baseValue + index * growthRate + index * 2;
    return {
      name: label,
      value: Math.round(value * 10) / 10, // Round to 1 decimal place
    };
  });
}
