import { describe, it, expect } from "vitest";

import { normalizeDeletedSections, budgetToChartData, buildEditSnapshot } from "./industryTrends";

// ---------------------------------------------------------------------------
// normalizeDeletedSections
// ---------------------------------------------------------------------------
describe("normalizeDeletedSections", () => {
  it("returns null as empty Set", () => {
    const result = normalizeDeletedSections(null);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns undefined as empty Set", () => {
    const result = normalizeDeletedSections(undefined);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns a Set input as-is (same reference)", () => {
    const s = new Set(["a", "b"]);
    const result = normalizeDeletedSections(s);
    expect(result).toBe(s);
    expect(result.size).toBe(2);
  });

  it("converts an array to a Set", () => {
    const result = normalizeDeletedSections(["x", "y", "z"]);
    expect(result).toBeInstanceOf(Set);
    expect([...result]).toEqual(["x", "y", "z"]);
  });

  it("converts a plain object to a Set of its keys", () => {
    const result = normalizeDeletedSections({ foo: 1, bar: 2 });
    expect(result).toBeInstanceOf(Set);
    expect(result.has("foo")).toBe(true);
    expect(result.has("bar")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("returns empty Set for an empty object", () => {
    const result = normalizeDeletedSections({});
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("returns empty Set for an empty array", () => {
    const result = normalizeDeletedSections([]);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// budgetToChartData
// ---------------------------------------------------------------------------
describe("budgetToChartData", () => {
  it("parses percentage strings into numeric values", () => {
    const result = budgetToChartData({ "AI/ML": "40%", Cloud: "35%", Security: "25%" });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "AI/ML", value: 40, color: "#8B5CF6" });
    expect(result[1]).toEqual({ name: "Cloud", value: 35, color: "#3B82F6" });
    expect(result[2]).toEqual({ name: "Security", value: 25, color: "#10B981" });
  });

  it("drops entries whose parsed value is 0 (e.g. '0%')", () => {
    const result = budgetToChartData({ "AI/ML": "0%", Cloud: "50%" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Cloud");
  });

  it("drops entries that parse to NaN (non-numeric string)", () => {
    const result = budgetToChartData({ foo: "N/A", bar: "30%" });
    // NaN → 0 → filtered out
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("bar");
  });

  it("drops entries with falsy value (empty string → 0)", () => {
    const result = budgetToChartData({ empty: "", valid: "20%" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid");
  });

  it("returns empty array for empty input", () => {
    expect(budgetToChartData({})).toEqual([]);
  });

  it("cycles the 8-color palette when there are more than 8 entries", () => {
    const allocation: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      allocation[`item${i}`] = `${(i + 1) * 5}%`;
    }
    const result = budgetToChartData(allocation);
    expect(result).toHaveLength(10);
    // index 8 wraps back to palette[0]
    expect(result[8].color).toBe("#8B5CF6");
    // index 9 wraps to palette[1]
    expect(result[9].color).toBe("#3B82F6");
  });

  it("assigns colors in palette order for first 8 entries", () => {
    const palette = [
      "#8B5CF6",
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#06B6D4",
      "#84CC16",
      "#EC4899",
    ];
    const allocation: Record<string, string> = {};
    for (let i = 0; i < 8; i++) {
      allocation[`item${i}`] = "10%";
    }
    const result = budgetToChartData(allocation);
    for (let i = 0; i < 8; i++) {
      expect(result[i].color).toBe(palette[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// buildEditSnapshot
// ---------------------------------------------------------------------------
describe("buildEditSnapshot", () => {
  const baseDisplayData = {
    executiveSummary: "Original summary",
    aiAdoption: "Original AI",
    cloudMigration: "Original cloud",
    regulatory: "Original reg",
    trendSnapshots: [{ title: "Growth", metric: "10%", type: "growth" as const }],
    regionalHotspots: { APAC: "Strong", Europe: "Growing", "North America": "Mature" },
    strategicRecommendations: { primaryFocus: "Focus A", marketEntry: "Entry A" },
    risks: ["Risk 1", "Risk 2"],
    visualCharts: {
      aiAdoptionTrends: ["Q1", "Q2"],
      technologyBudgetAllocation: { "AI/ML": "40%", Cloud: "35%", Security: "25%" },
    },
  };

  const baseDrafts = {
    editExecutiveSummary: "Edited summary",
    editAiAdoption: "Edited AI",
    editCloudMigration: "Edited cloud",
    editRegulatory: "Edited reg",
    editTrendSnapshots: [{ title: "New Growth", metric: "20%", type: "growth" as const }],
    editRegionalHotspots: { APAC: "New APAC", Europe: "New EU", "North America": "New NA" },
    editStrategicRecommendations: { primaryFocus: "New Focus", marketEntry: "New Entry" },
    editRisks: ["Risk X"],
    editVisualCharts: {
      aiAdoptionTrends: ["Q3", "Q4"],
      technologyBudgetAllocation: { "AI/ML": "50%", Cloud: "30%", Security: "20%" },
    },
  };

  it("returns originalData mirroring displayData", () => {
    const { originalData } = buildEditSnapshot(baseDisplayData, baseDrafts);
    expect(originalData.executiveSummary).toBe("Original summary");
    expect(originalData.aiAdoption).toBe("Original AI");
    expect(originalData.cloudMigration).toBe("Original cloud");
    expect(originalData.regulatory).toBe("Original reg");
    expect(originalData.trendSnapshots).toEqual(baseDisplayData.trendSnapshots);
    expect(originalData.risks).toEqual(["Risk 1", "Risk 2"]);
    expect(originalData.regionalHotspots).toEqual(baseDisplayData.regionalHotspots);
    expect(originalData.strategicRecommendations).toEqual(baseDisplayData.strategicRecommendations);
    expect(originalData.visualCharts).toEqual(baseDisplayData.visualCharts);
  });

  it("returns modifiedData shaped from draft state", () => {
    const { modifiedData } = buildEditSnapshot(baseDisplayData, baseDrafts);
    expect(modifiedData.executiveSummary).toBe("Edited summary");
    expect(modifiedData.aiAdoption).toBe("Edited AI");
    expect(modifiedData.cloudMigration).toBe("Edited cloud");
    expect(modifiedData.regulatory).toBe("Edited reg");
    expect(modifiedData.trendSnapshots).toEqual(baseDrafts.editTrendSnapshots);
    expect(modifiedData.risks).toEqual(["Risk X"]);
    expect(modifiedData.visualCharts).toEqual(baseDrafts.editVisualCharts);
    expect(modifiedData.regionalHotspots).toEqual(baseDrafts.editRegionalHotspots);
    expect(modifiedData.strategicRecommendations).toEqual(baseDrafts.editStrategicRecommendations);
  });

  it("originalData reflects empty-string defaults when displayData is empty", () => {
    const emptyDisplay = {
      executiveSummary: "",
      aiAdoption: "",
      cloudMigration: "",
      regulatory: "",
      trendSnapshots: [],
      regionalHotspots: {},
      strategicRecommendations: { primaryFocus: "", marketEntry: "" },
      risks: [],
      visualCharts: { aiAdoptionTrends: [], technologyBudgetAllocation: {} },
    };
    const { originalData } = buildEditSnapshot(emptyDisplay, baseDrafts);
    expect(originalData.executiveSummary).toBe("");
    expect(originalData.regionalHotspots).toEqual({});
    expect(originalData.strategicRecommendations).toEqual({ primaryFocus: "", marketEntry: "" });
    expect(originalData.risks).toEqual([]);
    expect(originalData.visualCharts).toEqual({
      aiAdoptionTrends: [],
      technologyBudgetAllocation: {},
    });
  });

  it("originalData uses whatever strategicRecommendations displayData provides", () => {
    const display = {
      ...baseDisplayData,
      strategicRecommendations: { primaryFocus: "Display Focus", marketEntry: "Display Entry" },
    };
    const { originalData } = buildEditSnapshot(display, baseDrafts);
    expect(originalData.strategicRecommendations.primaryFocus).toBe("Display Focus");
  });
});
