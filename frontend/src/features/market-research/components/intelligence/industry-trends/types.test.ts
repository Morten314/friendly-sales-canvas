import { describe, it, expect } from "vitest";

import { parseIndustryTrends } from "./types";

describe("parseIndustryTrends", () => {
  it("returns undefined when response is undefined", () => {
    expect(parseIndustryTrends(undefined)).toBeUndefined();
  });

  it("returns undefined when response.data is undefined", () => {
    expect(parseIndustryTrends({ status: "success", data: undefined } as never)).toBeUndefined();
  });

  it("parses a valid component response to the narrowed view-model", () => {
    const response = {
      status: "success",
      data: {
        executiveSummary: "AI adoption is accelerating",
        aiAdoption: "High adoption rate",
        cloudMigration: "70% migrated",
        regulatory: "GDPR compliance required",
        risks: ["market saturation", "regulatory pressure"],
        trendSnapshots: [{ title: "AI Growth", metric: "42%", type: "growth" }],
        recommendations: { primaryFocus: "Cloud", marketEntry: "SaaS" },
        regionalHotspots: { "North America": "High", Europe: "Medium" },
        visualCharts: {
          aiAdoptionTrends: ["2022: 30%", "2023: 42%"],
          technologyBudgetAllocation: { AI: "40%", Cloud: "30%" },
        },
      },
    };

    const result = parseIndustryTrends(response);
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBe("AI adoption is accelerating");
    expect(result!.aiAdoption).toBe("High adoption rate");
    expect(result!.risks).toEqual(["market saturation", "regulatory pressure"]);
    expect(result!.trendSnapshots).toHaveLength(1);
    expect(result!.recommendations).toEqual({ primaryFocus: "Cloud", marketEntry: "SaaS" });
    expect(result!.regionalHotspots).toEqual({ "North America": "High", Europe: "Medium" });
    expect(result!.visualCharts?.aiAdoptionTrends).toEqual(["2022: 30%", "2023: 42%"]);
  });

  it("tolerates extra/unknown backend fields via passthrough without throwing", () => {
    const response = {
      status: "success",
      data: {
        executiveSummary: "Summary",
        unknownField: "should be kept",
        anotherExtraField: 42,
      },
    };

    expect(() => parseIndustryTrends(response)).not.toThrow();
    const result = parseIndustryTrends(response);
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBe("Summary");
    // passthrough preserves unknown fields
    expect((result as Record<string, unknown>).unknownField).toBe("should be kept");
  });

  it("handles nullish fields gracefully — all optional fields may be absent", () => {
    const response = { status: "success", data: {} };
    const result = parseIndustryTrends(response);
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBeUndefined();
    expect(result!.risks).toBeUndefined();
    expect(result!.trendSnapshots).toBeUndefined();
  });
});
