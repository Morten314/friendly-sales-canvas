import { describe, expect, it } from "vitest";

import {
  ApolloStatusSchema,
  ApolloWarmupSchema,
  ApolloDiscoverResponseSchema,
  ApolloDiscoverStatusSchema,
} from "../contracts";

describe("apollo contracts", () => {
  it("parses warmup with missing[] and passes through extras", () => {
    const w = ApolloWarmupSchema.parse({
      icp_configured: true,
      signals_generated: false,
      scout_completed: true,
      profiler_analyzed: true,
      ready_count: 3,
      unlocked: false,
      missing: [
        {
          step: "signals_generated",
          label: "Signals — first run",
          deep_link_hint: "signals",
        },
      ],
      _extra: "ignored",
    });
    expect(w.unlocked).toBe(false);
    expect(w.missing[0].deep_link_hint).toBe("signals");
  });

  it("defaults warmup.missing to [] when absent", () => {
    const w = ApolloWarmupSchema.parse({
      icp_configured: false,
      signals_generated: false,
      scout_completed: false,
      profiler_analyzed: false,
      ready_count: 0,
      unlocked: false,
    });
    expect(w.missing).toEqual([]);
  });

  it("parses status with credit + icp-change fields", () => {
    const s = ApolloStatusSchema.parse({
      connected: true,
      status: "connected",
      credits_consumed_total: 48,
      last_run_credits: 48,
      low_credit: false,
      icp_changed_since_last_discovery: true,
      last_discovery_at: "2026-06-13T00:00:00Z",
    });
    expect(s.icp_changed_since_last_discovery).toBe(true);
    expect(s.last_discovery_at).toBe("2026-06-13T00:00:00Z");
  });

  it("applies status defaults when optional fields are absent", () => {
    const s = ApolloStatusSchema.parse({ connected: false, status: "disconnected" });
    expect(s.credits_consumed_total).toBe(0);
    expect(s.last_run_credits).toBe(0);
    expect(s.low_credit).toBe(false);
    expect(s.icp_changed_since_last_discovery).toBe(false);
  });

  it("parses discover response and discover-status with counts.errors objects", () => {
    expect(ApolloDiscoverResponseSchema.parse({ run_id: "r1", status: "queued" }).run_id).toBe(
      "r1",
    );
    const st = ApolloDiscoverStatusSchema.parse({
      run_id: "r1",
      org_id: "o1",
      status: "partial",
      mode: "keep",
      counts: {
        searched: 120,
        created: 8,
        matched: 2,
        errors: [{ stage: "reveal", message: "credit wall" }],
      },
      credits_consumed: 8,
      progress_percent: 80,
    });
    expect(st.counts.created).toBe(8);
    expect(st.counts.errors[0].stage).toBe("reveal");
    expect(st.counts.skipped_duplicates).toBe(0); // defaulted
  });
});
