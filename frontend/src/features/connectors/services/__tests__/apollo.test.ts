import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import {
  fetchApolloStatus,
  fetchApolloWarmup,
  startApolloDiscover,
  fetchApolloDiscoverStatus,
} from "../apollo";

describe("apollo read/discover services", () => {
  it("fetchApolloStatus parses the status envelope", async () => {
    server.use(
      http.get("/api/connectors/apollo/status", () =>
        HttpResponse.json({
          connected: true,
          status: "connected",
          credits_consumed_total: 12,
          last_run_credits: 12,
          low_credit: false,
          icp_changed_since_last_discovery: false,
        }),
      ),
    );
    const s = await fetchApolloStatus("o1");
    expect(s.connected).toBe(true);
    expect(s.credits_consumed_total).toBe(12);
  });

  it("fetchApolloWarmup parses readiness", async () => {
    server.use(
      http.get("/api/connectors/apollo/warmup", () =>
        HttpResponse.json({
          icp_configured: true,
          signals_generated: true,
          scout_completed: true,
          profiler_analyzed: true,
          ready_count: 4,
          unlocked: true,
          missing: [],
        }),
      ),
    );
    const w = await fetchApolloWarmup("o1", "u1");
    expect(w.unlocked).toBe(true);
  });

  it("startApolloDiscover posts the run body and returns run_id", async () => {
    let body: unknown;
    server.use(
      http.post("/api/connectors/apollo/discover", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ run_id: "r9", status: "queued" });
      }),
    );
    const r = await startApolloDiscover({ orgId: "o1", userId: "u1", mode: "replace" });
    expect(r.run_id).toBe("r9");
    expect(body).toMatchObject({ org_id: "o1", user_id: "u1", mode: "replace" });
  });

  it("fetchApolloDiscoverStatus parses counts", async () => {
    server.use(
      http.get("/api/connectors/apollo/discover/status", () =>
        HttpResponse.json({
          run_id: "r9",
          org_id: "o1",
          status: "completed",
          mode: "keep",
          counts: { searched: 100, created: 10, matched: 0, errors: [] },
          credits_consumed: 10,
          progress_percent: 100,
        }),
      ),
    );
    const st = await fetchApolloDiscoverStatus("o1", "r9");
    expect(st.counts.created).toBe(10);
    expect(st.status).toBe("completed");
  });

  it("startApolloDiscover surfaces a 409 in-progress as an Error", async () => {
    server.use(
      http.post("/api/connectors/apollo/discover", () =>
        HttpResponse.json(
          { detail: "in progress", code: "discovery_in_progress" },
          { status: 409 },
        ),
      ),
    );
    await expect(
      startApolloDiscover({ orgId: "o1", userId: "u1", mode: "keep" }),
    ).rejects.toThrow();
  });
});
