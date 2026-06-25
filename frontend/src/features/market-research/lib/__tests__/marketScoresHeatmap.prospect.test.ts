import { describe, expect, it } from "vitest";

import { heatmapLeadFromV2Lead } from "../marketScoresHeatmap";

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
