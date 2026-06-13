import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  fetchApolloStatus,
  fetchApolloWarmup,
  startApolloDiscover,
  fetchApolloDiscoverStatus,
  connectApollo,
  apolloLeadsExportUrl,
  ApolloConnectError,
  ApolloDiscoverError,
} from "../apollo";

import { server } from "@/test/msw/server";

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

  it("startApolloDiscover throws a typed ApolloDiscoverError with code on 409 in-progress", async () => {
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
    ).rejects.toMatchObject({ code: "discovery_in_progress", httpStatus: 409 });
    await startApolloDiscover({ orgId: "o1", userId: "u1", mode: "keep" }).catch((e) => {
      expect(e).toBeInstanceOf(ApolloDiscoverError);
    });
  });

  it("startApolloDiscover throws ApolloDiscoverError with code on 422 icp_underspecified", async () => {
    server.use(
      http.post("/api/connectors/apollo/discover", () =>
        HttpResponse.json({ detail: "too narrow", code: "icp_underspecified" }, { status: 422 }),
      ),
    );
    await expect(
      startApolloDiscover({ orgId: "o1", userId: "u1", mode: "keep" }),
    ).rejects.toMatchObject({ code: "icp_underspecified", httpStatus: 422 });
  });
});

describe("connectApollo (error-body parsing — G1)", () => {
  it("returns the parsed body on success", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const r = await connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" });
    expect(r.connected).toBe(true);
  });

  it("throws ApolloConnectError with code+missing_section on 409 profile_incomplete", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json(
          { detail: "incomplete", code: "profile_incomplete", missing_section: "industry" },
          { status: 409 },
        ),
      ),
    );
    await expect(connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" })).rejects.toMatchObject({
      code: "profile_incomplete",
      missing_section: "industry",
      httpStatus: 409,
    });
    await connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" }).catch((e) => {
      expect(e).toBeInstanceOf(ApolloConnectError);
    });
  });

  it("throws ApolloConnectError with code master_key_required on 403", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json(
          { detail: "needs master key", code: "master_key_required" },
          { status: 403 },
        ),
      ),
    );
    await expect(connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" })).rejects.toMatchObject({
      code: "master_key_required",
    });
  });
});

describe("apolloLeadsExportUrl (G2)", () => {
  it("builds a proxied URL with org_id and format", () => {
    const url = apolloLeadsExportUrl("o1", "csv");
    expect(url).toContain("connectors/apollo/leads/export");
    expect(url).toContain("org_id=o1");
    expect(url).toContain("format=csv");
  });
});
