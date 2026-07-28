import { describe, expect, it } from "vitest";

import {
  normalizeUiComponents,
  extractDataPoints,
  extractCompetitorTags,
  extractRegions,
  extractSwotEntities,
  extractHeadlines,
  extractFeatures,
  extractTools,
  extractMnaInsights,
  extractTrendCharts,
  extractMetrics,
  generateTrendData,
  normalizeCompetitorLandscapeData,
} from "../competitorUiComponents";

describe("competitorUiComponents", () => {
  // ── normalizeUiComponents ──────────────────────────────────────────────────

  it("normalizeUiComponents: JSON-parses string entries, drops unparseable, passes objects", () => {
    const out = normalizeUiComponents([
      '{"type":"news","headlines":["a"]}',
      "not json",
      { type: "report" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "news" });
    expect(out[1]).toMatchObject({ type: "report" });
  });

  it("normalizeUiComponents: returns [] for non-array input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeUiComponents(null as any)).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeUiComponents(undefined as any)).toEqual([]);
  });

  it("normalizeUiComponents: filters out null from unparseable strings", () => {
    const out = normalizeUiComponents(["bad json {{{", "also bad"]);
    expect(out).toHaveLength(0);
  });

  // ── extractDataPoints ──────────────────────────────────────────────────────

  it("extractDataPoints: returns dataPoints from report component", () => {
    const comps = [{ type: "report", dataPoints: [{ label: "TAM", value: "$10B" }] }];
    expect(extractDataPoints(comps)).toEqual([{ label: "TAM", value: "$10B" }]);
  });

  it("extractDataPoints: returns [] when no report component", () => {
    expect(extractDataPoints([{ type: "section", tags: [] }])).toEqual([]);
  });

  it("extractDataPoints: returns [] when report has no dataPoints", () => {
    expect(extractDataPoints([{ type: "report" }])).toEqual([]);
  });

  // ── extractCompetitorTags ──────────────────────────────────────────────────

  it("extractCompetitorTags: returns tags from section component", () => {
    const comps = [{ type: "section", tags: ["CompA", "CompB"] }];
    expect(extractCompetitorTags(comps)).toEqual(["CompA", "CompB"]);
  });

  it("extractCompetitorTags: returns [] when section has no tags", () => {
    expect(extractCompetitorTags([{ type: "section" }])).toEqual([]);
  });

  // ── extractRegions ─────────────────────────────────────────────────────────

  it("extractRegions: returns regions from marketShareCharts component", () => {
    const comps = [
      { type: "marketShareCharts", regions: [{ name: "APAC", data: { share: "40%" } }] },
    ];
    expect(extractRegions(comps)).toEqual([{ name: "APAC", data: { share: "40%" } }]);
  });

  it("extractRegions: returns [] when no marketShareCharts component", () => {
    expect(extractRegions([])).toEqual([]);
  });

  // ── extractSwotEntities ────────────────────────────────────────────────────

  it("extractSwotEntities: backfills missing opportunities/threats to []", () => {
    const comps = [
      {
        type: "swotAnalysis",
        entities: [{ name: "X", strengths: ["s1"], weaknesses: ["w1"] }],
      },
    ];
    const ents = extractSwotEntities(comps);
    expect(ents).toHaveLength(1);
    expect(ents[0]).toMatchObject({ name: "X", opportunities: [], threats: [] });
  });

  it("extractSwotEntities: preserves existing opportunities/threats", () => {
    const comps = [
      {
        type: "swotAnalysis",
        entities: [
          { name: "Y", strengths: [], weaknesses: [], opportunities: ["opp1"], threats: ["thr1"] },
        ],
      },
    ];
    const ents = extractSwotEntities(comps);
    expect(ents[0].opportunities).toEqual(["opp1"]);
    expect(ents[0].threats).toEqual(["thr1"]);
  });

  it("extractSwotEntities: returns [] when no swotAnalysis component", () => {
    expect(extractSwotEntities([])).toEqual([]);
  });

  // ── extractHeadlines ───────────────────────────────────────────────────────

  it("extractHeadlines: returns headlines from news component", () => {
    const comps = [{ type: "news", headlines: ["Headline 1", "Headline 2"] }];
    expect(extractHeadlines(comps)).toEqual(["Headline 1", "Headline 2"]);
  });

  it("extractHeadlines: returns null when no news component (caller handles fallback)", () => {
    // The section has 3-level fallback: newsComponent?.headlines ?? competitorData.fundingNews ?? fundingNews
    // extractHeadlines only handles the first level — it returns null when absent so the
    // caller can apply its own fallback chain.
    expect(extractHeadlines([])).toBeNull();
  });

  it("extractHeadlines: returns null when news component has no headlines", () => {
    expect(extractHeadlines([{ type: "news" }])).toBeNull();
  });

  // ── extractFeatures ────────────────────────────────────────────────────────

  it("extractFeatures: returns features array from featureComparison", () => {
    const comps = [{ type: "featureComparison", features: ["SSO", "API"] }];
    expect(extractFeatures(comps)).toEqual(["SSO", "API"]);
  });

  it("extractFeatures: returns [] when featureComparison absent or has no features", () => {
    expect(extractFeatures([])).toEqual([]);
    expect(extractFeatures([{ type: "featureComparison" }])).toEqual([]);
  });

  // ── extractTools ───────────────────────────────────────────────────────────

  it("extractTools: returns tools record from featureComparison", () => {
    const comps = [{ type: "featureComparison", tools: { CompA: ["SSO"], CompB: ["API"] } }];
    expect(extractTools(comps)).toEqual({ CompA: ["SSO"], CompB: ["API"] });
  });

  it("extractTools: returns {} when featureComparison absent or has no tools", () => {
    expect(extractTools([])).toEqual({});
    expect(extractTools([{ type: "featureComparison" }])).toEqual({});
  });

  // ── extractMnaInsights ─────────────────────────────────────────────────────

  it("extractMnaInsights: parses nested JSON-string insights, filters empties", () => {
    const comps = [
      {
        type: "mnaInsights",
        insights: '[{"label":"L","description":"D"}]',
      },
    ];
    const result = extractMnaInsights(comps);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "L", description: "D" });
  });

  it("extractMnaInsights: handles array of object insights directly", () => {
    const comps = [
      {
        type: "mnaInsights",
        insights: [{ label: "Acq", description: "Acquired X" }],
      },
    ];
    expect(extractMnaInsights(comps)).toHaveLength(1);
  });

  it("extractMnaInsights: filters out insights with no label and no description", () => {
    const comps = [
      {
        type: "mnaInsights",
        insights: [
          { label: "", description: "" },
          { label: "L", description: "D" },
        ],
      },
    ];
    expect(extractMnaInsights(comps)).toHaveLength(1);
  });

  it("extractMnaInsights: returns [] when no mnaInsights component", () => {
    expect(extractMnaInsights([])).toEqual([]);
  });

  it("extractMnaInsights: returns [] when insights is unparseable string", () => {
    const comps = [{ type: "mnaInsights", insights: "bad json" }];
    expect(extractMnaInsights(comps)).toEqual([]);
  });

  // ── extractTrendCharts ─────────────────────────────────────────────────────

  it("extractTrendCharts: returns charts array from marketTrends", () => {
    const comps = [{ type: "marketTrends", charts: [{ name: "Revenue", xAxis: ["Q1", "Q2"] }] }];
    expect(extractTrendCharts(comps)).toEqual([{ name: "Revenue", xAxis: ["Q1", "Q2"] }]);
  });

  it("extractTrendCharts: returns [] when no marketTrends component", () => {
    expect(extractTrendCharts([])).toEqual([]);
  });

  // ── extractMetrics ─────────────────────────────────────────────────────────

  it("extractMetrics: returns metrics from section component", () => {
    const comps = [{ type: "section", metrics: [{ label: "CAC", value: "$200", trend: "up" }] }];
    expect(extractMetrics(comps)).toEqual([{ label: "CAC", value: "$200", trend: "up" }]);
  });

  it("extractMetrics: returns [] when section has no metrics", () => {
    expect(extractMetrics([{ type: "section", tags: [] }])).toEqual([]);
  });

  // ── generateTrendData ──────────────────────────────────────────────────────

  it("generateTrendData: does not throw on empty xAxis", () => {
    expect(() => generateTrendData([], 0)).not.toThrow();
  });

  it("generateTrendData: returns empty array for empty xAxis", () => {
    expect(generateTrendData([], 0)).toEqual([]);
  });

  it("generateTrendData: turns x-axis labels into chart data points", () => {
    const result = generateTrendData(["Q1", "Q2"], 0);
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({ name: "Q1" });
    expect(result[1]).toMatchObject({ name: "Q2" });
  });

  it("generateTrendData: produces different values for different chart indexes", () => {
    const r0 = generateTrendData(["Q1"], 0);
    const r1 = generateTrendData(["Q1"], 1);
    expect(r0[0].value).not.toBe(r1[0].value);
  });

  it("generateTrendData: handles string xAxis (single label) by wrapping it", () => {
    const result = generateTrendData("Q1", 0);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Q1");
  });

  it("generateTrendData: values are rounded to 1 decimal place", () => {
    const result = generateTrendData(["Q1", "Q2", "Q3"], 0);
    for (const point of result) {
      const str = point.value.toString();
      const decimalPart = str.includes(".") ? str.split(".")[1] : "";
      expect(decimalPart.length).toBeLessThanOrEqual(1);
    }
  });

  // ── normalizeCompetitorLandscapeData ───────────────────────────────────────

  it("normalizeCompetitorLandscapeData: lifts executiveSummary from competitorLandscape nest", () => {
    const normalized = normalizeCompetitorLandscapeData({
      competitorLandscape: { executiveSummary: "Nested summary" },
      uiComponents: [{ type: "section", tags: ["Acme"] }],
    });

    expect(normalized?.executiveSummary).toBe("Nested summary");
  });

  it("normalizeCompetitorLandscapeData: falls back to report uiComponent fields", () => {
    const normalized = normalizeCompetitorLandscapeData({
      uiComponents: [
        { type: "report", executiveSummary: "From report component", topPlayerShare: "51%" },
      ],
    });

    expect(normalized?.executiveSummary).toBe("From report component");
    expect(normalized?.topPlayerShare).toBe("51%");
  });
});
