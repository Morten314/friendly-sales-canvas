import { describe, expect, it } from "vitest";

import { ResearchComponentSchema } from "@/features/market-research/contracts";

const realComponentPayload = {
  status: "success",
  data: { title: "Market Overview", summary: "The global SaaS market..." },
};

describe("market-research contracts", () => {
  it("parses a real per-component response", () => {
    expect(() =>
      ResearchComponentSchema.parse(realComponentPayload),
    ).not.toThrow();
  });

  it("accepts extra envelope fields via passthrough", () => {
    expect(() =>
      ResearchComponentSchema.parse({ ...realComponentPayload, cached: true }),
    ).not.toThrow();
  });

  it("rejects a response missing the envelope", () => {
    expect(() => ResearchComponentSchema.parse({ data: {} })).toThrow(); // no `status`
  });

  it("rejects a non-object data field", () => {
    expect(() =>
      ResearchComponentSchema.parse({ status: "success", data: "string" }),
    ).toThrow();
  });
});
