import { describe, expect, it } from "vitest";

import { DEFAULT_REGIONAL_DATA, DEFAULT_VISUAL_DATA_CARDS } from "../regulatoryDefaults";

describe("regulatoryDefaults", () => {
  it("exposes the 4 canonical regions in order", () => {
    expect(DEFAULT_REGIONAL_DATA.map((r) => r.region)).toEqual([
      "European Union",
      "United States",
      "China",
      "United Kingdom",
    ]);
  });
  it("exposes the 3 canonical visual cards with their chart types", () => {
    expect(DEFAULT_VISUAL_DATA_CARDS.map((c) => [c.title, c.type])).toEqual([
      ["Compliance Adoption Rates", "bar-chart"],
      ["Regulatory Timeline", "timeline"],
      ["Risk Indicators", "percentage"],
    ]);
  });
});
