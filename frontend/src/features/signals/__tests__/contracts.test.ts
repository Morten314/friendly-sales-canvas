import { describe, expect, it } from "vitest";

import { SignalLeadMapResponseSchema } from "../contracts";

describe("SignalLeadMapResponseSchema", () => {
  it("parses a representative payload and defaults missing fields", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: {
        mapping: [
          {
            signal_id: "s1",
            headline: "h",
            leads: [{ lead_id: "l1", relevance: "high", why: "x" }],
          },
          { signal_id: "s2" },
        ],
      },
    });
    expect(parsed.data.mapping[0].leads[0].company).toBe(""); // default
    expect(parsed.data.mapping[1].leads).toEqual([]); // default
  });

  it("coerces an unexpected relevance to 'low'", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      data: {
        mapping: [{ signal_id: "s1", leads: [{ lead_id: "l1", relevance: "weird", why: "" }] }],
      },
    });
    expect(parsed.data.mapping[0].leads[0].relevance).toBe("low");
  });
});
