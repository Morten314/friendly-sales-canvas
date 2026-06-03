import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { ResearchComponentSchema } from "../contracts";

const realComponentPayload = {
  status: "success",
  data: { title: "Market Overview", summary: "The global SaaS market..." },
};

describe("market-research contracts", () => {
  it("parses a real per-component response", () => {
    const parsed = ResearchComponentSchema.parse(realComponentPayload);
    expect(parsed.status).toBe("success");
    expect(parsed.data).toEqual(realComponentPayload.data);
  });

  it("accepts extra envelope fields via passthrough", () => {
    const parsed = ResearchComponentSchema.parse({ ...realComponentPayload, cached: true });
    expect(parsed.cached).toBe(true);
  });

  it("rejects a response missing the envelope", () => {
    expect(() => ResearchComponentSchema.parse({ data: {} })).toThrow(ZodError); // no `status`
  });

  it("rejects a non-object data field", () => {
    expect(() => ResearchComponentSchema.parse({ status: "success", data: "string" })).toThrow(
      ZodError,
    );
  });
});
