import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  acceptSuggestedIcp,
  deleteCurrentIcp,
  fetchCustomerProfileIcps,
  fetchSuggestedIcps,
  rejectRecommendedIcp,
} from "../customers";

import { BACKEND_BASE_URL } from "@/shared/api/transport";
import { server } from "@/test/msw/server";

describe("fetchSuggestedIcps", () => {
  it("parses the wrapped { icps: [...] } envelope", async () => {
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({ icps: [{ id: "r1" }, { id: "r2" }] }),
      ),
    );
    const res = await fetchSuggestedIcps("u1");
    expect(res).toMatchObject({ icps: [{ id: "r1" }, { id: "r2" }] });
  });

  it("parses a bare array response", async () => {
    server.use(http.get(`${BACKEND_BASE_URL}/icp`, () => HttpResponse.json([{ id: "r1" }])));
    const res = await fetchSuggestedIcps("u1");
    expect(Array.isArray(res)).toBe(true);
  });

  it("sends refresh=true when requested", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await fetchSuggestedIcps("u1", { refresh: true });
    expect(seenUrl).toContain("refresh=true");
    expect(seenUrl).toContain("user_id=u1");
  });

  it("throws on a non-ok response", async () => {
    server.use(http.get(`${BACKEND_BASE_URL}/icp`, () => new HttpResponse(null, { status: 500 })));
    await expect(fetchSuggestedIcps("u1")).rejects.toThrow(/GET \/icp failed: 500/);
  });
});

describe("fetchCustomerProfileIcps", () => {
  it("returns the extracted rows from the shared customer_profile read", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({ icps: [{ id: "i1" }, { id: "i2" }] }),
      ),
    );
    const rows = await fetchCustomerProfileIcps("u1", "org1");
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("write services", () => {
  it("accepts a suggested ICP (POST from_suggested_icp)", async () => {
    let body: unknown;
    server.use(
      http.post("/api/customer_profile/from_suggested_icp", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, data: { id: "p1" } });
      }),
    );
    await acceptSuggestedIcp("u1", "org1", "icp1");
    expect(body).toMatchObject({ user_id: "u1", org_id: "org1", icp_id: "icp1" });
  });

  it("rejects a recommended ICP (DELETE icp/recommended/:id)", async () => {
    let url = "";
    server.use(
      http.delete("/api/icp/recommended/:icpId", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true });
      }),
    );
    await rejectRecommendedIcp("u1", "icp1");
    expect(url).toContain("/icp/recommended/icp1");
    expect(url).toContain("user_id=u1");
  });

  it("deletes a current ICP (DELETE customer_profile/icp/:id)", async () => {
    let url = "";
    server.use(
      http.delete("/api/customer_profile/icp/:icpId", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true, data: { remaining_count: 0 } });
      }),
    );
    await deleteCurrentIcp("org1", "icp1");
    expect(url).toContain("/customer_profile/icp/icp1");
    expect(url).toContain("org_id=org1");
  });
});
