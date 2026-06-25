import { describe, expect, it } from "vitest";

import { SignalLeadMapLeadSchema } from "../contracts";

describe("SignalLeadMapLeadSchema — prospect fields", () => {
  it("parses a populated lead with name/title/seniority", () => {
    const lead = SignalLeadMapLeadSchema.parse({
      lead_id: "l1",
      company: "Acme",
      relevance: "high",
      why: "fit",
      name: "Jane Doe",
      title: "VP Engineering",
      seniority: "CXO",
    });
    expect(lead.name).toBe("Jane Doe");
    expect(lead.title).toBe("VP Engineering");
    expect(lead.seniority).toBe("CXO");
  });

  it("leaves the new fields undefined when absent (narrow legacy response)", () => {
    const lead = SignalLeadMapLeadSchema.parse({ lead_id: "l1", relevance: "low" });
    expect(lead.name).toBeUndefined();
    expect(lead.title).toBeUndefined();
    expect(lead.seniority).toBeUndefined();
  });
});
