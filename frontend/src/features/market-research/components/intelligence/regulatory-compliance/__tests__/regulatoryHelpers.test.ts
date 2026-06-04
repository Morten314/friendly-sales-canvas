import { describe, expect, it } from "vitest";

import { getIconByName, getBadgeColor, deriveKeyDataPoints } from "../regulatoryHelpers";

describe("regulatoryHelpers", () => {
  it("maps a known icon name to a component and falls back for unknown", () => {
    expect(getIconByName("scale")).toBeTruthy();
    expect(getIconByName("nonsense")).toBeTruthy();
  });
  it("maps known tags to distinct badge colours", () => {
    expect(getBadgeColor("New")).not.toEqual(getBadgeColor("Update"));
  });
  it("derives key data points from a keyUpdates array", () => {
    const pts = deriveKeyDataPoints(
      [{ title: "EU AI Act", description: "starts Q1 2026", tag: "New" }],
      {
        euAiActDeadline: "Q1 2026",
        gdprCompliance: "x",
        potentialFines: "y",
        dataLocalization: "z",
      },
    );
    expect(pts[0].title).toBe("EU AI Act");
    expect(pts[0].badge).toBe("New");
  });
  it("returns the hardcoded default set when keyUpdates is absent", () => {
    const pts = deriveKeyDataPoints(undefined, {
      euAiActDeadline: "Q1 2026",
      gdprCompliance: "x",
      potentialFines: "y",
      dataLocalization: "z",
    });
    expect(pts.length).toBeGreaterThan(0);
  });
});
