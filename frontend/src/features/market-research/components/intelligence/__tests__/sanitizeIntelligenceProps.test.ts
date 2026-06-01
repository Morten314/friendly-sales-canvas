import { describe, it, expect } from "vitest";

import { sanitizeIntelligenceProps } from "../sanitizeIntelligenceProps";

const base = (over: Record<string, unknown> = {}) =>
  ({ marketSizeDeletedSections: new Set<string>(), ...over }) as unknown as Parameters<
    typeof sanitizeIntelligenceProps
  >[0];

describe("sanitizeIntelligenceProps", () => {
  it("preserves a function prop through the JSON round-trip", () => {
    const fn = () => "kept";
    const out = sanitizeIntelligenceProps(base({ onMarketSizeRefresh: fn })) as unknown as Record<
      string,
      unknown
    >;
    expect(typeof out.onMarketSizeRefresh).toBe("function");
    expect((out.onMarketSizeRefresh as () => string)()).toBe("kept");
  });

  it("rebuilds *DeletedSections as a Set", () => {
    const out = sanitizeIntelligenceProps(
      base({ marketSizeDeletedSections: new Set(["a", "b"]) }),
    ) as unknown as Record<string, unknown>;
    expect(out.marketSizeDeletedSections).toBeInstanceOf(Set);
    expect(out.marketSizeDeletedSections as Set<string>).toEqual(new Set(["a", "b"]));
  });

  it("coerces companyProfile.targetMarkets object -> array", () => {
    const out = sanitizeIntelligenceProps(
      base({ companyProfile: { targetMarkets: { "North America": 1, Europe: 2 } } }),
    ) as unknown as Record<string, unknown>;
    expect(Array.isArray((out.companyProfile as { targetMarkets: unknown }).targetMarkets)).toBe(
      true,
    );
  });

  it("keeps industryTrendsRegionalHotspots as an object (not array-coerced)", () => {
    const out = sanitizeIntelligenceProps(
      base({ industryTrendsRegionalHotspots: { "North America": ["x"] } }),
    ) as unknown as Record<string, unknown>;
    expect(Array.isArray(out.industryTrendsRegionalHotspots)).toBe(false);
    expect(out.industryTrendsRegionalHotspots).toEqual({ "North America": ["x"] });
  });

  it("JSON-stringifies a render-unsafe object (channel/trigger/description key) to a string", () => {
    const out = sanitizeIntelligenceProps(
      base({ marketEntry: { channel: "x" } }),
    ) as unknown as Record<string, unknown>;
    expect(typeof out.marketEntry).toBe("string");
    expect(JSON.parse(out.marketEntry as string)).toEqual({ channel: "x" });
  });
});
