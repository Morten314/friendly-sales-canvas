import { describe, expect, it } from "vitest";

import { parseMarketSizeResult } from "./types";

describe("parseMarketSizeResult", () => {
  it("coerces numeric growthProjections values to strings", () => {
    const result = parseMarketSizeResult({
      status: "success",
      data: {
        growthProjections: { "2023": 1.0, "2026": 1.5, "2027": 2.5 },
      },
    });

    expect(result?.growthProjections).toEqual({
      "2023": "1",
      "2026": "1.5",
      "2027": "2.5",
    });
  });

  it("accepts string growthProjections values unchanged", () => {
    const result = parseMarketSizeResult({
      status: "success",
      data: {
        growthProjections: { "2024": "10", "2025": "14" },
      },
    });

    expect(result?.growthProjections).toEqual({
      "2024": "10",
      "2025": "14",
    });
  });
});
