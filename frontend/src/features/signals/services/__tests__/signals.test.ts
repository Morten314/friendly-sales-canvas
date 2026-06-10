import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchSignals, generateSignalsBatch } from "../signals";

import { server } from "@/test/msw/server";

describe("fetchSignals", () => {
  it("parses and returns the signals envelope", async () => {
    server.use(
      http.get("/api/v2/fetch-signals", () =>
        HttpResponse.json({ items: [{ id: "s1" }, { id: "s2" }], total: 2, limit: 10, offset: 0 }),
      ),
    );
    const res = await fetchSignals("u1");
    expect(res).toMatchObject({ signals: [{ id: "s1" }, { id: "s2" }] });
  });

  it("requests user_id, limit=10 and offset=0", async () => {
    let seenUrl = "";
    server.use(
      http.get("/api/v2/fetch-signals", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 });
      }),
    );
    await fetchSignals("u1");
    expect(seenUrl).toContain("user_id=u1");
    expect(seenUrl).toContain("limit=10");
    expect(seenUrl).toContain("offset=0");
  });

  it("throws on a non-ok response", async () => {
    server.use(http.get("/api/v2/fetch-signals", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchSignals("u1")).rejects.toThrow(/Failed to fetch signals: 500/);
  });

  it("throws when the response is not JSON", async () => {
    server.use(
      http.get(
        "/api/v2/fetch-signals",
        () => new HttpResponse("plain text", { headers: { "content-type": "text/plain" } }),
      ),
    );
    await expect(fetchSignals("u1")).rejects.toThrow("Server returned non-JSON response");
  });
});

describe("generateSignalsBatch", () => {
  it("parses the response and sends the lifted body shape", async () => {
    let body: unknown;
    server.use(
      http.post("/api/generate-signals-batch_claude", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ signals: [] });
      }),
    );
    const res = await generateSignalsBatch("u1");
    expect(res).toMatchObject({ signals: [] });
    expect(body).toMatchObject({
      user_id: "u1",
      component_name: "test",
      refresh: true,
      data: { industry: "SaaS", companySize: "50-200 employees" },
    });
  });

  it("throws on a non-ok response", async () => {
    server.use(
      http.post("/api/generate-signals-batch_claude", () => new HttpResponse(null, { status: 500 })),
    );
    await expect(generateSignalsBatch("u1")).rejects.toThrow(/Failed to generate signals: 500/);
  });
});
