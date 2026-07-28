import { describe, expect, it } from "vitest";

import { mapApiICPToSuggested, normalizeIcpGetResponse, analyzeICP } from "../icpMapping";

describe("normalizeIcpGetResponse", () => {
  it("returns a bare array unchanged", () => {
    expect(normalizeIcpGetResponse([{ id: "a" }, { id: "b" }])).toHaveLength(2);
  });
  it("unwraps { data: [...] }", () => {
    expect(normalizeIcpGetResponse({ data: [{ id: "a" }] })).toHaveLength(1);
  });
  it("unwraps nested { data: { icps: [...] } }", () => {
    expect(normalizeIcpGetResponse({ data: { icps: [{ id: "a" }] } })).toHaveLength(1);
  });
  it("wraps a single root ICP object", () => {
    expect(normalizeIcpGetResponse({ id: "solo", industry: "SaaS" })).toHaveLength(1);
  });
  it("returns [] for an empty/garbage payload", () => {
    expect(normalizeIcpGetResponse(null)).toEqual([]);
    expect(normalizeIcpGetResponse({})).toEqual([]);
  });
});

describe("mapApiICPToSuggested", () => {
  it("fills safe defaults for a sparse item", () => {
    const out = mapApiICPToSuggested({ id: "x" }, 0, "new");
    expect(out.id).toBe("x");
    expect(out.industry).toBe("Unknown Industry");
    expect(out.confidenceScore).toBe("Medium");
    expect(out.decisionMakers.length).toBeGreaterThan(0);
  });
  it("reads snake_case + firmographics aliases", () => {
    const out = mapApiICPToSuggested(
      { id: "y", company_size: "200-500", firmographics: { segment: "RevOps" } },
      0,
    );
    expect(out.companySize).toBe("200-500");
    expect(out.segment).toBe("RevOps");
  });
});

describe("analyzeICP", () => {
  it("counts strengths and grades confidence", () => {
    const a = analyzeICP({
      id: "1",
      name: "ICP 1",
      industry: "SaaS",
      buyerRole: "CTO",
      companySize: "100-500",
      geography: "NA",
    });
    expect(a.confidence).toBe("High");
    expect(a.strengths.length).toBeGreaterThanOrEqual(4);
  });
});
