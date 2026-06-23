// Spec 15 §3.3 — characterization for src/lib/marketScoresHeatmap.ts.
// Tests bucketing thresholds, envelope-shape branches, and snake/camel
// case tolerance. No color mapping or sort order in the file itself — those
// helpers live in consumer components and will be tested at extraction time.
import { describe, expect, it } from "vitest";

import {
  extractMarketScoreRowsFromResponse,
  heatmapLeadFromUnknownRow,
  heatmapLeadFromV2Lead,
  mapMarketScoresRowToHeatmapLead,
  scorePercentToRating,
  type MarketScoresApiRow,
} from "../marketScoresHeatmap";

describe("scorePercentToRating", () => {
  it('returns "High" at >= 75', () => {
    expect(scorePercentToRating(100)).toBe("High");
    expect(scorePercentToRating(75)).toBe("High");
  });

  it('returns "Medium" in [50, 75)', () => {
    expect(scorePercentToRating(74.9)).toBe("Medium");
    expect(scorePercentToRating(50)).toBe("Medium");
  });

  it('returns "Low" below 50', () => {
    expect(scorePercentToRating(49.9)).toBe("Low");
    expect(scorePercentToRating(0)).toBe("Low");
    expect(scorePercentToRating(-10)).toBe("Low");
  });

  it("treats NaN-producing input as Low (via the num() guard chain in callers)", () => {
    // scorePercentToRating itself takes a number; NaN comparisons against 75
    // and 50 are both false, falling through to "Low".
    expect(scorePercentToRating(NaN)).toBe("Low");
  });
});

describe("mapMarketScoresRowToHeatmapLead", () => {
  const baseRow: MarketScoresApiRow = {
    lead_id: "lead_001",
    org_id: "org_abc",
    company_name: "Acme Corp",
    score_market_size_opportunity: 80,
    score_industry_trends_report: 60,
    score_competitor_landscape: 40,
    score_regulatory_compliance_highlights: 75,
    score_market_entry_growth_strategy: 50,
    combined_score: 61.234,
  };

  it("rounds combined_score to one decimal in totalScore", () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.totalScore).toBe(61.2);
  });

  it("maps every per-column score into the ratings record", () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.ratings).toEqual({
      "market-size": "High", // 80
      "industry-trends": "Medium", // 60
      "competitor-landscape": "Low", // 40
      "regulatory-compliance": "High", // 75
      "market-entry": "Medium", // 50
    });
  });

  it("uses company_name for name and company fields; em-dash fallback when blank", () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.company).toBe("Acme Corp");
    expect(lead.name).toBe("Acme Corp");

    const blank = mapMarketScoresRowToHeatmapLead({ ...baseRow, company_name: "   " });
    expect(blank.company).toBe("—");
    expect(blank.name).toBe("—");
  });

  it("preserves the real source from the API row", () => {
    expect(mapMarketScoresRowToHeatmapLead({ ...baseRow, source: "apollo" }).source).toBe("apollo");
  });
  it("passes through null when the row carries no source", () => {
    expect(mapMarketScoresRowToHeatmapLead(baseRow).source).toBeNull();
  });

  it("stringifies lead_id (defensive against numeric IDs from JSON gateways)", () => {
    // @ts-expect-error — exercising the String() coercion intentionally
    const lead = mapMarketScoresRowToHeatmapLead({ ...baseRow, lead_id: 12345 });
    expect(lead.id).toBe("12345");
  });

  it("marks market-scored rows as scored:true", () => {
    expect(mapMarketScoresRowToHeatmapLead(baseRow).scored).toBe(true);
  });
});

describe("heatmapLeadFromV2Lead (unscored real leads)", () => {
  it("maps a /v2/leads row to an unscored HeatmapLead (scored:false, empty ratings, 0 score)", () => {
    const lead = heatmapLeadFromV2Lead({
      lead_id: "lead_42",
      company_name: "astuto.ai",
      name: "Jane Founder",
      source: "apollo",
      email_status: "verified",
    });
    expect(lead).not.toBeNull();
    expect(lead).toMatchObject({
      id: "lead_42",
      name: "Jane Founder",
      company: "astuto.ai",
      source: "apollo",
      email_status: "verified",
      totalScore: 0,
      scored: false,
    });
    expect(lead?.ratings).toEqual({});
  });

  it("falls back to company for the display name when no person name is present", () => {
    const lead = heatmapLeadFromV2Lead({ lead_id: "l1", company_name: "OnlyCo", source: "csv" });
    expect(lead?.name).toBe("OnlyCo");
    expect(lead?.company).toBe("OnlyCo");
  });

  it("returns null when there is no usable lead id", () => {
    expect(heatmapLeadFromV2Lead({ company_name: "NoId" })).toBeNull();
    expect(heatmapLeadFromV2Lead({ lead_id: "  " })).toBeNull();
  });

  it("preserves an Apollo source verbatim so the Apollo source filter matches", () => {
    expect(heatmapLeadFromV2Lead({ lead_id: "l2", source: "apollo" })?.source).toBe("apollo");
  });
});

