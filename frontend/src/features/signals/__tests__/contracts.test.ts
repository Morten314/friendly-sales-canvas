import { describe, expect, it } from "vitest";

import { SignalLeadMapResponseSchema } from "../contracts";

// Anonymized golden fixture — the SHAPE captured from the live
// /signal-lead-map_claude envelope (2026-06-19), values scrubbed. The live
// account returned an empty mapping[] (0 leads); the per-entry/per-lead
// sub-shape is grounded on lead_map.py::_parse_mapping (server-normalized).
const GOLDEN = {
  status: "success",
  data: {
    mapping: [
      {
        signal_id: "sig-anon-1",
        headline: "Anonymized headline",
        leads: [
          { lead_id: "lead-anon-1", company: "Example Co", relevance: "high", why: "ICP fit" },
          { lead_id: "lead-anon-2", company: "Another Co", relevance: "medium", why: "" },
        ],
      },
    ],
    generated_at: "2026-06-19T00:00:00Z",
    cached: false,
  },
};

describe("SignalLeadMapResponseSchema (tightened, TD-FE-73)", () => {
  it("parses the golden live-shape fixture and exposes status/generated_at/cached", () => {
    const parsed = SignalLeadMapResponseSchema.parse(GOLDEN);
    expect(parsed.status).toBe("success");
    expect(parsed.data.generated_at).toBe("2026-06-19T00:00:00Z");
    expect(parsed.data.cached).toBe(false);
    expect(parsed.data.mapping[0].leads[0].company).toBe("Example Co");
  });

  it("parses the empty-mapping envelope (the dominant prod case today)", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: { mapping: [], generated_at: "t", cached: false },
    });
    expect(parsed.data.mapping).toEqual([]);
  });

  it("keeps degrade-never-throw guards: defaults company/why, catches relevance", () => {
    const parsed = SignalLeadMapResponseSchema.parse({
      status: "success",
      data: {
        mapping: [
          { signal_id: "s1", leads: [{ lead_id: "l1", relevance: "weird" }] },
          { signal_id: "s2" }, // entry with no `leads` key
        ],
      },
    });
    expect(parsed.data.mapping[0].leads[0].company).toBe("");
    expect(parsed.data.mapping[0].leads[0].why).toBe("");
    expect(parsed.data.mapping[0].leads[0].relevance).toBe("low");
    expect(parsed.data.mapping[0].headline).toBe("");
    expect(parsed.data.mapping[1].leads).toEqual([]); // entry-level .default([])
  });
});
