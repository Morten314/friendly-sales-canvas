import { describe, expect, it } from "vitest";

import { filterLeadsBySource, LEAD_SOURCE_OPTIONS, normalizeLeadSource } from "../leadSource";

describe("normalizeLeadSource", () => {
  it("passes through known tokens (case-insensitive, trimmed)", () => {
    expect(normalizeLeadSource("apollo")).toBe("apollo");
    expect(normalizeLeadSource("CSV")).toBe("csv");
    expect(normalizeLeadSource(" Manual ")).toBe("manual");
  });
  it("maps null/empty/legacy/unrecognized to 'unknown'", () => {
    expect(normalizeLeadSource(null)).toBe("unknown");
    expect(normalizeLeadSource(undefined)).toBe("unknown");
    expect(normalizeLeadSource("")).toBe("unknown");
    expect(normalizeLeadSource("HubSpot")).toBe("unknown");
    expect(normalizeLeadSource("Prospect List")).toBe("unknown");
  });
});

describe("filterLeadsBySource", () => {
  const leads = [
    { id: "1", source: "apollo" },
    { id: "2", source: "csv" },
    { id: "3", source: "manual" },
    { id: "4", source: "HubSpot" },
    { id: "5", source: null },
  ];
  it("returns all for 'all'", () => {
    expect(filterLeadsBySource(leads, "all")).toHaveLength(5);
  });
  it("matches exactly on each live value", () => {
    expect(filterLeadsBySource(leads, "apollo").map((l) => l.id)).toEqual(["1"]);
    expect(filterLeadsBySource(leads, "csv").map((l) => l.id)).toEqual(["2"]);
    expect(filterLeadsBySource(leads, "manual").map((l) => l.id)).toEqual(["3"]);
  });
  it("groups legacy/null sources under 'unknown'", () => {
    expect(filterLeadsBySource(leads, "unknown").map((l) => l.id)).toEqual(["4", "5"]);
  });
  it("exposes the five live options in order", () => {
    expect(LEAD_SOURCE_OPTIONS.map((o) => o.value)).toEqual([
      "all",
      "apollo",
      "csv",
      "manual",
      "unknown",
    ]);
  });
});
