import { describe, expect, it } from "vitest";

import { filterLeadsBySource, LEAD_SOURCE_OPTIONS } from "../leadSource";

const leads = [
  { id: "1", source: "apollo" },
  { id: "2", source: "csv" },
  { id: "3", source: "HubSpot" },
];

describe("filterLeadsBySource", () => {
  it("returns all for 'all'", () => {
    expect(filterLeadsBySource(leads, "all")).toHaveLength(3);
  });
  it("returns only apollo for 'apollo'", () => {
    expect(filterLeadsBySource(leads, "apollo").map((l) => l.id)).toEqual(["1"]);
  });
  it("treats any non-apollo source as 'csv' bucket (csv | other uploads)", () => {
    expect(filterLeadsBySource(leads, "csv").map((l) => l.id)).toEqual(["2", "3"]);
  });
  it("exposes three options", () => {
    expect(LEAD_SOURCE_OPTIONS.map((o) => o.value)).toEqual(["all", "csv", "apollo"]);
  });
});