describe("extractMarketScoreRowsFromResponse", () => {
  it("returns [] for null/undefined/non-object input", () => {
    expect(extractMarketScoreRowsFromResponse(null)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse(undefined)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse(42)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse("string")).toEqual([]);
  });

  it("extracts from { rows: [...] }", () => {
    expect(extractMarketScoreRowsFromResponse({ rows: [{ lead_id: "a" }] })).toEqual([
      { lead_id: "a" },
    ]);
  });

  it("extracts from { leads: [...] }", () => {
    expect(extractMarketScoreRowsFromResponse({ leads: [{ lead_id: "b" }] })).toEqual([
      { lead_id: "b" },
    ]);
  });

  it("extracts from { results: [...] }", () => {
    expect(extractMarketScoreRowsFromResponse({ results: [{ lead_id: "c" }] })).toEqual([
      { lead_id: "c" },
    ]);
  });

  it("extracts from { data: [...] }", () => {
    expect(extractMarketScoreRowsFromResponse({ data: [{ lead_id: "d" }] })).toEqual([
      { lead_id: "d" },
    ]);
  });

  it("extracts from { data: { rows: [...] } } and { data: { leads: [...] } }", () => {
    expect(extractMarketScoreRowsFromResponse({ data: { rows: [{ lead_id: "e" }] } })).toEqual([
      { lead_id: "e" },
    ]);
    expect(extractMarketScoreRowsFromResponse({ data: { leads: [{ lead_id: "f" }] } })).toEqual([
      { lead_id: "f" },
    ]);
  });

  it("prefers rows over leads over results when multiple envelope keys are present", () => {
    expect(
      extractMarketScoreRowsFromResponse({
        rows: [{ lead_id: "rows-wins" }],
        leads: [{ lead_id: "leads-loses" }],
      }),
    ).toEqual([{ lead_id: "rows-wins" }]);
  });

  it("returns [] when no recognized envelope key is present", () => {
    expect(extractMarketScoreRowsFromResponse({ unrelated: "field" })).toEqual([]);
  });
});

describe("heatmapLeadFromUnknownRow", () => {
  it("returns null when lead_id / leadId / lead.lead_id are all missing", () => {
    expect(heatmapLeadFromUnknownRow({})).toBeNull();
    expect(heatmapLeadFromUnknownRow({ lead_id: "" })).toBeNull();
    expect(heatmapLeadFromUnknownRow({ lead_id: "   " })).toBeNull();
  });

  it("accepts lead_id at the top level", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "lead_1",
      company_name: "TopLevel Co",
      score_market_size_opportunity: 80,
      score_industry_trends_report: 60,
      score_competitor_landscape: 40,
      score_regulatory_compliance_highlights: 75,
      score_market_entry_growth_strategy: 50,
      combined_score: 60,
    });
    expect(lead).not.toBeNull();
    expect(lead!.id).toBe("lead_1");
    expect(lead!.company).toBe("TopLevel Co");
  });

  it("accepts camelCase scores (scoreMarketSizeOpportunity etc.)", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "lead_2",
      company_name: "CamelCase Co",
      scoreMarketSizeOpportunity: 80,
      scoreIndustryTrendsReport: 80,
      scoreCompetitorLandscape: 80,
      scoreRegulatoryComplianceHighlights: 80,
      scoreMarketEntryGrowthStrategy: 80,
      combinedScore: 80,
    });
    expect(lead).not.toBeNull();
    expect(lead!.ratings["market-size"]).toBe("High");
    expect(lead!.totalScore).toBe(80);
  });

  it("falls back to company.name when company_name is absent", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "lead_3",
      company: { name: "Nested Co" },
      combined_score: 50,
    });
    expect(lead!.company).toBe("Nested Co");
  });

  it("uses contact_name for display name with company fallback", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "lead_4",
      company_name: "Acme",
      contact_name: "Jane Doe",
      combined_score: 50,
    });
    expect(lead!.name).toBe("Jane Doe");
    expect(lead!.company).toBe("Acme");
  });

  it('returns "—" as company when no company field resolves and contact_name is also absent', () => {
    const lead = heatmapLeadFromUnknownRow({ lead_id: "lead_5" });
    expect(lead).not.toBeNull();
    expect(lead!.company).toBe("—");
    expect(lead!.name).toBe("—");
    // Lock the absent-score fallback chain: num(undefined) → 0 → scorePercentToRating(0) → "Low".
    // Catches a Phase 1+ regression if num()'s fallback ever changes from 0 to NaN or throws.
    expect(lead!.totalScore).toBe(0);
    expect(lead!.ratings).toEqual({
      "market-size": "Low",
      "industry-trends": "Low",
      "competitor-landscape": "Low",
      "regulatory-compliance": "Low",
      "market-entry": "Low",
    });
  });

  it("extracts lead_id from a nested lead.lead_id path", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead: { lead_id: "nested_id" },
      company_name: "Co",
    });
    expect(lead).not.toBeNull();
    expect(lead!.id).toBe("nested_id");
  });

  it("forwards a real source string through the loose-schema path", () => {
    expect(
      heatmapLeadFromUnknownRow({ lead_id: "L1", company_name: "Acme", source: "apollo" })?.source,
    ).toBe("apollo");
  });

  it("returns null for source when source is absent", () => {
    expect(heatmapLeadFromUnknownRow({ lead_id: "L1", company_name: "Acme" })?.source).toBeNull();
  });

  it("returns null for source when source is a non-string (number)", () => {
    expect(
      heatmapLeadFromUnknownRow({ lead_id: "L1", company_name: "Acme", source: 42 })?.source,
    ).toBeNull();
  });
});
