import { describe, it, expect } from "vitest";

import { segmentsToPieData, projectionsToLineData } from "./marketSize";

// ---------------------------------------------------------------------------
// segmentsToPieData
// ---------------------------------------------------------------------------
describe("segmentsToPieData", () => {
  it("maps a record of segments to ordered slices preserving label/value/order", () => {
    const result = segmentsToPieData({ Enterprise: "40%", SMB: "35%", Startup: "25%" });
    expect(result).toEqual([
      { name: "Enterprise", value: 40, color: "#3B82F6" },
      { name: "SMB", value: 35, color: "#10B981" },
      { name: "Startup", value: 25, color: "#8B5CF6" },
    ]);
  });

  it("strips the % sign and parses the integer value", () => {
    const result = segmentsToPieData({ A: "12%" });
    expect(result[0].value).toBe(12);
  });

  it("cycles the 4-color palette when there are more than 4 entries", () => {
    const result = segmentsToPieData({
      A: "10%",
      B: "10%",
      C: "10%",
      D: "10%",
      E: "10%",
    });
    expect(result[4].color).toBe(result[0].color);
  });

  it("returns the default 3-slice fallback for empty input (no throw)", () => {
    expect(segmentsToPieData({})).toEqual([
      { name: "Enterprise", value: 45, color: "#3B82F6" },
      { name: "Mid-Market", value: 35, color: "#10B981" },
      { name: "SMB", value: 20, color: "#8B5CF6" },
    ]);
  });

  it("parses a JSON string of segments", () => {
    const result = segmentsToPieData(JSON.stringify({ Enterprise: "60%", SMB: "40%" }));
    expect(result).toEqual([
      { name: "Enterprise", value: 60, color: "#3B82F6" },
      { name: "SMB", value: 40, color: "#10B981" },
    ]);
  });

  it("returns the default fallback when a string cannot be parsed (no throw)", () => {
    expect(segmentsToPieData("not json")).toEqual([
      { name: "Enterprise", value: 45, color: "#3B82F6" },
      { name: "Mid-Market", value: 35, color: "#10B981" },
      { name: "SMB", value: 20, color: "#8B5CF6" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// projectionsToLineData
// ---------------------------------------------------------------------------
describe("projectionsToLineData", () => {
  it("maps a record of projections to ordered points (value * 100)", () => {
    const result = projectionsToLineData({ "2024": "10", "2025": "14" });
    expect(result).toEqual([
      { name: "2024", value: 1000 },
      { name: "2025", value: 1400 },
    ]);
  });

  it("coerces a non-numeric value to 100 (no throw)", () => {
    const result = projectionsToLineData({ "2024": "abc" });
    expect(result[0].value).toBe(100);
  });

  it("returns the default 4-point fallback for empty input (no throw)", () => {
    expect(projectionsToLineData({})).toEqual([
      { name: "2023", value: 100 },
      { name: "2024", value: 115 },
      { name: "2025", value: 132 },
      { name: "2026", value: 152 },
    ]);
  });

  it("parses a JSON string of projections", () => {
    const result = projectionsToLineData(JSON.stringify({ "2024": "2" }));
    expect(result).toEqual([{ name: "2024", value: 200 }]);
  });

  it("returns the string-parse-failure fallback when a string cannot be parsed (no throw)", () => {
    expect(projectionsToLineData("not json")).toEqual([
      { name: "2023", value: 100 },
      { name: "2024", value: 120 },
      { name: "2025", value: 144 },
      { name: "2026", value: 173 },
    ]);
  });
});
