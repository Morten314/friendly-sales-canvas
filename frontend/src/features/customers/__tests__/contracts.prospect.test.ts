import { describe, expect, it } from "vitest";

import { mapRawLead } from "../contracts";

describe("mapRawLead — prospect fields + CSV alias fix", () => {
  it("resolves CSV TitleCase leads (name, company, title, seniority)", () => {
    const lead = mapRawLead({
      lead_id: "l1",
      Company_Name: "Acme",
      First_Name: "Jane",
      Last_Name: "Doe",
      Job_Title: "VP Engineering",
      Seniority_Level: "CXO",
    } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.name).toBe("Jane Doe");
    expect(lead.company).toBe("Acme");
    expect(lead.title).toBe("VP Engineering");
    expect(lead.seniority).toBe("CXO");
  });

  it("resolves Apollo lowercase leads", () => {
    const lead = mapRawLead({
      lead_id: "l2",
      company_name: "Globex",
      name: "Sam Lee",
      title: "Owner",
      seniority: "Owner",
    } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.title).toBe("Owner");
    expect(lead.seniority).toBe("Owner");
  });

  it("falls back to — for company and null for title/seniority when absent", () => {
    const lead = mapRawLead({ lead_id: "l3" } as unknown as Parameters<typeof mapRawLead>[0]);
    expect(lead.company).toBe("—");
    expect(lead.title).toBeNull();
    expect(lead.seniority).toBeNull();
  });
});
