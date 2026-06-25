import { describe, expect, it } from "vitest";

import { heatmapLeadFromUnknownRow, heatmapLeadFromV2Lead } from "../marketScoresHeatmap";

describe("heatmapLeadFromV2Lead — prospect fields", () => {
  it("resolves CSV TitleCase leads (name, company, title, seniority)", () => {
    const lead = heatmapLeadFromV2Lead({
      lead_id: "l1",
      Company_Name: "Acme",
      First_Name: "Jane",
      Last_Name: "Doe",
      Job_Title: "VP Engineering",
      Seniority_Level: "CXO",
    });
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Jane Doe");
    expect(lead!.company).toBe("Acme");
    expect(lead!.title).toBe("VP Engineering");
    expect(lead!.seniority).toBe("CXO");
  });

  it("resolves Apollo lowercase leads", () => {
    const lead = heatmapLeadFromV2Lead({
      lead_id: "l2",
      company_name: "Globex",
      name: "Sam Lee",
      title: "Owner",
      seniority: "Owner",
    });
    expect(lead!.title).toBe("Owner");
    expect(lead!.seniority).toBe("Owner");
    expect(lead!.name).toBe("Sam Lee");
  });

  it("leaves title/seniority null when absent", () => {
    const lead = heatmapLeadFromV2Lead({ lead_id: "l3", company_name: "Z" });
    expect(lead!.title).toBeNull();
    expect(lead!.seniority).toBeNull();
  });
});

describe("heatmapLeadFromUnknownRow — prospect fields (scored path)", () => {
  it("resolves CSV TitleCase row: name, company, title, seniority", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "s1",
      Company_Name: "Acme",
      First_Name: "Jane",
      Last_Name: "Doe",
      Job_Title: "VP Engineering",
      Seniority_Level: "CXO",
      combined_score: 80,
      score_market_size_opportunity: 80,
      score_industry_trends_report: 80,
      score_competitor_landscape: 80,
      score_regulatory_compliance_highlights: 80,
      score_market_entry_growth_strategy: 80,
    });
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Jane Doe");
    expect(lead!.company).toBe("Acme");
    expect(lead!.title).toBe("VP Engineering");
    expect(lead!.seniority).toBe("CXO");
  });

  it("resolves Apollo lowercase row: title and seniority", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "s2",
      company_name: "Globex",
      name: "Sam Lee",
      title: "Owner",
      seniority: "Owner",
      combined_score: 60,
      score_market_size_opportunity: 60,
      score_industry_trends_report: 60,
      score_competitor_landscape: 60,
      score_regulatory_compliance_highlights: 60,
      score_market_entry_growth_strategy: 60,
    });
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Sam Lee");
    expect(lead!.company).toBe("Globex");
    expect(lead!.title).toBe("Owner");
    expect(lead!.seniority).toBe("Owner");
  });

  it("leaves title/seniority null when absent, but preserves scoring fields", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "s3",
      company_name: "NoName Corp",
      combined_score: 75,
      score_market_size_opportunity: 80,
      score_industry_trends_report: 70,
      score_competitor_landscape: 75,
      score_regulatory_compliance_highlights: 80,
      score_market_entry_growth_strategy: 70,
    });
    expect(lead).not.toBeNull();
    expect(lead!.title).toBeNull();
    expect(lead!.seniority).toBeNull();
    // Scoring fields must survive
    expect(lead!.scored).toBe(true);
    expect(lead!.totalScore).toBe(75);
    expect(lead!.ratings["market-size"]).toBe("High");
  });

  it("carries score fields alongside prospect fields (no data loss)", () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: "s4",
      company_name: "ScoreCo",
      name: "Ada Smith",
      title: "CTO",
      seniority: "C-Suite",
      combined_score: 85,
      score_market_size_opportunity: 90,
      score_industry_trends_report: 85,
      score_competitor_landscape: 80,
      score_regulatory_compliance_highlights: 85,
      score_market_entry_growth_strategy: 85,
      source: "apollo",
    });
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Ada Smith");
    expect(lead!.title).toBe("CTO");
    expect(lead!.seniority).toBe("C-Suite");
    expect(lead!.scored).toBe(true);
    expect(lead!.totalScore).toBe(85);
    expect(lead!.source).toBe("apollo");
    expect(lead!.ratings["market-size"]).toBe("High");
  });
});
